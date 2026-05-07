/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { DbAdapterUtools } from '../db-utools'
import type { DbDoc, DbReturn } from '../../db'

// mock utools 对象
function mockUtoolsDb() {
  const store: Map<string, DbDoc> = new Map()
  let revCounter = 0

  const db = {
    get: vi.fn((id: string) => store.get(id) || null),
    allDocs: vi.fn((prefix?: string) => {
      const docs = Array.from(store.values())
      if (prefix) {
        return docs.filter(d => d._id.startsWith(prefix))
      }
      return docs
    }),
    remove: vi.fn((doc: string | DbDoc) => {
      const id = typeof doc === 'string' ? doc : doc._id
      const existing = store.get(id)
      if (!existing) {
        return { id, ok: false, error: true, message: 'doc not found' }
      }
      store.delete(id)
      return { id, ok: true, rev: `rev-${++revCounter}` }
    }),
    bulkDocs: vi.fn((docs: DbDoc[]) => {
      return docs.map(doc => {
        store.set(doc._id, { ...doc, _rev: `rev-${++revCounter}` })
        return { id: doc._id, ok: true, rev: `rev-${revCounter}` }
      })
    }),
    promises: {
      put: vi.fn(async (doc: DbDoc) => {
        const existing = store.get(doc._id)
        const rev = `rev-${++revCounter}`
        store.set(doc._id, { ...doc, _rev: rev })
        return { id: doc._id, ok: true, rev }
      }),
      remove: vi.fn(async (doc: string | DbDoc) => {
        const id = typeof doc === 'string' ? doc : doc._id
        const existing = store.get(id)
        if (!existing) {
          return { id, ok: false, error: true, message: 'doc not found' }
        }
        store.delete(id)
        return { id, ok: true, rev: `rev-${++revCounter}` }
      }),
      bulkDocs: vi.fn(async (docs: DbDoc[]) => {
        return docs.map(doc => {
          const rev = `rev-${++revCounter}`
          store.set(doc._id, { ...doc, _rev: rev })
          return { id: doc._id, ok: true, rev }
        })
      }),
    },
  }

  return { db, store }
}

describe('DbAdapterUtools', () => {
  let adapter: DbAdapterUtools
  let mockDb: ReturnType<typeof mockUtoolsDb>

  beforeEach(() => {
    mockDb = mockUtoolsDb()
    ;(window as any).utools = { db: mockDb.db, getPath: vi.fn() }
    adapter = new DbAdapterUtools()
  })

  describe('get', () => {
    it('should return document by id', async () => {
      const doc: DbDoc = { _id: 'test-1', name: 'hello' }
      await adapter.promises.put(doc)
      
      const result = adapter.get('test-1')
      expect(result).not.toBeNull()
      expect(result?._id).toBe('test-1')
    })

    it('should return null for non-existent id', () => {
      const result = adapter.get('non-existent')
      expect(result).toBeNull()
    })
  })

  describe('allDocs', () => {
    it('should return all documents', async () => {
      await adapter.promises.put({ _id: 'word-1', text: 'hello' })
      await adapter.promises.put({ _id: 'word-2', text: 'world' })
      
      const docs = adapter.allDocs()
      expect(docs.length).toBeGreaterThanOrEqual(2)
    })

    it('should filter by prefix', async () => {
      await adapter.promises.put({ _id: 'word-1', text: 'hello' })
      await adapter.promises.put({ _id: 'dict-1', text: 'world' })
      
      const docs = adapter.allDocs('word')
      expect(docs.every(d => d._id.startsWith('word'))).toBe(true)
    })
  })

  describe('remove', () => {
    it('should remove document by id', async () => {
      await adapter.promises.put({ _id: 'test-1', name: 'hello' })
      
      const result = adapter.remove('test-1')
      expect(result.ok).toBe(true)
    })

    it('should return error for non-existent doc', () => {
      const result = adapter.remove('non-existent')
      expect(result.ok).toBe(false)
      expect(result.error).toBe(true)
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

  describe('promises.put', () => {
    it('should create a document and return ok', async () => {
      const doc: DbDoc = { _id: 'test-put', name: 'test' }
      const result = await adapter.promises.put(doc)
      
      expect(result.ok).toBe(true)
      expect(result.id).toBe('test-put')
      expect(result.rev).toBeDefined()
    })

    it('should update an existing document', async () => {
      await adapter.promises.put({ _id: 'test-update', name: 'v1' })
      const result = await adapter.promises.put({ _id: 'test-update', name: 'v2' })
      
      expect(result.ok).toBe(true)
    })
  })

  describe('promises.remove', () => {
    it('should remove document by id', async () => {
      await adapter.promises.put({ _id: 'test-rm', name: 'test' })
      const result = await adapter.promises.remove('test-rm')
      
      expect(result.ok).toBe(true)
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
})
