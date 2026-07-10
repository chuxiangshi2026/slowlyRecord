// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import '@testing-library/jest-dom'
import ShortcutMemory from './ShortcutMemory.vue'

// 共享的 mock store 对象（vi.hoisted 保证在 vi.mock 工厂之前初始化）
const hoisted = vi.hoisted(() => ({
  store: {
    groups: [
      { name: '系统', icon: '🪟', description: '操作系统与基础键位', order: 1, categoryCount: 2, count: 12 },
      { name: '开发', icon: '💻', description: '编辑器、IDE 与开发工具', order: 2, categoryCount: 5, count: 30 },
    ],
    categories: [
      { name: 'Windows', group: '系统', description: 'Windows 操作系统常用快捷键', icon: '🪟', count: 10 },
      { name: '键位练习', group: '系统', description: '随机练习键盘上的任意按键', icon: '⌨️', count: 2 },
      { name: 'VS Code', group: '开发', description: 'Visual Studio Code 编辑器快捷键', icon: '📝', count: 20 },
    ],
    currentShortcuts: [] as any[],
    currentCategory: '',
    currentShortcutCount: 0,
    selectGroup: vi.fn(),
    selectCategory: vi.fn(),
    addCustomShortcut: vi.fn(() => Promise.resolve({ ok: true, id: 'id', rev: 'rev' })),
    deleteCustomShortcut: vi.fn(() => Promise.resolve({ ok: true, id: '', rev: '' })),
    clearCategoryProgress: vi.fn(() => Promise.resolve({ ok: true, id: '', rev: '' })),
    clearWrongItemsAction: vi.fn(() => Promise.resolve({ ok: true, id: '', rev: '' })),
    getCategoryProgress: vi.fn(() => 0),
    getTrainingHistory: vi.fn(() => []),
    getMasteredIds: vi.fn(() => []),
    getWrongItemsCount: vi.fn(() => 0),
  },
}))

vi.mock('@/stores/shortcutMemory', () => ({
  useShortcutMemoryStore: vi.fn(() => hoisted.store),
}))

vi.mock('element-plus', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    ElMessageBox: {
      confirm: vi.fn(() => Promise.resolve()),
    },
    ElMessage: {
      success: vi.fn(),
      error: vi.fn(),
      warning: vi.fn(),
      info: vi.fn(),
    },
  }
})

vi.mock('@/utils/logger', () => ({
  log: { i: vi.fn(), e: vi.fn(), w: vi.fn(), d: vi.fn() },
}))

vi.mock('@/utils/shortcut-memory-data', () => ({
  getShortcutsByCategory: vi.fn(() => []),
}))

vi.mock('@/utils/shortcut-memory-db', () => ({
  getAllCustomCategories: vi.fn(() => []),
}))

vi.mock('@element-plus/icons-vue', () => ({
  ArrowLeft: { template: '<span>←</span>' },
  Search: { template: '<span>🔍</span>' },
}))

// 子组件单独测试，这里桩掉避免引入额外依赖
vi.mock('./components/KeyboardVisual.vue', () => ({
  default: { template: '<div class="keyboard-visual-stub" />' },
}))
vi.mock('./components/KeyCaptureInput.vue', () => ({
  default: { template: '<div class="key-capture-input-stub" />' },
}))

function setup() {
  const pinia = createPinia()
  setActivePinia(pinia)
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div />' } },
      { path: '/shortcut-memory', component: { template: '<div />' } },
      { path: '/shortcut-memory/training', component: { template: '<div />' } },
    ],
  })

  const result = render(ShortcutMemory, {
    global: {
      plugins: [pinia, router],
      stubs: {
        'el-card': {
          template: '<div class="el-card-stub"><slot name="header" /><slot /></div>',
        },
        'el-tag': {
          props: ['type', 'size'],
          template: '<span class="el-tag-stub" :class="type"><slot /></span>',
        },
        'el-button': {
          props: ['type', 'size', 'disabled', 'plain', 'text'],
          template: '<button class="el-button-stub" :disabled="disabled" :data-type="type"><slot /></button>',
        },
        'el-alert': {
          props: ['title', 'type', 'closable', 'showIcon', 'center'],
          template: '<div class="el-alert-stub" :class="type" role="alert"><slot />{{ title }}</div>',
        },
        'el-icon': { template: '<span class="el-icon-stub"><slot /></span>' },
        'el-progress': {
          props: ['percentage', 'strokeWidth', 'showText'],
          template: '<div class="el-progress-stub" :data-percentage="percentage" />',
        },
        'el-input': {
          props: ['modelValue', 'placeholder', 'clearable'],
          template: '<input class="el-input-stub" :value="modelValue" :placeholder="placeholder" />',
        },
        'el-radio-group': {
          props: ['modelValue', 'size'],
          template: '<div class="el-radio-group-stub" role="radiogroup"><slot /></div>',
        },
        'el-radio-button': {
          props: ['label'],
          template: '<label class="el-radio-button-stub" :data-label="label"><slot /></label>',
        },
        'el-select': {
          props: ['modelValue', 'placeholder'],
          template: '<div class="el-select-stub"><slot /></div>',
        },
        'el-option': {
          props: ['label', 'value'],
          template: '<div class="el-option-stub" :data-value="value">{{ label }}</div>',
        },
        'el-form': {
          props: ['model', 'rules', 'labelWidth', 'ref'],
          template: '<form class="el-form-stub"><slot /></form>',
        },
        'el-form-item': {
          props: ['label', 'prop', 'rules'],
          template: '<div class="el-form-item-stub"><span class="el-form-item-label">{{ label }}</span><slot /></div>',
        },
        'el-table': {
          props: ['data', 'stripe', 'style'],
          template: '<div class="el-table-stub"><slot /></div>',
        },
        'el-table-column': {
          props: ['prop', 'label', 'width', 'align', 'type', 'minWidth'],
          template: '<div class="el-table-column-stub">{{ label }}</div>',
        },
        'el-empty': {
          props: ['description', 'imageSize'],
          template: '<div class="el-empty-stub">{{ description }}</div>',
        },
        'el-dialog': {
          props: ['modelValue', 'title', 'width', 'alignCenter'],
          template:
            '<div v-if="modelValue" class="el-dialog-stub" role="dialog"><div class="el-dialog__header">{{ title }}</div><div class="el-dialog__body"><slot /></div><slot name="footer" /></div>',
        },
        'el-timeline': {
          template: '<div class="el-timeline-stub"><slot /></div>',
        },
        'el-timeline-item': {
          props: ['type'],
          template: '<div class="el-timeline-item-stub"><slot /></div>',
        },
        'el-result': {
          props: ['icon', 'title'],
          template: '<div class="el-result-stub"><div class="el-result__title">{{ title }}</div><slot name="sub-title" /><slot name="extra" /></div>',
        },
      },
    },
  })

  return { ...result, user: userEvent.setup(), router }
}

