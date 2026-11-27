import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useMemoryStore } from './memory'

// 在 node 环境下提供 localStorage mock
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { store = {} },
    get length() { return Object.keys(store).length },
    key: (index: number) => Object.keys(store)[index] ?? null,
  }
})()

vi.stubGlobal('localStorage', localStorageMock)

describe('useMemoryStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorageMock.clear()
  })

  describe('初始状态', () => {
    it('应该有正确的初始值', () => {
      const store = useMemoryStore()

      expect(store.testHistory).toEqual([])
      expect(store.numberStats).toEqual({
        correct: 0,
        wrong: 0,
        maxDifficulty: 4
      })
      expect(store.wordStats).toEqual({
        total: 0,
        perfect: 0,
        totalCorrect: 0
      })
      expect(store.patternStats).toEqual({
        correct: 0,
        wrong: 0
      })
    })

    it('totalTests 应该返回正确的测试总数', () => {
      const store = useMemoryStore()
      expect(store.totalTests).toBe(0)

      store.addHistory({
        mode: 'number',
        modeText: '数字记忆',
        success: true,
        result: '通过',
        time: '10s'
      })

      expect(store.totalTests).toBe(1)
    })

    it('overallAccuracy 应该在无测试时返回 0', () => {
      const store = useMemoryStore()
      expect(store.overallAccuracy).toBe(0)
    })
  })

  describe('updateNumberStats', () => {
    it('正确回答应该增加 correct 计数', () => {
      const store = useMemoryStore()
      store.updateNumberStats(true)

      expect(store.numberStats.correct).toBe(1)
      expect(store.numberStats.wrong).toBe(0)
    })

    it('错误回答应该增加 wrong 计数', () => {
      const store = useMemoryStore()
      store.updateNumberStats(false)

      expect(store.numberStats.correct).toBe(0)
      expect(store.numberStats.wrong).toBe(1)
    })

    it('正确回答且难度更高时应该更新 maxDifficulty', () => {
      const store = useMemoryStore()
      store.updateNumberStats(true, 6)

      expect(store.numberStats.maxDifficulty).toBe(6)
    })

    it('正确回答但难度较低时不应更新 maxDifficulty', () => {
      const store = useMemoryStore()
      store.updateNumberStats(true, 10) // 先设置到 10
      store.updateNumberStats(true, 5)  // 然后尝试设置更低的

      expect(store.numberStats.maxDifficulty).toBe(10)
    })

    it('未提供难度时不应改变 maxDifficulty', () => {
      const store = useMemoryStore()
      store.updateNumberStats(true)

      expect(store.numberStats.maxDifficulty).toBe(4) // 保持默认值
    })

    it('错误回答时不应更新 maxDifficulty', () => {
      const store = useMemoryStore()
      store.updateNumberStats(false, 10)

      expect(store.numberStats.maxDifficulty).toBe(4) // 保持默认值
    })

    it('多次调用应该累加计数', () => {
      const store = useMemoryStore()
      store.updateNumberStats(true)
      store.updateNumberStats(true)
      store.updateNumberStats(false)
      store.updateNumberStats(true)

      expect(store.numberStats.correct).toBe(3)
      expect(store.numberStats.wrong).toBe(1)
    })

    it('maxDifficulty 应该追踪所有历史最高难度', () => {
      const store = useMemoryStore()
      store.updateNumberStats(true, 5)
      store.updateNumberStats(true, 8)
      store.updateNumberStats(true, 3)
      store.updateNumberStats(true, 12)

      expect(store.numberStats.maxDifficulty).toBe(12)
    })

    it('难度为 0 时正确回答不应更新 maxDifficulty', () => {
      const store = useMemoryStore()
      store.updateNumberStats(true, 0)

      expect(store.numberStats.maxDifficulty).toBe(4) // 0 < 4，不更新
    })
  })

  describe('updateWordStats', () => {
    it('应该增加 total 计数', () => {
      const store = useMemoryStore()
      store.updateWordStats(5, 3)

      expect(store.wordStats.total).toBe(1)
    })

    it('应该累加 totalCorrect', () => {
      const store = useMemoryStore()
      store.updateWordStats(5, 3)
      store.updateWordStats(5, 4)

      expect(store.wordStats.totalCorrect).toBe(7)
    })

    it('全部正确时应该增加 perfect 计数', () => {
      const store = useMemoryStore()
      store.updateWordStats(5, 5)

      expect(store.wordStats.perfect).toBe(1)
    })

    it('未全部正确时不应增加 perfect 计数', () => {
      const store = useMemoryStore()
      store.updateWordStats(5, 3)

      expect(store.wordStats.perfect).toBe(0)
    })

    it('0 个正确答案时不应增加 perfect 计数', () => {
      const store = useMemoryStore()
      store.updateWordStats(5, 0)

      expect(store.wordStats.perfect).toBe(0)
      expect(store.wordStats.totalCorrect).toBe(0)
    })

    it('多次调用应该累加 total 和 totalCorrect', () => {
      const store = useMemoryStore()
      store.updateWordStats(10, 8)
      store.updateWordStats(10, 6)
      store.updateWordStats(10, 10)

      expect(store.wordStats.total).toBe(3)
      expect(store.wordStats.totalCorrect).toBe(24)
      expect(store.wordStats.perfect).toBe(1)
    })
  })

  describe('updatePatternStats', () => {
    it('正确回答应该增加 correct 计数', () => {
      const store = useMemoryStore()
      store.updatePatternStats(true)

      expect(store.patternStats.correct).toBe(1)
      expect(store.patternStats.wrong).toBe(0)
    })

    it('错误回答应该增加 wrong 计数', () => {
      const store = useMemoryStore()
      store.updatePatternStats(false)

      expect(store.patternStats.correct).toBe(0)
      expect(store.patternStats.wrong).toBe(1)
    })

    it('多次调用应该累加计数', () => {
      const store = useMemoryStore()
      store.updatePatternStats(true)
      store.updatePatternStats(false)
      store.updatePatternStats(true)
      store.updatePatternStats(true)

      expect(store.patternStats.correct).toBe(3)
      expect(store.patternStats.wrong).toBe(1)
    })
  })

  describe('addHistory', () => {
    it('应该添加记录到历史列表开头', () => {
      const store = useMemoryStore()
      const record1 = {
        mode: 'number' as const,
        modeText: '数字记忆',
        success: true,
        result: '通过',
        time: '10s'
      }
      const record2 = {
        mode: 'word' as const,
        modeText: '单词记忆',
        success: false,
        result: '失败',
        time: '15s'
      }

      store.addHistory(record1)
      store.addHistory(record2)

      expect(store.testHistory[0]).toEqual(record2)
      expect(store.testHistory[1]).toEqual(record1)
    })

    it('历史记录超过 50 条时应该只保留最近的 50 条', () => {
      const store = useMemoryStore()

      // 添加 55 条记录
      for (let i = 0; i < 55; i++) {
        store.addHistory({
          mode: 'number',
          modeText: '数字记忆',
          success: true,
          result: '通过',
          time: `${i}s`
        })
      }

      expect(store.testHistory.length).toBe(50)
      // 最新的记录应该是第 54 条（从 0 开始）
      expect(store.testHistory[0].time).toBe('54s')
    })

    it('历史记录恰好 50 条时不应该丢失', () => {
      const store = useMemoryStore()

      for (let i = 0; i < 50; i++) {
        store.addHistory({
          mode: 'number',
          modeText: '数字记忆',
          success: true,
          result: '通过',
          time: `${i}s`
        })
      }

      expect(store.testHistory.length).toBe(50)
      expect(store.testHistory[0].time).toBe('49s')
      expect(store.testHistory[49].time).toBe('0s')
    })

    it('应该支持不同 mode 的记录', () => {
      const store = useMemoryStore()

      store.addHistory({ mode: 'number', modeText: '数字记忆', success: true, result: '通过', time: '10s' })
      store.addHistory({ mode: 'word', modeText: '单词记忆', success: false, result: '失败', time: '15s' })
      store.addHistory({ mode: 'pattern', modeText: '模式记忆', success: true, result: '通过', time: '8s' })

      expect(store.testHistory).toHaveLength(3)
      expect(store.testHistory[0].mode).toBe('pattern')
      expect(store.testHistory[1].mode).toBe('word')
      expect(store.testHistory[2].mode).toBe('number')
    })
  })

  describe('overallAccuracy', () => {
    it('应该正确计算总体准确率', () => {
      const store = useMemoryStore()
      // 数字：3 正确，1 错误
      store.updateNumberStats(true)
      store.updateNumberStats(true)
      store.updateNumberStats(true)
      store.updateNumberStats(false)
      // 模式：2 正确，2 错误
      store.updatePatternStats(true)
      store.updatePatternStats(true)
      store.updatePatternStats(false)
      store.updatePatternStats(false)
      // 单词：1 次完美，5 题中答对 4
      store.updateWordStats(5, 5) // perfect

      // 总正确：3(数字) + 2(模式) + 1(单词完美) = 6
      // 总测试：4(数字) + 4(模式) + 1(单词) = 9
      // 准确率：6/9 = 66.67% ≈ 67%
      expect(store.overallAccuracy).toBe(67)
    })

    it('只有数字测试时应正确计算准确率', () => {
      const store = useMemoryStore()
      store.updateNumberStats(true)
      store.updateNumberStats(true)
      store.updateNumberStats(false)

      // 2/3 = 66.67% ≈ 67%
      expect(store.overallAccuracy).toBe(67)
    })

    it('只有模式测试时应正确计算准确率', () => {
      const store = useMemoryStore()
      store.updatePatternStats(true)
      store.updatePatternStats(true)
      store.updatePatternStats(true)
      store.updatePatternStats(false)

      // 3/4 = 75%
      expect(store.overallAccuracy).toBe(75)
    })

    it('100% 准确率', () => {
      const store = useMemoryStore()
      store.updateNumberStats(true)
      store.updatePatternStats(true)

      expect(store.overallAccuracy).toBe(100)
    })

    it('0% 准确率', () => {
      const store = useMemoryStore()
      store.updateNumberStats(false)
      store.updatePatternStats(false)

      expect(store.overallAccuracy).toBe(0)
    })

    it('非完美单词测试不计入 correct 但计入 total', () => {
      const store = useMemoryStore()
      store.updateWordStats(5, 3) // 5个词答对3个，不是完美

      // 总正确: 0 + 0 + 0(非完美) = 0
      // 总测试: 0 + 0 + 1(单词) = 1
      // 准确率: 0%
      expect(store.overallAccuracy).toBe(0)
    })
  })

  describe('clearAllData', () => {
    it('应该清除所有数据', () => {
      const store = useMemoryStore()
      store.updateNumberStats(true)
      store.updateWordStats(5, 5)
      store.addHistory({
        mode: 'number',
        modeText: '数字记忆',
        success: true,
        result: '通过',
        time: '10s'
      })

      store.clearAllData()

      expect(store.testHistory).toEqual([])
      expect(store.numberStats).toEqual({
        correct: 0,
        wrong: 0,
        maxDifficulty: 4
      })
      expect(store.wordStats).toEqual({
        total: 0,
        perfect: 0,
        totalCorrect: 0
      })
      expect(store.patternStats).toEqual({
        correct: 0,
        wrong: 0
      })
    })

    it('应该清除 localStorage 中的数据', () => {
      const store = useMemoryStore()
      store.updateNumberStats(true)

      store.clearAllData()

      expect(localStorage.getItem('memoryTest_stats')).toBeNull()
      expect(localStorage.getItem('memoryTest_history')).toBeNull()
    })

    it('清除后可以重新添加数据', () => {
      const store = useMemoryStore()
      store.updateNumberStats(true)
      store.clearAllData()
      store.updateNumberStats(true)

      expect(store.numberStats.correct).toBe(1)
      expect(store.totalTests).toBe(0)
    })
  })

  describe('localStorage 持久化', () => {
    it('应该保存统计数据到 localStorage', () => {
      const store = useMemoryStore()
      store.updateNumberStats(true)

      const savedStats = localStorage.getItem('memoryTest_stats')
      expect(savedStats).not.toBeNull()

      const parsed = JSON.parse(savedStats!)
      expect(parsed.number.correct).toBe(1)
    })

    it('应该保存历史记录到 localStorage', () => {
      const store = useMemoryStore()
      const record = {
        mode: 'number' as const,
        modeText: '数字记忆',
        success: true,
        result: '通过',
        time: '10s'
      }
      store.addHistory(record)

      const savedHistory = localStorage.getItem('memoryTest_history')
      expect(savedHistory).not.toBeNull()

      const parsed = JSON.parse(savedHistory!)
      expect(parsed).toHaveLength(1)
      expect(parsed[0].mode).toBe('number')
    })

    it('应该保存所有类型的统计数据', () => {
      const store = useMemoryStore()
      store.updateNumberStats(true, 8)
      store.updateWordStats(10, 10)
      store.updatePatternStats(true)

      const savedStats = localStorage.getItem('memoryTest_stats')
      const parsed = JSON.parse(savedStats!)

      expect(parsed.number.correct).toBe(1)
      expect(parsed.number.maxDifficulty).toBe(8)
      expect(parsed.word.total).toBe(1)
      expect(parsed.word.perfect).toBe(1)
      expect(parsed.pattern.correct).toBe(1)
    })

    it('更新错误统计时也应该保存', () => {
      const store = useMemoryStore()
      store.updateNumberStats(false)

      const savedStats = localStorage.getItem('memoryTest_stats')
      const parsed = JSON.parse(savedStats!)

      expect(parsed.number.wrong).toBe(1)
    })

    it('应该能从 localStorage 恢复数据', () => {
      const store1 = useMemoryStore()
      store1.updateNumberStats(true, 7)
      store1.addHistory({
        mode: 'number',
        modeText: '数字记忆',
        success: true,
        result: '通过',
        time: '10s'
      })

      // 创建新的 store 实例，应该从 localStorage 恢复数据
      const store2 = useMemoryStore()

      expect(store2.numberStats.correct).toBe(1)
      expect(store2.numberStats.maxDifficulty).toBe(7)
      expect(store2.testHistory).toHaveLength(1)
      expect(store2.testHistory[0].mode).toBe('number')
    })
  })

  describe('loadStats 和 loadHistory', () => {
    it('loadStats 应该合并部分存储的数据', () => {
      localStorage.setItem('memoryTest_stats', JSON.stringify({
        number: { correct: 5, wrong: 2, maxDifficulty: 8 }
        // 故意不保存 word 和 pattern
      }))

      const store = useMemoryStore()

      expect(store.numberStats.correct).toBe(5)
      expect(store.numberStats.wrong).toBe(2)
      expect(store.numberStats.maxDifficulty).toBe(8)
      expect(store.wordStats.total).toBe(0) // 默认值
      expect(store.patternStats.correct).toBe(0) // 默认值
    })

    it('localStorage 数据损坏时不应崩溃', () => {
      localStorage.setItem('memoryTest_stats', 'invalid json')
      localStorage.setItem('memoryTest_history', 'invalid json')

      // 不应抛出错误
      const store = useMemoryStore()

      expect(store.numberStats.correct).toBe(0)
      expect(store.testHistory).toEqual([])
    })

    it('localStorage 为空时应使用默认值', () => {
      const store = useMemoryStore()

      expect(store.numberStats).toEqual({ correct: 0, wrong: 0, maxDifficulty: 4 })
      expect(store.wordStats).toEqual({ total: 0, perfect: 0, totalCorrect: 0 })
      expect(store.patternStats).toEqual({ correct: 0, wrong: 0 })
      expect(store.testHistory).toEqual([])
    })
  })

  // generateConclusion 是纯计算：只依赖 mode / maxStage / difficulty，
  // 不读取 stats / testHistory，也不读写 localStorage（见源码 180-217 行）。
  describe('generateConclusion', () => {
    describe('三种模式的结论与详情文案', () => {
      it('number 模式 easy 达到优秀档时给出完整结论', () => {
        const store = useMemoryStore()
        const c = store.generateConclusion('number', 6, 'easy')

        expect(c.level).toBe('excellent')
        expect(c.levelText).toBe('优秀')
        expect(c.summary).toBe('您的数字记忆能力出色，能够轻松记忆较长数字序列，这是超级记忆力的表现！')
        // 位数 = 4 + (6 - 1) * 2 = 14
        expect(c.details).toEqual([
          '最高可记忆 14 位数字序列',
          '完成 6 轮测试，表现卓越',
          '可以尝试更难的难度等级或使用宫格记忆法'
        ])
        expect(c.recommendedTraining.method).toBe('高级记忆宫殿法')
        expect(c.recommendedTraining.difficulty).toBe('hard')
        expect(c.recommendedTraining.frequency).toBe('每天30分钟')
        expect(c.recommendedTraining.steps).toHaveLength(5)
      })

      it('word 模式 medium 达到良好档时给出完整结论', () => {
        const store = useMemoryStore()
        const c = store.generateConclusion('word', 5, 'medium')

        expect(c.level).toBe('good')
        expect(c.levelText).toBe('良好')
        expect(c.summary).toBe('您的单词记忆能力不错，可以较好地完成单词记忆任务。')
        // 单词数 = 5 + floor((5 - 1) / 2) = 7
        expect(c.details).toEqual([
          '可同时记忆 7 个单词',
          '完成 5 轮测试',
          '可以尝试分类记忆法，将单词按主题分组'
        ])
        expect(c.recommendedTraining.method).toBe('图像联想法')
        expect(c.recommendedTraining.difficulty).toBe('medium')
      })

      it('pattern 模式 hard 落在一般档时给出完整结论', () => {
        const store = useMemoryStore()
        const c = store.generateConclusion('pattern', 5, 'hard')

        expect(c.level).toBe('average')
        expect(c.levelText).toBe('一般')
        expect(c.summary).toBe('您的图案记忆能力一般，需要更多练习来提高。')
        // 网格 5×5，图案数 = 7 + floor((5 - 1) / 2) = 9，上限 5*5-1 = 24
        expect(c.details).toEqual([
          '可在 5×5 网格中记忆 9 个图案位置',
          '空间记忆能力有待提升'
        ])
        expect(c.recommendedTraining.method).toBe('分区记忆法')
        expect(c.recommendedTraining.frequency).toBe('每天15分钟')
      })

      it('pattern 模式优秀档的空间记忆评价为「很强」', () => {
        const store = useMemoryStore()
        const c = store.generateConclusion('pattern', 6, 'easy')

        expect(c.level).toBe('excellent')
        // 图案数 = 3 + floor((6 - 1) / 2) = 5
        expect(c.details[0]).toBe('可在 3×3 网格中记忆 5 个图案位置')
        expect(c.details[1]).toBe('空间记忆能力很强')
        // 轮数 > 2，不再追加轨迹法建议
        expect(c.details).toHaveLength(2)
      })

      it('未达标时给出「需加强」结论与基础训练建议', () => {
        const store = useMemoryStore()

        const word = store.generateConclusion('word', 2, 'medium')
        expect(word.level).toBe('needs_improvement')
        expect(word.levelText).toBe('需加强')
        expect(word.summary).toBe('您的单词记忆能力需要提升，建议增加词汇量练习。')
        expect(word.details).toEqual([
          '可同时记忆 5 个单词',
          '完成 2 轮测试',
          '建议：将单词编成故事或图像来增强记忆'
        ])
        expect(word.recommendedTraining.method).toBe('基础单词积累')

        const pattern = store.generateConclusion('pattern', 4, 'hard')
        expect(pattern.level).toBe('needs_improvement')
        expect(pattern.summary).toBe('您的图案记忆能力较弱，建议多进行视觉记忆训练。')
        // 图案数 = 7 + floor((4 - 1) / 2) = 8
        expect(pattern.details).toEqual([
          '可在 5×5 网格中记忆 8 个图案位置',
          '空间记忆能力有待提升'
        ])
        expect(pattern.recommendedTraining.method).toBe('基础视觉记忆训练')
        expect(pattern.recommendedTraining.difficulty).toBe('easy')
      })
    })

    describe('轮数边界', () => {
      it('0 轮（第一轮即失败）时按公式取值，数字模式有基线兜底而单词/图案没有', () => {
        const store = useMemoryStore()

        const number = store.generateConclusion('number', 0, 'easy')
        expect(number.level).toBe('needs_improvement')
        // (4 + (0 - 1) * 2) = 2，被 Math.max(4, length) 兜底到 4
        expect(number.details).toEqual([
          '最高可记忆 4 位数字序列',
          '完成 0 轮测试，表现稳定',
          '建议：尝试使用联想记忆法，将数字转化为图像'
        ])

        // 单词/图案没有同等兜底：3 + floor((0 - 1) / 2) = 2
        expect(store.generateConclusion('word', 0, 'easy').details[0]).toBe('可同时记忆 2 个单词')
        expect(store.generateConclusion('pattern', 0, 'medium').details[0]).toBe('可在 4×4 网格中记忆 4 个图案位置')
      })

      it('轮数远超上限时，单词数与图案位置按上限封顶', () => {
        const store = useMemoryStore()

        // 数字序列长度不封顶：8 + (100 - 1) * 2 = 206
        expect(store.generateConclusion('number', 100, 'hard').details[0]).toBe('最高可记忆 206 位数字序列')
        // 单词封顶 12：min(12, 7 + 49) = 12
        expect(store.generateConclusion('word', 100, 'hard').details[0]).toBe('可同时记忆 12 个单词')
        // 图案封顶 size*size-1：3×3 → 8，5×5 → 24
        expect(store.generateConclusion('pattern', 100, 'easy').details[0]).toBe('可在 3×3 网格中记忆 8 个图案位置')
        expect(store.generateConclusion('pattern', 100, 'hard').details[0]).toBe('可在 5×5 网格中记忆 24 个图案位置')
      })
    })

    describe('等级阈值（四档等级 × 三档难度）', () => {
      const levelCases: Array<{
        difficulty: 'easy' | 'medium' | 'hard'
        maxStage: number
        level: 'excellent' | 'good' | 'average' | 'needs_improvement'
        levelText: string
      }> = [
        // easy：baseLevel 3，average 下界 max(1, 3-2)=1，good 下界 3，excellent 下界 6
        { difficulty: 'easy', maxStage: 0, level: 'needs_improvement', levelText: '需加强' },
        { difficulty: 'easy', maxStage: 1, level: 'average', levelText: '一般' },
        { difficulty: 'easy', maxStage: 2, level: 'average', levelText: '一般' },
        { difficulty: 'easy', maxStage: 3, level: 'good', levelText: '良好' },
        { difficulty: 'easy', maxStage: 5, level: 'good', levelText: '良好' },
        { difficulty: 'easy', maxStage: 6, level: 'excellent', levelText: '优秀' },
        // medium：baseLevel 5，average 下界 3，good 下界 5，excellent 下界 8
        { difficulty: 'medium', maxStage: 2, level: 'needs_improvement', levelText: '需加强' },
        { difficulty: 'medium', maxStage: 3, level: 'average', levelText: '一般' },
        { difficulty: 'medium', maxStage: 4, level: 'average', levelText: '一般' },
        { difficulty: 'medium', maxStage: 5, level: 'good', levelText: '良好' },
        { difficulty: 'medium', maxStage: 7, level: 'good', levelText: '良好' },
        { difficulty: 'medium', maxStage: 8, level: 'excellent', levelText: '优秀' },
        // hard：baseLevel 7，average 下界 5，good 下界 7，excellent 下界 10
        { difficulty: 'hard', maxStage: 4, level: 'needs_improvement', levelText: '需加强' },
        { difficulty: 'hard', maxStage: 5, level: 'average', levelText: '一般' },
        { difficulty: 'hard', maxStage: 6, level: 'average', levelText: '一般' },
        { difficulty: 'hard', maxStage: 7, level: 'good', levelText: '良好' },
        { difficulty: 'hard', maxStage: 9, level: 'good', levelText: '良好' },
        { difficulty: 'hard', maxStage: 10, level: 'excellent', levelText: '优秀' }
      ]

      it.each(levelCases)(
        '$difficulty 难度、$maxStage 轮 → $level（$levelText）',
        ({ difficulty, maxStage, level, levelText }) => {
          const store = useMemoryStore()
          const c = store.generateConclusion('number', maxStage, difficulty)

          expect(c.level).toBe(level)
          expect(c.levelText).toBe(levelText)
        }
      )

      it('难度为非法值时整体按 hard 分支兜底', () => {
        const store = useMemoryStore()

        // baseLevel 走 else = 7；详情里的难度三元同样落到 hard 的数值分支
        const invalid = store.generateConclusion('number', 7, 'unknown' as any)
        expect(invalid).toEqual(store.generateConclusion('number', 7, 'hard'))
        expect(invalid.level).toBe('good')
        // 位数 = 8 + (7 - 1) * 2 = 20
        expect(invalid.details[0]).toBe('最高可记忆 20 位数字序列')

        expect(store.generateConclusion('pattern', 5, 'bogus' as any)).toEqual(
          store.generateConclusion('pattern', 5, 'hard')
        )
      })
    })

    describe('摘要文案（mode × level 共 12 种组合）', () => {
      const summaryCases: Array<{
        mode: 'number' | 'word' | 'pattern'
        level: string
        maxStage: number
        summary: string
      }> = [
        { mode: 'number', level: 'excellent', maxStage: 6, summary: '您的数字记忆能力出色，能够轻松记忆较长数字序列，这是超级记忆力的表现！' },
        { mode: 'number', level: 'good', maxStage: 3, summary: '您的数字记忆能力良好，能够记住中等长度的数字序列，基础扎实。' },
        { mode: 'number', level: 'average', maxStage: 1, summary: '您的数字记忆能力一般，通过训练可以记住更长的数字序列。' },
        { mode: 'number', level: 'needs_improvement', maxStage: 0, summary: '您的数字记忆需要加强，建议从简单的数字串开始练习。' },
        { mode: 'word', level: 'excellent', maxStage: 6, summary: '您的单词记忆能力优秀，可以快速记忆多个单词，语言能力很强！' },
        { mode: 'word', level: 'good', maxStage: 3, summary: '您的单词记忆能力不错，可以较好地完成单词记忆任务。' },
        { mode: 'word', level: 'average', maxStage: 1, summary: '您的单词记忆能力尚可，但还有较大提升空间。' },
        { mode: 'word', level: 'needs_improvement', maxStage: 0, summary: '您的单词记忆能力需要提升，建议增加词汇量练习。' },
        { mode: 'pattern', level: 'excellent', maxStage: 6, summary: '您的空间记忆和图形记忆能力极佳，对视觉信息的捕捉能力很强！' },
        { mode: 'pattern', level: 'good', maxStage: 3, summary: '您的图案记忆能力良好，能够较好地完成图形记忆任务。' },
        { mode: 'pattern', level: 'average', maxStage: 1, summary: '您的图案记忆能力一般，需要更多练习来提高。' },
        { mode: 'pattern', level: 'needs_improvement', maxStage: 0, summary: '您的图案记忆能力较弱，建议多进行视觉记忆训练。' }
      ]

      it.each(summaryCases)('$mode 模式 $level 档的摘要文案固定', ({ mode, level, maxStage, summary }) => {
        const store = useMemoryStore()
        const c = store.generateConclusion(mode, maxStage, 'easy')

        expect(c.level).toBe(level)
        expect(c.summary).toBe(summary)
      })
    })

    describe('与统计数据、持久化、随机数的关系', () => {
      it('结论只由入参决定，不受 stats / testHistory 影响，也不写入 localStorage', () => {
        const store = useMemoryStore()
        const before = store.generateConclusion('word', 5, 'medium')

        // 生成结论本身不落盘
        expect(localStorage.length).toBe(0)

        store.updateNumberStats(true, 12)
        store.updateNumberStats(false)
        store.updatePatternStats(true)
        store.updateWordStats(5, 5)
        store.addHistory({ mode: 'number', modeText: '数字记忆', success: true, result: '通过', time: '10s' })

        // 统计确实变了：3 正确 / 4 次测试 = 75%
        expect(store.overallAccuracy).toBe(75)
        // 但结论不变
        expect(store.generateConclusion('word', 5, 'medium')).toEqual(before)

        const keys: string[] = []
        for (let i = 0; i < localStorage.length; i++) keys.push(localStorage.key(i)!)
        expect(keys.sort()).toEqual(['memoryTest_history', 'memoryTest_stats'])
      })

      it('不依赖随机数，相同入参结果稳定', () => {
        const store = useMemoryStore()
        const randomSpy = vi.spyOn(Math, 'random')
        try {
          expect(store.generateConclusion('pattern', 6, 'medium')).toEqual(
            store.generateConclusion('pattern', 6, 'medium')
          )
          expect(randomSpy).not.toHaveBeenCalled()
        } finally {
          randomSpy.mockRestore()
        }
      })
    })
  })
})
