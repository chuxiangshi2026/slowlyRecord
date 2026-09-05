/**
 * 通用知识包 SRS（间隔重复）工具（移动端）
 *
 * 移植自桌面端 src/utils/knowledge-memory-srs.ts + src/utils/srs.ts：
 * 复用共享 DEFAULT_INTERVALS（分钟单位），level 0-12，
 * 答对且过复习间隔才升级，答错降级；12 级答错直接重置回 1。
 */
import { DEFAULT_INTERVALS } from '@/stores/useUtils/constants'
import type { KnowledgeItemProgress } from '@/stores/useUtils/types'

/** level 上限 */
export const MAX_LEVEL = 12

/** 掌握阈值 */
export const MASTERED_LEVEL = 12

/** 新条目默认等级（旧数据无 level 时按 0 处理） */
export const DEFAULT_LEVEL = 0

/**
 * 将等级限制在 [0, MAX_LEVEL]
 */
export function clampLevel(level: number): number {
  if (level < 0) return 0
  if (level > MAX_LEVEL) return MAX_LEVEL
  return level
}

/**
 * 创建默认进度
 */
export function createDefaultProgress(itemId: string): KnowledgeItemProgress {
  return {
    itemId,
    level: DEFAULT_LEVEL,
    learnDate: 0,
    correct: 0,
    wrong: 0,
  }
}

/**
 * 获取条目的有效等级
 */
export function getItemLevel(progress?: KnowledgeItemProgress): number {
  if (!progress || typeof progress.level !== 'number') return DEFAULT_LEVEL
  return clampLevel(progress.level)
}

/**
 * 判断条目是否已记住
 */
export function isRemembered(progress?: KnowledgeItemProgress): boolean {
  return getItemLevel(progress) >= MASTERED_LEVEL
}

/**
 * 判断条目是否到期需要复习
 */
export function isDue(progress: KnowledgeItemProgress | undefined, now: number): boolean {
  const level = getItemLevel(progress)
  if (!progress) return true
  if (!progress.learnDate) return true
  const clampedLevel = clampLevel(level)
  const intervalMinutes = DEFAULT_INTERVALS[clampedLevel] ?? DEFAULT_INTERVALS[0]
  return now - progress.learnDate >= intervalMinutes * 60 * 1000
}

/**
 * 判断当前是否在可升级时间窗口内
 * 开始 = learnDate + intervals[level]，结束 = learnDate + intervals[min(level+3, len-1)]
 * 未学过（learnDate 为假值）时允许升级
 */
function canLevelUp(learnDate: number, level: number, now: number): boolean {
  if (!learnDate) return true
  const clampedLevel = clampLevel(level)
  const start = learnDate + (DEFAULT_INTERVALS[clampedLevel] ?? DEFAULT_INTERVALS[0]) * 60 * 1000
  const end = learnDate + DEFAULT_INTERVALS[Math.min(clampedLevel + 3, DEFAULT_INTERVALS.length - 1)] * 60 * 1000
  return now > start && now < end
}

/**
 * 根据记忆牢固度计算升级后的等级（'较强' +2，'极强' +3，其余 +1）
 */
function computeLevelUp(level: number, firmness?: string): number {
  let increment = 1
  if (firmness === '较强') increment = 2
  else if (firmness === '极强') increment = 3
  return Math.min(level + increment, MAX_LEVEL)
}

/**
 * 计算降级后的等级（≥12 重置为 1，否则 -1，下限 1）
 */
function computeLevelDown(level: number): number {
  if (level >= MASTERED_LEVEL) return 1
  return Math.max(level - 1, 1)
}

/**
 * 答对后更新进度
 * - 在升级窗口内：按记忆牢固度升 1~3 级，封顶 12
 * - 未到期或到期但超窗：刷新 learnDate，不升级
 */
export function markCorrect(
  progress: KnowledgeItemProgress,
  now: number = Date.now(),
  firmness?: string,
): KnowledgeItemProgress {
  const level = getItemLevel(progress)
  if (canLevelUp(progress.learnDate, level, now)) {
    return {
      ...progress,
      level: computeLevelUp(level, firmness),
      learnDate: now,
      correct: progress.correct + 1,
    }
  }
  // 未到期或太晚：刷新 learnDate，保持等级
  return {
    ...progress,
    learnDate: now,
    correct: progress.correct + 1,
  }
}

/**
 * 答错后更新进度
 * 12 级答错直接重置为 1 级，否则降级
 */
export function markWrong(
  progress: KnowledgeItemProgress,
  now: number = Date.now(),
): KnowledgeItemProgress {
  const level = getItemLevel(progress)
  return {
    ...progress,
    level: computeLevelDown(level),
    learnDate: now,
    wrong: progress.wrong + 1,
  }
}
