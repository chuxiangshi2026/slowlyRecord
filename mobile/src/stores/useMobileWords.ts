import { ref, computed, shallowRef } from 'vue'
import { defineStore } from 'pinia'
import { getDbAdapter, type DbDoc } from '@/adapters/index'
import { WORDBANK_LIST } from './useUtils/wordbank'
import { DEFAULT_INTERVALS } from './useUtils/constants'
import { recordTombstone, recordTombstones } from './useUtils/sync-tombstone'
import type { MobileItemType } from './useUtils/types'
import { normalizeWordText, getWordKey } from '../utils/text-utils'

export interface MobileWord {
  id: string
  word: string
  meaning: string
  phonetic?: string
  example?: string
  itemType?: MobileItemType
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
const IMPORT_PROGRESS_KEY = 'mobile_import_progress'

/**
 * 答错（忘记）后的降级等级：与桌面端 src/utils/srs.ts 的 computeLevelDown 口径一致
 * —— 满级（12 级）答错重置回 1 级，否则降 1 级，下限 1 级，不再无条件归零
 */
export function computeForgotLevel(level: number): number {
  if (level >= 12) return 1
  return Math.max((level || 1) - 1, 1)
}

/** 判定会改动的复习状态字段，判定前快照、撤销时整体恢复 */
export interface WordReviewState {
  level?: number
  reviewCount: number
  lastReviewTime?: number
  nextReviewTime: number
  needsReview?: boolean
  remembered?: boolean
}

/** 抽取单词的复习状态快照（复习页"撤销上一张"用，纯函数便于测试） */
export function snapshotReviewState(word: MobileWord): WordReviewState {
  return {
    level: word.level,
    reviewCount: word.reviewCount,
    lastReviewTime: word.lastReviewTime,
    nextReviewTime: word.nextReviewTime,
    needsReview: word.needsReview,
    remembered: word.remembered
  }
}

// 默认词库ID
const DEFAULT_BANK_ID = 'default'

// 脏词库落盘防抖间隔：复习停顿期间不整库回写（persistBankWords 内含整库 JSON.stringify），
// 拉长到 15s 降低大词库的重复序列化开销；App.vue onHide 已有 flushDirtyBanks 兜底
const PERSIST_DEBOUNCE_MS = 15000

// 持久化失败退避：连续失败时按失败次数拉长防抖间隔（15s → 最长 5 分钟），成功即复位
let _persistFailCount = 0
// 失败 toast 限频：每 5 分钟最多弹 1 次，避免存储持续写满时无限弹窗
let _lastToastAt = 0

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

  // ========== 词库懒加载 ==========
  // 首屏只完整读当前激活词库，其余词库 words 置空、切换/同步时再读入
  const _loadedBanks = new Set<string>()
  const _bankLoadPromises = new Map<string, Promise<void>>()

