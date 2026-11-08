/**
 * 词集分享文件（纯数据）：只包含内容与顺序，不包含学习进度、复习时间或本地 ID。
 */
import type { WordBookBook, WordBookChapter, WordBookKeyType, WordBookPage } from '@/types/word-book'

export const WORD_BOOK_SHARE_SCHEMA_VERSION = 1
export const WORD_BOOK_SHARE_TYPE = 'slowlyrecord-word-book'
export const MAX_SHARE_CHAPTERS = 200
export const MAX_SHARE_PAGES = 500
export const MAX_SHARE_WORDS = 5000
export const MAX_SHARE_WORDS_PER_PAGE = 50

const LIMITS = {
  bookName: 80,
  desc: 300,
  chapterName: 80,
  pageName: 80,
  keyValue: 60,
  keyDescription: 120,
  text: 120,
  explains: 500,
  phonetic: 120,
  note: 300,
  exampleEnglish: 300,
  exampleChinese: 300,
  memoryTip: 200,
}

const MAX_EXAMPLES_PER_WORD = 3

export interface WordBookShareWord {
  text: string
  explains: string
  phonetic?: string
  note?: string
  examples?: { english: string; chinese: string }[]
  memoryTip?: string
  freq?: number
}

export interface WordBookSharePage {
  name: string
  order: number
  key: { type: WordBookKeyType; value: string; description?: string }
  note?: string
  words: WordBookShareWord[]
}

export interface WordBookShareChapter {
  name: string
  order: number
  pages: WordBookSharePage[]
}

export interface WordBookShareBook {
  name: string
  desc?: string
  chapters: WordBookShareChapter[]
}

export interface WordBookShareFile {
  schemaVersion: typeof WORD_BOOK_SHARE_SCHEMA_VERSION
  type: typeof WORD_BOOK_SHARE_TYPE
  exportedAt: number
  book: WordBookShareBook
}

const KEY_TYPES = new Set(['letters', 'root', 'prefix', 'suffix', 'phonetic', 'text'])

function cleanString(value: unknown, field: string, max: number, required = true): string {
  const text = String(value ?? '').trim()
  if (required && !text) throw new Error(`${field}不能为空`)
  if (text.length > max) throw new Error(`${field}过长（最多 ${max} 字）`)
  return text
}

function cleanOptionalString(value: unknown, field: string, max: number): string | undefined {
  const text = String(value ?? '').trim()
  if (!text) return undefined
  if (text.length > max) throw new Error(`${field}过长（最多 ${max} 字）`)
  return text
}

function cleanOrder(value: unknown, fallback: number): number {
  const parsed = Math.floor(Number(value))
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function cleanFreq(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) return undefined
  return parsed
}

function cleanExamples(value: unknown, wordText: string): { english: string; chinese: string }[] | undefined {
  if (!Array.isArray(value)) return undefined
  const examples = value.slice(0, MAX_EXAMPLES_PER_WORD).flatMap((item, index) => {
    const english = cleanOptionalString(item?.english, `单词「${wordText}」第 ${index + 1} 条例句`, LIMITS.exampleEnglish)
    if (!english) return []
    const chinese = cleanOptionalString(item?.chinese, `单词「${wordText}」第 ${index + 1} 条例句翻译`, LIMITS.exampleChinese) || ''
    return [{ english, chinese }]
  })
  return examples.length ? examples : undefined
}

/** 从本地词集文档构造分享文件；进度与本地 ID 在此剥离 */
export function buildWordBookShareFile(
  book: WordBookBook,
  chapters: WordBookChapter[],
  pages: WordBookPage[],
  now = Date.now(),
): WordBookShareFile {
  const sortedChapters = [...chapters].sort((a, b) => a.order - b.order || a.ctime - b.ctime)
  const shareChapters = sortedChapters.map((chapter, chapterIndex) => {
    const chapterPages = pages
      .filter(page => page.chapterId === chapter._id)
      .sort((a, b) => a.order - b.order || a.ctime - b.ctime)
    return {
      name: chapter.name,
      order: chapterIndex + 1,
      pages: chapterPages.map((page, pageIndex) => ({
        name: page.name,
        order: pageIndex + 1,
        key: {
          type: page.key.type,
          value: page.key.value,
          ...(page.key.description ? { description: page.key.description } : {}),
        },
        ...(page.note ? { note: page.note } : {}),
        words: page.words.map(word => ({
          text: word.text,
          explains: word.explains,
          ...(word.phonetic ? { phonetic: word.phonetic } : {}),
          ...(word.note ? { note: word.note } : {}),
          ...(word.examples?.length ? {
            examples: word.examples.slice(0, MAX_EXAMPLES_PER_WORD).map(example => ({
              english: example.english,
              chinese: example.chinese,
            })),
          } : {}),
          ...(word.memoryTip ? { memoryTip: word.memoryTip } : {}),
          ...(typeof word.freq === 'number' ? { freq: word.freq } : {}),
        })),
      })),
    }
  })

  return {
    schemaVersion: WORD_BOOK_SHARE_SCHEMA_VERSION,
    type: WORD_BOOK_SHARE_TYPE,
    exportedAt: now,
    book: {
      name: book.name,
      ...(book.desc ? { desc: book.desc } : {}),
      chapters: shareChapters,
    },
  }
}

