// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { createPinia, setActivePinia } from 'pinia'
import ElementPlus from 'element-plus'
import '@testing-library/jest-dom'
import TrainingHistory from './TrainingHistory.vue'
import type { TrainingResult } from '@/types/number-memory'

// Mock element-plus 消息相关
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

// Mock logger
vi.mock('@/utils/logger', () => ({
  log: { i: vi.fn(), e: vi.fn(), w: vi.fn(), d: vi.fn() },
}))

// Mock number-memory-db
vi.mock('@/utils/number-memory-db', () => ({
  getAllAssociations: vi.fn(() => []),
  saveAssociation: vi.fn(() => Promise.resolve({ ok: true, id: 'test-id' })),
  removeAssociation: vi.fn(() => Promise.resolve({ ok: true, id: 'test-id' })),
  saveTrainingResult: vi.fn(() => Promise.resolve({ ok: true, id: 'test-id' })),
  getAllTrainingResults: vi.fn(() => []),
  getTrainingProgress: vi.fn(() => null),
  clearTrainingProgress: vi.fn(),
  clearAllTrainingResults: vi.fn(),
}))

// Mock number-memory-preset
vi.mock('@/utils/number-memory-preset', () => ({
  getRecommendedImages: vi.fn(() => []),
  getNumberKeyword: vi.fn(() => ''),
  getRandomNumbers: vi.fn(() => []),
  shuffleArray: vi.fn(<T>(arr: T[]) => [...arr]),
}))

// Mock number-memory-entries-db
vi.mock('@/utils/number-memory-entries-db', () => ({
  getAllEntries: vi.fn(() => []),
  createEntry: vi.fn(() => Promise.resolve({ ok: true })),
  updateEntry: vi.fn(() => Promise.resolve({ ok: true })),
  deleteEntry: vi.fn(() => Promise.resolve({ ok: true })),
  getNotesByEntryId: vi.fn(() => []),
  createNote: vi.fn(() => Promise.resolve({ ok: true })),
  updateNote: vi.fn(() => Promise.resolve({ ok: true })),
  deleteNote: vi.fn(() => Promise.resolve({ ok: true })),
  getPromptsByEntryId: vi.fn(() => []),
  createPrompt: vi.fn(() => Promise.resolve({ ok: true })),
  updatePrompt: vi.fn(() => Promise.resolve({ ok: true })),
  deletePrompt: vi.fn(() => Promise.resolve({ ok: true })),
  reorderPrompts: vi.fn(() => Promise.resolve(true)),
}))

// Mock @element-plus/icons-vue
vi.mock('@element-plus/icons-vue', () => ({
  Check: { template: '<span>✓</span>' },
  Delete: { template: '<span>✗</span>' },
  Upload: { template: '<span>↑</span>' },
}))

// Mock vue-router
vi.mock('vue-router', () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    replace: vi.fn(),
  })),
  useRoute: vi.fn(() => ({
    path: '/number-memory',
    params: {},
    query: {},
  })),
  createRouter: vi.fn(() => ({})),
  createMemoryHistory: vi.fn(() => ({})),
}))

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(() => null),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(),
}
Object.defineProperty(global, 'localStorage', { value: localStorageMock })

const sampleResults: TrainingResult[] = [
  {
    _id: 'result_1',
    type: 'number_memory_result',
    mode: 'numberToImage',
    totalQuestions: 10,
    correctAnswers: 8,
    duration: 120,
    details: [],
    createdAt: Date.now() - 86400000,
  },
  {
    _id: 'result_2',
    type: 'number_memory_result',
    mode: 'imageToNumber',
    totalQuestions: 10,
    correctAnswers: 5,
    duration: 90,
    details: [],
    createdAt: Date.now(),
  },
]

function setup(options: {
  history?: TrainingResult[]
  progress?: { mode: string; current: number; total: number } | null
} = {}) {
  const pinia = createPinia()
  setActivePinia(pinia)

  const { history = [], progress = null } = options

  const result = render(TrainingHistory, {
    props: {
      modelValue: true,
      history,
      progress,
    },
    global: {
      plugins: [pinia, ElementPlus],
      stubs: {
        'el-dialog': {
          props: ['modelValue', 'title'],
          template: `
            <div v-if="modelValue" class="el-dialog-stub" role="dialog" aria-modal="true">
              <div class="el-dialog__header">{{ title }}</div>
              <div class="el-dialog__body"><slot /></div>
              <div class="el-dialog__footer"><slot name="footer" /></div>
            </div>
          `,
        },
        'el-card': {
          props: ['size'],
          template: '<div class="el-card-stub"><slot /></div>',
        },
        'el-tag': {
          props: ['type'],
          template: '<span class="el-tag-stub"><slot /></span>',
        },
        'el-button': {
          props: ['type', 'size'],
          template: '<button class="el-button-stub" :type="type"><slot /></button>',
        },
        'el-empty': {
          props: ['description'],
          template: '<div class="el-empty-stub">{{ description }}</div>',
        },
        'el-timeline': {
          template: '<div class="el-timeline-stub"><slot /></div>',
        },
        'el-timeline-item': {
          props: ['timestamp', 'type'],
          template: '<div class="el-timeline-item-stub"><slot /></div>',
        },
      },
    },
  })

  return { ...result, user: userEvent.setup() }
}

