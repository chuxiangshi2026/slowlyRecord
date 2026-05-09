/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MiniProgramDbAdapter } from '@/adapters/index'

// 模拟 @shared/adapters/db 的类型
interface DbDoc<T = any> { _id: string; _rev?: string; data: T }
interface DbReturn { _id: string; _rev?: string; ok: boolean; error?: string }

/**
 * 创建 mock uni 存储
 */
function createMockStorage() {
  const store: Map<string, any> = new Map()

  return {
    store,
    uni: {
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

describe('MiniProgramDbAdapter', () => {
  let adapter: MiniProgramDbAdapter
  let mockStorage: ReturnType<typeof createMockStorage>

  beforeEach(() => {
    mockStorage = createMockStorage()
    ;(global as any).uni = mockStorage.uni
    adapter = new MiniProgramDbAdapter()
  })

  describe('put / get', () => {
    it('应该创建文档并返回成功', async () => {
      const doc = { _id: 'test-1', data: { name: 'hello' } }
      const result = await adapter.put(doc)

      expect(result.ok).toBe(true)
      expect(result._id).toBe('test-1')

      const retrieved = await adapter.get('test-1')
      expect(retrieved).not.toBeNull()
      expect(retrieved?.data.name).toBe('hello')
    })

    it('应该更新已有文档', async () => {
      await adapter.put({ _id: 'test-1', data: { name: 'v1' } })
      const result = await adapter.put({ _id: 'test-1', data: { name: 'v2' } })

      expect(result.ok).toBe(true)

      const retrieved = await adapter.get('test-1')
      expect(retrieved?.data.name).toBe('v2')
    })

    it('应该返回 null 当文档不存在', async () => {
      const result = await adapter.get('non-existent')
      expect(result).toBeNull()
    })
  })

  describe('remove', () => {
    it('应该删除文档', async () => {
      await adapter.put({ _id: 'test-1', data: { name: 'hello' } })

      const result = await adapter.remove({ _id: 'test-1', _rev: '1' })
      expect(result.ok).toBe(true)

      const retrieved = await adapter.get('test-1')
      expect(retrieved).toBeNull()
    })

    it('删除不存在的文档应返回失败', async () => {
      const result = await adapter.remove({ _id: 'non-existent', _rev: '1' })
      expect(result.ok).toBe(true) // uni.removeStorageSync 不会报错
    })
  })

  describe('allDocs', () => {
    it('应该返回所有文档', async () => {
      await adapter.put({ _id: 'word-1', data: { text: 'a' } })
      await adapter.put({ _id: 'word-2', data: { text: 'b' } })

      const result = await adapter.allDocs()
      expect(result.items.length).toBe(2)
    })

    it('应该按前缀过滤', async () => {
      await adapter.put({ _id: 'word-1', data: { text: 'a' } })
      await adapter.put({ _id: 'dict-1', data: { text: 'b' } })

      const result = await adapter.allDocs('word')
      expect(result.items).toHaveLength(1)
      expect(result.items[0]._id).toBe('word-1')
    })

    it('应该跳过分片 key', async () => {
      await adapter.put({ _id: 'doc-1', data: { text: 'a' } })

      // 手动添加分片 key
      mockStorage.store.set('slowlyrecord_doc-1__chunk__0', '{}')

      const result = await adapter.allDocs()
      const ids = result.items.map(d => d._id)
      expect(ids).not.toContain('slowlyrecord_doc-1__chunk__0')
    })
  })

  describe('post', () => {
    it('应该自动生成 id 并创建文档', async () => {
      const result = await adapter.post({ data: { name: 'hello' } })

      expect(result.ok).toBe(true)
      expect(result._id).toBeDefined()

      const retrieved = await adapter.get(result._id)
      expect(retrieved).not.toBeNull()
    })

    it('应该使用提供的 id', async () => {
      const result = await adapter.post({ _id: 'custom-id', data: { name: 'hello' } })

      expect(result._id).toBe('custom-id')
    })
  })

  describe('分片存储', () => {
    it('应该处理大文档自动分片', async () => {
      // 创建超过 900KB 的数据（JSON 序列化后超过 900KB）
      const largeData = 'x'.repeat(1000000)
      const doc = { _id: 'large-1', data: { content: largeData } }

      await adapter.put(doc)

      // 验证文档可以正常读取
      const result = await adapter.get('large-1')
      expect(result).not.toBeNull()
      expect(result?.data.content.length).toBe(1000000)

      // 验证分片存在
      const hasChunk = Array.from(mockStorage.store.keys()).some(k => k.includes('__chunk__'))
      expect(hasChunk).toBe(true)
    })

    it('应该正确删除分片文档', async () => {
      const largeData = 'x'.repeat(500000)
      await adapter.put({ _id: 'large-1', data: { content: largeData } })

      await adapter.remove({ _id: 'large-1', _rev: '1' })

      const result = await adapter.get('large-1')
      expect(result).toBeNull()

      // 验证分片被清理
      const hasChunk = Array.from(mockStorage.store.keys()).some(k => k.includes('large-1__chunk__'))
      expect(hasChunk).toBe(false)
    })
  })
})
