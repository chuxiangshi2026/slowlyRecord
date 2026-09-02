// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { reactive } from 'vue'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/vue'
import { createPinia, setActivePinia } from 'pinia'
import ElementPlus from 'element-plus'
import '@testing-library/jest-dom'
import TextImportDialog from './TextImportDialog.vue'

// 每个用例在 setup 中重建响应式 mock store
let mockKnowledgeStore: any
let mockPalaceStore: any

const TEXT_PACKS = [
  { id: 'pack-text', name: '二十四节气', description: '描述', itemCount: 24, ordered: true, usableAsPeg: true, category: 'text' },
  { id: 'pack-text2', name: '唐诗精选', description: '描述2', itemCount: 50, ordered: false, usableAsPeg: false, category: 'text' },
]

const PEG_PACKS = [
  { id: 'pack-text', name: '二十四节气', description: '描述', itemCount: 24, ordered: true, usableAsPeg: true, category: 'text' },
]

vi.mock('@/stores/textMemory', () => ({
  useTextMemoryStore: () => ({ allTags: [] }),
}))

vi.mock('@/stores/knowledgeMemory', () => ({
  useKnowledgeMemoryStore: () => mockKnowledgeStore,
}))

vi.mock('@/stores/memoryPalace', () => ({
  useMemoryPalaceStore: () => mockPalaceStore,
}))

// 避免 axios/config 等依赖链，桩掉 AI 搜索模块（组件 setup 会调用 getAISearchConfig）
vi.mock('@/utils/ai-search-api', () => ({
  smartSearchWithAI: vi.fn(),
  getAISearchConfig: () => ({ enabled: false, provider: 'glm', apiKey: '', apiUrl: '', model: '' }),
  saveAISearchConfig: vi.fn(),
  testAIConnection: vi.fn(),
  generateTimelineEventsWithAI: vi.fn(),
}))

// ElMessage 静默
vi.mock('element-plus', async (importOriginal) => {
  const actual = await importOriginal<typeof import('element-plus')>()
  return {
    ...actual,
    ElMessage: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
  }
})

interface SetupOptions {
  props?: Record<string, any>
  // knowledge store 已导入包 id 清单
  knowledgeImportedIds?: string[]
  // palace store 现有宫殿列表
  palaces?: any[]
}

async function setup(options: SetupOptions = {}) {
  const pinia = createPinia()
  setActivePinia(pinia)

  mockKnowledgeStore = reactive({
    packList: [...TEXT_PACKS],
    importedIds: [...(options.knowledgeImportedIds ?? [])],
    customItems: [],
    loadImportedIds: vi.fn(() => Promise.resolve()),
    loadCustomItems: vi.fn(() => Promise.resolve()),
    addCustomItem: vi.fn((input: any) => Promise.resolve({ id: 'custom_x', ...input, ctime: Date.now() })),
    importPack: vi.fn((id: string) => {
      if (!mockKnowledgeStore.importedIds.includes(id)) mockKnowledgeStore.importedIds.push(id)
      return Promise.resolve()
    }),
  })

  mockPalaceStore = reactive({
    palaces: [...(options.palaces ?? [])],
    listPegPacks: () => [...PEG_PACKS],
    loadPalaces: vi.fn(() => Promise.resolve()),
    updatePalace: vi.fn(() => Promise.resolve({ ok: true })),
    importPackAsPalace: vi.fn(() =>
      Promise.resolve({ result: { ok: true }, palace: { _id: 'palace-new', name: '二十四节气' } }),
    ),
  })

  return render(TextImportDialog, {
    props: { modelValue: true, ...(options.props ?? {}) },
    global: {
      plugins: [pinia, ElementPlus],
    },
  })
}

// 当前激活的 tab 文案
function activeTabLabel(): string {
  return document.querySelector('.el-tabs__item.is-active')?.textContent?.trim() ?? ''
}

