import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { getDbAdapter, type DbDoc } from '@/adapters/index'

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
  bankId?: string  // 所属词库ID
}

export interface WordBankMeta {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  isDefault?: boolean
  sourceType?: 'builtin' | 'custom'  // 来源类型：内置词库导入 / 用户自建
  sourceId?: string  // 如果来自内置词库，记录原始ID（如 'cet4'）
}

const DB_KEY = 'mobile_words'
const BANKS_STORAGE_KEY = 'mobile_wordbanks'
const CURRENT_BANK_KEY = 'mobile_current_bank'

// 默认词库ID
const DEFAULT_BANK_ID = 'default'

export const useMobileWords = defineStore('mobileWords', () => {
  const allWords = ref<MobileWord[]>([])
  const isLoading = ref(false)
  let _loadingPromise: Promise<void> | null = null

  // ========== 词库管理 ==========
  const bankList = ref<WordBankMeta[]>([])
  const currentBankId = ref<string>(DEFAULT_BANK_ID)

  // 当前词库的单词
  const words = computed(() => {
    return allWords.value.filter(w => w.bankId === currentBankId.value || (!w.bankId && currentBankId.value === DEFAULT_BANK_ID))
  })

  // 当前词库的待复习单词
  const reviewWords = computed(() => {
    const now = Date.now()
    return words.value.filter(w => {
      if (w.remembered) return false
      return (w.nextReviewTime === undefined || w.nextReviewTime <= now) || w.needsReview === true
    })
  })

  const wordCount = computed(() => words.value.length)
  const totalCount = computed(() => allWords.value.length)
  const todayAdded = computed(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return words.value.filter(w => w.addTime >= today.getTime()).length
  })

  // ========== 加载与初始化 ==========

  async function loadWords() {
    if (_loadingPromise) return _loadingPromise
    if (allWords.value.length > 0 && bankList.value.length > 0) return

    _loadingPromise = _doLoadWords()
    try {
      await _loadingPromise
    } finally {
      _loadingPromise = null
    }
  }

  /** 强制从存储重新加载所有单词到内存 */
  async function reloadWords() {
    _loadingPromise = _doLoadWords()
    try {
      await _loadingPromise
    } finally {
      _loadingPromise = null
    }
  }

  async function _doLoadWords() {
    isLoading.value = true
    try {
      // 加载词库列表
      _loadBankList()
      // 加载所有单词
      const db = getDbAdapter()
      const allDocs = db.allDocs(DB_KEY)
      const loaded = allDocs.map((item: any) => ({
        ...item.data,
        id: item._id
      })) || []
      // 让出主线程，确保 loading 状态能渲染
      await new Promise<void>(r => setTimeout(r, 0))
      allWords.value = loaded
    } catch (e) {
      allWords.value = []
    } finally {
      isLoading.value = false
    }
  }

  function _loadBankList() {
    try {
      const data = uni.getStorageSync(BANKS_STORAGE_KEY)
      if (data && Array.isArray(data)) {
        bankList.value = data
      } else {
        // 初始化默认词库
        bankList.value = [{
          id: DEFAULT_BANK_ID,
          name: '我的词库',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          isDefault: true
        }]
        _saveBankList()
      }
    } catch {
      bankList.value = [{
        id: DEFAULT_BANK_ID,
        name: '我的词库',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        isDefault: true
      }]
    }
    // 加载当前词库
    try {
      const saved = uni.getStorageSync(CURRENT_BANK_KEY)
      if (saved && bankList.value.some(b => b.id === saved)) {
        currentBankId.value = saved
      } else {
        currentBankId.value = DEFAULT_BANK_ID
      }
    } catch {
      currentBankId.value = DEFAULT_BANK_ID
    }
  }

  function _saveBankList() {
    try {
      uni.setStorageSync(BANKS_STORAGE_KEY, bankList.value)
    } catch (e) {
      console.error('保存词库列表失败:', e)
    }
  }

  function _saveCurrentBankId() {
    try {
      uni.setStorageSync(CURRENT_BANK_KEY, currentBankId.value)
    } catch (e) {
      console.error('保存当前词库ID失败:', e)
    }
  }

  async function _migrateOldWords() {
    let needMigrate = false
    for (const w of allWords.value) {
      if (!w.bankId) {
        w.bankId = DEFAULT_BANK_ID
        needMigrate = true
      }
    }
    if (needMigrate) {
      const db = getDbAdapter()
      for (const w of allWords.value) {
        const existing = db.get(w.id)
        if (existing) {
          await db.promises.put({
            _id: w.id,
            _rev: existing._rev,
            data: w
          })
        }
      }
    }
  }

  // ========== 词库 CRUD ==========

  function createBank(name: string): WordBankMeta {
    const id = `bank_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const bank: WordBankMeta = {
      id,
      name,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      sourceType: 'custom'
    }
    bankList.value.push(bank)
    _saveBankList()
    return bank
  }

  async function deleteBank(bankId: string) {
    if (bankId === DEFAULT_BANK_ID) {
      throw new Error('默认词库不能删除')
    }
    // 删除词库下所有单词
    const bankWords = allWords.value.filter(w => w.bankId === bankId)
    const db = getDbAdapter()
    for (const w of bankWords) {
      const existing = db.get(w.id)
      if (existing?._rev) {
        await db.promises.remove({ _id: w.id, _rev: existing._rev })
      }
    }
    allWords.value = allWords.value.filter(w => w.bankId !== bankId)
    // 从列表移除
    bankList.value = bankList.value.filter(b => b.id !== bankId)
    _saveBankList()
    // 如果删除的是当前词库，切回默认
    if (currentBankId.value === bankId) {
      switchBank(DEFAULT_BANK_ID)
    }
  }

  function renameBank(bankId: string, newName: string) {
    const bank = bankList.value.find(b => b.id === bankId)
    if (!bank) throw new Error('词库不存在')
    bank.name = newName
    bank.updatedAt = Date.now()
    _saveBankList()
  }

  function switchBank(bankId: string) {
    if (!bankList.value.some(b => b.id === bankId)) {
      throw new Error('词库不存在')
    }
    currentBankId.value = bankId
    _saveCurrentBankId()
  }

  function getBankById(bankId: string): WordBankMeta | undefined {
    return bankList.value.find(b => b.id === bankId)
  }

  function getBankWordCount(bankId: string): number {
    return allWords.value.filter(w => w.bankId === bankId || (!w.bankId && bankId === DEFAULT_BANK_ID)).length
  }

  // ========== 单词 CRUD ==========

  async function addWord(word: Omit<MobileWord, 'id'>) {
    const id = `${DB_KEY}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const newWord: MobileWord = {
      ...word,
      id,
      bankId: word.bankId || currentBankId.value,
      level: word.level ?? 1,
      needsReview: word.needsReview ?? true,
      lastReviewTime: word.lastReviewTime ?? 0
    }

    const db = getDbAdapter()
    const result = db.put({
      _id: id,
      data: newWord
    })
    if (!result.ok) {
      throw new Error(result.message || '保存单词失败')
    }

    allWords.value.push(newWord)
    // 更新词库的 updatedAt
    const bank = bankList.value.find(b => b.id === newWord.bankId)
    if (bank) {
      bank.updatedAt = Date.now()
      _saveBankList()
    }
    return newWord
  }

  async function deleteWord(id: string) {
    const db = getDbAdapter()
    const existing = db.get(id)
    if (existing?._rev) {
      const result = await db.promises.remove({ _id: id, _rev: existing._rev })
      if (!result.ok) {
        throw new Error(result.message || '删除单词失败')
      }
    }
    allWords.value = allWords.value.filter(w => w.id !== id)
  }

  async function updateWord(id: string, updates: Partial<MobileWord>) {
    const index = allWords.value.findIndex(w => w.id === id)
    if (index === -1) return

    const updated = { ...allWords.value[index], ...updates }
    const db = getDbAdapter()
    const existing = db.get(id)
    const result = await db.promises.put({
      _id: id,
      _rev: existing?._rev,
      data: updated
    })
    if (!result.ok) {
      throw new Error(result.message || '更新单词失败')
    }
    allWords.value[index] = updated
  }

  function updateWordLevel(id: string, newLevel: number) {
    const word = allWords.value.find(w => w.id === id)
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
    const word = allWords.value.find(w => w.id === id)
    if (!word) return
    const currentLevel = word.level || 1
    updateWordLevel(id, currentLevel + 1)
  }

  async function markAsForgotten(id: string) {
    const word = allWords.value.find(w => w.id === id)
    if (!word) return

    word.remembered = false
    word.needsReview = true
    word.level = 1
    word.nextReviewTime = Date.now() + 10 * 60 * 1000

    const db = getDbAdapter()
    const existing = db.get(id)
    const result = await db.promises.put({
      _id: id,
      _rev: existing?._rev,
      data: word
    })
    if (!result.ok) {
      throw new Error(result.message || '更新单词失败')
    }
  }

  function exportWords() {
    return words.value
  }

  function exportAllWords() {
    return allWords.value
  }

  async function importWords(data: MobileWord[], targetBankId?: string, onProgress?: (done: number, total: number) => void) {
    const bankId = targetBankId || currentBankId.value
    const db = getDbAdapter()

    // 构建文档（跳过逐条 db.get——同步导入场景无需 _rev）
    const docs: DbDoc[] = []

    for (const word of data) {
      const id = word.id || `${DB_KEY}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      docs.push({
        _id: id,
        data: { ...word, id, bankId }
      })
    }

    // 异步批量写入存储，每批之间让出主线程
    const BATCH_SIZE = 50
    const total = docs.length
    for (let i = 0; i < docs.length; i += BATCH_SIZE) {
      const batch = docs.slice(i, i + BATCH_SIZE)
      await db.promises.asyncBulkDocs(batch)
      onProgress?.(Math.min(i + BATCH_SIZE, total), total)
      await new Promise<void>(r => setTimeout(r, 20))
    }
    // 注意：不在此更新 allWords，由调用方统一刷新
  }

  async function clearAllWords() {
    const db = getDbAdapter()
    // 只清除当前词库的单词
    const targetBankId = currentBankId.value
    const bankWords = allWords.value.filter(w =>
      w.bankId === targetBankId || (!w.bankId && targetBankId === DEFAULT_BANK_ID)
    )
    for (const word of bankWords) {
      const existing = db.get(word.id)
      if (existing?._rev) {
        await db.promises.remove({ _id: word.id, _rev: existing._rev })
      }
    }
    allWords.value = allWords.value.filter(w =>
      w.bankId !== targetBankId && !(!w.bankId && targetBankId === DEFAULT_BANK_ID)
    )
  }

  async function clearBankWords(bankId: string) {
    const db = getDbAdapter()
    const bankWords = allWords.value.filter(w =>
      w.bankId === bankId || (!w.bankId && bankId === DEFAULT_BANK_ID)
    )
    for (const word of bankWords) {
      const existing = db.get(word.id)
      if (existing?._rev) {
        await db.promises.remove({ _id: word.id, _rev: existing._rev })
      }
    }
    allWords.value = allWords.value.filter(w =>
      w.bankId !== bankId && !(!w.bankId && bankId === DEFAULT_BANK_ID)
    )
    const bank = bankList.value.find(b => b.id === bankId)
    if (bank) {
      bank.updatedAt = Date.now()
      _saveBankList()
    }
  }

  // 将单词移动到另一个词库
  async function moveWordToBank(wordId: string, targetBankId: string) {
    await updateWord(wordId, { bankId: targetBankId })
  }

  return {
    // 状态
    words,
    allWords,
    isLoading,
    reviewWords,
    wordCount,
    totalCount,
    todayAdded,
    // 词库管理
    bankList,
    currentBankId,
    // 方法
    loadWords,
    reloadWords,
    addWord,
    deleteWord,
    updateWord,
    updateWordLevel,
    markAsRemembered,
    markAsForgotten,
    exportWords,
    exportAllWords,
    importWords,
    clearAllWords,
    // 词库管理方法
    createBank,
    deleteBank,
    renameBank,
    switchBank,
    getBankById,
    getBankWordCount,
    clearBankWords,
    moveWordToBank
  }
})
