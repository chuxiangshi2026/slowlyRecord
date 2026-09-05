// @vitest-environment jsdom
import {describe, it, expect, afterEach, vi} from 'vitest'
import {render, screen, fireEvent, waitFor} from '@testing-library/vue'
import {createPinia, setActivePinia} from 'pinia'
import {createRouter, createMemoryHistory} from 'vue-router'
import '@testing-library/jest-dom'
import NumberMemoryTraining from './NumberMemoryTraining.vue'

const hoisted = vi.hoisted(() => {
  const numberStore = {
    associationCount: 4,
    loadAssociations: vi.fn(),
    generateNumberToImageQuiz: vi.fn(() => []),
    generateImageToNumberQuiz: vi.fn(() => []),
    saveResult: vi.fn(() => Promise.resolve({ok: true})),
  }
  const wordsStore = {
    setLastVisitedPage: vi.fn(),
  }
  const db = {
    saveTrainingProgress: vi.fn(() => Promise.resolve({ok: true})),
    getTrainingProgress: vi.fn(() => null),
    clearTrainingProgress: vi.fn(),
  }
  const messageBox = {
    confirm: vi.fn(() => Promise.reject('cancel')),
  }
  return {numberStore, wordsStore, db, messageBox}
})

vi.mock('@/stores/numberMemory', () => ({
  useNumberMemoryStore: vi.fn(() => hoisted.numberStore),
}))

vi.mock('@/stores/words', () => ({
  useWordsStore: vi.fn(() => hoisted.wordsStore),
}))

vi.mock('@/utils/number-memory-db', () => ({
  saveTrainingProgress: hoisted.db.saveTrainingProgress,
  getTrainingProgress: hoisted.db.getTrainingProgress,
  clearTrainingProgress: hoisted.db.clearTrainingProgress,
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
    ElMessageBox: hoisted.messageBox,
  }
})

vi.mock('@element-plus/icons-vue', () => ({
  Timer: {template: '<span>timer</span>'},
}))

// el-input 在测试环境未注册 ElementPlus，用真实 <input> stub 让 v-model 生效
const ElInputStub = {
  props: ['modelValue', 'placeholder'],
  emits: ['update:modelValue'],
  template:
    '<input :value="modelValue" :placeholder="placeholder" @input="$emit(\'update:modelValue\', $event.target.value)" />',
}

const ElResultStub = {
  props: ['icon', 'title', 'subTitle'],
  template: '<div class="el-result-stub"><h3>{{ title }}</h3><p>{{ subTitle }}</p></div>',
}

const ElAlertStub = {
  props: ['title', 'description'],
  template: '<div class="el-alert-stub"><p>{{ title }}</p><p>{{ description }}</p></div>',
}

const ElTableStub = {
  template: '<div class="el-table-stub"><slot /></div>',
}

const ElTableColumnStub = {
  template: '<span />',
}

async function setup({associationCount = 4} = {}) {
  const pinia = createPinia()
  setActivePinia(pinia)
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      {path: '/', component: {template: '<div />'}},
      {path: '/number-memory/training', component: NumberMemoryTraining},
    ],
  })
  await router.push('/number-memory/training')
  await router.isReady()

  vi.clearAllMocks()
  hoisted.numberStore.associationCount = associationCount
  hoisted.numberStore.generateNumberToImageQuiz.mockReturnValue([])
  hoisted.numberStore.generateImageToNumberQuiz.mockReturnValue([])
  hoisted.numberStore.saveResult.mockResolvedValue({ok: true})
  hoisted.db.getTrainingProgress.mockReturnValue(null)

  const result = render(NumberMemoryTraining, {
    global: {
      plugins: [pinia, router],
      stubs: {
        'el-input': ElInputStub,
        'el-result': ElResultStub,
        'el-alert': ElAlertStub,
        'el-table': ElTableStub,
        'el-table-column': ElTableColumnStub,
      },
    },
  })
  // 等 onMounted 完成（读训练进度、加载关联）
  await waitFor(() => {
    expect(hoisted.numberStore.loadAssociations).toHaveBeenCalled()
  })
  return result
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// 固定随机数生成「全 1」数字串，保证答错/答对路径确定
function stubRandomAllOne() {
  vi.spyOn(Math, 'random').mockReturnValue(0.1)
}

