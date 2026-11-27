/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { MiniProgramDbAdapter, setDbAdapter, resetDbAdapter, getDbAdapter } from '@/adapters/index'

const mockStorage = new Map<string, any>()
;(global as any).uni = {
  setStorageSync: vi.fn((key: string, data: any) => { mockStorage.set(key, data) }),
  getStorageSync: vi.fn((key: string) => mockStorage.get(key) ?? null),
  removeStorageSync: vi.fn((key: string) => { mockStorage.delete(key) }),
  getStorageInfoSync: vi.fn(() => ({
    keys: Array.from(mockStorage.keys()),
    currentSize: 0,
    limitSize: 10240,
  })),
}

import { useNumberMemory } from './useNumberMemory'
import { getTombstones } from './useUtils/sync-tombstone'
import type { MobileNumberEntry, MobileNumberMemory } from './useUtils/types'

const DOC_ID = 'numbermemory-data'
const LEGACY_KEY = 'slowlyrecord-numbermemory-data'

function makeEntry(overrides: Partial<MobileNumberEntry> = {}): MobileNumberEntry {
  return {
    _id: 'e1',
    title: '标题',
    numbers: '123',
    tags: ['标签'],
    createdAt: 100,
    updatedAt: 100,
    reviewCount: 0,
    ...overrides,
  }
}

function putDoc(data: Partial<MobileNumberMemory>): void {
  getDbAdapter().put({
    _id: DOC_ID,
    data: { associations: [], entries: [], notes: [], prompts: [], ...data },
  } as any)
}

describe('useNumberMemory：加载与迁移', () => {
  beforeEach(() => {
    mockStorage.clear()
    setActivePinia(createPinia())
    setDbAdapter(new MiniProgramDbAdapter())
  })

  afterEach(() => {
    resetDbAdapter()
  })

  it('load 读取 DB 文档，幂等', () => {
    putDoc({ associations: [{ number: '1', type: 'text', description: '蜡烛', source: 'preset' }] })
    const store = useNumberMemory()
    expect(store.loading).toBe(false)

    store.load()
    expect(store.loading).toBe(false)
    expect(store.associationCount).toBe(1)

    // 再改库也不会重新加载
    putDoc({ associations: [] })
    store.load()
    expect(store.associationCount).toBe(1)
  })

  it('load 迁移旧裸 storage 数据到 DB 并清空旧 key', () => {
    mockStorage.set(LEGACY_KEY, {
      associations: [{ number: '2', type: 'text', description: '鸭子', source: 'preset' }],
      entries: [makeEntry({ _id: 'legacy-e' })],
    })

    const store = useNumberMemory()
    store.load()

    expect(store.associationCount).toBe(1)
    expect(store.totalEntries).toBe(1)
    expect(mockStorage.has(LEGACY_KEY)).toBe(false)
    expect((getDbAdapter().get(DOC_ID) as any)?.data?.associations).toHaveLength(1)
  })

  it('损坏文档归一化为空数组', () => {
    getDbAdapter().put({
      _id: DOC_ID,
      data: { associations: 'bad', entries: null, notes: 1, prompts: {} },
    } as any)
    const store = useNumberMemory()
    store.load()
    expect(store.associations).toEqual([])
    expect(store.entries).toEqual([])
    expect(store.notes).toEqual([])
    expect(store.prompts).toEqual([])
  })
})

