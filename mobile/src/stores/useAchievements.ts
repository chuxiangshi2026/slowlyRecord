import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import {
  ACHIEVEMENTS,
  checkAchievements,
  type AchievementDef,
  type AchievementStats,
} from '../utils/achievements'
import { useSignin } from './useSignin'
import { useMobileWords } from './useMobileWords'

/** 解锁状态存储键：{ [成就id]: 解锁时间戳 } */
export const ACHIEVEMENTS_STORAGE_KEY = 'slowlyrecord-achievements'

/** 「曾有错题」标记存储键（错题清零成就的前置条件） */
const EVER_WRONG_KEY = 'slowlyrecord-achievements-everwrong'

export const useAchievements = defineStore('achievements', () => {
  /** 已解锁成就：id -> 解锁时间戳 */
  const unlocked = ref<Record<string, number>>({})
  let _loaded = false

  const totalCount = ACHIEVEMENTS.length
  const unlockedCount = computed(() => Object.keys(unlocked.value).length)

  function load() {
    if (_loaded) return
    try {
      const raw = uni.getStorageSync(ACHIEVEMENTS_STORAGE_KEY)
      if (raw) {
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
        if (parsed && typeof parsed === 'object') {
          unlocked.value = parsed as Record<string, number>
        }
      }
    } catch {
      unlocked.value = {}
    }
    _loaded = true
  }

  function persist() {
    try {
      uni.setStorageSync(ACHIEVEMENTS_STORAGE_KEY, JSON.stringify(unlocked.value))
    } catch (e) {
      console.error('保存成就解锁状态失败:', e)
    }
  }

  function isUnlocked(id: string): boolean {
    load()
    return id in unlocked.value
  }

  function unlockedTime(id: string): number {
    load()
    return unlocked.value[id] || 0
  }

  /** 读取「曾有错题」标记 */
  function _readEverWrong(): boolean {
    try {
      return uni.getStorageSync(EVER_WRONG_KEY) === true
    } catch {
      return false
    }
  }

  /**
   * 汇总各 store 统计数据并检查成就：
   * 新解锁的成就立即落盘（带时间戳），并同步更新「曾有错题」标记。
   * @returns 本次新解锁的成就定义列表（调用方负责弹通知，同一成就不重复返回）
   */
  async function checkNow(): Promise<AchievementDef[]> {
    load()

    const signinStore = useSignin()
    signinStore.loadRecords()

    const wordsStore = useMobileWords()
    await wordsStore.loadWords()

    // 错题口径与错题本页一致：低等级（<=2）且复习过
    const wrongCount = wordsStore.allWords.filter(
      w => (w.level || 1) <= 2 && (w.reviewCount || 0) > 0,
    ).length
    const totalReviewCount = wordsStore.allWords.reduce((sum, w) => sum + (w.reviewCount || 0), 0)
    const currentWords = wordsStore.words
    const bankMastered =
      currentWords.length > 0 && currentWords.every(w => (w.level || 0) >= 12)

    // 本次观察到错题 >0 时落盘「曾有错题」标记（一次性置位，不撤销）
    let everHadWrong = _readEverWrong()
    if (wrongCount > 0 && !everHadWrong) {
      everHadWrong = true
      try {
        uni.setStorageSync(EVER_WRONG_KEY, true)
      } catch {
        // 标记失败不影响本次判定（stats 里已按 true 计算）
      }
    }

    const stats: AchievementStats = {
      streakDays: signinStore.streakDays,
      totalReviewCount,
      bankMastered,
      wrongCount,
      everHadWrong,
    }

    const newIds = checkAchievements(stats, new Set(Object.keys(unlocked.value)))
    if (newIds.length > 0) {
      const now = Date.now()
      for (const id of newIds) {
        unlocked.value[id] = now
      }
      persist()
    }
    return ACHIEVEMENTS.filter(a => newIds.includes(a.id))
  }

  return {
    unlocked,
    totalCount,
    unlockedCount,
    load,
    isUnlocked,
    unlockedTime,
    checkNow,
  }
})
