/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useMobileWords } from './useMobileWords'
import { setDbAdapter, resetDbAdapter } from '../../../src/adapters/db'
import type { DbAdapter } from '../../../src/adapters/db'

// Mock uni API
;(global as any).uni = {
  setStorageSync: vi.fn(),
  getStorageSync: vi.fn(() => null),
  removeStorageSync: vi.fn(),
  getStorageInfoSync: vi.fn(() => ({ keys: [] })),
  showToast: vi.fn(),
  showModal: vi.fn(),
}

function createMockDbAdapter(): DbAdapter {
  const store = new Map<string, any>()

  return {
    get: vi.fn((id: string) => store.get(id) || null),
    put: vi.fn((doc: any) => {
      store.set(doc._id, doc)
      return { id: doc._id, ok: true, rev: '1' }
    }),
    remove: vi.fn((doc: any) => {
      const id = typeof doc === 'string' ? doc : doc._id
      store.delete(id)
      return { id, ok: true }
    }),
    allDocs: vi.fn((prefix?: string) => {
      const docs = Array.from(store.values())
      if (prefix) {
        return docs.filter((d: any) => d._id.startsWith(prefix))
      }
      return docs
    }),
    bulkDocs: vi.fn((docs: any[]) => {
      return docs.map(doc => {
        store.set(doc._id, doc)
        return { id: doc._id, ok: true }
      })
    }),
    promises: {
      get: vi.fn(async (id: string) => store.get(id) || null),
      put: vi.fn(async (doc: any) => {
        store.set(doc._id, doc)
        return { id: doc._id, ok: true, rev: '1' }
      }),
      remove: vi.fn(async (doc: any) => {
        const id = typeof doc === 'string' ? doc : doc._id
        store.delete(id)
        return { id, ok: true }
      }),
      bulkDocs: vi.fn(async (docs: any[]) => {
        return docs.map(doc => {
          store.set(doc._id, doc)
          return { id: doc._id, ok: true }
        })
      }),
    },
  }
}

describe('useMobileWords Store', () => {
  let mockDb: DbAdapter

  beforeEach(() => {
    setActivePinia(createPinia())
    resetDbAdapter()
    mockDb = createMockDbAdapter()
    setDbAdapter(mockDb)
  })

  describe('初始状态', () => {
    it('应该有空的单词列表', () => {
      const store = useMobileWords()
      expect(store.words).toEqual([])
      expect(store.isLoading).toBe(false)
    })

    it('wordCount 应该为 0', () => {
      const store = useMobileWords()
      expect(store.wordCount).toBe(0)
    })

    it('reviewWords 应该为空', () => {
      const store = useMobileWords()
      expect(store.reviewWords).toEqual([])
    })
  })

  describe('loadWords', () => {
    it('应该加载单词列表', async () => {
      const store = useMobileWords()

      // 预置数据
      await mockDb.promises.put({ _id: 'mobile_words_1', data: { word: 'hello', meaning: '你好', addTime: Date.now(), reviewCount: 0, nextReviewTime: Date.now() - 1000 } })

      await store.loadWords()

      expect(store.words.length).toBe(1)
      expect(store.words[0].word).toBe('hello')
    })

    it('空数据时应该设置空列表', async () => {
      const store = useMobileWords()
      await store.loadWords()
      expect(store.words).toEqual([])
    })
  })

  describe('addWord', () => {
    it('应该添加新单词', async () => {
      const store = useMobileWords()

      const word = await store.addWord({
        word: 'test',
        meaning: '测试',
        addTime: Date.now(),
        reviewCount: 0,
        nextReviewTime: Date.now() + 86400000,
      })

      expect(word.word).toBe('test')
      expect(word.id).toBeDefined()
      expect(store.words.length).toBe(1)
    })
  })

  describe('deleteWord', () => {
    it('应该删除单词', async () => {
      const store = useMobileWords()

      const word = await store.addWord({
        word: 'test',
        meaning: '测试',
        addTime: Date.now(),
        reviewCount: 0,
        nextReviewTime: Date.now(),
      })

      await store.deleteWord(word.id)

      expect(store.words.length).toBe(0)
    })
  })

  describe('markAsRemembered', () => {
    it('应该标记单词为已记住并更新复习时间', async () => {
      const store = useMobileWords()

      const word = await store.addWord({
        word: 'test',
        meaning: '测试',
        addTime: Date.now(),
        reviewCount: 0,
        nextReviewTime: Date.now(),
      })

      await store.markAsRemembered(word.id)

      const updated = store.words.find(w => w.id === word.id)
      expect(updated?.remembered).toBe(true)
      expect(updated?.reviewCount).toBe(1)
      expect(updated?.nextReviewTime).toBeGreaterThan(Date.now())
    })
  })

  describe('markAsForgotten', () => {
    it('应该标记单词为忘记并设置短时间后复习', async () => {
      const store = useMobileWords()

      const word = await store.addWord({
        word: 'test',
        meaning: '测试',
        addTime: Date.now(),
        reviewCount: 0,
        nextReviewTime: Date.now(),
      })

      await store.markAsForgotten(word.id)

      const updated = store.words.find(w => w.id === word.id)
      expect(updated?.remembered).toBe(false)
      expect(updated?.needsReview).toBe(true)
      expect(updated?.nextReviewTime).toBeLessThanOrEqual(Date.now() + 11 * 60 * 1000)
    })
  })

  describe('exportWords / importWords', () => {
    it('应该导出所有单词', async () => {
      const store = useMobileWords()

      await store.addWord({
        word: 'hello',
        meaning: '你好',
        addTime: Date.now(),
        reviewCount: 0,
        nextReviewTime: Date.now(),
      })

      const exported = store.exportWords()
      expect(exported.length).toBe(1)
      expect(exported[0].word).toBe('hello')
    })

    it('应该导入单词列表', async () => {
      const store = useMobileWords()

      await store.importWords([
        { id: 'mobile_words_import-1', word: 'imported', meaning: '导入的', addTime: Date.now(), reviewCount: 0, nextReviewTime: Date.now() },
      ])

      expect(store.words.length).toBe(1)
      expect(store.words[0].word).toBe('imported')
    })
  })

  describe('clearAllWords', () => {
    it('应该清空所有单词', async () => {
      const store = useMobileWords()

      await store.addWord({
        word: 'test1',
        meaning: '测试1',
        addTime: Date.now(),
        reviewCount: 0,
        nextReviewTime: Date.now(),
      })
      await store.addWord({
        word: 'test2',
        meaning: '测试2',
        addTime: Date.now(),
        reviewCount: 0,
        nextReviewTime: Date.now(),
      })

      await store.clearAllWords()

      expect(store.words.length).toBe(0)
    })
  })
})
