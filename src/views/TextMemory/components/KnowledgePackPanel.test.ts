// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { reactive } from 'vue'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/vue'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import ElementPlus, { ElMessageBox } from 'element-plus'
import '@testing-library/jest-dom'
import KnowledgePackPanel from './KnowledgePackPanel.vue'

const PACK_LIST = [
  { id: 'pack-math', name: '小九九乘法表', description: '描述1', itemCount: 81, ordered: false, usableAsPeg: false, category: 'math' },
  { id: 'pack-text', name: '二十四节气', description: '描述2', itemCount: 24, ordered: true, usableAsPeg: true, category: 'text' },
]

// ElMessageBox.confirm 直接视为用户确认；ElMessage 静默
vi.mock('element-plus', async (importOriginal) => {
  const actual = await importOriginal<typeof import('element-plus')>()
  return {
    ...actual,
    ElMessageBox: { confirm: vi.fn(() => Promise.resolve('confirm')) },
    ElMessage: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
  }
})

// 每个用例在 setup 中重建响应式 mock store
let mockStore: any

vi.mock('@/stores/knowledgeMemory', () => ({
  useKnowledgeMemoryStore: () => mockStore,
}))

function buildStore(importedIds: string[]) {
  return reactive({
    packList: [...PACK_LIST],
    loading: false,
    importedIds: [...importedIds],
    isPackLoaded: vi.fn((id: string) => id === 'pack-math'),
    getTotalCount: vi.fn((id: string) => (id === 'pack-math' ? 81 : 0)),
    getMasteredCount: vi.fn((id: string) => (id === 'pack-math' ? 30 : 0)),
    getDueCount: vi.fn((id: string) => (id === 'pack-math' ? 5 : 0)),
    loadPack: vi.fn(() => Promise.resolve()),
    loadImportedIds: vi.fn(() => Promise.resolve()),
    importPack: vi.fn((id: string) => {
      if (!mockStore.importedIds.includes(id)) mockStore.importedIds.push(id)
      return Promise.resolve()
    }),
    removeImportedPack: vi.fn((id: string) => {
      mockStore.importedIds = mockStore.importedIds.filter((x: string) => x !== id)
      return Promise.resolve()
    }),
  })
}

async function setup(category: 'math' | 'text', importedIds: string[] = []) {
  const pinia = createPinia()
  setActivePinia(pinia)

  mockStore = buildStore(importedIds)

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
        plugins: [pinia, router, ElementPlus],
      },
    }),
    router,
  }
}

describe('KnowledgePackPanel（导入后展示模式）', () => {
  it('未导入任何包时显示空态文案', async () => {
    await setup('text')
    expect(screen.getByText('暂无知识库，点击右上角导入')).toBeInTheDocument()
    expect(screen.queryByText('二十四节气')).not.toBeInTheDocument()
  })

  it('只展示已导入的包卡片', async () => {
    await setup('text', ['pack-text'])
    expect(screen.getByText('二十四节气')).toBeInTheDocument()
    expect(screen.queryByText('小九九乘法表')).not.toBeInTheDocument()
    expect(screen.getByText('24 条')).toBeInTheDocument()
    expect(screen.getByText('有序')).toBeInTheDocument()
    expect(screen.getByText('可用作桩库')).toBeInTheDocument()
  })

  it('展示已加载知识包的进度统计', async () => {
    await setup('math', ['pack-math'])
    expect(screen.getByText('小九九乘法表')).toBeInTheDocument()
    expect(screen.getByText(/已掌握 30 \/ 81/)).toBeInTheDocument()
    expect(screen.getByText(/待复习 5/)).toBeInTheDocument()
  })

  it('点击卡片跳转到对应知识包练习页', async () => {
    const { router } = await setup('math', ['pack-math'])
    const card = screen.getByText('小九九乘法表').closest('.knowledge-pack-card')
    expect(card).toBeInTheDocument()
    await fireEvent.click(card!)
    await waitFor(() => {
      expect(router.currentRoute.value.path).toBe('/knowledge-memory/pack-math')
    })
  })

  it('导入对话框列出当前分类全部内置包，已导入的显示禁用态', async () => {
    await setup('text', ['pack-text'])
    // 打开导入对话框（对话框 teleport 到 body，screen 可查询）
    await fireEvent.click(screen.getByRole('button', { name: '导入' }))
    const dialog = await screen.findByRole('dialog')

    // 当前分类（text）的包被列出，math 分类不出现
    expect(within(dialog).getByText('二十四节气')).toBeInTheDocument()
    expect(within(dialog).queryByText('小九九乘法表')).not.toBeInTheDocument()
    expect(within(dialog).getByText(/24 条/)).toBeInTheDocument()

    // 已导入的包按钮为「已导入」且禁用
    const importedBtn = within(dialog).getByRole('button', { name: '已导入' })
    expect(importedBtn).toBeDisabled()
  })

  it('点击导入后加入清单并显示卡片', async () => {
    await setup('text')
    await fireEvent.click(screen.getByRole('button', { name: '导入' }))
    const dialog = await screen.findByRole('dialog')

    await fireEvent.click(within(dialog).getByRole('button', { name: '导入' }))
    expect(mockStore.importPack).toHaveBeenCalledWith('pack-text')

    // 导入后对话框中按钮变为禁用「已导入」，面板出现对应卡片
    await waitFor(() => {
      expect(within(dialog).getByRole('button', { name: '已导入' })).toBeDisabled()
    })
    const card = document.querySelector('.knowledge-pack-card')
    expect(card).toBeInTheDocument()
    expect(within(card as HTMLElement).getByText('二十四节气')).toBeInTheDocument()
  })

  it('点击移除经确认后下架该包（进度保留提示）', async () => {
    await setup('math', ['pack-math'])
    await fireEvent.click(screen.getByRole('button', { name: '移除' }))

    expect(ElMessageBox.confirm).toHaveBeenCalled()
    const [message] = (ElMessageBox.confirm as any).mock.calls[0]
    expect(message).toContain('学习进度会保留')

    await waitFor(() => {
      expect(mockStore.removeImportedPack).toHaveBeenCalledWith('pack-math')
    })
    await waitFor(() => {
      expect(screen.getByText('暂无知识库，点击右上角导入')).toBeInTheDocument()
    })
  })
})
