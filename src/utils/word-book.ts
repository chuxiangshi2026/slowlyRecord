/**
 * 词图闯关纯逻辑：分页、命名、调度、关卡。
 * 不碰数据库与 UI，方便单测；桌面与移动端各有一份同口径实现。
 */
import { DEFAULT_INTERVALS } from '@/constants'
import { MAX_LEVEL } from '@/utils/srs'
import type {
  WordBookBook,
  WordBookChapter,
  WordBookChapterLevel,
  WordBookKey,
  WordBookPage,
  WordBookSource,
  WordBookSplitBy,
  WordBookWord,
} from '@/types/word-book'

/** 默认每页词数（受记忆页节点数限制，上限 MAX_WORD_BOOK_PAGE_SIZE） */
export const WORD_BOOK_PAGE_SIZE = 12
export const MAX_WORD_BOOK_PAGE_SIZE = 20
/** 默认多少页算一关 */
export const WORD_BOOK_LEVEL_SIZE = 5
/** 数据库前缀（三种文档分开存，增删改只动一条） */
export const WORD_BOOK_DB_PREFIX = 'wb_'
export const WORD_BOOK_BOOK_PREFIX = `${WORD_BOOK_DB_PREFIX}book_`
export const WORD_BOOK_CHAPTER_PREFIX = `${WORD_BOOK_DB_PREFIX}chapter_`
export const WORD_BOOK_PAGE_PREFIX = `${WORD_BOOK_DB_PREFIX}page_`

