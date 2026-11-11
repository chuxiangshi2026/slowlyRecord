/**
 * 词集纯逻辑：分页、命名、布局辅助、调度。
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

/** 中心节点：优先构词/音标；纯字母 pattern 归为拼写联想；其余退化为文本 */
export function resolveWordBookKey(filter: WordBookFilterLike | undefined): WordBookKey {
  const affixType = (filter?.affixType || '').trim()
  const affixText = (filter?.affixText || '').trim()
  if (affixText || affixType) {
    const type = affixType === 'prefix' ? 'prefix' : affixType === 'suffix' ? 'suffix' : 'root'
    return { type, value: affixText || (type === 'prefix' ? '前缀' : type === 'suffix' ? '后缀' : '词根') }
  }
  const phonetic = (filter?.phonetic || '').trim()
  if (phonetic) return { type: 'phonetic', value: phonetic }
  const pattern = (filter?.pattern || '').trim()
  if (/^[a-zA-Z]{2,}$/.test(pattern)) return { type: 'letters', value: pattern.toLowerCase() }
  return { type: 'text', value: '' }
}

export const WORD_BOOK_KEY_TYPE_LABEL: Record<WordBookKey['type'], string> = {
  letters: '字母组合',
  root: '词根',
  prefix: '前缀',
  suffix: '后缀',
  phonetic: '音标',
  text: '主题',
}

/** 书默认名：`四级词汇 · 词根` */
export function getDefaultBookName(bankName: string | undefined, key: WordBookKey): string {
  const bank = (bankName || '我的词库').trim()
  return `${bank} · ${WORD_BOOK_KEY_TYPE_LABEL[key.type]}`
}

