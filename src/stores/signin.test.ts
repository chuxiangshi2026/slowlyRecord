/**
 * 每日打卡 store 测试（桌面端）。
 *
 * 覆盖：存储加载（幂等）、今日打卡去重、连续天数（今天未签从昨天起算、断档停止）、
 * 累计/按月统计、同步 collect/restore 的并集与新增计数。时间固定，存储用内存实现。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useSigninStore } from './signin'
import { SIGNIN_STORAGE_KEY } from '@/utils/signin-db'

function createLocalStorage() {
  const map = new Map<string, string>()
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: vi.fn((key: string, value: string) => {
      map.set(key, String(value))
    }),
    removeItem: (key: string) => map.delete(key),
    clear: () => map.clear(),
    key: (index: number) => Array.from(map.keys())[index] ?? null,
    get length() {
      return map.size
    },
  }
}

let storage: ReturnType<typeof createLocalStorage>

function seed(dates: string[]) {
  storage.setItem(SIGNIN_STORAGE_KEY, JSON.stringify(dates))
}

beforeEach(() => {
  storage = createLocalStorage()
  vi.stubGlobal('localStorage', storage)
  setActivePinia(createPinia())
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 10, 27, 10, 0, 0))
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('初始状态与加载', () => {
  it('未加载时为空状态', () => {
    const store = useSigninStore()
    expect(store.signedDates).toEqual([])
    expect(store.hasSignedToday).toBe(false)
    expect(store.streakDays).toBe(0)
    expect(store.totalSignDays).toBe(0)
    expect(store.todayStr).toBe('2026-11-27')
  })

  it('loadRecords 从存储读取并过滤非字符串', () => {
    seed(['2026-11-01', 123 as any, '', '2026-11-02'])
    const store = useSigninStore()

    store.loadRecords()

    expect(store.signedDates).toEqual(['2026-11-01', '2026-11-02'])
    expect(store.totalSignDays).toBe(2)
  })

  it('loadRecords 幂等：二次调用不再覆盖内存状态', () => {
    seed(['2026-11-01'])
    const store = useSigninStore()
    store.loadRecords()

    seed(['2026-11-02'])
    store.loadRecords()

    expect(store.signedDates).toEqual(['2026-11-01'])
  })

  it('存储损坏时按空列表处理', () => {
    storage.setItem(SIGNIN_STORAGE_KEY, '{bad')
    const store = useSigninStore()
    store.loadRecords()
    expect(store.signedDates).toEqual([])
  })
})

describe('signToday', () => {
  it('首次打卡写入今天并返回 true', () => {
    const store = useSigninStore()
    store.loadRecords()

    expect(store.signToday()).toBe(true)
    expect(store.signedDates).toEqual(['2026-11-27'])
    expect(store.hasSignedToday).toBe(true)
    expect(JSON.parse(storage.getItem(SIGNIN_STORAGE_KEY)!)).toEqual(['2026-11-27'])
  })

  it('重复打卡返回 false 且不重复写入', () => {
    seed(['2026-11-27'])
    const store = useSigninStore()
    store.loadRecords()
    storage.setItem.mockClear()

    expect(store.signToday()).toBe(false)
    expect(store.signedDates).toEqual(['2026-11-27'])
    expect(storage.setItem).not.toHaveBeenCalled()
  })
})

describe('streakDays', () => {
  it('今天已签时从今天起算连续天数', () => {
    seed(['2026-11-27', '2026-11-26', '2026-11-25', '2026-11-23'])
    const store = useSigninStore()
    store.loadRecords()
    expect(store.streakDays).toBe(3)
  })

  it('今天未签时从昨天起算', () => {
    seed(['2026-11-26', '2026-11-25'])
    const store = useSigninStore()
    store.loadRecords()
    expect(store.streakDays).toBe(2)
  })

  it('昨天未签时连续天数为 0', () => {
    seed(['2026-11-25', '2026-11-24'])
    const store = useSigninStore()
    store.loadRecords()
    expect(store.streakDays).toBe(0)
  })

  it('跨月连续正确计算', () => {
    vi.setSystemTime(new Date(2026, 11, 1, 8, 0, 0))
    seed(['2026-12-01', '2026-11-30', '2026-11-29'])
    const store = useSigninStore()
    store.loadRecords()
    expect(store.streakDays).toBe(3)
  })
})

describe('统计', () => {
  it('monthSignDays 按月统计（month 从 0 计）', () => {
    seed(['2026-11-01', '2026-11-27', '2026-10-31', '2025-11-05'])
    const store = useSigninStore()
    store.loadRecords()

    expect(store.monthSignDays(2026, 10)).toBe(2)
    expect(store.monthSignDays(2026, 9)).toBe(1)
    expect(store.monthSignDays(2025, 10)).toBe(1)
    expect(store.monthSignDays(2026, 0)).toBe(0)
  })

  it('totalSignDays 统计全部记录', () => {
    seed(['2026-11-01', '2026-11-02', '2026-11-03'])
    const store = useSigninStore()
    store.loadRecords()
    expect(store.totalSignDays).toBe(3)
  })
})

describe('同步 collect/restore', () => {
  it('collectSync 无数据返回 null', () => {
    const store = useSigninStore()
    expect(store.collectSync()).toBeNull()
  })

  it('collectSync 返回日期副本', () => {
    seed(['2026-11-01', '2026-11-02'])
    const store = useSigninStore()

    const payload = store.collectSync()

    expect(payload).toEqual({ dates: ['2026-11-01', '2026-11-02'] })
    payload!.dates.push('2030-01-01')
    expect(store.signedDates).toHaveLength(2)
  })

  it('restoreSync 按并集合并、排序并返回新增天数', () => {
    seed(['2026-11-01'])
    const store = useSigninStore()

    const added = store.restoreSync({ dates: ['2026-11-03', '2026-11-01', '2026-11-02'] } as any)

    expect(added).toBe(2)
    expect(store.signedDates).toEqual(['2026-11-01', '2026-11-02', '2026-11-03'])
    expect(JSON.parse(storage.getItem(SIGNIN_STORAGE_KEY)!)).toEqual(['2026-11-01', '2026-11-02', '2026-11-03'])
  })

  it('restoreSync 无新增时不写存储', () => {
    seed(['2026-11-01'])
    const store = useSigninStore()
    store.loadRecords()
    storage.setItem.mockClear()

    expect(store.restoreSync({ dates: ['2026-11-01'] } as any)).toBe(0)
    expect(storage.setItem).not.toHaveBeenCalled()
  })

  it('restoreSync 容忍缺省 dates', () => {
    const store = useSigninStore()
    expect(store.restoreSync({} as any)).toBe(0)
    expect(store.restoreSync(undefined as any)).toBe(0)
  })
})
