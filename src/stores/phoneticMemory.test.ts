/**
 * 音标学习 store 测试（桌面端）。
 *
 * 语言数据集、激活语言与进度 DB 均 mock，验证：
 * 幂等加载与语言切换、掌握/到期统计、抽题优先级、音素与最小对子的
 * 等级增减/计数/持久化。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import type { PhoneticProgressDoc } from '@/types/phonetic-memory'

const env = vi.hoisted(() => ({
  language: 'en',
  datasets: {} as Record<string, any>,
  docs: {} as Record<string, PhoneticProgressDoc>,
  saves: [] as Array<{ doc: PhoneticProgressDoc; lang: string }>,
}))

vi.mock('@/utils/language/profiles', () => ({ getActiveLanguage: () => env.language }))
vi.mock('@/utils/language/phonetics', () => ({ getPhoneticDataset: (lang: string) => env.datasets[lang] ?? { all: [] } }))
vi.mock('@/utils/phonetic-memory-db', () => ({
  getProgressDoc: (lang: string) => env.docs[lang] ?? { _id: '', phonemes: {}, pairs: {} },
  saveProgressDoc: vi.fn(async (doc: PhoneticProgressDoc, lang: string) => {
    env.docs[lang] = doc
    env.saves.push({ doc, lang })
  }),
}))

import { usePhoneticMemoryStore } from './phoneticMemory'
import { DEFAULT_INTERVALS } from '@/constants'

const MINUTE = 60 * 1000

function emptyDoc(): PhoneticProgressDoc {
  return { _id: '', phonemes: {}, pairs: {} }
}

function phoneme(ipa: string) {
  return { ipa } as any
}

beforeEach(() => {
  setActivePinia(createPinia())
  env.language = 'en'
  env.datasets = {
    en: { all: [phoneme('iː'), phoneme('ɪ'), phoneme('æ')] },
    ja: { all: [phoneme('a'), phoneme('i')] },
  }
  env.docs = {}
  env.saves = []
})

describe('常量', () => {
  it('掌握阈值为 7，最大等级取 12 与间隔表长度的较小值', () => {
    const store = usePhoneticMemoryStore()
    expect(store.MASTERED_LEVEL).toBe(7)
    expect(store.MAX_LEVEL).toBe(Math.min(12, DEFAULT_INTERVALS.length - 1))
  })
})

describe('ensureLoaded', () => {
  it('首次加载当前语言进度，重复调用幂等', async () => {
    env.docs.en = {
      _id: 'en',
      phonemes: { 'iː': { ipa: 'iː', level: 2, learnDate: 1, correct: 1, wrong: 0 } },
      pairs: {},
    }
    const store = usePhoneticMemoryStore()
    await store.ensureLoaded()
    expect(store.loaded).toBe(true)
    expect(store.language).toBe('en')
    expect(store.getPhonemeProgress('iː')?.level).toBe(2)

    // 未切换语言时不再重读 DB：替换底层文档后仍保持旧进度
    env.docs.en = { _id: 'en', phonemes: { x: { ipa: 'x', level: 1, learnDate: 1, correct: 0, wrong: 0 } }, pairs: {} }
    await store.ensureLoaded()
    expect(store.getPhonemeProgress('x')).toBeUndefined()
  })

  it('切换激活语言后重新加载对应进度', async () => {
    env.docs.ja = { _id: 'ja', phonemes: { a: { ipa: 'a', level: 3, learnDate: 1, correct: 0, wrong: 0 } }, pairs: {} }
    const store = usePhoneticMemoryStore()
    await store.ensureLoaded()
    env.language = 'ja'
    await store.ensureLoaded()
    expect(store.language).toBe('ja')
    expect(store.dataset.all.map((p: any) => p.ipa)).toEqual(['a', 'i'])
    expect(store.getPhonemeProgress('a')?.level).toBe(3)
  })

  it('读取进度失败时回退为空文档且不抛出', async () => {
    const store = usePhoneticMemoryStore()
    const original = env.docs
    Object.defineProperty(env, 'docs', {
      configurable: true,
      get() {
        throw new Error('db broken')
      },
    })
    await expect(store.ensureLoaded()).resolves.toBeUndefined()
    expect(store.loaded).toBe(true)
    expect(store.doc).toEqual(emptyDoc())
    Object.defineProperty(env, 'docs', { configurable: true, writable: true, value: original })
  })
})

describe('统计', () => {
  it('masteredCount 只统计 level >= 7 的音素', async () => {
    env.docs.en = {
      _id: 'en',
      phonemes: {
        'iː': { ipa: 'iː', level: 7, learnDate: 1, correct: 0, wrong: 0 },
        'ɪ': { ipa: 'ɪ', level: 6, learnDate: 1, correct: 0, wrong: 0 },
        'æ': { ipa: 'æ', level: 12, learnDate: 1, correct: 0, wrong: 0 },
      },
      pairs: {},
    }
    const store = usePhoneticMemoryStore()
    await store.ensureLoaded()
    expect(store.masteredCount).toBe(2)
  })

  it('dueCount 把未学过、已到期算待练，未到期不算', async () => {
    const now = Date.now()
    env.docs.en = {
      _id: 'en',
      phonemes: {
        'iː': { ipa: 'iː', level: 0, learnDate: now - 30 * 1000, correct: 0, wrong: 0 },
        'ɪ': { ipa: 'ɪ', level: 0, learnDate: now - 2 * MINUTE, correct: 0, wrong: 0 },
      },
      pairs: {},
    }
    const store = usePhoneticMemoryStore()
    await store.ensureLoaded()
    // iː 未到期；ɪ 已到期；æ 未学过
    expect(store.dueCount).toBe(2)
  })

  it('learnDate 为 0 视为未学过（待练）', async () => {
    env.docs.en = {
      _id: 'en',
      phonemes: { 'iː': { ipa: 'iː', level: 3, learnDate: 0, correct: 0, wrong: 0 } },
      pairs: {},
    }
    const store = usePhoneticMemoryStore()
    await store.ensureLoaded()
    // iː 待练 + ɪ、æ 未学过
    expect(store.dueCount).toBe(3)
  })
})

describe('pickPhonemesForSession', () => {
  it('按「到期 > 未学 > 其他」优先级抽取并截断数量', async () => {
    const now = Date.now()
    env.docs.en = {
      _id: 'en',
      phonemes: {
        'iː': { ipa: 'iː', level: 0, learnDate: now - 10 * MINUTE, correct: 0, wrong: 0 },
        'ɪ': { ipa: 'ɪ', level: 5, learnDate: now, correct: 0, wrong: 0 },
      },
      pairs: {},
    }
    const store = usePhoneticMemoryStore()
    await store.ensureLoaded()

    const picked = store.pickPhonemesForSession(2)
    expect(picked.map(p => p.ipa)).toEqual(['iː', 'æ'])
  })

  it('数量超过可用音素时返回全部', async () => {
    const store = usePhoneticMemoryStore()
    await store.ensureLoaded()
    expect(store.pickPhonemesForSession(10)).toHaveLength(3)
  })
})

describe('markPhoneme', () => {
  it('答对升 1 级并累计 correct，保存到当前语言', async () => {
    const store = usePhoneticMemoryStore()
    await store.markPhoneme('iː', true)
    expect(store.getPhonemeProgress('iː')).toMatchObject({ ipa: 'iː', level: 1, correct: 1, wrong: 0 })
    expect(env.saves).toHaveLength(1)
    expect(env.saves[0].lang).toBe('en')
    expect(env.docs.en.phonemes['iː'].level).toBe(1)
  })

  it('答错降 1 级、下限 0，并累计 wrong', async () => {
    env.docs.en = {
      _id: 'en',
      phonemes: { 'iː': { ipa: 'iː', level: 0, learnDate: 1, correct: 2, wrong: 1 } },
      pairs: {},
    }
    const store = usePhoneticMemoryStore()
    await store.markPhoneme('iː', false)
    expect(store.getPhonemeProgress('iː')).toMatchObject({ level: 0, correct: 2, wrong: 2 })
  })

  it('等级封顶 MAX_LEVEL，不会超过 12', async () => {
    env.docs.en = {
      _id: 'en',
      phonemes: { 'iː': { ipa: 'iː', level: 12, learnDate: 1, correct: 0, wrong: 0 } },
      pairs: {},
    }
    const store = usePhoneticMemoryStore()
    await store.markPhoneme('iː', true)
    expect(store.getPhonemeProgress('iː')?.level).toBe(12)
  })
})

describe('最小对子', () => {
  it('pair 进度按排序后的 key 存取，参数顺序无关', async () => {
    const store = usePhoneticMemoryStore()
    await store.markPair('b', 'a', true)
    expect(store.getPairProgress('a', 'b')).toMatchObject({ pairKey: 'a|b', level: 1, correct: 1 })
    expect(store.getPairProgress('b', 'a')).toEqual(store.getPairProgress('a', 'b'))
  })

  it('答错降级、下限 0，并累计 wrong', async () => {
    env.docs.en = {
      _id: 'en',
      phonemes: {},
      pairs: { 'a|b': { pairKey: 'a|b', level: 0, learnDate: 1, correct: 0, wrong: 3 } },
    }
    const store = usePhoneticMemoryStore()
    await store.markPair('b', 'a', false)
    expect(store.getPairProgress('a', 'b')).toMatchObject({ level: 0, wrong: 4 })
  })

  it('pickPairsForSession 按「到期 > 未练 > 其他」优先级抽取', async () => {
    const now = Date.now()
    env.docs.en = {
      _id: 'en',
      phonemes: {},
      pairs: {
        'a|b': { pairKey: 'a|b', level: 0, learnDate: now - 10 * MINUTE, correct: 0, wrong: 0 },
        'a|c': { pairKey: 'a|c', level: 3, learnDate: now, correct: 0, wrong: 0 },
      },
    }
    const store = usePhoneticMemoryStore()
    await store.ensureLoaded()
    const pool = [
      { a: 'a', b: 'b' },
      { a: 'c', b: 'a' },
      { a: 'd', b: 'a' },
    ]
    const picked = store.pickPairsForSession(pool, 2)
    expect(picked.map(p => `${p.a}|${p.b}`)).toEqual(['a|b', 'd|a'])
  })
})