/** 章默认名：`词根 old`（没有中心词时用序号） */
export function getDefaultChapterName(key: WordBookKey, index = 1): string {
  if (key.value) return `${WORD_BOOK_KEY_TYPE_LABEL[key.type]} ${key.value}`
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

export function toWordBookWord(word: { entryId?: string; _id?: string; id?: string; text?: string; word?: string; explains?: string; meaning?: string; phonetic?: string; note?: string; examples?: { english: string; chinese: string }[]; memoryTip?: string; freq?: number }): WordBookWord {
  return {
    entryId: word.entryId || createWordBookId(`${WORD_BOOK_DB_PREFIX}entry_`),
    sourceId: String(word._id || word.id || ''),
    text: String(word.text || word.word || '').trim(),
    explains: String(word.explains ?? word.meaning ?? ''),
    ...(word.phonetic ? { phonetic: word.phonetic } : {}),
    ...(word.note ? { note: word.note } : {}),
    ...(word.examples?.length ? { examples: word.examples.map(item => ({ ...item })) } : {}),
    ...(word.memoryTip ? { memoryTip: word.memoryTip } : {}),
    ...(typeof word.freq === 'number' ? { freq: word.freq } : {}),
  }
}

function entryKeyOf(text: string): string {
  return String(text || '').toLowerCase().replace(/[^a-z0-9]/g, '') || 'word'
}

/** 为旧页面确定性回填条目 ID；重复或缺失 ID 不依赖随机数，避免多端迁移漂移 */
export function ensureWordBookEntryIds(page: WordBookPage): { page: WordBookPage; changed: boolean } {
  const used = new Set<string>()
  let changed = false
  const words = page.words.map((word, index) => {
    let entryId = word.entryId
    if (!entryId || used.has(entryId)) {
      const base = `${page._id}_entry_${index}_${entryKeyOf(word.text)}`
      entryId = base
      let suffix = 2
      while (used.has(entryId)) {
        entryId = `${base}_${suffix++}`
      }
      changed = true
    }
    used.add(entryId)
    return entryId === word.entryId ? word : { ...word, entryId }
  })
  return { page: changed ? { ...page, words } : page, changed }
}

/** 自定义页名：单页直接使用，多页追加序号 */
export function buildPageNameFromBase(baseName: string, pageIndex: number, totalPages: number): string {
  const base = baseName.trim()
  if (!base) return `第 ${pageIndex} 页`
  return totalPages <= 1 ? base : `${base} ${pageIndex}`
}

export interface BuildPageOptions {
  bookId: string
  chapterId: string
  name: string
  order: number
  key: WordBookKey
  source: WordBookSource
  words: WordBookWord[]
  note?: string
  now?: number
}

/** 构造一页；首轮复习完成前不安排复习 */
export function buildWordBookPage(options: BuildPageOptions): WordBookPage {
  const now = options.now ?? Date.now()
  const _id = createWordBookId(WORD_BOOK_PAGE_PREFIX)
  return {
    _id,
    type: 'wb_page',
    bookId: options.bookId,
    chapterId: options.chapterId,
    name: options.name.trim(),
    order: options.order,
    key: options.key,
    words: options.words.map((word, index) => ({
      ...word,
      entryId: word.entryId || `${_id}_entry_${index}_${entryKeyOf(word.text)}`,
    })),
    source: options.source,
    ...(options.note ? { note: options.note } : {}),
    level: 0,
    nextReviewAt: 0,
    contentUpdatedAt: now,
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

/** 一轮复习后的页级调度：无错升级；有错不降级，尽早重现 */
export function schedulePageReview(
  page: Pick<WordBookPage, 'level' | 'completedAt' | 'bestScore' | 'words'>,
  wrongAttempts: number,
  now = Date.now(),
): PageReviewResult {
  const hasWrong = wrongAttempts > 0
  const level = hasWrong
    ? (page.level || 0)
    : Math.min(MAX_LEVEL, (page.level || 0) + 1)
  const intervalMinutes = hasWrong
    ? Math.min(DEFAULT_INTERVALS[level] ?? DEFAULT_INTERVALS[0], 24 * 60)
    : (DEFAULT_INTERVALS[level] ?? DEFAULT_INTERVALS[0])
  const total = Math.max(1, page.words?.length ?? 0)
  const known = Math.max(0, total - Math.min(total, Math.max(0, wrongAttempts)))
  const score = Math.round((known / total) * 100)
  return {
    level,
    nextReviewAt: now + intervalMinutes * 60_000,
    completedAt: page.completedAt ?? now,
    lastReviewedAt: now,
    lastScore: score,
    bestScore: Math.max(page.bestScore ?? 0, score),
  }
}

export function hasPageReviewStarted(page: Pick<WordBookPage, 'completedAt' | 'lastRound'>): boolean {
  return !!page.completedAt || !!page.lastRound?.finishedAt
}

export function isPageDue(page: Pick<WordBookPage, 'nextReviewAt' | 'completedAt' | 'lastRound'>, now = Date.now()): boolean {
  return hasPageReviewStarted(page) && (page.nextReviewAt || 0) <= now
}

export function getWordBookPageActivityAt(page: WordBookPage): number {
  return Math.max(
    page.readAt || 0,
    page.lastReviewedAt || 0,
    page.lastRound?.finishedAt || 0,
    page.contentUpdatedAt || 0,
    page.ctime || 0,
  )
}

/** 内容编辑晚于最近一次阅读或复习时才提示更新；新页面仍属于未学习 */
export function hasPageContentUpdate(
  page: Pick<WordBookPage, 'contentUpdatedAt' | 'readAt' | 'lastReviewedAt' | 'lastRound' | 'completedAt'>,
): boolean {
  const learnedAt = Math.max(
    page.readAt || 0,
    page.lastReviewedAt || 0,
    page.lastRound?.finishedAt || 0,
    page.completedAt || 0,
  )
  return learnedAt > 0 && (page.contentUpdatedAt || 0) > learnedAt
}

export function buildWordBookChapterDirectory(
  chapters: Array<Pick<WordBookChapter, '_id' | 'name'>>,
  pages: Array<Pick<WordBookPage, '_id' | 'name' | 'chapterId' | 'order' | 'words'>>,
) {
  const sortedChapters = [...chapters].sort((a, b) => a.name.trim().localeCompare(b.name.trim(), 'zh-CN', { sensitivity: 'base', numeric: true }))
  const names = sortedChapters.map(chapter => chapter.name.trim().toLowerCase())
  const duplicateNames = new Set(names.filter((name, index) => names.indexOf(name) !== index))
  return sortedChapters.map((chapter, index) => {
    const chapterPages = pages
      .filter(page => page.chapterId === chapter._id)
      .sort((a, b) => a.order - b.order || a._id.localeCompare(b._id))
    return {
      chapter,
      pages: chapterPages,
      pageCount: chapterPages.length,
      wordCount: chapterPages.reduce((count, page) => count + page.words.length, 0),
      hasSameName: duplicateNames.has(names[index]),
    }
  })
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

export function createWordBookBook(name: string, order = 0, now = Date.now(), extra: Partial<Pick<WordBookBook, 'desc' | 'isSample' | 'sampleVersion' | 'copiedFromBookId'>> = {}): WordBookBook {
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
