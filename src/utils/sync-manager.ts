/**
 * 多端同步核心管理器
 *
 * 负责从各 Store / DB 收集数据、合并还原、冲突处理。
 * 同步数据以 SyncData 为统一格式，可导出为 JSON 或二进制文件，也可上传到临时服务器。
 */
import type { SyncData, SyncWordBank, SyncUserSettings, SyncTextMemory, SyncNumberMemory, SyncShortcutMemory, ConflictStrategy } from '@/types/sync'
import { SYNC_VERSION } from '@/types/sync'
import { getAllWordBanks, saveWordBank, getCurrentWordBankId, setCurrentWordBankId, createWordBank, type WordBank } from '@/utils/wordbank-manager'
import type { Word } from '@/types/words'
import type { MemoryFirmnessTpye } from '@/types/words'
import type { NumberMemoryEntry, NumberMemoryNote, NumberMemoryPrompt, NumberImageAssociation, TrainingResult } from '@/types/number-memory'
import { getDbAdapter } from '@/adapters/db'
import { getPlatform } from '@/adapters/platform'
import { getSetDb, addAndUpdateSetDb } from '@/utils/user-set-db-util'
import { DB_KEY_USER_SET, DB_KEY_NUMBER_MEMORY, DB_KEY_SHORTCUT_MEMORY } from '@/constants'
import { log } from '@/utils/logger'
import cloneDeep from 'lodash.clonedeep'

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
  }))

  // 2. 当前词库 ID
  const currentWordBankId = await getCurrentWordBankId()

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
}

export const DEFAULT_RESTORE_OPTIONS: RestoreOptions = {
  conflictStrategy: 'merge',
  restoreWordBanks: true,
  restoreUserSettings: true,
  restoreTextMemory: true,
  restoreNumberMemory: true,
  restoreShortcutMemory: true,
}

export interface RestoreResult {
  success: boolean
  wordBanksRestored: number
  userSettingsRestored: boolean
  textMemoryRestored: boolean
  numberMemoryRestored: boolean
  shortcutMemoryRestored: boolean
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
      // 新词库，直接创建
      const newBank: WordBank = {
        id: bank.id,
        name: bank.name,
        words: cloneDeep(bank.words),
        createdAt: bank.createdAt,
        updatedAt: bank.updatedAt,
        isDefault: bank.isDefault,
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
      // 本地没有，添加
      existingBank.words.push(cloneDeep(word))
      existingMap.set(key, word)
    } else if (mode === 'merge') {
      // 都有，以 learnDate 更新的为准
      const existingDate = existing.learnDate ? new Date(existing.learnDate).getTime() : 0
      const incomingDate = word.learnDate ? new Date(word.learnDate).getTime() : 0
      if (incomingDate > existingDate) {
        Object.assign(existing, cloneDeep(word))
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
      focusMode: { alwaysOnTop: true, opacity: 1.0, edgeStickEnabled: true },
    }
  }

  // 合并设置（只合并非空值）
  if (settings.translationPlatform) userSet.translationPlatform = settings.translationPlatform
  if (settings.ocrPlatform) userSet.ocrPlatform = settings.ocrPlatform
  if (settings.memoryFirmness) userSet.memoryFirmness = settings.memoryFirmness as MemoryFirmnessTpye
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

  // 还原条目
  if (data.entries?.length) {
    for (const entry of data.entries) {
      try {
        await db.promises.put(cloneDeep(entry))
      } catch { /* skip */ }
    }
  }

  // 还原笔记
  if (data.notes?.length) {
    for (const note of data.notes) {
      try {
        await db.promises.put(cloneDeep(note))
      } catch { /* skip */ }
    }
  }

  // 还原提示词
  if (data.prompts?.length) {
    for (const prompt of data.prompts) {
      try {
        await db.promises.put(cloneDeep(prompt))
      } catch { /* skip */ }
    }
  }

  // 还原训练结果
  if (data.trainingResults?.length) {
    for (const result of data.trainingResults) {
      try {
        await db.promises.put(cloneDeep(result))
      } catch { /* skip */ }
    }
  }

  log.i('数字记忆数据已还原')
}

// ==================== 快捷键记忆还原 ====================

async function restoreShortcutMemoryData(data: SyncShortcutMemory) {
  const db = getDbAdapter()

  // 还原自定义分类
  if (data.customCategories?.length) {
    for (const cat of data.customCategories) {
      try {
        await db.promises.put(cloneDeep(cat))
      } catch { /* skip */ }
    }
  }

  // 还原训练记录
  if (data.trainingRecords?.length) {
    for (const record of data.trainingRecords) {
      try {
        await db.promises.put(cloneDeep(record))
      } catch { /* skip */ }
    }
  }

  // 还原学习进度
  if (data.learningProgress?.length) {
    for (const progress of (Array.isArray(data.learningProgress) ? data.learningProgress : [data.learningProgress])) {
      try {
        await db.promises.put(cloneDeep(progress))
      } catch { /* skip */ }
    }
  }

  log.i('快捷键记忆数据已还原')
}
