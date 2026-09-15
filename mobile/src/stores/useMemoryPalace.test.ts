/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { MiniProgramDbAdapter, setDbAdapter, resetDbAdapter } from '@/adapters/index'

// Mock uni API（MiniProgramDbAdapter 走 uni Storage，单 key 超 900KB 自动分块）
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

import { useMemoryPalace } from './useMemoryPalace'
import type { MobilePalace, MobilePegItem } from './useUtils/types'

function makePalace(overrides: Partial<MobilePalace> = {}): MobilePalace {
  return {
    _id: 'p1',
    name: '测试宫殿',
    loci: [
      { order: 1, name: '大门' },
      { order: 2, name: '客厅' },
    ],
    ctime: 1,
    utime: 1,
    ...overrides,
  }
}

function makePeg(overrides: Partial<MobilePegItem> = {}): MobilePegItem {
  return {
    _id: 'peg_p1_1',
    palaceId: 'p1',
    locusOrder: 1,
    freeText: '内容',
    ...overrides,
  }
}

describe('useMemoryPalace（查看版）', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockStorage.clear()
    setDbAdapter(new MiniProgramDbAdapter())
  })

  afterEach(() => {
    resetDbAdapter()
  })

  it('初始为空：load 后无宫殿，collectSync 返回 null', () => {
    const store = useMemoryPalace()
    store.load()
    expect(store.palaces).toEqual([])
    expect(store.collectSync()).toBeNull()
  })

  it('restoreSync 写入宫殿与桩挂载，load 幂等可读回', () => {
    const store = useMemoryPalace()
    const count = store.restoreSync({
      palaces: [makePalace()],
      pegs: { p1: [makePeg({ level: 2, learnDate: 100 })] },
    })
    expect(count).toBe(1)

    // 新 store 实例（模拟重新进入页面）从存储读回
    setActivePinia(createPinia())
    const store2 = useMemoryPalace()
    store2.load()
    expect(store2.palaces).toHaveLength(1)
    expect(store2.getPalace('p1')?.name).toBe('测试宫殿')
    expect(store2.pegsOf('p1')).toHaveLength(1)
  })

  it('restoreSync 合并语义：宫殿按 utime、桩按 learnDate，不丢本地进度', () => {
    const store = useMemoryPalace()
    store.restoreSync({
      palaces: [makePalace({ utime: 100, name: '本地名' })],
      pegs: { p1: [makePeg({ level: 9, learnDate: 300 })] },
    })
    store.restoreSync({
      palaces: [makePalace({ utime: 200, name: '远端名' })],
      pegs: { p1: [makePeg({ level: 3, learnDate: 100 })] },
    })
    // 远端宫殿较新 → 覆盖
    expect(store.getPalace('p1')?.name).toBe('远端名')
    // 本地桩 learnDate 较新 → 保留本地进度
    expect(store.pegsOf('p1')[0].level).toBe(9)
  })

  it('collectSync 收集宫殿与非空桩挂载（空挂载宫殿不带 pegs 键）', () => {
    const store = useMemoryPalace()
    store.restoreSync({
      palaces: [makePalace(), makePalace({ _id: 'p2', name: '空宫殿' })],
      pegs: { p1: [makePeg()] },
    })
    const data = store.collectSync()
    expect(data).not.toBeNull()
    expect(data!.palaces).toHaveLength(2)
    expect(Object.keys(data!.pegs)).toEqual(['p1'])
  })

  it('assess：记住升级 / 忘记降级并持久化', () => {
    const store = useMemoryPalace()
    store.restoreSync({ palaces: [makePalace()], pegs: { p1: [makePeg()] } })

    const remembered = store.assess('p1', 1, true)
    expect(remembered?.level).toBe(1)
    expect(remembered?.learnDate).toBeGreaterThan(0)
    expect(store.pegsOf('p1')[0].level).toBe(1)

    const forgotten = store.assess('p1', 1, false)
    expect(forgotten?.level).toBe(1)

    // 无挂载的桩返回 null
    expect(store.assess('p1', 2, true)).toBeNull()

    // 持久化后新实例可读回
    setActivePinia(createPinia())
    const store2 = useMemoryPalace()
    store2.load()
    expect(store2.pegsOf('p1')[0].level).toBe(1)
  })

  it('dueCount：未自评的挂载计入待巡视', () => {
    const store = useMemoryPalace()
    store.restoreSync({
      palaces: [makePalace()],
      pegs: { p1: [makePeg(), makePeg({ _id: 'peg_p1_2', locusOrder: 2, level: 12, learnDate: Date.now() })] },
    })
    // 桩 1 未自评（到期）；桩 2 满级刚评（不到期）
    expect(store.dueCount('p1')).toBe(1)
    expect(store.dueCount('p2')).toBe(0)
  })

  it('removeLocus：挂载按「旧 order → 新 order」映射重排，被删桩挂载移除', () => {
    const store = useMemoryPalace()
    store.restoreSync({
      palaces: [makePalace({
        loci: [1, 2, 3, 4, 5].map(order => ({ order, name: `桩${order}` })),
      })],
      pegs: {
        p1: [
          makePeg({ _id: 'peg_3', locusOrder: 3 }),
          makePeg({ _id: 'peg_5', locusOrder: 5 }),
        ],
      },
    })
    // 删除 1 号桩：剩余桩重排为 1-4，旧 3/5 号挂载应变为 2/4
    store.removeLocus('p1', 1)
    expect(store.getPalace('p1')?.loci.map(l => l.order)).toEqual([1, 2, 3, 4])
    const orders = store.pegsOf('p1').map(p => ({ id: p._id, locusOrder: p.locusOrder }))
    expect(orders).toEqual([{ id: 'peg_3', locusOrder: 2 }, { id: 'peg_5', locusOrder: 4 }])
    // 持久化后新实例读回仍一致
    setActivePinia(createPinia())
    const store2 = useMemoryPalace()
    store2.load()
    expect(store2.pegsOf('p1').map(p => p.locusOrder)).toEqual([2, 4])
  })

  it('removeLocus：删除被删桩的挂载', () => {
    const store = useMemoryPalace()
    store.restoreSync({
      palaces: [makePalace()],
      pegs: { p1: [makePeg(), makePeg({ _id: 'peg_p1_2', locusOrder: 2 })] },
    })
    store.removeLocus('p1', 1)
    expect(store.pegsOf('p1').map(p => p.locusOrder)).toEqual([1])
  })

  it('moveLocus：挂载的 locusOrder 随桩位交换', () => {
    const store = useMemoryPalace()
    store.restoreSync({
      palaces: [makePalace({
        loci: [1, 2, 3].map(order => ({ order, name: `桩${order}` })),
      })],
      pegs: {
        p1: [
          makePeg({ _id: 'peg_1', locusOrder: 1 }),
          makePeg({ _id: 'peg_2', locusOrder: 2 }),
        ],
      },
    })
    // 1 号桩下移：挂载 1↔2 互换
    store.moveLocus('p1', 1, 1)
    expect(store.getPalace('p1')?.loci.map(l => l.name)).toEqual(['桩2', '桩1', '桩3'])
    expect(store.pegsOf('p1').map(p => ({ id: p._id, locusOrder: p.locusOrder })))
      .toEqual([{ id: 'peg_2', locusOrder: 1 }, { id: 'peg_1', locusOrder: 2 }])
    // 3 号桩上移：与 2 号桩（挂着 peg_1）交换，peg_1 跟随桩 1 移到 3 号位
    store.moveLocus('p1', 3, -1)
    expect(store.pegsOf('p1').map(p => ({ id: p._id, locusOrder: p.locusOrder })))
      .toEqual([{ id: 'peg_2', locusOrder: 1 }, { id: 'peg_1', locusOrder: 3 }])
    // 边界：再往上移不生效
    store.moveLocus('p1', 1, -1)
    expect(store.getPalace('p1')?.loci.map(l => l.name)).toEqual(['桩2', '桩3', '桩1'])
  })
})
