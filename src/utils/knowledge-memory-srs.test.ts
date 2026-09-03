import {describe, it, expect} from 'vitest'
import {
  clampLevel,
  getItemLevel,
  isDue,
  isRemembered,
  markCorrect,
  markWrong,
  MAX_LEVEL,
  MASTERED_LEVEL,
  DEFAULT_LEVEL,
  createDefaultProgress,
} from './knowledge-memory-srs'
import {DEFAULT_INTERVALS} from '@/constants'
import type {KnowledgeItemProgress} from '@/types/knowledge-memory'

function makeProgress(partial: Partial<KnowledgeItemProgress> = {}): KnowledgeItemProgress {
  return {
    itemId: 'item_1',
    level: DEFAULT_LEVEL,
    learnDate: 0,
    correct: 0,
    wrong: 0,
    ...partial,
  }
}

describe('knowledge-memory-srs', () => {
  describe('clampLevel', () => {
    it('低于 0 时返回 0', () => {
      expect(clampLevel(-1)).toBe(0)
    })

    it('高于 MAX_LEVEL 时返回 MAX_LEVEL', () => {
      expect(clampLevel(100)).toBe(MAX_LEVEL)
    })

    it('正常范围内原样返回', () => {
      expect(clampLevel(5)).toBe(5)
    })
  })

  describe('getItemLevel', () => {
    it('有 level 时返回 clamp 后的值', () => {
      expect(getItemLevel(makeProgress({level: 5}))).toBe(5)
    })

    it('无进度时返回默认值', () => {
      expect(getItemLevel(undefined)).toBe(DEFAULT_LEVEL)
    })

    it('level 越界时会被 clamp', () => {
      expect(getItemLevel(makeProgress({level: 99}))).toBe(MAX_LEVEL)
    })
  })

  describe('isRemembered', () => {
    it('level >= 12 时返回 true', () => {
      expect(isRemembered(makeProgress({level: MASTERED_LEVEL}))).toBe(true)
    })

    it('level < 12 时返回 false', () => {
      expect(isRemembered(makeProgress({level: 11}))).toBe(false)
    })
  })

  describe('isDue', () => {
    it('无 learnDate 时返回 true', () => {
      expect(isDue(makeProgress({level: 1}), Date.now())).toBe(true)
    })

    it('未到期时返回 false', () => {
      const now = Date.now()
      expect(isDue(makeProgress({level: 1, learnDate: now}), now)).toBe(false)
    })

    it('已到期时返回 true', () => {
      const now = Date.now()
      const intervalMs = (DEFAULT_INTERVALS[1] ?? 5) * 60 * 1000
      expect(isDue(makeProgress({level: 1, learnDate: now - intervalMs - 1}), now)).toBe(true)
    })

    it('字符串 learnDate 能正确解析', () => {
      const now = Date.now()
      const progress = makeProgress({level: 1, learnDate: new Date(now - DEFAULT_INTERVALS[1] * 60 * 1000 - 1).toISOString()})
      expect(isDue(progress, now)).toBe(true)
    })

    it('非法字符串 learnDate 视为刚学习', () => {
      const now = Date.now()
      const progress = makeProgress({level: 1, learnDate: 'invalid-date'})
      expect(isDue(progress, now)).toBe(false)
    })
  })

  describe('markCorrect', () => {
    it('到期条目升级并增加正确次数', () => {
      const progress = makeProgress({level: 1, learnDate: 0, correct: 2})
      const now = Date.now()
      const result = markCorrect(progress, now)
      expect(result.level).toBe(2)
      expect(result.learnDate).toBe(now)
      expect(result.correct).toBe(3)
    })

    it('封顶 MAX_LEVEL', () => {
      const progress = makeProgress({level: MAX_LEVEL, learnDate: 0})
      const result = markCorrect(progress, Date.now())
      expect(result.level).toBe(MAX_LEVEL)
    })

    it('未到期时刷新 learnDate 并增加正确次数，但不升级', () => {
      const now = Date.now()
      const progress = makeProgress({level: 5, learnDate: now, correct: 2})
      const result = markCorrect(progress, now)
      expect(result.level).toBe(5)
      expect(result.learnDate).toBe(now)
      expect(result.correct).toBe(3)
    })

    it('到期但超过窗口时不升级，刷新 learnDate', () => {
      const now = Date.now()
      const endWindowMs = DEFAULT_INTERVALS[4] * 60 * 1000 + 1
      const progress = makeProgress({level: 1, learnDate: now - endWindowMs})
      const result = markCorrect(progress, now)
      expect(result.level).toBe(1)
      expect(result.learnDate).toBe(now)
      expect(result.correct).toBe(1)
    })

    it('记忆牢固度 "较强" 时 +2 级', () => {
      const progress = makeProgress({level: 1, learnDate: 0})
      const result = markCorrect(progress, Date.now(), '较强')
      expect(result.level).toBe(3)
    })

    it('记忆牢固度 "极强" 时 +3 级', () => {
      const progress = makeProgress({level: 1, learnDate: 0})
      const result = markCorrect(progress, Date.now(), '极强')
      expect(result.level).toBe(4)
    })
  })

  describe('markWrong', () => {
    it('普通等级降级并增加错误次数', () => {
      const progress = makeProgress({level: 5, wrong: 1})
      const now = Date.now()
      const result = markWrong(progress, now)
      expect(result.level).toBe(4)
      expect(result.learnDate).toBe(now)
      expect(result.wrong).toBe(2)
    })

    it('0 级答错按统一下限升为 1 级', () => {
      const result = markWrong(makeProgress({level: 0}), Date.now())
      expect(result.level).toBe(1)
    })

    it('12 级答错重置为 1 级', () => {
      const progress = makeProgress({level: MASTERED_LEVEL})
      const now = Date.now()
      const result = markWrong(progress, now)
      expect(result.level).toBe(1)
      expect(result.learnDate).toBe(now)
    })
  })

  describe('createDefaultProgress', () => {
    it('应生成默认进度', () => {
      const progress = createDefaultProgress('item_x')
      expect(progress.itemId).toBe('item_x')
      expect(progress.level).toBe(DEFAULT_LEVEL)
      expect(progress.learnDate).toBe(0)
    })
  })
})
