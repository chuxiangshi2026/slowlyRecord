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

// ==================== 文本记忆同步类型 ====================

/**
 * 文本记忆文章（与桌面端 TextArticle 结构对齐）
 * 第一阶段移动端不使用 _rev/geo 等字段，但保留兼容
 */
export interface MobileTextArticle {
  _id: string
  _rev?: string
  title: string
  content: string
  author?: string
  source?: string
  location?: string
  dynasty?: string
  category?: 'poetry' | 'idiom' | 'article'
  geo?: { lng: number; lat: number; name: string }
  year?: number
  tags: string[]
  ctime: number
  utime: number
  reviewCount: number
  lastReviewTime?: number
}

export interface MobileTextNote {
  _id: string
  _rev?: string
  articleId: string
  content: string
  selectedText?: string
  position?: number
  ctime: number
  utime?: number
}

export interface MobileTextPrompt {
  _id: string
  _rev?: string
  articleId: string
  title: string
  content: string
  order: number
  enabled: boolean
  ctime: number
}

export interface MobileTextMemory {
  articles: MobileTextArticle[]
  notes: MobileTextNote[]
  prompts: MobileTextPrompt[]
}

// ==================== 数字记忆同步类型 ====================

/**
 * 数字-描述关联
 * 第一阶段：仅文字描述（type='text'，imageUrl 留空）
 * 后期：可升级为 image 类型并填充 imageUrl
 *
 * 与桌面端 NumberImageAssociation 同 wire format：
 *   - 桌面端 imageUrl 为空时降级显示 description（待桌面端兼容补丁）
 *   - 移动端拉到桌面端的 image 类型可识别 imageUrl 不渲染（占位），后期升级再渲染
 */
export interface MobileNumberAssociation {
  number: string                  // "0" - "99" / "00" - "09"
  /** 第一阶段固定 'text'；'image' 字段为后期解锁 */
  type: 'text' | 'image'
  /** 文字桩内容（emoji + 描述） */
  description: string
  /** 来源：用户/预设 */
  source: 'user' | 'preset' | 'upload'
  /** 后期升级图片字段，第一阶段留空 */
  imageUrl?: string
  imageSource?: 'base64' | 'local' | 'remote' | 'preset'
}

export interface MobileNumberEntry {
  _id: string
  _rev?: string
  title: string
  numbers: string
  tags: string[]
  description?: string
  createdAt: number
  updatedAt: number
  reviewCount: number
  lastReviewTime?: number
}

export interface MobileNumberNote {
  _id: string
  _rev?: string
  entryId: string
  content: string
  createdAt: number
  updatedAt?: number
}

export interface MobileNumberPrompt {
  _id: string
  _rev?: string
  entryId: string
  title: string
  content: string
  order: number
  enabled: boolean
  createdAt: number
}

export interface MobileNumberMemory {
  associations: MobileNumberAssociation[]
  entries: MobileNumberEntry[]
  notes: MobileNumberNote[]
  prompts: MobileNumberPrompt[]
}

// ==================== 同步包 ====================

export interface MobileSyncData {
  version: number
  exportedAt: number
  platform: string
  banks: MobileSyncBank[]
  userSettings?: MobileUserSettings
  /** 文本记忆数据（第一阶段移动端写入；桌面端读取后写回 store） */
  textMemory?: MobileTextMemory
  /** 数字记忆数据（同上） */
  numberMemory?: MobileNumberMemory
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
  textMemory?: MobileTextMemory
  numberMemory?: MobileNumberMemory
  error?: string
}
