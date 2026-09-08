/**
 * 通用知识包 Pinia store（移动端精简版）
 *
 * 移植自桌面端 src/stores/knowledgeMemory.ts：
 * - 只保留翻卡（q2a）与四选一（choice）两种练习模式
 * - 不含自建知识条目（custom items）能力
 * - 内置包加载走分包 knowledge-pack-loader（小程序无 fetch）
 *
 * 注意：本文件位于 pages-knowledge 分包内——小程序主包不能引用分包代码，
 * 而 loader 依赖分包内的知识包数据模块。
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type {
  KnowledgePack,
  KnowledgeItem,
  KnowledgePackProgressDoc,
  KnowledgeItemProgress,
} from '@/stores/useUtils/types'
import {
  fetchKnowledgePack,
  listKnowledgePacks,
} from './utils/knowledge-pack-loader'
import type { KnowledgePackInfo } from '@/stores/useUtils/types'
import {
  getProgressDoc,
  saveProgressDoc,
  getImportedIds,
  addImportedId,
  removeImportedId,
  hasProgressDoc,
  clearProgressDoc,
} from '@/utils/knowledge-memory-db'
import {
  createDefaultProgress,
  isDue,
  isRemembered,
  markCorrect,
  markWrong,
} from '@/utils/knowledge-memory-srs'

function normalizeAnswer(value: string): string {
  return value
    .toLowerCase()
    .split('')
    .map(c => {
      const code = c.charCodeAt(0)
      // 全角数字/字母统一转半角
      if (code >= 0xFF10 && code <= 0xFF19) return String.fromCharCode(code - 0xFEE0)
      if (code >= 0xFF21 && code <= 0xFF3A) return String.fromCharCode(code - 0xFEE0)
      if (code >= 0xFF41 && code <= 0xFF5A) return String.fromCharCode(code - 0xFEE0)
      return c
    })
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
}

function shuffleArray<T>(arr: T[]): T[] {
  const result = [...arr]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

/** Levenshtein 编辑距离（干扰项候选均为短字符串，直接 O(nm) 计算即可） */
function levenshtein(a: string, b: string): number {
  const m = a.length
  const n = b.length
  if (m === 0) return n
  if (n === 0) return m
  let prev = Array.from({ length: n + 1 }, (_, j) => j)
  for (let i = 1; i <= m; i++) {
    const cur: number[] = [i]
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      )
    }
    prev = cur
  }
  return prev[n]
}

/** 取条目 extras 中的「序数」（元素包），缺失或无法解析时返回 NaN */
function getOrdinal(item: KnowledgeItem): number {
  const raw = item.extras?.['序数']
  if (!raw) return NaN
  const n = parseInt(raw, 10)
  return Number.isFinite(n) ? n : NaN
}

/**
 * 干扰项相似度打分（越小越优先）：
 * a) 条目带「序数」（元素包）时按序数距离排序，相邻序数（同周期/同族）优先；
 * b) 否则按答案编辑距离排序，距离相同再按长度差排序，保证干扰项"长得像"。
 */
function scoreDistractor(
  correctItem: KnowledgeItem,
  correctText: string,
  candidateItem: KnowledgeItem,
  candidateText: string,
): number {
  const correctOrdinal = getOrdinal(correctItem)
  const candidateOrdinal = getOrdinal(candidateItem)
  if (!Number.isNaN(correctOrdinal) && !Number.isNaN(candidateOrdinal)) {
    return Math.abs(candidateOrdinal - correctOrdinal) * 10000
  }
  const dist = levenshtein(normalizeAnswer(correctText), normalizeAnswer(candidateText))
  return dist * 1000 + Math.abs(candidateText.length - correctText.length)
}

