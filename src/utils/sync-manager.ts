/**
 * 多端同步核心管理器
 *
 * 负责从各 Store / DB 收集数据、合并还原、冲突处理。
 * 同步数据以 SyncData 为统一格式，可导出为 JSON 或二进制文件，也可上传到临时服务器。
 */
import type { SyncData, SyncWordBank, SyncUserSettings, SyncTextMemory, SyncNumberMemory, SyncShortcutMemory, SyncLetterMemory, SyncKnowledgeMemory, SyncPhoneticMemory, ConflictStrategy } from '@/types/sync'
import { SYNC_VERSION } from '@/types/sync'
import { getAllWordBanks, saveWordBank, setCurrentWordBankId, type WordBank } from '@/utils/wordbank-manager'
import type { Word } from '@/types/words'
import type { MemoryFirmnessType } from '@/types/words'
import type { NumberMemoryEntry, NumberMemoryNote, NumberMemoryPrompt, NumberImageAssociation, TrainingResult } from '@/types/number-memory'
import type { LetterImageAssociation, LetterTrainingResult } from '@/types/letter-memory'
import type { KnowledgeItemProgress } from '@/types/knowledge-memory'
import type { PhonemeProgress, MinimalPairProgress } from '@/types/phonetic-memory'
import { getDbAdapter } from '@/adapters/db'
import { getPlatform } from '@/adapters/platform'
import { getSetDb, addAndUpdateSetDb } from '@/utils/user-set-db-util'
import { DB_KEY_USER_SET, DB_KEY_NUMBER_MEMORY, DB_KEY_SHORTCUT_MEMORY, DB_KEY_LETTER_MEMORY, DB_KEY_KNOWLEDGE_MEMORY, DB_KEY_PHONETIC_MEMORY } from '@/constants'
import { getImportedIds, addImportedId, getProgressDoc as getKnowledgeProgressDoc, saveProgressDoc as saveKnowledgeProgressDoc } from '@/utils/knowledge-memory-db'
import { getProgressDoc as getPhoneticProgressDoc, saveProgressDoc as savePhoneticProgressDoc } from '@/utils/phonetic-memory-db'
import { log } from '@/utils/logger'

// ==================== 数据收集 ====================

/**
 * 从当前设备收集所有需要同步的数据
 */
export async function collectSyncData(): Promise<SyncData> {
  const platform = getPlatform()

  // 1. 词库数据
  const allBanks = await getAllWordBanks()
  const wordBanks: SyncWordBank[] = allBanks.map(bank => ({
    id: bank.id,
    name: bank.name,
    words: bank.words,
    createdAt: bank.createdAt,
    updatedAt: bank.updatedAt,
    isDefault: bank.isDefault,
    language: bank.language,
  }))

  // 2. 当前词库 ID（复用已加载的 banks，避免再次调用 getAllWordBanks）
  let currentWordBankId = ''
  try {
    const storedId = localStorage.getItem('slowly-record-current-wordbank')
    if (storedId && allBanks.find(b => b.id === storedId)) {
      currentWordBankId = storedId
    } else {
      const defaultBank = allBanks.find(b => b.isDefault)
      currentWordBankId = defaultBank?.id || allBanks[0]?.id || ''
    }
  } catch {
    const defaultBank = allBanks.find(b => b.isDefault)
    currentWordBankId = defaultBank?.id || allBanks[0]?.id || ''
  }

  // 3. 用户设置
  const userSetDoc = getSetDb()
  let userSettings: SyncUserSettings | null = null
  if (userSetDoc) {
    userSettings = {
      pluginStatus: userSetDoc.pluginStatus ?? false,
      shortcutEnabled: userSetDoc.shortcutEnabled ?? false,
      translationPlatform: userSetDoc.translationPlatform ?? 'glm',
      ocrPlatform: userSetDoc.ocrPlatform ?? 'local',
      memoryFirmness: userSetDoc.memoryFirmness ?? '正常',
      keys: userSetDoc.keys ?? {},
      ocrKeys: userSetDoc.ocrKeys ?? {},
      focusMode: userSetDoc.focusMode ?? { alwaysOnTop: true, opacity: 1.0, edgeStickEnabled: true },
    }
  }

  // 4. 文本记忆
  const textMemory = await collectTextMemory()

  // 5. 数字记忆
  const numberMemory = await collectNumberMemory()

  // 6. 快捷键记忆
  const shortcutMemory = await collectShortcutMemory()

  // 7. 字母映射
  const letterMemory = await collectLetterMemory()

  // 8. 通用知识包
  const knowledgeMemory = await collectKnowledgeMemory()

  // 9. 音标学习进度
  const phoneticMemory = await collectPhoneticMemory()

  return {
    version: SYNC_VERSION,
    exportedAt: Date.now(),
    platform,
    wordBanks,
    currentWordBankId,
    userSettings,
    textMemory,
    numberMemory,
    shortcutMemory,
    letterMemory,
    knowledgeMemory,
    phoneticMemory,
  }
}

