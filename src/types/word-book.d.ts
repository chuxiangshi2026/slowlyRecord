/**
 * 词集：书 → 章 → 页 三级结构
 *
 * - 书：用户汇编的一组学习内容
 * - 章：书里的主题
 * - 页：一个中心导图学习单元；内容字段与学习记录逻辑分离
 */

/** 页内单词排序规则 */
export type WordBookSplitBy = 'order' | 'length' | 'alpha' | 'freq'

/** 学习页中心节点类型 */
export type WordBookKeyType = 'letters' | 'root' | 'prefix' | 'suffix' | 'phonetic' | 'text'

/** 页内单词（生成时的快照，原词库改动不回写） */
export interface WordBookWord {
  /** 本页内稳定条目 ID：复习、编辑和学习记录按它关联，旧数据加载时回填 */
  entryId?: string
  sourceId: string
  text: string
  explains: string
  phonetic?: string
  /** 本页内的个人备注 */
  note?: string
  /** 例句（英文 + 中文） */
  examples?: { english: string; chinese: string }[]
  /** 记忆点/联想 */
  memoryTip?: string
  /** 词频排名（1 = 最常用），来自内置词库 */
  freq?: number
  /** 最近一次在本页被标为「记住了」的时间 */
  rememberedAt?: number
}

/** 学习页的中心（导图根节点） */
export interface WordBookKey {
  type: WordBookKeyType
  value: string
  /** 中心解释，如 root=携带、letters=拼写联想 */
  description?: string
}

/** 生成时的来源信息，用于展示与排障 */
export interface WordBookSource {
  bankId?: string
  bankName?: string
  /** 生成时的词库语言，用于学习页发音 */
  language?: string
  filter?: Record<string, unknown>
}

/** 一轮复习的摘要（只记录本轮，不建立逐词独立 SRS） */
export interface WordBookRoundSummary {
  total: number
  firstTryKnown: number
  retriedCount: number
  firstTryWrongEntryIds: string[]
  finishedAt: number
}

/** 页 = 中心导图学习单元 */
export interface WordBookPage {
  _id: string
  type: 'wb_page'
  bookId: string
  chapterId: string
  name: string
  order: number
  key: WordBookKey
  words: WordBookWord[]
  source: WordBookSource
  /** 页面公共备注；个人学习笔记不进同步与分享 */
  note?: string
  /** 页级间隔复习等级 0-12（与词库 SRS 独立）；首轮完成前不调度 */
  level: number
  nextReviewAt: number
  /** 首次完成一轮复习的时间，只表示完成过一轮 */
  completedAt?: number
  /** 查看模式下手动标记的已读时间，不触发复习 */
  readAt?: number
  /** 内容编辑时间，用于提示新增或更新 */
  contentUpdatedAt?: number
  lastRound?: WordBookRoundSummary
  lastReviewedAt?: number
  lastScore?: number
  bestScore?: number
  ctime: number
  utime: number
}

/** 关卡达成记录（章内每 levelSize 页为一关） */
export interface WordBookChapterLevel {
  index: number
  completedAt: number
}

/** 章 = 主题 */
export interface WordBookChapter {
  _id: string
  type: 'wb_chapter'
  bookId: string
  name: string
  order: number
  /** 多少页算一关 */
  levelSize: number
  /** 已达成关卡 */
  levels: WordBookChapterLevel[]
  ctime: number
  utime: number
}

/** 书 = 学习维度 */
export interface WordBookBook {
  _id: string
  type: 'wb_book'
  name: string
  order: number
  desc?: string
  /** 内置示例：可直接编辑；首次内容修改后归入我的词集 */
  isSample?: boolean
  /** 示例内容版本；升级时只替换仍是示例且版本较旧的书 */
  sampleVersion?: number
  /** 副本来源根词集 ID，用于再次复制时提示已有副本 */
  copiedFromBookId?: string
  ctime: number
  utime: number
}
