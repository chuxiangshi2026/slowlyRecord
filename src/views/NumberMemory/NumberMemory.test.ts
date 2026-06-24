// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import '@testing-library/jest-dom'
import NumberMemory from './NumberMemory.vue'
import {
  getAllAssociations,
  getTrainingProgress,
  clearTrainingProgress,
} from '@/utils/number-memory-db'

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
  getAssociationByNumber: vi.fn(() => null),
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
  getRecommendedImages: vi.fn((num: number) => {
    if (num < 0 || num > 99) return []
    return [{ name: '测试图片', url: '🎯', description: '测试描述' }]
  }),
  getNumberKeyword: vi.fn((num: number) => {
    if (num < 0 || num > 99) return ''
    return '测试关键词'
  }),
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

// Mock words store
vi.mock('@/stores/words', () => ({
  useWordsStore: vi.fn(() => ({
    setLastVisitedPage: vi.fn(),
  })),
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

function setup() {
  const pinia = createPinia()
  setActivePinia(pinia)
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div />' } },
      { path: '/number-memory', component: { template: '<div />' } },
      { path: '/number-memory/training', component: { template: '<div />' } },
      { path: '/number-memory/entries', component: { template: '<div />' } },
    ],
  })

  const result = render(NumberMemory, {
    global: {
      plugins: [pinia, router],
      stubs: {
        'el-card': {
          template: '<div class="el-card-stub"><slot name="header" /><slot /></div>',
        },
        'el-tag': {
          props: ['type'],
          template: '<span class="el-tag-stub" :class="type"><slot /></span>',
        },
        'el-button': {
          props: ['type', 'size', 'disabled', 'plain'],
          template: '<button class="el-button-stub" :disabled="disabled" :data-type="type"><slot /></button>',
        },
        'el-alert': {
          props: ['title', 'type', 'closable', 'showIcon', 'center'],
          template: '<div class="el-alert-stub" :class="type" role="alert"><slot />{{ title }}</div>',
        },
        'el-radio-group': {
          props: ['modelValue', 'size'],
          template: '<div class="el-radio-group-stub" role="radiogroup"><slot /></div>',
        },
        'el-radio-button': {
          props: ['label'],
          template: '<label class="el-radio-button-stub" :data-label="label"><slot /></label>',
        },
        'el-row': {
          props: ['gutter'],
          template: '<div class="el-row-stub"><slot /></div>',
        },
        'el-col': {
          props: ['span'],
          template: '<div class="el-col-stub"><slot /></div>',
        },
        'el-empty': {
          props: ['description', 'imageSize'],
          template: '<div class="el-empty-stub">{{ description }}</div>',
        },
        'el-divider': {
          template: '<hr class="el-divider-stub" />',
        },
        'el-upload': {
          props: ['action', 'autoUpload', 'showFileList', 'accept'],
          template: '<div class="el-upload-stub"><slot /></div>',
        },
        'el-icon': {
          template: '<span class="el-icon-stub"><slot /></span>',
        },
        'el-table': {
          props: ['data'],
          template: '<div class="el-table-stub"><slot /></div>',
        },
        'el-table-column': {
          props: ['prop', 'label', 'width', 'align'],
          template: '<div class="el-table-column-stub"><slot name="default" :row="{}" /></div>',
        },
        TrainingHistory: {
          props: ['modelValue', 'history', 'progress'],
          emits: ['update:modelValue', 'clear', 'continue', 'abandon'],
          template: `
            <div v-if="modelValue" class="training-history-stub" role="dialog" aria-modal="true">
              <div class="el-dialog__header">📊 训练状态</div>
              <div class="el-dialog__body"><slot /></div>
              <div class="el-dialog__footer">
                <button @click="$emit('update:modelValue', false)">关闭</button>
                <button v-if="history.length > 0" @click="$emit('clear')">清空历史</button>
                <button @click="$emit('continue')">继续训练</button>
                <button @click="$emit('abandon')">放弃进度</button>
              </div>
            </div>
          `,
        },
        QuickStartGuide: {
          props: ['modelValue'],
          emits: ['finish'],
          template: '<div v-if="modelValue" class="quick-start-guide-stub"><slot /><button @click="$emit(\'finish\')">完成</button></div>',
        },
      },
    },
  })

  return { ...result, user: userEvent.setup(), router }
}

