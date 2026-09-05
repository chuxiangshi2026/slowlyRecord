/**
 * 音标学习 store（移动端）
 *
 * 移植自桌面端 src/stores/phoneticMemory.ts：
 * 复用共享 DEFAULT_INTERVALS（分钟单位）做艾宾浩斯间隔，
 * 每个音素 / 对子独立跟踪 level + learnDate，
 * 答对升级、答错降级，到期可复习。
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { DEFAULT_INTERVALS } from './useUtils/constants'
import { ALL_PHONEMES } from '@/utils/phoneme-data'
import { getDbAdapter } from '@/adapters/index'
import type { Phoneme, PhonemeProgress, MinimalPairProgress, PhoneticProgressDoc, MobilePhoneticMemory } from './useUtils/types'

// doc id 与桌面端 phonetic-memory-db.ts 保持一致（同步互通的前提）
const PROGRESS_DOC_ID = 'phonetic_memory_progress'

/** level >= 7 视为已掌握（音标模块自己的阈值，与单词的 12 级 remember 标准无关） */
const MASTERED_LEVEL = 7
/** level 0-12，对应 DEFAULT_INTERVALS 的下标 */
const MAX_LEVEL = Math.min(12, DEFAULT_INTERVALS.length - 1)

function clampLevel(level: number): number {
  if (level < 0) return 0
  if (level > MAX_LEVEL) return MAX_LEVEL
  return level
}

