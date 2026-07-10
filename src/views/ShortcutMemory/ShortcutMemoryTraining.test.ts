// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import '@testing-library/jest-dom'
import ShortcutMemoryTraining from './ShortcutMemoryTraining.vue'

const QUESTION = {
  id: '1',
  category: 'Windows',
  functionName: '复制',
  description: '复制选中的内容到剪贴板',
  keys: ['Ctrl', 'C'],
  platform: 'common' as const,
}

const hoisted = vi.hoisted(() => ({
  store: {
    currentCategory: 'Windows',
    currentQuestionIndex: 0,
    questions: [QUESTION],
    currentQuestion: QUESTION,
    trainingPhase: 'showing',
    isTrainingComplete: false,
    isWrongItemsTraining: false,
    correctCount: 0,
    wrongCount: 0,
    pressedKeys: new Set<string>(),
    showCurrentQuestion: vi.fn(),
    generateQuizOptions: vi.fn(() => [
      { ...QUESTION },
      { id: '2', category: 'Windows', functionName: '粘贴', description: '将剪贴板内容粘贴', keys: ['Ctrl', 'V'], platform: 'common' as const },
    ]),
    nextQuestion: vi.fn(),
    checkFunctionSelect: vi.fn(() => false),
    checkKeyPress: vi.fn(() => false),
    initKeyPressTraining: vi.fn(),
    initFunctionSelectTraining: vi.fn(),
    initWrongItemsTraining: vi.fn(),
    clearPressedKeys: vi.fn(),
    addPressedKey: vi.fn(),
    removePressedKey: vi.fn(),
    saveTrainingResult: vi.fn(() => Promise.resolve({ ok: true, id: 'id', rev: 'rev' })),
  },
}))

vi.mock('@/stores/shortcutMemory', () => ({
  useShortcutMemoryStore: vi.fn(() => hoisted.store),
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

vi.mock('@/utils/logger', () => ({
  log: { i: vi.fn(), e: vi.fn(), w: vi.fn(), d: vi.fn() },
}))

vi.mock('@element-plus/icons-vue', () => ({
  ArrowLeft: { template: '<span>←</span>' },
  ArrowRight: { template: '<span>→</span>' },
  Warning: { template: '<span>⚠</span>' },
}))

vi.mock('./components/KeyboardVisual.vue', () => ({
  default: { template: '<div class="keyboard-visual-stub" />' },
}))

async function setup(mode = 'keyPress') {
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
  await router.push(`/shortcut-memory/training?mode=${mode}`)
  await router.isReady()

  // 在 render（onMounted）之前安装 spy，以捕获挂载期的路由跳转
  const pushSpy = vi.spyOn(router, 'push')

  const result = render(ShortcutMemoryTraining, {
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
        'el-result': {
          props: ['icon', 'title'],
          template: '<div class="el-result-stub"><div class="el-result__title">{{ title }}</div><slot name="sub-title" /><slot name="extra" /></div>',
        },
      },
    },
  })

  return { ...result, user: userEvent.setup(), router, pushSpy }
}

describe('ShortcutMemoryTraining 训练页面', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    hoisted.store.currentCategory = 'Windows'
    hoisted.store.questions = [QUESTION]
    hoisted.store.currentQuestion = QUESTION
    hoisted.store.trainingPhase = 'showing'
    hoisted.store.isTrainingComplete = false
    hoisted.store.isWrongItemsTraining = false
    hoisted.store.correctCount = 0
    hoisted.store.wrongCount = 0
    hoisted.store.pressedKeys = new Set<string>()
    hoisted.store.generateQuizOptions.mockReturnValue([
      { ...QUESTION },
      { id: '2', category: 'Windows', functionName: '粘贴', description: '将剪贴板内容粘贴', keys: ['Ctrl', 'V'], platform: 'common' as const },
    ])
  })

  describe('按键训练模式', () => {
    it('应显示按键训练标题与键盘', async () => {
      await setup('keyPress')
      expect(screen.getByText(/🎯 按键训练/)).toBeInTheDocument()
      expect(screen.getByText(/- Windows/)).toBeInTheDocument()
      expect(document.querySelector('.keyboard-visual-stub')).not.toBeNull()
    })

    it('挂载时应初始化按键训练', async () => {
      await setup('keyPress')
      expect(hoisted.store.initKeyPressTraining).toHaveBeenCalledWith('Windows')
      expect(hoisted.store.showCurrentQuestion).toHaveBeenCalled()
    })
  })

  describe('功能选择模式', () => {
    it('应显示选择提示与选项', async () => {
      await setup('functionSelect')
      expect(screen.getByText(/🧩 功能选择/)).toBeInTheDocument()
      expect(screen.getByText('请选择这个快捷键对应的功能描述')).toBeInTheDocument()
      // 选项（功能名称）应渲染
      expect(screen.getByText('复制')).toBeInTheDocument()
      expect(screen.getByText('粘贴')).toBeInTheDocument()
    })

    it('点击选项应调用 checkFunctionSelect', async () => {
      const { user } = await setup('functionSelect')
      await waitFor(() => expect(screen.getByText('复制')).toBeInTheDocument())
      await user.click(screen.getByRole('button', { name: /复制/ }))
      expect(hoisted.store.checkFunctionSelect).toHaveBeenCalledWith('1')
    })

    it('挂载时应初始化功能选择训练', async () => {
      await setup('functionSelect')
      expect(hoisted.store.initFunctionSelectTraining).toHaveBeenCalledWith('Windows')
    })
  })

  describe('返回', () => {
    it('点击返回应跳转回列表页', async () => {
      const { user, pushSpy } = await setup('keyPress')
      await user.click(screen.getByRole('button', { name: /返回/ }))
      expect(pushSpy).toHaveBeenCalledWith('/shortcut-memory')
    })
  })

  describe('未选择分类时', () => {
    it('currentCategory 为空应重定向回列表', async () => {
      hoisted.store.currentCategory = ''
      const { pushSpy } = await setup('keyPress')
      await waitFor(() => {
        expect(pushSpy).toHaveBeenCalledWith('/shortcut-memory')
      })
    })
  })
})
