/**
 * 移动端通用知识包 SRS 单元测试
 *
 * 锁定双端共享的等级语义：level 0-12、答对 +1~3（需过复习间隔）、
 * 答错 -4 且下限 1（12 级降到 8 级），与桌面端实现保持一致。
 */
import { describe, it, expect } from 'vitest'
import {
  MAX_LEVEL,
  MASTERED_LEVEL,
  DEFAULT_LEVEL,
  clampLevel,
  createDefaultProgress,
  getItemLevel,
  isRemembered,
  isDue,
  markCorrect,
  markWrong,
} from './knowledge-memory-srs'
import { DEFAULT_INTERVALS } from '@/stores/useUtils/constants'
import type { KnowledgeItemProgress } from '@/stores/useUtils/types'

const MINUTE = 60 * 1000

function makeProgress(overrides: Partial<KnowledgeItemProgress> = {}): KnowledgeItemProgress {
  return {
    itemId: 'item-1',
    level: 0,
    learnDate: 0,
    correct: 0,
    wrong: 0,
    ...overrides,
  }
}

describe('知识包 SRS：等级与默认进度', () => {
  it('等级常量与间隔表对齐', () => {
    expect(MAX_LEVEL).toBe(12)
    expect(MASTERED_LEVEL).toBe(12)
    expect(DEFAULT_LEVEL).toBe(0)
    expect(DEFAULT_INTERVALS).toHaveLength(14)
  })

  it('clampLevel 限制在 0-12', () => {
    expect(clampLevel(-1)).toBe(0)
    expect(clampLevel(0)).toBe(0)
    expect(clampLevel(7)).toBe(7)
    expect(clampLevel(12)).toBe(12)
    expect(clampLevel(99)).toBe(12)
  })

  it('createDefaultProgress 生成未学习进度', () => {
    expect(createDefaultProgress('item-x')).toEqual({
      itemId: 'item-x',
      level: 0,
      learnDate: 0,
      correct: 0,
      wrong: 0,
    })
  })

  it('getItemLevel：缺失或非法等级按 0，越界自动收敛', () => {
    expect(getItemLevel(undefined)).toBe(0)
    expect(getItemLevel(makeProgress({ level: undefined as unknown as number }))).toBe(0)
    expect(getItemLevel(makeProgress({ level: -3 }))).toBe(0)
    expect(getItemLevel(makeProgress({ level: 20 }))).toBe(12)
    expect(getItemLevel(makeProgress({ level: 5 }))).toBe(5)
  })

  it('isRemembered：满 12 级视为已记住', () => {
    expect(isRemembered(undefined)).toBe(false)
    expect(isRemembered(makeProgress({ level: 11 }))).toBe(false)
    expect(isRemembered(makeProgress({ level: 12 }))).toBe(true)
  })
})

describe('知识包 SRS：到期判定', () => {
  it('无进度或未学过一律到期', () => {
    expect(isDue(undefined, 1_000_000)).toBe(true)
    expect(isDue(makeProgress({ learnDate: 0 }), 1_000_000)).toBe(true)
  })

  it('按当前等级间隔判定，差 1 毫秒也算未到期', () => {
    const learnDate = 1_000_000
    // 0 级间隔 1 分钟
    expect(isDue(makeProgress({ learnDate }), learnDate + MINUTE - 1)).toBe(false)
    expect(isDue(makeProgress({ learnDate }), learnDate + MINUTE)).toBe(true)

    // 3 级间隔 6 小时
    const sixHours = 6 * 60 * MINUTE
    expect(isDue(makeProgress({ level: 3, learnDate }), learnDate + sixHours - 1)).toBe(false)
    expect(isDue(makeProgress({ level: 3, learnDate }), learnDate + sixHours)).toBe(true)
  })
})

describe('知识包 SRS：答对升级', () => {
  it('未学过时允许升级，默认 +1 并刷新学习时间', () => {
    const now = 5_000_000
    const next = markCorrect(makeProgress(), now)
    expect(next.level).toBe(1)
    expect(next.learnDate).toBe(now)
    expect(next.correct).toBe(1)
  })

  it('记忆牢固度决定升幅：较强 +2、极强 +3、其他 +1', () => {
    const now = 5_000_000
    expect(markCorrect(makeProgress(), now, '较强').level).toBe(2)
    expect(markCorrect(makeProgress(), now, '极强').level).toBe(3)
    expect(markCorrect(makeProgress(), now, '一般').level).toBe(1)
    expect(markCorrect(makeProgress(), now, undefined).level).toBe(1)
  })

  it('升级封顶 12 级', () => {
    const now = 5_000_000
    expect(markCorrect(makeProgress({ level: 11 }), now, '极强').level).toBe(12)
    expect(markCorrect(makeProgress({ level: 12 }), now, '极强').level).toBe(12)
  })

  it('未到复习间隔：只刷新学习时间与正确计数，等级不变', () => {
    const learnDate = 5_000_000
    const now = learnDate + 30 * 1000 // 0 级间隔 1 分钟，尚未到
    const next = markCorrect(makeProgress({ level: 0, learnDate, correct: 2 }), now, '极强')
    expect(next.level).toBe(0)
    expect(next.learnDate).toBe(now)
    expect(next.correct).toBe(3)
  })

  it('已过间隔：正常升级', () => {
    const learnDate = 5_000_000
    const now = learnDate + MINUTE
    const next = markCorrect(makeProgress({ level: 0, learnDate, correct: 1 }), now)
    expect(next.level).toBe(1)
    expect(next.learnDate).toBe(now)
    expect(next.correct).toBe(2)
  })

  it('返回新对象，不修改入参', () => {
    const progress = makeProgress({ level: 3, learnDate: 1, correct: 4 })
    const snapshot = { ...progress }
    markCorrect(progress, 10_000_000)
    expect(progress).toEqual(snapshot)
  })
})

describe('知识包 SRS：答错降级', () => {
  it('每次 -4，下限 1', () => {
    const now = 6_000_000
    expect(markWrong(makeProgress({ level: 0 }), now).level).toBe(1)
    expect(markWrong(makeProgress({ level: 1 }), now).level).toBe(1)
    expect(markWrong(makeProgress({ level: 6 }), now).level).toBe(2)
    expect(markWrong(makeProgress({ level: 9 }), now).level).toBe(5)
  })

  it('12 级答错降到 8 级', () => {
    expect(markWrong(makeProgress({ level: 12 }), 6_000_000).level).toBe(8)
  })

  it('刷新学习时间并累计错误次数', () => {
    const now = 6_000_000
    const next = markWrong(makeProgress({ level: 5, learnDate: 1, wrong: 2 }), now)
    expect(next.level).toBe(1)
    expect(next.learnDate).toBe(now)
    expect(next.wrong).toBe(3)
  })
})
