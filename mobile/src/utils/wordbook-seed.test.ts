import { describe, it, expect, vi, beforeEach } from 'vitest'
import { WORDBOOK_SAMPLES } from './wordbook-samples'

const state = vi.hoisted(() => ({
  books: [] as any[],
  chapters: [] as any[],
  pages: [] as any[],
  createdBooks: [] as any[],
  deletedBooks: [] as string[],
  pageCalls: 0,
  failAtPage: 0,
}))

vi.mock('@/stores/useWordBook', () => ({
  useWordBook: () => ({
    get sortedBooks() { return state.books },
    get pages() { return state.pages },
    load() {},
    createBook(name: string, extra: any = {}) {
      const book = { _id: `book_${state.books.length}`, name, ctime: 1, ...extra }
      state.books.push(book)
      state.createdBooks.push(book)
      return book
    },
    createChapter(bookId: string, name: string) {
      const chapter = { _id: `chapter_${state.chapters.length}`, bookId, name }
      state.chapters.push(chapter)
      return chapter
    },
    createPage(input: any) {
      state.pageCalls++
      if (state.failAtPage && state.pageCalls >= state.failAtPage) return null
      const page = { _id: `page_${state.pages.length}`, ...input }
      state.pages.push(page)
      return page
    },
    deleteBook(bookId: string) {
      state.deletedBooks.push(bookId)
      state.books = state.books.filter(book => book._id !== bookId)
      state.chapters = state.chapters.filter(chapter => chapter.bookId !== bookId)
      state.pages = state.pages.filter(page => page.bookId !== bookId)
      return { ok: true }
    },
  }),
}))

import { addWordBookSample, seedWordBookSamples } from './wordbook-seed'

const storage = new Map<string, any>()
;(globalThis as any).uni = {
  getStorageSync: (key: string) => storage.get(key) ?? '',
  setStorageSync: (key: string, value: any) => { storage.set(key, value) },
  removeStorageSync: (key: string) => { storage.delete(key) },
}

describe('移动端示例词集播种', () => {
  beforeEach(() => {
    storage.clear()
    state.books = []
    state.chapters = []
    state.pages = []
    state.createdBooks = []
    state.deletedBooks = []
    state.pageCalls = 0
    state.failAtPage = 0
  })

  it('首次只播种一本入门示例并写入完成标记', () => {
    seedWordBookSamples()
    expect(state.createdBooks.map(book => book.name)).toEqual([WORDBOOK_SAMPLES[0].name])
    expect(state.books).toHaveLength(1)
    expect(state.pages.length).toBeGreaterThan(0)
    expect(storage.get('sr_wordbook_samples_v2')).toBe('1')
  })

  it('其余示例可按需导入，同名时复用已有词集', () => {
    const sample = WORDBOOK_SAMPLES[1]
    const book = addWordBookSample(sample)
    expect(book?.name).toBe(sample.name)
    expect(state.createdBooks).toHaveLength(1)
    expect(state.pages.length).toBeGreaterThan(0)
    expect(addWordBookSample(sample)?.name).toBe(sample.name)
    expect(state.createdBooks).toHaveLength(1)
  })

  it('已存在同名词集时跳过，并写入完成标记', () => {
    state.books = WORDBOOK_SAMPLES.map((sample, index) => ({ _id: `existing_${index}`, name: sample.name }))
    seedWordBookSamples()
    expect(state.createdBooks).toHaveLength(0)
    expect(storage.get('sr_wordbook_samples_v2')).toBe('1')
  })

  it('升级后只保留一本未学习示例，已有学习进度的示例不删除', () => {
    storage.set('sr_wordbook_samples_v2', '1')
    state.books = WORDBOOK_SAMPLES.map((sample, index) => ({ _id: `existing_${index}`, name: sample.name, isSample: true }))
    state.pages = [{ _id: 'p1', bookId: 'existing_1', completedAt: 1 }]
    seedWordBookSamples()
    expect(state.books.map(book => book.name)).toEqual([WORDBOOK_SAMPLES[0].name, WORDBOOK_SAMPLES[1].name])
    expect(state.deletedBooks).toEqual(['existing_2', 'existing_3', 'existing_4'])
    expect(storage.get('sr_wordbook_samples_single_v1')).toBe('1')
  })

  it('播种中途失败时回滚本次创建内容，且不写完成标记', () => {
    state.failAtPage = 1
    seedWordBookSamples()
    expect(state.deletedBooks).toEqual(['book_0'])
    expect(state.books).toHaveLength(0)
    expect(state.pages).toHaveLength(0)
    expect(storage.get('sr_wordbook_samples_v2')).toBeUndefined()
  })
})
