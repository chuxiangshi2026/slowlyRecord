import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { getDbAdapter } from '@/adapters/index'
import {
  isPracticeDue,
  scheduleOnRemembered,
  scheduleOnForgotten,
  PRACTICE_MASTERED_LEVEL,
} from '../utils/practice-srs'
import {
  LETTER_LIST,
  getDefaultSuggestion,
  type LetterSuggestion,
} from '../utils/letter-preset'

/**
 * 字母映射 store（移动端）
 *
 * 每个字母/组合一条记录：自定义映射（可选）+ 掌握度（level 0-12 + nextReview）。
 * 未自定义时展示预设默认映射（各字母第一个候选）。
 * 持久化：DB 适配器单 doc「letter-memory-data」。
 */

const DOC_ID = 'letter-memory-data'

export interface LetterMemoryEntry {
  /** 自定义映射（缺省时用预设默认） */
  name?: string
  emoji?: string
  description?: string
  source?: 'preset' | 'custom'
  level: number
  nextReview?: number
  learnDate: number
}

interface LetterMemoryDoc {
  letters: Record<string, LetterMemoryEntry>
  updatedAt: number
}

function readDoc(): LetterMemoryDoc {
  try {
    const doc = getDbAdapter().get<{ data: LetterMemoryDoc }>(DOC_ID)
    if (doc?.data && typeof doc.data === 'object') {
      return { letters: doc.data.letters ?? {}, updatedAt: doc.data.updatedAt || 0 }
    }
  } catch {
    /* 首次使用无数据 */
  }
  return { letters: {}, updatedAt: 0 }
}

function writeDoc(doc: LetterMemoryDoc) {
  doc.updatedAt = Date.now()
  try {
    const result = getDbAdapter().put({ _id: DOC_ID, data: doc })
    if (result.error) console.error('持久化字母映射失败:', result.message)
  } catch (e) {
    console.error('持久化字母映射失败:', e)
  }
}

export const useLetterMemory = defineStore('letterMemory', () => {
  const doc = ref<LetterMemoryDoc>({ letters: {}, updatedAt: 0 })
  const loaded = ref(false)

  async function ensureLoaded(): Promise<void> {
    if (loaded.value) return
    doc.value = readDoc()
    loaded.value = true
  }

  function getEntry(letter: string): LetterMemoryEntry | undefined {
    return doc.value.letters[letter]
  }

  /** 展示用映射：自定义优先，否则预设默认 */
  function getDisplay(letter: string): LetterSuggestion | undefined {
    const entry = doc.value.letters[letter]
    if (entry?.name) {
      return { name: entry.name, emoji: entry.emoji ?? '', description: entry.description ?? '' }
    }
    return getDefaultSuggestion(letter)
  }

  /** 设置映射（选预设候选或自定义），保留原有掌握度 */
  function setMapping(letter: string, suggestion: LetterSuggestion, source: 'preset' | 'custom'): void {
    const prev = doc.value.letters[letter]
    doc.value.letters[letter] = {
      name: suggestion.name,
      emoji: suggestion.emoji,
      description: suggestion.description,
      source,
      level: prev?.level ?? 0,
      nextReview: prev?.nextReview,
      learnDate: prev?.learnDate ?? Date.now(),
    }
    writeDoc(doc.value)
  }

  /** 答对升 1 级，答错降 4 级（与 practice-srs 口径一致） */
  function markLetter(letter: string, isCorrect: boolean): void {
    const prev = doc.value.letters[letter]
    const patch = isCorrect
      ? scheduleOnRemembered(prev?.level)
      : scheduleOnForgotten(prev?.level)
    doc.value.letters[letter] = {
      ...prev,
      level: patch.level,
      nextReview: patch.nextReview,
      learnDate: prev?.learnDate ?? Date.now(),
    }
    writeDoc(doc.value)
  }

  const masteredCount = computed(
    () =>
      LETTER_LIST.filter(
        (l) => (doc.value.letters[l]?.level ?? 0) >= PRACTICE_MASTERED_LEVEL,
      ).length,
  )

  const dueCount = computed(
    () => LETTER_LIST.filter((l) => isPracticeDue(doc.value.letters[l]?.nextReview)).length,
  )

  /** 是否已有任意练习/自定义记录（首次引导用） */
  const hasAnyProgress = computed(() => Object.keys(doc.value.letters).length > 0)

  return {
    ensureLoaded,
    getEntry,
    getDisplay,
    setMapping,
    markLetter,
    masteredCount,
    dueCount,
    hasAnyProgress,
    totalLetters: LETTER_LIST.length,
    MASTERED_LEVEL: PRACTICE_MASTERED_LEVEL,
  }
})
