/**
 * @vitest-environment jsdom
 *
 * 移动端同步墓碑（useUtils/sync-tombstone.ts）单元测试
 *
 * 对照桌面端 src/utils/sync-tombstone.test.ts 的用例结构，
 * 聚焦：墓碑读写/conflict 重试/合并回写（空 remote 不回写）/双向过滤，
 * 以及各 store 删除入口的埋点接入（词/文章/笔记/提示词/数字桩/数字条目）。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { setDbAdapter, resetDbAdapter, type DbAdapter } from '@/adapters/index'
import {
  getTombstones,
  recordTombstone,
  recordTombstones,
  mergeTombstones,
  pruneTombstones,
  filterByTombstones,
  TOMBSTONES_DOC_ID,
  TOMBSTONE_MAX_AGE_MS,
} from './sync-tombstone'

// Mock uni API（带内存 storage）
const storageMap = new Map<string, any>()
;(global as any).uni = {
  setStorageSync: vi.fn((k: string, v: any) => { storageMap.set(k, v) }),
  getStorageSync: vi.fn((k: string) => storageMap.get(k) ?? null),
  removeStorageSync: vi.fn((k: string) => { storageMap.delete(k) }),
  getStorageInfoSync: vi.fn(() => ({ keys: Array.from(storageMap.keys()) })),
  showToast: vi.fn(),
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

  return {
    get: vi.fn((id: string) => getDoc(id)),
    put: vi.fn((doc: any) => putDoc(doc)),
    remove: vi.fn((doc: any) => {
      const id = typeof doc === 'string' ? doc : doc._id
      store.delete(id)
      return { id, ok: true }
    }),
    allDocs: vi.fn((prefix?: string) => {
      const docs = Array.from(store.values())
      return prefix ? docs.filter((d: any) => d._id.startsWith(prefix)) : docs
    }),
    bulkDocs: vi.fn((docs: any[]) => docs.map(doc => putDoc(doc))),
    promises: {
      get: vi.fn(async (id: string) => getDoc(id)),
      put: vi.fn(async (doc: any) => putDoc(doc)),
      remove: vi.fn(async (doc: any) => {
        const id = typeof doc === 'string' ? doc : doc._id
        store.delete(id)
        return { id, ok: true }
      }),
      bulkDocs: vi.fn(async (docs: any[]) => docs.map(doc => putDoc(doc))),
      asyncPut: vi.fn(async (doc: any) => putDoc(doc)),
      asyncBulkDocs: vi.fn(async (docs: any[]) => docs.map(doc => putDoc(doc))),
    },
  }
}

/** recordTombstone(s) 是 fire-and-forget，埋点后等一拍再断言落库结果 */
async function flushAsync(): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, 20))
}

