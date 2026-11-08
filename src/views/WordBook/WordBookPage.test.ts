// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/vue'
import ElementPlus from 'element-plus'
import '@testing-library/jest-dom'
import WordBookPage from './WordBookPage.vue'

vi.setConfig({ testTimeout: 30000 })

const mocks = vi.hoisted(() => ({
  completeRound: vi.fn(),
  loadAll: vi.fn(async () => {}),
  push: vi.fn(),
  replace: vi.fn(),
}))

const page = {
  _id: 'page_1', type: 'wb_page', bookId: 'book_1', chapterId: 'chapter_1', name: 'old 篇', order: 1,
  key: { type: 'letters', value: 'old' },
  words: [{ entryId: 'entry_1', sourceId: 'word_1', text: 'fold', explains: '折叠' }],
  source: {}, level: 0, nextReviewAt: 0, ctime: 1, utime: 1,
}

vi.mock('vue-router', () => ({
  useRoute: () => ({ params: { pageId: 'page_1' }, query: {} }),
  useRouter: () => ({ push: mocks.push, replace: mocks.replace }),
  onBeforeRouteLeave: vi.fn(),
}))
vi.mock('@/stores/wordBook', () => ({
  useWordBookStore: () => ({
    loading: false,
    loadAll: mocks.loadAll,
    getPage: (id: string) => id === page._id ? page : undefined,
    pagesOf: () => [page],
    completeRound: mocks.completeRound,
  }),
}))
vi.mock('@/stores/words', () => ({
  useWordsStore: () => ({ autoSpeak: false, words: [], count: 0, listWords: vi.fn() }),
}))
vi.mock('@/adapters/tts', () => ({ getTtsAdapter: () => ({ speak: vi.fn() }) }))
vi.mock('element-plus', async (importOriginal) => {
  const actual = await importOriginal<typeof import('element-plus')>()
  return { ...actual, ElMessage: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }
})

describe('词集复习保存', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('保存失败仍显示本轮总结和重试入口，重试后关闭错误状态', async () => {
    mocks.completeRound
      .mockResolvedValueOnce({ ok: false, message: '模拟保存失败' })
      .mockResolvedValueOnce({ ok: true, item: page })
    render(WordBookPage, { global: { plugins: [ElementPlus] } })

    await fireEvent.click(await screen.findByText('复习'))
    const node = await screen.findByRole('button', { name: /fold，显示或收起释义/ })
    await fireEvent.click(node)

    await screen.findByRole('button', { name: '重试保存' })
    expect(screen.getByText('共 1 词')).toBeInTheDocument()
    expect(screen.getByText('本轮结果保存失败，请重试')).toBeInTheDocument()
    expect(mocks.completeRound).toHaveBeenCalledTimes(1)

    await fireEvent.click(screen.getByRole('button', { name: '重试保存' }))
    await waitFor(() => expect(mocks.completeRound).toHaveBeenCalledTimes(2))
    expect(screen.queryByRole('button', { name: '重试保存' })).not.toBeInTheDocument()
    expect(screen.getByText('共 1 词')).toBeInTheDocument()
  })
})
