// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setDbAdapter, resetDbAdapter, type DbAdapter } from '@shared/adapters/db'

vi.mock('@shared/utils/logger', () => ({
  log: { i: vi.fn(), d: vi.fn(), e: vi.fn(), w: vi.fn() },
}))

import { cleanupLegacyPerWordDocs } from './db-util-cleanup'

const META_ID = 'slowly-record-wordbank-meta-v2'
const FLAG_ID = 'slowly-record-legacy-cleanup-done'

/**
 * 模拟 uTools 行为的 mock DB：
 * allDocs 单次最多返回 PAGE_SIZE 条（uTools 真实限制 1000，测试用 100 缩小规模）
 */
const PAGE_SIZE = 100

const createCappedMockDb = (): DbAdapter & { storage: Map<string, any> } => {
  const storage = new Map<string, any>()
  return {
    storage,
    get: vi.fn((id: string) => storage.get(id) || null),
    put: vi.fn((doc: any) => {
      storage.set(doc._id, { ...doc, _rev: '1-rev' })
      return { ok: true, id: doc._id, rev: '1-rev' }
    }),
    remove: vi.fn((id: string) => {
      storage.delete(id)
      return { ok: true, id }
    }),
    allDocs: vi.fn((prefix?: string) => {
      const docs: any[] = []
      storage.forEach((doc, id) => {
        if (!prefix || id.startsWith(prefix)) docs.push(doc)
      })
      return docs.slice(0, PAGE_SIZE)
    }),
    bulkDocs: vi.fn(),
    promises: {
      get: vi.fn(async (id: string) => storage.get(id) || null),
      put: vi.fn(async (doc: any) => {
        storage.set(doc._id, { ...doc, _rev: '1-rev' })
        return { ok: true, id: doc._id, rev: '1-rev' }
      }),
      remove: vi.fn(async (doc: any) => {
        const id = typeof doc === 'string' ? doc : doc._id
        storage.delete(id)
        return { ok: true, id }
      }),
      bulkDocs: vi.fn(async () => []),
    },
  }
}

function seedLegacyDocs(db: DbAdapter, count: number) {
  for (let i = 0; i < count; i++) {
    db.put({ _id: `words-list_uuid-${i}`, text: `w${i}` } as any)
  }
}

/** 旧版内置词库导入的逐词遗留：wordbank_<时间戳>_<序号> */
function seedWordbankItemDocs(db: DbAdapter, count: number) {
  for (let i = 0; i < count; i++) {
    db.put({ _id: `wordbank_1726500000000_${i}`, text: `w${i}` } as any)
  }
}

function wordbankItemCount(db: DbAdapter): number {
  return (db as any).storage
    ? [...(db as any).storage.keys()].filter((k: string) => /^wordbank_\d+_\d+$/.test(k)).length
    : -1
}

function legacyCount(db: DbAdapter): number {
  // 用无上限方式统计真实遗留数（直接查 storage）
  return (db as any).storage
    ? [...(db as any).storage.keys()].filter((k: string) => k.startsWith('words-list')).length
    : -1
}

describe('cleanupLegacyPerWordDocs', () => {
  let mockDb: ReturnType<typeof createCappedMockDb>

  beforeEach(() => {
    mockDb = createCappedMockDb()
    setDbAdapter(mockDb)
    mockDb.put({ _id: META_ID, banks: [] } as any)
  })

  afterEach(() => {
    resetDbAdapter()
  })

  it('遗留超过单批上限时循环清批全部删除', async () => {
    seedLegacyDocs(mockDb, PAGE_SIZE * 2 + 10)

    const deleted = await cleanupLegacyPerWordDocs()

    expect(deleted).toBe(PAGE_SIZE * 2 + 10)
    expect(legacyCount(mockDb)).toBe(0)
    expect(mockDb.get(FLAG_ID)).not.toBeNull()
  })

  it('标记已存在但仍有遗留（旧版本只清一批误写标记）时自愈重清', async () => {
    seedLegacyDocs(mockDb, 5)
    mockDb.put({ _id: FLAG_ID, done: true, at: 1 } as any)

    const deleted = await cleanupLegacyPerWordDocs()

    expect(deleted).toBe(5)
    expect(legacyCount(mockDb)).toBe(0)
  })

  it('无遗留时直接返回 0 并补写标记', async () => {
    const deleted = await cleanupLegacyPerWordDocs()

    expect(deleted).toBe(0)
    expect(mockDb.get(FLAG_ID)).not.toBeNull()
  })

  it('chunk 元数据不存在时跳过清理', async () => {
    resetDbAdapter()
    mockDb = createCappedMockDb()
    setDbAdapter(mockDb)
    seedLegacyDocs(mockDb, 10)

    const deleted = await cleanupLegacyPerWordDocs()

    expect(deleted).toBe(0)
    expect(legacyCount(mockDb)).toBe(10)
  })

  it('wordbank_ 逐词遗留被清理，且保留 wordbank_data 迁移源单文档', async () => {
    seedWordbankItemDocs(mockDb, 30)
    mockDb.put({ _id: 'wordbank_data', banks: [{ id: 'b1' }] } as any)

    const deleted = await cleanupLegacyPerWordDocs()

    expect(deleted).toBe(30)
    expect(wordbankItemCount(mockDb)).toBe(0)
    expect(mockDb.get('wordbank_data')).not.toBeNull()
    expect(mockDb.get(FLAG_ID)).not.toBeNull()
  })

  it('wordbank_ 遗留超过单批上限时循环清批全部删除', async () => {
    seedWordbankItemDocs(mockDb, PAGE_SIZE * 2 + 5)

    const deleted = await cleanupLegacyPerWordDocs()

    expect(deleted).toBe(PAGE_SIZE * 2 + 5)
    expect(wordbankItemCount(mockDb)).toBe(0)
    expect(mockDb.get(FLAG_ID)).not.toBeNull()
  })

  it('两类遗留同时存在时全部清空才写标记', async () => {
    seedLegacyDocs(mockDb, 3)
    seedWordbankItemDocs(mockDb, 4)

    const deleted = await cleanupLegacyPerWordDocs()

    expect(deleted).toBe(7)
    expect(legacyCount(mockDb)).toBe(0)
    expect(wordbankItemCount(mockDb)).toBe(0)
    expect(mockDb.get(FLAG_ID)).not.toBeNull()
  })
})
