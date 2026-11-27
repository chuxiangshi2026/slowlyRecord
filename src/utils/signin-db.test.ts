/**
 * 每日打卡数据存取层测试（桌面端）。
 *
 * 覆盖：读取（缺省/损坏/非数组/过滤非法项）、写回（去重排序/过滤/存储异常告警）、
 * 同步 collect（空返回 null）与 restore（并集、新增计数、无新增不写）。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const logMock = vi.hoisted(() => ({ w: vi.fn(), e: vi.fn() }))

vi.mock('@/utils/logger', () => ({ log: logMock }))

import {
  SIGNIN_STORAGE_KEY,
  collectSigninSync,
  getSigninDates,
  restoreSigninSync,
  saveSigninDates,
} from './signin-db'

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

beforeEach(() => {
  storage = createLocalStorage()
  vi.stubGlobal('localStorage', storage)
  logMock.w.mockClear()
  logMock.e.mockClear()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('getSigninDates', () => {
  it('无记录返回空数组', () => {
    expect(getSigninDates()).toEqual([])
  })

  it('读取数组并过滤非字符串与空串', () => {
    storage.setItem(SIGNIN_STORAGE_KEY, JSON.stringify(['2026-11-01', 1, '', null, '2026-11-02']))
    expect(getSigninDates()).toEqual(['2026-11-01', '2026-11-02'])
  })

  it('JSON 损坏时告警并返回空数组', () => {
    storage.setItem(SIGNIN_STORAGE_KEY, '{bad')
    expect(getSigninDates()).toEqual([])
    expect(logMock.w).toHaveBeenCalledWith('读取打卡记录失败:', expect.any(Error))
  })

  it('非数组 JSON 返回空数组', () => {
    storage.setItem(SIGNIN_STORAGE_KEY, JSON.stringify({ dates: ['2026-11-01'] }))
    expect(getSigninDates()).toEqual([])
  })
})

describe('saveSigninDates', () => {
  it('去重排序后写回', () => {
    saveSigninDates(['2026-11-03', '2026-11-01', '2026-11-03', '2026-11-02'])
    expect(JSON.parse(storage.getItem(SIGNIN_STORAGE_KEY)!)).toEqual([
      '2026-11-01',
      '2026-11-02',
      '2026-11-03',
    ])
  })

  it('过滤非字符串与空串', () => {
    saveSigninDates(['2026-11-01', 42 as any, '', null as any])
    expect(JSON.parse(storage.getItem(SIGNIN_STORAGE_KEY)!)).toEqual(['2026-11-01'])
  })

  it('存储异常时记录错误日志且不抛出', () => {
    storage.setItem.mockImplementationOnce(() => {
      throw new Error('quota')
    })
    expect(() => saveSigninDates(['2026-11-01'])).not.toThrow()
    expect(logMock.e).toHaveBeenCalledWith('保存打卡记录失败:', expect.any(Error))
  })
})

describe('collectSigninSync', () => {
  it('无记录返回 null', () => {
    expect(collectSigninSync()).toBeNull()
  })

  it('返回日期副本', () => {
    storage.setItem(SIGNIN_STORAGE_KEY, JSON.stringify(['2026-11-01', '2026-11-02']))
    const payload = collectSigninSync()
    expect(payload).toEqual({ dates: ['2026-11-01', '2026-11-02'] })
    payload!.dates.push('2030-01-01')
    expect(getSigninDates()).toHaveLength(2)
  })
})

describe('restoreSigninSync', () => {
  it('并集合并并返回新增天数', () => {
    storage.setItem(SIGNIN_STORAGE_KEY, JSON.stringify(['2026-11-01']))

    const added = restoreSigninSync({ dates: ['2026-11-03', '2026-11-01', '2026-11-02'] } as any)

    expect(added).toBe(2)
    expect(getSigninDates()).toEqual(['2026-11-01', '2026-11-02', '2026-11-03'])
  })

  it('远端自身重复只计一次新增', () => {
    const added = restoreSigninSync({ dates: ['2026-11-01', '2026-11-01'] } as any)
    expect(added).toBe(1)
    expect(getSigninDates()).toEqual(['2026-11-01'])
  })

  it('无新增时不写存储', () => {
    storage.setItem(SIGNIN_STORAGE_KEY, JSON.stringify(['2026-11-01']))
    storage.setItem.mockClear()

    expect(restoreSigninSync({ dates: ['2026-11-01'] } as any)).toBe(0)
    expect(storage.setItem).not.toHaveBeenCalled()
  })

  it('缺省 dates 时返回 0', () => {
    expect(restoreSigninSync({} as any)).toBe(0)
    expect(restoreSigninSync(undefined as any)).toBe(0)
  })
})
