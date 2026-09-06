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
  | 'newConcept'
  | 'phrasal-verbs'
  | 'collocations'
  | 'idioms'
  | 'common-phrases'
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
  /** 知识库数据（可选：旧版客户端忽略此字段） */
  knowledgeMemory?: MobileKnowledgeMemory
  /** 音标学习进度（可选：旧版客户端忽略此字段） */
  phoneticMemory?: MobilePhoneticMemory
}

/** 知识库同步数据：已导入清单 + 每包条目进度（与桌面端 SyncKnowledgeMemory 一致） */
export interface MobileKnowledgeMemory {
  importedIds: string[]
  /** packId → items(itemId → 进度) */
  packs: Record<string, Record<string, KnowledgeItemProgress>>
}

/** 音标学习进度同步数据（与桌面端 SyncPhoneticMemory 一致） */
export interface MobilePhoneticMemory {
  phonemes: Record<string, PhonemeProgress>
  pairs: Record<string, MinimalPairProgress>
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
  knowledgeMemory?: MobileKnowledgeMemory
  phoneticMemory?: MobilePhoneticMemory
  error?: string
}

// ==================== 音标记忆 ====================

/** 单个音素的练习进度（与桌面端 src/types/phonetic-memory.d.ts 一致） */
export interface PhonemeProgress {
  /** IPA 符号 */
  ipa: string
  /** 等级 0-12，对应 DEFAULT_INTERVALS；>=7 视为已掌握 */
  level: number
  /** 上次练习时间戳 */
  learnDate: number
  /** 正确次数 */
  correct: number
  /** 错误次数 */
  wrong: number
}

/** 最小对立对的练习进度 */
export interface MinimalPairProgress {
  /** 对子唯一键，格式 `a|b`（按字母排序） */
  pairKey: string
  level: number
  learnDate: number
  correct: number
  wrong: number
}

/** 音标学习进度文档（doc id 与桌面端一致：phonetic_memory_progress） */
export interface PhoneticProgressDoc {
  _id: string
  _rev?: string
  /** 按 IPA 索引的音素进度 */
  phonemes: Record<string, PhonemeProgress>
  /** 按 pairKey 索引的对子进度 */
  pairs: Record<string, MinimalPairProgress>
}

// ==================== 知识库（通用知识包） ====================

/** 知识包中的单个问答对（与桌面端 src/types/knowledge-memory.d.ts 一致） */
export interface KnowledgeItem {
  id: string
  /** 问题/提示（如乘法 2×3、元素符号 H） */
  question: string
  /** 答案（如 6、氢） */
  answer: string
  /** 额外展示字段（如元素序数/拼音） */
  extras?: Record<string, string>
  /** 备选桩名（usableAsPeg 包的可选字段） */
  alternates?: string[]
  /** 有序包中的顺序号（从 1 开始） */
  order?: number
  /** 条目配图：存 emoji 字符 */
  imageUrl?: string
}

/** 知识包元数据 + 条目 */
export interface KnowledgePack {
  id: string
  name: string
  description: string
  /** 是否是有序列表（顺序本身是考点） */
  ordered: boolean
  /** 是否可作为记忆宫殿的桩库 */
  usableAsPeg: boolean
  /** 记忆口诀（可选） */
  mnemonics?: string[]
  items: KnowledgeItem[]
}

/** 知识包分类 */
export type KnowledgePackCategory = 'math' | 'text'

/** 知识包在列表中的轻量信息 */
export interface KnowledgePackInfo {
  id: string
  name: string
  description: string
  itemCount: number
  ordered: boolean
  usableAsPeg: boolean
  category: KnowledgePackCategory
  /** 数据版本号（缺省视为 1），缓存版本不一致自动失效 */
  version?: number
}

/** 单个条目的练习进度 */
export interface KnowledgeItemProgress {
  itemId: string
  /** SRS 等级 0-12 */
  level: number
  /** 上次学习/复习时间戳 */
  learnDate: number
  /** 累计答对次数 */
  correct: number
  /** 累计答错次数 */
  wrong: number
}

/** 每个知识包的进度文档（doc id 与桌面端一致：knowledge_memory_<packId>） */
export interface KnowledgePackProgressDoc {
  _id: string
  _rev?: string
  type: 'knowledge_pack_progress'
  packId: string
  items: Record<string, KnowledgeItemProgress>
}

/** 已导入知识包清单文档（doc id：knowledge_memory_imported） */
export interface KnowledgeImportedDoc {
  _id: string
  _rev?: string
  type: 'knowledge_imported_list'
  ids: string[]
}

/** 练习模式（移动端精简版只用 flip / choice） */
export type KnowledgePracticeMode =
  | 'q2a'
  | 'a2q'
  | 'choice'
  | 'ordered'
  | 'input'
