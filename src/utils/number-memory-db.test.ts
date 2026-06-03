// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setDbAdapter, resetDbAdapter, type DbAdapter } from '@/adapters/db'
import 'fake-indexeddb/auto'

// Mock logger
vi.mock('@/utils/logger', () => ({
  log: { i: vi.fn(), d: vi.fn(), e: vi.fn(), w: vi.fn() },
}))

// Mock constants
vi.mock('@/constants', () => ({
  DB_KEY_NUMBER_MEMORY: 'number_memory_',
}))

async function loadModule() {
  return await import('./number-memory-db')
}

const createMockDb = (): DbAdapter => {
  const storage = new Map<string, any>()

  return {
    get: vi.fn((id: string) => storage.get(id) || null),
    put: vi.fn((doc: any) => {
      storage.set(doc._id, { ...doc, _rev: '1-rev' })
      return { ok: true, id: doc._id, rev: '1-rev' }
    }),
    remove: vi.fn((id: string) => {
      const idStr = typeof id === 'string' ? id : (id as any)._id
      storage.delete(idStr)
      return { ok: true, id: idStr }
    }),
    allDocs: vi.fn((prefix?: string) => {
      const docs: any[] = []
      storage.forEach((doc, id) => {
        if (!prefix || id.startsWith(prefix)) {
          docs.push(doc)
        }
      })
      return docs
    }),
    bulkDocs: vi.fn((docs: any[]) => {
      return docs.map(doc => {
        storage.set(doc._id, { ...doc, _rev: '1-rev' })
        return { ok: true, id: doc._id, rev: '1-rev' }
      })
    }),
    promises: {
      get: vi.fn(async (id: string) => storage.get(id) || null),
      put: vi.fn(async (doc: any) => {
        storage.set(doc._id, { ...doc, _rev: '1-rev' })
        return { ok: true, id: doc._id, rev: '1-rev' }
      }),
      remove: vi.fn(async (id: string) => {
        const idStr = typeof id === 'string' ? id : (id as any)._id
        storage.delete(idStr)
        return { ok: true, id: idStr }
      }),
      bulkDocs: vi.fn(async (docs: any[]) => {
        return docs.map(doc => {
          storage.set(doc._id, { ...doc, _rev: '1-rev' })
          return { ok: true, id: doc._id, rev: '1-rev' }
        })
      }),
    },
  }
}

