// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/vue'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import '@testing-library/jest-dom'
import { flushPromises } from '@vue/test-utils'
import KnowledgeMemoryPack from './KnowledgeMemoryPack.vue'
import { useKnowledgeMemoryStore } from '@/stores/knowledgeMemory'

const hoisted = vi.hoisted(() => {
  return {
    exportTableAsImage: vi.fn(() => Promise.resolve()),
    saveProgressDoc: vi.fn(() => Promise.resolve()),
    getProgressDoc: vi.fn(() => ({
      _id: '',
      type: 'knowledge_pack_progress',
      packId: '',
      items: {},
    })),
  }
})

vi.mock('@/utils/table-image-export', () => ({
  exportTableAsImage: hoisted.exportTableAsImage,
}))

vi.mock('@/utils/knowledge-memory-db', () => ({
  saveProgressDoc: hoisted.saveProgressDoc,
  getProgressDoc: hoisted.getProgressDoc,
}))

vi.mock('@/stores/words', () => ({
  useWordsStore: vi.fn(() => ({ memoryFirmness: '正常' })),
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
  ArrowLeft: { template: '<span>←</span>' },
  Printer: { template: '<span>printer</span>' },
  Picture: { template: '<span>picture</span>' },
  View: { template: '<span>view</span>' },
  CircleCheck: { template: '<span>check</span>' },
  CircleClose: { template: '<span>close</span>' },
  RefreshRight: { template: '<span>refresh</span>' },
  TrendCharts: { template: '<span>trend</span>' },
}))

const ElDialogStub = {
  props: ['modelValue', 'title'],
  template: '<div class="el-dialog-stub"><slot /></div>',
}

// el-input 未注册 ElementPlus，用真实 <input> stub 让 v-model / placeholder 查询生效
const ElInputStub = {
  props: ['modelValue', 'placeholder'],
  emits: ['update:modelValue'],
  template:
    '<input :value="modelValue" :placeholder="placeholder" @input="$emit(\'update:modelValue\', $event.target.value)" />',
}

async function setup(packId: string, items: any[]) {
  const pinia = createPinia()
  setActivePinia(pinia)

  const store = useKnowledgeMemoryStore(pinia)
  const pack = {
    id: packId,
    name: '测试知识包',
    description: '测试描述',
    ordered: false,
    usableAsPeg: false,
    items,
  }
  store.$patch({
    packs: { [packId]: pack },
    loadedSet: new Set([packId]),
    progress: {},
  })
  store.markItem = vi.fn(() => Promise.resolve({ ok: true, progress: {} as any }))

  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div />' } },
      { path: '/knowledge-memory/:id', component: KnowledgeMemoryPack },
    ],
  })
  await router.push(`/knowledge-memory/${packId}`)
  await router.isReady()

  vi.clearAllMocks()
  const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {})

  const result = render(KnowledgeMemoryPack, {
    global: {
      plugins: [pinia, router],
      stubs: {
        'el-dialog': ElDialogStub,
        'el-input': ElInputStub,
      },
    },
  })
  await flushPromises()

  return { ...result, store, printSpy }
}

describe('KnowledgeMemoryPack', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('渲染知识包头部、统计与打印/存图按钮', async () => {
    await setup('test-pack', [
      { id: 'i1', question: 'Q1', answer: 'A1' },
    ])

    expect(screen.getByText('测试知识包', { selector: 'h2' })).toBeInTheDocument()
    expect(screen.getByText('打印')).toBeInTheDocument()
    expect(screen.getByText('存图')).toBeInTheDocument()
    expect(screen.getByText('已掌握')).toBeInTheDocument()
    expect(screen.getByText('待复习')).toBeInTheDocument()
    expect(screen.getByText('当前进度')).toBeInTheDocument()
  })

  it('四选一模式：选择答案后显示反馈并标记进度', async () => {
    const { store } = await setup('test-pack', [
      { id: 'i1', question: '2×3', answer: '6' },
    ])

    // 问题文本同时出现在练习卡与打印表中，取练习卡内出现处确认当前题目
    await waitFor(() => {
      expect(screen.getAllByText('2×3').length).toBeGreaterThan(0)
    })
    await fireEvent.click(screen.getByText('四选一'))

    // 单条目包 → 唯一选项即正确答案
    const option = await waitFor(() => screen.getByText('6', { selector: '.option-btn' }))
    await fireEvent.click(option)

    await waitFor(() => {
      expect(screen.getByText('回答正确')).toBeInTheDocument()
    })
    expect(store.markItem).toHaveBeenCalledWith('test-pack', 'i1', true)
  })

  it('输入模式：全角答案被判定为正确并标记进度', async () => {
    const { store } = await setup('test-pack', [
      { id: 'i1', question: '等于', answer: '6' },
    ])

    await fireEvent.click(screen.getByText('输入模式'))
    await waitFor(() => {
      expect(screen.getAllByText('等于').length).toBeGreaterThan(0)
    })

    // 全角数字输入 → 归一化为半角后与答案 6 匹配
    const input = screen.getByPlaceholderText('输入答案...') as HTMLInputElement
    await fireEvent.update(input, '６')
    await fireEvent.click(screen.getByText('提交'))

    await waitFor(() => {
      expect(screen.getByText('回答正确')).toBeInTheDocument()
    })
    expect(store.markItem).toHaveBeenCalledWith('test-pack', 'i1', true)
  })

  it('math-formulas 包中已映射条目显示函数图像按钮，非映射条目不显示', async () => {
    await setup('math-formulas', [
      { id: 'math-formulas-21', question: '一次函数', answer: 'y=2x+1' },
    ])
    expect(screen.getByText('函数图像')).toBeInTheDocument()
  })

  it('非映射条目不显示函数图像按钮', async () => {
    await setup('math-formulas', [
      { id: 'math-formulas-99', question: '未映射', answer: '无' },
    ])
    expect(screen.queryByText('函数图像')).not.toBeInTheDocument()
  })

  it('打印按钮触发系统打印', async () => {
    const { printSpy } = await setup('test-pack', [
      { id: 'i1', question: 'Q1', answer: 'A1' },
    ])

    await fireEvent.click(screen.getByText('打印'))
    await waitFor(() => {
      expect(printSpy).toHaveBeenCalled()
    })
  })

  it('存图按钮调用表格导出', async () => {
    await setup('test-pack', [
      { id: 'i1', question: 'Q1', answer: 'A1' },
    ])

    await fireEvent.click(screen.getByText('存图'))
    await waitFor(() => {
      expect(hoisted.exportTableAsImage).toHaveBeenCalledWith(
        expect.objectContaining({
          title: '测试知识包',
          columns: expect.arrayContaining([
            expect.objectContaining({ header: '题目', values: ['Q1'] }),
            expect.objectContaining({ header: '答案', values: ['A1'] }),
          ]),
        }),
        { filename: '测试知识包' },
      )
    })
  })
})
