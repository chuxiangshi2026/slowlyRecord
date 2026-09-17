// @vitest-environment jsdom
/**
 * 同步墓碑（sync-tombstone.ts）单元测试
 *
 * 用内存 Mock 适配器验证：墓碑写入/读取/conflict 重试/窗口清理/双向过滤。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setDbAdapter, resetDbAdapter, type DbAdapter } from '@shared/adapters/db'
import {
  recordTombstone,
  getTombstones,
  pruneTombstones,
  filterByTombstones,
  mergeTombstones,
  TOMBSTONES_DOC_ID,
  TOMBSTONE_MAX_AGE_MS,
} from './sync-tombstone'
import 'fake-indexeddb/auto'

/** 内存 Mock 适配器：put 支持模拟 conflict（带最新 _rev 重读后可成功） */
const createMockDb = (): DbAdapter & { storage: Map<string, any>; failConflicts: number } => {
  const storage = new Map<string, any>()
  let revCounter = 0
  const state = { storage, failConflicts: 0 }
  const putImpl = (doc: any) => {
    const existing = storage.get(doc._id)
    if (state.failConflicts > 0) {
      // 模拟 _rev 冲突： bump 存储版本，返回 conflict
      state.failConflicts--
      if (existing) existing._rev = `${parseInt(existing._rev) + 100}-rev`
      return { ok: false, message: 'conflict' }
    }
    revCounter++
    const rev = `${(existing ? parseInt(existing._rev) : 0) + 1}-rev`
    storage.set(doc._id, { ...doc, _rev: rev })
    return { ok: true, id: doc._id, rev }
  }
  return {
    storage,
    get failConflicts() { return state.failConflicts },
    set failConflicts(v: number) { state.failConflicts = v },
    get: vi.fn((id: string) => storage.get(id) || null),
    put: vi.fn(putImpl),
    remove: vi.fn((id: string) => { storage.delete(id); return { ok: true, id } }),
    allDocs: vi.fn((prefix?: string) => {
      const docs: any[] = []
      storage.forEach((doc, id) => { if (!prefix || id.startsWith(prefix)) docs.push(doc) })
      return docs
    }),
    bulkDocs: vi.fn((docs: any[]) => docs.map(putImpl)),
    promises: {
      get: vi.fn(async (id: string) => storage.get(id) || null),
      put: vi.fn(async (doc: any) => putImpl(doc)),
      remove: vi.fn(async (id: string) => { storage.delete(id); return { ok: true, id } }),
      bulkDocs: vi.fn(async (docs: any[]) => docs.map(putImpl)),
    },
  }
}