export const useKnowledgeMemory = defineStore('knowledgeMemory', () => {
  // ===== State =====
  const packs = ref<Record<string, KnowledgePack>>({})
  const progress = ref<Record<string, KnowledgePackProgressDoc>>({})
  const loading = ref(false)
  const loadedSet = ref<Set<string>>(new Set())
  /** 已导入的知识包 id 列表（知识库默认空，仅展示已导入的包） */
  const importedIds = ref<string[]>([])
  /** 已导入清单是否已从 DB 加载 */
  const importedLoaded = ref(false)

  // ===== Getters =====
  const packList = computed<KnowledgePackInfo[]>(() => listKnowledgePacks())

  function getPack(packId: string): KnowledgePack | undefined {
    return packs.value[packId]
  }

  function getProgress(packId: string): KnowledgePackProgressDoc {
    return (
      progress.value[packId] || {
        _id: '',
        type: 'knowledge_pack_progress',
        packId,
        items: {},
      }
    )
  }

  function getItemProgress(packId: string, itemId: string): KnowledgeItemProgress {
    const doc = getProgress(packId)
    return doc.items[itemId] || createDefaultProgress(itemId)
  }

  function isPackLoaded(packId: string): boolean {
    return loadedSet.value.has(packId)
  }

  function getTotalCount(packId: string): number {
    return getPack(packId)?.items.length ?? 0
  }

  function getMasteredCount(packId: string): number {
    const pack = getPack(packId)
    if (!pack) return 0
    const doc = getProgress(packId)
    return pack.items.filter(item => isRemembered(doc.items[item.id])).length
  }

  function getDueCount(packId: string): number {
    const pack = getPack(packId)
    if (!pack) return 0
    const doc = getProgress(packId)
    const now = Date.now()
    return pack.items.filter(item => isDue(doc.items[item.id], now)).length
  }

  // ===== Actions =====

  /**
   * 加载知识包内容 + 进度文档
   */
  async function loadPack(packId: string): Promise<void> {
    loading.value = true
    try {
      const [pack, doc] = await Promise.all([
        fetchKnowledgePack(packId),
        Promise.resolve(getProgressDoc(packId)),
      ])
      packs.value[packId] = pack
      progress.value[packId] = doc
      loadedSet.value.add(packId)
    } finally {
      loading.value = false
    }
  }

  /**
   * 加载已导入知识包清单
   * 兼容老用户：某包已存在进度文档但不在清单中时，自动并入清单
   */
  function loadImportedIds(): void {
    const merged = new Set(getImportedIds())
    for (const info of listKnowledgePacks()) {
      if (!merged.has(info.id) && hasProgressDoc(info.id)) {
        merged.add(info.id)
        addImportedId(info.id)
      }
    }
    importedIds.value = Array.from(merged)
    importedLoaded.value = true
  }

  function isPackImported(packId: string): boolean {
    return importedIds.value.includes(packId)
  }

  /**
   * 导入知识包：加入清单并加载包内容
   */
  async function importPack(packId: string): Promise<void> {
    if (importedIds.value.includes(packId)) return
    addImportedId(packId)
    importedIds.value = [...importedIds.value, packId]
    if (!isPackLoaded(packId)) {
      try {
        await loadPack(packId)
      } catch (e) {
        console.warn('导入后加载知识包失败:', e)
      }
    }
  }

  /**
   * 从清单下架知识包（仅移除展示，不删进度文档，重新导入后进度恢复）
   */
  function removeImportedPack(packId: string): void {
    removeImportedId(packId)
    importedIds.value = importedIds.value.filter(id => id !== packId)
  }

  /**
   * 按优先级抽取本次练习的条目
   * 1) 已到期 2) 未练过 3) 其他，组内随机
   */
  function pickItemsForSession(packId: string, count: number = 10): KnowledgeItem[] {
    const pack = getPack(packId)
    if (!pack) return []

    const doc = getProgress(packId)
    const now = Date.now()
    const due: KnowledgeItem[] = []
    const fresh: KnowledgeItem[] = []
    const others: KnowledgeItem[] = []

    for (const item of pack.items) {
      const prog = doc.items[item.id]
      if (!prog || prog.learnDate === 0) {
        fresh.push(item)
      } else if (isDue(prog, now)) {
        due.push(item)
      } else {
        others.push(item)
      }
    }

    return [...shuffleArray(due), ...shuffleArray(fresh), ...shuffleArray(others)].slice(0, Math.max(1, count))
  }

  /**
   * 标记条目答对/答错并持久化 SRS 进度
   */
  function markItem(
    packId: string,
    itemId: string,
    isCorrect: boolean,
    now: number = Date.now(),
  ): KnowledgeItemProgress {
    const doc = getProgress(packId)
    const prev = doc.items[itemId] || createDefaultProgress(itemId)
    // 移动端暂无记忆牢固度设置，按「正常」(+1) 处理
    const next = isCorrect ? markCorrect(prev, now, '正常') : markWrong(prev, now)

    doc.items[itemId] = next
    progress.value[packId] = { ...doc }
    saveProgressDoc(doc)
    return next
  }

  /**
   * 生成四选一选项（正确答案 + 同包其他条目答案 3 个干扰项）
   *
   * 策略：候选池去重后按与正确答案的相似度排序（元素包按序数距离，
   * 其余按编辑距离），确定性地取最相似的前 N-1 个，只打乱选项位置。
   */
  function generateChoices(
    packId: string,
    correctItem: KnowledgeItem,
    optionCount: number = 4,
  ): string[] {
    const pack = getPack(packId)
    const correctRaw = correctItem.answer
    if (!pack) return [correctRaw]

    const correctNormalized = normalizeAnswer(correctRaw)

    // 候选池：本包其他条目的答案，按归一化文本去重，保留原始展示文本
    const seen = new Set<string>([correctNormalized])
    const candidates: { text: string; item: KnowledgeItem }[] = []
    for (const i of pack.items) {
      if (i.id === correctItem.id) continue
      const v = i.answer
      if (!v) continue
      const n = normalizeAnswer(v)
      if (seen.has(n)) continue
      seen.add(n)
      candidates.push({ text: v, item: i })
    }

    // 按相似度升序排序（下标作最终决胜，保证排序稳定可预期）
    const sorted = candidates
      .map((c, index) => ({ ...c, score: scoreDistractor(correctItem, correctRaw, c.item, c.text), index }))
      .sort((a, b) => a.score - b.score || a.index - b.index)

    // 确定性地取打分最低（最相似）的前 N-1 个，保证干扰项质量稳定
    const picked = sorted.slice(0, optionCount - 1)
    const options = [correctRaw, ...picked.map(p => p.text)]
    return shuffleArray(options)
  }

  /**
   * 清空某知识包进度（内存 + DB）
   */
  function resetPackProgress(packId: string): void {
    const doc: KnowledgePackProgressDoc = {
      _id: '',
      type: 'knowledge_pack_progress',
      packId,
      items: {},
    }
    progress.value[packId] = { ...doc }
    try {
      const existing = getProgressDoc(packId)
      if (existing._rev) {
        saveProgressDoc({ ...doc, _id: existing._id, _rev: existing._rev })
      }
    } catch (e) {
      console.warn('重置知识包进度失败:', e)
    }
  }

  return {
    // state
    packs,
    progress,
    loading,
    loadedSet,
    importedIds,
    importedLoaded,
    // getters
    packList,
    getPack,
    getProgress,
    getItemProgress,
    isPackLoaded,
    isPackImported,
    getTotalCount,
    getMasteredCount,
    getDueCount,
    // actions
    loadPack,
    loadImportedIds,
    importPack,
    removeImportedPack,
    pickItemsForSession,
    markItem,
    generateChoices,
    resetPackProgress,
  }
})
