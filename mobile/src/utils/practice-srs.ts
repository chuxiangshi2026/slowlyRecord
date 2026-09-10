/**
 * 轻量复习调度（间隔重复）纯函数 —— 供文本记忆「遮挡回忆」与数字记忆「自测练习」共用
 *
 * 设计说明：
 * - 复用共享 DEFAULT_INTERVALS（分钟单位，下标即等级），等级体系简化自单词的 12 级标准
 * - level 0-12，nextReview 为到期时间戳（ms）
 * - 「记住了」升 1 级（封顶 12），按新等级间隔排下次复习
 * - 「还没记住」降 1 级（12 级答错重置回 1 级，与知识包 SRS 口径一致），重新排期
 * - 从未复习过（nextReview 为空）视为已到期，方便新数据立即进入练习
 */
import { DEFAULT_INTERVALS } from '@/stores/useUtils/constants'

/** 等级上限 */
export const PRACTICE_MAX_LEVEL = 12

/** 掌握阈值：达到 12 级视为已记住（与主复习体系一致） */
export const PRACTICE_MASTERED_LEVEL = 12

/** 有效等级：缺省按 0 处理，钳制在 [0, MAX] */
export function getPracticeLevel(level?: number): number {
  if (typeof level !== 'number' || Number.isNaN(level)) return 0
  if (level < 0) return 0
  if (level > PRACTICE_MAX_LEVEL) return PRACTICE_MAX_LEVEL
  return Math.floor(level)
}

/** 某等级对应的复习间隔（分钟），缺省/越界按 0 级处理 */
export function intervalMinutesOf(level?: number): number {
  return DEFAULT_INTERVALS[getPracticeLevel(level)] ?? DEFAULT_INTERVALS[0]
}

/** 是否到期需要复习：从未排期（undefined / 0）视为到期 */
export function isPracticeDue(nextReview: number | undefined, now: number = Date.now()): boolean {
  if (!nextReview) return true
  return nextReview <= now
}

export interface PracticeSchedulePatch {
  level: number
  nextReview: number
}

/** 「记住了」：升 1 级（封顶 12），按新等级间隔排下次复习 */
export function scheduleOnRemembered(
  level: number | undefined,
  now: number = Date.now(),
): PracticeSchedulePatch {
  const next = Math.min(getPracticeLevel(level) + 1, PRACTICE_MAX_LEVEL)
  return { level: next, nextReview: now + intervalMinutesOf(next) * 60 * 1000 }
}

/** 「还没记住」：降 1 级（下限 0）；12 级答错重置回 1 级 */
export function scheduleOnForgotten(
  level: number | undefined,
  now: number = Date.now(),
): PracticeSchedulePatch {
  const current = getPracticeLevel(level)
  const next = current >= PRACTICE_MASTERED_LEVEL ? 1 : Math.max(current - 1, 0)
  return { level: next, nextReview: now + intervalMinutesOf(next) * 60 * 1000 }
}

/** 是否已掌握（达到 12 级） */
export function isPracticeMastered(level?: number): boolean {
  return getPracticeLevel(level) >= PRACTICE_MASTERED_LEVEL
}
