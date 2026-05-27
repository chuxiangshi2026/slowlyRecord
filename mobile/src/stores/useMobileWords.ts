import { ref, computed, shallowRef, triggerRef } from 'vue'
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
  const allWords = shallowRef<MobileWord[]>([])
  const isLoading = ref(false)
  let _loadingPromise: Promise<void> | null = null

  // ========== 词库管理 ==========
  const bankList = ref<WordBankMeta[]>([])
  const currentBankId = ref<string>(DEFAULT_BANK_ID)

  // ========== 防抖持久化 ==========
  const _dirtyBanks = new Set<string>()
  let _persistTimer: ReturnType<typeof setTimeout> | null = null

  function markBankDirty(bankId: string) {
    _dirtyBanks.add(bankId)
    if (!_persistTimer) {
      _persistTimer = setTimeout(() => {
        _persistTimer = null
        flushDirtyBanks()
      }, 3000)
    }
  }

  /** 立即将所有脏词库写入存储 */
  async function flushDirtyBanks() {
    if (_persistTimer) {
      clearTimeout(_persistTimer)
      _persistTimer = null
    }
    const banks = [..._dirtyBanks]
    _dirtyBanks.clear()
    for (const bankId of banks) {
      await persistBankWords(bankId)
    }
  }

  /** 将一个词库的全部单词写入 storage（一条记录） */
  async function persistBankWords(bankId: string) {
    const bankWords = allWords.value.filter(w =>
      w.bankId === bankId || (!w.bankId && bankId === DEFAULT_BANK_ID)
    )
    const db = getDbAdapter()
    try {
      await db.promises.asyncPut({
        _id: `bank_${bankId}_words`,
        data: bankWords
      })
    } catch (e) {
      console.error(`持久化词库 ${bankId} 失败:`, e)
    }
  }

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
      _loadBankList()
      const db = getDbAdapter()
      const loaded: MobileWord[] = []
      let hasBankLevelData = false

      // 1. 读取词库级记录（新格式，每库一条）
      for (const bank of bankList.value) {
        const doc = db.get(`bank_${bank.id}_words`)
        if (doc && Array.isArray(doc.data)) {
          loaded.push(...doc.data)
          hasBankLevelData = true
        }
      }

      // 2. 如果没有词库级记录，回退到逐条记录（旧格式，兼容）
      if (!hasBankLevelData) {
        const allDocs = db.allDocs(DB_KEY)
        const oldWords = allDocs.map((item: any) => ({
          ...item.data,
          id: item._id
        })) || []
        loaded.push(...oldWords)
      }

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
        bankList.value = [{
          id: DEFAULT_BANK_ID,
          name: '默认词库',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          isDefault: true
        }]
        _saveBankList()
      }
    } catch {
      bankList.value = [{
        id: DEFAULT_BANK_ID,
        name: '默认词库',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        isDefault: true
      }]
    }
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
    // 迁移：将"我的词库"或"基础词库"重命名为"默认词库"
    let needSave = false
    for (const bank of bankList.value) {
      if (bank.name === '我的词库' || bank.name === '基础词库') {
        bank.name = '默认词库'
        needSave = true
      }
    }
    if (needSave) _saveBankList()
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
    allWords.value = allWords.value.filter(w => w.bankId !== bankId)
    const db = getDbAdapter()
    db.remove(`bank_${bankId}_words`)
    bankList.value = bankList.value.filter(b => b.id !== bankId)
    _saveBankList()
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

    allWords.value.push(newWord)
    triggerRef(allWords)
    markBankDirty(newWord.bankId || DEFAULT_BANK_ID)

    const bank = bankList.value.find(b => b.id === newWord.bankId)
    if (bank) {
      bank.updatedAt = Date.now()
      _saveBankList()
    }
    return newWord
  }

  async function deleteWord(id: string) {
    const word = allWords.value.find(w => w.id === id)
    if (!word) return
    const bankId = word.bankId || DEFAULT_BANK_ID
    allWords.value = allWords.value.filter(w => w.id !== id)
    markBankDirty(bankId)
  }

  async function updateWord(id: string, updates: Partial<MobileWord>) {
    const index = allWords.value.findIndex(w => w.id === id)
    if (index === -1) return

    const updated = { ...allWords.value[index], ...updates }
    allWords.value[index] = updated
    triggerRef(allWords)
    markBankDirty(updated.bankId || DEFAULT_BANK_ID)
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
    triggerRef(allWords)
    markBankDirty(word.bankId || DEFAULT_BANK_ID)
  }

  function exportWords() {
    return words.value
  }

  function exportAllWords() {
    return allWords.value
  }

  /**
   * 批量导入单词：整个词库写为一条 storage 记录
   * 从内存合并已有单词后一次性写入，16k 词 → 1 条记录
   */
  async function importWords(data: MobileWord[], targetBankId?: string): Promise<MobileWord[]> {
    const bankId = targetBankId || currentBankId.value

    const importedWords: MobileWord[] = []
    for (const word of data) {
      const id = word.id || `${DB_KEY}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      importedWords.push({ ...word, id, bankId })
    }

    // 从内存中读取该词库已有单词，合并后写入
    const existingWords = allWords.value.filter(w =>
      w.bankId === bankId || (!w.bankId && bankId === DEFAULT_BANK_ID)
    )
    const existingIds = new Set(existingWords.map(w => w.id))
    const newOnly = importedWords.filter(w => !existingIds.has(w.id))
    const mergedWords = [...existingWords, ...newOnly]

    const db = getDbAdapter()
    await db.promises.asyncPut({
      _id: `bank_${bankId}_words`,
      data: mergedWords
    })

    return importedWords
  }

  /** 一次性追加单词到内存（shallowRef 赋值本身很快） */
  function appendWordsToMemory(newWords: MobileWord[]) {
    allWords.value = [...allWords.value, ...newWords]
  }

  async function clearAllWords() {
    const targetBankId = currentBankId.value
    allWords.value = allWords.value.filter(w =>
      w.bankId !== targetBankId && !(!w.bankId && targetBankId === DEFAULT_BANK_ID)
    )
    const db = getDbAdapter()
    db.remove(`bank_${targetBankId}_words`)
  }

  async function clearBankWords(bankId: string) {
    allWords.value = allWords.value.filter(w =>
      w.bankId !== bankId && !(!w.bankId && bankId === DEFAULT_BANK_ID)
    )
    const db = getDbAdapter()
    db.remove(`bank_${bankId}_words`)
    const bank = bankList.value.find(b => b.id === bankId)
    if (bank) {
      bank.updatedAt = Date.now()
      _saveBankList()
    }
  }

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
    appendWordsToMemory,
    clearAllWords,
    flushDirtyBanks,
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