export function createWordBookId(prefix: string): string {
  return `${prefix}${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

/** 筛选状态里与词图相关的字段（与 WordFilter 的 FilterState 兼容的子集） */
export interface WordBookFilterLike {
  pattern?: string
  affixType?: string
  affixText?: string
  phonetic?: string
  itemType?: string
  sortBy?: string
}

/** 中心节点：从筛选条件推导（词根/词缀/音标）；都没有就退化成文本 */
export function resolveWordBookKey(filter: WordBookFilterLike | undefined): WordBookKey {
  const affixType = (filter?.affixType || '').trim()
  const affixText = (filter?.affixText || '').trim()
  if (affixText || affixType) {
    const type = affixType === 'prefix' ? 'prefix' : affixType === 'suffix' ? 'suffix' : 'root'
    return { type, value: affixText || (type === 'prefix' ? '前缀' : type === 'suffix' ? '后缀' : '词根') }
  }
  const phonetic = (filter?.phonetic || '').trim()
  if (phonetic) return { type: 'phonetic', value: phonetic }
  return { type: 'text', value: '' }
}

const KEY_TYPE_LABEL: Record<WordBookKey['type'], string> = {
  root: '词根',
  prefix: '前缀',
  suffix: '后缀',
  phonetic: '音标',
  text: '主题',
}

/** 书默认名：`四级词汇 · 词根` */
export function getDefaultBookName(bankName: string | undefined, key: WordBookKey): string {
  const bank = (bankName || '我的词库').trim()
  return `${bank} · ${KEY_TYPE_LABEL[key.type]}`
}

/** 章默认名：`词根 old`（没有中心词时用序号） */
export function getDefaultChapterName(key: WordBookKey, index = 1): string {
  if (key.value) return `${KEY_TYPE_LABEL[key.type]} ${key.value}`
  return `第 ${index} 章`
}

/** 页默认名：单页 `old 篇`，多页 `old 篇 ①` */
export function getDefaultPageName(key: WordBookKey, pageIndex: number, totalPages: number): string {
  if (!key.value) return `第 ${pageIndex} 页`
  return totalPages <= 1 ? `${key.value} 篇` : `${key.value} 篇 ${pageIndex}`
}

export function normalizePageSize(size: number | undefined): number {
  const parsed = Number(size)
  const value = Number.isFinite(parsed) && size !== undefined && size !== null ? Math.floor(parsed) : WORD_BOOK_PAGE_SIZE
  return Math.min(MAX_WORD_BOOK_PAGE_SIZE, Math.max(1, value))
}

export function normalizeLevelSize(size: number | undefined): number {
  const parsed = Number(size)
  const value = Number.isFinite(parsed) && size !== undefined && size !== null ? Math.floor(parsed) : WORD_BOOK_LEVEL_SIZE
  return Math.min(50, Math.max(1, value))
}

/** 按指定规则排序后按页大小切块 */
export function splitWordsIntoPages<T extends { text: string; freq?: number }>(
  words: T[],
  pageSize = WORD_BOOK_PAGE_SIZE,
  splitBy: WordBookSplitBy = 'order',
): T[][] {
  const size = normalizePageSize(pageSize)
  const sorted = [...words]
  switch (splitBy) {
    case 'length':
      sorted.sort((a, b) => a.text.length - b.text.length || a.text.localeCompare(b.text))
      break
    case 'alpha':
      sorted.sort((a, b) => a.text.localeCompare(b.text))
      break
    case 'freq': {
      const rank = (w: T) => (typeof w.freq === 'number' ? w.freq : Number.MAX_SAFE_INTEGER)
      sorted.sort((a, b) => rank(a) - rank(b))
      break
    }
    default:
      break
  }
  const chunks: T[][] = []
  for (let i = 0; i < sorted.length; i += size) chunks.push(sorted.slice(i, i + size))
  return chunks
}

export function toWordBookWord(word: { _id?: string; id?: string; text?: string; word?: string; explains?: string; meaning?: string; phonetic?: string; freq?: number }): WordBookWord {
  return {
    sourceId: String(word._id || word.id || ''),
    text: String(word.text || word.word || '').trim(),
    explains: String(word.explains ?? word.meaning ?? ''),
    ...(word.phonetic ? { phonetic: word.phonetic } : {}),
    ...(typeof word.freq === 'number' ? { freq: word.freq } : {}),
  }
}

export interface BuildPageOptions {
  bookId: string
  chapterId: string
  name: string
  order: number
  key: WordBookKey
  source: WordBookSource
  words: WordBookWord[]
  now?: number
}

/** 构造一页（首轮调度从现在 + 1 级间隔开始） */
export function buildWordBookPage(options: BuildPageOptions): WordBookPage {
  const now = options.now ?? Date.now()
  const level = 0
  return {
    _id: createWordBookId(WORD_BOOK_PAGE_PREFIX),
    type: 'wb_page',
    bookId: options.bookId,
    chapterId: options.chapterId,
    name: options.name.trim(),
    order: options.order,
    key: options.key,
    words: options.words.map(word => ({ ...word })),
    source: options.source,
    level,
    nextReviewAt: now + DEFAULT_INTERVALS[level] * 60_000,
    ctime: now,
    utime: now,
  }
}

export interface PageReviewResult {
  level: number
  nextReviewAt: number
  completedAt?: number
  lastReviewedAt: number
  lastScore: number
  bestScore: number
}

/** 一轮结束后的页级调度：全对升级，答错降级（与词库 SRS 相互独立） */
export function schedulePageReview(
  page: Pick<WordBookPage, 'level' | 'completedAt' | 'bestScore' | 'words'>,
  wrongAttempts: number,
  now = Date.now(),
): PageReviewResult {
  const passed = wrongAttempts <= 0
  const level = passed
    ? Math.min(MAX_LEVEL, (page.level || 0) + 1)
    : Math.max(0, (page.level || 0) - 4)
  const intervalMinutes = DEFAULT_INTERVALS[level] ?? DEFAULT_INTERVALS[0]
  const total = Math.max(1, page.words?.length ?? 0)
  const score = Math.round((total / (total + Math.max(0, wrongAttempts))) * 100)
  return {
    level,
    nextReviewAt: now + intervalMinutes * 60_000,
    completedAt: page.completedAt ?? (passed ? now : undefined),
    lastReviewedAt: now,
    lastScore: score,
    bestScore: Math.max(page.bestScore ?? 0, score),
  }
}

export function isPageDue(page: Pick<WordBookPage, 'nextReviewAt'>, now = Date.now()): boolean {
  return (page.nextReviewAt || 0) <= now
}

/** 章内按关卡分组：每 levelSize 页一关 */
export function groupPagesIntoLevels(
  pages: WordBookPage[],
  levelSize = WORD_BOOK_LEVEL_SIZE,
): Array<{ index: number; pages: WordBookPage[]; completed: boolean }> {
  const size = normalizeLevelSize(levelSize)
  const sorted = [...pages].sort((a, b) => a.order - b.order)
  const groups: Array<{ index: number; pages: WordBookPage[]; completed: boolean }> = []
  for (let i = 0; i < sorted.length; i += size) {
    const groupPages = sorted.slice(i, i + size)
    groups.push({
      index: groups.length + 1,
      pages: groupPages,
      completed: groupPages.every(page => !!page.completedAt),
    })
  }
  return groups
}

/** 依据当前页完成情况计算应记录的关卡达成（只增不减，避免撤销） */
export function syncChapterLevels(
  chapter: Pick<WordBookChapter, 'levelSize' | 'levels'>,
  pages: WordBookPage[],
  now = Date.now(),
): WordBookChapterLevel[] {
  const existing = new Map((chapter.levels || []).map(level => [level.index, level]))
  for (const group of groupPagesIntoLevels(pages, chapter.levelSize)) {
    if (group.completed && !existing.has(group.index)) {
      existing.set(group.index, { index: group.index, completedAt: now })
    }
  }
  return [...existing.values()].sort((a, b) => a.index - b.index)
}

/** 「3 天后 / 今天到期」这类提示文案 */
export function formatDueLabel(nextReviewAt: number, now = Date.now()): string {
  if (!nextReviewAt) return '未安排复习'
  const diff = nextReviewAt - now
  if (diff <= 0) return '今天到期'
  const minutes = Math.ceil(diff / 60_000)
  if (minutes < 60) return `${minutes} 分钟后复习`
  const hours = Math.ceil(minutes / 60)
  if (hours < 24) return `${hours} 小时后复习`
  return `${Math.ceil(hours / 24)} 天后复习`
}

/** 当前词库 + 筛选条件生成的来源信息 */
export function buildWordBookSource(bankId: string | undefined, bankName: string | undefined, filter: WordBookFilterLike | undefined): WordBookSource {
  const cleaned: Record<string, unknown> = {}
  if (filter) {
    for (const [key, value] of Object.entries(filter)) {
      if (value !== '' && value !== undefined && value !== null && value !== 'all') cleaned[key] = value
    }
  }
  return { bankId, bankName, filter: cleaned }
}

export function createWordBookBook(name: string, order = 0, now = Date.now(), extra: Partial<Pick<WordBookBook, 'desc' | 'isSample'>> = {}): WordBookBook {
  return {
    _id: createWordBookId(`${WORD_BOOK_DB_PREFIX}book_`),
    type: 'wb_book',
    name: name.trim(),
    order,
    ...extra,
    ctime: now,
    utime: now,
  }
}

export function createWordBookChapter(bookId: string, name: string, order = 0, now = Date.now()): WordBookChapter {
  return {
    _id: createWordBookId(`${WORD_BOOK_DB_PREFIX}chapter_`),
    type: 'wb_chapter',
    bookId,
    name: name.trim(),
    order,
    levelSize: WORD_BOOK_LEVEL_SIZE,
    levels: [],
    ctime: now,
    utime: now,
  }
}
