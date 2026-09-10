/**
 * 记忆测评最好成绩工具测试（纯函数部分，不依赖 uni 存储）
 */
import { describe, it, expect } from 'vitest'
import { isBetterBest } from './memory-test-best'

describe('isBetterBest', () => {
  it('无历史纪录时任何成绩都算更优', () => {
    expect(isBetterBest(null, { level: 1, score: 10 })).toBe(true)
  })

  it('等级优先于得分', () => {
    expect(isBetterBest({ level: 3, score: 999 }, { level: 4, score: 1 })).toBe(true)
    expect(isBetterBest({ level: 4, score: 1 }, { level: 3, score: 999 })).toBe(false)
  })

  it('等级相同时比得分', () => {
    expect(isBetterBest({ level: 3, score: 100 }, { level: 3, score: 101 })).toBe(true)
    expect(isBetterBest({ level: 3, score: 100 }, { level: 3, score: 100 })).toBe(false)
    expect(isBetterBest({ level: 3, score: 100 }, { level: 3, score: 99 })).toBe(false)
  })
})
