/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { DbAdapterMiniprogram } from '../db-miniprogram'
import type { DbDoc } from '../../db'

/**
 * 创建 mock wx 存储
 */
function createMockStorage() {
  const store: Map<string, any> = new Map()

  return {
    store,
    wx: {
      setStorageSync: vi.fn((key: string, data: any) => { store.set(key, data) }),
      getStorageSync: vi.fn((key: string) => store.get(key) ?? null),
      removeStorageSync: vi.fn((key: string) => { store.delete(key) }),
      getStorageInfoSync: vi.fn(() => ({
        keys: Array.from(store.keys()),
        currentSize: 0,
        limitSize: 10240,
      })),
    },
  }
}

describe('DbAdapterMiniprogram', () => {
  let adapter: DbAdapterMiniprogram
  let mockStorage: ReturnType<typeof createMockStorage>

  beforeEach(() => {
    mockStorage = createMockStorage()
    ;(window as any).wx = mockStorage.wx
    adapter = new DbAdapterMiniprogram()
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

  describe('get', () => {
    it('should return null for non-existent id', () => {
      const result = adapter.get('non-existent')
      expect(result).toBeNull()
    })

    it('should return document after put', async () => {
      await adapter.promises.put({ _id: 'test-1', name: 'hello' })
      
      const result = adapter.get('test-1')
      expect(result).not.toBeNull()
      expect(result?.name).toBe('hello')
    })
  })

  describe('allDocs', () => {
    it('should return all documents', async () => {
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

    it('should skip chunk and meta keys', async () => {
      await adapter.promises.put({ _id: 'doc-1', text: 'a' })
      
      // 手动添加一些分片 key
      mockStorage.store.set('doc-1::__chunk__0', '{}')
      mockStorage.store.set('doc-1::__meta', { chunked: true })
      
      const docs = adapter.allDocs()
      // 只应该返回 doc-1，不包含 __chunk__ 和 __meta
      const ids = docs.map(d => d._id)
      expect(ids).not.toContain('doc-1::__chunk__0')
      expect(ids).not.toContain('doc-1::__meta')
    })
  })

  describe('remove', () => {
    it('should remove document by id', async () => {
      await adapter.promises.put({ _id: 'test-1', name: 'hello' })
      
      const result = adapter.remove('test-1')
      expect(result.ok).toBe(true)
      expect(adapter.get('test-1')).toBeNull()
    })

    it('should return error for non-existent doc', () => {
      const result = adapter.remove('non-existent')
      expect(result.ok).toBe(false)
      expect(result.error).toBe(true)
    })
  })

  describe('promises.remove', () => {
    it('should remove document', async () => {
      await adapter.promises.put({ _id: 'test-1', name: 'hello' })
      const result = await adapter.promises.remove('test-1')
      
      expect(result.ok).toBe(true)
    })
  })

  describe('bulkDocs', () => {
    it('should create multiple documents', () => {
      const docs: DbDoc[] = [
        { _id: 'bulk-1', text: 'a' },
        { _id: 'bulk-2', text: 'b' },
      ]
      
      const results = adapter.bulkDocs(docs)
      expect(results).toHaveLength(2)
      results.forEach(r => expect(r.ok).toBe(true))
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

  describe('chunking', () => {
    it('should handle large documents by auto-chunking', async () => {
      // 创建一个大文档（模拟超过 900KB）
      const largeData = 'x'.repeat(500000) // ~1MB after serialization
      const doc: DbDoc = { _id: 'large-1', data: largeData }
      
      await adapter.promises.put(doc)
      
      // 验证文档可以正常读取回来
      const result = adapter.get('large-1')
      expect(result).not.toBeNull()
      expect(result?._id).toBe('large-1')
      expect(result?.data.length).toBe(500000)
      
      // 验证分片 meta 存在
      const meta = mockStorage.store.get('large-1::__meta')
      expect(meta).toBeDefined()
      expect(meta.chunked).toBe(true)
    })

    it('should remove chunked documents properly', async () => {
      const largeData = 'x'.repeat(500000)
      await adapter.promises.put({ _id: 'large-1', data: largeData })
      
      const result = adapter.remove('large-1')
      expect(result.ok).toBe(true)
      
      // 验证所有分片和 meta 都被清理
      expect(adapter.get('large-1')).toBeNull()
      expect(mockStorage.store.has('large-1::__meta')).toBe(false)
    })
  })
})
