/**
 * dictation-level 纯逻辑测试：拼写练习等级口径与主复习体系（12 级标准）对齐
 */
import { describe, it, expect } from 'vitest'
import {
  REMEMBER_LEVEL,
  nextLevelOnCorrect,
  nextLevelOnWrong,
  isRemembered,
  getEmptyState,
  getFilteredHint
} from './dictation-level'

describe('拼写判对/判错只做 level 升降', () => {
  it('判对每次 +1，封顶 12 级', () => {
    expect(nextLevelOnCorrect(1)).toBe(2)
    expect(nextLevelOnCorrect(11)).toBe(12)
    expect(nextLevelOnCorrect(12)).toBe(12)
  })

  it('判错每次 -1，封底 0 级', () => {
    expect(nextLevelOnWrong(5)).toBe(4)
    expect(nextLevelOnWrong(1)).toBe(0)
    expect(nextLevelOnWrong(0)).toBe(0)
  })

  it('level 缺省时按 1 级处理', () => {
    expect(nextLevelOnCorrect(undefined as unknown as number)).toBe(2)
    expect(nextLevelOnWrong(undefined as unknown as number)).toBe(0)
  })
})

describe('remembered 判定与主体系一致（12 级）', () => {
  it('11 级仍算未记住（修复旧的 7 级毕业口径）', () => {
    expect(isRemembered(7)).toBe(false)
    expect(isRemembered(11)).toBe(false)
  })

  it('12 级才算永久记住', () => {
    expect(isRemembered(REMEMBER_LEVEL)).toBe(true)
    expect(isRemembered(12)).toBe(true)
  })
})

describe('拼写空态文案', () => {
  it('范围内本来就没词：常规空态文案，无过滤解释', () => {
    const info = getEmptyState(0, 0)
    expect(info.text).toBe('当前词库没有可练习的单词')
    expect(info.filteredOutCount).toBe(0)
  })

  it('范围内的词全部被正则过滤：给出明确解释与条数', () => {
    const info = getEmptyState(20, 20)
    expect(info.filteredOutCount).toBe(20)
    expect(getFilteredHint(info.filteredOutCount))
      .toBe('当前词库的 20 条内容为词组/句子，拼写练习仅支持英文单词')
  })

  it('部分单词可练时不走空态（filteredOut 仅为解释用）', () => {
    const info = getEmptyState(30, 12)
    expect(info.filteredOutCount).toBe(12)
    expect(getFilteredHint(12)).toContain('12 条内容为词组/句子')
  })
})
