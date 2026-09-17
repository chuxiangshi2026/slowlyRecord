/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { DbAdapterMiniprogram } from '../db-miniprogram'
import type { DbDoc } from '../../db'

/**
 * 创建 mock 小程序存储（用于 wx 或 tt API）
 */
function createMockStorage(apiType: 'wx' | 'tt' = 'wx') {
  const store: Map<string, any> = new Map()

  return {
    store,
    [apiType]: {
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

    it('文档由大变小时应清理旧分片，get 返回新数据（P0 回归：分片残留导致读到过期数据）', async () => {
      // 先写大文档（产生分片 + meta）
      await adapter.promises.put({ _id: 'bank-1', data: 'x'.repeat(500000) })
      expect(mockStorage.store.get('bank-1::__meta')).toBeDefined()

      // 再写同一 id 的小文档
      await adapter.promises.put({ _id: 'bank-1', data: 'small' })

      // get 必须返回新数据（旧实现会重组旧分片返回过期大文档）
      const result = adapter.get('bank-1')
      expect(result).not.toBeNull()
      expect(result?.data).toBe('small')
      // 旧分片与 meta 已清理
      expect(mockStorage.store.has('bank-1::__meta')).toBe(false)
      expect(mockStorage.store.has('bank-1::__chunk__0')).toBe(false)
    })
  })
})

describe('DbAdapterMiniprogram (抖音 tt API)', () => {
  let adapter: DbAdapterMiniprogram
  let mockStorage: ReturnType<typeof createMockStorage>

  beforeEach(() => {
    delete (window as any).wx
    mockStorage = createMockStorage('tt')
    ;(window as any).tt = mockStorage.tt
    adapter = new DbAdapterMiniprogram()
  })

  afterEach(() => {
    delete (window as any).tt
  })

  it('使用 tt API 创建和读取文档', async () => {
    await adapter.promises.put({ _id: 'tt-doc', name: 'douyin' })

    const result = adapter.get('tt-doc')
    expect(result).not.toBeNull()
    expect(result?.name).toBe('douyin')
  })

  it('使用 tt API 删除文档', async () => {
    await adapter.promises.put({ _id: 'tt-remove', name: 'temp' })
    const result = adapter.remove('tt-remove')
    expect(result.ok).toBe(true)
    expect(adapter.get('tt-remove')).toBeNull()
  })

  it('使用 tt API 批量写入', () => {
    const docs: DbDoc[] = [
      { _id: 'tt-b1', text: 'a' },
      { _id: 'tt-b2', text: 'b' },
    ]
    const results = adapter.bulkDocs(docs)
    expect(results).toHaveLength(2)
    results.forEach(r => expect(r.ok).toBe(true))
  })

  it('使用 tt API allDocs 过滤前缀', async () => {
    await adapter.promises.put({ _id: 'tt-word-1', text: 'a' })
    await adapter.promises.put({ _id: 'tt-dict-1', text: 'b' })

    const docs = adapter.allDocs('tt-word')
    expect(docs).toHaveLength(1)
    expect(docs[0]._id).toBe('tt-word-1')
  })

  it('使用 tt API 处理大文档分片', async () => {
    const largeData = 'x'.repeat(500000)
    await adapter.promises.put({ _id: 'tt-large', data: largeData })

    const result = adapter.get('tt-large')
    expect(result).not.toBeNull()
    expect(result?.data.length).toBe(500000)

    const meta = mockStorage.store.get('tt-large::__meta')
    expect(meta).toBeDefined()
    expect(meta.chunked).toBe(true)
  })
})
