import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest'
import {setDbAdapter, resetDbAdapter, type DbAdapter} from '@/adapters/db'

vi.mock('@/utils/logger', () => ({
  log: {i: vi.fn(), d: vi.fn(), e: vi.fn(), w: vi.fn()},
}))

const createMockDb = (): DbAdapter => {
  const storage = new Map<string, any>()

  return {
    get: vi.fn((id: string) => storage.get(id) || null),
    put: vi.fn((doc: any) => {
      storage.set(doc._id, {...doc, _rev: '1-rev'})
      return {ok: true, id: doc._id, rev: '1-rev'}
    }),
    remove: vi.fn((id: string | any) => {
      const idStr = typeof id === 'string' ? id : id._id
      storage.delete(idStr)
      return {ok: true, id: idStr}
    }),
    allDocs: vi.fn((prefix?: string) => {
      const docs: any[] = []
      storage.forEach((doc, id) => {
        if (!prefix || id.startsWith(prefix)) docs.push(doc)
      })
      return docs
    }),
    bulkDocs: vi.fn((docs: any[]) => {
      return docs.map(doc => {
        storage.set(doc._id, {...doc, _rev: '1-rev'})
        return {ok: true, id: doc._id, rev: '1-rev'}
      })
    }),
    promises: {
      get: vi.fn(async (id: string) => storage.get(id) || null),
      put: vi.fn(async (doc: any) => {
        storage.set(doc._id, {...doc, _rev: '1-rev'})
        return {ok: true, id: doc._id, rev: '1-rev'}
      }),
      remove: vi.fn(async (id: string | any) => {
        const idStr = typeof id === 'string' ? id : id._id
        storage.delete(idStr)
        return {ok: true, id: idStr}
      }),
      bulkDocs: vi.fn(async (docs: any[]) => {
        return docs.map(doc => {
          storage.set(doc._id, {...doc, _rev: '1-rev'})
          return {ok: true, id: doc._id, rev: '1-rev'}
        })
      }),
    },
  }
}

describe('knowledge-memory-db', () => {
  let mockDb: DbAdapter

  beforeEach(() => {
    mockDb = createMockDb()
    setDbAdapter(mockDb)
  })

  afterEach(() => {
    resetDbAdapter()
    vi.restoreAllMocks()
  })

  it('无进度文档时返回默认空文档', async () => {
    const {getProgressDoc} = await import('./knowledge-memory-db')
    const doc = getProgressDoc('elements')
    expect(doc._id).toBe('knowledge_memory_elements')
    expect(doc.type).toBe('knowledge_pack_progress')
    expect(doc.packId).toBe('elements')
    expect(Object.keys(doc.items)).toHaveLength(0)
  })

  it('应保存并读取进度文档', async () => {
    const {getProgressDoc, saveProgressDoc} = await import('./knowledge-memory-db')
    const doc = getProgressDoc('elements')
    doc.items['item_1'] = {itemId: 'item_1', level: 3, learnDate: Date.now(), correct: 1, wrong: 0}
    await saveProgressDoc(doc)
    const saved = getProgressDoc('elements')
    expect(saved.items['item_1'].level).toBe(3)
    expect(saved._rev).toBe('1-rev')
  })

  it('getItemProgress 应返回默认进度', async () => {
    const {getItemProgress} = await import('./knowledge-memory-db')
    const progress = getItemProgress('elements', 'new_item')
    expect(progress.itemId).toBe('new_item')
    expect(progress.level).toBe(0)
  })

  it('updateItemProgress 应更新单条目进度', async () => {
    const {getItemProgress, updateItemProgress} = await import('./knowledge-memory-db')
    await updateItemProgress('elements', 'item_1', {
      itemId: 'item_1',
      level: 2,
      learnDate: 1000,
      correct: 1,
      wrong: 0,
    })
    const progress = getItemProgress('elements', 'item_1')
    expect(progress.level).toBe(2)
    expect(progress.learnDate).toBe(1000)
  })

  it('clearProgressDoc 应清空进度文档', async () => {
    const {updateItemProgress, clearProgressDoc, getProgressDoc} = await import('./knowledge-memory-db')
    await updateItemProgress('elements', 'item_1', {
      itemId: 'item_1',
      level: 5,
      learnDate: Date.now(),
      correct: 1,
      wrong: 0,
    })
    await clearProgressDoc('elements')
    const doc = getProgressDoc('elements')
    expect(Object.keys(doc.items)).toHaveLength(0)
  })
})

describe('knowledge-memory-db 已导入清单', () => {
  let mockDb: DbAdapter

  beforeEach(() => {
    mockDb = createMockDb()
    setDbAdapter(mockDb)
  })

  afterEach(() => {
    resetDbAdapter()
    vi.restoreAllMocks()
  })

  it('无清单文档时返回空数组', async () => {
    const {getImportedIds} = await import('./knowledge-memory-db')
    expect(getImportedIds()).toEqual([])
  })

  it('addImportedId 应新增且幂等', async () => {
    const {getImportedIds, addImportedId} = await import('./knowledge-memory-db')
    await addImportedId('pack-a')
    await addImportedId('pack-b')
    await addImportedId('pack-a')
    expect(getImportedIds()).toEqual(['pack-a', 'pack-b'])
  })

  it('removeImportedId 应移除指定项，移除不存在的 id 无副作用', async () => {
    const {getImportedIds, addImportedId, removeImportedId} = await import('./knowledge-memory-db')
    await addImportedId('pack-a')
    await addImportedId('pack-b')
    await removeImportedId('pack-a')
    expect(getImportedIds()).toEqual(['pack-b'])
    await removeImportedId('pack-c')
    expect(getImportedIds()).toEqual(['pack-b'])
  })

  it('hasProgressDoc 应反映进度文档是否真实存在', async () => {
    const {hasProgressDoc, updateItemProgress} = await import('./knowledge-memory-db')
    expect(hasProgressDoc('elements')).toBe(false)
    await updateItemProgress('elements', 'item_1', {
      itemId: 'item_1',
      level: 1,
      learnDate: 1000,
      correct: 1,
      wrong: 0,
    })
    expect(hasProgressDoc('elements')).toBe(true)
  })
})
