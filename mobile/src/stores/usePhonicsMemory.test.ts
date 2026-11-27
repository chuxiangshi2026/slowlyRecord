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

import { usePhonicsMemory } from './usePhonicsMemory'
import { ALL_PHONICS_RULES } from '../utils/phonics-data'

const DOC_ID = 'phonics-memory-data'
const RULE_A = ALL_PHONICS_RULES[0].id
const RULE_B = ALL_PHONICS_RULES[1].id

function putDoc(rules: Record<string, any>): void {
  getDbAdapter().put({ _id: DOC_ID, data: { rules, updatedAt: 1 } } as any)
}

describe('usePhonicsMemory（移动端）', () => {
  beforeEach(() => {
    mockStorage.clear()
    setActivePinia(createPinia())
    setDbAdapter(new MiniProgramDbAdapter())
  })

  afterEach(() => {
    resetDbAdapter()
  })

  it('ensureLoaded：空数据幂等，暴露规则总数与掌握阈值', async () => {
    const store = usePhonicsMemory()
    await store.ensureLoaded()
    expect(store.getRuleProgress(RULE_A)).toBeUndefined()
    expect(store.totalRules).toBe(ALL_PHONICS_RULES.length)
    expect(store.MASTERED_LEVEL).toBe(12)

    putDoc({ [RULE_A]: { level: 3, learnDate: 1 } })
    await store.ensureLoaded()
    expect(store.getRuleProgress(RULE_A)).toBeUndefined()
  })

  it('markRule：答对升 1 级并排期，保留首次 learnDate', async () => {
    const store = usePhonicsMemory()
    await store.ensureLoaded()

    const before = Date.now()
    store.markRule(RULE_A, true)
    const first = store.getRuleProgress(RULE_A)!
    expect(first.level).toBe(1)
    expect(first.nextReview).toBeGreaterThanOrEqual(before + 5 * 60 * 1000)
    expect(first.learnDate).toBeGreaterThanOrEqual(before)

    store.markRule(RULE_A, true)
    expect(store.getRuleProgress(RULE_A)).toMatchObject({
      level: 2,
      learnDate: first.learnDate,
    })
  })

  it('markRule：答错降 4 级，下限 1', async () => {
    putDoc({ [RULE_A]: { level: 0, learnDate: 1, nextReview: 1 } })
    const store = usePhonicsMemory()
    await store.ensureLoaded()

    store.markRule(RULE_A, false)
    expect(store.getRuleProgress(RULE_A)!.level).toBe(1)

    store.markRule(RULE_A, false)
    expect(store.getRuleProgress(RULE_A)!.level).toBe(1)
  })

  it('masteredCount / dueCount', async () => {
    putDoc({
      [RULE_A]: { level: 12, learnDate: 1, nextReview: Date.now() + 60_000 },
      [RULE_B]: { level: 4, learnDate: 1, nextReview: 0 },
    })
    const store = usePhonicsMemory()
    await store.ensureLoaded()

    expect(store.masteredCount).toBe(1)
    expect(store.dueCount).toBe(ALL_PHONICS_RULES.length - 1)
  })

  it('持久化：新实例可读回', async () => {
    const store = usePhonicsMemory()
    await store.ensureLoaded()
    store.markRule(RULE_A, true)

    setActivePinia(createPinia())
    const store2 = usePhonicsMemory()
    await store2.ensureLoaded()
    expect(store2.getRuleProgress(RULE_A)!.level).toBe(1)
  })
})
