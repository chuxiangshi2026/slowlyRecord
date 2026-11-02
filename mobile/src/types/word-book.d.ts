/**
 * 词图闯关：书 → 章 → 页 三级结构
 *
 * - 书：一个学习维度（词根 / 发音 / 日期 / 自定义）
 * - 章：书里的主题（一个词根、一个音标），章上记录关卡达成情况
 * - 页：一个记忆单元（中心词 + 一组同源词），自带间隔复习进度
 */

/** 页内单词排序规则 */
export type WordBookSplitBy = 'order' | 'length' | 'alpha' | 'freq'

/** 记忆页中心节点类型 */
export type WordBookKeyType = 'root' | 'prefix' | 'suffix' | 'phonetic' | 'text'

/** 页内单词（生成时的快照，原词库改动不回写） */
export interface WordBookWord {
  sourceId: string
  text: string
  explains: string
  phonetic?: string
  /** 词频排名（1 = 最常用），来自内置词库 */
  freq?: number
  /** 最近一次在本页被标为「记住了」的时间 */
  rememberedAt?: number
}

/** 记忆页的中心（思维导图根节点） */
export interface WordBookKey {
  type: WordBookKeyType
  value: string
}

/** 生成时的来源信息，用于展示与排障 */
export interface WordBookSource {
  bankId?: string
  bankName?: string
  filter?: Record<string, unknown>
}

/** 页 = 记忆单元 */
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
  /** 页级间隔复习等级 0-12（与词库 SRS 独立） */
  level: number
  nextReviewAt: number
  /** 首次一轮全记住的时间（关卡达成判定用） */
  completedAt?: number
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
  /** 内置示例书：可删，删后不再播种 */
  isSample?: boolean
  ctime: number
  utime: number
}
