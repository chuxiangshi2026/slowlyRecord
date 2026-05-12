/**
 * 多端同步类型定义
 *
 * 统一的同步数据格式，包含所有需要跨设备同步的用户数据。
 * 服务器同步是临时的，不保留用户身份信息，仅用随机 code 标识。
 */

import type { Word } from './words'
import type { TextArticle, TextNote, TextPrompt } from './text-memory'
import type { NumberMemoryEntry, NumberMemoryNote, NumberMemoryPrompt, NumberImageAssociation, TrainingResult } from './number-memory'

/** 同步数据版本号，用于兼容性检查 */
export const SYNC_VERSION = 1

/** 同步数据格式：JSON 或 二进制 */
export type SyncFormat = 'json' | 'binary'

/** 单个词库的同步数据 */
export interface SyncWordBank {
  id: string
  name: string
  words: Word[]
  createdAt: number
  updatedAt: number
  isDefault?: boolean
}

/** 用户设置的同步数据 */
export interface SyncUserSettings {
  pluginStatus: boolean
  shortcutEnabled: boolean
  translationPlatform: string
  ocrPlatform: string
  memoryFirmness: string
  keys: Record<string, { appkey: string; key: string }>
  ocrKeys: Record<string, { appkey: string; key: string }>
  focusMode: {
    alwaysOnTop: boolean
    opacity: number
    edgeStickEnabled: boolean
  }
}

/** 文本记忆同步数据 */
export interface SyncTextMemory {
  articles: TextArticle[]
  notes: TextNote[]
  prompts: TextPrompt[]
}

/** 数字记忆同步数据 */
export interface SyncNumberMemory {
  entries: NumberMemoryEntry[]
  notes: NumberMemoryNote[]
  prompts: NumberMemoryPrompt[]
  associations: NumberImageAssociation[]
  trainingResults: TrainingResult[]
}

/** 快捷键记忆同步数据 */
export interface SyncShortcutMemory {
  customCategories: any[]
  trainingRecords: any[]
  learningProgress: any
}

/** 完整的同步数据包 */
export interface SyncData {
  /** 数据格式版本 */
  version: typeof SYNC_VERSION
  /** 导出时间戳 */
  exportedAt: number
  /** 导出平台标识 */
  platform: string
  /** 词库数据 */
  wordBanks: SyncWordBank[]
  /** 当前词库 ID */
  currentWordBankId: string
  /** 用户设置 */
  userSettings: SyncUserSettings | null
  /** 文本记忆 */
  textMemory: SyncTextMemory | null
  /** 数字记忆 */
  numberMemory: SyncNumberMemory | null
  /** 快捷键记忆 */
  shortcutMemory: SyncShortcutMemory | null
}

/** 服务器同步状态 */
export type SyncStatus = 'idle' | 'uploading' | 'downloading' | 'error'

/** 服务器同步结果 */
export interface SyncServerResult {
  success: boolean
  code?: string
  error?: string
  data?: SyncData
}

/** 同步冲突策略 */
export type ConflictStrategy = 'merge' | 'local-first' | 'remote-first' | 'skip'
