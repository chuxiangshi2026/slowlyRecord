/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// Mock uni API（打卡记录走 uni.getStorageSync / uni.setStorageSync）
const mockStorage = new Map<string, any>()
;(global as any).uni = {
  setStorageSync: vi.fn((key: string, data: any) => { mockStorage.set(key, data) }),
  getStorageSync: vi.fn((key: string) => mockStorage.get(key) ?? null),
  removeStorageSync: vi.fn((key: string) => { mockStorage.delete(key) }),
}

import { useSignin } from './useSignin'

const SIGNIN_KEY = 'signin_records'

describe('useSignin 同步（collectSync / restoreSync）', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockStorage.clear()
  })

  it('collectSync 无数据时应返回 null', () => {
    const store = useSignin()
    expect(store.collectSync()).toBeNull()
  })

  it('collectSync 应收集本地打卡日期', () => {
    mockStorage.set(SIGNIN_KEY, JSON.stringify(['2026-09-01', '2026-09-02']))
    const store = useSignin()
    expect(store.collectSync()).toEqual({ dates: ['2026-09-01', '2026-09-02'] })
  })

  it('restoreSync 应与本地记录取并集后写回', () => {
    mockStorage.set(SIGNIN_KEY, JSON.stringify(['2026-09-01', '2026-09-03']))
    const store = useSignin()

    const added = store.restoreSync({ dates: ['2026-09-02', '2026-09-03'] })

    expect(added).toBe(1)
    expect(store.signedDates).toEqual(['2026-09-01', '2026-09-02', '2026-09-03'])
    // 持久化结果同样为并集
    expect(JSON.parse(mockStorage.get(SIGNIN_KEY))).toEqual(['2026-09-01', '2026-09-02', '2026-09-03'])
  })

  it('restoreSync 远端日期全部重复时不写回并返回 0', () => {
    mockStorage.set(SIGNIN_KEY, JSON.stringify(['2026-09-01']))
    const store = useSignin()

    const added = store.restoreSync({ dates: ['2026-09-01'] })

    expect(added).toBe(0)
    expect(mockStorage.get(SIGNIN_KEY)).toBe(JSON.stringify(['2026-09-01']))
  })
})
