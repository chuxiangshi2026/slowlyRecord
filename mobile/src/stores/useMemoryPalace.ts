import { ref } from 'vue'
import { defineStore } from 'pinia'
import type { MobileMemoryPalace, MobilePalace, MobilePegItem } from './useUtils/types'
import { getDbAdapter } from '@/adapters/index'
import {
  isPegDue,
  markPegForgotten,
  markPegRemembered,
  mergePalaceList,
  mergePegItemList,
} from '../utils/memory-palace'

/**
 * 记忆宫殿 store（移动端查看版）
 *
 * 只做查看 + 巡视自评，不做编辑。存储 doc id 与桌面端一致：
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

  // ===== 同步 collect / restore =====

  /** 收集记忆宫殿用于同步（无宫殿返回 null，避免无意义负载） */
  function collectSync(): MobileMemoryPalace | null {
    load()
    if (palaces.value.length === 0) return null
    const pegs: Record<string, MobilePegItem[]> = {}
    for (const [palaceId, items] of Object.entries(pegsMap.value)) {
      if (items.length > 0) pegs[palaceId] = items
    }
    return { palaces: palaces.value, pegs }
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
  }
})
