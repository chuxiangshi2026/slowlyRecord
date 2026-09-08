import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock uni 本地存储（与 useSignin.test.ts 同一惯例）
const mockStorage = new Map<string, any>()
;(global as any).uni = {
  setStorageSync: vi.fn((key: string, data: any) => { mockStorage.set(key, data) }),
  getStorageSync: vi.fn((key: string) => mockStorage.get(key) ?? null),
  removeStorageSync: vi.fn((key: string) => { mockStorage.delete(key) }),
}

import {
  SUBSCRIBE_STORAGE_KEY,
  getSubscribeRecord,
  recordSubscribeSuccess,
  clearSubscribeRecord,
} from './subscribe-remind'

describe('subscribe-remind 授权记录存取', () => {
  beforeEach(() => {
    mockStorage.clear()
  })

  it('无记录时返回空记录', () => {
    expect(getSubscribeRecord()).toEqual({ times: 0, lastTime: 0 })
  })

  it('记录一次授权：次数 +1 且写入最近一次时间', () => {
    const record = recordSubscribeSuccess(1725800000000)
    expect(record).toEqual({ times: 1, lastTime: 1725800000000 })
    // 持久化内容一致
    expect(JSON.parse(mockStorage.get(SUBSCRIBE_STORAGE_KEY))).toEqual(record)
  })

  it('多次授权累计次数并更新最近时间', () => {
    recordSubscribeSuccess(1000)
    const record = recordSubscribeSuccess(2000)
    expect(record.times).toBe(2)
    expect(record.lastTime).toBe(2000)
  })

  it('读取已持久化的记录', () => {
    recordSubscribeSuccess(3000)
    expect(getSubscribeRecord()).toEqual({ times: 1, lastTime: 3000 })
  })

  it('存储数据损坏时返回空记录而不抛错', () => {
    mockStorage.set(SUBSCRIBE_STORAGE_KEY, '{broken')
    expect(getSubscribeRecord()).toEqual({ times: 0, lastTime: 0 })
    mockStorage.set(SUBSCRIBE_STORAGE_KEY, JSON.stringify({ foo: 1 }))
    expect(getSubscribeRecord()).toEqual({ times: 0, lastTime: 0 })
  })

  it('清除记录后回到空记录', () => {
    recordSubscribeSuccess(1000)
    clearSubscribeRecord()
    expect(getSubscribeRecord()).toEqual({ times: 0, lastTime: 0 })
    expect(mockStorage.has(SUBSCRIBE_STORAGE_KEY)).toBe(false)
  })
})
