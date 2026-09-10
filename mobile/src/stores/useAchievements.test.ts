/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { setDbAdapter, resetDbAdapter, type DbAdapter } from '@/adapters/index'

// Mock uni API（成就解锁状态与「曾有错题」标记走 uni storage）
const mockStorage = new Map<string, any>()
;(global as any).uni = {
  setStorageSync: vi.fn((key: string, data: any) => { mockStorage.set(key, data) }),
  getStorageSync: vi.fn((key: string) => mockStorage.get(key) ?? null),
  removeStorageSync: vi.fn((key: string) => { mockStorage.delete(key) }),
  getStorageInfoSync: vi.fn(() => ({ keys: [] })),
  showToast: vi.fn(),
}

import { useAchievements, ACHIEVEMENTS_STORAGE_KEY } from './useAchievements'
import { useSignin } from './useSignin'
import { useMobileWords } from './useMobileWords'

const SIGNIN_KEY = 'signin_records'
const EVER_WRONG_KEY = 'slowlyrecord-achievements-everwrong'

/** 最小 DbAdapter：内存 Map 实现，可预置 bank 级单词记录 */
function createDb(seed: Record<string, any> = {}): DbAdapter {
  const store = new Map<string, any>(Object.entries(seed))
  return {
    get: vi.fn((id: string) => store.get(id) || null),
    put: vi.fn(() => ({ ok: true })),
    remove: vi.fn(() => ({ ok: true })),
    allDocs: vi.fn(() => []),
    promises: {
      asyncPut: vi.fn(async () => ({ ok: true })),
      asyncRemove: vi.fn(async () => ({ ok: true })),
    },
  } as unknown as DbAdapter
}

/** 预置当前词库的单词（bank_default_words 记录） */
function seedWords(words: any[]) {
  setDbAdapter(createDb({ bank_default_words: { _id: 'bank_default_words', data: words } }))
}

function seedSigninDates(dates: string[]) {
  mockStorage.set(SIGNIN_KEY, JSON.stringify(dates))
}

describe('useAchievements', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockStorage.clear()
    setDbAdapter(createDb())
  })

  // vi.mock 不可用于模块内 mock，这里用 resetDbAdapter 兜底清理
  afterEach(() => {
    resetDbAdapter()
  })

  it('无任何数据时不解锁任何成就', async () => {
    const store = useAchievements()
    const unlocked = await store.checkNow()
    expect(unlocked).toEqual([])
    expect(store.unlockedCount).toBe(0)
    expect(store.totalCount).toBe(9)
  })

  it('连续打卡 3 天应解锁「初露头角」并带时间戳落盘', async () => {
    const today = new Date()
    const fmt = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const dates = [0, 1, 2].map(i => { const d = new Date(today); d.setDate(d.getDate() - i); return fmt(d) })
    seedSigninDates(dates)

    const store = useAchievements()
    const unlocked = await store.checkNow()

    expect(unlocked.map(a => a.id)).toEqual(['streak-3'])
    expect(store.isUnlocked('streak-3')).toBe(true)
    const saved = JSON.parse(mockStorage.get(ACHIEVEMENTS_STORAGE_KEY))
    expect(saved['streak-3']).toBeGreaterThan(0)
  })

  it('同一成就不重复解锁', async () => {
    const today = new Date()
    const fmt = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    seedSigninDates([0, 1, 2].map(i => { const d = new Date(today); d.setDate(d.getDate() - i); return fmt(d) }))

    const store = useAchievements()
    await store.checkNow()
    const second = await store.checkNow()
    expect(second).toEqual([])
    expect(store.unlockedCount).toBe(1)
  })

  it('「曾有错题」标记在观察到错题时置位，清零后解锁错题清零成就', async () => {
    // 一个复习过但仍 1 级的词 = 错题
    seedWords([{
      id: 'w1', word: 'hello', meaning: '你好', addTime: Date.now(),
      reviewCount: 1, nextReviewTime: Date.now(), level: 1,
    }])

    const store = useAchievements()
    // 有错时：不解锁，但标记置位
    expect((await store.checkNow()).map(a => a.id)).toEqual([])
    expect(mockStorage.get(EVER_WRONG_KEY)).toBe(true)

    // 清空错题后：解锁「错题清零」
    seedWords([])
    await useMobileWords().reloadWords()
    const unlocked = await store.checkNow()
    expect(unlocked.map(a => a.id)).toEqual(['wrong-cleared'])
  })

  it('全部单词满级时解锁「首库告捷」', async () => {
    seedWords([{
      id: 'w1', word: 'a', meaning: '一', addTime: Date.now(),
      reviewCount: 5, nextReviewTime: Date.now(), level: 12,
    }])
    const store = useAchievements()
    const unlocked = await store.checkNow()
    expect(unlocked.map(a => a.id)).toEqual(['bank-mastered'])
  })
})
