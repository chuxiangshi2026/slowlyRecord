/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { BroadcastChannel as NodeBroadcastChannel } from 'node:worker_threads'
import { DbAdapterIndexedDB } from '../db-indexeddb'
import type { DbDoc } from '../../db'
import { resetDbAdapter, setDbAdapter } from '../../db'
import { updateSetDbWithRetry } from '../../../utils/user-set-db-util'
import { persistChildDbPut } from '../../window'
import 'fake-indexeddb/auto'

// jsdom 未实现 BroadcastChannel，用 Node 的同线程实现补齐（跨标签失效测试依赖它）
if (typeof globalThis.BroadcastChannel === 'undefined') {
  ;(globalThis as Record<string, unknown>).BroadcastChannel = NodeBroadcastChannel
}

describe('DbAdapterIndexedDB', () => {
  let adapter: DbAdapterIndexedDB

  beforeEach(async () => {
    adapter = new DbAdapterIndexedDB()
  })

  afterEach(async () => {
    adapter.closeChannel()
    resetDbAdapter()
  })

  describe('promises.put', () => {
    it('should create a document and return ok', async () => {
      const doc: DbDoc = { _id: 'test-1', name: 'hello' }
      const result = await adapter.promises.put(doc)
      
      expect(result.ok).toBe(true)
      expect(result.id).toBe('test-1')
      expect(result.rev).toBeDefined()
    })

    it('should update an existing document', async () => {
      await adapter.promises.put({ _id: 'test-1', name: 'v1' })
      const result = await adapter.promises.put({ _id: 'test-1', name: 'v2' })
      
      expect(result.ok).toBe(true)
    })
  })

  describe('get (sync cache)', () => {
    it('should return null before any put', () => {
      const result = adapter.get('test-1')
      expect(result).toBeNull()
    })

    it('should return document after put (sync cache updated)', async () => {
      await adapter.promises.put({ _id: 'test-1', name: 'hello' })
      
      const result = adapter.get('test-1')
      expect(result).not.toBeNull()
      expect(result?.name).toBe('hello')
    })
  })

  describe('allDocs', () => {
    it('should return all cached documents', async () => {
      await adapter.promises.put({ _id: 'word-1', text: 'a' })
      await adapter.promises.put({ _id: 'word-2', text: 'b' })
      
      const docs = adapter.allDocs()
      expect(docs.length).toBe(2)
    })

    it('should filter by prefix', async () => {
      await adapter.promises.put({ _id: 'word-1', text: 'a' })
      await adapter.promises.put({ _id: 'dict-1', text: 'b' })
      
      const docs = adapter.allDocs('word')
      expect(docs).toHaveLength(1)
      expect(docs[0]._id).toBe('word-1')
    })
  })

  describe('remove', () => {
    it('should remove document synchronously from cache', async () => {
      await adapter.promises.put({ _id: 'test-1', name: 'hello' })
      
      const result = adapter.remove('test-1')
      expect(result.ok).toBe(true)
      
      // Should be gone from cache
      expect(adapter.get('test-1')).toBeNull()
    })

    it('should return error for non-existent doc', () => {
      const result = adapter.remove('non-existent')
      expect(result.ok).toBe(false)
      expect(result.error).toBe(true)
    })
  })

  describe('promises.remove', () => {
    it('should remove document from IndexedDB', async () => {
      await adapter.promises.put({ _id: 'test-1', name: 'hello' })
      const result = await adapter.promises.remove('test-1')
      
      expect(result.ok).toBe(true)
      expect(adapter.get('test-1')).toBeNull()
    })
  })

  describe('bulkDocs', () => {
    it('should create multiple documents synchronously', async () => {
      const docs: DbDoc[] = [
        { _id: 'bulk-1', text: 'a' },
        { _id: 'bulk-2', text: 'b' },
      ]
      
      const results = adapter.bulkDocs(docs)
      expect(results).toHaveLength(2)
      results.forEach(r => expect(r.ok).toBe(true))
      
      // Should be in sync cache
      expect(adapter.get('bulk-1')).not.toBeNull()
      expect(adapter.get('bulk-2')).not.toBeNull()
    })
  })

  describe('promises.bulkDocs', () => {
    it('should create multiple documents', async () => {
      const docs: DbDoc[] = [
        { _id: 'pbulk-1', text: 'a' },
        { _id: 'pbulk-2', text: 'b' },
      ]
      
      const results = await adapter.promises.bulkDocs(docs)
      expect(results).toHaveLength(2)
      results.forEach(r => expect(r.ok).toBe(true))
    })
  })

  describe('preloadToCache', () => {
    it('should load existing data into sync cache', async () => {
      // 先写入一些数据
      await adapter.promises.put({ _id: 'pre-1', text: 'a' })
      await adapter.promises.put({ _id: 'pre-2', text: 'b' })
      await adapter.promises.put({ _id: 'other-1', text: 'c' })
      
      // 创建新适配器实例（空缓存）
      const newAdapter = new DbAdapterIndexedDB()
      expect(newAdapter.get('pre-1')).toBeNull()
      
      // 预加载（带前缀）
      await newAdapter.preloadToCache('pre')
      
      expect(newAdapter.get('pre-1')).not.toBeNull()
      expect(newAdapter.get('pre-2')).not.toBeNull()
      expect(newAdapter.get('other-1')).toBeNull() // 不匹配前缀
    })

    it('should load all data without prefix', async () => {
      await adapter.promises.put({ _id: 'all-1', text: 'a' })
      await adapter.promises.put({ _id: 'all-2', text: 'b' })
      
      const newAdapter = new DbAdapterIndexedDB()
      await newAdapter.preloadToCache()
      
      expect(newAdapter.get('all-1')).not.toBeNull()
      expect(newAdapter.get('all-2')).not.toBeNull()
    })
  })

  describe('同步与异步写入顺序', () => {
    it('异步 put 后的同步 remove 不会被旧事务复活', async () => {
      await adapter.promises.put({ _id: 'mixed-put-remove', value: 'old' })
      const pending = adapter.promises.put({ _id: 'mixed-put-remove', value: 'new' })
      adapter.remove('mixed-put-remove')
      await pending
      await adapter.whenIdle()

      expect(adapter.get('mixed-put-remove')).toBeNull()
      const reloaded = new DbAdapterIndexedDB()
      await reloaded.preloadToCache()
      expect(reloaded.get('mixed-put-remove')).toBeNull()
    })

    it('异步 remove 后的同步 put 保留最终新值', async () => {
      await adapter.promises.put({ _id: 'mixed-remove-put', value: 'old' })
      const pending = adapter.promises.remove('mixed-remove-put')
      adapter.put({ _id: 'mixed-remove-put', value: 'new' })
      await pending
      await adapter.whenIdle()

      expect(adapter.get('mixed-remove-put')?.value).toBe('new')
      expect((await adapter.promises.get('mixed-remove-put'))?.value).toBe('new')
    })

    it('异步批量写不会覆盖后续同步删除和更新', async () => {
      await adapter.promises.put({ _id: 'mixed-bulk-remove', value: 'initial' })
      await adapter.promises.put({ _id: 'mixed-bulk-put', value: 'initial' })
      const pending = adapter.promises.bulkDocs([
        { _id: 'mixed-bulk-remove', value: 'old' },
        { _id: 'mixed-bulk-put', value: 'old' },
      ])
      adapter.remove('mixed-bulk-remove')
      adapter.put({ _id: 'mixed-bulk-put', value: 'new' })
      await pending
      await adapter.whenIdle()

      expect(adapter.get('mixed-bulk-remove')).toBeNull()
      expect(adapter.get('mixed-bulk-put')?.value).toBe('new')
    })

    it('真实 IndexedDB 下并发设置修改不会互相覆盖', async () => {
      setDbAdapter(adapter)
      await adapter.promises.put({
        _id: 'user-set',
        focusMode: { opacity: 1, fontSize: 20 },
      })

      const results = await Promise.all([
        updateSetDbWithRetry(doc => { doc.focusMode.opacity = 0.5 }),
        updateSetDbWithRetry(doc => { doc.focusMode.fontSize = 30 }),
      ])

      expect(results).toEqual([true, true])
      expect(adapter.get('user-set')?.focusMode).toMatchObject({ opacity: 0.5, fontSize: 30 })
    })

    it('子窗口 pendingAction 不覆盖父窗口并发设置', async () => {
      setDbAdapter(adapter)
      await adapter.promises.put({
        _id: 'user-set',
        focusMode: { opacity: 1, fontSize: 20 },
      })
      const parentUpdate = updateSetDbWithRetry(doc => { doc.focusMode.opacity = 0.5 })
      await Promise.resolve()
      const childUpdate = persistChildDbPut({
        _id: 'user-set',
        focusMode: {
          opacity: 1,
          fontSize: 20,
          pendingAction: { type: 'setLocked', payload: { locked: true }, at: 123 },
        },
      }, 'test')
      await Promise.all([parentUpdate, childUpdate])

      expect(adapter.get('user-set')?.focusMode).toMatchObject({
        opacity: 0.5,
        fontSize: 20,
        pendingAction: { type: 'setLocked', payload: { locked: true }, at: 123 },
      })
    })
  })

  describe('写入失败不产生假成功', () => {
    it('promises.put 失败时保留旧缓存和磁盘值', async () => {
      await adapter.promises.put({ _id: 'fail-put', value: 'old' })
      const putSpy = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementationOnce(() => {
        throw new DOMException('quota exceeded', 'QuotaExceededError')
      })

      await expect(adapter.promises.put({ _id: 'fail-put', value: 'new' })).rejects.toThrow('quota exceeded')
      putSpy.mockRestore()

      expect(adapter.get('fail-put')?.value).toBe('old')
      expect((await adapter.promises.get('fail-put'))?.value).toBe('old')
    })

    it('promises.remove 失败时不提前删除缓存', async () => {
      await adapter.promises.put({ _id: 'fail-remove', value: 'old' })
      const deleteSpy = vi.spyOn(IDBObjectStore.prototype, 'delete').mockImplementationOnce(() => {
        throw new DOMException('transaction failed', 'InvalidStateError')
      })

      await expect(adapter.promises.remove('fail-remove')).rejects.toThrow('transaction failed')
      deleteSpy.mockRestore()

      expect(adapter.get('fail-remove')?.value).toBe('old')
      expect((await adapter.promises.get('fail-remove'))?.value).toBe('old')
    })

    it('同步 put 持久化失败后回滚乐观缓存', async () => {
      await adapter.promises.put({ _id: 'sync-fail', value: 'old' })
      const putSpy = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementationOnce(() => {
        throw new DOMException('quota exceeded', 'QuotaExceededError')
      })

      adapter.put({ _id: 'sync-fail', value: 'new' })
      expect(adapter.get('sync-fail')?.value).toBe('new')
      await adapter.whenIdle()
      putSpy.mockRestore()

      expect(adapter.get('sync-fail')?.value).toBe('old')
    })

    it('promises.bulkDocs 任一项失败时不提交缓存', async () => {
      const originalPut = IDBObjectStore.prototype.put
      let calls = 0
      const putSpy = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (
        this: IDBObjectStore,
        ...args: Parameters<typeof IDBObjectStore.prototype.put>
      ) {
        calls++
        if (calls === 2) throw new DOMException('quota exceeded', 'QuotaExceededError')
        return originalPut.apply(this, args)
      })

      await expect(adapter.promises.bulkDocs([
        { _id: 'bulk-fail-1', value: 'a' },
        { _id: 'bulk-fail-2', value: 'b' },
      ])).rejects.toThrow('quota exceeded')
      putSpy.mockRestore()

      expect(adapter.get('bulk-fail-1')).toBeNull()
      expect(adapter.get('bulk-fail-2')).toBeNull()
    })
  })

  describe('_rev 冲突语义（对齐 utools.db）', () => {
    it('同步 put 携带过期 _rev 返回 conflict 且不覆盖缓存', async () => {
      await adapter.promises.put({ _id: 'conflict-1', value: 'v1' })

      const result = adapter.put({ _id: 'conflict-1', value: 'v0', _rev: '0-stale' })

      expect(result.ok).toBe(false)
      expect(result.error).toBe(true)
      expect(result.message).toContain('conflict')
      expect(adapter.get('conflict-1')?.value).toBe('v1')
    })

    it('异步 put 携带过期 _rev 返回 conflict 且不写库', async () => {
      await adapter.promises.put({ _id: 'conflict-2', value: 'v1' })

      const result = await adapter.promises.put({ _id: 'conflict-2', value: 'v0', _rev: '0-stale' })

      expect(result.ok).toBe(false)
      expect(result.message).toContain('conflict')
      const reloaded = new DbAdapterIndexedDB()
      await reloaded.preloadToCache()
      expect(reloaded.get('conflict-2')?.value).toBe('v1')
      reloaded.closeChannel()
    })

    it('conflict 后重读最新文档合并再写可成功（调用方兜底路径）', async () => {
      await adapter.promises.put({ _id: 'user-set', focusMode: { fontSize: 20 } })
      // 模拟并发窗口：stale 为旧快照
      const stale = adapter.get('user-set')
      await adapter.promises.put({ _id: 'user-set', focusMode: { fontSize: 21 } })

      // 拿旧快照去写 → conflict
      const conflict = await adapter.promises.put({ ...stale, focusMode: { fontSize: 22 } })
      expect(conflict.ok).toBe(false)
      expect(conflict.message).toContain('conflict')

      // 重读合并重试 → 成功
      const latest = await adapter.promises.get('user-set')
      const retried = await adapter.promises.put({ ...latest, focusMode: { fontSize: 22 } })
      expect(retried.ok).toBe(true)
      expect(adapter.get('user-set')?.focusMode?.fontSize).toBe(22)
    })

    it('bulkDocs 中携带过期 _rev 的文档返回 conflict，其余正常写入', async () => {
      await adapter.promises.put({ _id: 'bulk-conflict-1', value: 'v1' })

      const results = adapter.bulkDocs([
        { _id: 'bulk-conflict-1', value: 'v0', _rev: '0-stale' },
        { _id: 'bulk-conflict-2', value: 'new' },
      ])

      expect(results[0].ok).toBe(false)
      expect(results[0].message).toContain('conflict')
      expect(results[1].ok).toBe(true)
      expect(adapter.get('bulk-conflict-1')?.value).toBe('v1')
      expect(adapter.get('bulk-conflict-2')?.value).toBe('new')
    })

    it('不携带 _rev 的 put 保持原有覆盖语义（兼容既有调用）', async () => {
      await adapter.promises.put({ _id: 'no-rev', value: 'v1' })

      const result = adapter.put({ _id: 'no-rev', value: 'v2' })

      expect(result.ok).toBe(true)
      expect(adapter.get('no-rev')?.value).toBe('v2')
    })
  })

  describe('跨实例缓存失效（写入广播）', () => {
    it('实例 A 写入后实例 B 的缓存同步刷新，且过期 _rev 写入被判 conflict', async () => {
      const b = new DbAdapterIndexedDB()
      try {
        // B 预加载到 v1
        await adapter.promises.put({ _id: 'sync-doc', value: 'v1' })
        await b.preloadToCache()
        expect(b.get('sync-doc')?.value).toBe('v1')

        // A 更新到 v2 → B 收到失效通知并回读刷新
        await adapter.promises.put({ _id: 'sync-doc', value: 'v2' })
        await new Promise(r => setTimeout(r, 50))
        expect(b.get('sync-doc')?.value).toBe('v2')

        // B 再写到 v3，此后任何过期 _rev 的写入 → conflict 而非静默覆盖
        await b.promises.put({ _id: 'sync-doc', value: 'v3' })
        const conflict = b.put({ _id: 'sync-doc', value: 'v0', _rev: '0-way-old' })
        expect(conflict.ok).toBe(false)
        expect(conflict.message).toContain('conflict')
        expect(b.get('sync-doc')?.value).toBe('v3')
      } finally {
        b.closeChannel()
      }
    })

    it('未缓存的文档不受其它实例广播影响（前缀预载隔离性）', async () => {
      const b = new DbAdapterIndexedDB()
      try {
        await adapter.promises.put({ _id: 'iso-1', value: 'a' })
        // B 只缓存 zzz 前缀（实际为空）
        await b.preloadToCache('zzz')
        await new Promise(r => setTimeout(r, 50))
        expect(b.get('iso-1')).toBeNull()
      } finally {
        b.closeChannel()
      }
    })
  })
})
