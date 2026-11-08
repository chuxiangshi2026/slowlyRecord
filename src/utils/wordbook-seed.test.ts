import { describe, it, expect, vi, beforeEach } from 'vitest'

const state = vi.hoisted(() => ({
  books: [] as any[],
  chapters: [] as any[],
  pages: [] as any[],
  calls: { book: 0, chapter: 0, page: 0 },
  store: null as any,
}))

vi.mock('@/stores/wordBook', () => {
  if (!state.store) {
    state.store = {
      get books() { return state.books },
      set books(value: any[]) { state.books = value },
      get sortedBooks() { return state.books },
      loadAll: vi.fn(async () => {}),
      createBook: vi.fn(async (name: string, extra: any = {}) => {
        const book = { _id: `book_${state.books.length}`, name, ctime: 1, ...extra }
        state.books.push(book)
        state.calls.book++
        return { ok: true, item: book }
      }),
      createChapter: vi.fn(async (bookId: string, name: string) => {
        const chapter = { _id: `chapter_${state.chapters.length}`, bookId, name }
        state.chapters.push(chapter)
        state.calls.chapter++
        return { ok: true, item: chapter }
      }),
      createPage: vi.fn(async (input: any) => {
        const page = { _id: `page_${state.pages.length}`, ...input }
        state.pages.push(page)
        state.calls.page++
        return { ok: true, item: page }
      }),
      deleteBook: vi.fn(async (bookId: string) => {
        state.books = state.books.filter(book => book._id !== bookId)
        state.chapters = state.chapters.filter(chapter => chapter.bookId !== bookId)
        state.pages = state.pages.filter(page => page.bookId !== bookId)
        return { ok: true }
      }),
    }
  }
  return { useWordBookStore: () => state.store }
})

import { addWordBookSample, seedWordBookSamples } from './wordbook-seed'
import { WORDBOOK_SAMPLES } from './wordbook-samples'