describe('number-memory-db', () => {
  let mockDb: DbAdapter

  beforeEach(() => {
    mockDb = createMockDb()
    setDbAdapter(mockDb)
    vi.clearAllMocks()
  })

  afterEach(() => {
    resetDbAdapter()
    vi.restoreAllMocks()
  })

  describe('getNumberMemoryTraining', () => {
    it('无训练数据时应返回 null', async () => {
      const { getNumberMemoryTraining } = await loadModule()
      expect(getNumberMemoryTraining()).toBeNull()
    })

    it('存在训练数据时应返回', async () => {
      const { saveAssociation, getNumberMemoryTraining } = await loadModule()
      await saveAssociation({
        number: '0',
        imageUrl: '🍎',
        source: 'preset',
        description: '苹果',
      })

      const training = getNumberMemoryTraining()
      expect(training).not.toBeNull()
      expect(training!.associations).toHaveLength(1)
    })
  })

  describe('getAllAssociations', () => {
    it('无训练数据时应返回空数组', async () => {
      const { getAllAssociations } = await loadModule()
      expect(getAllAssociations()).toEqual([])
    })
  })

  describe('getAssociationByNumber', () => {
    it('应返回指定数字的关联', async () => {
      const { saveAssociation, getAssociationByNumber } = await loadModule()
      await saveAssociation({ number: '5', imageUrl: '🐯', source: 'preset', description: '老虎' })

      const association = getAssociationByNumber('5')
      expect(association).toBeDefined()
      expect(association!.imageUrl).toBe('🐯')
    })

    it('不存在的数字应返回 undefined', async () => {
      const { getAssociationByNumber } = await loadModule()
      expect(getAssociationByNumber('99')).toBeUndefined()
    })
  })

  describe('saveAssociation', () => {
    it('应创建新的关联', async () => {
      const { saveAssociation, getAllAssociations } = await loadModule()
      const result = await saveAssociation({
        number: '1',
        imageUrl: '🌲',
        source: 'preset',
        description: '树',
      })

      expect(result.ok).toBe(true)
      expect(getAllAssociations()).toHaveLength(1)
    })

    it('应更新已有的关联', async () => {
      const { saveAssociation, getAssociationByNumber } = await loadModule()
      await saveAssociation({ number: '1', imageUrl: '🌲', source: 'preset', description: '树' })
      await saveAssociation({ number: '1', imageUrl: '🎄', source: 'upload', description: '圣诞树' })

      const updated = getAssociationByNumber('1')
      expect(updated!.imageUrl).toBe('🎄')
      expect(updated!.source).toBe('upload')
    })
  })

  describe('removeAssociation', () => {
    it('应删除指定数字的关联', async () => {
      const { saveAssociation, removeAssociation, getAllAssociations } = await loadModule()
      await saveAssociation({ number: '1', imageUrl: '🌲', source: 'preset' })
      await saveAssociation({ number: '2', imageUrl: '🦆', source: 'preset' })

      const result = await removeAssociation('1')
      expect(result.ok).toBe(true)

      const associations = getAllAssociations()
      expect(associations).toHaveLength(1)
      expect(associations[0].number).toBe('2')
    })

    it('删除不存在的数字应返回成功', async () => {
      const { removeAssociation } = await loadModule()
      const result = await removeAssociation('99')
      expect(result.ok).toBe(true)
    })
  })

  describe('saveTrainingResult', () => {
    it('应保存训练结果', async () => {
      const { saveTrainingResult, getAllTrainingResults } = await loadModule()
      const result = await saveTrainingResult({
        type: 'number_memory_result',
        mode: 'numberToImage',
        totalQuestions: 10,
        correctAnswers: 7,
        duration: 60,
        details: [{ number: '1', correct: true, responseTime: 500 }],
        createdAt: Date.now(),
      })

      expect(result.ok).toBe(true)
      expect(getAllTrainingResults()).toHaveLength(1)
    })

    it('保存超过 3 条结果时只保留最近 3 条', async () => {
      const { saveTrainingResult, getAllTrainingResults } = await loadModule()
      const now = Date.now()
      for (let i = 0; i < 5; i++) {
        await saveTrainingResult({
          type: 'number_memory_result',
          mode: 'numberToImage',
          totalQuestions: 10,
          correctAnswers: i,
          duration: 60,
          details: [],
          createdAt: now + i * 1000,
        })
      }

      const results = getAllTrainingResults()
      expect(results.length).toBeLessThanOrEqual(3)
    })
  })

  describe('getAllTrainingResults', () => {
    it('无结果时应返回空数组', async () => {
      const { getAllTrainingResults } = await loadModule()
      expect(getAllTrainingResults()).toEqual([])
    })
  })

  describe('clearAllTrainingResults', () => {
    it('应清空所有训练结果', async () => {
      const { saveTrainingResult, clearAllTrainingResults, getAllTrainingResults } = await loadModule()
      await saveTrainingResult({
        type: 'number_memory_result',
        mode: 'numberToImage',
        totalQuestions: 10,
        correctAnswers: 5,
        duration: 30,
        details: [],
        createdAt: Date.now(),
      })

      clearAllTrainingResults()
      expect(getAllTrainingResults()).toHaveLength(0)
    })
  })

  describe('saveTrainingProgress / getTrainingProgress / clearTrainingProgress', () => {
    it('应保存并获取训练进度', async () => {
      const { saveTrainingProgress, getTrainingProgress } = await loadModule()
      const result = await saveTrainingProgress({
        _id: 'number_memory_progress',
        type: 'number_memory_progress',
        mode: 'imageToNumber',
        questions: [],
        currentQuestionIndex: 3,
        answerResults: [],
        elapsedTime: 45,
        hasAnswered: false,
        selectedAnswer: null,
        isCorrect: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })

      expect(result.ok).toBe(true)
      const progress = getTrainingProgress()
      expect(progress).not.toBeNull()
      expect(progress!.currentQuestionIndex).toBe(3)
    })

    it('无进度时应返回 null', async () => {
      const { getTrainingProgress } = await loadModule()
      expect(getTrainingProgress()).toBeNull()
    })

    it('文档非进度类型时应返回 null', async () => {
      const { getTrainingProgress } = await loadModule()
      mockDb.put({ _id: 'number_memory_progress', type: 'other_type', data: 'test' })
      expect(getTrainingProgress()).toBeNull()
    })

    it('应清除训练进度', async () => {
      const { saveTrainingProgress, clearTrainingProgress, getTrainingProgress } = await loadModule()
      await saveTrainingProgress({
        _id: 'number_memory_progress',
        type: 'number_memory_progress',
        mode: 'numberToImage',
        questions: [],
        currentQuestionIndex: 1,
        answerResults: [],
        elapsedTime: 10,
        hasAnswered: false,
        selectedAnswer: null,
        isCorrect: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })

      clearTrainingProgress()
      expect(getTrainingProgress()).toBeNull()
    })
  })

  describe('clearAllNumberMemoryData', () => {
    it('应清空所有数字记忆数据', async () => {
      const { saveAssociation, saveTrainingResult, clearAllNumberMemoryData, getAllAssociations, getAllTrainingResults } = await loadModule()
      await saveAssociation({ number: '1', imageUrl: '🌲', source: 'preset' })
      await saveTrainingResult({
        type: 'number_memory_result',
        mode: 'numberToImage',
        totalQuestions: 10,
        correctAnswers: 5,
        duration: 30,
        details: [],
        createdAt: Date.now(),
      })

      clearAllNumberMemoryData()
      expect(getAllAssociations()).toHaveLength(0)
      expect(getAllTrainingResults()).toHaveLength(0)
    })
  })
})