describe('mobile sync-tombstone', () => {
  let mockDb: DbAdapter

  beforeEach(() => {
    setActivePinia(createPinia())
    resetDbAdapter()
    storageMap.clear()
    mockDb = createMockDbAdapter()
    setDbAdapter(mockDb)
  })

  describe('recordTombstone / getTombstones', () => {
    it('无文档时创建墓碑文档并写入 deletedAt', async () => {
      await recordTombstone('word-1')
      const tombstones = getTombstones()
      expect(tombstones['word-1']).toBeTypeOf('number')
    })

    it('多条墓碑合并到同一份文档（跨模块共享 id 池）', async () => {
      await recordTombstone('article-1')
      await recordTombstone('sentence-1')
      await recordTombstone('article-1')

      const tombstones = getTombstones()
      expect(Object.keys(tombstones)).toHaveLength(2)
      expect(mockDb.get!(TOMBSTONES_DOC_ID)).toBeTruthy()
    })

    it('conflict 时重读重试一次后成功', async () => {
      mockDb.promises.put.mockImplementationOnce(async () => ({ id: TOMBSTONES_DOC_ID, ok: false, error: true, message: 'conflict' }))

      await recordTombstone('word-conflict')

      expect(mockDb.promises.put).toHaveBeenCalledTimes(2)
      expect(getTombstones()['word-conflict']).toBeTypeOf('number')
    })

    it('空 id 不写入', async () => {
      await recordTombstone('')
      expect(mockDb.get!(TOMBSTONES_DOC_ID)).toBeFalsy()
    })
  })

  describe('recordTombstones（批量）', () => {
    it('多条 id 合并进一次写入', async () => {
      const putSpy = mockDb.promises.put
      await recordTombstones(['w1', 'w2', 'w3', 'w1'])

      expect(putSpy).toHaveBeenCalledTimes(1)
      const tombstones = getTombstones()
      expect(Object.keys(tombstones).sort()).toEqual(['w1', 'w2', 'w3'])
    })

    it('空数组 / 全空 id 不写入', async () => {
      await recordTombstones([])
      await recordTombstones(['', ''])
      expect(mockDb.get!(TOMBSTONES_DOC_ID)).toBeFalsy()
    })
  })

  describe('mergeTombstones', () => {
    it('合并远端墓碑取较大 deletedAt，并回写本地', async () => {
      const now = Date.now()
      await recordTombstone('local-only')
      mockDb.put!({
        _id: TOMBSTONES_DOC_ID,
        type: 'sync-tombstones',
        tombstones: { 'local-only': now, shared: now - 1000 },
        updatedAt: now,
      } as any)

      const merged = await mergeTombstones({ shared: now - 500, 'remote-only': now - 100 })

      expect(merged['shared']).toBe(now - 500)
      expect(merged['remote-only']).toBe(now - 100)
      expect(merged['local-only']).toBeTypeOf('number')
      expect(getTombstones()['remote-only']).toBe(now - 100)
    })

    it('空 remote（{}）不触发回写', async () => {
      await recordTombstone('local-keep')
      mockDb.promises.put.mockClear()

      const merged = await mergeTombstones({})

      expect(mockDb.promises.put).not.toHaveBeenCalled()
      expect(merged['local-keep']).toBeTypeOf('number')
    })

    it('remote 为 undefined 不触发回写', async () => {
      await recordTombstone('local-keep2')
      mockDb.promises.put.mockClear()

      const merged = await mergeTombstones(undefined)

      expect(mockDb.promises.put).not.toHaveBeenCalled()
      expect(merged['local-keep2']).toBeTypeOf('number')
    })
  })

  describe('pruneTombstones', () => {
    it('删除早于窗口期的墓碑，保留窗口期内的', async () => {
      const now = Date.now()
      mockDb.put!({
        _id: TOMBSTONES_DOC_ID,
        type: 'sync-tombstones',
        tombstones: {
          fresh: now,
          expired: now - TOMBSTONE_MAX_AGE_MS - 1000,
        },
        updatedAt: now,
      } as any)

      await pruneTombstones()

      const tombstones = getTombstones()
      expect(tombstones['fresh']).toBeTypeOf('number')
      expect(tombstones['expired']).toBeUndefined()
    })
  })

  describe('filterByTombstones', () => {
    const now = Date.now()

    it('remote：墓碑 deletedAt 不早于条目更新时间时剔除已删条目', () => {
      const tombstones = { 'w-1': now, 'w-2': now - 1000 }
      const items = [
        { id: 'w-1', updatedAt: now - 100 },   // 删除晚于更新 → 剔除
        { id: 'w-2', updatedAt: now },          // 删除早于条目最后更新 → 保留
        { id: 'w-3', updatedAt: now - 5000 },   // 无墓碑 → 保留
      ]
      const result = filterByTombstones(items, 'remote', tombstones)
      expect(result.map(i => i.id)).toEqual(['w-2', 'w-3'])
    })

    it('移动端词无 updatedAt 时按 0 处理：有墓碑即剔除', () => {
      const tombstones = { 'mobile_words_1': now }
      const items = [{ id: 'mobile_words_1', word: 'hello' }]
      expect(filterByTombstones(items, 'remote', tombstones)).toHaveLength(0)
    })

    it('墓碑表为空时原样返回副本', () => {
      const items = [{ id: 'w-1' }]
      expect(filterByTombstones(items, 'remote', {})).toEqual(items)
      expect(filterByTombstones(items, 'remote', {})).not.toBe(items)
    })
  })

  describe('删除埋点接入', () => {
    it('deleteWord / deleteBank / clearBankWords 应埋词与词库墓碑', async () => {
      const { useMobileWords } = await import('../useMobileWords')
      const store = useMobileWords()
      await store.loadWords()

      const bank = store.createBank('GRE')
      store.switchBank(bank.id)
      const w1 = await store.addWord({ word: 'gre-a', meaning: '甲', addTime: Date.now(), reviewCount: 0, nextReviewTime: Date.now() })
      const w2 = await store.addWord({ word: 'gre-b', meaning: '乙', addTime: Date.now(), reviewCount: 0, nextReviewTime: Date.now() })
      await store.deleteWord(w1.id)
      await flushAsync()
      expect(getTombstones()[w1.id]).toBeTypeOf('number')
      expect(getTombstones()[w2.id]).toBeUndefined()

      // 清空词库：库内剩余词全部埋点
      await store.clearBankWords(bank.id)
      await flushAsync()
      expect(getTombstones()[w2.id]).toBeTypeOf('number')

      // 删除词库：词库 id + 库内词 id 一并埋点
      const w3 = await store.addWord({ word: 'gre-c', meaning: '丙', addTime: Date.now(), reviewCount: 0, nextReviewTime: Date.now() })
      await store.deleteBank(bank.id)
      await flushAsync()
      const tombstones = getTombstones()
      expect(tombstones[bank.id]).toBeTypeOf('number')
      expect(tombstones[w3.id]).toBeTypeOf('number')
    })

    it('deleteArticle 应埋文章及其级联笔记/提示词的墓碑', async () => {
      const { useTextMemory } = await import('../useTextMemory')
      const store = useTextMemory()

      const article = store.addArticle({ title: '测试文章', content: '正文' })
      const note = store.addNote(article._id, '笔记内容')
      const prompt = store.addPrompt(article._id, '提示标题', '提示内容')

      store.deleteArticle(article._id)
      await flushAsync()

      const tombstones = getTombstones()
      expect(tombstones[article._id]).toBeTypeOf('number')
      expect(tombstones[note._id]).toBeTypeOf('number')
      expect(tombstones[prompt._id]).toBeTypeOf('number')
    })

    it('deleteNote / deletePrompt 应埋对应墓碑', async () => {
      const { useTextMemory } = await import('../useTextMemory')
      const store = useTextMemory()

      const article = store.addArticle({ title: '宿主', content: '正文' })
      const note = store.addNote(article._id, 'n')
      const prompt = store.addPrompt(article._id, 'p', 'c')

      store.deleteNote(note._id)
      store.deletePrompt(prompt._id)
      await flushAsync()

      const tombstones = getTombstones()
      expect(tombstones[note._id]).toBeTypeOf('number')
      expect(tombstones[prompt._id]).toBeTypeOf('number')
      // 宿主文章不受影响
      expect(tombstones[article._id]).toBeUndefined()
    })

    it('deleteAssociation（墓碑键为数字本身）/ deleteEntry / clearAllAssociations 应埋墓碑', async () => {
      const { useNumberMemory } = await import('../useNumberMemory')
      const store = useNumberMemory()
      store.load()

      store.setAssociation({ number: '99', description: '九九' })
      store.setAssociation({ number: '88', description: '八八' })
      const entry = store.addEntry({ title: '条目', numbers: '9988' })

      store.deleteAssociation('99')
      store.deleteEntry(entry._id)
      await flushAsync()

      let tombstones = getTombstones()
      expect(tombstones['99']).toBeTypeOf('number')
      expect(tombstones[entry._id]).toBeTypeOf('number')
      expect(tombstones['88']).toBeUndefined()

      store.clearAllAssociations()
      await flushAsync()
      tombstones = getTombstones()
      expect(tombstones['88']).toBeTypeOf('number')
    })
  })
})