describe('ShortcutMemory 主页面', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    // 重置共享 store 的可变部分
    hoisted.store.currentShortcuts = []
    hoisted.store.currentCategory = ''
    hoisted.store.currentShortcutCount = 0
    hoisted.store.getTrainingHistory.mockReturnValue([])
  })

  describe('页面渲染', () => {
    it('应显示页面标题', () => {
      setup()
      expect(screen.getByText('⌨️ 快捷键记忆训练')).toBeInTheDocument()
    })

    it('应显示所有域（一级分组）卡片', () => {
      setup()
      expect(screen.getByText('系统')).toBeInTheDocument()
      expect(screen.getByText('开发')).toBeInTheDocument()
    })

    it('初始应处于域选择阶段（不显示分类列表）', () => {
      setup()
      // 分类列表标题形如 "XXX - 快捷键列表"，初始不应出现
      expect(screen.queryByText(/快捷键列表/)).not.toBeInTheDocument()
    })
  })

  describe('域 -> 分类 选择流程', () => {
    it('点击域卡片应展示该域下的分类', async () => {
      const { user } = setup()
      await user.click(screen.getByText('系统'))
      await waitFor(() => {
        expect(screen.getByText('Windows')).toBeInTheDocument()
        expect(screen.getByText('键位练习')).toBeInTheDocument()
        // 不同域的分类不应出现
        expect(screen.queryByText('VS Code')).not.toBeInTheDocument()
      })
      expect(hoisted.store.selectGroup).toHaveBeenCalledWith('系统')
    })

    it('点击分类卡片应进入快捷键列表', async () => {
      const { user } = setup()
      await user.click(screen.getByText('系统'))
      await waitFor(() => expect(screen.getByText('Windows')).toBeInTheDocument())
      await user.click(screen.getByText('Windows'))
      await waitFor(() => {
        expect(screen.getByText('Windows - 快捷键列表')).toBeInTheDocument()
      })
      expect(hoisted.store.selectCategory).toHaveBeenCalledWith('Windows')
    })

    it('返回领域按钮可回到域选择', async () => {
      const { user } = setup()
      await user.click(screen.getByText('系统'))
      await waitFor(() => expect(screen.getByText('Windows')).toBeInTheDocument())
      await user.click(screen.getByText('Windows'))
      await waitFor(() => expect(screen.getByText(/快捷键列表/)).toBeInTheDocument())
      // 列表头部有“返回分类”按钮
      await user.click(screen.getByRole('button', { name: /返回分类/ }))
      await waitFor(() => {
        expect(screen.queryByText(/快捷键列表/)).not.toBeInTheDocument()
      })
    })
  })

  describe('训练历史弹窗', () => {
    it('点击训练历史按钮应打开弹窗', async () => {
      const { user } = setup()
      await user.click(screen.getByRole('button', { name: /训练历史/ }))
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument()
        expect(screen.getByText('训练历史', { selector: '.el-dialog__header' })).toBeInTheDocument()
      })
    })

    it('无训练记录时应显示空状态', async () => {
      hoisted.store.getTrainingHistory.mockReturnValue([])
      const { user } = setup()
      await user.click(screen.getByRole('button', { name: /训练历史/ }))
      await waitFor(() => {
        expect(screen.getByText('暂无训练记录')).toBeInTheDocument()
      })
    })
  })

  describe('新增分类弹窗', () => {
    it('点击新增分类按钮应打开分类管理弹窗', async () => {
      const { user } = setup()
      await user.click(screen.getByRole('button', { name: /新增分类/ }))
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument()
        expect(screen.getByText('新增分类', { selector: '.el-dialog__header' })).toBeInTheDocument()
      })
    })
  })
})
