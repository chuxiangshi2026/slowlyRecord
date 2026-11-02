/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { DbAdapterIndexedDB } from '../db-indexeddb'
import type { DbDoc } from '../../db'
import { resetDbAdapter, setDbAdapter } from '../../db'
import { updateSetDbWithRetry } from '../../../utils/user-set-db-util'
import { persistChildDbPut } from '../../window'
import 'fake-indexeddb/auto'

describe('DbAdapterIndexedDB', () => {
  let adapter: DbAdapterIndexedDB

  beforeEach(async () => {
    adapter = new DbAdapterIndexedDB()
  })

  afterEach(async () => {
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
})