  function markBankDirty(bankId: string) {
    _dirtyBanks.add(bankId)
    if (!_persistTimer) {
      // 退避：失败越多重试间隔越长（15s × 失败次数，上限 20 次 = 5 分钟）。
      // 倍数下限钳到 1，失败计数为 0 时保持基准 15s 防抖（字面 ×0 会变成 0ms，退化成每词即刷）
      _persistTimer = setTimeout(() => {
        _persistTimer = null
        flushDirtyBanks()
      }, PERSIST_DEBOUNCE_MS * Math.min(Math.max(_persistFailCount, 1), 20))
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
    let failed = 0
    for (const bankId of banks) {
      const ok = await persistBankWords(bankId)
      if (!ok) failed++
    }
    // 写满等持久化失败：用户可见提示（复习记录可能丢失），脏词库保留待下次 flush 重试。
    // toast 限频：存储持续写满时最多每 5 分钟弹 1 次，不随失败重试无限循环
    if (failed > 0) {
      const now = Date.now()
      if (now - _lastToastAt > 5 * 60 * 1000) {
        _lastToastAt = now
        try {
          uni.showToast({ title: `存储空间不足，${failed} 个词库进度未保存`, icon: 'none' })
        } catch { /* toast 失败忽略 */ }
      }
    }
  }

  /** 将一个词库的全部单词写入 storage（一条记录）
   *  @returns 是否写入成功；失败时词库重新标脏，待下次 flush 重试 */
  async function persistBankWords(bankId: string): Promise<boolean> {
    // 懒加载未读入的词库内存数据不完整，跳过写入，避免用半份数据覆盖整库
    if (!_loadedBanks.has(bankId)) return true
    const bankWords = allWords.value.filter(w =>
      w.bankId === bankId || (!w.bankId && bankId === DEFAULT_BANK_ID)
    )
    try {
      const db = getDbAdapter()
      const result = await db.promises.asyncPut({
        _id: `bank_${bankId}_words`,
        data: bankWords
      })
      if (!result.ok) {
        console.error(`持久化词库 ${bankId} 失败:`, result.message)
        // 失败计数 +1，markBankDirty 按新计数退避重试
        _persistFailCount++
        markBankDirty(bankId)
        return false
      }
      // 写入成功：失败计数复位，退避间隔回到基准值
      _persistFailCount = 0
      return true
    } catch (e) {
      console.error(`持久化词库 ${bankId} 失败:`, e)
      _persistFailCount++
      markBankDirty(bankId)
      return false
    }
  }

  // 当前词库的单词
  const words = computed(() => {
    return allWords.value.filter(w => w.bankId === currentBankId.value || (!w.bankId && currentBankId.value === DEFAULT_BANK_ID))
  })

  // 自定义复习列表（从搜索单词页筛选后"去复习"时设置）
  const customReviewWords = shallowRef<MobileWord[] | null>(null)

  // 当前词库的待复习单词
  const reviewWords = computed(() => {
    if (customReviewWords.value !== null) return customReviewWords.value
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
    if (bankList.value.length > 0 && (allWords.value.length > 0 || _loadedBanks.has(currentBankId.value))) return

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

  /** 读取词库级记录：优先走适配器异步读（uni.getStorage），无异步实现时回退同步 get */
  async function readBankDoc(bankId: string): Promise<DbDoc | null> {
    const db = getDbAdapter()
    if (typeof db.getAsync === 'function') return db.getAsync(`bank_${bankId}_words`)
    return db.get(`bank_${bankId}_words`)
  }

  /** 修复存量污染数据：remembered === true 但 level < 12 的词纠正为未记住，返回受影响的词库集合 */
  function _fixPollutedWords(words: MobileWord[]): Set<string> {
    const pollutedBanks = new Set<string>()
    for (const w of words) {
      if (w.remembered === true && (w.level ?? 0) < 12) {
        w.remembered = false
        pollutedBanks.add(w.bankId || DEFAULT_BANK_ID)
      }
    }
    return pollutedBanks
  }

  async function _doLoadWords() {
    isLoading.value = true
    try {
      _loadBankList()
      const loaded: MobileWord[] = []
      let hasBankLevelData = false

      // 1. 首屏只完整读当前激活词库的词表，其余词库懒加载（switchBank/同步时再读），
      //    避免启动时同步读取所有大词库（GRE 级 1.2MB+）阻塞首屏 JS 线程
      const currentDoc = await readBankDoc(currentBankId.value)
      if (currentDoc && Array.isArray(currentDoc.data)) {
        loaded.push(...currentDoc.data)
        hasBankLevelData = true
      }
      _loadedBanks.clear()
      _loadedBanks.add(currentBankId.value)

      // 2. 如果当前词库没有词库级记录，回退到逐条记录（旧格式，兼容）
      if (!hasBankLevelData) {
        const db = getDbAdapter()
        const allDocs = db.allDocs(DB_KEY)
        const oldWords = allDocs.map((item: any) => ({
          ...item.data,
          id: item._id
        })) || []
        loaded.push(...oldWords)
        // 旧格式单词全部归属默认词库，且已随本次加载完整读入内存
        if (oldWords.length > 0) {
          _loadedBanks.add(DEFAULT_BANK_ID)
        }
      }

      allWords.value = loaded

      // 修复存量污染数据，仅改内存并按既有 markBankDirty 机制落库
      for (const bankId of _fixPollutedWords(loaded)) {
        markBankDirty(bankId)
      }
    } catch (e) {
      allWords.value = []
      _loadedBanks.clear()
    } finally {
      isLoading.value = false
    }
  }

  /** 懒加载单个词库的单词：读入后整体替换该库在内存中的词表 */
  async function _loadBankWords(bankId: string) {
    const doc = await readBankDoc(bankId)
    const bankWords = doc && Array.isArray(doc.data) ? (doc.data as MobileWord[]) : []
    allWords.value = [
      ...allWords.value.filter(w => !(w.bankId === bankId || (!w.bankId && bankId === DEFAULT_BANK_ID))),
      ...bankWords,
    ]
    // 修复存量污染数据（与 _doLoadWords 同口径），仅改内存并按既有机制落库
    for (const pollutedId of _fixPollutedWords(bankWords)) {
      markBankDirty(pollutedId)
    }
    _loadedBanks.add(bankId)
  }

  /** 确保某个词库的单词已读入内存（切换词库 / 向该库导入前调用） */
  async function ensureBankLoaded(bankId: string) {
    if (_loadedBanks.has(bankId)) return
    const pending = _bankLoadPromises.get(bankId)
    if (pending) return pending
    const p = _loadBankWords(bankId).finally(() => {
      _bankLoadPromises.delete(bankId)
    })
    _bankLoadPromises.set(bankId, p)
    return p
  }

  /** 确保所有词库的单词都已读入内存（同步推送 / 按库合并导入前调用） */
  async function ensureAllBanksLoaded() {
    for (const bank of bankList.value) {
      await ensureBankLoaded(bank.id)
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
    // 移动端无需旧数据迁移（未上线）
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
    // 同步墓碑：词库 id + 库内全部词 id 一并埋点，防止另一端推送时「删除复活」
    recordTombstone(bankId)
    recordTombstones(allWords.value
      .filter(w => w.bankId === bankId || (!w.bankId && bankId === DEFAULT_BANK_ID))
      .map(w => w.id))
    allWords.value = allWords.value.filter(w => w.bankId !== bankId)
    const db = getDbAdapter()
    db.remove(`bank_${bankId}_words`)
    bankList.value = bankList.value.filter(b => b.id !== bankId)
    _saveBankList()
    // 取消该词库待 flush 的防抖状态，避免 persistBankWords 重建空文档
    _dirtyBanks.delete(bankId)
    _loadedBanks.delete(bankId)
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
    // 懒加载：目标词库首屏未读入时，切换后异步补读（不阻塞切换本身，读完自动刷新各页）
    ensureBankLoaded(bankId).catch(() => { /* 读取失败保持空库，可再次切换触发重试 */ })
  }

  function getBankById(bankId: string): WordBankMeta | undefined {
    return bankList.value.find(b => b.id === bankId)
  }

  function getBankWordCount(bankId: string): number {
    return allWords.value.filter(w => w.bankId === bankId || (!w.bankId && bankId === DEFAULT_BANK_ID)).length
  }

  /** 标记词库的来源（从内置词库导入时记录映射关系） */
  function setBankSource(bankId: string, sourceType: WordBankMeta['sourceType'], sourceId: string) {
    const bank = bankList.value.find(b => b.id === bankId)
    if (!bank) return
    bank.sourceType = sourceType
    bank.sourceId = sourceId
    bank.updatedAt = Date.now()
    _saveBankList()
  }

  /** 获取已导入内置词库的映射列表（哪些内置词库映射到了哪些用户词库） */
  function getBankMappings(): { sourceId: string; sourceName: string; bankId: string; bankName: string; wordCount: number }[] {
    const wordbankInfoMap = new Map(WORDBANK_LIST.map(w => [w.id, w.name]))
    return bankList.value
      .filter(b => b.sourceType === 'builtin' && b.sourceId)
      .map(b => ({
        sourceId: b.sourceId!,
        sourceName: wordbankInfoMap.get(b.sourceId! as any) || b.sourceId!,
        bankId: b.id,
        bankName: b.name,
        wordCount: getBankWordCount(b.id)
      }))
  }

  // ========== 导入进度管理 ==========

  /** 获取某个内置词库导入到某目标词库的进度（已导入数量） */
  function getImportProgress(targetBankId: string, sourceId: string): number {
    try {
      const data = uni.getStorageSync(IMPORT_PROGRESS_KEY)
      if (data && typeof data === 'object') {
        const key = `${targetBankId}:${sourceId}`
        return data[key] || 0
      }
    } catch {}
    return 0
  }

  /** 设置导入进度 */
  function setImportProgress(targetBankId: string, sourceId: string, count: number) {
    try {
      let data: Record<string, number> = {}
      try {
        const raw = uni.getStorageSync(IMPORT_PROGRESS_KEY)
        if (raw && typeof raw === 'object') data = raw
      } catch {}
      const key = `${targetBankId}:${sourceId}`
      data[key] = count
      uni.setStorageSync(IMPORT_PROGRESS_KEY, data)
    } catch (e) {
      console.error('保存导入进度失败:', e)
    }
  }

  // ========== 单词 CRUD ==========

  async function addWord(word: Omit<MobileWord, 'id'>) {
    const bankId = word.bankId || currentBankId.value
    // 目标词库可能懒加载未读入：先确保已加载，避免后续整库落盘用半份数据覆盖
    await ensureBankLoaded(bankId)
    const id = `${DB_KEY}_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
    const newWord: MobileWord = {
      ...word,
      id,
      bankId,
      level: word.level ?? 1,
      needsReview: word.needsReview ?? true,
      lastReviewTime: word.lastReviewTime ?? 0
    }

    allWords.value = [...allWords.value, newWord]
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
    // 同步墓碑：防止被删单词在另一台设备「删除复活」
    recordTombstone(id)
    const bankId = word.bankId || DEFAULT_BANK_ID
    allWords.value = allWords.value.filter(w => w.id !== id)
    markBankDirty(bankId)
  }

  async function updateWord(id: string, updates: Partial<MobileWord>) {
    const index = allWords.value.findIndex(w => w.id === id)
    if (index === -1) return

    const updated = { ...allWords.value[index], ...updates }
    const newArr = [...allWords.value]
    newArr[index] = updated
    allWords.value = newArr
    markBankDirty(updated.bankId || DEFAULT_BANK_ID)
  }

  /**
   * 批量标记当前词库全部单词 needsReview（复习页「提前复习全部」入口）：
   * 一次遍历、单次整体赋值，避免逐词 updateWord 造成 O(n²) 全量拷贝与各页 computed 反复重算
   */
  function markAllNeedsReview() {
    const bankId = currentBankId.value
    let changed = false
    const next = allWords.value.map(w => {
      const inBank = w.bankId === bankId || (!w.bankId && bankId === DEFAULT_BANK_ID)
      if (inBank && !w.needsReview) {
        changed = true
        return { ...w, needsReview: true }
      }
      return w
    })
    if (changed) {
      allWords.value = next
      markBankDirty(bankId)
    }
  }

  function updateWordLevel(id: string, newLevel: number) {
    const word = allWords.value.find(w => w.id === id)
    if (!word) return
    // 等级钳制到 0-12，与桌面端一致；只有达到掌握阈值（12 级）才算永久记住
    const level = Math.max(0, Math.min(newLevel, 12))
    const intervalMinutes = DEFAULT_INTERVALS[level]
    updateWord(id, {
      level,
      reviewCount: (word.reviewCount || 0) + 1,
      lastReviewTime: Date.now(),
      nextReviewTime: Date.now() + intervalMinutes * 60 * 1000,
      needsReview: false,
      remembered: level >= 12
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

    // 忘记只降级（对齐桌面端 computeLevelDown 口径），不再无条件打回 1 级
    const newLevel = computeForgotLevel(word.level || 1)
    allWords.value = allWords.value.map(w =>
      w.id === id
        ? { ...w, remembered: false, needsReview: true, level: newLevel, nextReviewTime: Date.now() + 10 * 60 * 1000 }
        : w
    )
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
  async function importWords(data: MobileWord[], targetBankId?: string): Promise<{ imported: MobileWord[]; skippedCount: number; invalidCount: number; success: boolean; message?: string }> {
    const bankId = targetBankId || currentBankId.value
    // 目标词库可能懒加载未读入：先确保已加载，importWords 以完整本地数据为基准合并，避免丢已有单词
    await ensureBankLoaded(bankId)

    const importedMap = new Map<string, MobileWord>()
    let duplicateInImportCount = 0
    let invalidCount = 0
    for (const word of data) {
      const normalizedWord = normalizeWordText(word.word)
      if (!normalizedWord) {
        invalidCount++
        continue
      }
      const key = getWordKey(normalizedWord)
      const id = word.id || `${DB_KEY}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      const normalizedItem = { ...word, word: normalizedWord, id, bankId }
      if (importedMap.has(key)) {
        duplicateInImportCount++
      }
      importedMap.set(key, normalizedItem)
    }
    const importedWords = Array.from(importedMap.values())

    // 从内存中读取该词库已有单词，按规范化后的 word 字段去重
    const existingWords = allWords.value.filter(w =>
      w.bankId === bankId || (!w.bankId && bankId === DEFAULT_BANK_ID)
    )
    const existingWordSet = new Set(existingWords.map(w => getWordKey(w.word)))
    const newOnly = importedWords.filter(w => !existingWordSet.has(getWordKey(w.word)))
    const skippedCount = duplicateInImportCount + (importedWords.length - newOnly.length)

    if (newOnly.length > 0) {
      const mergedWords = [...existingWords, ...newOnly]
      const db = getDbAdapter()
      const result = await db.promises.asyncPut({
        _id: `bank_${bankId}_words`,
        data: mergedWords
      })
      if (result.ok) {
        allWords.value = [
          ...allWords.value.filter(w => !(w.bankId === bankId || (!w.bankId && bankId === DEFAULT_BANK_ID))),
          ...mergedWords,
        ]
      } else {
        // 写库失败：内存不合并，返回失败信息避免调用方误报成功
        return { imported: [], skippedCount, invalidCount, success: false, message: '词库写入失败' }
      }
    }

    return { imported: newOnly, skippedCount, invalidCount, success: true }
  }

  /** 一次性追加单词到内存（shallowRef 赋值本身很快） */
  function appendWordsToMemory(newWords: MobileWord[]) {
    allWords.value = [...allWords.value, ...newWords]
  }

  async function clearAllWords() {
    const targetBankId = currentBankId.value
    recordTombstones(allWords.value
      .filter(w => w.bankId === targetBankId || (!w.bankId && targetBankId === DEFAULT_BANK_ID))
      .map(w => w.id))
    allWords.value = allWords.value.filter(w =>
      w.bankId !== targetBankId && !(!w.bankId && targetBankId === DEFAULT_BANK_ID)
    )
    const db = getDbAdapter()
    db.remove(`bank_${targetBankId}_words`)
    // 清空后内存与存储一致为空库，视为已加载，避免后续懒加载读回旧数据
    _loadedBanks.add(targetBankId)
  }

  async function clearBankWords(bankId: string) {
    recordTombstones(allWords.value
      .filter(w => w.bankId === bankId || (!w.bankId && bankId === DEFAULT_BANK_ID))
      .map(w => w.id))
    allWords.value = allWords.value.filter(w =>
      w.bankId !== bankId && !(!w.bankId && bankId === DEFAULT_BANK_ID)
    )
    const db = getDbAdapter()
    db.remove(`bank_${bankId}_words`)
    // 同 clearAllWords：清空后视为已加载
    _loadedBanks.add(bankId)
    const bank = bankList.value.find(b => b.id === bankId)
    if (bank) {
      bank.updatedAt = Date.now()
      _saveBankList()
    }
  }

  async function moveWordToBank(wordId: string, targetBankId: string) {
    const word = allWords.value.find(w => w.id === wordId)
    const sourceBankId = word?.bankId || DEFAULT_BANK_ID
    // 目标词库可能懒加载未读入：先确保已加载，否则落盘时会用半份数据覆盖目标词库
    await ensureBankLoaded(targetBankId)
    await updateWord(wordId, { bankId: targetBankId })
    // 源词库也要标脏，否则旧库残留单词不会被持久化移除
    if (sourceBankId !== targetBankId) {
      markBankDirty(sourceBankId)
    }
  }

  /** 设置自定义复习列表（搜索单词页面筛选后调用） */
  function setCustomReviewWords(words: MobileWord[] | null) {
    customReviewWords.value = words
  }

  return {
    // 状态
    words,
    allWords,
    isLoading,
    reviewWords,
    customReviewWords,
    wordCount,
    totalCount,
    todayAdded,
    // 词库管理
    bankList,
    currentBankId,
    // 方法
    loadWords,
    reloadWords,
    ensureBankLoaded,
    ensureAllBanksLoaded,
    addWord,
    deleteWord,
    updateWord,
    markAllNeedsReview,
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
    moveWordToBank,
    setBankSource,
    getBankMappings,
    getImportProgress,
    setImportProgress,
    setCustomReviewWords
  }
})
