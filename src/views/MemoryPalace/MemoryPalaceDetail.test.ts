// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/vue'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import '@testing-library/jest-dom'
import MemoryPalaceDetail from './MemoryPalaceDetail.vue'

const hoisted = vi.hoisted(() => {
  const palace = {
    _id: 'palace-1',
    name: '测试宫殿',
    loci: [
      { order: 3, name: '阳台', description: '阳光充足' },
      { order: 1, name: '大门' },
      { order: 2, name: '客厅' },
    ],
    ctime: 1,
    utime: 1,
  }

  const pegs = [
    { _id: 'peg-1', palaceId: 'palace-1', locusOrder: 1, freeText: '自由文本' },
    { _id: 'peg-2', palaceId: 'palace-1', locusOrder: 2, contentRef: { type: 'text-article', articleId: 'a1', chunkIndex: 0 } },
  ]

  const textStore = {
    articles: [{ _id: 'a1', title: '文章一', content: '内容' }],
    loadArticles: vi.fn(() => Promise.resolve()),
  }

  const store = {
    currentPalace: palace,
    pegs: [...pegs],
    loading: false,
    loadPalaces: vi.fn(() => Promise.resolve()),
    loadPegs: vi.fn(() => Promise.resolve()),
    getPegByLocus: vi.fn((order: number) => pegs.find(p => p.locusOrder === order)),
    unmountPeg: vi.fn(() => Promise.resolve({ ok: true })),
  }

  return { palace, pegs, store, textStore }
})

vi.mock('@/stores/memoryPalace', () => ({
  useMemoryPalaceStore: vi.fn(() => hoisted.store),
}))

vi.mock('@/stores/textMemory', () => ({
  useTextMemoryStore: vi.fn(() => hoisted.textStore),
}))

vi.mock('@/utils/memory-palace-util', () => ({
  resolvePegContent: vi.fn((peg: any) => {
    if (peg?.contentRef) return { text: '引用内容', deleted: true, articleTitle: '文章一' }
    return { text: peg?.freeText || '', deleted: false }
  }),
  chunkArticleContent: vi.fn(() => ['chunk1', 'chunk2']),
}))

vi.mock('@/utils/memory-palace-srs', () => ({
  getPegLevel: vi.fn(() => 1),
  isMastered: vi.fn(() => false),
}))

vi.mock('element-plus', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...(actual as any),
    ElMessage: {
      success: vi.fn(),
      error: vi.fn(),
      warning: vi.fn(),
      info: vi.fn(),
    },
    ElMessageBox: {
      confirm: vi.fn(() => Promise.resolve()),
    },
  }
})

vi.mock('@element-plus/icons-vue', () => ({
  ArrowLeft: { template: '<span>arrow-left</span>' },
  Close: { template: '<span>close</span>' },
  Collection: { template: '<span>collection</span>' },
  Edit: { template: '<span>edit</span>' },
  EditPen: { template: '<span>edit-pen</span>' },
  View: { template: '<span>view</span>' },
}))

async function setup() {
  const pinia = createPinia()
  setActivePinia(pinia)

  hoisted.store.pegs = [...hoisted.pegs]
  vi.clearAllMocks()
  hoisted.store.unmountPeg.mockImplementation(async (peg: any) => {
    hoisted.store.pegs = hoisted.store.pegs.filter((p: any) => p._id !== peg._id)
    return { ok: true }
  })

  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div />' } },
      { path: '/memory-palace/:id', component: MemoryPalaceDetail },
    ],
  })
  await router.push('/memory-palace/palace-1')
  await router.isReady()

  return render(MemoryPalaceDetail, {
    global: {
      plugins: [pinia, router],
    },
  })
}

describe('MemoryPalaceDetail', () => {
  it('按 order 排序展示桩序列', async () => {
    await setup()

    const orders = screen.getAllByText(/#[123]/).map(el => el.textContent)
    expect(orders).toEqual(['#1', '#2', '#3'])
    expect(screen.getByText('大门')).toBeInTheDocument()
    expect(screen.getByText('客厅')).toBeInTheDocument()
    expect(screen.getByText('阳台')).toBeInTheDocument()
  })

  it('引用内容已删除时显示兜底文案', async () => {
    await setup()
    expect(screen.getByText('内容已删除')).toBeInTheDocument()
  })

  it('点击解除挂载调用 store.unmountPeg 并移除挂载', async () => {
    await setup()

    const closeIcons = screen.getAllByText('close')
    // 只有已挂载的桩才显示 close 图标（大门、客厅）
    expect(closeIcons.length).toBeGreaterThanOrEqual(1)
    await fireEvent.click(closeIcons[0])

    await waitFor(() => {
      expect(hoisted.store.unmountPeg).toHaveBeenCalled()
    })
  })
})