describe('NumberMemoryTraining', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('关联不足时数字↔图片模式禁用并提示，随机序列不受限', async () => {
    await setup({associationCount: 2})

    expect(screen.getAllByText('请先保存至少4个数字关联')).toHaveLength(2)

    await fireEvent.click(screen.getByText('数字 → 图片'))
    const {ElMessage} = await import('element-plus')
    expect((ElMessage as any).warning).toHaveBeenCalledWith('请先保存至少4个数字-图片关联')
    // 仍停留在模式选择页
    expect(screen.getByText('选择训练模式')).toBeInTheDocument()

    // 随机序列无需关联也能进入
    await fireEvent.click(screen.getByText('随机序列'))
    expect(screen.getByText(/第 1 轮 · 5 位/)).toBeInTheDocument()
  })

  it('随机序列：生成指定位数数字串，显示结束后答错即结束并按轮落库', async () => {
    await setup()
    stubRandomAllOne()

    await fireEvent.click(screen.getByText('随机序列'))
    // 首轮 5 位
    const display = await waitFor(() => screen.getByText(/^1{5}$/))
    expect(display).toHaveTextContent('11111')

    // 显示 2 秒后隐藏，出现输入框
    await delay(2300)
    const input = screen.getByPlaceholderText('输入记忆中的数字')
    await fireEvent.update(input, '00000')
    await fireEvent.click(screen.getByText('提交'))

    // 答错 → 直接结束进入结果页
    await waitFor(() => {
      expect(screen.getByText('继续练习！')).toBeInTheDocument()
    })

    // 结果页：随机序列模式展示「最高位数 / 完成轮数 / 用时」，完成轮数不带 %
    const stats = document.querySelectorAll('.stat-item')
    const values = document.querySelectorAll('.stat-value')
    expect(stats).toHaveLength(3)
    expect(stats[0].textContent).toContain('最高位数')
    expect(stats[1].textContent).toContain('完成轮数')
    expect(stats[2].textContent).toContain('用时')
    expect(stats[1].textContent).not.toContain('%')
    expect(screen.queryByText('正确率')).not.toBeInTheDocument()
    expect(screen.queryByText('正确题数')).not.toBeInTheDocument()
    // 首轮即答错：最高位数 0、完成轮数 0
    expect(values[0]).toHaveTextContent('0')
    expect(values[1]).toHaveTextContent('0')

    // 随机序列按轮落库：本轮一条明细（答错轮 0/1），不写断点进度
    expect(hoisted.numberStore.saveResult).toHaveBeenCalledTimes(1)
    expect(hoisted.numberStore.saveResult).toHaveBeenCalledWith(
      'randomSequence',
      1,
      0,
      expect.any(Number),
      [expect.objectContaining({ number: '11111', correct: false })],
    )
    expect(hoisted.db.saveTrainingProgress).not.toHaveBeenCalled()
  }, 20000)

  it('随机序列：答对后位数加长进入下一轮，结果页完成轮数正确', async () => {
    await setup()
    stubRandomAllOne()

    await fireEvent.click(screen.getByText('随机序列'))
    const display = await waitFor(() => screen.getByText(/^1{5}$/))
    expect(display).toHaveTextContent('11111')

    await delay(2300)
    const input = screen.getByPlaceholderText('输入记忆中的数字')
    await fireEvent.update(input, '11111')
    await fireEvent.click(screen.getByText('提交'))

    // 答对：轮数 +1、位数 +1，进度文本立即更新
    const {ElMessage} = await import('element-plus')
    expect((ElMessage as any).success).toHaveBeenCalledWith('正确！进入 6 位挑战')
    await waitFor(() => {
      expect(screen.getByText(/第 2 轮 · 6 位/)).toBeInTheDocument()
    })

    // 新一轮显示 6 位数字串（下一轮在答对后 800ms 启动）
    await waitFor(() => {
      expect(screen.getByText(/^1{6}$/)).toBeInTheDocument()
    }, {timeout: 3000})
    // 过程中仍未落库
    expect(hoisted.numberStore.saveResult).not.toHaveBeenCalled()

    // 等下一轮数字隐藏后答错，验证结束页完成轮数 = 通过轮数
    await delay(2300)
    const input2 = screen.getByPlaceholderText('输入记忆中的数字')
    await fireEvent.update(input2, '000000')
    await fireEvent.click(screen.getByText('提交'))

    await waitFor(() => {
      expect(screen.getByText('继续练习！')).toBeInTheDocument()
    })
    const stats = document.querySelectorAll('.stat-item')
    // 最高位数 5、完成轮数 1
    expect(stats[0].textContent).toContain('5')
    expect(stats[1].textContent).toContain('1')
    expect(stats[1].textContent).not.toContain('%')
    // 按轮落库：两轮明细，1 对 1 错
    expect(hoisted.numberStore.saveResult).toHaveBeenCalledTimes(1)
    expect(hoisted.numberStore.saveResult).toHaveBeenCalledWith(
      'randomSequence',
      2,
      1,
      expect.any(Number),
      [
        expect.objectContaining({ number: '11111', correct: true }),
        expect.objectContaining({ number: '111111', correct: false }),
      ],
    )
  }, 20000)

  it('数字→图片：完成训练后结果页正确率带百分号并保存结果', async () => {
    await setup()
    hoisted.numberStore.generateNumberToImageQuiz.mockReturnValue([
      {
        question: '12',
        correctAnswer: 'data:image/png;base64,CORRECT',
        options: [
          'data:image/png;base64,CORRECT',
          'data:image/png;base64,WRONG1',
          'data:image/png;base64,WRONG2',
          'data:image/png;base64,WRONG3',
        ],
      },
    ])

    await fireEvent.click(screen.getByText('数字 → 图片'))
    expect(screen.getByText('12')).toBeInTheDocument()
    expect(screen.getByText('1 / 1')).toBeInTheDocument()

    // 点击第一张图（正确答案）
    const options = screen.getAllByAltText('选项图片')
    await fireEvent.click(options[0])

    await waitFor(() => {
      expect(screen.getByText('🎉 回答正确！')).toBeInTheDocument()
    })
    await fireEvent.click(screen.getByText('查看结果'))

    await waitFor(() => {
      expect(screen.getByText('太棒了！')).toBeInTheDocument()
    })
    // 结果页统计：正确题数 + 正确率（带 %）
    const stats = document.querySelectorAll('.stat-item')
    expect(stats).toHaveLength(3)
    expect(stats[0].textContent).toContain('正确题数')
    expect(stats[1].textContent).toContain('正确率')
    expect(stats[1].textContent).toContain('100%')
    expect(stats[2].textContent).toContain('用时')

    // 非随机序列模式结果已保存
    await waitFor(() => {
      expect(hoisted.numberStore.saveResult).toHaveBeenCalledWith(
        'numberToImage',
        1,
        1,
        expect.any(Number),
        expect.any(Array),
      )
    })
    const {ElMessage} = await import('element-plus')
    expect((ElMessage as any).success).toHaveBeenCalledWith('训练结果已保存')
  })

  it('图片→数字：答错后结果页正确率为 0% 并保存结果', async () => {
    await setup()
    hoisted.numberStore.generateImageToNumberQuiz.mockReturnValue([
      {
        question: 'data:image/png;base64,Q',
        correctAnswer: '12',
        options: ['12', '34', '56', '78'],
      },
    ])

    await fireEvent.click(screen.getByText('图片 → 数字'))
    expect(screen.getByAltText('题目图片')).toBeInTheDocument()

    // 点错误选项 34
    await fireEvent.click(screen.getByText('34'))
    await waitFor(() => {
      expect(screen.getByText('😢 回答错误')).toBeInTheDocument()
    })
    await fireEvent.click(screen.getByText('查看结果'))

    await waitFor(() => {
      expect(screen.getByText('继续加油！')).toBeInTheDocument()
    })
    const stats = document.querySelectorAll('.stat-item')
    expect(stats[0].textContent).toContain('正确题数')
    expect(stats[1].textContent).toContain('正确率')
    expect(stats[1].textContent).toContain('0%')
    expect(stats[2].textContent).toContain('用时')

    await waitFor(() => {
      expect(hoisted.numberStore.saveResult).toHaveBeenCalledWith(
        'imageToNumber',
        1,
        0,
        expect.any(Number),
        expect.any(Array),
      )
    })
  })
})