async function collectTextMemory(): Promise<SyncTextMemory | null> {
  try {
    const db = getDbAdapter()
    const doc = db.get('slowlyrecord-textmemory-data') as any
    if (!doc || !doc.articles) return null
    return {
      articles: doc.articles || [],
      notes: doc.notes || [],
      prompts: doc.prompts || [],
    }
  } catch {
    return null
  }
}

async function collectNumberMemory(): Promise<SyncNumberMemory | null> {
  try {
    const db = getDbAdapter()
    const prefix = DB_KEY_NUMBER_MEMORY

    // 训练文档（包含 associations）
    const trainingDoc = db.allDocs(prefix).find((d: any) => d.type === 'number_memory_training') as any

    // 条目
    const entries = db.allDocs(prefix + 'entry_')
      .filter((d: any) => d.type === 'number_memory_entry')

    // 笔记
    const notes = db.allDocs(prefix + 'note_')
      .filter((d: any) => d.type === 'number_memory_note')

    // 提示词
    const prompts = db.allDocs(prefix + 'prompt_')
      .filter((d: any) => d.type === 'number_memory_prompt')

    // 训练结果
    const trainingResults = db.allDocs(prefix + 'result_')
      .filter((d: any) => d.type === 'number_memory_result')

    if (!trainingDoc && entries.length === 0) return null

    return {
      entries: (entries || []) as NumberMemoryEntry[],
      notes: (notes || []) as NumberMemoryNote[],
      prompts: (prompts || []) as NumberMemoryPrompt[],
      associations: (trainingDoc?.associations || []) as NumberImageAssociation[],
      trainingResults: (trainingResults || []) as TrainingResult[],
    }
  } catch {
    return null
  }
}

async function collectShortcutMemory(): Promise<SyncShortcutMemory | null> {
  try {
    const db = getDbAdapter()
    const prefix = DB_KEY_SHORTCUT_MEMORY

    // 自定义分类
    const customCategories = db.allDocs(prefix + 'category_')
      .filter((d: any) => d.type === 'shortcut_custom_category')

    // 训练记录
    const trainingRecords = db.allDocs(prefix + 'record_')
      .filter((d: any) => d.type === 'shortcut_training_record')

    // 学习进度
    const progressDocs = db.allDocs(prefix + 'progress_')
      .filter((d: any) => d.type === 'shortcut_learning_progress')

    if (customCategories.length === 0 && trainingRecords.length === 0 && progressDocs.length === 0) return null

    return {
      customCategories: customCategories || [],
      trainingRecords: trainingRecords || [],
      learningProgress: progressDocs || [],
    }
  } catch {
    return null
  }
}

async function collectLetterMemory(): Promise<SyncLetterMemory | null> {
  try {
    const db = getDbAdapter()
    const prefix = DB_KEY_LETTER_MEMORY

    // 训练文档（包含 associations）
    const trainingDoc = db.allDocs(prefix).find((d: any) => d.type === 'letter_memory_training') as any

    // 训练结果
    const trainingResults = db.allDocs(prefix + 'result_')
      .filter((d: any) => d.type === 'letter_memory_result')

    if (!trainingDoc && trainingResults.length === 0) return null

    return {
      associations: (trainingDoc?.associations || []) as LetterImageAssociation[],
      trainingResults: (trainingResults || []) as LetterTrainingResult[],
    }
  } catch {
    return null
  }
}

/**
 * 收集通用知识包数据：已导入清单 + 每包条目进度
 * 进度文档按 allDocs 扫描（含不在清单中但有进度的包，兼容旧数据）
 */
