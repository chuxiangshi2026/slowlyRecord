/**
 * 字母映射练习出题纯逻辑
 *
 * 一轮 10 题：到期字母优先，其余按等级从低到高补足（新字母 level 0 自然靠前）。
 * 认映射的干扰项从其余字母的展示映射里随机取 3 个。
 */
import { LETTER_LIST } from '@/utils/letter-preset'
import { isPracticeDue, getPracticeLevel } from '@/utils/practice-srs'
import type { LetterSuggestion } from '@/utils/letter-preset'

export const ROUND_SIZE = 10

export interface LetterProgressLike {
  level?: number
  nextReview?: number
}

/** 选一轮要练的字母：到期优先，同级内随机，不足 10 个用未到期字母补足 */
export function pickRoundLetters(
  getProgress: (letter: string) => LetterProgressLike | undefined,
  size: number = ROUND_SIZE,
  now: number = Date.now(),
  random: () => number = Math.random,
): string[] {
  const sorted = [...LETTER_LIST].sort((a, b) => {
    const pa = getProgress(a)
    const pb = getProgress(b)
    const dueA = isPracticeDue(pa?.nextReview, now) ? 0 : 1
    const dueB = isPracticeDue(pb?.nextReview, now) ? 0 : 1
    if (dueA !== dueB) return dueA - dueB
    const diff = getPracticeLevel(pa?.level) - getPracticeLevel(pb?.level)
    return diff !== 0 ? diff : random() - 0.5
  })
  return sorted.slice(0, size)
}

/** 认映射选项：正确映射 + 3 个干扰项，打乱顺序 */
export function buildRecognizeOptions(
  correct: LetterSuggestion,
  pool: LetterSuggestion[],
  random: () => number = Math.random,
): LetterSuggestion[] {
  const distractors = pool
    .filter((s) => s.name !== correct.name)
    .sort(() => random() - 0.5)
    .slice(0, 3)
  return [...distractors, correct].sort(() => random() - 0.5)
}
