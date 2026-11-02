import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const db = vi.hoisted(() => ({
  books: [] as any[],
  chapters: [] as any[],
  pages: [] as any[],
  okay: { ok: true } as any,
}))

vi.mock('@/utils/word-book-db', () => ({
  getAllBooks: vi.fn(async () => db.books),
  getAllChapters: vi.fn(async () => db.chapters),
  getAllPages: vi.fn(async () => db.pages),
  saveBook: vi.fn(async (doc: any) => { db.books = [...db.books.filter(b => b._id !== doc._id), doc]; return db.okay }),
  saveChapter: vi.fn(async (doc: any) => { db.chapters = [...db.chapters.filter(c => c._id !== doc._id), doc]; return db.okay }),
  savePage: vi.fn(async (doc: any) => { db.pages = [...db.pages.filter(p => p._id !== doc._id), doc]; return db.okay }),
  removeBookCascade: vi.fn(async (id: string) => {
    db.books = db.books.filter(b => b._id !== id)
    db.chapters = db.chapters.filter(c => c.bookId !== id)
    db.pages = db.pages.filter(p => p.bookId !== id)
    return { ok: true, chapters: 1, pages: 1 }
  }),
  removeChapterCascade: vi.fn(async (id: string) => {
    db.chapters = db.chapters.filter(c => c._id !== id)
    db.pages = db.pages.filter(p => p.chapterId !== id)
    return { ok: true, pages: 1 }
  }),
  removePage: vi.fn(async (id: string) => {
    db.pages = db.pages.filter(p => p._id !== id)
    return { ok: true }
  }),
}))

import { useWordBookStore } from './wordBook'

const words = ['fold', 'bold', 'hold'].map((text, i) => ({
  sourceId: `s${i}`, text, explains: text,
}))

describe('wordBook store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    db.books = []
    db.chapters = []
    db.pages = []
    db.okay = { ok: true }
  })

  it('新建书 → 章 → 页，页序号自增', async () => {
    const store = useWordBookStore()
    const book = await store.createBook('四级词根')
    expect(book.name).toBe('四级词根')

    const chapter = await store.createChapter(book._id, '词根 old')
    expect(store.chaptersOf(book._id)).toHaveLength(1)

    const first = await store.createPage({
      bookId: book._id, chapterId: chapter._id, name: 'old 篇',
      key: { type: 'root', value: 'old' }, words, source: {},
    })
    const second = await store.createPage({
      bookId: book._id, chapterId: chapter._id, name: 'old 篇 2',
      key: { type: 'root', value: 'old' }, words, source: {},
    })

    expect(first.order).toBe(1)
    expect(second.order).toBe(2)
    expect(store.pagesOf(chapter._id)).toHaveLength(2)
  })

  it('同一章内可检出相同中心的页（用于生成时提示）', async () => {
    const store = useWordBookStore()
    const book = await store.createBook('书')
    const chapter = await store.createChapter(book._id, '章')
    await store.createPage({
      bookId: book._id, chapterId: chapter._id, name: 'old 篇',
      key: { type: 'root', value: 'old' }, words, source: {},
    })

    expect(store.findPageByKey(chapter._id, { type: 'root', value: 'old' })).toBeTruthy()
    expect(store.findPageByKey(chapter._id, { type: 'root', value: 'spect' })).toBeUndefined()
  })

  it('完成一页会更新页级调度并记录关卡达成', async () => {
    const store = useWordBookStore()
    const book = await store.createBook('书')
    const chapter = await store.createChapter(book._id, '章')
    await store.setChapterLevelSize(chapter._id, 1)

    const page = await store.createPage({
      bookId: book._id, chapterId: chapter._id, name: 'old 篇',
      key: { type: 'root', value: 'old' }, words, source: {},
    })

    const result = await store.completePage(page._id, 0)
    expect(result.ok).toBe(true)

    const saved = store.getPage(page._id)!
    expect(saved.level).toBe(1)
    expect(saved.completedAt).toBeGreaterThan(0)
    expect(saved.nextReviewAt).toBeGreaterThan(saved.completedAt!)

    const savedChapter = store.getChapter(chapter._id)!
    expect(savedChapter.levels).toHaveLength(1)
    expect(savedChapter.levels[0].index).toBe(1)
  })

  it('删除书会级联清掉章与页', async () => {
    const store = useWordBookStore()
    const book = await store.createBook('书')
    const chapter = await store.createChapter(book._id, '章')
    await store.createPage({
      bookId: book._id, chapterId: chapter._id, name: 'old 篇',
      key: { type: 'root', value: 'old' }, words, source: {},
    })

    const result = await store.deleteBook(book._id)
    expect(result.ok).toBe(true)
    expect(store.sortedBooks).toHaveLength(0)
    expect(store.chaptersOf(book._id)).toHaveLength(0)
    expect(store.pages).toHaveLength(0)
  })

  it('到期页按时间升序汇总', async () => {
    const store = useWordBookStore()
    const book = await store.createBook('书')
    const chapter = await store.createChapter(book._id, '章')
    const a = await store.createPage({
      bookId: book._id, chapterId: chapter._id, name: 'A',
      key: { type: 'root', value: 'a' }, words, source: {},
    })
    const b = await store.createPage({
      bookId: book._id, chapterId: chapter._id, name: 'B',
      key: { type: 'root', value: 'b' }, words, source: {},
    })

    store.pages = store.pages.map(p => p._id === a._id
      ? { ...p, nextReviewAt: Date.now() + 5 * 24 * 3600_000 }
      : { ...p, nextReviewAt: Date.now() - 1000 })

    expect(store.dueCount).toBe(1)
    expect(store.duePages[0]._id).toBe(b._id)
  })
})