async function collectKnowledgeMemory(): Promise<SyncKnowledgeMemory | null> {
  try {
    const db = getDbAdapter()
    const importedIds = getImportedIds()
    const progressDocs = db.allDocs(DB_KEY_KNOWLEDGE_MEMORY)
      .filter((d: any) => d.type === 'knowledge_pack_progress') as any[]

    const packIds = new Set<string>([...importedIds, ...progressDocs.map(d => d.packId)])
    if (packIds.size === 0) return null

    const packs: Record<string, Record<string, KnowledgeItemProgress>> = {}
    for (const packId of packIds) {
      const doc = getKnowledgeProgressDoc(packId)
      if (Object.keys(doc.items).length > 0) {
        packs[packId] = doc.items
      }
    }

    if (Object.keys(packs).length === 0 && importedIds.length === 0) return null

    return { importedIds: [...packIds], packs }
  } catch {
    return null
  }
}

/** 收集音标学习进度（单文档） */
async function collectPhoneticMemory(): Promise<SyncPhoneticMemory | null> {
  try {
    const doc = getPhoneticProgressDoc()
    const phonemes = doc.phonemes || {}
    const pairs = doc.pairs || {}
    if (Object.keys(phonemes).length === 0 && Object.keys(pairs).length === 0) return null
    return { phonemes, pairs }
  } catch {
    return null
  }
}

// ==================== 数据还原 ====================

export interface RestoreOptions {
  /** 冲突策略 */
  conflictStrategy: ConflictStrategy
  /** 是否还原词库数据 */
  restoreWordBanks: boolean
  /** 是否还原用户设置 */
  restoreUserSettings: boolean
  /** 是否还原文本记忆 */
  restoreTextMemory: boolean
  /** 是否还原数字记忆 */
  restoreNumberMemory: boolean
  /** 是否还原快捷键记忆 */
  restoreShortcutMemory: boolean
  /** 是否还原字母映射 */
  restoreLetterMemory: boolean
  /** 是否还原知识库（导入清单 + 每包进度） */
  restoreKnowledgeMemory: boolean
  /** 是否还原音标学习进度 */
  restorePhoneticMemory: boolean
}

export const DEFAULT_RESTORE_OPTIONS: RestoreOptions = {
  conflictStrategy: 'merge',
  restoreWordBanks: true,
  restoreUserSettings: true,
  restoreTextMemory: true,
  restoreNumberMemory: true,
  restoreShortcutMemory: true,
  restoreLetterMemory: true,
  restoreKnowledgeMemory: true,
  restorePhoneticMemory: true,
}

export interface RestoreResult {
  success: boolean
  wordBanksRestored: number
  userSettingsRestored: boolean
  textMemoryRestored: boolean
  numberMemoryRestored: boolean
  shortcutMemoryRestored: boolean
  letterMemoryRestored: boolean
  knowledgeMemoryRestored: boolean
  phoneticMemoryRestored: boolean
  errors: string[]
}

/**
 * 将同步数据还原到当前设备
 */
export async function restoreSyncData(data: SyncData, options: RestoreOptions = DEFAULT_RESTORE_OPTIONS): Promise<RestoreResult> {
  const result: RestoreResult = {
    success: true,
    wordBanksRestored: 0,
    userSettingsRestored: false,
    textMemoryRestored: false,
    numberMemoryRestored: false,
    shortcutMemoryRestored: false,
    letterMemoryRestored: false,
    knowledgeMemoryRestored: false,
    phoneticMemoryRestored: false,
    errors: [],
  }

  // 版本检查
  if (data.version > SYNC_VERSION) {
    result.errors.push(`数据版本(${data.version})高于当前支持版本(${SYNC_VERSION})，请更新应用`)
    result.success = false
    return result
  }

  try {
    // 1. 还原词库
    if (options.restoreWordBanks && data.wordBanks?.length) {
      await restoreWordBanks(data.wordBanks, data.currentWordBankId, options.conflictStrategy)
      result.wordBanksRestored = data.wordBanks.length
    }

    // 2. 还原用户设置
    if (options.restoreUserSettings && data.userSettings) {
      await restoreUserSettings(data.userSettings)
      result.userSettingsRestored = true
    }

    // 3. 还原文本记忆
    if (options.restoreTextMemory && data.textMemory) {
      await restoreTextMemory(data.textMemory)
      result.textMemoryRestored = true
    }

    // 4. 还原数字记忆
    if (options.restoreNumberMemory && data.numberMemory) {
      await restoreNumberMemoryData(data.numberMemory)
      result.numberMemoryRestored = true
    }

    // 5. 还原快捷键记忆
    if (options.restoreShortcutMemory && data.shortcutMemory) {
      await restoreShortcutMemoryData(data.shortcutMemory)
      result.shortcutMemoryRestored = true
    }

    // 6. 还原字母映射
    if (options.restoreLetterMemory && data.letterMemory) {
      await restoreLetterMemoryData(data.letterMemory)
      result.letterMemoryRestored = true
    }

    // 7. 还原知识库（导入清单 + 每包进度；按字段存在性判断，向后兼容旧数据）
    if (options.restoreKnowledgeMemory && data.knowledgeMemory) {
      await restoreKnowledgeMemoryData(data.knowledgeMemory)
      result.knowledgeMemoryRestored = true
    }

    // 8. 还原音标学习进度
    if (options.restorePhoneticMemory && data.phoneticMemory) {
      await restorePhoneticMemoryData(data.phoneticMemory)
      result.phoneticMemoryRestored = true
    }
  } catch (e) {
    result.errors.push(String(e))
    result.success = false
  }

  return result
}

