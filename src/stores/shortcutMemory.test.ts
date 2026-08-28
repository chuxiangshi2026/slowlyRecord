import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('@/utils/logger', () => ({
  log: { i: vi.fn(), e: vi.fn(), w: vi.fn(), d: vi.fn() }
}))

vi.mock('@/utils/shortcut-memory-data', () => ({
  loadAllShortcuts: vi.fn(() => Promise.resolve()),
  getCategories: vi.fn(() => []),
  getGroups: vi.fn(() => []),
  getShortcutsByCategory: vi.fn(() => []),
  getShortcutById: vi.fn(),
  filterByTags: vi.fn(<T extends { tags?: string[] }>(items: T[], typeTag?: string, zoneTag?: string) => {
    const ZONE = ['横区', '竖区', '撇区', '捺区', '折区']
    let list = items
    if (typeTag === '字根') {
      list = list.filter(item => { const t = item.tags || []; return t.length > 0 && t.every(x => ZONE.includes(x)) })
    } else if (typeTag) {
      list = list.filter(item => item.tags?.includes(typeTag))
    }
    if (zoneTag) list = list.filter(item => item.tags?.includes(zoneTag))
    return list
  }),
  shuffleArray: vi.fn(<T>(arr: T[]) => [...arr]),
  generateDistractors: vi.fn(() => []),
  formatKeys: vi.fn((keys: string[]) => keys.join(' + ')),
  matchShortcut: vi.fn(),
  normalizeKey: vi.fn((k: string) => k.toLowerCase()),
  isCustomCategory: vi.fn(() => false),
}))

vi.mock('@/utils/shortcut-memory-db', () => ({
  getAllTrainingRecords: vi.fn(() => []),
  saveTrainingRecord: vi.fn(() => Promise.resolve({ ok: true, id: 'test-id', rev: '1-rev' })),
  getLearningProgress: vi.fn(() => null),
  saveLearningProgress: vi.fn(() => Promise.resolve({ ok: true, id: 'test-id', rev: '1-rev' })),
  clearLearningProgress: vi.fn(() => Promise.resolve({ ok: true, id: '', rev: '' })),
  getWrongItems: vi.fn(() => []),
  addWrongItems: vi.fn(() => Promise.resolve({ ok: true, id: '', rev: '' })),
  removeWrongItems: vi.fn(() => Promise.resolve({ ok: true, id: '', rev: '' })),
  clearWrongItems: vi.fn(() => Promise.resolve({ ok: true, id: '', rev: '' })),
  saveCustomShortcut: vi.fn(() => Promise.resolve({ ok: true, id: 'test-id', rev: '1-rev' })),
  removeCustomShortcut: vi.fn(() => ({ ok: true, id: '', rev: '' })),
  saveCustomCategory: vi.fn(() => Promise.resolve({ ok: true, id: 'test-id', rev: '1-rev' })),
  removeCustomCategory: vi.fn(() => ({ ok: true, id: '', rev: '' })),
  updateCustomShortcut: vi.fn(() => Promise.resolve({ ok: true, id: 'test-id', rev: '1-rev' })),
  hideCategory: vi.fn(),
  unhideCategory: vi.fn(),
  getAllCustomCategories: vi.fn(() => []),
}))

import {
  loadAllShortcuts,
  getCategories,
  getGroups,
  getShortcutsByCategory,
  getShortcutById,
  shuffleArray,
  generateDistractors,
  formatKeys,
  matchShortcut,
  normalizeKey,
  isCustomCategory,
} from '@/utils/shortcut-memory-data'

import {
  getAllTrainingRecords,
  saveTrainingRecord,
  getLearningProgress,
  saveLearningProgress,
  clearLearningProgress,
  getWrongItems,
  addWrongItems,
  removeWrongItems,
  clearWrongItems,
  saveCustomShortcut,
  removeCustomShortcut,
  saveCustomCategory,
  removeCustomCategory,
  updateCustomShortcut,
  hideCategory,
} from '@/utils/shortcut-memory-db'

