import { ref } from 'vue'
import { defineStore } from 'pinia'
import type { MobileMemoryPalace, MobilePalace, MobilePalaceLocus, MobilePegItem } from './useUtils/types'
import { recordTombstone } from './useUtils/sync-tombstone'
import { getDbAdapter } from '@/adapters/index'
import {
  isPegDue,
  markPegForgotten,
  markPegRemembered,
  mergePalaceList,
  mergePegItemList,
} from '../utils/memory-palace'

/**
 * 记忆宫殿 store（移动端）
 *
 * 支持宫殿与桩位的创建/编辑（含导入桩库后的批量添加）、巡视自评。
 * 存储 doc id 与桌面端一致：
 * - `memory_palace_palaces`：所有宫殿（含桩图 dataURL，走 MiniProgramDbAdapter 900KB 自动分块）
 * - `memory_palace_pegs_<palaceId>`：每宫殿的桩挂载（含巡视 SRS 进度）
 */

const PALACES_DOC_ID = 'memory_palace_palaces'
const PEGS_DOC_PREFIX = 'memory_palace_pegs_'

interface PalacesDoc {
  _id: string
  _rev?: string
  type: 'memory_palace_palaces'
  palaces: MobilePalace[]
  updatedAt: number
}

interface PegsDoc {
  _id: string
  _rev?: string
  type: 'memory_palace_pegs'
  palaceId: string
  items: MobilePegItem[]
  updatedAt: number
}

function pegsDocId(palaceId: string): string {
  return PEGS_DOC_PREFIX + palaceId
}