// ==================== 词库还原 ====================

async function restoreWordBanks(banks: SyncWordBank[], currentBankId: string, strategy: ConflictStrategy) {
  const existingBanks = await getAllWordBanks()
  const existingMap = new Map(existingBanks.map(b => [b.id, b]))

  for (const bank of banks) {
    const existing = existingMap.get(bank.id)
    if (existing) {
      // 冲突处理
      switch (strategy) {
        case 'skip':
          continue
        case 'local-first':
          // 本地优先，仅合并不存在的单词
          mergeWordsIntoExisting(existing, bank.words, 'local-first')
          await saveWordBank(existing)
          break
        case 'remote-first':
          // 远端优先，用远端数据覆盖
          existing.words = bank.words
          existing.name = bank.name
          existing.updatedAt = bank.updatedAt
          await saveWordBank(existing)
          break
        case 'merge':
        default:
          mergeWordsIntoExisting(existing, bank.words, 'merge')
          await saveWordBank(existing)
          break
      }
    } else {
      // 新词库，直接创建（浅拷贝单词即可，数据来自反序列化不存在共享引用）
      const newBank: WordBank = {
        id: bank.id,
        name: bank.name,
        words: [...bank.words],
        createdAt: bank.createdAt,
        updatedAt: bank.updatedAt,
        isDefault: bank.isDefault,
        language: bank.language,
      }
      await saveWordBank(newBank)
    }
  }

  // 恢复当前词库选择
  if (currentBankId) {
    setCurrentWordBankId(currentBankId)
  }
}

/**
 * 合并单词到现有词库
 * 以 word.text 作为去重键，合并策略：
 * - merge: 远端有本地没有的添加，都有时以 learnDate 更新的为准
 * - local-first: 只添加本地没有的
 */
function mergeWordsIntoExisting(existingBank: WordBank, incomingWords: Word[], mode: 'merge' | 'local-first') {
  const existingMap = new Map(existingBank.words.map(w => [w.text.toLowerCase(), w]))

  for (const word of incomingWords) {
    const key = word.text.toLowerCase()
    const existing = existingMap.get(key)
    if (!existing) {
      // 本地没有，添加（浅拷贝避免引用共享）
      existingBank.words.push({ ...word })
      existingMap.set(key, word)
    } else if (mode === 'merge') {
      // 都有，以 learnDate 更新的为准
      const existingDate = existing.learnDate ? new Date(existing.learnDate).getTime() : 0
      const incomingDate = word.learnDate ? new Date(word.learnDate).getTime() : 0
      if (incomingDate > existingDate) {
        // 字段级合并：远端缺失的记忆进度字段保留本地值，避免整词覆盖丢进度
        const merged: Word = { ...existing, ...word }
        const progressKeys: (keyof Word)[] = ['level', 'remember', 'isReview', 'learnDate', 'ctime']
        for (const key of progressKeys) {
          if (word[key] === undefined || word[key] === null) {
            merged[key] = existing[key]
          }
        }
        Object.assign(existing, merged)
      }
    }
  }

  existingBank.updatedAt = Date.now()
}

// ==================== 用户设置还原 ====================