describe('useShortcutMemoryStore', () => {
  let useShortcutMemoryStore: typeof import('./shortcutMemory').useShortcutMemoryStore

  beforeEach(async () => {
    setActivePinia(createPinia())
    vi.resetAllMocks()
    vi.mocked(loadAllShortcuts).mockResolvedValue(undefined as any)
    vi.mocked(getCategories).mockReturnValue([])
    vi.mocked(getShortcutsByCategory).mockReturnValue([])
    vi.mocked(getAllTrainingRecords).mockReturnValue([])
    vi.mocked(getLearningProgress).mockReturnValue(null)
    vi.mocked(getWrongItems).mockReturnValue([])
    vi.mocked(addWrongItems).mockResolvedValue({ ok: true, id: '', rev: '' } as any)
    vi.mocked(removeWrongItems).mockResolvedValue({ ok: true, id: '', rev: '' } as any)
    vi.mocked(clearWrongItems).mockResolvedValue({ ok: true, id: '', rev: '' } as any)
    vi.mocked(shuffleArray).mockImplementation(<T>(arr: T[]) => [...arr])
    vi.mocked(formatKeys).mockImplementation((keys: string[]) => keys.join(' + '))
    vi.mocked(normalizeKey).mockImplementation((k: string) => k.toLowerCase())
    useShortcutMemoryStore = (await import('./shortcutMemory')).useShortcutMemoryStore
    // 触发 store 初始化（模块内会调用 loadCategories），等待其完成
    useShortcutMemoryStore()
    await new Promise(r => setTimeout(r, 0))
  })

  describe('初始状态', () => {
    it('应有正确的初始值', () => {
      const store = useShortcutMemoryStore()
      expect(store.categories).toEqual([])
      expect(store.groups).toEqual([])
      expect(store.currentGroup).toBe('')
      expect(store.currentCategory).toBe('')
      expect(store.currentShortcuts).toEqual([])
      expect(store.trainingPhase).toBe('ready')
      expect(store.currentQuestionIndex).toBe(0)
      expect(store.questions).toEqual([])
      expect(store.correctCount).toBe(0)
      expect(store.wrongCount).toBe(0)
      expect(store.pressedKeys.size).toBe(0)
    })
  })

  describe('分类加载与选择', () => {
    it('loadCategories 应加载分类与域并停止 loading', async () => {
      vi.mocked(getCategories).mockReturnValue([
        { name: 'Windows', count: 10, group: '系统', description: 'Windows 快捷键', icon: '🪟' }
      ])
      vi.mocked(getGroups).mockReturnValue([
        { name: '系统', icon: '🪟', description: '操作系统', count: 10, categoryCount: 1 }
      ])
      const store = useShortcutMemoryStore()
      await store.loadCategories()
      expect(store.categories.length).toBe(1)
      expect(store.categories[0].name).toBe('Windows')
      expect(store.groups.length).toBe(1)
      expect(store.groups[0].name).toBe('系统')
      expect(store.isLoading).toBe(false)
    })

    it('selectGroup 应设置当前域', () => {
      const store = useShortcutMemoryStore()
      store.selectGroup('输入法')
      expect(store.currentGroup).toBe('输入法')
    })

    it('selectCategory 应设置当前分类并加载快捷键', () => {
      const shortcuts = [
        { id: 's1', category: 'VS Code:', functionName: '复制', description: '', keys: ['Ctrl', 'C'], platform: 'common' as const }
      ]
      vi.mocked(getShortcutsByCategory).mockReturnValue(shortcuts as any)
      const store = useShortcutMemoryStore()
      store.selectCategory('VS Code:')
      expect(store.currentCategory).toBe('VS Code:')
      expect(store.currentShortcuts).toEqual(shortcuts)
    })

    it('getFormattedKeys 应返回格式化按键', () => {
      vi.mocked(getShortcutById).mockReturnValue({ id: '1', keys: ['Ctrl', 'C'] } as any)
      vi.mocked(formatKeys).mockReturnValue('Ctrl + C')
      const store = useShortcutMemoryStore()
      const result = store.getFormattedKeys('1')
      expect(result).toBe('Ctrl + C')
    })

    it('getFormattedKeys 对不存在的 item 应返回空字符串', () => {
      vi.mocked(getShortcutById).mockReturnValue(undefined)
      const store = useShortcutMemoryStore()
      const result = store.getFormattedKeys('unknown')
      expect(result).toBe('')
    })
  })

  describe('Getters', () => {
    it('currentShortcutCount 应计算当前分类快捷键数量', () => {
      const store = useShortcutMemoryStore()
      store.currentShortcuts = [
        { id: '1', category: 'A', functionName: 'a', description: '', keys: ['A'], platform: 'common' },
        { id: '2', category: 'A', functionName: 'b', description: '', keys: ['B'], platform: 'common' }
      ] as any
      expect(store.currentShortcutCount).toBe(2)
    })

    it('progress 在没有问题时应为 0', () => {
      const store = useShortcutMemoryStore()
      expect(store.progress).toBe(0)
    })

    it('progress 应计算当前进度', () => {
      const store = useShortcutMemoryStore()
      store.questions = [{ id: '1' }, { id: '2' }, { id: '3' }] as any
      store.currentQuestionIndex = 1
      expect(store.progress).toBe(33)
    })

    it('currentQuestion 应返回当前题目', () => {
      const store = useShortcutMemoryStore()
      store.questions = [{ id: 'q1' }, { id: 'q2' }] as any
      store.currentQuestionIndex = 0
      expect(store.currentQuestion).toEqual({ id: 'q1' })
    })

    it('currentQuestion 在没有问题时返回 null', () => {
      const store = useShortcutMemoryStore()
      expect(store.currentQuestion).toBeNull()
    })

    it('isTrainingComplete 应在完成时返回 true', () => {
      const store = useShortcutMemoryStore()
      store.questions = [{ id: 'q1' }] as any
      store.currentQuestionIndex = 1
      expect(store.isTrainingComplete).toBe(true)
    })

    it('isTrainingComplete 在没有问题时返回 false', () => {
      const store = useShortcutMemoryStore()
      expect(store.isTrainingComplete).toBe(false)
    })
  })

  describe('训练初始化', () => {
    it('initKeyPressTraining 应初始化按键训练', () => {
      const shortcuts = [{ id: '1', category: 'Windows', functionName: '复制', keys: ['Ctrl', 'C'] }]
      vi.mocked(getShortcutsByCategory).mockReturnValue(shortcuts as any)
      const store = useShortcutMemoryStore()
      store.initKeyPressTraining('Windows', 0)
      expect(store.questions.length).toBe(1)
      expect(store.trainingPhase).toBe('ready')
      expect(store.correctCount).toBe(0)
      expect(store.wrongCount).toBe(0)
    })

    it('键位练习默认应抽取 20 题', () => {
      const keys = Array.from({ length: 30 }, (_, i) => ({ id: `k${i}`, category: '键位练习', functionName: `按下 ${i}`, keys: [`${i}`] }))
      vi.mocked(getShortcutsByCategory).mockReturnValue(keys as any)
      const store = useShortcutMemoryStore()
      store.initKeyPressTraining('键位练习', 0)
      expect(store.questions.length).toBe(20)
    })

    it('数字小键盘练习默认应抽取 10 题', () => {
      const keys = Array.from({ length: 20 }, (_, i) => ({ id: `n${i}`, category: '数字小键盘练习', functionName: `按下 ${i}`, keys: [`${i}`] }))
      vi.mocked(getShortcutsByCategory).mockReturnValue(keys as any)
      const store = useShortcutMemoryStore()
      store.initKeyPressTraining('数字小键盘练习', 0)
      expect(store.questions.length).toBe(10)
    })

    it('initFunctionSelectTraining 应初始化反向训练', () => {
      const shortcuts = [{ id: '1', category: 'Chrome', functionName: '新标签页', keys: ['Ctrl', 'T'] }]
      vi.mocked(getShortcutsByCategory).mockReturnValue(shortcuts as any)
      const store = useShortcutMemoryStore()
      store.initFunctionSelectTraining('Chrome', 0)
      expect(store.questions.length).toBe(1)
    })

    it('count 大于 0 且小于总数时应截取指定数量', () => {
      const shortcuts = Array.from({ length: 5 }, (_, i) => ({ id: `${i}`, category: 'T', functionName: `${i}`, keys: [`${i}`] }))
      vi.mocked(getShortcutsByCategory).mockReturnValue(shortcuts as any)
      const store = useShortcutMemoryStore()
      store.initKeyPressTraining('T', 3)
      expect(store.questions.length).toBe(3)
    })

    it('传入 tagFilter 应按标签过滤训练题目', () => {
      const shortcuts = [
        { id: '1', category: '五笔86版', functionName: 'G键·王', keys: ['G'], tags: ['横区'] },
        { id: '2', category: '五笔86版', functionName: 'H键·目', keys: ['H'], tags: ['竖区'] },
        { id: '3', category: '五笔86版', functionName: '的', keys: ['R'], tags: ['常用字'] },
      ]
      vi.mocked(getShortcutsByCategory).mockReturnValue(shortcuts as any)
      const store = useShortcutMemoryStore()
      store.initKeyPressTraining('五笔86版', 0, { type: '常用字' })
      expect(store.questions.length).toBe(1)
      expect(store.questions[0].id).toBe('3')
    })

    it('传入分区 tagFilter 应只保留该分区字根', () => {
      const shortcuts = [
        { id: '1', category: '五笔86版', functionName: 'G键·王', keys: ['G'], tags: ['横区'] },
        { id: '2', category: '五笔86版', functionName: 'H键·目', keys: ['H'], tags: ['竖区'] },
        { id: '3', category: '五笔86版', functionName: 'F键·土', keys: ['F'], tags: ['横区'] },
      ]
      vi.mocked(getShortcutsByCategory).mockReturnValue(shortcuts as any)
      const store = useShortcutMemoryStore()
      store.initKeyPressTraining('五笔86版', 0, { zone: '横区' })
      expect(store.questions.length).toBe(2)
    })

    it('不传 tagFilter 时不过滤（全部题目）', () => {
      const shortcuts = [
        { id: '1', category: '五笔86版', functionName: 'G键·王', keys: ['G'], tags: ['横区'] },
        { id: '2', category: '五笔86版', functionName: '的', keys: ['R'], tags: ['常用字'] },
      ]
      vi.mocked(getShortcutsByCategory).mockReturnValue(shortcuts as any)
      const store = useShortcutMemoryStore()
      store.initKeyPressTraining('五笔86版', 0)
      expect(store.questions.length).toBe(2)
    })
  })

  describe('训练流程', () => {
    beforeEach(() => {
      vi.mocked(getShortcutsByCategory).mockReturnValue([
        { id: '1', category: 'Test', functionName: '复制', keys: ['Ctrl', 'C'] },
        { id: '2', category: 'Test', functionName: '粘贴', keys: ['Ctrl', 'V'] }
      ] as any)
    })

    it('showCurrentQuestion 应进入 showing 状态', () => {
      const store = useShortcutMemoryStore()
      store.initKeyPressTraining('Test', 0)
      store.showCurrentQuestion()
      expect(store.trainingPhase).toBe('showing')
    })

    it('startListening 应进入 listening 状态', () => {
      const store = useShortcutMemoryStore()
      store.startListening()
      expect(store.trainingPhase).toBe('listening')
    })

    it('addPressedKey 应添加按键', () => {
      const store = useShortcutMemoryStore()
      store.addPressedKey('Ctrl')
      expect(store.pressedKeys.has('ctrl')).toBe(true)
    })

    it('removePressedKey 应移除按键', () => {
      const store = useShortcutMemoryStore()
      store.addPressedKey('Ctrl')
      store.removePressedKey('Ctrl')
      expect(store.pressedKeys.has('ctrl')).toBe(false)
    })

    it('clearPressedKeys 应清空按键', () => {
      const store = useShortcutMemoryStore()
      store.addPressedKey('A')
      store.addPressedKey('B')
      store.clearPressedKeys()
      expect(store.pressedKeys.size).toBe(0)
    })

    it('checkKeyPress 匹配时应记录正确并返回 true', () => {
      vi.mocked(matchShortcut).mockReturnValue(true)
      const store = useShortcutMemoryStore()
      store.initKeyPressTraining('Test', 0)
      store.showCurrentQuestion()
      store.addPressedKey('Ctrl')
      store.addPressedKey('C')
      const result = store.checkKeyPress()
      expect(result).toBe(true)
      expect(store.correctCount).toBe(1)
      expect(store.trainingPhase).toBe('correct')
    })

    it('checkKeyPress 不匹配时应记录错误并返回 false', () => {
      vi.mocked(matchShortcut).mockReturnValue(false)
      const store = useShortcutMemoryStore()
      store.initKeyPressTraining('Test', 0)
      store.showCurrentQuestion()
      store.addPressedKey('Ctrl')
      store.addPressedKey('Z')
      const result = store.checkKeyPress()
      expect(result).toBe(false)
      expect(store.wrongCount).toBe(1)
      expect(store.trainingPhase).toBe('wrong')
    })

    describe('顺序输入模式（五笔/双拼常用字/词组/简码）', () => {
      it('双拼"的"=DE：按 D 返回 pending 不判错，按 E 匹配', () => {
        vi.mocked(getShortcutsByCategory).mockReturnValue([
          { id: 'de', category: '双拼 · 小鹤', functionName: '的', description: 'de -> DE', keys: ['D', 'E'], platform: 'common' },
        ])
        const store = useShortcutMemoryStore()
        store.initKeyPressTraining('双拼 · 小鹤', 0)
        store.showCurrentQuestion()
        store.addPressedKey('D')
        expect(store.checkKeyPress()).toBeNull()  // pending：未输完不判错
        expect(store.wrongCount).toBe(0)
        store.addPressedKey('E')
        expect(store.checkKeyPress()).toBe(true)  // DE 匹配
        expect(store.correctCount).toBe(1)
      })

      it('五笔"子"=BB：重复键匹配（Set 去重会失败，序列成功）', () => {
        vi.mocked(getShortcutsByCategory).mockReturnValue([
          { id: 'zi', category: '五笔86版', functionName: '子', description: '二级简码 BB', keys: ['B', 'B'], platform: 'common' },
        ])
        const store = useShortcutMemoryStore()
        store.initKeyPressTraining('五笔86版', 0)
        store.showCurrentQuestion()
        store.addPressedKey('B')
        expect(store.checkKeyPress()).toBeNull()
        store.addPressedKey('B')
        expect(store.checkKeyPress()).toBe(true)  // BB 匹配
      })

      it('顺序敏感：ED 不匹配 DE', () => {
        vi.mocked(getShortcutsByCategory).mockReturnValue([
          { id: 'de', category: '双拼 · 小鹤', functionName: '的', description: 'de -> DE', keys: ['D', 'E'], platform: 'common' },
        ])
        const store = useShortcutMemoryStore()
        store.initKeyPressTraining('双拼 · 小鹤', 0)
        store.showCurrentQuestion()
        store.addPressedKey('E')
        store.addPressedKey('D')
        expect(store.checkKeyPress()).toBe(false)  // ED != DE
      })
    })

    it('checkFunctionSelect 正确时应记录正确', () => {
      const store = useShortcutMemoryStore()
      store.initFunctionSelectTraining('Test', 0)
      const result = store.checkFunctionSelect('1')
      expect(result).toBe(true)
      expect(store.correctCount).toBe(1)
    })

    it('checkFunctionSelect 错误时应记录错误', () => {
      const store = useShortcutMemoryStore()
      store.initFunctionSelectTraining('Test', 0)
      const result = store.checkFunctionSelect('wrong-id')
      expect(result).toBe(false)
      expect(store.wrongCount).toBe(1)
    })

    it('nextQuestion 应进入下一题', () => {
      const store = useShortcutMemoryStore()
      store.initKeyPressTraining('Test', 0)
      store.showCurrentQuestion()
      store.nextQuestion()
      expect(store.currentQuestionIndex).toBe(1)
      expect(store.trainingPhase).toBe('showing')
    })

    it('nextQuestion 完成所有题目后应重置为 ready', () => {
      const store = useShortcutMemoryStore()
      store.initKeyPressTraining('Test', 0)
      store.currentQuestionIndex = 1
      store.nextQuestion()
      expect(store.trainingPhase).toBe('ready')
    })

    it('generateQuizOptions 应返回选项', () => {
      const distractors = [{ id: 'd1', category: 'Test', functionName: 'd1', keys: ['A'] }]
      vi.mocked(generateDistractors).mockReturnValue(distractors as any)
      const store = useShortcutMemoryStore()
      store.initFunctionSelectTraining('Test', 0)
      store.showCurrentQuestion()
      const options = store.generateQuizOptions()
      expect(options.length).toBeGreaterThan(0)
    })

    it('generateQuizOptions 在没有当前问题时返回空数组', () => {
      const store = useShortcutMemoryStore()
      expect(store.generateQuizOptions()).toEqual([])
    })
  })

  describe('训练结果与学习进度', () => {
    it('saveTrainingResult 应保存记录并更新进度', async () => {
      const store = useShortcutMemoryStore()
      store.currentCategory = 'Test'
      store.questions = [{ id: '1' }, { id: '2' }] as any
      store.correctCount = 1
      store.trainingDetails = [{ itemId: '1', correct: true, responseTime: 1000 }]
      store.trainingStartTime = Date.now() - 5000
      const result = await store.saveTrainingResult('keyPress')
      expect(result.ok).toBe(true)
      expect(saveTrainingRecord).toHaveBeenCalled()
      expect(saveLearningProgress).toHaveBeenCalledWith('Test', ['1'])
    })

    it('saveTrainingResult 没有正确答题时不更新进度', async () => {
      vi.mocked(saveTrainingRecord).mockResolvedValue({ ok: true, id: 'id', rev: 'rev' })
      const store = useShortcutMemoryStore()
      store.currentCategory = 'Test'
      store.questions = [{ id: '1' }] as any
      store.correctCount = 0
      store.trainingDetails = [{ itemId: '1', correct: false, responseTime: 1000 }]
      store.trainingStartTime = Date.now()
      await store.saveTrainingResult('functionSelect')
      expect(saveLearningProgress).not.toHaveBeenCalled()
    })

    it('getCategoryProgress 应返回进度百分比', () => {
      vi.mocked(getShortcutsByCategory).mockReturnValue([
        { id: '1' }, { id: '2' }, { id: '3' }, { id: '4' }
      ] as any)
      vi.mocked(getLearningProgress).mockReturnValue({ category: 'Test', masteredItemIds: ['1', '2'] } as any)
      const store = useShortcutMemoryStore()
      const progress = store.getCategoryProgress('Test')
      expect(progress).toBe(50)
    })

    it('getCategoryProgress 无进度时应返回 0', () => {
      vi.mocked(getShortcutsByCategory).mockReturnValue([{ id: '1' }] as any)
      vi.mocked(getLearningProgress).mockReturnValue(null)
      const store = useShortcutMemoryStore()
      expect(store.getCategoryProgress('Test')).toBe(0)
    })

    it('getCategoryProgress 总数为 0 时应返回 0', () => {
      vi.mocked(getShortcutsByCategory).mockReturnValue([] as any)
      vi.mocked(getLearningProgress).mockReturnValue({ category: 'Test', masteredItemIds: ['1'] } as any)
      const store = useShortcutMemoryStore()
      expect(store.getCategoryProgress('Test')).toBe(0)
    })

    it('getMasteredIds 应返回已掌握 ID 列表', () => {
      vi.mocked(getLearningProgress).mockReturnValue({ category: 'Test', masteredItemIds: ['a', 'b'] } as any)
      const store = useShortcutMemoryStore()
      expect(store.getMasteredIds('Test')).toEqual(['a', 'b'])
    })

    it('getMasteredIds 无进度时应返回空数组', () => {
      vi.mocked(getLearningProgress).mockReturnValue(null)
      const store = useShortcutMemoryStore()
      expect(store.getMasteredIds('Test')).toEqual([])
    })

    it('clearCategoryProgress 应清除进度', async () => {
      vi.mocked(clearLearningProgress).mockResolvedValue({ ok: true, id: '', rev: '' } as any)
      const store = useShortcutMemoryStore()
      const result = await store.clearCategoryProgress('Test')
      expect(clearLearningProgress).toHaveBeenCalledWith('Test')
      expect(result.ok).toBe(true)
    })

    it('getTrainingHistory 应返回训练记录', () => {
      vi.mocked(getAllTrainingRecords).mockReturnValue([{ _id: 'r1' }] as any)
      const store = useShortcutMemoryStore()
      expect(store.getTrainingHistory().length).toBe(1)
    })
  })

  describe('自定义快捷键与分类', () => {
    it('addCustomShortcut 成功时应刷新数据', async () => {
      vi.mocked(saveCustomShortcut).mockResolvedValue({ ok: true, id: 'id', rev: 'rev' })
      const store = useShortcutMemoryStore()
      const result = await store.addCustomShortcut({ id: 'c1', category: 'Custom', functionName: 'test', keys: ['A'] } as any)
      expect(result.ok).toBe(true)
      expect(saveCustomShortcut).toHaveBeenCalled()
    })

    it('addCustomShortcut 失败时不刷新数据', async () => {
      vi.mocked(saveCustomShortcut).mockResolvedValue({ ok: false, id: '', rev: '', error: true, message: 'fail' })
      const store = useShortcutMemoryStore()
      const result = await store.addCustomShortcut({ id: 'c1', category: 'Custom', functionName: 'test', keys: ['A'] } as any)
      expect(result.ok).toBe(false)
    })

    it('deleteCustomShortcut 成功时应刷新数据', async () => {
      vi.mocked(removeCustomShortcut).mockReturnValue({ ok: true, id: '', rev: '' })
      const store = useShortcutMemoryStore()
      const result = await store.deleteCustomShortcut('c1')
      expect(result.ok).toBe(true)
    })

    it('addCustomCategory 应保存分类并复制源数据', async () => {
      vi.mocked(saveCustomCategory).mockResolvedValue({ ok: true, id: 'cat-id', rev: 'rev' })
      const store = useShortcutMemoryStore()
      const items = [{ id: 'i1', category: 'Src', functionName: 'f1', keys: ['A'] }] as any
      const result = await store.addCustomCategory('NewCat', 'desc', 'icon', items)
      expect(result.ok).toBe(true)
      expect(saveCustomCategory).toHaveBeenCalled()
      expect(saveCustomShortcut).toHaveBeenCalled()
    })

    it('addCustomCategory 失败时不复制数据', async () => {
      vi.mocked(saveCustomCategory).mockResolvedValue({ ok: false, error: true, message: 'fail', id: '', rev: '' })
      const store = useShortcutMemoryStore()
      const result = await store.addCustomCategory('NewCat', 'desc', 'icon', [{ id: 'i1' }] as any)
      expect(result.ok).toBe(false)
      expect(saveCustomShortcut).not.toHaveBeenCalled()
    })

    it('deleteCustomCategory 成功时应刷新数据', async () => {
      vi.mocked(removeCustomCategory).mockReturnValue({ ok: true, id: '', rev: '' })
      const store = useShortcutMemoryStore()
      const result = await store.deleteCustomCategory('OldCat')
      expect(result.ok).toBe(true)
    })

    it('updateCustomCategory 成功时应刷新数据', async () => {
      vi.mocked(saveCustomCategory).mockResolvedValue({ ok: true, id: 'id', rev: 'rev' })
      const store = useShortcutMemoryStore()
      const result = await store.updateCustomCategory('cat-id', 'NewName', 'desc', 'icon')
      expect(result.ok).toBe(true)
    })

    it('updateCustomShortcutItem 成功时应刷新数据', async () => {
      vi.mocked(updateCustomShortcut).mockResolvedValue({ ok: true, id: 'id', rev: 'rev' })
      const store = useShortcutMemoryStore()
      const result = await store.updateCustomShortcutItem({ id: 's1' } as any)
      expect(result.ok).toBe(true)
    })

    it('removeCategory 对自定义分类应调用 deleteCustomCategory', async () => {
      vi.mocked(isCustomCategory).mockReturnValue(true)
      vi.mocked(removeCustomCategory).mockReturnValue({ ok: true, id: '', rev: '' })
      const store = useShortcutMemoryStore()
      const result = await store.removeCategory('CustomCat')
      expect(removeCustomCategory).toHaveBeenCalledWith('CustomCat')
      expect(result.ok).toBe(true)
    })

    it('removeCategory 对示例分类应隐藏并刷新', async () => {
      vi.mocked(isCustomCategory).mockReturnValue(false)
      const store = useShortcutMemoryStore()
      const result = await store.removeCategory('Windows')
      expect(hideCategory).toHaveBeenCalledWith('Windows')
      expect(result.ok).toBe(true)
    })
  })

  describe('错题本', () => {
    it('recordAnswer 答错应加入错题集', () => {
      const store = useShortcutMemoryStore()
      store.selectCategory('VS Code')
      store.showCurrentQuestion()
      store.recordAnswer(false, 'item-1')
      expect(addWrongItems).toHaveBeenCalledWith('VS Code', ['item-1'])
    })

    it('recordAnswer 普通训练答对不移出错题集', () => {
      vi.mocked(getShortcutsByCategory).mockReturnValue([
        { id: '1', keys: ['A'], category: 'VS Code', functionName: 'f', description: 'd', platform: 'common' } as any
      ])
      const store = useShortcutMemoryStore()
      store.selectCategory('VS Code')
      store.initKeyPressTraining('VS Code')
      store.showCurrentQuestion()
      store.recordAnswer(true, 'item-1')
      expect(removeWrongItems).not.toHaveBeenCalled()
    })

    it('recordAnswer 错题训练答对应移出错题集', () => {
      vi.mocked(getWrongItems).mockReturnValue(['item-1', 'item-2'])
      vi.mocked(getShortcutById).mockReturnValue({
        id: 'item-1', keys: ['A'], category: 'VS Code', functionName: 'f', description: 'd', platform: 'common'
      } as any)
      const store = useShortcutMemoryStore()
      store.selectCategory('VS Code')
      store.initWrongItemsTraining('VS Code')
      store.showCurrentQuestion()
      store.recordAnswer(true, 'item-1')
      expect(removeWrongItems).toHaveBeenCalledWith('VS Code', ['item-1'])
    })

    it('initWrongItemsTraining 应从错题集取题并标记模式', () => {
      vi.mocked(getWrongItems).mockReturnValue(['i1', 'i2'])
      vi.mocked(getShortcutById).mockImplementation((id) => ({
        id, keys: ['A'], category: 'VS Code', functionName: 'f', description: 'd', platform: 'common'
      } as any))
      const store = useShortcutMemoryStore()
      store.initWrongItemsTraining('VS Code')
      expect(store.questions.length).toBe(2)
      expect(store.isWrongItemsTraining).toBe(true)
    })

    it('initKeyPressTraining 应将 isWrongItemsTraining 置 false', () => {
      vi.mocked(getShortcutsByCategory).mockReturnValue([
        { id: '1', keys: ['A'], category: 'VS Code', functionName: 'f', description: 'd', platform: 'common' } as any
      ])
      const store = useShortcutMemoryStore()
      store.initKeyPressTraining('VS Code')
      expect(store.isWrongItemsTraining).toBe(false)
    })

    it('getWrongItemsCount 应返回错题数量', () => {
      vi.mocked(getWrongItems).mockReturnValue(['a', 'b', 'c'])
      const store = useShortcutMemoryStore()
      expect(store.getWrongItemsCount('VS Code')).toBe(3)
    })

    it('clearWrongItemsAction 应清空错题', async () => {
      const store = useShortcutMemoryStore()
      const result = await store.clearWrongItemsAction('VS Code')
      expect(clearWrongItems).toHaveBeenCalledWith('VS Code')
      expect(result.ok).toBe(true)
    })
  })

  describe('边界条件', () => {
    it('checkKeyPress 无当前问题时应返回 false', () => {
      const store = useShortcutMemoryStore()
      expect(store.checkKeyPress()).toBe(false)
    })

    it('checkFunctionSelect 无当前问题时应返回 false', () => {
      const store = useShortcutMemoryStore()
      expect(store.checkFunctionSelect('any')).toBe(false)
    })

    it('nextQuestion 在空问题时不报错', () => {
      const store = useShortcutMemoryStore()
      store.nextQuestion()
      expect(store.currentQuestionIndex).toBe(1)
      expect(store.trainingPhase).toBe('ready')
    })
  })
})
