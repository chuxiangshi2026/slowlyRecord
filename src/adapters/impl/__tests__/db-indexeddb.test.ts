/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { DbAdapterIndexedDB } from '../db-indexeddb'
import type { DbDoc } from '../../db'
import 'fake-indexeddb/auto'

describe('DbAdapterIndexedDB', () => {
  let adapter: DbAdapterIndexedDB

  beforeEach(async () => {
    adapter = new DbAdapterIndexedDB()
  })

  afterEach(async () => {
    // 清理：关闭数据库连接
    // adapter 内部没有公开 close 方法，GC 会处理
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
})
