/**
 * 记忆测评历史最好成绩持久化（移动端）
 *
 * 每个模式（颜色记忆 / 顺序记忆）单独记录历史最高的等级与得分，
 * 供测评页模式选择卡与「全部功能」入口展示「最佳：Lv N」。
 * 等级优先于得分：先比等级，等级相同再比得分。
 */

export type MemoryTestMode = 'color' | 'sequence'

export interface MemoryTestBest {
  level: number
  score: number
}

const STORAGE_KEY = 'mobile_memory_test_best'

type BestMap = Partial<Record<MemoryTestMode, MemoryTestBest>>

/** 从存储读取全部模式的最好成绩（读不到时返回空表） */
export function getAllMemoryTestBests(): BestMap {
  try {
    const raw = uni.getStorageSync(STORAGE_KEY)
    if (raw && typeof raw === 'object') return raw as BestMap
  } catch {
    // 存储不可用时按无成绩处理
  }
  return {}
}

/** 读取某模式的最好成绩，无记录返回 null */
export function getMemoryTestBest(mode: MemoryTestMode): MemoryTestBest | null {
  const best = getAllMemoryTestBests()[mode]
  return best && typeof best.level === 'number' && typeof best.score === 'number' ? best : null
}

/** 纯比较：candidate 是否优于 current（current 为 null 时恒为更优） */
export function isBetterBest(current: MemoryTestBest | null, candidate: MemoryTestBest): boolean {
  if (!current) return true
  if (candidate.level !== current.level) return candidate.level > current.level
  return candidate.score > current.score
}

/** 保存某模式成绩：仅当优于历史最好成绩时落库，返回是否更新了纪录 */
export function saveMemoryTestBest(mode: MemoryTestMode, level: number, score: number): boolean {
  const candidate: MemoryTestBest = { level, score }
  if (!isBetterBest(getMemoryTestBest(mode), candidate)) return false
  const all = getAllMemoryTestBests()
  all[mode] = candidate
  try {
    uni.setStorageSync(STORAGE_KEY, all)
  } catch {
    return false
  }
  return true
}
