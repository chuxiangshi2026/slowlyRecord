/**
 * 每日打卡 store（桌面端）
 *
 * 结构对齐移动端 mobile/src/stores/useSignin.ts，
 * 打卡记录存取统一走 src/utils/signin-db.ts（存储 key 与移动端一致）。
 */
import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import type { SyncSignin } from '@/types/sync'
import { getSigninDates, saveSigninDates } from '@/utils/signin-db'

/** 本地时区日期 → YYYY-MM-DD */
function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export const useSigninStore = defineStore('signin', () => {
  const signedDates = ref<string[]>([])
  let _loaded = false

  const todayStr = computed(() => formatDate(new Date()))

  const hasSignedToday = computed(() => signedDates.value.includes(todayStr.value))

  /** 连续打卡天数：今天已打卡则从今天起算，否则从昨天起算 */
  const streakDays = computed(() => {
    const set = new Set(signedDates.value)
    let streak = 0
    const today = new Date()
    for (let i = 0; i < 366; i++) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      if (set.has(formatDate(d))) {
        streak++
      } else if (i > 0) {
        break
      }
    }
    return streak
  })

  const totalSignDays = computed(() => signedDates.value.length)

  /** 某年某月（month 从 0 计）的打卡天数 */
  function monthSignDays(year: number, month: number): number {
    const prefix = `${year}-${String(month + 1).padStart(2, '0')}`
    return signedDates.value.filter(d => d.startsWith(prefix)).length
  }

  /** 从存储加载打卡记录（幂等，可在多个页面安全调用） */
  function loadRecords() {
    if (_loaded) return
    signedDates.value = getSigninDates()
    _loaded = true
  }

  function persist() {
    saveSigninDates(signedDates.value)
  }

  /** 今日打卡，重复打卡返回 false */
  function signToday(): boolean {
    if (hasSignedToday.value) return false
    signedDates.value = [...signedDates.value, todayStr.value]
    persist()
    return true
  }

  // ===== 同步 collect / restore（与移动端 useSignin 同签名） =====

  /** 收集打卡记录用于同步（无数据返回 null） */
  function collectSync(): SyncSignin | null {
    loadRecords()
    if (signedDates.value.length === 0) return null
    return { dates: [...signedDates.value] }
  }

  /**
   * 还原打卡记录：与本地取并集后写回（打卡按日期合并，无冲突）
   * @returns 本次新增的打卡天数
   */
  function restoreSync(data: SyncSignin): number {
    loadRecords()
    const local = new Set(signedDates.value)
    let added = 0
    for (const d of data?.dates || []) {
      if (d && !local.has(d)) {
        local.add(d)
        added++
      }
    }
    if (added > 0) {
      signedDates.value = Array.from(local).sort()
      persist()
    }
    return added
  }

  return {
    signedDates,
    todayStr,
    hasSignedToday,
    streakDays,
    totalSignDays,
    loadRecords,
    signToday,
    monthSignDays,
    // sync
    collectSync,
    restoreSync,
  }
})
