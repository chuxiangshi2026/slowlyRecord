// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/vue'
import ElementPlus from 'element-plus'
import WordBookCreateDialog from './WordBookCreateDialog.vue'

vi.setConfig({ testTimeout: 30000 })

const state = vi.hoisted(() => ({
  books: [] as any[],
  chapters: [] as any[],
  pages: [] as any[],
  attempts: 0,
  failAttempt: -1,
  store: null as any,
}))

vi.mock('@/stores/wordBook', () => {
  if (!state.store) {
    state.store = {
      get sortedBooks() { return state.books },
      chaptersOf: (bookId: string) => state.chapters.filter(chapter => chapter.bookId === bookId),
      findPageByKey: () => undefined,
      loadAll: vi.fn(async () => {}),
      claimSampleBook: vi.fn(async () => ({ ok: true })),
      createBook: vi.fn(async (name: string) => {
        const book = { _id: `book_${state.books.length + 1}`, name }
        state.books.push(book)
        return { ok: true, item: book }
      }),
      createChapter: vi.fn(async (bookId: string, name: string) => {
        const chapter = { _id: `chapter_${state.chapters.length + 1}`, bookId, name }
        state.chapters.push(chapter)
        return { ok: true, item: chapter }
      }),
      createPage: vi.fn(async (input: any) => {
        state.attempts++
        if (state.attempts === state.failAttempt) return { ok: false, message: '模拟保存失败' }
        const page = { _id: `page_${state.pages.length + 1}`, ...input }
        state.pages.push(page)
        return { ok: true, item: page }
      }),
      deleteChapter: vi.fn(async () => ({ ok: true })),
      deleteBook: vi.fn(async () => ({ ok: true })),
    }
  }
  return { useWordBookStore: () => state.store }
})

vi.mock('@/utils/stats', () => ({ trackEvent: vi.fn() }))
vi.mock('element-plus', async (importOriginal) => {
  const actual = await importOriginal<typeof import('element-plus')>()
  return { ...actual, ElMessage: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }
})

describe('加入词集批量创建', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    state.books = []
    state.chapters = []
    state.pages = []
    state.attempts = 0
    state.failAttempt = -1
  })

  it('部分页失败后只重试失败页，并复用原词集和章节', async () => {
    state.failAttempt = 2
    const words = Array.from({ length: 25 }, (_, index) => ({
      _id: `word_${index}`,
      text: `old-${index}`,
      explains: '释义',
    })) as any[]
    const rendered = render(WordBookCreateDialog, {
      props: { modelValue: true, words, filter: { pattern: 'old' }, bankName: '测试词库' },
      global: { plugins: [ElementPlus] },
    })

    await fireEvent.click(await screen.findByRole('button', { name: '生成并查看' }))
    await screen.findByRole('button', { name: '重试失败页' })
    expect(state.books).toHaveLength(1)
    expect(state.chapters).toHaveLength(1)
    expect(state.pages).toHaveLength(2)
    expect(state.attempts).toBe(3)

    await fireEvent.click(screen.getByRole('button', { name: '重试失败页' }))
    await waitFor(() => expect(rendered.emitted('created')).toHaveLength(1))

    expect(state.books).toHaveLength(1)
    expect(state.chapters).toHaveLength(1)
    expect(state.pages).toHaveLength(3)
    expect(state.attempts).toBe(4)
    expect(state.pages.every(page => page.bookId === 'book_1' && page.chapterId === 'chapter_1')).toBe(true)
    expect(state.pages.map(page => page.name).sort()).toEqual(['old 篇 1', 'old 篇 2', 'old 篇 3'])
    expect(rendered.emitted('created')?.[0]).toEqual([{ bookId: 'book_1', chapterId: 'chapter_1' }])
  })

  it('打开时先加载已有书章，并默认选择已有词集', async () => {
    state.books = [{ _id: 'book_existing', name: '已有词集' }]
    state.chapters = [{ _id: 'chapter_existing', bookId: 'book_existing', name: '已有章节' }]
    render(WordBookCreateDialog, {
      props: { modelValue: true, words: [{ _id: 'w1', text: 'fold', explains: '折叠' }] as any[] },
      global: { plugins: [ElementPlus] },
    })

    await waitFor(() => expect(state.store.loadAll).toHaveBeenCalled())
    expect(screen.getAllByText('已有词集').length).toBeGreaterThan(0)
    expect(screen.getAllByText('已有章节').length).toBeGreaterThan(0)
    expect(screen.getAllByRole('radio', { name: '选择已有' }).every(radio => (radio as HTMLInputElement).checked)).toBe(true)
  })
})
