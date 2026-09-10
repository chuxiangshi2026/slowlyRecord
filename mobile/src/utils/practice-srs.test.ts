/**
 * 轻量复习调度纯函数测试
 */
import { describe, it, expect } from 'vitest'
import {
  PRACTICE_MAX_LEVEL,
  getPracticeLevel,
  intervalMinutesOf,
  isPracticeDue,
  scheduleOnRemembered,
  scheduleOnForgotten,
  isPracticeMastered,
} from './practice-srs'
import { DEFAULT_INTERVALS } from '@/stores/useUtils/constants'

describe('等级钳制', () => {
  it('缺省/非法值按 0 级处理', () => {
    expect(getPracticeLevel(undefined)).toBe(0)
    expect(getPracticeLevel(NaN)).toBe(0)
    expect(getPracticeLevel(-3)).toBe(0)
  })

  it('超上限钳制到 12 级，小数向下取整', () => {
    expect(getPracticeLevel(99)).toBe(PRACTICE_MAX_LEVEL)
    expect(getPracticeLevel(3.7)).toBe(3)
  })
})

describe('到期判定', () => {
  it('从未排期视为到期', () => {
    expect(isPracticeDue(undefined, 1000)).toBe(true)
    expect(isPracticeDue(0, 1000)).toBe(true)
  })

  it('到期时间 <= now 为到期，否则未到期', () => {
    expect(isPracticeDue(1000, 1000)).toBe(true)
    expect(isPracticeDue(999, 1000)).toBe(true)
    expect(isPracticeDue(1001, 1000)).toBe(false)
  })
})

describe('「记住了」升级排期', () => {
  it('每次升 1 级，按新等级间隔排下次复习', () => {
    const now = 1_000_000
    const patch = scheduleOnRemembered(2, now)
    expect(patch.level).toBe(3)
    expect(patch.nextReview).toBe(now + DEFAULT_INTERVALS[3] * 60 * 1000)
  })

  it('封顶 12 级，间隔取 12 级对应值', () => {
    const now = 1_000_000
    const patch = scheduleOnRemembered(12, now)
    expect(patch.level).toBe(12)
    expect(patch.nextReview).toBe(now + DEFAULT_INTERVALS[12] * 60 * 1000)
  })

  it('缺省 0 级升 1 级', () => {
    expect(scheduleOnRemembered(undefined as unknown as number, 0).level).toBe(1)
  })
})

describe('「还没记住」降级排期', () => {
  it('降 1 级，下限 0 级', () => {
    expect(scheduleOnForgotten(5, 0).level).toBe(4)
    expect(scheduleOnForgotten(1, 0).level).toBe(0)
    expect(scheduleOnForgotten(0, 0).level).toBe(0)
  })

  it('12 级答错重置回 1 级', () => {
    expect(scheduleOnForgotten(12, 0).level).toBe(1)
  })

  it('重新按降级后的等级排期', () => {
    const now = 2_000_000
    const patch = scheduleOnForgotten(4, now)
    expect(patch.nextReview).toBe(now + DEFAULT_INTERVALS[3] * 60 * 1000)
  })
})

describe('掌握判定', () => {
  it('仅 12 级算掌握', () => {
    expect(isPracticeMastered(11)).toBe(false)
    expect(isPracticeMastered(12)).toBe(true)
    expect(isPracticeMastered(undefined)).toBe(false)
  })
})

describe('间隔查询', () => {
  it('越界等级钳制后取 12 级间隔', () => {
    expect(intervalMinutesOf(99)).toBe(DEFAULT_INTERVALS[12])
    expect(intervalMinutesOf(undefined)).toBe(DEFAULT_INTERVALS[0])
  })
})
