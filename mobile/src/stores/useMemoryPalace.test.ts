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
})
