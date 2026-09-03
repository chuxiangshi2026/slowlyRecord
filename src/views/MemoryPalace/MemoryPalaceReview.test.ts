// @vitest-environment jsdom
import {describe, it, expect, beforeEach, vi} from 'vitest'
import {render, screen, waitFor, fireEvent} from '@testing-library/vue'
import {createPinia, setActivePinia} from 'pinia'
import {createRouter, createMemoryHistory} from 'vue-router'
import '@testing-library/jest-dom'
import MemoryPalaceReview from './MemoryPalaceReview.vue'

const hoisted = vi.hoisted(() => {
  const mockPalace = {
    _id: 'palace-1',
    name: '测试宫殿',
    loci: [
      {order: 1, name: '大门'},
      {order: 2, name: '客厅'},
    ],
    ctime: 1,
    utime: 1,
  }

  const mockPegs = [
    {_id: 'peg-1', palaceId: 'palace-1', locusOrder: 1, freeText: '自由文本1'},
    {_id: 'peg-2', palaceId: 'palace-1', locusOrder: 2, freeText: '自由文本2'},
  ]

  return {
    mockPalace,
    mockPegs,
    store: {
      currentPalace: mockPalace,
      getPegByLocus: vi.fn((order: number) => mockPegs.find(p => p.locusOrder === order)),
      assessPeg: vi.fn(() => Promise.resolve({ok: true})),
      loadPalaces: vi.fn(() => Promise.resolve()),
      loadPegs: vi.fn(() => Promise.resolve()),
    },
    textStore: {
      articles: [],
      loadArticles: vi.fn(() => Promise.resolve()),
    },
  }
})

vi.mock('@/stores/memoryPalace', () => ({
  useMemoryPalaceStore: vi.fn(() => hoisted.store),
}))

vi.mock('@/stores/textMemory', () => ({
  useTextMemoryStore: vi.fn(() => hoisted.textStore),
}))

vi.mock('@/utils/memory-palace-util', () => ({
  resolvePegContent: vi.fn((peg: any) => ({
    text: peg?.freeText || '',
    deleted: false,
  })),
}))

vi.mock('element-plus', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    ElMessage: {
      success: vi.fn(),
      error: vi.fn(),
      warning: vi.fn(),
      info: vi.fn(),
    },
  }
})

vi.mock('@element-plus/icons-vue', () => ({
  ArrowLeft: {template: '<span>←</span>'},
  ArrowRight: {template: '<span>→</span>'},
}))

// 把 el-result 渲染为普通 div，使 sub-title 可被文本查询
const ElResultStub = {
  props: ['icon', 'title', 'subTitle'],
  template: '<div class="el-result-stub"><h3>{{ title }}</h3><p>{{ subTitle }}</p></div>',
}

async function setup() {
  const pinia = createPinia()
  setActivePinia(pinia)
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      {path: '/', component: {template: '<div />'}},
      {path: '/memory-palace/:id', component: {template: '<div />'}},
      {path: '/memory-palace/:id/review', component: MemoryPalaceReview},
    ],
  })
  await router.push('/memory-palace/palace-1/review')
  await router.isReady()

  vi.resetAllMocks()
  hoisted.store.assessPeg.mockResolvedValue({ok: true})

  return render(MemoryPalaceReview, {
    global: {
      plugins: [pinia, router],
      stubs: {
        'el-result': ElResultStub,
      },
    },
  })
}

describe('MemoryPalaceReview', () => {
  beforeEach(() => {
    hoisted.store.currentPalace = hoisted.mockPalace
    hoisted.store.getPegByLocus.mockImplementation((order: number) => hoisted.mockPegs.find(p => p.locusOrder === order))
  })

  it('自评成功时应统计记住/忘记', async () => {
    await setup()
    await fireEvent.click(screen.getByText('大门'))
    await fireEvent.click(screen.getByText('记住'))

    await waitFor(() => {
      expect(hoisted.store.assessPeg).toHaveBeenCalledTimes(1)
    })
    expect(screen.getByText('2 / 2')).toBeInTheDocument()
  })

  it('assessPeg 失败时不应计入统计并提示错误', async () => {
    const {ElMessage} = await import('element-plus')

    await setup()
    hoisted.store.assessPeg.mockResolvedValueOnce({ok: false})
    await fireEvent.click(screen.getByText('大门'))
    await fireEvent.click(screen.getByText('记住'))

    await waitFor(() => {
      expect((ElMessage as any).error).toHaveBeenCalledWith('自评结果保存失败，请重试')
    })
    // 仍在第一桩，没有进入下一桩
    expect(screen.getByText('1 / 2')).toBeInTheDocument()
  })

  it('返回上一桩重新自评不应重复累加统计', async () => {
    await setup()
    await fireEvent.click(screen.getByText('大门'))
    await fireEvent.click(screen.getByText('忘记'))
    await waitFor(() => expect(screen.getByText('2 / 2')).toBeInTheDocument())

    // 返回上一桩
    await fireEvent.click(screen.getByText('上一个'))
    expect(screen.getByText('1 / 2')).toBeInTheDocument()

    // 重新自评
    await fireEvent.click(screen.getByText('大门'))
    await fireEvent.click(screen.getByText('记住'))
    await waitFor(() => expect(screen.getByText('2 / 2')).toBeInTheDocument())

    // 进入完成页
    await fireEvent.click(screen.getByText('跳过'))
    await waitFor(() => {
      expect(screen.getByText(/记住 1/)).toBeInTheDocument()
      expect(screen.getByText(/忘记 0/)).toBeInTheDocument()
      expect(screen.getByText(/跳过 1/)).toBeInTheDocument()
    })
  })

  it('跳过应统计跳过数', async () => {
    await setup()
    await fireEvent.click(screen.getByText('跳过'))
    await waitFor(() => expect(screen.getByText('2 / 2')).toBeInTheDocument())
    await fireEvent.click(screen.getByText('跳过'))
    await waitFor(() => {
      expect(screen.getByText(/跳过 2/)).toBeInTheDocument()
    })
  })
})
