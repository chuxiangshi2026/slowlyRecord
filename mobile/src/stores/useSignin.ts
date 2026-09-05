import { ref, computed } from 'vue'
import { defineStore } from 'pinia'

// 打卡记录沿用 signin 页面原有存储 key（无 slowlyrecord_ 前缀），老数据无需迁移
const SIGNIN_STORAGE_KEY = 'signin_records'

/** 本地时区日期 → YYYY-MM-DD */
function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export const useSignin = defineStore('signin', () => {
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
    try {
      const stored = uni.getStorageSync(SIGNIN_STORAGE_KEY)
      if (stored) {
        // 历史数据以 JSON 字符串写入，兼容直接存数组的情况
        const parsed = typeof stored === 'string' ? JSON.parse(stored) : stored
        if (Array.isArray(parsed)) signedDates.value = parsed
      }
    } catch {
      signedDates.value = []
    }
    _loaded = true
  }

  function persist() {
    try {
      uni.setStorageSync(SIGNIN_STORAGE_KEY, JSON.stringify(signedDates.value))
    } catch (e) {
      console.error('保存打卡记录失败:', e)
    }
  }

  /** 今日打卡，重复打卡返回 false */
  function signToday(): boolean {
    if (hasSignedToday.value) return false
    signedDates.value = [...signedDates.value, todayStr.value]
    persist()
    return true
  }

  return {
    signedDates,
    todayStr,
    hasSignedToday,
    streakDays,
    totalSignDays,
    loadRecords,
    signToday,
    monthSignDays
  }
})