/** 校验未知 JSON 并返回干净的内容副本；不写入任何数据 */
export function parseWordBookShareData(raw: unknown): WordBookShareBook {
  const file = raw as Partial<WordBookShareFile>
  if (!file || typeof file !== 'object') throw new Error('文件不是有效的 JSON 对象')
  if (file.schemaVersion !== WORD_BOOK_SHARE_SCHEMA_VERSION) throw new Error('不支持的词集文件版本')
  if (file.type !== WORD_BOOK_SHARE_TYPE) throw new Error('不是 slowlyRecord 词集文件')

  const sourceBook = file.book as Partial<WordBookShareBook>
  if (!sourceBook || typeof sourceBook !== 'object') throw new Error('词集内容缺失')
  if (!Array.isArray(sourceBook.chapters)) throw new Error('词集章节格式无效')
  const sourceChapters = sourceBook.chapters
  if (sourceChapters.length > MAX_SHARE_CHAPTERS) throw new Error(`章节过多（最多 ${MAX_SHARE_CHAPTERS} 个）`)

  let pageCount = 0
  let wordCount = 0
  const chapters = sourceChapters.map((chapter, chapterIndex) => {
    if (!Array.isArray(chapter.pages)) throw new Error(`章节「${chapter.name || chapterIndex + 1}」的学习页格式无效`)
    const sourcePages = chapter.pages
    pageCount += sourcePages.length
    if (pageCount > MAX_SHARE_PAGES) throw new Error(`学习页过多（最多 ${MAX_SHARE_PAGES} 页）`)

    return {
      name: cleanString(chapter.name, `第 ${chapterIndex + 1} 章名称`, LIMITS.chapterName),
      order: cleanOrder(chapter.order, chapterIndex + 1),
      pages: sourcePages.map((page, pageIndex) => {
        if (!page.key || !KEY_TYPES.has(String(page.key.type))) throw new Error(`「${page.name || pageIndex + 1}」的中心类型无效`)
        if (!Array.isArray(page.words)) throw new Error(`学习页「${page.name || pageIndex + 1}」的单词格式无效`)
        const sourceWords = page.words
        if (sourceWords.length > MAX_SHARE_WORDS_PER_PAGE) throw new Error(`学习页「${page.name || pageIndex + 1}」单词过多（最多 ${MAX_SHARE_WORDS_PER_PAGE} 个）`)
        wordCount += sourceWords.length
        if (wordCount > MAX_SHARE_WORDS) throw new Error(`单词过多（最多 ${MAX_SHARE_WORDS} 个）`)

        return {
          name: cleanString(page.name, `第 ${pageIndex + 1} 页名称`, LIMITS.pageName),
          order: cleanOrder(page.order, pageIndex + 1),
          key: {
            type: String(page.key.type) as WordBookKeyType,
            value: cleanString(page.key.value, '中心文本', LIMITS.keyValue, false),
            description: cleanOptionalString(page.key.description, '中心解释', LIMITS.keyDescription),
          },
          note: cleanOptionalString(page.note, '页面备注', LIMITS.note),
          words: sourceWords.map(word => ({
            text: cleanString(word.text, '单词', LIMITS.text),
            explains: cleanString(word.explains, `单词「${word.text}」的释义`, LIMITS.explains, false),
            phonetic: cleanOptionalString(word.phonetic, '音标', LIMITS.phonetic),
            note: cleanOptionalString(word.note, '词条备注', LIMITS.note),
            examples: cleanExamples(word.examples, word.text),
            memoryTip: cleanOptionalString(word.memoryTip, '记忆点', LIMITS.memoryTip),
            freq: cleanFreq(word.freq),
          })),
        }
      }),
    }
  })

  const book: WordBookShareBook = {
    name: cleanString(sourceBook.name, '词集名称', LIMITS.bookName),
    desc: cleanOptionalString(sourceBook.desc, '词集简介', LIMITS.desc),
    chapters,
  }
  validateShareBook(book)
  return book
}

export function validateShareBook(book: WordBookShareBook): void {
  let pages = 0
  let words = 0
  for (const chapter of book.chapters) {
    pages += chapter.pages.length
    for (const page of chapter.pages) words += page.words.length
  }
  if (pages > MAX_SHARE_PAGES) throw new Error(`学习页过多（最多 ${MAX_SHARE_PAGES} 页）`)
  if (words > MAX_SHARE_WORDS) throw new Error(`单词过多（最多 ${MAX_SHARE_WORDS} 个）`)
}

export function wordBookShareFileName(book: WordBookShareBook): string {
  const safeName = book.name.replace(/[\\/:*?"<>|\s]+/g, '-').replace(/^-+|-+$/g, '') || 'word-book'
  return `slowlyrecord-词集-${safeName}.json`
}
