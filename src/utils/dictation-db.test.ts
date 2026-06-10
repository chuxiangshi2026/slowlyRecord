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
  DB_KEY_DICTATION: 'dictation_',
}))

// 延迟导入被测试模块
async function loadModule() {
  return await import('./dictation-db')
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
      const idStr = typeof id === 'string' ? id : id._id
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

function makeProgress(wordBank: string, overrides: Partial<any> = {}) {
  return {
    _id: `dictation_progress_${wordBank}`,
    type: 'dictation_progress',
    wordList: [{ text: 'hello', explains: '你好' }],
    currentIndex: 0,
    stats: { correct: 5, wrong: 2 },
    errorCountMap: { 0: 1 },
    wordBank,
    wordCount: 10,
    displayMode: 'blank' as const,
    options: ['a', 'b', 'c'],
    updatedAt: Date.now(),
    ...overrides,
  }
}

function makeWord(text: string, explains: string) {
  return { _id: `word_${text}`, text, explains, isReview: true, ctime: new Date(), learnDate: new Date(), explainedHidden: false, level: 1 as const, remember: false }
}

describe('dictation-db', () => {
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

  describe('getDictationProgress', () => {
    it('没有进度时应返回 null', async () => {
      const { getDictationProgress } = await loadModule()
      expect(getDictationProgress()).toBeNull()
      expect(getDictationProgress('cet4')).toBeNull()
    })

    it('指定词库存在进度时应返回进度', async () => {
      const { saveDictationProgress, getDictationProgress } = await loadModule()
      await saveDictationProgress({
        wordList: [makeWord('hello', '你好')],
        currentIndex: 0,
        stats: { correct: 0, wrong: 0 },
        errorCountMap: {},
        wordBank: 'cet4',
        wordCount: 10,
        displayMode: 'blank',
        options: ['a'],
      })

      const progress = getDictationProgress('cet4')
      expect(progress).not.toBeNull()
      expect(progress!.wordBank).toBe('cet4')
      expect(progress!.type).toBe('dictation_progress')
    })

    it('不指定词库时应返回第一个有效进度', async () => {
      const { saveDictationProgress, getDictationProgress } = await loadModule()
      await saveDictationProgress({
        wordList: [makeWord('hello', '你好')],
        currentIndex: 0,
        stats: { correct: 0, wrong: 0 },
        errorCountMap: {},
        wordBank: 'gre',
        wordCount: 20,
        displayMode: 'blank',
        options: [],
      })

      const progress = getDictationProgress()
      expect(progress).not.toBeNull()
      expect(progress!.wordBank).toBe('gre')
    })

    it('过期的进度应返回 null', async () => {
      const { saveDictationProgress, getDictationProgress } = await loadModule()
      // 直接通过 mock db 插入一个过期进度
      mockDb.put(makeProgress('cet4', { updatedAt: Date.now() - 8 * 24 * 60 * 60 * 1000 }))

      const progress = getDictationProgress('cet4')
      expect(progress).toBeNull()
    })
  })

  describe('hasDictationProgress', () => {
    it('没有进度时应返回 false', async () => {
      const { hasDictationProgress } = await loadModule()
      expect(hasDictationProgress('cet4')).toBe(false)
    })

    it('有进度时应返回 true', async () => {
      const { saveDictationProgress, hasDictationProgress } = await loadModule()
      await saveDictationProgress({
        wordList: [makeWord('hello', '你好')],
        currentIndex: 0,
        stats: { correct: 0, wrong: 0 },
        errorCountMap: {},
        wordBank: 'toefl',
        wordCount: 10,
        displayMode: 'blank',
        options: [],
      })
      expect(hasDictationProgress('toefl')).toBe(true)
    })

    it('不传词库时检查是否存在任意进度', async () => {
      const { saveDictationProgress, hasDictationProgress } = await loadModule()
      await saveDictationProgress({
        wordList: [makeWord('test', '测试')],
        currentIndex: 0,
        stats: { correct: 0, wrong: 0 },
        errorCountMap: {},
        wordBank: 'ielts',
        wordCount: 10,
        displayMode: 'blank',
        options: [],
      })
      expect(hasDictationProgress()).toBe(true)
    })
  })

  describe('saveDictationProgress', () => {
    it('应成功保存新进度', async () => {
      const { saveDictationProgress, getDictationProgress } = await loadModule()
      const result = await saveDictationProgress({
        wordList: [makeWord('apple', '苹果')],
        currentIndex: 3,
        stats: { correct: 10, wrong: 1 },
        errorCountMap: {},
        wordBank: 'cet6',
        wordCount: 50,
        displayMode: 'partial',
        options: ['a', 'b', 'c', 'd'],
      })

      expect(result.ok).toBe(true)
      const saved = getDictationProgress('cet6')
      expect(saved).not.toBeNull()
      expect(saved!.currentIndex).toBe(3)
      expect(saved!.stats.correct).toBe(10)
      expect(saved!.displayMode).toBe('partial')
    })

    it('应更新已有进度', async () => {
      const { saveDictationProgress, getDictationProgress } = await loadModule()
      // 首次保存
      await saveDictationProgress({
        wordList: [makeWord('hello', '你好')],
        currentIndex: 0,
        stats: { correct: 0, wrong: 0 },
        errorCountMap: {},
        wordBank: 'kaoyan',
        wordCount: 100,
        displayMode: 'blank',
        options: [],
      })

      // 更新
      const result = await saveDictationProgress({
        wordList: [makeWord('hello', '你好'), makeWord('world', '世界')],
        currentIndex: 5,
        stats: { correct: 3, wrong: 2 },
        errorCountMap: { 0: 2 },
        wordBank: 'kaoyan',
        wordCount: 100,
        displayMode: 'partial',
        options: ['a', 'b'],
      })

      expect(result.ok).toBe(true)
      const saved = getDictationProgress('kaoyan')
      expect(saved!.currentIndex).toBe(5)
      expect(saved!.stats.correct).toBe(3)
    })

    it('db.put 失败时应返回错误结果', async () => {
      const { saveDictationProgress } = await loadModule()
      // 覆盖 promises.put 返回失败
      ;(mockDb.promises.put as any).mockResolvedValueOnce({
        ok: false, id: '', rev: '', error: true, message: 'Storage full',
      })

      const result = await saveDictationProgress({
        wordList: [makeWord('test', '测试')],
        currentIndex: 0,
        stats: { correct: 0, wrong: 0 },
        errorCountMap: {},
        wordBank: 'sat',
        wordCount: 10,
        displayMode: 'blank',
        options: [],
      })

      expect(result.ok).toBe(false)
      expect(result.error).toBe(true)
    })

    it('异常时应返回错误结果', async () => {
      const { saveDictationProgress } = await loadModule()
      ;(mockDb.promises.put as any).mockRejectedValueOnce(new Error('Connection lost'))

      const result = await saveDictationProgress({
        wordList: [makeWord('test', '测试')],
        currentIndex: 0,
        stats: { correct: 0, wrong: 0 },
        errorCountMap: {},
        wordBank: 'bec',
        wordCount: 10,
        displayMode: 'blank',
        options: [],
      })

      expect(result.ok).toBe(false)
      expect(result.message).toContain('Connection lost')
    })
  })

  describe('removeDictationProgress', () => {
    it('应删除指定词库的进度', async () => {
      const { saveDictationProgress, removeDictationProgress, getDictationProgress } = await loadModule()
      await saveDictationProgress({
        wordList: [makeWord('hello', '你好')],
        currentIndex: 0,
        stats: { correct: 0, wrong: 0 },
        errorCountMap: {},
        wordBank: 'cet4',
        wordCount: 10,
        displayMode: 'blank',
        options: [],
      })

      removeDictationProgress('cet4')
      expect(getDictationProgress('cet4')).toBeNull()
    })

    it('不传参数应删除所有进度', async () => {
      const { saveDictationProgress, removeDictationProgress, getDictationProgress } = await loadModule()
      await saveDictationProgress({
        wordList: [makeWord('a', '1')],
        currentIndex: 0,
        stats: { correct: 0, wrong: 0 },
        errorCountMap: {},
        wordBank: 'cet4',
        wordCount: 10,
        displayMode: 'blank',
        options: [],
      })
      await saveDictationProgress({
        wordList: [makeWord('b', '2')],
        currentIndex: 0,
        stats: { correct: 0, wrong: 0 },
        errorCountMap: {},
        wordBank: 'cet6',
        wordCount: 10,
        displayMode: 'blank',
        options: [],
      })

      removeDictationProgress()
      expect(getDictationProgress('cet4')).toBeNull()
      expect(getDictationProgress('cet6')).toBeNull()
    })

    it('删除不存在的词库进度不应报错', async () => {
      const { removeDictationProgress } = await loadModule()
      expect(() => removeDictationProgress('nonexistent')).not.toThrow()
    })
  })

  describe('cleanExpiredProgress', () => {
    it('应清除过期的进度', async () => {
      const { saveDictationProgress, getDictationProgress, cleanExpiredProgress } = await loadModule()
      // 保存一个有效进度
      await saveDictationProgress({
        wordList: [makeWord('hello', '你好')],
        currentIndex: 0,
        stats: { correct: 0, wrong: 0 },
        errorCountMap: {},
        wordBank: 'cet4',
        wordCount: 10,
        displayMode: 'blank',
        options: [],
      })

      // 手动插入一个过期进度
      mockDb.put(makeProgress('cet6', { updatedAt: Date.now() - 8 * 24 * 60 * 60 * 1000 }))

      cleanExpiredProgress()

      // 过期进度应被清除
      expect(getDictationProgress('cet6')).toBeNull()
    })

    it('不应清除未过期的进度', async () => {
      const { saveDictationProgress, getDictationProgress, cleanExpiredProgress } = await loadModule()
      await saveDictationProgress({
        wordList: [makeWord('hello', '你好')],
        currentIndex: 0,
        stats: { correct: 0, wrong: 0 },
        errorCountMap: {},
        wordBank: 'cet4',
        wordCount: 10,
        displayMode: 'blank',
        options: [],
      })

      cleanExpiredProgress()

      expect(getDictationProgress('cet4')).not.toBeNull()
    })
  })
})