describe('TrainingHistory 组件', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  describe('空状态', () => {
    it('没有历史且没有进度时应显示"暂无训练记录"', () => {
      setup({ history: [], progress: null })
      expect(screen.getByText('暂无训练记录')).toBeInTheDocument()
    })
  })

  describe('未完成的训练进度', () => {
    it('有未完成训练时应显示进度区域', () => {
      setup({
        history: [],
        progress: { mode: 'numberToImage', current: 3, total: 10 },
      })

      expect(screen.getByText('📝 未完成的训练')).toBeInTheDocument()
      expect(screen.getByText('数字→图片')).toBeInTheDocument()
      expect(screen.getByText(/第 3\/10 题/)).toBeInTheDocument()
      expect(screen.getByText('进行中')).toBeInTheDocument()
    })

    it('应显示"继续训练"和"放弃进度"按钮', () => {
      setup({
        history: [],
        progress: { mode: 'imageToNumber', current: 1, total: 5 },
      })

      expect(screen.getByRole('button', { name: '继续训练' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '放弃进度' })).toBeInTheDocument()
    })

    it('图片→数字模式应显示正确的标签文字', () => {
      setup({
        history: [],
        progress: { mode: 'imageToNumber', current: 2, total: 8 },
      })

      expect(screen.getByText('图片→数字')).toBeInTheDocument()
    })

    it('点击"继续训练"应触发 continue 事件并关闭弹窗', async () => {
      const { user, emitted } = setup({
        history: [],
        progress: { mode: 'numberToImage', current: 1, total: 5 },
      })

      await user.click(screen.getByRole('button', { name: '继续训练' }))

      expect(emitted()).toHaveProperty('continue')
    })

    it('点击"放弃进度"应弹出确认框并在确认后触发 abandon 事件', async () => {
      const { user, emitted } = setup({
        history: [],
        progress: { mode: 'numberToImage', current: 1, total: 5 },
      })

      await user.click(screen.getByRole('button', { name: '放弃进度' }))

      // ElMessageBox.confirm 被 mock 为自动 resolve
      await waitFor(() => {
        expect(emitted()).toHaveProperty('abandon')
      })
    })
  })

  describe('已完成的训练记录', () => {
    it('有历史记录时应显示已完成记录标题', () => {
      setup({ history: sampleResults, progress: null })

      expect(screen.getByText('📋 已完成记录')).toBeInTheDocument()
    })

    it('应显示每条记录的正确率和模式', () => {
      setup({ history: sampleResults, progress: null })

      // 80% 正确率
      expect(screen.getByText('80%')).toBeInTheDocument()
      // 50% 正确率
      expect(screen.getByText('50%')).toBeInTheDocument()
      // 两条记录的模式标签
      const modeLabels = screen.getAllByText('数字→图片')
      expect(modeLabels.length).toBeGreaterThanOrEqual(1)
      expect(screen.getByText('图片→数字')).toBeInTheDocument()
    })

    it('应显示答对题目数量', () => {
      setup({ history: sampleResults, progress: null })

      expect(screen.getByText('8/10')).toBeInTheDocument()
      expect(screen.getByText('5/10')).toBeInTheDocument()
    })

    it('应显示训练用时', () => {
      setup({ history: sampleResults, progress: null })

      expect(screen.getByText('2分0秒')).toBeInTheDocument()
      expect(screen.getByText('1分30秒')).toBeInTheDocument()
    })
  })

  describe('同时显示进度和历史', () => {
    it('有进度也有历史时应同时显示两个区域', () => {
      setup({
        history: sampleResults,
        progress: { mode: 'numberToImage', current: 3, total: 10 },
      })

      expect(screen.getByText('📝 未完成的训练')).toBeInTheDocument()
      expect(screen.getByText('📋 已完成记录')).toBeInTheDocument()
    })
  })

  describe('清空历史', () => {
    it('有历史记录时应显示"清空历史"按钮', () => {
      setup({ history: sampleResults, progress: null })

      expect(screen.getByRole('button', { name: '清空历史' })).toBeInTheDocument()
    })

    it('没有历史记录时不应显示"清空历史"按钮', () => {
      setup({ history: [], progress: null })

      expect(screen.queryByRole('button', { name: '清空历史' })).not.toBeInTheDocument()
    })

    it('点击"清空历史"应弹出确认框并在确认后触发 clear 事件', async () => {
      const { user, emitted } = setup({ history: sampleResults, progress: null })

      await user.click(screen.getByRole('button', { name: '清空历史' }))

      await waitFor(() => {
        expect(emitted()).toHaveProperty('clear')
      })
    })
  })

  describe('关闭弹窗', () => {
    it('应显示"关闭"按钮', () => {
      setup({ history: [], progress: null })

      expect(screen.getByRole('button', { name: '关闭' })).toBeInTheDocument()
    })

    it('点击"关闭"应关闭弹窗', async () => {
      const { user, emitted } = setup({ history: [], progress: null })

      await user.click(screen.getByRole('button', { name: '关闭' }))

      expect(emitted()).toHaveProperty('update:modelValue')
      expect(emitted()['update:modelValue'][0]).toEqual([false])
    })
  })
})