describe('sync-tombstone', () => {
  let mockDb: ReturnType<typeof createMockDb>

  beforeEach(() => {
    mockDb = createMockDb()
    setDbAdapter(mockDb)
  })

  afterEach(() => {
    resetDbAdapter()
    vi.restoreAllMocks()
  })

  describe('recordTombstone / getTombstones', () => {
    it('无文档时创建墓碑文档并写入 deletedAt', async () => {
      await recordTombstone('word-1')
      const tombstones = getTombstones()
      expect(tombstones['word-1']).toBeTypeOf('number')
      expect(Date.now() - tombstones['word-1']).toBeLessThan(5000)
    })

    it('多次记录合并到同一份文档（跨模块共享 id 池）', async () => {
      await recordTombstone('article-1')
      await recordTombstone('sentence-1')
      await recordTombstone('article-1')

      const tombstones = getTombstones()
      expect(Object.keys(tombstones)).toHaveLength(2)
      expect(tombstones['article-1']).toBeTypeOf('number')
      expect(tombstones['sentence-1']).toBeTypeOf('number')
      // 只有一份文档
      expect(mockDb.storage.get(TOMBSTONES_DOC_ID)).toBeTruthy()
    })

    it('conflict 时重读重试一次后成功', async () => {
      mockDb.failConflicts = 1
      await recordTombstone('word-conflict')
      expect(mockDb.promises.put).toHaveBeenCalledTimes(2)
      expect(getTombstones()['word-conflict']).toBeTypeOf('number')
    })

    it('连续 conflict 两次后放弃，不抛异常', async () => {
      mockDb.failConflicts = 5
      await expect(recordTombstone('word-fail')).resolves.toBeUndefined()
      expect(mockDb.promises.put).toHaveBeenCalledTimes(2)
    })

    it('空 id 不写入', async () => {
      await recordTombstone('')
      expect(mockDb.storage.get(TOMBSTONES_DOC_ID)).toBeFalsy()
    })
  })

  describe('pruneTombstones', () => {
    it('删除早于窗口期的墓碑，保留窗口期内的', async () => {
      const now = Date.now()
      await recordTombstone('fresh')
      // 直接种一份含过期墓碑的文档
      mockDb.storage.set(TOMBSTONES_DOC_ID, {
        _id: TOMBSTONES_DOC_ID,
        type: 'sync-tombstones',
        tombstones: {
          fresh: now,
          expired: now - TOMBSTONE_MAX_AGE_MS - 1000,
        },
        updatedAt: now,
      })

      await pruneTombstones()

      const tombstones = getTombstones()
      expect(tombstones['fresh']).toBeTypeOf('number')
      expect(tombstones['expired']).toBeUndefined()
    })

    it('conflict 时重读重试一次后成功', async () => {
      await recordTombstone('before-conflict')
      mockDb.failConflicts = 1
      mockDb.promises.put.mockClear()

      await pruneTombstones()

      expect(mockDb.promises.put).toHaveBeenCalledTimes(2)
      expect(getTombstones()['before-conflict']).toBeTypeOf('number')
    })

    it('连续 conflict 两次后放弃，不抛异常', async () => {
      await recordTombstone('before-fail')
      mockDb.failConflicts = 5
      mockDb.promises.put.mockClear()

      await expect(pruneTombstones()).resolves.toBeUndefined()
      expect(mockDb.promises.put).toHaveBeenCalledTimes(2)
      // 放弃后旧墓碑仍保留（未被清空）
      expect(getTombstones()['before-fail']).toBeTypeOf('number')
    })
  })

  describe('mergeTombstones', () => {
    it('合并远端墓碑取较大 deletedAt，并回写本地', async () => {
      const now = Date.now()
      await recordTombstone('local-only')
      mockDb.storage.set(TOMBSTONES_DOC_ID, {
        _id: TOMBSTONES_DOC_ID,
        type: 'sync-tombstones',
        tombstones: { 'local-only': now, shared: now - 1000 },
        updatedAt: now,
      })

      const merged = await mergeTombstones({ shared: now - 500, 'remote-only': now - 100 })

      // 远端较新的 shared 采纳远端值；各自独有 id 并集
      expect(merged['shared']).toBe(now - 500)
      expect(merged['remote-only']).toBe(now - 100)
      expect(merged['local-only']).toBeTypeOf('number')
      // 已回写本地文档
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

  describe('filterByTombstones', () => {
    const now = Date.now()

    it('remote：墓碑 deletedAt 不早于条目更新时间时剔除已删条目', () => {
      const tombstones = { 'w-1': now, 'w-2': now - 1000 }
      const items = [
        { _id: 'w-1', updatedAt: now - 100 },   // 删除晚于更新 → 剔除
        { _id: 'w-2', updatedAt: now },          // 删除早于条目最后更新 → 保留
        { _id: 'w-3', updatedAt: now - 5000 },   // 无墓碑 → 保留
      ]
      const result = filterByTombstones(items, 'remote', tombstones)
      expect(result.map(i => i._id)).toEqual(['w-2', 'w-3'])
    })

    it('local：同样剔除已删条目（推送兜底）', () => {
      const tombstones = { 'w-1': now }
      const items = [{ _id: 'w-1' }, { _id: 'w-2' }]
      const result = filterByTombstones(items, 'local', tombstones)
      expect(result.map(i => i._id)).toEqual(['w-2'])
    })

    it('优先使用 _id，其次 id（句子库条目用 id 字段）', () => {
      const tombstones = { 's-1': now }
      const items = [
        { id: 's-1', updatedAt: now - 10 },
        { id: 's-2', updatedAt: now - 10 },
      ]
      const result = filterByTombstones(items, 'remote', tombstones)
      expect(result.map(i => i.id)).toEqual(['s-2'])
    })

    it('墓碑表为空时原样返回', () => {
      const items = [{ _id: 'w-1' }]
      expect(filterByTombstones(items, 'remote', {})).toEqual(items)
      expect(filterByTombstones(items, 'remote', {})).not.toBe(items) // 新数组
    })

    it('条目无 id 字段时保留', () => {
      const tombstones = { 'w-1': now }
      const items = [{ text: 'no-id' }]
      expect(filterByTombstones(items as any, 'remote', tombstones)).toHaveLength(1)
    })

    it('updatedAt 缺失时用 utime，再缺按 0 处理', () => {
      const tombstones = { 'w-1': now }
      const items = [
        { _id: 'w-1', utime: now },        // utime 与 deletedAt 相等 → 剔除
        { _id: 'w-1' },                     // 无时间 → deletedAt >= 0 → 剔除
      ]
      expect(filterByTombstones(items, 'remote', tombstones)).toHaveLength(0)
    })
  })
})
