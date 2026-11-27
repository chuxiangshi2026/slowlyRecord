/**
 * 记忆宫殿 store 测试（桌面端）。
 *
 * DB 存取层、知识包服务、同步墓碑与 words store 均以内存 mock 替代，
 * 保留真实的 memory-palace-util / memory-palace-srs 纯函数，验证 store 的编排逻辑：
 * 宫殿 CRUD、桩列表规范化、挂载/卸载、文章切块挂载、自评 SRS 与桩库导入。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { resetDbAdapter, setDbAdapter } from '@/adapters/db'
import type { Palace, PalaceLocus, PegItem } from '@/types/memory-palace'

const db = vi.hoisted(() => {
  const palaces = new Map<string, any>()
  const pegs = new Map<string, any>()
  const savePalace = vi.fn(async (palace: any) => {
    palaces.set(palace._id, palace)
    return { ok: true, id: palace._id }
  })
  const removePalace = vi.fn(async (id: string) => {
    palaces.delete(id)
    for (const [key, peg] of pegs) {
      if (peg.palaceId === id) pegs.delete(key)
    }
    return { ok: true, id }
  })
  const savePegItem = vi.fn(async (peg: any) => {
    pegs.set(peg._id, peg)
    return { ok: true, id: peg._id }
  })
  const savePegItems = vi.fn(async (items: any[]) => {
    items.forEach(item => pegs.set(item._id, item))
    return { ok: true }
  })
  const removePegItem = vi.fn(async (_palaceId: string, pegId: string) => {
    pegs.delete(pegId)
    return { ok: true, id: pegId }
  })
  return {
    palaces,
    pegs,
    savePalace,
    removePalace,
    savePegItem,
    savePegItems,
    removePegItem,
    getAllPalaces: () => Array.from(palaces.values()),
    getPalaceById: (id: string) => palaces.get(id) ?? null,
    getPegsByPalace: (id: string) =>
      Array.from(pegs.values()).filter(p => p.palaceId === id).sort((a, b) => a.locusOrder - b.locusOrder),
    getMountedCount: (id: string) => Array.from(pegs.values()).filter(p => p.palaceId === id).length,
  }
})

const packs = vi.hoisted(() => ({
  list: [] as any[],
  byId: {} as Record<string, any>,
  fetch: vi.fn(async (id: string) => packs.byId[id]),
}))

const tombstone = vi.hoisted(() => ({ record: vi.fn(async () => {}) }))
const wordsStore = vi.hoisted(() => ({ memoryFirmness: '正常' }))

vi.mock('@/utils/memory-palace-db', () => db)
vi.mock('@/utils/knowledge-pack-service', () => ({
  listKnowledgePacks: () => packs.list,
  fetchKnowledgePack: packs.fetch,
}))
vi.mock('@/utils/sync-tombstone', () => ({ recordTombstone: tombstone.record }))
vi.mock('@/stores/words', () => ({ useWordsStore: () => ({ memoryFirmness: wordsStore.memoryFirmness }) }))
vi.mock('@/utils/logger', () => ({ log: { i: vi.fn(), d: vi.fn(), e: vi.fn(), w: vi.fn() } }))

import { useMemoryPalaceStore } from './memoryPalace'

function makeLocus(order: number, name: string): PalaceLocus {
  return { order, name }
}

function makePalace(id: string, loci: PalaceLocus[] = [makeLocus(1, '一'), makeLocus(2, '二'), makeLocus(3, '三')]): Palace {
  return { _id: id, name: `宫殿-${id}`, loci, ctime: 1, utime: 1 }
}

function seedPeg(peg: Partial<PegItem> & Pick<PegItem, '_id' | 'palaceId' | 'locusOrder'>): PegItem {
  const full = { level: 0, learnDate: 0, ...peg } as PegItem
  db.pegs.set(full._id, full)
  return full
}

beforeEach(() => {
  setActivePinia(createPinia())
  setDbAdapter({ get: vi.fn(), put: vi.fn(), remove: vi.fn(), allDocs: vi.fn(), bulkDocs: vi.fn() } as any)
  db.palaces.clear()
  db.pegs.clear()
  vi.clearAllMocks()
  packs.list = []
  packs.byId = {}
  wordsStore.memoryFirmness = '正常'
})

afterEach(() => {
  resetDbAdapter()
})

describe('loadPalaces / mountedCount', () => {
  it('从 DB 加载全部宫殿', async () => {
    db.palaces.set('p1', makePalace('p1'))
    db.palaces.set('p2', makePalace('p2'))
    const store = useMemoryPalaceStore()
    await store.loadPalaces()
    expect(store.palaces).toHaveLength(2)
    expect(store.loading).toBe(false)
  })

  it('mountedCount 委托 DB 统计当前宫殿挂载数', async () => {
    seedPeg({ _id: 'peg_a', palaceId: 'p1', locusOrder: 1 })
    seedPeg({ _id: 'peg_b', palaceId: 'p1', locusOrder: 2 })
    seedPeg({ _id: 'peg_c', palaceId: 'p2', locusOrder: 1 })
    const store = useMemoryPalaceStore()
    expect(store.mountedCount('p1')).toBe(2)
    expect(store.mountedCount('p2')).toBe(1)
  })
})

describe('createPalace', () => {
  it('规范化桩列表：去空名、重排 order、裁剪描述与备选名', async () => {
    const store = useMemoryPalaceStore()
    const loci: PalaceLocus[] = [
      { order: 9, name: '  一  ', description: '  描述  ', alternates: ['a', 'b'], imageUrl: 'img' },
      { order: 2, name: '   ' },
      { order: 5, name: '二' },
    ]
    const { result, palace } = await store.createPalace('  我的宫殿  ', loci, 'pack-1', 'overview.png')
    expect(result.ok).toBe(true)
    expect(palace.name).toBe('我的宫殿')
    expect(palace.sourcePackId).toBe('pack-1')
    expect(palace.overviewImage).toBe('overview.png')
    expect(palace.loci).toEqual([
      { order: 1, name: '一', imageUrl: 'img', description: '描述', alternates: ['a', 'b'] },
      { order: 2, name: '二', imageUrl: undefined, description: undefined, alternates: undefined },
    ])
    expect(db.savePalace).toHaveBeenCalledOnce()
    expect(store.palaces).toContainEqual(palace)
  })

  it('保存失败时不加入本地列表', async () => {
    db.savePalace.mockResolvedValueOnce({ ok: false, error: true, message: 'fail' } as any)
    const store = useMemoryPalaceStore()
    const { result } = await store.createPalace('宫殿', [makeLocus(1, '一')])
    expect(result.ok).toBe(false)
    expect(store.palaces).toHaveLength(0)
  })
})

describe('updatePalace', () => {
  it('更新本地对象并清理被删除桩的挂载', async () => {
    db.palaces.set('p1', makePalace('p1'))
    seedPeg({ _id: 'peg_1', palaceId: 'p1', locusOrder: 1 })
    seedPeg({ _id: 'peg_2', palaceId: 'p1', locusOrder: 2 })
    const store = useMemoryPalaceStore()
    await store.loadPalaces()
    await store.loadPegs('p1')

    const updated = { ...store.palaces[0], name: '改名', loci: [makeLocus(1, '一')] }
    const result = await store.updatePalace(updated)

    expect(result.ok).toBe(true)
    expect(store.palaces[0].name).toBe('改名')
    expect(store.pegs.map(p => p._id)).toEqual(['peg_1'])
    expect(db.removePegItem).toHaveBeenCalledWith('p1', 'peg_2')
  })
})

describe('deletePalace', () => {
  it('删除宫殿、记录墓碑，并在删除当前宫殿时清空选中态', async () => {
    db.palaces.set('p1', makePalace('p1'))
    db.palaces.set('p2', makePalace('p2'))
    seedPeg({ _id: 'peg_1', palaceId: 'p1', locusOrder: 1 })
    const store = useMemoryPalaceStore()
    await store.loadPalaces()
    await store.loadPegs('p1')

    const result = await store.deletePalace('p1')

    expect(result.ok).toBe(true)
    expect(tombstone.record).toHaveBeenCalledWith('p1')
    expect(store.palaces.map(p => p._id)).toEqual(['p2'])
    expect(store.currentPalaceId).toBe('')
    expect(store.pegs).toEqual([])
  })

  it('删除非当前宫殿时保留当前选中态', async () => {
    db.palaces.set('p1', makePalace('p1'))
    db.palaces.set('p2', makePalace('p2'))
    const store = useMemoryPalaceStore()
    await store.loadPalaces()
    await store.loadPegs('p1')
    await store.deletePalace('p2')
    expect(store.currentPalaceId).toBe('p1')
  })
})

describe('loadPegs / getPegByLocus / currentPalace', () => {
  it('加载指定宫殿的桩，并在列表未加载时兜底加载宫殿', async () => {
    db.palaces.set('p1', makePalace('p1'))
    seedPeg({ _id: 'peg_2', palaceId: 'p1', locusOrder: 2 })
    seedPeg({ _id: 'peg_1', palaceId: 'p1', locusOrder: 1 })
    const store = useMemoryPalaceStore()
    await store.loadPalaces()
    await store.loadPegs('p1')

    expect(store.currentPalaceId).toBe('p1')
    expect(store.currentPalace?.name).toBe('宫殿-p1')
    expect(store.pegs.map(p => p.locusOrder)).toEqual([1, 2])
    expect(store.getPegByLocus(2)?._id).toBe('peg_2')
    expect(store.getPegByLocus(9)).toBeUndefined()
  })

  it('宫殿不在 DB 时按全量列表兜底加载', async () => {
    db.palaces.set('p0', makePalace('p0'))
    const store = useMemoryPalaceStore()
    await store.loadPegs('missing')
    expect(store.palaces.map(p => p._id)).toEqual(['p0'])
    expect(store.currentPalaceId).toBe('missing')
    expect(store.pegs).toEqual([])
  })
})

describe('mountFreeText / unmountPeg', () => {
  it('挂载自由文本：去空白、同桩覆盖并保持按桩排序', async () => {
    const store = useMemoryPalaceStore()
    await store.mountFreeText('p1', 2, '  第二桩  ', '  联想  ')
    await store.mountFreeText('p1', 1, '第一桩')
    await store.mountFreeText('p1', 2, '第二桩改')

    expect(store.pegs.map(p => p.locusOrder)).toEqual([1, 2])
    expect(store.pegs[1].freeText).toBe('第二桩改')
    expect(store.pegs[0].mnemonic).toBeUndefined()
    expect(store.pegs[0]._id).toBe('peg_p1_1')
    expect(db.savePegItem).toHaveBeenCalledTimes(3)
  })

  it('卸载桩后从本地列表移除', async () => {
    const store = useMemoryPalaceStore()
    await store.mountFreeText('p1', 1, '第一桩')
    const peg = store.pegs[0]
    const result = await store.unmountPeg(peg)
    expect(result.ok).toBe(true)
    expect(store.pegs).toEqual([])
    expect(db.removePegItem).toHaveBeenCalledWith('p1', peg._id)
  })
})

describe('mountArticle', () => {
  const article = {
    _id: 'a1',
    title: '文章',
    content: 'One. Two. Three.',
    ctime: 1,
    utime: 1,
  } as any

  it('文章为空时返回失败且不写库', async () => {
    const store = useMemoryPalaceStore()
    const result = await store.mountArticle(makePalace('p1'), { ...article, content: '   ' }, 'sentence')
    expect(result.result.ok).toBe(false)
    expect(result.mounted).toBe(0)
    expect(db.savePegItems).not.toHaveBeenCalled()
  })

  it('按句切块并挂到空桩，已有挂载的桩被跳过', async () => {
    db.palaces.set('p1', makePalace('p1'))
    seedPeg({ _id: 'peg_p1_2', palaceId: 'p1', locusOrder: 2 })
    const store = useMemoryPalaceStore()

    const result = await store.mountArticle(store.palaces[0] ?? makePalace('p1'), article, 'sentence')

    expect(result.mounted).toBe(2)
    expect(result.totalChunks).toBe(3)
    const saved = db.savePegItems.mock.calls[0][0] as PegItem[]
    expect(saved.map(p => p.locusOrder)).toEqual([1, 3])
    expect(saved.map(p => p.contentRef?.chunkIndex)).toEqual([0, 1])
    expect(saved.every(p => p.contentRef?.articleId === 'a1' && p.contentRef?.mode === 'sentence')).toBe(true)
  })

  it('桩位不足时截断到空桩数量', async () => {
    const palace = makePalace('p1', [makeLocus(1, '一')])
    const store = useMemoryPalaceStore()
    const result = await store.mountArticle(palace, article, 'sentence')
    expect(result.mounted).toBe(1)
    expect(result.totalChunks).toBe(3)
  })

  it('段落模式按换行切块', async () => {
    const palace = makePalace('p1', [makeLocus(1, '一'), makeLocus(2, '二')])
    const store = useMemoryPalaceStore()
    const result = await store.mountArticle(palace, { ...article, content: '第一段\n\n第二段' }, 'paragraph')
    expect(result.mounted).toBe(2)
    expect(result.totalChunks).toBe(2)
  })
})

describe('assessPeg', () => {
  it('记住：到期后按牢固度升级并刷新 learnDate', async () => {
    wordsStore.memoryFirmness = '牢固'
    const store = useMemoryPalaceStore()
    const peg = seedPeg({
      _id: 'peg_1',
      palaceId: 'p1',
      locusOrder: 1,
      level: 1,
      learnDate: Date.now() - 3 * 24 * 3600 * 1000,
    })
    const before = Date.now()
    await store.assessPeg(peg, true)

    const updated = store.pegs[0]
    expect(updated.level).toBeGreaterThan(1)
    expect(updated.learnDate).toBeGreaterThanOrEqual(before)
    expect(db.pegs.get('peg_1').level).toBe(updated.level)
  })

  it('忘记：等级降 4，下限 1', async () => {
    const store = useMemoryPalaceStore()
    const peg = seedPeg({ _id: 'peg_5', palaceId: 'p1', locusOrder: 1, level: 5, learnDate: 1 })
    await store.assessPeg(peg, false)
    expect(store.pegs[0].level).toBe(1)

    const high = seedPeg({ _id: 'peg_12', palaceId: 'p1', locusOrder: 2, level: 12, learnDate: 1 })
    await store.assessPeg(high, false)
    expect(store.getPegByLocus(2)?.level).toBe(8)
  })
})

describe('知识包导入', () => {
  it('listPegPacks 只返回可用作桩库的知识包', () => {
    packs.list = [
      { id: 'a', usableAsPeg: true },
      { id: 'b', usableAsPeg: false },
      { id: 'c' },
    ]
    const store = useMemoryPalaceStore()
    expect(store.listPegPacks().map(p => p.id)).toEqual(['a'])
  })

  it('importPackAsPalace 按 order 排序条目并写入 sourcePackId', async () => {
    packs.byId.pack1 = {
      id: 'pack1',
      name: '数字桩',
      items: [
        { order: 2, question: '二', answer: 'two' },
        { order: 1, question: '一', answer: 'one', alternates: ['壹'] },
      ],
    }
    const store = useMemoryPalaceStore()
    const { palace } = await store.importPackAsPalace('pack1')

    expect(packs.fetch).toHaveBeenCalledWith('pack1')
    expect(palace.name).toBe('数字桩')
    expect(palace.sourcePackId).toBe('pack1')
    expect(palace.loci.map(l => l.name)).toEqual(['一', '二'])
    expect(palace.loci[0].alternates).toEqual(['壹'])
    expect(store.palaces).toContainEqual(palace)
  })
})