describe('useNumberMemory：数字桩 CRUD', () => {
  beforeEach(() => {
    mockStorage.clear()
    setActivePinia(createPinia())
    setDbAdapter(new MiniProgramDbAdapter())
  })

  afterEach(() => {
    resetDbAdapter()
  })

  it('setAssociation 新增/更新：保留来源与图片，空字符串显式清除图片', () => {
    const store = useNumberMemory()
    store.load()

    const added = store.setAssociation({ number: '1', description: '蜡烛' })
    expect(added).toMatchObject({ number: '1', type: 'text', source: 'user' })

    const image = store.setAssociation({ number: '1', description: '蜡烛', imageUrl: 'data:image/png;base64,x', imageSource: 'base64' })
    expect(image).toMatchObject({ type: 'image', imageUrl: 'data:image/png;base64,x', imageSource: 'base64' })
    expect(store.associationCount).toBe(1)

    // 不传 imageUrl 沿用原值
    const kept = store.setAssociation({ number: '1', description: '新描述' })
    expect(kept.imageUrl).toBe('data:image/png;base64,x')
    expect(kept.description).toBe('新描述')

    // 传空串清除图片
    const cleared = store.setAssociation({ number: '1', description: '新描述', imageUrl: '' })
    expect(cleared.type).toBe('text')
    expect(cleared.imageUrl).toBeUndefined()
    expect(cleared.imageSource).toBeUndefined()
  })

  it('deleteAssociation 写墓碑；不存在时不写', () => {
    const store = useNumberMemory()
    store.load()
    store.setAssociation({ number: '1', description: '蜡烛' })

    store.deleteAssociation('1')
    expect(store.associationCount).toBe(0)
    expect(getTombstones()).toHaveProperty('1')

    const rev = (getDbAdapter().get(DOC_ID) as any)?._rev
    store.deleteAssociation('1')
    expect((getDbAdapter().get(DOC_ID) as any)?._rev).toBe(rev)
  })

  it('clearAllAssociations 批量写墓碑', () => {
    const store = useNumberMemory()
    store.load()
    store.setAssociation({ number: '1', description: 'a' })
    store.setAssociation({ number: '2', description: 'b' })

    store.clearAllAssociations()
    expect(store.associations).toEqual([])
    expect(getTombstones()).toHaveProperty('1')
    expect(getTombstones()).toHaveProperty('2')

    // 空列表时不产生写入
    const rev = (getDbAdapter().get(DOC_ID) as any)?._rev
    store.clearAllAssociations()
    expect((getDbAdapter().get(DOC_ID) as any)?._rev).toBe(rev)
  })

  it('rateAssociation 按复习调度升级/降级并写入 nextReview', () => {
    const store = useNumberMemory()
    store.load()
    store.setAssociation({ number: '1', description: '蜡烛' })

    const now = 1_000_000
    expect(store.rateAssociation('1', true, now)).toBe(true)
    expect(store.getAssociation('1')).toMatchObject({
      level: 1,
      nextReview: now + 5 * 60 * 1000, // 1 级间隔 5 分钟
    })

    expect(store.rateAssociation('1', false, now)).toBe(true)
    // 1 级答错：-4 下限 1
    expect(store.getAssociation('1')?.level).toBe(1)

    expect(store.rateAssociation('nope', true, now)).toBe(false)
  })

  it('isAssociationDue / dueAssociations 按到期时间升序', () => {
    const store = useNumberMemory()
    store.load()
    store.setAssociation({ number: '1', description: 'a' })
    store.setAssociation({ number: '2', description: 'b' })
    store.associations[0] = { ...store.associations[0], nextReview: Date.now() + 60_000 }
    store.associations[1] = { ...store.associations[1], nextReview: 0 }

    expect(store.isAssociationDue('1')).toBe(false)
    expect(store.isAssociationDue('2')).toBe(true)
    expect(store.dueAssociations.map(a => a.number)).toEqual(['2'])
  })
})

