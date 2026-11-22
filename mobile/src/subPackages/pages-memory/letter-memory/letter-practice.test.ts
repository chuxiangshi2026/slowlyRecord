import { describe, it, expect } from 'vitest'
import { pickRoundLetters, buildRecognizeOptions, ROUND_SIZE } from './letter-practice'
import { LETTER_LIST } from '@/utils/letter-preset'

describe('pickRoundLetters', () => {
  it('默认选 10 个，全是合法字母且不重复', () => {
    const picked = pickRoundLetters(() => undefined)
    expect(picked).toHaveLength(ROUND_SIZE)
    expect(new Set(picked).size).toBe(ROUND_SIZE)
    for (const l of picked) expect(LETTER_LIST).toContain(l)
  })

  it('到期的字母优先入选', () => {
    const past = Date.now() - 1000
    const future = Date.now() + 86400000
    // a、b 到期；其余全部未到期
    const picked = pickRoundLetters((letter) =>
      letter === 'a' || letter === 'b'
        ? { level: 3, nextReview: past }
        : { level: 0, nextReview: future },
    )
    expect(picked.slice(0, 2).sort()).toEqual(['a', 'b'])
  })

  it('都到期时低等级优先', () => {
    const picked = pickRoundLetters((letter) => ({
      level: letter === 'z' ? 12 : 0,
      nextReview: Date.now() - 1000,
    }))
    expect(picked).not.toContain('z')
    expect(picked).toHaveLength(ROUND_SIZE)
  })
})

describe('buildRecognizeOptions', () => {
  const correct = { name: '苹果', emoji: '🍎', description: '' }
  const pool = [
    correct,
    { name: '香蕉', emoji: '🍌', description: '' },
    { name: '猫', emoji: '🐱', description: '' },
    { name: '狗', emoji: '🐶', description: '' },
    { name: '大象', emoji: '🐘', description: '' },
  ]

  it('4 个选项含正确答案且不重复', () => {
    const opts = buildRecognizeOptions(correct, pool)
    expect(opts).toHaveLength(4)
    expect(opts.map((o) => o.name)).toContain('苹果')
    expect(new Set(opts.map((o) => o.name)).size).toBe(4)
  })
})