function isDue(item: { level: number; learnDate: number }, now: number): boolean {
  if (!item.learnDate) return true
  const intervalMs = (DEFAULT_INTERVALS[item.level] ?? DEFAULT_INTERVALS[0]) * 60 * 1000
  return now - item.learnDate >= intervalMs
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function emptyDoc(): PhoneticProgressDoc {
  return { _id: PROGRESS_DOC_ID, phonemes: {}, pairs: {} }
}

export const usePhoneticMemory = defineStore('phoneticMemory', () => {
  const doc = ref<PhoneticProgressDoc>(emptyDoc())
  const loaded = ref(false)

  /** 从 DB 适配器读取进度（小数据单 doc），幂等 */
  async function ensureLoaded(): Promise<void> {
    if (loaded.value) return
    try {
      const raw = getDbAdapter().get<PhoneticProgressDoc>(PROGRESS_DOC_ID)
      if (raw && typeof raw === 'object' && raw.phonemes) {
        doc.value = {
          _id: raw._id || PROGRESS_DOC_ID,
          _rev: raw._rev,
          phonemes: raw.phonemes || {},
          pairs: raw.pairs || {},
        }
      }
    } catch {
      doc.value = emptyDoc()
    }
    loaded.value = true
  }

  function persist() {
    try {
      const result = getDbAdapter().put({ ...doc.value, _id: PROGRESS_DOC_ID })
      if (result.ok && result.rev) {
        doc.value._rev = result.rev
      }
    } catch (e) {
      console.error('音标进度持久化失败:', e)
    }
  }

  // ===== 统计 =====
  const masteredCount = computed(() =>
    Object.values(doc.value.phonemes).filter(p => p.level >= MASTERED_LEVEL).length,
  )

  const dueCount = computed(() => {
    const now = Date.now()
    let count = 0
    for (const ph of ALL_PHONEMES) {
      const prog = doc.value.phonemes[ph.ipa]
      // 没学过 或 到期 都算待练习
      if (!prog || isDue(prog, now)) count++
    }
    return count
  })

  // ===== 音素进度 =====
  function getPhonemeProgress(ipa: string): PhonemeProgress | undefined {
    return doc.value.phonemes[ipa]
  }

  /**
   * 按优先级抽 N 个音素出题：
   * 1) 已练过且到期
   * 2) 没练过（level=0 且无 learnDate）
   * 3) 都不够再从全部里随机补
   */
  function pickPhonemesForSession(count: number): Phoneme[] {
    const now = Date.now()
    const due: Phoneme[] = []
    const fresh: Phoneme[] = []
    const others: Phoneme[] = []
    for (const ph of ALL_PHONEMES) {
      const prog = doc.value.phonemes[ph.ipa]
      if (!prog) {
        fresh.push(ph)
      } else if (isDue(prog, now)) {
        due.push(ph)
      } else {
        others.push(ph)
      }
    }
    // 在各组内打散，避免同分组扎堆
    shuffle(due)
    shuffle(fresh)
    shuffle(others)
    return [...due, ...fresh, ...others].slice(0, count)
  }

  function markPhoneme(ipa: string, isCorrect: boolean): void {
    const prev = doc.value.phonemes[ipa] || {
      ipa,
      level: 0,
      learnDate: 0,
      correct: 0,
      wrong: 0,
    }
    doc.value.phonemes[ipa] = {
      ipa,
      level: clampLevel(prev.level + (isCorrect ? 1 : -1)),
      learnDate: Date.now(),
      correct: prev.correct + (isCorrect ? 1 : 0),
      wrong: prev.wrong + (isCorrect ? 0 : 1),
    }
    persist()
  }

  // ===== 对子进度 =====
  function pairKeyOf(a: string, b: string): string {
    return a < b ? `${a}|${b}` : `${b}|${a}`
  }

  function getPairProgress(a: string, b: string): MinimalPairProgress | undefined {
    return doc.value.pairs[pairKeyOf(a, b)]
  }

  function markPair(a: string, b: string, isCorrect: boolean): void {
    const key = pairKeyOf(a, b)
    const prev = doc.value.pairs[key] || {
      pairKey: key,
      level: 0,
      learnDate: 0,
      correct: 0,
      wrong: 0,
    }
    doc.value.pairs[key] = {
      pairKey: key,
      level: clampLevel(prev.level + (isCorrect ? 1 : -1)),
      learnDate: Date.now(),
      correct: prev.correct + (isCorrect ? 1 : 0),
      wrong: prev.wrong + (isCorrect ? 0 : 1),
    }
    persist()
  }

  /** 从对子列表里按优先级抽 count 个出题 */
  function pickPairsForSession<T extends { a: string; b: string }>(pool: T[], count: number): T[] {
    const now = Date.now()
    const due: T[] = []
    const fresh: T[] = []
    const others: T[] = []
    for (const p of pool) {
      const prog = doc.value.pairs[pairKeyOf(p.a, p.b)]
      if (!prog) fresh.push(p)
      else if (isDue(prog, now)) due.push(p)
      else others.push(p)
    }
    shuffle(due)
    shuffle(fresh)
    shuffle(others)
    return [...due, ...fresh, ...others].slice(0, count)
  }

  // ===== 同步 collect / restore =====

  /** 收集音标进度（无数据返回 null） */
  function collectSync(): MobilePhoneticMemory | null {
    const phonemes = doc.value.phonemes
    const pairs = doc.value.pairs
    if (Object.keys(phonemes).length === 0 && Object.keys(pairs).length === 0) return null
    return { phonemes, pairs }
  }

  /**
   * 还原音标进度：逐项按 learnDate 较新者保留
   * @returns 还原的条目数
   */
  function restoreSync(data: MobilePhoneticMemory): number {
    let merged = 0
    for (const [ipa, progress] of Object.entries(data.phonemes || {})) {
      const local = doc.value.phonemes[ipa]
      if (!local || (progress?.learnDate || 0) > (local.learnDate || 0)) {
        doc.value.phonemes[ipa] = progress
        merged++
      }
    }
    for (const [key, progress] of Object.entries(data.pairs || {})) {
      const local = doc.value.pairs[key]
      if (!local || (progress?.learnDate || 0) > (local.learnDate || 0)) {
        doc.value.pairs[key] = progress
        merged++
      }
    }
    if (merged > 0) persist()
    return merged
  }

  return {
    // state（只读暴露）
    doc,
    loaded,
    // 统计
    masteredCount,
    dueCount,
    MASTERED_LEVEL,
    MAX_LEVEL,
    // actions
    ensureLoaded,
    getPhonemeProgress,
    pickPhonemesForSession,
    markPhoneme,
    getPairProgress,
    pickPairsForSession,
    markPair,
    // sync
    collectSync,
    restoreSync,
  }
})
