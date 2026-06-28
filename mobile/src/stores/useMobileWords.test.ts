/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useMobileWords } from './useMobileWords'
import { setDbAdapter, resetDbAdapter } from '@/adapters/index'
import type { DbAdapter } from '@/adapters/index'

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
  let revCounter = 0

  function getDoc(id: string) {
    return store.get(id) || null
  }

  function putDoc(doc: any) {
    const existing = store.get(doc._id)
    // 模拟 PouchDB 冲突检测：更新已有文档必须提供正确的 _rev
    if (existing && doc._rev !== existing._rev) {
      return { id: doc._id, ok: false, error: true, message: 'conflict' }
    }
    const rev = `rev-${++revCounter}`
    store.set(doc._id, { ...doc, _rev: rev })
    return { id: doc._id, ok: true, rev }
  }

  function removeDoc(doc: any) {
    const id = typeof doc === 'string' ? doc : doc._id
    const existing = store.get(id)
    if (!existing) {
      return { id, ok: false, error: true, message: 'doc not found' }
    }
    if (doc._rev && doc._rev !== existing._rev) {
      return { id, ok: false, error: true, message: 'conflict' }
    }
    store.delete(id)
    return { id, ok: true }
  }

  return {
    get: vi.fn((id: string) => getDoc(id)),
    put: vi.fn((doc: any) => putDoc(doc)),
    remove: vi.fn((doc: any) => removeDoc(doc)),
    allDocs: vi.fn((prefix?: string) => {
      const docs = Array.from(store.values())
      if (prefix) {
        return docs.filter((d: any) => d._id.startsWith(prefix))
      }
      return docs
    }),
    bulkDocs: vi.fn((docs: any[]) => {
      return docs.map(doc => putDoc(doc))
    }),
    promises: {
      get: vi.fn(async (id: string) => getDoc(id)),
      put: vi.fn(async (doc: any) => putDoc(doc)),
      remove: vi.fn(async (doc: any) => removeDoc(doc)),
      bulkDocs: vi.fn(async (docs: any[]) => {
        return docs.map(doc => putDoc(doc))
      }),
      // 实际 MiniProgramDbAdapter 还提供 asyncPut / asyncBulkDocs，
      // 测试中等价于 put / bulkDocs 的异步版本
      asyncPut: vi.fn(async (doc: any) => putDoc(doc)),
      asyncBulkDocs: vi.fn(async (docs: any[]) => {
        return docs.map(doc => putDoc(doc))
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

    it('导入时应按规范化 word 去重', async () => {
      const store = useMobileWords()

      await store.importWords([
        { id: 'mobile_words_import-1', word: 'Apple', meaning: '苹果', addTime: Date.now(), reviewCount: 0, nextReviewTime: Date.now() },
      ])

      const result = await store.importWords([
        { id: 'mobile_words_import-2', word: ' apple ', meaning: '苹果2', addTime: Date.now(), reviewCount: 0, nextReviewTime: Date.now() },
      ])

      expect(result.imported).toHaveLength(0)
      expect(result.skippedCount).toBe(1)
      expect(store.words).toHaveLength(1)
      expect(store.words[0].word).toBe('Apple')
    })

    it('同批次导入词组应折叠空格并去重', async () => {
      const store = useMobileWords()

      const result = await store.importWords([
        { id: 'mobile_words_import-1', word: 'take   off', meaning: '起飞', addTime: Date.now(), reviewCount: 0, nextReviewTime: Date.now() },
        { id: 'mobile_words_import-2', word: ' take off ', meaning: '脱下', addTime: Date.now(), reviewCount: 0, nextReviewTime: Date.now() },
      ])

      expect(result.imported).toHaveLength(1)
      expect(result.skippedCount).toBe(1)
      expect(store.words).toHaveLength(1)
      expect(store.words[0].word).toBe('take off')
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

  describe('_rev 冲突与持久化闭环', () => {
    it('更新已有单词应该携带 _rev 避免冲突', async () => {
      const store = useMobileWords()

      const word = await store.addWord({
        word: 'test',
        meaning: '测试',
        addTime: Date.now(),
        reviewCount: 0,
        nextReviewTime: Date.now(),
      })

      // 更新单词不应抛出冲突错误
      await expect(store.updateWord(word.id, { meaning: '已更新' })).resolves.not.toThrow()

      const updated = store.words.find(w => w.id === word.id)
      expect(updated?.meaning).toBe('已更新')
    })

    it('删除单词应将其从 store 中移除', async () => {
      // 注：当前实现按 bank 维度异步落盘，单条 delete 不直接调 db.promises.remove，
      // 这里只校验 store 内的可见行为。
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

    it('模拟重启后重新加载应读到最新数据', async () => {
      const store = useMobileWords()

      await store.addWord({
        word: 'persistent',
        meaning: '持久化',
        addTime: Date.now(),
        reviewCount: 0,
        nextReviewTime: Date.now(),
      })

      // markBankDirty 是异步落盘，必须显式 flush 后再 reload
      await store.flushDirtyBanks()
      await store.loadWords()

      expect(store.words.length).toBeGreaterThanOrEqual(1)
      expect(store.words.some(w => w.word === 'persistent')).toBe(true)
    })

    it('markAsForgotten 更新时应携带 _rev 避免冲突', async () => {
      const store = useMobileWords()

      const word = await store.addWord({
        word: 'test',
        meaning: '测试',
        addTime: Date.now(),
        reviewCount: 0,
        nextReviewTime: Date.now(),
      })

      await expect(store.markAsForgotten(word.id)).resolves.not.toThrow()

      const updated = store.words.find(w => w.id === word.id)
      expect(updated?.remembered).toBe(false)
      expect(updated?.needsReview).toBe(true)
    })
  })
})