async function restoreUserSettings(settings: SyncUserSettings) {
  let userSet = getSetDb()
  if (!userSet) {
    userSet = {
      _id: DB_KEY_USER_SET + Date.now(),
      pluginStatus: false,
      shortcutEnabled: false,
      translationPlatform: 'glm',
      ocrPlatform: 'local',
      memoryFirmness: '正常',
      keys: {},
      ocrKeys: {},
      focusMode: { alwaysOnTop: true, opacity: 1.0, edgeStickEnabled: true, fontColor: '', fontSize: 20, explainFontSize: 11, backgroundImage: '', backgroundImageOpacity: 0.35 },
      mainWindowOpacity: 1.0,
      autoSpeak: false,
    }
  }

  // 合并设置（只合并非空值）
  if (settings.translationPlatform) userSet.translationPlatform = settings.translationPlatform
  if (settings.ocrPlatform) userSet.ocrPlatform = settings.ocrPlatform
  if (settings.memoryFirmness) userSet.memoryFirmness = settings.memoryFirmness as MemoryFirmnessType
  userSet.pluginStatus = settings.pluginStatus
  userSet.shortcutEnabled = settings.shortcutEnabled

  // 合并 API 密钥
  if (settings.keys) {
    userSet.keys = { ...userSet.keys, ...settings.keys }
  }
  if (settings.ocrKeys) {
    userSet.ocrKeys = { ...userSet.ocrKeys, ...settings.ocrKeys }
  }
  if (settings.focusMode) {
    userSet.focusMode = { ...userSet.focusMode, ...settings.focusMode }
  }

  await addAndUpdateSetDb(userSet)
}

// ==================== 文本记忆还原 ====================

async function restoreTextMemory(data: SyncTextMemory) {
  try {
    const db = getDbAdapter()
    const DOC_ID = 'slowlyrecord-textmemory-data'
    const existingDoc = db.get(DOC_ID) as any

    const doc: any = {
      _id: DOC_ID,
      type: 'textmemory',
      articles: data.articles || [],
      notes: data.notes || [],
      prompts: data.prompts || [],
      updatedAt: Date.now(),
    }

    if (existingDoc?._rev) {
      doc._rev = existingDoc._rev
    }

    await db.promises.put(doc)
    log.i('文本记忆数据已还原')
  } catch (e) {
    log.e('还原文本记忆失败', e)
    throw e
  }
}

// ==================== 数字记忆还原 ====================

async function restoreNumberMemoryData(data: SyncNumberMemory) {
  const db = getDbAdapter()
  const prefix = DB_KEY_NUMBER_MEMORY

  // 还原训练文档（包含 associations）
  if (data.associations?.length) {
    const existingTraining = db.allDocs(prefix).find((d: any) => d.type === 'number_memory_training') as any
    const doc: any = {
      _id: existingTraining?._id || (prefix + 'training_' + Date.now()),
      type: 'number_memory_training',
      associations: data.associations,
      createdAt: existingTraining?.createdAt || Date.now(),
      updatedAt: Date.now(),
    }
    if (existingTraining?._rev) doc._rev = existingTraining._rev
    await db.promises.put(doc)
  }

  // 批量收集所有需要写入的条目
  const bulkItems: any[] = []
  if (data.entries?.length) bulkItems.push(...data.entries)
  if (data.notes?.length) bulkItems.push(...data.notes)
  if (data.prompts?.length) bulkItems.push(...data.prompts)
  if (data.trainingResults?.length) bulkItems.push(...data.trainingResults)

  // 分批 bulkDocs（每批 200 条）
  if (bulkItems.length > 0) {
    const BATCH_SIZE = 200
    for (let i = 0; i < bulkItems.length; i += BATCH_SIZE) {
      const batch = bulkItems.slice(i, i + BATCH_SIZE)
      try {
        await db.promises.bulkDocs(batch)
      } catch (e) {
        // bulkDocs 失败时逐条降级写入
        for (const item of batch) {
          try {
            await db.promises.put(item)
          } catch { /* skip */ }
        }
      }
    }
  }

  log.i('数字记忆数据已还原')
}

// ==================== 快捷键记忆还原 ====================