describe('useNumberMemory：条目 CRUD', () => {
  beforeEach(() => {
    mockStorage.clear()
    setActivePinia(createPinia())
    setDbAdapter(new MiniProgramDbAdapter())
  })

  afterEach(() => {
    resetDbAdapter()
  })

  it('addEntry 置顶插入并生成 id', () => {
    const store = useNumberMemory()
    store.load()
    const entry = store.addEntry({ title: '圆周率', numbers: '3.14' })
    expect(entry._id).toMatch(/^numentry_/)
    expect(entry).toMatchObject({ title: '圆周率', numbers: '3.14', tags: [], reviewCount: 0 })
    expect(store.entries[0]).toEqual(entry)
  })

  it('updateEntry 保留 _id/createdAt，刷新 updatedAt', () => {
    const store = useNumberMemory()
    store.load()
    const entry = store.addEntry({ title: '旧', numbers: '1' })

    expect(store.updateEntry(entry._id, { title: '新', _id: 'hack', createdAt: 1 } as any)).toBe(true)
    expect(store.entries[0]).toMatchObject({ _id: entry._id, title: '新', createdAt: entry.createdAt })
    expect(store.entries[0].updatedAt).toBeGreaterThanOrEqual(entry.updatedAt)

    expect(store.updateEntry('nope', { title: 'x' })).toBe(false)
  })

  it('deleteEntry 级联删除笔记/提示词并写墓碑', () => {
    const store = useNumberMemory()
    store.load()
    const entry = store.addEntry({ title: 'x', numbers: '1' })
    store.notes.push(
      { _id: 'n1', entryId: entry._id, content: '笔记', createdAt: 1 },
      { _id: 'n2', entryId: 'other', content: '保留', createdAt: 1 },
    )
    store.prompts.push(
      { _id: 'p1', entryId: entry._id, title: 't', content: 'c', order: 1, enabled: true, createdAt: 1 },
    )

    store.deleteEntry(entry._id)
    expect(store.entries).toEqual([])
    expect(store.notes.map(n => n._id)).toEqual(['n2'])
    expect(store.prompts).toEqual([])
    expect(getTombstones()).toMatchObject({
      [entry._id]: expect.any(Number),
      n1: expect.any(Number),
      p1: expect.any(Number),
    })

    // 不存在的条目：不写墓碑
    store.deleteEntry('nope')
    expect(getTombstones()).not.toHaveProperty('nope')
  })

  it('rateEntry 更新等级、nextReview 与复习统计', () => {
    const store = useNumberMemory()
    store.load()
    const entry = store.addEntry({ title: 'x', numbers: '1' })

    const now = 2_000_000
    expect(store.rateEntry(entry._id, true, now)).toBe(true)
    expect(store.entries[0]).toMatchObject({
      level: 1,
      nextReview: now + 5 * 60 * 1000,
      lastReviewTime: now,
      reviewCount: 1,
    })

    store.rateEntry(entry._id, false, now)
    expect(store.entries[0].reviewCount).toBe(2)

    expect(store.rateEntry('nope', true, now)).toBe(false)
  })

  it('isEntryDue / sortedEntries / allTags / associationMap', () => {
    const store = useNumberMemory()
    store.load()
    const a = store.addEntry({ title: 'a', numbers: '1', tags: ['x', 'y'] })
    const b = store.addEntry({ title: 'b', numbers: '2', tags: ['y'] })
    store.entries[0].createdAt = 200
    store.entries[1].createdAt = 100

    expect(store.sortedEntries.map(e => e._id)).toEqual([b._id, a._id])
    expect(store.allTags).toEqual(['x', 'y'])
    expect(store.isEntryDue(a._id)).toBe(true)
    store.rateEntry(a._id, true, Date.now())
    expect(store.isEntryDue(a._id)).toBe(false)
    expect(store.isEntryDue('nope')).toBe(true)

    store.setAssociation({ number: '9', description: '气球' })
    expect(store.associationMap.get('9')?.description).toBe('气球')
    expect(store.hasAssociation('9')).toBe(true)
    expect(store.hasAssociation('8')).toBe(false)
  })

  it('collect 返回四类数据引用', () => {
    const store = useNumberMemory()
    store.load()
    store.setAssociation({ number: '1', description: 'a' })
    store.addEntry({ title: 'x', numbers: '1' })

    const data = store.collect()
    expect(data.associations).toHaveLength(1)
    expect(data.entries).toHaveLength(1)
    expect(data.notes).toEqual([])
    expect(data.prompts).toEqual([])
  })
})

