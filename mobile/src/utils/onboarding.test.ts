import { describe, it, expect } from 'vitest'
import {
  resolveOnboarded,
  ONBOARDED_STORAGE_KEY,
  RECOMMENDED_BANKS,
  STARTER_WORD_COUNT,
} from './onboarding'
import { STARTER_BANKS } from './onboarding-starter-banks'
import { WORDBANK_LIST } from '@/stores/useUtils/wordbank'

describe('resolveOnboarded', () => {
  it("'1' 或 1 视为已引导", () => {
    expect(resolveOnboarded('1')).toBe(true)
    expect(resolveOnboarded(1)).toBe(true)
  })

  it('缺失、空串、其他值一律视为未引导', () => {
    expect(resolveOnboarded(undefined)).toBe(false)
    expect(resolveOnboarded(null)).toBe(false)
    expect(resolveOnboarded('')).toBe(false)
    expect(resolveOnboarded('0')).toBe(false)
    expect(resolveOnboarded(0)).toBe(false)
    expect(resolveOnboarded('true')).toBe(false)
  })
})

describe('引导标记 storage key', () => {
  it('key 为 slowlyrecord-onboarded，值为 1', () => {
    expect(ONBOARDED_STORAGE_KEY).toBe('slowlyrecord-onboarded')
  })
})

describe('RECOMMENDED_BANKS 推荐词库清单', () => {
  it('包含 2~3 个推荐词库，sourceId 不重复', () => {
    expect(RECOMMENDED_BANKS.length).toBeGreaterThanOrEqual(2)
    expect(RECOMMENDED_BANKS.length).toBeLessThanOrEqual(3)
    const ids = RECOMMENDED_BANKS.map(b => b.sourceId)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('每个 sourceId 都存在于内置词库元数据 WORDBANK_LIST', () => {
    const knownIds = new Set(WORDBANK_LIST.map(w => w.id))
    for (const bank of RECOMMENDED_BANKS) {
      expect(knownIds.has(bank.sourceId as any), bank.sourceId).toBe(true)
    }
  })

  it('名称、emoji、描述均为非空', () => {
    for (const bank of RECOMMENDED_BANKS) {
      expect(bank.name.length).toBeGreaterThan(0)
      expect(bank.emoji.length).toBeGreaterThan(0)
      expect(bank.desc.length).toBeGreaterThan(0)
    }
  })
})

describe('STARTER_BANKS 起步词库数据', () => {
  it('覆盖全部推荐词库，每个词库恰为 STARTER_WORD_COUNT 词', () => {
    for (const bank of RECOMMENDED_BANKS) {
      const words = STARTER_BANKS[bank.sourceId]
      expect(words, bank.sourceId).toBeTruthy()
      expect(words.length).toBe(STARTER_WORD_COUNT)
    }
  })

  it('每条数据都有 word 与释义（meaning 或 explains），word 不重复', () => {
    for (const bank of RECOMMENDED_BANKS) {
      const words = STARTER_BANKS[bank.sourceId]
      const seen = new Set<string>()
      for (const w of words) {
        expect(w.word.length).toBeGreaterThan(0)
        expect((w.meaning || w.explains || '').length).toBeGreaterThan(0)
        expect(seen.has(w.word)).toBe(false)
        seen.add(w.word)
      }
    }
  })
})
