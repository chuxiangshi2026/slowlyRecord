import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { getDbAdapter } from '@/adapters/index'

// 默认复习间隔（单位：分钟）与桌面端保持一致
const DEFAULT_INTERVALS = [
  1, 5, 30, 6 * 60, 12 * 60, 24 * 60,
  2 * 24 * 60, 4 * 24 * 60, 7 * 24 * 60,
  15 * 24 * 60, 30 * 24 * 60, 3 * 30 * 24 * 60,
  6 * 30 * 24 * 60, 12 * 30 * 24 * 60
]

export interface MobileWord {
  id: string
  word: string
  meaning: string
  phonetic?: string
  example?: string
  addTime: number
  reviewCount: number
  nextReviewTime: number
  needsReview?: boolean
  remembered?: boolean
  level?: number
  lastReviewTime?: number
}

const DB_KEY = 'mobile_words'

export const useMobileWords = defineStore('mobileWords', () => {
  const words = ref<MobileWord[]>([])
  const isLoading = ref(false)

  const reviewWords = computed(() => {
    const now = Date.now()
    return words.value.filter(w => {
      if (w.remembered) return false
      // 新单词（nextReviewTime 未设置或已过）或手动标记需要复习
      return (w.nextReviewTime === undefined || w.nextReviewTime <= now) || w.needsReview === true
    })
  })

  const wordCount = computed(() => words.value.length)
  const totalCount = computed(() => words.value.length)
  const todayAdded = computed(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return words.value.filter(w => w.addTime >= today.getTime()).length
  })

  async function loadWords() {
    isLoading.value = true
    try {
      const db = getDbAdapter()
      const allDocs = db.allDocs(DB_KEY)
      const loaded = allDocs.map((item: any) => ({
        ...item.data,
        id: item._id
      })) || []
      words.value = loaded
    } catch (e) {
      console.error('加载单词失败:', e)
      words.value = []
    } finally {
      isLoading.value = false
    }
  }

  async function addWord(word: Omit<MobileWord, 'id'>) {
    const id = `${DB_KEY}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const newWord: MobileWord = {
      ...word,
      id,
      level: 1,
      needsReview: true,
      lastReviewTime: 0
    }

    const db = getDbAdapter()
    const result = db.put({
      _id: id,
      data: newWord
    })
    if (!result.ok) {
      throw new Error(result.message || '保存单词失败')
    }

    words.value.push(newWord)
    return newWord
  }

  async function deleteWord(id: string) {
    const db = getDbAdapter()
    await db.remove({ _id: id, _rev: '1' })
    words.value = words.value.filter(w => w.id !== id)
  }

  async function updateWord(id: string, updates: Partial<MobileWord>) {
    const index = words.value.findIndex(w => w.id === id)
    if (index === -1) return

    const updated = { ...words.value[index], ...updates }
    const db = getDbAdapter()
    await db.put({
      _id: id,
      data: updated
    })
    words.value[index] = updated
  }

  function updateWordLevel(id: string, newLevel: number) {
    const word = words.value.find(w => w.id === id)
    if (!word) return
    const level = Math.max(1, Math.min(newLevel, DEFAULT_INTERVALS.length - 1))
    const intervalMinutes = DEFAULT_INTERVALS[level]
    updateWord(id, {
      level,
      reviewCount: (word.reviewCount || 0) + 1,
      lastReviewTime: Date.now(),
      nextReviewTime: Date.now() + intervalMinutes * 60 * 1000,
      needsReview: false,
      remembered: true
    })
  }

  async function markAsRemembered(id: string) {
    const word = words.value.find(w => w.id === id)
    if (!word) return

    const currentLevel = word.level || 1
    updateWordLevel(id, currentLevel + 1)
  }

  async function markAsForgotten(id: string) {
    const word = words.value.find(w => w.id === id)
    if (!word) return

    word.remembered = false
    word.needsReview = true
    word.level = 1
    word.nextReviewTime = Date.now() + 10 * 60 * 1000 // 10分钟后再次复习

    const db = getDbAdapter()
    await db.put({
      _id: id,
      data: word
    })
  }

  function exportWords() {
    return words.value
  }

  async function importWords(data: MobileWord[]) {
    const db = getDbAdapter()
    for (const word of data) {
      const id = word.id || `${DB_KEY}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      await db.promises.put({
        _id: id,
        data: { ...word, id }
      })
    }
    await loadWords()
  }

  async function clearAllWords() {
    const db = getDbAdapter()
    for (const word of words.value) {
      await db.remove({ _id: word.id, _rev: '1' })
    }
    words.value = []
  }

  return {
    words,
    isLoading,
    reviewWords,
    wordCount,
    totalCount,
    todayAdded,
    loadWords,
    addWord,
    deleteWord,
    updateWord,
    updateWordLevel,
    markAsRemembered,
    markAsForgotten,
    exportWords,
    importWords,
    clearAllWords
  }
})
