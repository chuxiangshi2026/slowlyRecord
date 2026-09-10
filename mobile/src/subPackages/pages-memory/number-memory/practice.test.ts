/**
 * 数字记忆自测抽题逻辑测试
 */
import { describe, it, expect } from 'vitest'
import {
  ROUND_SIZE,
  pegNumbersOfRange,
  pickPegQuestion,
  pickEntryQuestion,
  summarizeRound,
} from './practice'
import { isPracticeDue } from '../../../utils/practice-srs'
import type { MobileNumberAssociation, MobileNumberEntry } from '@/stores/useUtils/types'

/** 确定性 rng：始终取第一个 */
const firstRng = () => 0
/** 确定性 rng：始终取最后一个 */
const lastRng = () => 0.999999

function makeAssoc(number: string, nextReview?: number): MobileNumberAssociation {
  return { number, type: 'text', description: `桩${number}`, source: 'user', nextReview }
}

function makeEntry(id: string, nextReview?: number): MobileNumberEntry {
  return {
    _id: id,
    title: `条目${id}`,
    numbers: '123456',
    tags: [],
    createdAt: 0,
    updatedAt: 0,
    reviewCount: 0,
    nextReview,
  }
}

describe('范围过滤', () => {
  it('0-9 补零为两位数，共 10 个', () => {
    const nums = pegNumbersOfRange('single')
    expect(nums).toHaveLength(10)
    expect(nums[0]).toBe('00')
    expect(nums[9]).toBe('09')
  })

  it('10-99 共 90 个，全部共 100 个', () => {
    expect(pegNumbersOfRange('double')).toHaveLength(90)
    expect(pegNumbersOfRange('all')).toHaveLength(100)
  })
})

describe('数字桩抽题', () => {
  const assocs = [
    makeAssoc('00'),
    makeAssoc('05', Date.now() + 99999999), // 未到期
    makeAssoc('12'),
    makeAssoc('88'),
  ]

  it('空列表返回 null', () => {
    expect(pickPegQuestion([], 'all', new Set(), firstRng)).toBeNull()
  })

  it('按范围过滤', () => {
    const q = pickPegQuestion(assocs, 'single', new Set(), firstRng)
    expect(q).not.toBeNull()
    expect(['00', '05']).toContain(q!.number)
  })

  it('到期优先：范围内有到期桩时不抽未到期桩', () => {
    const dueOnly = [makeAssoc('05', Date.now() + 99999999), makeAssoc('12')]
    for (let i = 0; i < 20; i++) {
      const q = pickPegQuestion(dueOnly, 'all', new Set(), Math.random)
      expect(q!.number).toBe('12')
    }
  })

  it('排除本轮已抽过的，抽完才允许重复', () => {
    const picked = pickPegQuestion(assocs, 'all', new Set(['00', '05', '12', '88']), firstRng)
    // exclude 覆盖全部候选后回退为范围内重抽
    expect(picked).not.toBeNull()
    expect(['00', '05', '12', '88']).toContain(picked!.number)
  })
})

describe('条目抽题', () => {
  const entries = [makeEntry('a'), makeEntry('b'), makeEntry('c', Date.now() + 99999999)]

  it('空列表返回 null', () => {
    expect(pickEntryQuestion([], new Set(), firstRng)).toBeNull()
  })

  it('到期优先', () => {
    for (let i = 0; i < 20; i++) {
      const q = pickEntryQuestion(entries, new Set(), Math.random)
      expect(['a', 'b']).toContain(q!._id)
    }
  })

  it('排除已抽过的', () => {
    const q = pickEntryQuestion(entries, new Set(['a', 'b']), lastRng)
    expect(q!._id).toBe('c')
  })
})

describe('一轮小结', () => {
  it('统计想起来/没想起来数量', () => {
    expect(summarizeRound([true, true, false])).toEqual({
      total: 3,
      remembered: 2,
      forgotten: 1,
    })
    expect(summarizeRound([])).toEqual({ total: 0, remembered: 0, forgotten: 0 })
  })

  it('一轮题数为 10', () => {
    expect(ROUND_SIZE).toBe(10)
  })
})

describe('抽题结果与 SRS 到期口径一致', () => {
  it('从未复习（无 nextReview）的桩视为到期', () => {
    const q = pickPegQuestion([makeAssoc('07')], 'single', new Set(), firstRng)
    expect(q!.number).toBe('07')
    expect(isPracticeDue(q!.nextReview)).toBe(true)
  })
})
