/**
 * 每日目标（首页进度环）相关纯函数
 *
 * 口径：今日已复习数 = 全部单词中 lastReviewTime >= 今天 0 点的数量。
 * 「忘记」判定不更新 lastReviewTime（store 的 markAsForgotten 只改 nextReviewTime），
 * 因此自然不计入今日复习数，与这里的统计口径一致。
 */

export const DAILY_GOAL_STORAGE_KEY = 'slowlyrecord-daily-goal'
export const DEFAULT_DAILY_GOAL = 20
/** 「我的」页可选目标档位 */
export const DAILY_GOAL_OPTIONS = [10, 20, 30, 50] as const

/** 解析存储里的目标值：缺失 / 非法 / 非正数一律回退默认 20 */
export function resolveDailyGoal(raw: unknown): number {
  const n = typeof raw === 'number' ? raw : parseInt(String(raw), 10)
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_DAILY_GOAL
  return Math.floor(n)
}

/** 从 storage 读取每日目标（读失败回退默认值） */
export function loadDailyGoal(): number {
  try {
    return resolveDailyGoal(uni.getStorageSync(DAILY_GOAL_STORAGE_KEY))
  } catch {
    return DEFAULT_DAILY_GOAL
  }
}

/** 目标值写入 storage（写失败静默，不影响本次使用） */
export function saveDailyGoal(goal: number) {
  try {
    uni.setStorageSync(DAILY_GOAL_STORAGE_KEY, goal)
  } catch {
    // ignore
  }
}

export interface DailyGoalProgress {
  /** 今日已复习数 */
  reviewed: number
  /** 目标值 */
  goal: number
  /** 进度百分比 0-100，封顶 100 */
  percent: number
  /** 是否已达成目标 */
  achieved: boolean
}

/** 统计今日已复习单词数（now 可注入，便于测试） */
export function countReviewedToday(words: { lastReviewTime?: number }[], now: number = Date.now()): number {
  const d = new Date(now)
  d.setHours(0, 0, 0, 0)
  const start = d.getTime()
  return words.filter(w => (w.lastReviewTime || 0) >= start).length
}

/** 由已复习数与目标值计算进度环状态 */
export function getGoalProgress(reviewed: number, goal: number): DailyGoalProgress {
  const g = resolveDailyGoal(goal)
  const r = Math.max(0, Math.floor(reviewed))
  return {
    reviewed: r,
    goal: g,
    percent: Math.min(100, Math.round((r / g) * 100)),
    achieved: r >= g
  }
}

/**
 * 一次判定后是否「恰好」达成目标（此前未达成、此次达成）。
 * 同一词撤销后重复判定不会重复触发（before 已含该词）。
 */
export function checkGoalJustAchieved(before: number, after: number, goal: number): boolean {
  const g = resolveDailyGoal(goal)
  return before < g && after >= g
}
