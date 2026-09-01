// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/vue'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import '@testing-library/jest-dom'
import KnowledgePackPanel from './KnowledgePackPanel.vue'

const hoisted = vi.hoisted(() => {
  const packList = [
    { id: 'pack-math', name: '小九九乘法表', description: '描述1', itemCount: 81, ordered: false, usableAsPeg: false, category: 'math' },
    { id: 'pack-text', name: '二十四节气', description: '描述2', itemCount: 24, ordered: true, usableAsPeg: true, category: 'text' },
  ]

  const store = {
    packList: [...packList],
    loading: false,
    isPackLoaded: vi.fn((id: string) => id === 'pack-math'),
    getTotalCount: vi.fn((id: string) => (id === 'pack-math' ? 81 : 0)),
    getMasteredCount: vi.fn((id: string) => (id === 'pack-math' ? 30 : 0)),
    getDueCount: vi.fn((id: string) => (id === 'pack-math' ? 5 : 0)),
    loadPack: vi.fn(() => Promise.resolve()),
  }

  return { packList, store }
})

vi.mock('@/stores/knowledgeMemory', () => ({
  useKnowledgeMemoryStore: vi.fn(() => hoisted.store),
}))

async function setup(category: 'math' | 'text') {
  const pinia = createPinia()
  setActivePinia(pinia)

  hoisted.store.packList = [...hoisted.packList]
  vi.clearAllMocks()

  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div />' } },
      { path: '/knowledge-memory/:id', component: { template: '<div />' } },
    ],
  })
  await router.push('/')
  await router.isReady()

  return {
    ...render(KnowledgePackPanel, {
      props: { category },
      global: {
        plugins: [pinia, router],
      },
    }),
    router,
  }
}

describe('KnowledgePackPanel', () => {
  it('按 category 过滤并渲染知识包卡片', async () => {
    await setup('text')
    expect(screen.getByText('二十四节气')).toBeInTheDocument()
    expect(screen.queryByText('小九九乘法表')).not.toBeInTheDocument()
    expect(screen.getByText('24 条')).toBeInTheDocument()
    expect(screen.getByText('有序')).toBeInTheDocument()
    expect(screen.getByText('可用作桩库')).toBeInTheDocument()
  })

  it('展示已加载知识包的进度统计', async () => {
    await setup('math')
    expect(screen.getByText('小九九乘法表')).toBeInTheDocument()
    expect(screen.getByText(/已掌握 30 \/ 81/)).toBeInTheDocument()
    expect(screen.getByText(/待复习 5/)).toBeInTheDocument()
  })

  it('点击卡片跳转到对应知识包练习页', async () => {
    const { router } = await setup('math')
    const card = screen.getByText('小九九乘法表').closest('.knowledge-pack-card')
    expect(card).toBeInTheDocument()
    await fireEvent.click(card!)
    await waitFor(() => {
      expect(router.currentRoute.value.path).toBe('/knowledge-memory/pack-math')
    })
  })
})
