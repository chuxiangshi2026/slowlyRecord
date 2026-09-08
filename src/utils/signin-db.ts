/**
 * 每日打卡数据存取层（桌面端）
 *
 * 存储 key 与移动端 useSignin.ts 保持一致（signin_records），
 * 数据格式为 JSON 字符串化的 YYYY-MM-DD 日期数组，双端同步可直接互通。
 */
import type { SyncSignin } from '@/types/sync'
import { log } from '@/utils/logger'

export const SIGNIN_STORAGE_KEY = 'signin_records'

/** 读取本地打卡日期列表（读取失败返回空数组） */
export function getSigninDates(): string[] {
  try {
    const stored = localStorage.getItem(SIGNIN_STORAGE_KEY)
    if (!stored) return []
    const parsed = JSON.parse(stored)
    if (Array.isArray(parsed)) {
      return parsed.filter((d): d is string => typeof d === 'string' && !!d)
    }
  } catch (e) {
    log.w('读取打卡记录失败:', e)
  }
  return []
}

/** 写回打卡日期列表（排序去重，保证与移动端合并结果一致） */
export function saveSigninDates(dates: string[]): void {
  const unique = Array.from(new Set(dates.filter(d => typeof d === 'string' && !!d))).sort()
  try {
    localStorage.setItem(SIGNIN_STORAGE_KEY, JSON.stringify(unique))
  } catch (e) {
    log.e('保存打卡记录失败:', e)
  }
}

/** 收集打卡数据用于同步（无数据返回 null，避免无意义负载） */
export function collectSigninSync(): SyncSignin | null {
  const dates = getSigninDates()
  if (dates.length === 0) return null
  return { dates: [...dates] }
}

/**
 * 还原打卡数据：与本地记录取并集后写回（打卡只有"某天是否打卡"，天然无冲突）
 * @returns 本次新增的打卡天数
 */
export function restoreSigninSync(data: SyncSignin): number {
  const local = new Set(getSigninDates())
  let added = 0
  for (const d of data?.dates || []) {
    if (d && !local.has(d)) {
      local.add(d)
      added++
    }
  }
  if (added > 0) {
    saveSigninDates(Array.from(local))
  }
  return added
}
