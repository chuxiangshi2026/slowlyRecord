import { describe, expect, it } from 'vitest'
import {
  MAX_SHARE_WORDS_PER_PAGE,
  buildWordBookShareFile,
  parseWordBookShareData,
  wordBookShareFileName,
} from './word-book-share'
import type { WordBookBook, WordBookChapter, WordBookPage } from '@/types/word-book'

const book: WordBookBook = {
  _id: 'book_1', type: 'wb_book', name: '四级构词', order: 1, desc: '示例', isSample: true, ctime: 1, utime: 2,
}
const chapters: WordBookChapter[] = [
  { _id: 'chapter_1', type: 'wb_chapter', bookId: 'book_1', name: '字母组合 old', order: 2, levelSize: 5, levels: [], ctime: 3, utime: 4 },
]
const pages: WordBookPage[] = [
  {
    _id: 'page_1', type: 'wb_page', bookId: 'book_1', chapterId: 'chapter_1', name: 'old 篇', order: 3,
    key: { type: 'letters', value: 'old', description: '拼写联想' },
    words: [{
      entryId: 'local-entry', sourceId: 'source-1', text: 'fold', explains: '折叠', phonetic: '/fəʊld/', note: '词条备注',
      examples: [{ english: 'Please fold the paper.', chinese: '请把纸折起来。' }], memoryTip: 'fold = 折叠', freq: 100,
    }],
    source: {}, note: '页面备注', level: 2, nextReviewAt: 999999, completedAt: 123,
    lastRound: { total: 1, firstTryKnown: 0, retriedCount: 1, firstTryWrongEntryIds: ['local-entry'], finishedAt: 456 },
    lastReviewedAt: 789, readAt: 111, contentUpdatedAt: 222, lastScore: 0, bestScore: 100, ctime: 5, utime: 6,
  },
]

describe('word-book-share（词集分享文件）', () => {
  it('导出只包含内容与顺序，剥离学习进度和本地 ID', () => {
    const file = buildWordBookShareFile(book, chapters, pages, 12345)
    expect(file.schemaVersion).toBe(1)
    expect(file.type).toBe('slowlyrecord-word-book')
    expect(file.exportedAt).toBe(12345)
    expect(JSON.stringify(file)).not.toContain('local-entry')
    expect(JSON.stringify(file)).not.toContain('source-1')
    expect(JSON.stringify(file)).not.toContain('nextReviewAt')
    expect(JSON.stringify(file)).not.toContain('lastRound')

    const page = file.book.chapters[0].pages[0]
    expect(page.name).toBe('old 篇')
    expect(page.order).toBe(1)
    expect(page.key).toEqual({ type: 'letters', value: 'old', description: '拼写联想' })
    expect(page.note).toBe('页面备注')
    expect(page.words[0]).toEqual({
      text: 'fold', explains: '折叠', phonetic: '/fəʊld/', note: '词条备注',
      examples: [{ english: 'Please fold the paper.', chinese: '请把纸折起来。' }], memoryTip: 'fold = 折叠', freq: 100,
    })
  })

  it('解析合法文件并清理空白，保留内容副本', () => {
    const file = buildWordBookShareFile(book, chapters, pages)
    const parsed = parseWordBookShareData(JSON.parse(JSON.stringify(file)))
    expect(parsed.name).toBe('四级构词')
    expect(parsed.chapters).toHaveLength(1)
    expect(parsed.chapters[0].pages[0].words[0].text).toBe('fold')
    expect(parsed.chapters[0].pages[0].words[0].examples?.[0]?.english).toBe('Please fold the paper.')
    expect(parsed.chapters[0].pages[0].words[0].memoryTip).toBe('fold = 折叠')
  })

  it('拒绝错误类型、未知版本、缺失数组、超 limit 与过长内容', () => {
    const valid = buildWordBookShareFile(book, chapters, pages)
    expect(() => parseWordBookShareData(null)).toThrow('有效的 JSON 对象')
    expect(() => parseWordBookShareData({ ...valid, type: 'other' })).toThrow('不是 slowlyRecord 词集文件')
    expect(() => parseWordBookShareData({ ...valid, schemaVersion: 2 })).toThrow('不支持的词集文件版本')
    expect(() => parseWordBookShareData({ ...valid, book: { name: '缺字段' } })).toThrow('章节格式无效')

    const missingWords = { ...valid, book: { ...valid.book, chapters: [{ name: '章', pages: [{ name: '页', key: { type: 'text', value: '' } }] }] } }
    expect(() => parseWordBookShareData(missingWords)).toThrow('单词格式无效')

    const tooManyWords = Array.from({ length: MAX_SHARE_WORDS_PER_PAGE + 1 }, (_, i) => ({ text: `w${i}`, explains: 'x' }))
    const oversized = {
      ...valid,
      book: {
        ...valid.book,
        chapters: [{ name: '章', pages: [{ name: '页', key: { type: 'text', value: '' }, words: tooManyWords }] }],
      },
    }
    expect(() => parseWordBookShareData(oversized)).toThrow('单词过多')
  })

  it('支持当前编辑器允许的空白书、空章节和空白学习页', () => {
    const blankBook = { schemaVersion: 1, type: 'slowlyrecord-word-book', book: { name: '空白书', chapters: [] } }
    expect(parseWordBookShareData(blankBook).chapters).toEqual([])

    const blankChapter = { schemaVersion: 1, type: 'slowlyrecord-word-book', book: { name: '空章书', chapters: [{ name: '空章', pages: [] }] } }
    expect(parseWordBookShareData(blankChapter).chapters[0].pages).toEqual([])

    const blankPage = {
      schemaVersion: 1,
      type: 'slowlyrecord-word-book',
      book: { name: '空页书', chapters: [{ name: '章', pages: [{ name: '空页', key: { type: 'text', value: '' }, words: [] }] }] },
    }
    expect(parseWordBookShareData(blankPage).chapters[0].pages[0].words).toEqual([])
  })

  it('生成安全文件名', () => {
    expect(wordBookShareFileName({ name: '四级 / 构词?', chapters: [] })).toBe('slowlyrecord-词集-四级-构词.json')
    expect(wordBookShareFileName({ name: '   ', chapters: [] })).toBe('slowlyrecord-词集-word-book.json')
  })
})
