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
  VideoPlay: { template: '<span>play</span>' },
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

async function setup(packId: string, items: any[], options: { enterPractice?: boolean } = {}) {
  const { enterPractice = true } = options
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

  // 默认进入预览视图；需要练习视图的用例切到「练习」
  if (enterPractice) {
    await fireEvent.click(screen.getByText('练习', { selector: '.view-chip' }))
    await flushPromises()
  }

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

  it('默认进入预览视图：显示整表与「开始练习」，点击后切到练习视图', async () => {
    await setup('test-pack', [
      { id: 'i1', question: 'Q1', answer: 'A1' },
    ], { enterPractice: false })

    // 预览：通用表格含题目/答案，练习统计不显示
    expect(screen.getByText('开始练习')).toBeInTheDocument()
    expect(screen.getByText('Q1', { selector: '.preview-table td' })).toBeInTheDocument()
    expect(screen.getByText('A1', { selector: '.preview-table td' })).toBeInTheDocument()
    expect(screen.queryByText('已掌握')).not.toBeInTheDocument()

    await fireEvent.click(screen.getByText('开始练习'))
    await flushPromises()
    expect(screen.getByText('已掌握')).toBeInTheDocument()
  })

  it('乘法表包预览渲染方正方阵（首行/首列乘数表头，交叉格为积）', async () => {
    const items = []
    for (let a = 1; a <= 2; a++) {
      for (let b = 1; b <= 2; b++) {
        items.push({ id: `m-${a}-${b}`, question: `${a}×${b}`, answer: String(a * b) })
      }
    }
    const { container } = await setup('multiplication-9x9', items, { enterPractice: false })

    const table = container.querySelector('.mult-grid')!
    expect(table).toBeTruthy()
    const headerCells = table.querySelectorAll('thead th')
    expect(headerCells).toHaveLength(3) // 角标 + 乘数 1、2
    expect(headerCells[1].textContent).toBe('1')
    expect(headerCells[2].textContent).toBe('2')

    const bodyRows = table.querySelectorAll('tbody tr')
    expect(bodyRows).toHaveLength(2)
    // 第二行行头为乘数 2，交叉格 2×2=4
    expect(bodyRows[1].querySelector('th')!.textContent).toBe('2')
    expect(bodyRows[1].querySelectorAll('td')[1].textContent).toBe('4')
  })

  it('元素周期表包预览按周期律排布（符号 + 中文名 + 序数）', async () => {
    const items = [
      { id: 'elements-H', question: 'H', answer: '氢', extras: { '序数': '1' } },
      { id: 'elements-He', question: 'He', answer: '氦', extras: { '序数': '2' } },
    ]
    const { container } = await setup('elements', items, { enterPractice: false })

    const cells = container.querySelectorAll('.periodic-table .element-cell:not(.empty)')
    expect(cells).toHaveLength(2)
    expect(cells[0].textContent).toContain('1')
    expect(cells[0].textContent).toContain('H')
    expect(cells[0].textContent).toContain('氢')
    expect(cells[1].textContent).toContain('He')
  })

  it('math-formulas 预览：行内函数按钮与顶部汇总入口可见', async () => {
    const { container } = await setup('math-formulas', [
      { id: 'math-formulas-21', question: '一次函数', answer: 'y=2x+1' },
      { id: 'math-formulas-99', question: '未映射', answer: '无' },
    ], { enterPractice: false })

    // 顶部汇总入口
    expect(screen.getByText('函数图像')).toBeInTheDocument()
    // 仅映射条目行内有函数按钮
    expect(container.querySelectorAll('[title="查看函数图像"]')).toHaveLength(1)

    // 点击汇总入口列出可绘制函数
    await fireEvent.click(screen.getByText('函数图像'))
    await flushPromises()
    expect(screen.getByText('一次函数', { selector: '.plot-list-item .q' })).toBeInTheDocument()
  })

  it('无可绘制函数的包预览不显示函数图像入口', async () => {
    await setup('test-pack', [
      { id: 'i1', question: 'Q1', answer: 'A1' },
    ], { enterPractice: false })
    expect(screen.queryByText('函数图像')).not.toBeInTheDocument()
  })
})
