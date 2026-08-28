// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import '@testing-library/jest-dom'
import ShortcutMemoryTraining from './ShortcutMemoryTraining.vue'

const hoisted = vi.hoisted(() => {
  const QUESTION = {
    id: '1',
    category: 'Windows',
    functionName: '复制',
    description: '复制选中的内容到剪贴板',
    keys: ['Ctrl', 'C'],
    platform: 'common' as const,
  }
  return {
    QUESTION,
    store: {
      currentCategory: 'Windows',
      currentGroup: '',
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
  }
})
const QUESTION = hoisted.QUESTION

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

async function setup(mode = 'keyPress', query: { type?: string; zone?: string } = {}) {
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
  const q = new URLSearchParams({ mode })
  if (query.type) q.set('type', query.type)
  if (query.zone) q.set('zone', query.zone)
  await router.push(`/shortcut-memory/training?${q.toString()}`)
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
    hoisted.store.currentGroup = ''
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
      expect(hoisted.store.initKeyPressTraining).toHaveBeenCalledWith('Windows', 0, { type: undefined, zone: undefined })
      expect(hoisted.store.showCurrentQuestion).toHaveBeenCalled()
    })

    it('带 type/zone 查询参数时应把标签筛选传入训练初始化', async () => {
      await setup('keyPress', { type: '字根', zone: '横区' })
      expect(hoisted.store.initKeyPressTraining).toHaveBeenCalledWith('Windows', 0, { type: '字根', zone: '横区' })
    })
  })

  describe('功能选择模式', () => {
    it('应显示选择提示与选项', async () => {
      await setup('functionSelect')
      expect(screen.getByText(/🔄 反向训练/)).toBeInTheDocument()
      expect(screen.getByText('请选择这个快捷键对应的功能描述')).toBeInTheDocument()
      // 选项（功能名称）应渲染（用 .option-name 精确匹配，避免与功能名"复制"重复）
      expect(screen.getByText('复制', { selector: '.option-name' })).toBeInTheDocument()
      expect(screen.getByText('粘贴', { selector: '.option-name' })).toBeInTheDocument()
    })

    it('点击选项应调用 checkFunctionSelect', async () => {
      const { user } = await setup('functionSelect')
      await waitFor(() => expect(screen.getByText('复制', { selector: '.option-name' })).toBeInTheDocument())
      await user.click(screen.getByRole('button', { name: /复制/ }))
      expect(hoisted.store.checkFunctionSelect).toHaveBeenCalledWith('1')
    })

    it('挂载时应初始化功能选择训练', async () => {
      await setup('functionSelect')
      expect(hoisted.store.initFunctionSelectTraining).toHaveBeenCalledWith('Windows', 0, { type: undefined, zone: undefined })
    })
  })

  describe('返回', () => {
    it('点击返回应跳转回列表页并携带分类', async () => {
      const { user, pushSpy } = await setup('keyPress')
      await user.click(screen.getByRole('button', { name: /返回/ }))
      expect(pushSpy).toHaveBeenCalledWith({ path: '/shortcut-memory', query: { category: 'Windows' } })
    })

    it('返回时应携带域与标签筛选', async () => {
      hoisted.store.currentGroup = '系统'
      const { user, pushSpy } = await setup('keyPress', { type: '一级简码', zone: '横区' })
      await user.click(screen.getByRole('button', { name: /返回/ }))
      expect(pushSpy).toHaveBeenCalledWith({
        path: '/shortcut-memory',
        query: { group: '系统', category: 'Windows', type: '一级简码', zone: '横区' },
      })
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