// 内置库二级面板中当前激活项的文案
function activeLibTabLabel(): string {
  const pane = document.getElementById('pane-library')
  return pane?.querySelector('.el-radio-button.is-active')?.textContent?.trim() ?? ''
}

describe('TextImportDialog（统一添加/导入入口）', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('包含手动添加/批量导入/文件导入/内置库四个 tab，默认定位手动添加', async () => {
    await setup()

    const tabTexts = Array.from(document.querySelectorAll('.el-tabs__item')).map(el => el.textContent?.trim())
    expect(tabTexts).toEqual(['手动添加', '批量导入', '文件导入', '内置库'])
    expect(activeTabLabel()).toBe('手动添加')
  })

  it('initialTab=library + initialLibTab=knowledge 定位内置库-知识库，已导入包显示禁用态', async () => {
    await setup({ props: { initialTab: 'library', initialLibTab: 'knowledge' }, knowledgeImportedIds: ['pack-text'] })

    await waitFor(() => {
      expect(activeTabLabel()).toBe('内置库')
    }, { timeout: 3000 })
    expect(activeLibTabLabel()).toBe('知识库')

    const pane = document.getElementById('pane-library') as HTMLElement
    expect(within(pane).getByText('二十四节气')).toBeInTheDocument()
    expect(within(pane).getByText('唐诗精选')).toBeInTheDocument()

    // 已导入的包按钮为「已导入」且禁用
    const importedBtn = within(pane).getByRole('button', { name: '已导入' })
    expect(importedBtn).toBeDisabled()
  })

  it('initialTab=library + initialLibTab=pegPacks 定位内置库-宫殿桩库，已有对应宫殿的显示已导入', async () => {
    await setup({
      props: { initialTab: 'library', initialLibTab: 'pegPacks' },
      palaces: [{ _id: 'palace-1', name: '二十四节气', loci: [], sourcePackId: 'pack-text', ctime: 1, utime: 1 }],
    })

    await waitFor(() => {
      expect(activeTabLabel()).toBe('内置库')
    }, { timeout: 3000 })
    expect(activeLibTabLabel()).toBe('宫殿桩库')

    const pane = document.getElementById('pane-library') as HTMLElement
    expect(within(pane).getByText('二十四节气')).toBeInTheDocument()
    expect(within(pane).getByRole('button', { name: '已导入' })).toBeDisabled()
  })

  it('兼容旧调用：initialTab=knowledge 直接定位内置库-知识库', async () => {
    await setup({ props: { initialTab: 'knowledge' }, knowledgeImportedIds: ['pack-text'] })

    await waitFor(() => {
      expect(activeTabLabel()).toBe('内置库')
    }, { timeout: 3000 })
    expect(activeLibTabLabel()).toBe('知识库')

    const pane = document.getElementById('pane-library') as HTMLElement
    expect(within(pane).getByText('二十四节气')).toBeInTheDocument()
  })

  it('内置库-知识库点击导入调用 knowledgeMemory store.importPack', async () => {
    await setup({ props: { initialTab: 'library', initialLibTab: 'knowledge' } })

    const pane = document.getElementById('pane-library') as HTMLElement
    const row = within(pane).getByText('二十四节气').closest('.import-pack-row') as HTMLElement
    await fireEvent.click(within(row).getByRole('button', { name: '导入' }))

    expect(mockKnowledgeStore.importPack).toHaveBeenCalledWith('pack-text')
  })

  it('内置库-宫殿桩库点击导入调用 memoryPalace store.importPackAsPalace', async () => {
    await setup({ props: { initialTab: 'library', initialLibTab: 'pegPacks' } })

    const pane = document.getElementById('pane-library') as HTMLElement
    await fireEvent.click(within(pane).getByRole('button', { name: '导入' }))
    await waitFor(() => {
      expect(mockPalaceStore.importPackAsPalace).toHaveBeenCalledWith('pack-text')
    }, { timeout: 3000 })
  })

  it('手动添加（普通文本）表单提交后 emit import 单篇文章', async () => {
    const { emitted } = await setup()

    await fireEvent.update(screen.getByPlaceholderText('请输入标题，如《静夜思》'), '静夜思')
    await fireEvent.update(screen.getByPlaceholderText('请输入文本内容...'), '床前明月光，疑是地上霜。举头望明月，低头思故乡。')
    await fireEvent.click(screen.getByRole('button', { name: '添加' }))

    await waitFor(() => {
      const events = emitted().import
      expect(events).toBeTruthy()
      const articles = (events[0] as any[])[0]
      expect(articles).toHaveLength(1)
      expect(articles[0].title).toBe('静夜思')
    }, { timeout: 3000 })
  })

  it('手动添加切换类型显示对应字段（诗词/时间线事件/宫殿桩）', async () => {
    await setup()
    const pane = document.getElementById('pane-manual') as HTMLElement

    // 诗词：朝代/作者/年份/地点
    await fireEvent.click(within(pane).getByText('诗词'))
    await waitFor(() => {
      expect(within(pane).getByText('朝代')).toBeInTheDocument()
      expect(within(pane).getByText('正文')).toBeInTheDocument()
    }, { timeout: 3000 })

    // 时间线事件：事件名/年份/区域/描述
    await fireEvent.click(within(pane).getByText('时间线事件'))
    await waitFor(() => {
      expect(within(pane).getByText('事件名')).toBeInTheDocument()
      expect(within(pane).getByText('描述')).toBeInTheDocument()
    }, { timeout: 3000 })

    // 宫殿桩：所属宫殿/桩名/备选桩
    await fireEvent.click(within(pane).getByText('宫殿桩'))
    await waitFor(() => {
      expect(within(pane).getByText('所属宫殿')).toBeInTheDocument()
      expect(within(pane).getByText('桩名')).toBeInTheDocument()
      expect(within(pane).getByText('备选桩')).toBeInTheDocument()
    }, { timeout: 3000 })
  })

  it('手动添加-时间线事件保存后 emit import（走 mapLibraryEventToArticle 路径）', async () => {
    const { emitted } = await setup()
    const pane = document.getElementById('pane-manual') as HTMLElement

    await fireEvent.click(within(pane).getByText('时间线事件'))
    await waitFor(() => {
      expect(within(pane).getByPlaceholderText('事件名称')).toBeInTheDocument()
    }, { timeout: 3000 })

    await fireEvent.update(within(pane).getByPlaceholderText('事件名称'), '贞观之治')
    await fireEvent.update(within(pane).getByPlaceholderText('具体事件描述...'), '唐太宗即位后励精图治，开创盛世。')
    await fireEvent.click(screen.getByRole('button', { name: '添加' }))

    await waitFor(() => {
      const events = emitted().import
      expect(events).toBeTruthy()
      const articles = (events[0] as any[])[0]
      expect(articles).toHaveLength(1)
      expect(articles[0].title).toBe('贞观之治')
      expect(articles[0].category).toBe('politics')
    }, { timeout: 3000 })
  })

  it('手动添加-知识条目保存到知识库 store.addCustomItem', async () => {
    await setup()
    const pane = document.getElementById('pane-manual') as HTMLElement

    await fireEvent.click(within(pane).getByText('知识条目'))
    await waitFor(() => {
      expect(within(pane).getByPlaceholderText('如：水的化学式')).toBeInTheDocument()
    }, { timeout: 3000 })

    await fireEvent.update(within(pane).getByPlaceholderText('如：水的化学式'), '水的化学式')
    await fireEvent.update(within(pane).getByPlaceholderText('请输入答案或释义...'), 'H₂O')
    await fireEvent.click(screen.getByRole('button', { name: '添加' }))

    await waitFor(() => {
      expect(mockKnowledgeStore.addCustomItem).toHaveBeenCalledWith(
        expect.objectContaining({ question: '水的化学式', answer: 'H₂O' }),
      )
    }, { timeout: 3000 })
  })
})
