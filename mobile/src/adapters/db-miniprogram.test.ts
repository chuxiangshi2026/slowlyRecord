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
      // put 是同步 API，返回 { id, rev, ok }，没有 _id 字段
      const result = adapter.put(doc)

      expect(result.ok).toBe(true)
      expect(result.id).toBe('test-1')

      const retrieved = adapter.get('test-1')
      expect(retrieved).not.toBeNull()
      expect(retrieved?.data.name).toBe('hello')
    })

    it('应该更新已有文档', async () => {
      adapter.put({ _id: 'test-1', data: { name: 'v1' } })
      const result = adapter.put({ _id: 'test-1', data: { name: 'v2' } })

      expect(result.ok).toBe(true)

      const retrieved = adapter.get('test-1')
      expect(retrieved?.data.name).toBe('v2')
    })

    it('应该返回 null 当文档不存在', async () => {
      const result = adapter.get('non-existent')
      expect(result).toBeNull()
    })
  })

  describe('remove', () => {
    it('应该删除文档', async () => {
      adapter.put({ _id: 'test-1', data: { name: 'hello' } })

      const result = adapter.remove({ _id: 'test-1', _rev: '1', data: {} })
      expect(result.ok).toBe(true)

      const retrieved = adapter.get('test-1')
      expect(retrieved).toBeNull()
    })

    it('删除不存在的文档应返回成功', async () => {
      const result = adapter.remove({ _id: 'non-existent', _rev: '1', data: {} })
      expect(result.ok).toBe(true) // uni.removeStorageSync 不会报错
    })
  })

  describe('allDocs', () => {
    it('应该返回所有文档', async () => {
      adapter.put({ _id: 'word-1', data: { text: 'a' } })
      adapter.put({ _id: 'word-2', data: { text: 'b' } })

      // allDocs 直接返回数组（DbDoc[]），不是 { items: ... }
      const result = adapter.allDocs()
      expect(result.length).toBe(2)
    })

    it('应该按前缀过滤', async () => {
      adapter.put({ _id: 'word-1', data: { text: 'a' } })
      adapter.put({ _id: 'dict-1', data: { text: 'b' } })

      const result = adapter.allDocs('word')
      expect(result).toHaveLength(1)
      expect(result[0]._id).toBe('word-1')
    })

    it('应该跳过分片 key', async () => {
      adapter.put({ _id: 'doc-1', data: { text: 'a' } })

      // 手动添加分片 key
      mockStorage.store.set('slowlyrecord_doc-1__chunk__0', '{}')

      const result = adapter.allDocs()
      const ids = result.map(d => d._id)
      expect(ids).not.toContain('slowlyrecord_doc-1__chunk__0')
    })
  })

  describe('put（已有 id 写入）', () => {
    // 注：当前 MiniProgramDbAdapter 不实现 post（自动生成 id），
    // 只通过 put 接收外部生成的 _id。如未来需要 post 能力，应在生产代码中补充。
    it('应该使用提供的 id', async () => {
      const result = adapter.put({ _id: 'custom-id', data: { name: 'hello' } })

      expect(result.ok).toBe(true)
      expect(result.id).toBe('custom-id')

      const retrieved = adapter.get('custom-id')
      expect(retrieved).not.toBeNull()
      expect(retrieved?.data.name).toBe('hello')
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