describe('useNumberMemory：同步合并', () => {
  beforeEach(() => {
    mockStorage.clear()
    setActivePinia(createPinia())
    setDbAdapter(new MiniProgramDbAdapter())
  })

  afterEach(() => {
    resetDbAdapter()
  })

  it('restore(merge)：新增、按 updatedAt 覆盖、墓碑过滤删除', () => {
    const store = useNumberMemory()
    store.load()
    store.setAssociation({ number: '1', description: '本地旧' })
    // 直接写入固定 _id，避免 addEntry 生成 id
    store.entries.push(makeEntry({ _id: 'local', title: '本地', updatedAt: 500 }))

    const tombstones = { deleted: Date.now() }
    const result = store.restore({
      associations: [
        { number: '1', type: 'text', description: '远端新', source: 'user' },
        { number: '2', type: 'text', description: '远端新增', source: 'user' },
        { number: 'deleted', type: 'text', description: '应删除', source: 'user' },
      ],
      entries: [
        makeEntry({ _id: 'local', title: '远端新', updatedAt: 1000 }),
        makeEntry({ _id: 'remote-new', updatedAt: 1 }),
        makeEntry({ _id: 'deleted', updatedAt: 1 }),
      ],
      notes: [{ _id: 'note1', entryId: 'local', content: 'n', createdAt: 1 }],
      prompts: [{ _id: 'prompt1', entryId: 'local', title: 't', content: 'c', order: 1, enabled: true, createdAt: 1 }],
    }, 'merge', tombstones)

    expect(result).toEqual({ addedAssoc: 1, addedEntry: 1, deletedAssoc: 0, deletedEntry: 0 })
    expect(store.getAssociation('1')?.description).toBe('远端新')
    expect(store.getAssociation('2')?.description).toBe('远端新增')
    expect(store.getAssociation('deleted')).toBeUndefined()
    expect(store.entries.find(e => e._id === 'local')?.title).toBe('远端新')
    expect(store.entries.find(e => e._id === 'remote-new')).toBeTruthy()
    expect(store.entries.find(e => e._id === 'deleted')).toBeUndefined()
    expect(store.notes.map(n => n._id)).toEqual(['note1'])
    expect(store.prompts.map(p => p._id)).toEqual(['prompt1'])
  })

  it('restore(merge)：本地墓碑先删除本地条目并计数', () => {
    const store = useNumberMemory()
    store.load()
    store.setAssociation({ number: '1', description: 'a' })
    store.entries.push(makeEntry({ _id: 'e1' }))

    const result = store.restore({ associations: [], entries: [], notes: [], prompts: [] }, 'merge', {
      '1': Date.now(),
      e1: Date.now(),
    })
    expect(result.deletedAssoc).toBe(1)
    expect(result.deletedEntry).toBe(1)
    expect(store.associations).toEqual([])
    expect(store.entries).toEqual([])
  })

  it('restore(replace)：整表替换并过滤墓碑', () => {
    const store = useNumberMemory()
    store.load()
    store.setAssociation({ number: 'local', description: '本地' })

    const result = store.restore({
      associations: [
        { number: 'remote', type: 'text', description: '远端', source: 'user' },
        { number: 'deleted', type: 'text', description: '删', source: 'user' },
      ],
      entries: [makeEntry({ _id: 'e1', updatedAt: 100 }), makeEntry({ _id: 'del', updatedAt: 100 })],
      notes: [],
      prompts: [],
    }, 'replace', { deleted: Date.now(), del: Date.now() })

    expect(result).toEqual({ addedAssoc: 1, addedEntry: 1, deletedAssoc: 0, deletedEntry: 0 })
    expect(store.associations.map(a => a.number)).toEqual(['remote'])
    expect(store.entries.map(e => e._id)).toEqual(['e1'])
  })

  it('restore(空数据) 返回零计数且不改动', () => {
    const store = useNumberMemory()
    store.load()
    store.setAssociation({ number: '1', description: 'a' })
    expect(store.restore(undefined as any)).toEqual({ addedAssoc: 0, addedEntry: 0, deletedAssoc: 0, deletedEntry: 0 })
    expect(store.associationCount).toBe(1)
  })
})
