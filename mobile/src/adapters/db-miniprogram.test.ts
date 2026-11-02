/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MiniProgramDbAdapter, splitStringByUtf8Bytes } from '@/adapters/index'

// 模拟 @shared/adapters/db 的类型
interface DbDoc<T = any> { _id: string; _rev?: string; data: T }
interface DbReturn { _id: string; _rev?: string; ok: boolean; error?: string }

/**
 * 创建 mock uni 存储
 */
function createMockStorage() {
  const store: Map<string, any> = new Map()
  const failSyncKey: { current: ((key: string, data: any) => boolean) | null } = { current: null }
  const failAsyncKey: { current: ((key: string, data: any) => boolean) | null } = { current: null }

  return {
    store,
    failSyncKey,
    failAsyncKey,
    uni: {
      setStorageSync: vi.fn((key: string, data: any) => {
        if (failSyncKey.current?.(key, data)) throw new Error('mock setStorageSync quota exceeded')
        store.set(key, data)
      }),
      setStorage: vi.fn(({ key, data, success, fail }: any) => {
        if (failAsyncKey.current?.(key, data)) {
          fail?.({ errMsg: 'setStorage:fail quota exceeded' })
          return
        }
        store.set(key, data)
        success?.()
      }),
      getStorageSync: vi.fn((key: string) => store.get(key) ?? null),
      getStorage: vi.fn(({ key, success, fail }: any) => {
        if (store.has(key)) {
          success({ data: store.get(key) })
        } else {
          fail({ errMsg: 'getStorage:fail data not found' })
        }
      }),
      removeStorageSync: vi.fn((key: string) => { store.delete(key) }),
      getStorageInfoSync: vi.fn(() => ({
        keys: Array.from(store.keys()),
        currentSize: 0,
        limitSize: 10240,
      })),
    },
  }
}

