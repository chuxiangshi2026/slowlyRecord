// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/vue'
import ElementPlus from 'element-plus'
import '@testing-library/jest-dom'
import WordBookPage from './WordBookPage.vue'

vi.setConfig({ testTimeout: 30000 })

const mocks = vi.hoisted(() => ({
  completeRound: vi.fn(),
  loadAll: vi.fn(async () => {}),
  push: vi.fn(),
  replace: vi.fn(),
  speak: vi.fn(),
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
    pages: [page, { ...page, _id: 'page_2', chapterId: 'chapter_2', name: 'OLD 篇' }],
    loadAll: mocks.loadAll,
    getPage: (id: string) => id === page._id ? page : undefined,
    chaptersOf: () => [
      { _id: 'chapter_1', name: 'old' },
      { _id: 'chapter_2', name: 'OLD' },
    ],
    pagesOf: () => [page],
    completeRound: mocks.completeRound,
  }),
}))
vi.mock('@/stores/words', () => ({
  useWordsStore: () => ({ autoSpeak: false, words: [], count: 0, listWords: vi.fn() }),
}))
vi.mock('@/adapters/tts', () => ({ getTtsAdapter: () => ({ speak: mocks.speak }) }))
vi.mock('element-plus', async (importOriginal) => {
  const actual = await importOriginal<typeof import('element-plus')>()
  return { ...actual, ElMessage: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }
})

describe('词集学习页', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    page.key = { type: 'letters', value: 'old' }
    page.words = [{ entryId: 'entry_1', sourceId: 'word_1', text: 'fold', explains: '折叠' }]
  })

  it('章节目录按章节树展示，可打开学习页或进入章节', async () => {
    render(WordBookPage, { global: { plugins: [ElementPlus] } })
    await fireEvent.click(await screen.findByRole('button', { name: '章节目录' }))
    const dialog = await screen.findByRole('dialog', { name: '章节目录' })
    expect(within(dialog).getByRole('button', { name: /1\. old.*1 页 · 1 词.*同名/ })).toBeInTheDocument()
    await fireEvent.click(within(dialog).getByRole('button', { name: 'P1 OLD 篇' }))
    expect(mocks.push).toHaveBeenCalledWith('/word-book/page/page_2')
  })

  it('查看模式悬浮发音并显示释义，单击标记全部后进入复习', async () => {
    page.words = [
      { entryId: 'entry_1', sourceId: 'word_1', text: 'fold', explains: '折叠' },
      { entryId: 'entry_2', sourceId: 'word_2', text: 'bold', explains: '大胆的' },
    ]
    render(WordBookPage, { global: { plugins: [ElementPlus] } })

    const fold = await screen.findByRole('button', { name: 'fold，标记为已记住' })
    expect(fold.closest('.map-node')).toHaveClass('hoverable')
    await fireEvent.mouseEnter(fold)
    expect(mocks.speak).toHaveBeenCalledWith('fold', { lang: 'en' })
    expect(document.querySelector('.detail-explains')).toHaveTextContent('折叠')

    await fireEvent.click(fold)
    expect(document.querySelector('.detail-explains')).toHaveTextContent('已记住，释义已隐藏')
    const bold = screen.getByRole('button', { name: 'bold，标记为已记住' })
    await fireEvent.mouseEnter(bold)
    await fireEvent.click(bold)

    expect(screen.getByRole('radio', { name: '复习' })).toBeChecked()
    expect(fold).toHaveTextContent('点击显示释义')
    expect(mocks.completeRound).not.toHaveBeenCalled()
  })

  it('词根匹配部分使用红色标识', async () => {
    page.key = { type: 'root', value: 'port' }
    page.words = [{ entryId: 'entry_1', sourceId: 'word_1', text: 'export', explains: '出口' }]
    render(WordBookPage, { global: { plugins: [ElementPlus] } })
    await screen.findByRole('button', { name: 'export，标记为已记住' })
    expect(document.querySelector('.key-match-root')).toHaveTextContent('port')
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
