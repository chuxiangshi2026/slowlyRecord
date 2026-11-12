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

  it('先揭示再判定；保存失败仍显示总结和重试入口', async () => {
    mocks.completeRound
      .mockResolvedValueOnce({ ok: false, message: '模拟保存失败' })
      .mockResolvedValueOnce({ ok: true, item: page })
    render(WordBookPage, { global: { plugins: [ElementPlus] } })

    await fireEvent.click(await screen.findByText('复习'))
    const node = await screen.findByRole('button', { name: /fold，显示释义/ })
    await fireEvent.click(node)
    expect(node).toHaveTextContent('折叠')
    expect(mocks.completeRound).not.toHaveBeenCalled()

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

  it('错词移到队尾，其他词判对后仍不结算，重看成功才完成', async () => {
    mocks.completeRound.mockResolvedValue({ ok: true, item: page })
    page.words = [
      { entryId: 'entry_1', sourceId: 'word_1', text: 'fold', explains: '折叠' },
      { entryId: 'entry_2', sourceId: 'word_2', text: 'bold', explains: '大胆的' },
      { entryId: 'entry_3', sourceId: 'word_3', text: 'hold', explains: '握住' },
    ]
    render(WordBookPage, { global: { plugins: [ElementPlus] } })
    await fireEvent.click(await screen.findByText('复习'))
    const nodes = () => Array.from(document.querySelectorAll<HTMLButtonElement>('.node-main'))
    const first = nodes()[0]
    const wrongText = first.querySelector('.node-word')?.textContent
    const wrongEntryId = page.words.find(word => word.text === first.getAttribute('aria-label')?.split('，')[0])!.entryId

    await fireEvent.click(first)
    await fireEvent.click(screen.getByRole('button', { name: '还没记住' }))
    expect(nodes()[2].querySelector('.node-word')).toHaveTextContent(wrongText!)
    expect(mocks.completeRound).not.toHaveBeenCalled()

    for (const node of nodes().slice(0, 2)) {
      await fireEvent.click(node)
      await fireEvent.click(node)
    }
    expect(mocks.completeRound).not.toHaveBeenCalled()

    const retry = nodes()[2]
    await fireEvent.click(retry)
    await fireEvent.click(retry)
    await waitFor(() => expect(mocks.completeRound).toHaveBeenCalledTimes(1))
    expect(mocks.completeRound.mock.calls[0][1]).toMatchObject({
      total: 3,
      firstTryKnown: 2,
      firstTryWrongEntryIds: [wrongEntryId],
    })
  })

  it('离开复习或进入编辑前确认是否丢弃草稿', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true)
    render(WordBookPage, { global: { plugins: [ElementPlus] } })
    await fireEvent.click(await screen.findByText('复习'))
    await fireEvent.click(await screen.findByRole('button', { name: /fold，显示释义/ }))
    expect(localStorage.getItem('sr_wordbook_round_page_1')).toBeTruthy()

    await fireEvent.click(screen.getByText('查看'))
    await waitFor(() => expect(screen.getByRole('radio', { name: '复习' })).toBeChecked())
    expect(localStorage.getItem('sr_wordbook_round_page_1')).toBeTruthy()

    await fireEvent.click(screen.getByText('查看'))
    expect(screen.getByRole('radio', { name: '查看' })).toBeChecked()
    expect(localStorage.getItem('sr_wordbook_round_page_1')).toBeNull()
    confirm.mockRestore()
  })

  it('容器变小时切换为可滚动紧凑卡片布局', async () => {
    let resize: ((entries: any[]) => void) | undefined
    class Observer {
      constructor(callback: (entries: any[]) => void) { resize = callback }
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    vi.stubGlobal('ResizeObserver', Observer)
    render(WordBookPage, { global: { plugins: [ElementPlus] } })
    const shell = await screen.findByRole('group', { name: 'old 篇 中心导图' })
    expect(shell).not.toHaveClass('compact')

    resize!([{ contentRect: { width: 500, height: 400 } }])
    await waitFor(() => expect(shell).toHaveClass('compact'))
    expect(document.querySelector('.map-node')).not.toHaveAttribute('style', /left:/)
    vi.unstubAllGlobals()
  })
})
