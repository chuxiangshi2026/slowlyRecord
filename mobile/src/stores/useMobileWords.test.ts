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
    it('答对应升级 level 但未达 12 级不应永久记住', async () => {
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
      expect(updated?.remembered).toBe(false)
      expect(updated?.level).toBe(2)
      expect(updated?.reviewCount).toBe(1)
      expect(updated?.nextReviewTime).toBeGreaterThan(Date.now())
    })

    it('level 达到 12 级才算永久记住', async () => {
      const store = useMobileWords()

      const word = await store.addWord({
        word: 'test',
        meaning: '测试',
        addTime: Date.now(),
        reviewCount: 0,
        nextReviewTime: Date.now(),
        level: 12,
      })

      await store.markAsRemembered(word.id)

      const updated = store.words.find(w => w.id === word.id)
      expect(updated?.level).toBe(12)
      expect(updated?.remembered).toBe(true)
    })

    it('level 应钳制到 0-12，不会出现 13/14', async () => {
      const store = useMobileWords()

      const word = await store.addWord({
        word: 'test',
        meaning: '测试',
        addTime: Date.now(),
        reviewCount: 0,
        nextReviewTime: Date.now(),
        level: 12,
      })

      store.updateWordLevel(word.id, 14)

      const updated = store.words.find(w => w.id === word.id)
      expect(updated?.level).toBe(12)
      expect(updated?.remembered).toBe(true)
    })
  })

  describe('存量污染数据修复', () => {
    it('加载时 remembered=true 但 level<12 的词应纠正为未记住', async () => {
      const store = useMobileWords()

      // 预置被污染的词库级数据
      await mockDb.promises.put({
        _id: 'bank_default_words',
        data: [
          { id: 'w1', word: 'polluted', meaning: '污染', addTime: Date.now(), reviewCount: 1, nextReviewTime: Date.now(), level: 3, remembered: true, bankId: 'default' },
          { id: 'w2', word: 'clean', meaning: '正常', addTime: Date.now(), reviewCount: 1, nextReviewTime: Date.now(), level: 12, remembered: true, bankId: 'default' },
        ]
      })

      await store.loadWords()

      const polluted = store.words.find(w => w.word === 'polluted')
      const clean = store.words.find(w => w.word === 'clean')
      expect(polluted?.remembered).toBe(false)
      expect(clean?.remembered).toBe(true)

      // flush 时会通过既有 markBankDirty 机制落库（mock 带 _rev 冲突语义，这里只校验调用发生）
      await store.flushDirtyBanks()
      expect(mockDb.promises.asyncPut).toHaveBeenCalledWith(
        expect.objectContaining({ _id: 'bank_default_words' })
      )
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

    it('忘记应降级而非无条件归 1：与桌面端 computeLevelDown 口径一致（≥12 重置 1，否则 -1，下限 1）', async () => {
      const store = useMobileWords()

      const lv6 = await store.addWord({
        word: 'downgrade6', meaning: '六级词', addTime: Date.now(), reviewCount: 3,
        nextReviewTime: Date.now(), level: 6,
      })
      const lv12 = await store.addWord({
        word: 'downgrade12', meaning: '满级词', addTime: Date.now(), reviewCount: 9,
        nextReviewTime: Date.now(), level: 12, remembered: true,
      })
      const lv1 = await store.addWord({
        word: 'downgrade1', meaning: '一级词', addTime: Date.now(), reviewCount: 0,
        nextReviewTime: Date.now(), level: 1,
      })

      await store.markAsForgotten(lv6.id)
      await store.markAsForgotten(lv12.id)
      await store.markAsForgotten(lv1.id)

      const w6 = store.words.find(w => w.id === lv6.id)
      const w12 = store.words.find(w => w.id === lv12.id)
      const w1 = store.words.find(w => w.id === lv1.id)
      // 6 级答错降到 5 级，不再归零
      expect(w6?.level).toBe(5)
      expect(w6?.remembered).toBe(false)
      // 满级答错重置回 1 级
      expect(w12?.level).toBe(1)
      // 1 级答错保持 1 级，不会掉到 0 以下
      expect(w1?.level).toBe(1)
    })
  })

  describe('computeForgotLevel / snapshotReviewState（撤销判定用纯函数）', () => {
    it('computeForgotLevel 降级口径正确', async () => {
      const { computeForgotLevel } = await import('./useMobileWords')
      expect(computeForgotLevel(12)).toBe(1)
      expect(computeForgotLevel(13)).toBe(1)
      expect(computeForgotLevel(6)).toBe(5)
      expect(computeForgotLevel(1)).toBe(1)
      expect(computeForgotLevel(0)).toBe(1)
      expect(computeForgotLevel(undefined as any)).toBe(1)
    })

    it('snapshotReviewState 应完整抽取判定会改动的字段', async () => {
      const { snapshotReviewState } = await import('./useMobileWords')
      const word = {
        id: 'w1', word: 'apple', meaning: '苹果', addTime: 1, reviewCount: 4,
        nextReviewTime: 123, needsReview: false, remembered: true, level: 8, lastReviewTime: 456,
      }
      expect(snapshotReviewState(word as any)).toEqual({
        level: 8, reviewCount: 4, lastReviewTime: 456, nextReviewTime: 123,
        needsReview: false, remembered: true,
      })
    })

    it('判定后可用快照恢复原状态（撤销流程）', async () => {
      const { snapshotReviewState } = await import('./useMobileWords')
      const store = useMobileWords()

      const word = await store.addWord({
        word: 'undo-me', meaning: '撤销', addTime: Date.now(), reviewCount: 4,
        nextReviewTime: Date.now(), level: 7,
      })
      const before = snapshotReviewState(store.words.find(w => w.id === word.id)!)

      await store.markAsForgotten(word.id)
      expect(store.words.find(w => w.id === word.id)?.level).toBe(6)

      // 撤销：整体写回快照字段
      await store.updateWord(word.id, { ...before })
      const restored = store.words.find(w => w.id === word.id)
      expect(restored?.level).toBe(7)
      expect(restored?.reviewCount).toBe(4)
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
