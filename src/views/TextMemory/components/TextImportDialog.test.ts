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

// TextImportDialog 直接引用但当前未使用的 words store，避免其模块依赖链
vi.mock('@/stores/words', () => ({
  useWordsStore: () => ({}),
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

// 地图 tab 未激活时不会调用 L.*，桩掉即可
vi.mock('leaflet', () => ({ default: {} }))
vi.mock('leaflet/dist/leaflet.css', () => ({}))

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
    loadImportedIds: vi.fn(() => Promise.resolve()),
    importPack: vi.fn((id: string) => {
      if (!mockKnowledgeStore.importedIds.includes(id)) mockKnowledgeStore.importedIds.push(id)
      return Promise.resolve()
    }),
  })

  mockPalaceStore = reactive({
    palaces: [...(options.palaces ?? [])],
    listPegPacks: () => [...PEG_PACKS],
    loadPalaces: vi.fn(() => Promise.resolve()),
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

describe('TextImportDialog（统一添加/导入入口）', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('包含手动添加/知识库/宫殿桩库等并列 tab，默认定位手动添加', async () => {
    await setup()

    const tabTexts = Array.from(document.querySelectorAll('.el-tabs__item')).map(el => el.textContent?.trim())
    for (const label of ['手动添加', '批量导入', '文件导入', '诗词库', '成语库', '时间线', '地图', '知识库', '宫殿桩库']) {
      expect(tabTexts).toContain(label)
    }
    // 手动添加为第一个且默认激活
    expect(tabTexts[0]).toBe('手动添加')
    expect(activeTabLabel()).toBe('手动添加')
  })

  it('initialTab=knowledge 时定位知识库 tab，已导入包显示禁用态', async () => {
    await setup({ props: { initialTab: 'knowledge' }, knowledgeImportedIds: ['pack-text'] })

    await waitFor(() => {
      expect(activeTabLabel()).toBe('知识库')
    }, { timeout: 3000 })

    const pane = document.getElementById('pane-knowledge') as HTMLElement
    expect(pane).toBeTruthy()
    expect(within(pane).getByText('二十四节气')).toBeInTheDocument()
    expect(within(pane).getByText('唐诗精选')).toBeInTheDocument()

    // 已导入的包按钮为「已导入」且禁用
    const importedBtn = within(pane).getByRole('button', { name: '已导入' })
    expect(importedBtn).toBeDisabled()
  })

  it('initialTab=pegPacks 时定位宫殿桩库 tab，已有对应宫殿的显示已导入', async () => {
    await setup({
      props: { initialTab: 'pegPacks' },
      palaces: [{ _id: 'palace-1', name: '二十四节气', loci: [], sourcePackId: 'pack-text', ctime: 1, utime: 1 }],
    })

    await waitFor(() => {
      expect(activeTabLabel()).toBe('宫殿桩库')
    }, { timeout: 3000 })

    const pane = document.getElementById('pane-pegPacks') as HTMLElement
    expect(within(pane).getByText('二十四节气')).toBeInTheDocument()
    expect(within(pane).getByRole('button', { name: '已导入' })).toBeDisabled()
  })

  it('知识库 tab 点击导入调用 knowledgeMemory store.importPack', async () => {
    await setup({ props: { initialTab: 'knowledge' } })

    const pane = document.getElementById('pane-knowledge') as HTMLElement
    const row = within(pane).getByText('二十四节气').closest('.import-pack-row') as HTMLElement
    await fireEvent.click(within(row).getByRole('button', { name: '导入' }))

    expect(mockKnowledgeStore.importPack).toHaveBeenCalledWith('pack-text')
  })

  it('宫殿桩库 tab 点击导入调用 memoryPalace store.importPackAsPalace', async () => {
    await setup({ props: { initialTab: 'pegPacks' } })

    const pane = document.getElementById('pane-pegPacks') as HTMLElement
    await fireEvent.click(within(pane).getByRole('button', { name: '导入' }))
    await waitFor(() => {
      expect(mockPalaceStore.importPackAsPalace).toHaveBeenCalledWith('pack-text')
    }, { timeout: 3000 })
  })

  it('手动添加表单提交后 emit import 单篇文章', async () => {
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
})
