import { describe, it, expect, vi, beforeEach } from 'vitest'

const state = vi.hoisted(() => ({
  books: [] as any[],
  chapters: [] as any[],
  pages: [] as any[],
  calls: { book: 0, chapter: 0, page: 0 },
}))

vi.mock('@/stores/wordBook', () => ({
  useWordBookStore: () => ({
    get sortedBooks() { return state.books },
    loadAll: vi.fn(async () => {}),
    createBook: vi.fn(async (name: string, extra: any = {}) => {
      const book = { _id: `book_${state.books.length}`, name, ctime: 1, ...extra }
      state.books.push(book)
      state.calls.book++
      return book
    }),
    createChapter: vi.fn(async (bookId: string, name: string) => {
      const chapter = { _id: `chapter_${state.chapters.length}`, bookId, name }
      state.chapters.push(chapter)
      state.calls.chapter++
      return chapter
    }),
    createPage: vi.fn(async (input: any) => {
      const page = { _id: `page_${state.pages.length}`, ...input }
      state.pages.push(page)
      state.calls.page++
      return page
    }),
  }),
}))

import { seedWordBookSamples } from './wordbook-seed'

describe('示例书播种', () => {
  beforeEach(() => {
    state.books = []
    state.chapters = []
    state.pages = []
    state.calls = { book: 0, chapter: 0, page: 0 }
    const storage = new Map<string, string>()
    ;(globalThis as any).localStorage = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => { storage.set(key, value) },
      removeItem: (key: string) => { storage.delete(key) },
    }
  })

  it('首次播种两本书、五个章、若干页', async () => {
    await seedWordBookSamples()
    expect(state.calls.book).toBe(2)
    expect(state.calls.chapter).toBe(5)
    expect(state.calls.page).toBeGreaterThanOrEqual(5)
    expect(state.books.map(book => book.name)).toEqual(['四级词根', '四级发音'])
    expect(state.books.every(book => book.isSample)).toBe(true)
  })

  it('已播种过就不再重复生成（用户删掉后不复活）', async () => {
    await seedWordBookSamples()
    const firstPageCount = state.calls.page
    await seedWordBookSamples()
    expect(state.calls.page).toBe(firstPageCount)
  })

  it('页名带中心词，分页超过 1 页时带序号', async () => {
    await seedWordBookSamples()
    const names = state.pages.map(page => page.name)
    expect(names.some((name: string) => name.startsWith('old 篇'))).toBe(true)
    expect(names.some((name: string) => /篇 \d+$/.test(name))).toBe(true)
  })
})
