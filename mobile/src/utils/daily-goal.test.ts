import { describe, it, expect } from 'vitest'
import {
  resolveDailyGoal,
  countReviewedToday,
  getGoalProgress,
  checkGoalJustAchieved,
  DEFAULT_DAILY_GOAL,
} from './daily-goal'

// 固定一个"现在"：2026-09-11 15:30 本地时间，今天 0 点为同日 00:00
const NOW = new Date(2026, 8, 11, 15, 30).getTime()
const TODAY_START = new Date(2026, 8, 11, 0, 0, 0, 0).getTime()
const YESTERDAY = TODAY_START - 60 * 1000
const THIS_MORNING = TODAY_START + 60 * 1000

describe('resolveDailyGoal', () => {
  it('缺失或非数字时回退默认 20', () => {
    expect(resolveDailyGoal(undefined)).toBe(DEFAULT_DAILY_GOAL)
    expect(resolveDailyGoal(null)).toBe(DEFAULT_DAILY_GOAL)
    expect(resolveDailyGoal('')).toBe(DEFAULT_DAILY_GOAL)
    expect(resolveDailyGoal('abc')).toBe(DEFAULT_DAILY_GOAL)
    expect(resolveDailyGoal(NaN)).toBe(DEFAULT_DAILY_GOAL)
  })

  it('非正数回退默认 20', () => {
    expect(resolveDailyGoal(0)).toBe(DEFAULT_DAILY_GOAL)
    expect(resolveDailyGoal(-5)).toBe(DEFAULT_DAILY_GOAL)
  })

  it('接受数字与数字字符串并向下取整', () => {
    expect(resolveDailyGoal(30)).toBe(30)
    expect(resolveDailyGoal('50')).toBe(50)
    expect(resolveDailyGoal(20.9)).toBe(20)
  })
})

describe('countReviewedToday', () => {
  it('只统计 lastReviewTime >= 今天 0 点的单词', () => {
    const words = [
      { lastReviewTime: THIS_MORNING },
      { lastReviewTime: NOW },
      { lastReviewTime: YESTERDAY },
      { lastReviewTime: 0 },
      {},
    ]
    expect(countReviewedToday(words, NOW)).toBe(2)
  })

  it('跨天边界：昨天 23:59 不算，今天 0 点整算', () => {
    const words = [
      { lastReviewTime: TODAY_START - 1 },
      { lastReviewTime: TODAY_START },
    ]
    expect(countReviewedToday(words, NOW)).toBe(1)
  })

  it('空数组返回 0', () => {
    expect(countReviewedToday([], NOW)).toBe(0)
  })
})

describe('getGoalProgress', () => {
  it('未完成时给出百分比且不达成', () => {
    expect(getGoalProgress(5, 20)).toEqual({ reviewed: 5, goal: 20, percent: 25, achieved: false })
  })

  it('正好达到目标即达成', () => {
    expect(getGoalProgress(20, 20).achieved).toBe(true)
    expect(getGoalProgress(20, 20).percent).toBe(100)
  })

  it('超出目标时百分比封顶 100', () => {
    const p = getGoalProgress(50, 20)
    expect(p.percent).toBe(100)
    expect(p.achieved).toBe(true)
  })

  it('负数与非法目标分别被钳制 / 回退', () => {
    expect(getGoalProgress(-3, 20).reviewed).toBe(0)
    expect(getGoalProgress(5, 0).goal).toBe(DEFAULT_DAILY_GOAL)
  })
})

describe('checkGoalJustAchieved', () => {
  it('跨过一次判定恰好达成时返回 true', () => {
    expect(checkGoalJustAchieved(19, 20, 20)).toBe(true)
    expect(checkGoalJustAchieved(0, 20, 20)).toBe(true)
  })

  it('此前已达成或此次未达成时返回 false', () => {
    expect(checkGoalJustAchieved(20, 21, 20)).toBe(false)
    expect(checkGoalJustAchieved(18, 19, 20)).toBe(false)
  })

  it('同一词撤销后重复判定不会重复触发（before 已含该词）', () => {
    // 第一次 19→20 触发；撤销回 19 的计数后再次 19→20，before=19、after=20 仍触发一次，
    // 而连续两次不撤销的判定是 20→20，不触发
    expect(checkGoalJustAchieved(20, 20, 20)).toBe(false)
  })
})
