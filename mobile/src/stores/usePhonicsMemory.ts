import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { getDbAdapter } from '@/adapters/index'
import {
  isPracticeDue,
  scheduleOnRemembered,
  scheduleOnForgotten,
  PRACTICE_MASTERED_LEVEL,
} from '../utils/practice-srs'
import { ALL_PHONICS_RULES } from '../utils/phonics-data'

/**
 * 自然拼读掌握度 store（移动端）
 *
 * 每条拼读规则（字母/组合）一个进度：level 0-12 + nextReview，复用共享轻量 SRS。
 * 持久化：DB 适配器单 doc「phonics-memory-data」。
 * 多端同步暂不接（同步链路需改 sync.ts 多处，后续与音标一起评估）。
 */

const DOC_ID = 'phonics-memory-data'

export interface PhonicsRuleProgress {
  level: number
  nextReview?: number
  learnDate: number
}

interface PhonicsDoc {
  rules: Record<string, PhonicsRuleProgress>
  updatedAt: number
}

function readDoc(): PhonicsDoc {
  try {
    const doc = getDbAdapter().get<{ data: PhonicsDoc }>(DOC_ID)
    if (doc?.data && typeof doc.data === 'object') {
      return { rules: doc.data.rules ?? {}, updatedAt: doc.data.updatedAt || 0 }
    }
  } catch {
    /* 首次使用无数据 */
  }
  return { rules: {}, updatedAt: 0 }
}

function writeDoc(doc: PhonicsDoc) {
  doc.updatedAt = Date.now()
  try {
    const result = getDbAdapter().put({ _id: DOC_ID, data: doc })
    if (result.error) console.error('持久化自然拼读进度失败:', result.message)
  } catch (e) {
    console.error('持久化自然拼读进度失败:', e)
  }
}

export const usePhonicsMemory = defineStore('phonicsMemory', () => {
  const doc = ref<PhonicsDoc>({ rules: {}, updatedAt: 0 })
  const loaded = ref(false)

  async function ensureLoaded(): Promise<void> {
    if (loaded.value) return
    doc.value = readDoc()
    loaded.value = true
  }

  function getRuleProgress(ruleId: string): PhonicsRuleProgress | undefined {
    return doc.value.rules[ruleId]
  }

  /** 答对升 1 级，答错降 4 级（与 practice-srs 口径一致） */
  function markRule(ruleId: string, isCorrect: boolean): void {
    const prev = doc.value.rules[ruleId]
    const patch = isCorrect
      ? scheduleOnRemembered(prev?.level)
      : scheduleOnForgotten(prev?.level)
    doc.value.rules[ruleId] = {
      level: patch.level,
      nextReview: patch.nextReview,
      learnDate: prev?.learnDate ?? Date.now(),
    }
    writeDoc(doc.value)
  }

  const masteredCount = computed(
    () =>
      Object.values(doc.value.rules).filter((p) => p.level >= PRACTICE_MASTERED_LEVEL).length,
  )

  const dueCount = computed(
    () =>
      ALL_PHONICS_RULES.filter((r) => isPracticeDue(doc.value.rules[r.id]?.nextReview)).length,
  )

  return {
    ensureLoaded,
    getRuleProgress,
    markRule,
    masteredCount,
    dueCount,
    totalRules: ALL_PHONICS_RULES.length,
    MASTERED_LEVEL: PRACTICE_MASTERED_LEVEL,
  }
})