describe('NumberMemory 主页面', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(getAllAssociations).mockReturnValue([])
    vi.mocked(getTrainingProgress).mockReturnValue(null)
    localStorageMock.getItem.mockReturnValue('shown') // 跳过新手引导
  })

  describe('页面渲染', () => {
    it('应显示页面标题', () => {
      setup()
      expect(screen.getByText('🧠 数字记忆训练')).toBeInTheDocument()
    })

    it('应显示主要操作按钮', () => {
      setup()
      expect(screen.getByRole('button', { name: /使用帮助/ })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /训练历史/ })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /一键导入预设/ })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /数字记忆/ })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /开始训练/ })).toBeInTheDocument()
    })

    it('没有关联数据时开始训练按钮应被禁用', async () => {
      setup()
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /开始训练/ })).toBeDisabled()
      })
    })
  })

  describe('未完成的训练进度', () => {
    it('有未完成训练时应显示进度提示', async () => {
      vi.mocked(getTrainingProgress).mockReturnValue({
        _id: 'progress_1',
        type: 'number_memory_progress',
        mode: 'numberToImage',
        questions: [{}, {}, {}, {}, {}],
        currentQuestionIndex: 2,
        answerResults: [],
        elapsedTime: 60,
        hasAnswered: false,
        selectedAnswer: null,
        isCorrect: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })

      setup()

      await waitFor(() => {
        // 完整文本形如 "未完成的训练：数字→图片（第 3/5 题）"，整段在同一文本节点，
        // 用正则匹配比 getByText('数字→图片') 更稳，后者要求文本独占一个节点
        expect(screen.getByText(/未完成的训练/)).toBeInTheDocument()
        expect(screen.getByText(/数字→图片/)).toBeInTheDocument()
        expect(screen.getByText(/第 3\/5 题/)).toBeInTheDocument()
      })
    })

    it('没有未完成训练时不应显示进度提示', async () => {
      setup()
      await waitFor(() => {
        expect(screen.queryByText(/未完成的训练/)).not.toBeInTheDocument()
      })
    })

    it('应显示继续训练和放弃进度按钮', async () => {
      vi.mocked(getTrainingProgress).mockReturnValue({
        _id: 'progress_1',
        type: 'number_memory_progress',
        mode: 'numberToImage',
        questions: [{}, {}],
        currentQuestionIndex: 0,
        answerResults: [],
        elapsedTime: 0,
        hasAnswered: false,
        selectedAnswer: null,
        isCorrect: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })

      setup()

      await waitFor(() => {
        expect(screen.getByRole('button', { name: '继续训练' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: '放弃进度' })).toBeInTheDocument()
      })
    })

    it('点击继续训练应导航到训练页面', async () => {
      vi.mocked(getTrainingProgress).mockReturnValue({
        _id: 'progress_1',
        type: 'number_memory_progress',
        mode: 'numberToImage',
        questions: [{}, {}],
        currentQuestionIndex: 0,
        answerResults: [],
        elapsedTime: 0,
        hasAnswered: false,
        selectedAnswer: null,
        isCorrect: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })

      const { user, router } = setup()
      const pushSpy = vi.spyOn(router, 'push')

      await waitFor(() => {
        expect(screen.getByRole('button', { name: '继续训练' })).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: '继续训练' }))

      expect(pushSpy).toHaveBeenCalledWith('/number-memory/training')
    })

    it('点击放弃进度应清除训练进度', async () => {
      vi.mocked(getTrainingProgress).mockReturnValue({
        _id: 'progress_1',
        type: 'number_memory_progress',
        mode: 'numberToImage',
        questions: [{}, {}],
        currentQuestionIndex: 0,
        answerResults: [],
        elapsedTime: 0,
        hasAnswered: false,
        selectedAnswer: null,
        isCorrect: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })

      const { user } = setup()

      await waitFor(() => {
        expect(screen.getByRole('button', { name: '放弃进度' })).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: '放弃进度' }))

      expect(clearTrainingProgress).toHaveBeenCalled()
    })
  })

  describe('训练历史弹窗', () => {
    it('点击训练历史按钮应打开弹窗', async () => {
      const { user } = setup()
      await user.click(screen.getByRole('button', { name: /训练历史/ }))
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument()
        expect(screen.getByText('📊 训练状态')).toBeInTheDocument()
      })
    })
  })

  describe('导航', () => {
    it('点击数字记忆按钮应导航到条目页面', async () => {
      const { user, router } = setup()
      const pushSpy = vi.spyOn(router, 'push')

      await user.click(screen.getByRole('button', { name: /数字记忆/ }))

      expect(pushSpy).toHaveBeenCalledWith('/number-memory/entries')
    })

    it('有关联数据时点击开始训练应导航到训练页面', async () => {
      vi.mocked(getAllAssociations).mockReturnValue([
        { number: '0', imageUrl: '🎯', source: 'preset', description: '零' },
      ])

      const { user, router } = setup()
      const pushSpy = vi.spyOn(router, 'push')

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /开始训练/ })).toBeEnabled()
      })

      await user.click(screen.getByRole('button', { name: /开始训练/ }))

      expect(pushSpy).toHaveBeenCalledWith('/number-memory/training')
    })
  })

  describe('已保存关联列表', () => {
    it('有关联数据时应显示已保存的数字-图片关联', async () => {
      vi.mocked(getAllAssociations).mockReturnValue([
        { number: '0', imageUrl: '🎯', source: 'preset', description: '零' },
        { number: '1', imageUrl: '🍄', source: 'upload', description: '一' },
      ])

      setup()

      await waitFor(() => {
        expect(screen.getByText('📋 已保存的数字-图片关联')).toBeInTheDocument()
      })
    })

    it('没有关联数据时不应显示关联列表', async () => {
      setup()
      await waitFor(() => {
        expect(screen.queryByText('📋 已保存的数字-图片关联')).not.toBeInTheDocument()
      })
    })
  })

  describe('用户工作流', () => {
    it('完整流程：进入页面→看到进度→点击继续→跳转训练', async () => {
      vi.mocked(getTrainingProgress).mockReturnValue({
        _id: 'progress_1',
        type: 'number_memory_progress',
        mode: 'numberToImage',
        questions: [{}, {}, {}],
        currentQuestionIndex: 0,
        answerResults: [],
        elapsedTime: 0,
        hasAnswered: false,
        selectedAnswer: null,
        isCorrect: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })

      const { user, router } = setup()
      const pushSpy = vi.spyOn(router, 'push')

      // 步骤1：看到进度提示
      await waitFor(() => {
        expect(screen.getByText(/未完成的训练/)).toBeInTheDocument()
      })

      // 步骤2：点击继续训练
      await user.click(screen.getByRole('button', { name: '继续训练' }))

      // 步骤3：确认跳转
      expect(pushSpy).toHaveBeenCalledWith('/number-memory/training')
    })
  })
})