describe('splitStringByUtf8Bytes', () => {
  it('按 UTF-8 字节切分且不切断中文和 emoji', () => {
    const text = '中a😀bc汉字'
    const chunks = splitStringByUtf8Bytes(text, 5)
    expect(chunks.join('')).toBe(text)
    for (const chunk of chunks) {
      expect(new TextEncoder().encode(chunk).length).toBeLessThanOrEqual(5)
    }
    expect(chunks.every(chunk => !/^[\uDC00-\uDFFF]/.test(chunk))).toBe(true)
  })

  it('空字符串返回空数组', () => {
    expect(splitStringByUtf8Bytes('', 10)).toEqual([])
  })

  it('非法上限抛出错误', () => {
    expect(() => splitStringByUtf8Bytes('abc', 0)).toThrow()
  })
})

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

    it('同步覆盖时第 2 个新分片失败，旧文档仍可读且旧分片保留', () => {
      const oldContent = 'o'.repeat(1_000_000)
      adapter.put({ _id: 'atomic-sync', data: { content: oldContent } })
      const chunkKeys = () => Array.from(mockStorage.store.keys()).filter(k => k.includes('__chunk__')).sort()
      const oldChunkKeys = chunkKeys()
      expect(oldChunkKeys.length).toBeGreaterThan(1)

      let newChunkWrites = 0
      mockStorage.failSyncKey.current = (key) => {
        if (!key.includes('__chunk__')) return false
        newChunkWrites++
        return newChunkWrites === 2
      }

      const result = adapter.put({ _id: 'atomic-sync', data: { content: 'n'.repeat(1_000_000) } })

      expect(result.ok).toBe(false)
      expect(adapter.get('atomic-sync')?.data.content).toBe(oldContent)
      expect(chunkKeys()).toEqual(oldChunkKeys)
    })

    it('同步写主元数据失败时旧分片文档仍可读', () => {
      const oldContent = 'o'.repeat(1_000_000)
      adapter.put({ _id: 'atomic-meta', data: { content: oldContent } })
      const chunkKeys = () => Array.from(mockStorage.store.keys()).filter(k => k.includes('__chunk__')).sort()
      const oldChunkKeys = chunkKeys()

      mockStorage.failSyncKey.current = key => key === 'slowlyrecord_atomic-meta'

      const result = adapter.put({ _id: 'atomic-meta', data: { content: 'n'.repeat(1_000_000) } })

      expect(result.ok).toBe(false)
      expect(adapter.get('atomic-meta')?.data.content).toBe(oldContent)
      expect(chunkKeys()).toEqual(oldChunkKeys)
    })

    it('分片文档改为小文档失败时仍保留旧分片', () => {
      const oldContent = 'o'.repeat(1_000_000)
      adapter.put({ _id: 'atomic-small', data: { content: oldContent } })
      const oldChunkKeys = Array.from(mockStorage.store.keys()).filter(k => k.includes('__chunk__')).sort()

      mockStorage.failSyncKey.current = key => key === 'slowlyrecord_atomic-small'

      const result = adapter.put({ _id: 'atomic-small', data: { content: 'small' } })

      expect(result.ok).toBe(false)
      expect(adapter.get('atomic-small')?.data.content).toBe(oldContent)
      expect(Array.from(mockStorage.store.keys()).filter(k => k.includes('__chunk__')).sort()).toEqual(oldChunkKeys)
    })

    it('新分片提交成功后清理旧分片', () => {
      adapter.put({ _id: 'atomic-success', data: { content: 'o'.repeat(1_000_000) } })
      const oldChunkKeys = Array.from(mockStorage.store.keys()).filter(k => k.includes('__chunk__'))

      expect(adapter.put({ _id: 'atomic-success', data: { content: 'n'.repeat(1_000_000) } }).ok).toBe(true)

      expect(adapter.get('atomic-success')?.data.content).toBe('n'.repeat(1_000_000))
      for (const key of oldChunkKeys) expect(mockStorage.store.has(key)).toBe(false)
    })

    it('清理无主旧分片，保留引用分片和新代次分片', () => {
      adapter.put({ _id: 'orphan-owner', data: { content: 'x'.repeat(1_000_000) } })
      const referenced = Array.from(mockStorage.store.keys()).filter(k => k.includes('__chunk__'))
      expect(referenced.length).toBeGreaterThan(0)

      mockStorage.store.set('slowlyrecord_orphan__chunk__0', 'stale')
      const now = Date.now()
      const oldGeneration = `${(now - 25 * 60 * 60 * 1000).toString(36)}_1`
      mockStorage.store.set(`slowlyrecord_pending__chunk__${oldGeneration}__0`, 'stale')
      const freshGeneration = `${now.toString(36)}_2`
      const freshKey = `slowlyrecord_pending__chunk__${freshGeneration}__0`
      mockStorage.store.set(freshKey, 'inflight')

      const removed = adapter.cleanupOrphanChunks(now)

      expect(removed).toBe(2)
      for (const key of referenced) expect(mockStorage.store.has(key)).toBe(true)
      expect(mockStorage.store.has('slowlyrecord_orphan__chunk__0')).toBe(false)
      expect(mockStorage.store.has(freshKey)).toBe(true)
    })

    it('主键读取失败时中止清理，不误删可能仍被引用的旧分片', () => {
      const chunkKey = 'slowlyrecord_broken__chunk__0'
      mockStorage.store.set('slowlyrecord_broken', { _id: 'broken', _chunks: 1, _chunkKeys: [chunkKey] })
      mockStorage.store.set(chunkKey, '{"_id":"broken"}')
      mockStorage.uni.getStorageSync.mockImplementation((key: string) => {
        if (key === 'slowlyrecord_broken') throw new Error('mock read failure')
        return mockStorage.store.get(key) ?? null
      })

      expect(adapter.cleanupOrphanChunks()).toBe(0)
      expect(mockStorage.store.has(chunkKey)).toBe(true)
    })

    it('异步覆盖时新分片失败，旧文档仍可读', async () => {
      const oldContent = 'o'.repeat(1_000_000)
      adapter.put({ _id: 'atomic-async', data: { content: oldContent } })
      const chunkKeys = () => Array.from(mockStorage.store.keys()).filter(k => k.includes('__chunk__')).sort()
      const oldChunkKeys = chunkKeys()

      let newChunkWrites = 0
      mockStorage.failAsyncKey.current = (key) => {
        if (!key.includes('__chunk__')) return false
        newChunkWrites++
        return newChunkWrites === 2
      }

      const result = await adapter.promises.asyncPut({ _id: 'atomic-async', data: { content: 'n'.repeat(1_000_000) } })

      expect(result.ok).toBe(false)
      expect(adapter.get('atomic-async')?.data.content).toBe(oldContent)
      expect(chunkKeys()).toEqual(oldChunkKeys)
    })
  })

  describe('getAsync（异步分块读取）', () => {
    it('应该异步读到未分片文档', async () => {
      adapter.put({ _id: 'doc-1', data: { text: 'a' } })

      const result = await adapter.getAsync('doc-1')
      expect(result).not.toBeNull()
      expect(result?.data.text).toBe('a')
      expect(mockStorage.uni.getStorage).toHaveBeenCalled()
    })

    it('应该异步重组分片文档', async () => {
      const largeData = 'x'.repeat(1000000)
      adapter.put({ _id: 'large-1', data: { content: largeData } })

      const result = await adapter.getAsync('large-1')
      expect(result).not.toBeNull()
      expect(result?.data.content.length).toBe(1000000)
    })

    it('读取不存在的文档应返回 null', async () => {
      const result = await adapter.getAsync('non-existent')
      expect(result).toBeNull()
    })
  })
})