export const useMemoryPalace = defineStore('mobileMemoryPalace', () => {
  const palaces = ref<MobilePalace[]>([])
  const pegsMap = ref<Record<string, MobilePegItem[]>>({})
  const loaded = ref(false)

  /** 从存储加载（幂等，可在多个页面安全调用） */
  function load() {
    if (loaded.value) return
    const db = getDbAdapter()
    const doc = db.get<PalacesDoc>(PALACES_DOC_ID)
    palaces.value = doc && Array.isArray(doc.palaces) ? doc.palaces : []
    const pegs: Record<string, MobilePegItem[]> = {}
    for (const pegsDoc of db.allDocs<PegsDoc>(PEGS_DOC_PREFIX)) {
      if (pegsDoc.palaceId && Array.isArray(pegsDoc.items)) {
        pegs[pegsDoc.palaceId] = [...pegsDoc.items].sort((a, b) => a.locusOrder - b.locusOrder)
      }
    }
    pegsMap.value = pegs
    loaded.value = true
  }

  function persistPalaces() {
    const db = getDbAdapter()
    const existing = db.get<PalacesDoc>(PALACES_DOC_ID)
    db.put({
      _id: PALACES_DOC_ID,
      _rev: existing?._rev,
      type: 'memory_palace_palaces',
      palaces: palaces.value,
      updatedAt: Date.now(),
    } as PalacesDoc)
  }

  function persistPegs(palaceId: string) {
    const db = getDbAdapter()
    const id = pegsDocId(palaceId)
    const existing = db.get<PegsDoc>(id)
    const items = pegsMap.value[palaceId] || []
    if (items.length === 0) {
      if (existing) db.remove(id)
      return
    }
    db.put({
      _id: id,
      _rev: existing?._rev,
      type: 'memory_palace_pegs',
      palaceId,
      items,
      updatedAt: Date.now(),
    } as PegsDoc)
  }

  function getPalace(palaceId: string): MobilePalace | undefined {
    return palaces.value.find(p => p._id === palaceId)
  }

  function pegsOf(palaceId: string): MobilePegItem[] {
    return pegsMap.value[palaceId] || []
  }

  /** 宫殿待巡视桩数（已到复习间隔的挂载数） */
  function dueCount(palaceId: string, now: number = Date.now()): number {
    return pegsOf(palaceId).filter(peg => isPegDue(peg, now)).length
  }

  /**
   * 巡视自评（记住/忘记），按统一 SRS 标准更新并持久化
   * @returns 更新后的挂载；该桩无挂载时返回 null
   */
  function assess(palaceId: string, locusOrder: number, remembered: boolean): MobilePegItem | null {
    load()
    const items = pegsOf(palaceId)
    const index = items.findIndex(p => p.locusOrder === locusOrder)
    if (index < 0) return null
    const updated = remembered
      ? markPegRemembered(items[index], Date.now())
      : markPegForgotten(items[index], Date.now())
    const next = [...items]
    next[index] = updated
    pegsMap.value = { ...pegsMap.value, [palaceId]: next }
    persistPegs(palaceId)
    return updated
  }

  // ===== 创建 / 编辑 =====

  /** 生成新宫殿 ID */
  function newPalaceId(): string {
    return 'palace-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6)
  }

  /** 创建宫殿（仅名称，桩位后续逐个添加） */
  function createPalace(name: string): MobilePalace {
    load()
    const now = Date.now()
    const palace: MobilePalace = {
      _id: newPalaceId(),
      name,
      loci: [],
      ctime: now,
      utime: now,
    }
    palaces.value = [...palaces.value, palace]
    persistPalaces()
    return palace
  }

  /** 更新宫殿名称 */
  function updatePalace(palaceId: string, name: string) {
    load()
    palaces.value = palaces.value.map(p =>
      p._id === palaceId ? { ...p, name, utime: Date.now() } : p
    )
    persistPalaces()
  }

  /** 删除宫殿（连带桩挂载） */
  function deletePalace(palaceId: string) {
    load()
    palaces.value = palaces.value.filter(p => p._id !== palaceId)
    delete pegsMap.value[palaceId]
    persistPalaces()
    const db = getDbAdapter()
    db.remove(pegsDocId(palaceId))
    // 墓碑：另一台手机拉旧备份时不让已删宫殿复活
    recordTombstone(palaceId)
  }

  /** 添加桩位 */
  function addLocus(palaceId: string, locus: { name: string; description?: string; imageUrl?: string }) {
    load()
    const palace = getPalace(palaceId)
    if (!palace) return
    const order = palace.loci.length + 1
    palaces.value = palaces.value.map(p =>
      p._id === palaceId ? { ...p, loci: [...p.loci, { order, ...locus }], utime: Date.now() } : p
    )
    persistPalaces()
  }

  /** 更新桩位 */
  function updateLocus(palaceId: string, order: number, patch: Partial<MobilePalaceLocus>) {
    load()
    palaces.value = palaces.value.map(p =>
      p._id === palaceId
        ? { ...p, loci: p.loci.map(l => l.order === order ? { ...l, ...patch } : l), utime: Date.now() }
        : p
    )
    persistPalaces()
  }

  /**
   * 全量替换桩位（编辑宫殿用）：挂载按 origOrder 携带身份重映射，
   * 不带 origOrder 的新增桩不挂载，被删除的桩挂载丢弃
   */
  function replaceLoci(palaceId: string, loci: Array<{ name: string; description?: string; imageUrl?: string; origOrder?: number }>) {
    load()
    const palace = getPalace(palaceId)
    if (!palace) return
    // 新顺序按数组下标重排 order，origOrder 记录原 order 以便挂载跟随
    const nextLoci = loci.map((l, i) => ({
      order: i + 1,
      name: l.name,
      description: l.description,
      imageUrl: l.imageUrl,
    }))
    palaces.value = palaces.value.map(p =>
      p._id === palaceId ? { ...p, loci: nextLoci, utime: Date.now() } : p
    )
    persistPalaces()
    // 旧 order → 新 order 映射，被删桩（不在映射中）的挂载丢弃
    const orderMap = new Map<number, number>()
    loci.forEach((l, i) => {
      if (l.origOrder != null) orderMap.set(l.origOrder, i + 1)
    })
    const items = (pegsMap.value[palaceId] || [])
      .filter(p => orderMap.has(p.locusOrder))
      .map(p => ({ ...p, locusOrder: orderMap.get(p.locusOrder)! }))
      .sort((a, b) => a.locusOrder - b.locusOrder)
    pegsMap.value = { ...pegsMap.value, [palaceId]: items }
    persistPegs(palaceId)
  }

  /** 删除桩位（重排剩余桩的 order） */
  function removeLocus(palaceId: string, order: number) {
    load()
    const palace = getPalace(palaceId)
    if (!palace) return
    const keptLoci = palace.loci.filter(l => l.order !== order)
    // 旧 order → 新 order 映射（删除点之后的桩位顺次前移），挂载重排与桩位保持一致
    const orderMap = new Map(keptLoci.map((l, i) => [l.order, i + 1]))
    const nextLoci = keptLoci.map((l, i) => ({ ...l, order: i + 1 }))
    palaces.value = palaces.value.map(p =>
      p._id === palaceId ? { ...p, loci: nextLoci, utime: Date.now() } : p
    )
    persistPalaces()
    // 删除被删桩的挂载，其余挂载按映射表改 locusOrder
    const items = (pegsMap.value[palaceId] || [])
      .filter(p => p.locusOrder !== order)
      .map(p => ({ ...p, locusOrder: orderMap.get(p.locusOrder) ?? p.locusOrder }))
      .sort((a, b) => a.locusOrder - b.locusOrder)
    pegsMap.value = { ...pegsMap.value, [palaceId]: items }
    persistPegs(palaceId)
  }

  /** 桩位上下移动 */
  function moveLocus(palaceId: string, order: number, dir: -1 | 1) {
    load()
    const palace = getPalace(palaceId)
    if (!palace) return
    const idx = palace.loci.findIndex(l => l.order === order)
    const target = idx + dir
    if (idx < 0 || target < 0 || target >= palace.loci.length) return
    const nextLoci = [...palace.loci]
    ;[nextLoci[idx], nextLoci[target]] = [nextLoci[target], nextLoci[idx]]
    // 重排 order 保持连续
    nextLoci.forEach((l, i) => { l.order = i + 1 })
    palaces.value = palaces.value.map(p =>
      p._id === palaceId ? { ...p, loci: nextLoci, utime: Date.now() } : p
    )
    persistPalaces()
    // 同步交换两个桩位上挂载的 locusOrder，保证内容跟随桩位
    const fromOrder = idx + 1
    const toOrder = target + 1
    const items = (pegsMap.value[palaceId] || []).map(p => {
      if (p.locusOrder === fromOrder) return { ...p, locusOrder: toOrder }
      if (p.locusOrder === toOrder) return { ...p, locusOrder: fromOrder }
      return p
    }).sort((a, b) => a.locusOrder - b.locusOrder)
    pegsMap.value = { ...pegsMap.value, [palaceId]: items }
    persistPegs(palaceId)
  }

  /** 给桩挂内容（纯文字 + 助记） */
  function setPegContent(palaceId: string, locusOrder: number, freeText: string, mnemonic?: string) {
    load()
    const items = pegsMap.value[palaceId] || []
    const idx = items.findIndex(p => p.locusOrder === locusOrder)
    if (idx >= 0) {
      const next = [...items]
      next[idx] = { ...next[idx], freeText, mnemonic }
      pegsMap.value = { ...pegsMap.value, [palaceId]: next }
    } else {
      const peg: MobilePegItem = {
        _id: 'peg-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6),
        palaceId,
        locusOrder,
        freeText,
        mnemonic,
      }
      pegsMap.value = { ...pegsMap.value, [palaceId]: [...items, peg].sort((a, b) => a.locusOrder - b.locusOrder) }
    }
    persistPegs(palaceId)
  }

  /** 移除桩上挂载内容 */
  function removePegContent(palaceId: string, locusOrder: number) {
    load()
    const items = (pegsMap.value[palaceId] || []).filter(p => p.locusOrder !== locusOrder)
    pegsMap.value = { ...pegsMap.value, [palaceId]: items }
    persistPegs(palaceId)
  }

  /**
   * 同步时剔除超大图片（dataURL 超过 32KB 的桩图与总图）
   * 与桌面端 stripOversizedImages 保持一致，避免 payload 膨胀
   */
  const MAX_SYNC_IMAGE_CHARS = 32 * 1024

  function stripOversizedImages(palace: MobilePalace): MobilePalace {
    const cleaned: MobilePalace = { ...palace, loci: palace.loci.map(l => ({ ...l })) }
    for (const locus of cleaned.loci) {
      if (locus.imageUrl && locus.imageUrl.length > MAX_SYNC_IMAGE_CHARS) {
        delete locus.imageUrl
      }
    }
    if (cleaned.overviewImage && cleaned.overviewImage.length > MAX_SYNC_IMAGE_CHARS) {
      delete cleaned.overviewImage
    }
    return cleaned
  }

  /** 收集记忆宫殿用于同步（无宫殿返回 null，避免无意义负载） */
  function collectSync(): MobileMemoryPalace | null {
    load()
    if (palaces.value.length === 0) return null
    const pegs: Record<string, MobilePegItem[]> = {}
    for (const [palaceId, items] of Object.entries(pegsMap.value)) {
      if (items.length > 0) pegs[palaceId] = items
    }
    return {
      palaces: palaces.value.map(stripOversizedImages),
      pegs,
    }
  }

  /**
   * 还原记忆宫殿同步数据：宫殿按 utime 合并、桩挂载按 learnDate 合并后写回
   * @returns 合并后的宫殿数量
   */
  function restoreSync(data: MobileMemoryPalace): number {
    load()
    const mergedPalaces = mergePalaceList(palaces.value, data.palaces || [])
    const mergedPegs: Record<string, MobilePegItem[]> = {}
    const palaceIds = new Set<string>([
      ...Object.keys(pegsMap.value),
      ...Object.keys(data.pegs || {}),
    ])
    for (const palaceId of palaceIds) {
      const merged = mergePegItemList(pegsMap.value[palaceId] || [], data.pegs?.[palaceId] || [])
      if (merged.length > 0) mergedPegs[palaceId] = merged
    }
    palaces.value = mergedPalaces
    pegsMap.value = mergedPegs
    persistPalaces()
    for (const palaceId of Object.keys(mergedPegs)) {
      persistPegs(palaceId)
    }
    return mergedPalaces.length
  }

  return {
    palaces,
    pegsMap,
    loaded,
    load,
    getPalace,
    pegsOf,
    dueCount,
    assess,
    collectSync,
    restoreSync,
    createPalace,
    updatePalace,
    deletePalace,
    addLocus,
    updateLocus,
    removeLocus,
    moveLocus,
    replaceLoci,
    setPegContent,
    removePegContent,
  }
})