async function restoreShortcutMemoryData(data: SyncShortcutMemory) {
  const db = getDbAdapter()

  // 批量收集所有需要写入的条目
  const bulkItems: any[] = []
  if (data.customCategories?.length) bulkItems.push(...data.customCategories)
  if (data.trainingRecords?.length) bulkItems.push(...data.trainingRecords)
  if (data.learningProgress?.length) {
    const items = Array.isArray(data.learningProgress) ? data.learningProgress : [data.learningProgress]
    bulkItems.push(...items)
  }

  if (bulkItems.length > 0) {
    const BATCH_SIZE = 200
    for (let i = 0; i < bulkItems.length; i += BATCH_SIZE) {
      const batch = bulkItems.slice(i, i + BATCH_SIZE)
      try {
        await db.promises.bulkDocs(batch)
      } catch {
        for (const item of batch) {
          try { await db.promises.put(item) } catch { /* skip */ }
        }
      }
    }
  }

  log.i('快捷键记忆数据已还原')
}

async function restoreLetterMemoryData(data: SyncLetterMemory) {
  const db = getDbAdapter()
  const prefix = DB_KEY_LETTER_MEMORY

  // 还原训练文档（包含 associations）
  if (data.associations?.length) {
    const existingTraining = db.allDocs(prefix).find((d: any) => d.type === 'letter_memory_training') as any
    if (existingTraining) {
      const existingMap = new Map((existingTraining.associations || []).map((a: any) => [a.letter, a]))
      for (const assoc of data.associations) {
        existingMap.set(assoc.letter, assoc)
      }
      existingTraining.associations = Array.from(existingMap.values())
      existingTraining.updatedAt = Date.now()
      await db.promises.put(existingTraining)
    } else {
      const now = Date.now()
      await db.promises.put({
        _id: prefix + 'training_' + now,
        type: 'letter_memory_training',
        associations: data.associations,
        createdAt: now,
        updatedAt: now,
      })
    }
  }

  // 批量还原训练结果
  if (data.trainingResults?.length) {
    const BATCH_SIZE = 200
    for (let i = 0; i < data.trainingResults.length; i += BATCH_SIZE) {
      const batch = data.trainingResults.slice(i, i + BATCH_SIZE)
      try {
        await db.promises.bulkDocs(batch)
      } catch {
        for (const result of batch) {
          try { await db.promises.put(result) } catch { /* skip */ }
        }
      }
    }
  }

  log.i('字母映射数据已还原')
}

// ==================== 知识库还原 ====================

/**
 * 还原知识库数据：并入已导入清单 + 按包合并条目进度
 * 进度条目按 learnDate 较新者保留（双向 merge，不丢本地进度）
 */
async function restoreKnowledgeMemoryData(data: SyncKnowledgeMemory) {
  const importedIds = new Set<string>([...getImportedIds(), ...(data.importedIds || [])])
  for (const packId of importedIds) {
    addImportedId(packId)
  }

  for (const [packId, items] of Object.entries(data.packs || {})) {
    if (!items || typeof items !== 'object') continue
    const doc = getKnowledgeProgressDoc(packId)
    const merged: Record<string, KnowledgeItemProgress> = { ...doc.items }
    for (const [itemId, progress] of Object.entries(items)) {
      const local = merged[itemId]
      if (!local || (progress?.learnDate || 0) > (local.learnDate || 0)) {
        merged[itemId] = progress
      }
    }
    doc.items = merged
    await saveKnowledgeProgressDoc(doc)
  }

  log.i('知识库数据已还原')
}

// ==================== 音标进度还原 ====================

/**
 * 还原音标学习进度：逐项按 learnDate 较新者保留
 */
async function restorePhoneticMemoryData(data: SyncPhoneticMemory) {
  const doc = getPhoneticProgressDoc()

  const phonemes: Record<string, PhonemeProgress> = { ...doc.phonemes }
  for (const [ipa, progress] of Object.entries(data.phonemes || {})) {
    const local = phonemes[ipa]
    if (!local || (progress?.learnDate || 0) > (local.learnDate || 0)) {
      phonemes[ipa] = progress
    }
  }

  const pairs: Record<string, MinimalPairProgress> = { ...doc.pairs }
  for (const [key, progress] of Object.entries(data.pairs || {})) {
    const local = pairs[key]
    if (!local || (progress?.learnDate || 0) > (local.learnDate || 0)) {
      pairs[key] = progress
    }
  }

  doc.phonemes = phonemes
  doc.pairs = pairs
  await savePhoneticProgressDoc(doc)
  log.i('音标学习进度已还原')
}
