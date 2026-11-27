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

import { useLetterMemory } from './useLetterMemory'
import { LETTER_LIST, findLetterPreset } from '../utils/letter-preset'

const DOC_ID = 'letter-memory-data'

function putDoc(letters: Record<string, any>): void {
  getDbAdapter().put({ _id: DOC_ID, data: { letters, updatedAt: 1 } } as any)
}

describe('useLetterMemory（移动端）', () => {
  beforeEach(() => {
    mockStorage.clear()
    setActivePinia(createPinia())
    setDbAdapter(new MiniProgramDbAdapter())
  })

  afterEach(() => {
    resetDbAdapter()
  })

  it('ensureLoaded：空数据幂等加载', async () => {
    const store = useLetterMemory()
    expect(store.hasAnyProgress).toBe(false)
    await store.ensureLoaded()
    expect(store.hasAnyProgress).toBe(false)
    expect(store.totalLetters).toBe(LETTER_LIST.length)
    expect(store.MASTERED_LEVEL).toBe(12)

    // 已加载后不再读库
    putDoc({ a: { level: 3, learnDate: 1 } })
    await store.ensureLoaded()
    expect(store.hasAnyProgress).toBe(false)
  })

  it('getDisplay：未自定义回退预设默认，自定义优先', async () => {
    const store = useLetterMemory()
    await store.ensureLoaded()

    expect(store.getDisplay('a')).toEqual(findLetterPreset('a')!.suggestions[0])
    expect(store.getDisplay('unknown')).toBeUndefined()

    store.setMapping('a', { name: '自定义', emoji: '🅰️', description: '说明' }, 'custom')
    expect(store.getDisplay('a')).toEqual({ name: '自定义', emoji: '🅰️', description: '说明' })
  })

  it('setMapping 保留已有掌握度与 nextReview', async () => {
    const store = useLetterMemory()
    await store.ensureLoaded()

    store.setMapping('a', findLetterPreset('a')!.suggestions[0], 'preset')
    const first = store.getEntry('a')!
    expect(first).toMatchObject({ level: 0, source: 'preset' })
    expect(first.learnDate).toBeGreaterThan(0)

    store.markLetter('a', true)
    const level = store.getEntry('a')!.level
    const nextReview = store.getEntry('a')!.nextReview

    store.setMapping('a', findLetterPreset('a')!.suggestions[1], 'custom')
    expect(store.getEntry('a')).toMatchObject({ level, nextReview, source: 'custom' })
    expect(store.getEntry('a')!.name).toBe(findLetterPreset('a')!.suggestions[1].name)
  })

  it('markLetter：答对升 1 级并排下次复习，答错降 4 级下限 1', async () => {
    const store = useLetterMemory()
    await store.ensureLoaded()

    const before = Date.now()
    store.markLetter('a', true)
    const entry = store.getEntry('a')!
    expect(entry.level).toBe(1)
    expect(entry.nextReview).toBeGreaterThanOrEqual(before + 5 * 60 * 1000)
    expect(entry.learnDate).toBeGreaterThanOrEqual(before)

    // 再次答对保留首次 learnDate
    store.markLetter('a', true)
    expect(store.getEntry('a')!.level).toBe(2)
    expect(store.getEntry('a')!.learnDate).toBe(entry.learnDate)

    // 0 级答错：-4 下限 1
    store.markLetter('b', false)
    expect(store.getEntry('b')!.level).toBe(1)
  })

  it('masteredCount / dueCount / hasAnyProgress 统计', async () => {
    putDoc({
      a: { level: 12, learnDate: 1, nextReview: Date.now() + 60_000 },
      b: { level: 5, learnDate: 1, nextReview: Date.now() + 60_000 },
    })
    const store = useLetterMemory()
    await store.ensureLoaded()

    expect(store.masteredCount).toBe(1)
    // a/b 均未到期，其余字母无记录 → 到期
    expect(store.dueCount).toBe(LETTER_LIST.length - 2)
    expect(store.hasAnyProgress).toBe(true)
  })

  it('持久化：新实例可读回', async () => {
    const store = useLetterMemory()
    await store.ensureLoaded()
    store.setMapping('z', findLetterPreset('z')!.suggestions[2], 'preset')
    store.markLetter('z', true)

    setActivePinia(createPinia())
    const store2 = useLetterMemory()
    await store2.ensureLoaded()
    expect(store2.getEntry('z')).toMatchObject({ level: 1, source: 'preset' })
    expect(store2.getDisplay('z')!.name).toBe(findLetterPreset('z')!.suggestions[2].name)
  })
})
