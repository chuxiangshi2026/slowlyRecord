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

import { usePhoneticMemory } from './usePhoneticMemory'
import { ALL_PHONEMES } from '@/utils/phoneme-data'
import type { PhoneticProgressDoc } from './useUtils/types'

const DOC_ID = 'phonetic_memory_progress'
const IPA_A = ALL_PHONEMES[0].ipa
const IPA_B = ALL_PHONEMES[1].ipa
const IPA_C = ALL_PHONEMES[2].ipa

function putDoc(doc: Partial<PhoneticProgressDoc>): void {
  getDbAdapter().put({
    _id: DOC_ID,
    _rev: '1-abc',
    phonemes: {},
    pairs: {},
    ...doc,
  } as PhoneticProgressDoc)
}

describe('usePhoneticMemory（移动端）', () => {
  beforeEach(() => {
    mockStorage.clear()
    setActivePinia(createPinia())
    setDbAdapter(new MiniProgramDbAdapter())
  })

  afterEach(() => {
    resetDbAdapter()
  })

  it('ensureLoaded：无文档时为空进度，且幂等不再读库', async () => {
    const store = usePhoneticMemory()
    expect(store.loaded).toBe(false)
    await store.ensureLoaded()
    expect(store.loaded).toBe(true)
    expect(store.doc.phonemes).toEqual({})
    expect(store.doc.pairs).toEqual({})

    // 首次加载后再写库，不会重新读取
    putDoc({ phonemes: { [IPA_A]: { ipa: IPA_A, level: 3, learnDate: 1, correct: 1, wrong: 0 } } })
    await store.ensureLoaded()
    expect(store.doc.phonemes).toEqual({})
  })

  it('ensureLoaded：读回已有文档并补齐缺失的 pairs', async () => {
    putDoc({ phonemes: { [IPA_A]: { ipa: IPA_A, level: 3, learnDate: 1, correct: 1, wrong: 0 } } })
    const store = usePhoneticMemory()
    await store.ensureLoaded()
    expect(store.getPhonemeProgress(IPA_A)?.level).toBe(3)
    expect(store.doc.pairs).toEqual({})
  })

  it('markPhoneme：答对升级、答错降级，并记录次数', async () => {
    const store = usePhoneticMemory()
    await store.ensureLoaded()

    store.markPhoneme(IPA_A, true)
    expect(store.getPhonemeProgress(IPA_A)).toMatchObject({ level: 1, correct: 1, wrong: 0 })
    expect(store.getPhonemeProgress(IPA_A)!.learnDate).toBeGreaterThan(0)

    store.markPhoneme(IPA_B, false)
    expect(store.getPhonemeProgress(IPA_B)).toMatchObject({ level: 0, correct: 0, wrong: 1 })
  })

  it('markPhoneme：等级限制在 0-12', async () => {
    putDoc({ phonemes: { [IPA_A]: { ipa: IPA_A, level: 12, learnDate: 1, correct: 0, wrong: 0 } } })
    const store = usePhoneticMemory()
    await store.ensureLoaded()

    store.markPhoneme(IPA_A, true)
    expect(store.getPhonemeProgress(IPA_A)!.level).toBe(12)

    store.markPhoneme(IPA_A, false)
    expect(store.getPhonemeProgress(IPA_A)!.level).toBe(11)
    store.markPhoneme(IPA_A, false)
    expect(store.getPhonemeProgress(IPA_A)!.level).toBe(10)
  })

  it('markPhoneme 持久化：新实例可读回', async () => {
    const store = usePhoneticMemory()
    await store.ensureLoaded()
    store.markPhoneme(IPA_A, true)

    setActivePinia(createPinia())
    const store2 = usePhoneticMemory()
    await store2.ensureLoaded()
    expect(store2.getPhonemeProgress(IPA_A)).toMatchObject({ level: 1, correct: 1 })
  })

  it('masteredCount：level >= 7 视为已掌握', async () => {
    putDoc({
      phonemes: {
        [IPA_A]: { ipa: IPA_A, level: 7, learnDate: 1, correct: 0, wrong: 0 },
        [IPA_B]: { ipa: IPA_B, level: 6, learnDate: 1, correct: 0, wrong: 0 },
      },
    })
    const store = usePhoneticMemory()
    await store.ensureLoaded()
    expect(store.masteredCount).toBe(1)
  })

  it('dueCount：未学过与到期计入，未到期不计入', async () => {
    const now = Date.now()
    putDoc({
      phonemes: {
        // 0 级间隔 1 分钟，2 分钟前学过 → 到期
        [IPA_A]: { ipa: IPA_A, level: 0, learnDate: now - 2 * 60 * 1000, correct: 0, wrong: 0 },
        // 5 级间隔 24 小时，刚学过 → 未到期
        [IPA_B]: { ipa: IPA_B, level: 5, learnDate: now, correct: 0, wrong: 0 },
      },
    })
    const store = usePhoneticMemory()
    await store.ensureLoaded()
    expect(store.dueCount).toBe(ALL_PHONEMES.length - 1)
  })

  it('pickPhonemesForSession：到期 → 未学 → 其他，按 count 截断', async () => {
    const now = Date.now()
    putDoc({
      phonemes: {
        [IPA_A]: { ipa: IPA_A, level: 0, learnDate: now - 2 * 60 * 1000, correct: 0, wrong: 0 },
        [IPA_B]: { ipa: IPA_B, level: 5, learnDate: now, correct: 0, wrong: 0 },
      },
    })
    const store = usePhoneticMemory()
    await store.ensureLoaded()

    const first = store.pickPhonemesForSession(1)
    expect(first.map(p => p.ipa)).toEqual([IPA_A])

    const three = store.pickPhonemesForSession(3).map(p => p.ipa)
    expect(three[0]).toBe(IPA_A)
    expect(three).not.toContain(IPA_B)

    expect(store.pickPhonemesForSession(ALL_PHONEMES.length + 10)).toHaveLength(ALL_PHONEMES.length)
  })

  it('对子进度：key 与顺序无关，答对/答错计数独立', async () => {
    const store = usePhoneticMemory()
    await store.ensureLoaded()

    store.markPair('i', 'ɪ', true)
    const key = 'i|ɪ'
    expect(store.getPairProgress('i', 'ɪ')).toMatchObject({ pairKey: key, level: 1, correct: 1 })
    expect(store.getPairProgress('ɪ', 'i')).toEqual(store.getPairProgress('i', 'ɪ'))

    store.markPair('ɪ', 'i', false)
    expect(store.getPairProgress('i', 'ɪ')).toMatchObject({ level: 0, correct: 1, wrong: 1 })
  })

  it('pickPairsForSession：到期优先，未到期不抽', async () => {
    const now = Date.now()
    putDoc({
      pairs: {
        'a|b': { pairKey: 'a|b', level: 0, learnDate: now - 2 * 60 * 1000, correct: 0, wrong: 0 },
        'c|d': { pairKey: 'c|d', level: 5, learnDate: now, correct: 0, wrong: 0 },
      },
    })
    const store = usePhoneticMemory()
    await store.ensureLoaded()

    const pool = [{ a: 'a', b: 'b' }, { a: 'c', b: 'd' }, { a: 'e', b: 'f' }]
    expect(store.pickPairsForSession(pool, 1)).toEqual([{ a: 'a', b: 'b' }])
    expect(store.pickPairsForSession(pool, 2)).toHaveLength(2)
    expect(store.pickPairsForSession(pool, 2)).not.toContainEqual({ a: 'c', b: 'd' })
  })

  it('collectSync：空数据返回 null，有进度返回引用', async () => {
    const store = usePhoneticMemory()
    await store.ensureLoaded()
    expect(store.collectSync()).toBeNull()

    store.markPhoneme(IPA_A, true)
    store.markPair('a', 'b', true)
    const data = store.collectSync()!
    expect(Object.keys(data.phonemes)).toEqual([IPA_A])
    expect(Object.keys(data.pairs)).toEqual(['a|b'])
  })

  it('restoreSync：按 learnDate 新者保留，返回并入条数并持久化', async () => {
    putDoc({
      phonemes: { [IPA_A]: { ipa: IPA_A, level: 9, learnDate: 300, correct: 0, wrong: 0 } },
    })
    const store = usePhoneticMemory()
    await store.ensureLoaded()

    const merged = store.restoreSync({
      phonemes: {
        // 本地更新 → 保留本地
        [IPA_A]: { ipa: IPA_A, level: 2, learnDate: 100, correct: 0, wrong: 0 },
        // 远端较新 → 覆盖
        [IPA_B]: { ipa: IPA_B, level: 4, learnDate: 500, correct: 1, wrong: 0 },
      },
      pairs: {
        // 本地不存在 → 新增
        'x|y': { pairKey: 'x|y', level: 3, learnDate: 400, correct: 0, wrong: 0 },
      },
    })
    expect(merged).toBe(2)
    expect(store.getPhonemeProgress(IPA_A)!.level).toBe(9)
    expect(store.getPhonemeProgress(IPA_B)!.level).toBe(4)
    expect(store.getPairProgress('x', 'y')!.level).toBe(3)

    setActivePinia(createPinia())
    const store2 = usePhoneticMemory()
    await store2.ensureLoaded()
    expect(store2.getPhonemeProgress(IPA_B)!.level).toBe(4)
  })

  it('restoreSync：无更新时不写库', async () => {
    putDoc({
      phonemes: { [IPA_C]: { ipa: IPA_C, level: 5, learnDate: 999, correct: 0, wrong: 0 } },
    })
    const store = usePhoneticMemory()
    await store.ensureLoaded()
    const putSpy = vi.spyOn(getDbAdapter(), 'put')

    expect(store.restoreSync({
      phonemes: { [IPA_C]: { ipa: IPA_C, level: 1, learnDate: 1, correct: 0, wrong: 0 } },
      pairs: {},
    })).toBe(0)
    expect(putSpy).not.toHaveBeenCalled()
  })
})
