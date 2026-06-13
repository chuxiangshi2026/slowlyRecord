/**
 * 类型定义 - 零运行时代码，仅类型导出
 * 主包/分包均可安全引用，不增加包体积
 */

export type TranslationPlatform = 'youdao' | 'baidu' | 'ali' | 'tencent' | 'deepseek' | 'qwen' | 'kimi' | 'glm' | 'ollama' | 'local'

export interface TranslationResult {
  success: boolean
  explains: string
  translatedText: string
  phonetic?: string
  pronunciation?: string
  errorMsg?: string
  platform: string
  examples?: { english: string; chinese: string }[]
  synonyms?: string[]
  antonyms?: string[]
  memoryTip?: string
  memoryImage?: string
  memoryImageUrl?: string
}

export type WordBankType =
  | 'cet4'
  | 'cet6'
  | 'kaogong'
  | 'kaoyan'
  | 'ielts'
  | 'toefl'
  | 'gre'
  | 'gmat'
  | 'bec'
  | 'level4'
  | 'level8'
  | 'zsb'
  | 'sat'
  | 'nul'
  | 'phrasal-verbs'
  | 'collocations'
  | 'idioms'
  | 'roots'

export interface WordBankInfo {
  id: WordBankType
  name: string
  description: string
  wordCount: number
  icon?: string
}

export type MobileItemType = 'word' | 'phrase' | 'sentence' | 'collocation'

export interface Word {
  word: string
  meaning: string
  phonetic?: string
  example?: string
  explains?: string
  itemType?: MobileItemType
}

export interface LoadStrategy {
  priority: 'local' | 'online'
  useCache: boolean
  timeout: number
}

export interface OcrWordResult {
  word: string
  meaning: string
  phonetic?: string
}

export interface MobileSyncBank {
  id: string
  name: string
  words: any[]
}

export interface MobileUserSettings {
  translationPlatform?: TranslationPlatform
  keys?: Record<string, { appkey: string; key: string }>
}

export interface MobileSyncData {
  version: number
  exportedAt: number
  platform: string
  banks: MobileSyncBank[]
  userSettings?: MobileUserSettings
}

export interface SyncResult {
  success: boolean
  code?: string
  error?: string
}

export interface RestoreResult {
  success: boolean
  banks?: MobileSyncBank[]
  count?: number
  error?: string
}