describe('示例词集播种', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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
    ;(globalThis as any).__seedStorage = storage
  })

  it('首次播种四本示例词集，按词根/词缀/拼写组合/场景组织学习页', async () => {
    await seedWordBookSamples()
    expect(state.books.map(book => book.name)).toEqual(['词根册', '词缀册', '拼写组合册', '场景名词'])
    expect(state.books.every(book => book.isSample)).toBe(true)
    expect(state.books.every(book => book.sampleVersion === 7)).toBe(true)
    expect(state.chapters.map(chapter => chapter.name)).toEqual([
      '核心词根', '进阶词根', '常用前缀', '常用后缀', '元音组合', '辅音组合', '特殊拼写', '身体', '日常物品', '酒店',
    ])
    expect(state.calls.page).toBe(73)
    expect(state.pages.every(page => page.words.length >= 4)).toBe(true)
    expect(state.pages.every(page => typeof page.note === 'string' && page.note.length > 0)).toBe(true)
  })

  it('已播种或删除后不会自动生成重复示例', async () => {
    await seedWordBookSamples()
    await state.store.deleteBook(state.books[0]._id)
    const counts = { ...state.calls }
    await seedWordBookSamples()
    expect(state.calls).toEqual(counts)
    expect(state.books).toHaveLength(3)
  })

  it('旧版本已删除示例的用户只迁移标记，不重新播种', async () => {
    const storage = (globalThis as any).__seedStorage as Map<string, string>
    storage.set('sr_wordbook_samples_v1', '1')
    await seedWordBookSamples()
    expect(state.calls.book).toBe(0)
    expect(storage.get('sr_wordbook_samples_v7')).toBe('1')
  })

  it('上一版没有旧示例或示例已归为用户内容时不自动补建', async () => {
    const storage = (globalThis as any).__seedStorage as Map<string, string>
    storage.set('sr_wordbook_samples_v3', '1')
    state.books = [{ _id: 'mine', name: '示例词集', isSample: false }]
    await seedWordBookSamples()
    expect(state.calls.book).toBe(0)
    expect(state.books).toHaveLength(1)
  })

  it('同时有旧版标记时仍迁移现存旧示例', async () => {
    const storage = (globalThis as any).__seedStorage as Map<string, string>
    storage.set('sr_wordbook_samples_v1', '1')
    storage.set('sr_wordbook_samples_v3', '1')
    state.books = [{ _id: 'old_sample', name: '示例词集', isSample: true }]
    await seedWordBookSamples()
    expect(state.books.map(book => book.name)).toEqual(['词根册', '词缀册', '拼写组合册', '场景名词'])
    expect(state.books.some(book => book._id === 'old_sample')).toBe(false)
  })

  it('旧示例改名后仍按 sampleVersion 识别并替换', async () => {
    const storage = (globalThis as any).__seedStorage as Map<string, string>
    storage.set('sr_wordbook_samples_v3', '1')
    state.books = [{ _id: 'renamed_sample', name: '我改过名的旧示例', isSample: true, sampleVersion: 3 }]
    await seedWordBookSamples()
    expect(state.books.some(book => book._id === 'renamed_sample')).toBe(false)
    expect(state.books.map(book => book.name)).toEqual(['词根册', '词缀册', '拼写组合册', '场景名词'])
  })

  it('同名旧版本示例会被新版本替换，而不是被当成新书删掉', async () => {
    const storage = (globalThis as any).__seedStorage as Map<string, string>
    storage.set('sr_wordbook_samples_v3', '1')
    state.books = [{ _id: 'old_roots', name: '词根册', isSample: true, sampleVersion: 3 }]
    await seedWordBookSamples()
    expect(state.books.some(book => book._id === 'old_roots')).toBe(false)
    const rootsBook = state.books.find(book => book.name === '词根册')
    expect(rootsBook?.sampleVersion).toBe(7)
    expect(state.books.filter(book => book.name === '词根册')).toHaveLength(1)
  })

  it('上一版旧示例完整创建新示例后才删除', async () => {
    const storage = (globalThis as any).__seedStorage as Map<string, string>
    storage.set('sr_wordbook_samples_v2', '1')
    state.books = [{ _id: 'old_sample', name: '示例词集', isSample: true }]
    await seedWordBookSamples()
    expect(state.books.map(book => book.name)).toEqual(['词根册', '词缀册', '拼写组合册', '场景名词'])
    expect(state.books.some(book => book._id === 'old_sample')).toBe(false)
    expect(storage.get('sr_wordbook_samples_v7')).toBe('1')
  })

  it('示例页使用稳定 entryId，old 属于字母组合且带中心解释', async () => {
    await seedWordBookSamples()
    const oldPage = state.pages.find(page => page.key.type === 'letters' && page.key.value === 'old')!
    const portPage = state.pages.find(page => page.key.value === 'port')!
    expect(oldPage.name).toBe('old 篇')
    expect(oldPage.key.description).toContain('gold')
    expect(oldPage.words.map((word: any) => word.text)).toEqual(expect.arrayContaining(['fold', 'hold', 'cold']))
    expect(portPage.key.description).toContain('运')
    expect(portPage.note).toContain('portare')
    expect(portPage.words.find((word: any) => word.text === 'import')?.note).toContain('im-')
    expect(portPage.words.find((word: any) => word.text === 'import')?.examples?.[0]?.english).toContain('imports')
    expect(portPage.words.find((word: any) => word.text === 'import')?.memoryTip).toContain('im-')
    for (const page of state.pages) {
      expect(page.words.every((word: any) => typeof word.entryId === 'string' && word.entryId.length > 0)).toBe(true)
    }
  })

  it('内置列表优先打开同名用户词集，不创建重复副本', async () => {
    const sample = WORDBOOK_SAMPLES[0]
    state.books = [{ _id: 'mine', name: sample.name, isSample: false }]
    const result = await addWordBookSample(sample)
    expect(result.item._id).toBe('mine')
    expect(state.calls.book).toBe(0)
  })

  it('删除后可从内置列表显式重新添加', async () => {
    await seedWordBookSamples()
    const sample = WORDBOOK_SAMPLES[0]
    await state.store.deleteBook(state.books.find(book => book.name === sample.name)._id)
    const result = await addWordBookSample(sample)
    expect(result.ok).toBe(true)
    expect(state.books.filter(book => book.name === sample.name)).toHaveLength(1)
  })

  it('迁移失败不删除此前已添加的新示例', async () => {
    const storage = (globalThis as any).__seedStorage as Map<string, string>
    storage.set('sr_wordbook_samples_v2', '1')
    state.books = [
      { _id: 'old_sample', name: '示例词集', isSample: true },
      { _id: 'existing_sample', name: WORDBOOK_SAMPLES[0].name, isSample: true, sampleVersion: 7 },
    ]
    ;(state.store.createPage as any).mockImplementationOnce(async () => ({ ok: false, message: '保存失败' }))
    await seedWordBookSamples()
    expect(state.books.map(book => book._id)).toEqual(['old_sample', 'existing_sample'])
  })

  it('示例页保存失败时清理新内容并保留旧示例', async () => {
    const storage = (globalThis as any).__seedStorage as Map<string, string>
    storage.set('sr_wordbook_samples_v2', '1')
    state.books = [{ _id: 'old_sample', name: '示例词集', isSample: true }]
    ;(state.store.createPage as any).mockImplementationOnce(async (input: any) => {
      state.pages.push({ _id: 'page_failed', ...input })
      return { ok: false, message: '保存失败' }
    })
    await seedWordBookSamples()
    expect(state.books.map(book => book._id)).toEqual(['old_sample'])
    expect(state.pages).toHaveLength(0)
    expect(storage.get('sr_wordbook_samples_v7')).toBeUndefined()
  })

  it('同名旧示例不会在新内容创建成功前被删除', async () => {
    const storage = (globalThis as any).__seedStorage as Map<string, string>
    storage.set('sr_wordbook_samples_v6', '1')
    state.books = [{ _id: 'old_roots', name: '词根册', isSample: true, sampleVersion: 6 }]
    state.chapters = [{ _id: 'old_chapter', bookId: 'old_roots' }]
    state.pages = [{ _id: 'old_page', bookId: 'old_roots' }]
    ;(state.store.createPage as any).mockImplementationOnce(async () => ({ ok: false, message: '保存失败' }))

    await seedWordBookSamples()
    expect(state.books).toEqual([expect.objectContaining({ _id: 'old_roots', sampleVersion: 6 })])
    expect(state.chapters).toEqual([expect.objectContaining({ _id: 'old_chapter' })])
    expect(state.pages).toEqual([expect.objectContaining({ _id: 'old_page' })])
    expect(storage.get('sr_wordbook_samples_v7')).toBeUndefined()
  })

  it('上一版只迁移仍存在的示例，不复活已单独删除的示例', async () => {
    const storage = (globalThis as any).__seedStorage as Map<string, string>
    storage.set('sr_wordbook_samples_v6', '1')
    state.books = [
      { _id: 'old_roots', name: '词根册', isSample: true, sampleVersion: 6 },
      { _id: 'old_affixes', name: '词缀册', isSample: true, sampleVersion: 6 },
    ]

    await seedWordBookSamples()
    expect(state.books.map(book => book.name)).toEqual(['词根册', '词缀册'])
    expect(state.calls.book).toBe(2)
    expect(state.books.every(book => book.sampleVersion === 7)).toBe(true)
  })

  it('旧示例清理失败时保留新内容，下次复用新版并续跑', async () => {
    const storage = (globalThis as any).__seedStorage as Map<string, string>
    storage.set('sr_wordbook_samples_v6', '1')
    state.books = [{ _id: 'old_roots', name: '词根册', isSample: true, sampleVersion: 6 }]
    ;(state.store.deleteBook as any).mockImplementationOnce(async () => ({ ok: false, message: '删除失败' }))

    await seedWordBookSamples()
    expect(state.books.map(book => book._id)).toEqual(['old_roots', 'book_1'])
    expect(storage.get('sr_wordbook_samples_v7')).toBeUndefined()

    await seedWordBookSamples()
    expect(state.calls.book).toBe(1)
    expect(state.books.map(book => book._id)).toEqual(['book_1'])
    expect(storage.get('sr_wordbook_samples_v7')).toBe('1')
  })
})
