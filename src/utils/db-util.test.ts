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
  DB_KEY: 'words-list',
}))

async function loadModule() {
  return await import('./db-util')
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

function makeWord(overrides: Partial<any> = {}) {
  return {
    _id: 'word_test_1',
    text: 'hello',
    explains: '你好',
    isReview: true,
    ctime: new Date(),
    learnDate: new Date(),
    explainedHidden: false,
    level: 1 as const,
    remember: false,
    ...overrides,
  }
}

describe('db-util', () => {
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

  describe('listDbWords', () => {
    it('无单词时应返回空数组', async () => {
      const { listDbWords } = await loadModule()
      expect(listDbWords()).toEqual([])
    })

    it('应返回数据库中所有单词', async () => {
      // 模拟 doc._id 以 words-list 开头的文档
      // 注意：listDbWords 内部调用 db.allDocs(DB_KEY)，prefix 为 'words-list'
      // 直接通过 put 存入 _id 以 'words-list' 开头的文档
      mockDb.put({ _id: 'words-list_1', text: 'hello', explains: '你好' })
      mockDb.put({ _id: 'words-list_2', text: 'world', explains: '世界' })

      const { listDbWords } = await loadModule()
      const words = listDbWords()
      expect(words).toHaveLength(2)
    })

    it('应清理单词文本中的空白字符', async () => {
      mockDb.put({ _id: 'words-list_1', text: '  he llo  ', explains: '你好' })

      const { listDbWords } = await loadModule()
      const words = listDbWords()
      expect(words[0].text).toBe('he llo')
    })
  })

  describe('addAndUpdateDbWord', () => {
    it('应添加新单词', async () => {
      const { addAndUpdateDbWord } = await loadModule()
      const result = await addAndUpdateDbWord(makeWord())

      expect(result.ok).toBe(true)
      const word = mockDb.get('word_test_1')
      expect(word).not.toBeNull()
      expect(word!.text).toBe('hello')
    })

    it('应更新已有单词（带上 _rev）', async () => {
      const { addAndUpdateDbWord } = await loadModule()
      await addAndUpdateDbWord(makeWord({ text: 'old' }))

      // 第二次保存同一个 _id 的单词
      await addAndUpdateDbWord(makeWord({ text: 'new' }))

      const word = mockDb.get('word_test_1')
      expect(word!.text).toBe('new')
    })

    it('应清理单词文本中的空白字符', async () => {
      const { addAndUpdateDbWord } = await loadModule()
      await addAndUpdateDbWord(makeWord({ text: '  ap ple  ' }))

      const word = mockDb.get('word_test_1')
      expect(word!.text).toBe('ap ple')
    })

    it('put 失败时应返回错误', async () => {
      const { addAndUpdateDbWord } = await loadModule()
      ;(mockDb.promises.put as any).mockResolvedValueOnce({
        ok: false, id: '', rev: '', error: true, message: 'Disk full',
      })

      const result = await addAndUpdateDbWord(makeWord())
      expect(result.ok).toBe(false)
    })
  })

  describe('updateDbWordList', () => {
    it('应批量更新单词', async () => {
      const { updateDbWordList, listDbWords } = await loadModule()
      const words = [
        makeWord({ _id: 'words-list_a', text: 'apple' }),
        makeWord({ _id: 'words-list_b', text: 'banana' }),
      ]

      const results = await updateDbWordList(words)
      expect(results).toHaveLength(2)
      expect(results[0].ok).toBe(true)
      expect(results[1].ok).toBe(true)

      const allWords = listDbWords()
      expect(allWords).toHaveLength(2)
    })

    it('空数组应返回空结果', async () => {
      const { updateDbWordList } = await loadModule()
      const results = await updateDbWordList([])
      expect(results).toEqual([])
    })

    it('应清理文本中的空白字符', async () => {
      const { updateDbWordList, listDbWords } = await loadModule()
      await updateDbWordList([makeWord({ _id: 'words-list_x', text: '  zig zag  ' })])

      const words = listDbWords()
      expect(words.find(w => w._id === 'words-list_x')!.text).toBe('zig zag')
    })
  })

  describe('removeDbWordById', () => {
    it('应删除指定 ID 的单词', async () => {
      const { addAndUpdateDbWord, removeDbWordById } = await loadModule()
      await addAndUpdateDbWord(makeWord({ _id: 'word_to_delete' }))

      removeDbWordById('word_to_delete')
      const word = mockDb.get('word_to_delete')
      expect(word).toBeNull()
    })
  })
})
