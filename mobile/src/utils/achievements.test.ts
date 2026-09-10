import { describe, it, expect } from 'vitest'
import { ACHIEVEMENTS, checkAchievements, type AchievementStats } from './achievements'

/** 空统计数据：所有数值为 0、布尔为 false */
function emptyStats(): AchievementStats {
  return {
    streakDays: 0,
    totalReviewCount: 0,
    bankMastered: false,
    wrongCount: 0,
    everHadWrong: false,
  }
}

describe('成就清单', () => {
  it('应包含 9 个成就且 id 唯一', () => {
    expect(ACHIEVEMENTS).toHaveLength(9)
    const ids = ACHIEVEMENTS.map(a => a.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('每个成就应具备名称、图标、描述、目标与检查函数', () => {
    for (const def of ACHIEVEMENTS) {
      expect(def.name).toBeTruthy()
      expect(def.icon).toBeTruthy()
      expect(def.desc).toBeTruthy()
      expect(def.target).toBeTruthy()
      expect(typeof def.check).toBe('function')
    }
  })
})

describe('checkAchievements 纯函数检查器', () => {
  it('空统计数据不应解锁任何成就', () => {
    expect(checkAchievements(emptyStats(), [])).toEqual([])
  })

  it('连续打卡达到 3/7/30/100 应依次解锁，未达门槛不解锁', () => {
    expect(checkAchievements({ ...emptyStats(), streakDays: 2 }, [])).toEqual([])
    expect(checkAchievements({ ...emptyStats(), streakDays: 3 }, [])).toEqual(['streak-3'])
    expect(checkAchievements({ ...emptyStats(), streakDays: 7 }, [])).toEqual(['streak-3', 'streak-7'])
    expect(checkAchievements({ ...emptyStats(), streakDays: 30 }, [])).toEqual([
      'streak-3', 'streak-7', 'streak-30',
    ])
    expect(checkAchievements({ ...emptyStats(), streakDays: 100 }, [])).toEqual([
      'streak-3', 'streak-7', 'streak-30', 'streak-100',
    ])
    expect(checkAchievements({ ...emptyStats(), streakDays: 101 }, [])).toHaveLength(4)
  })

  it('累计复习词次达到 100/500/2000 应依次解锁', () => {
    expect(checkAchievements({ ...emptyStats(), totalReviewCount: 99 }, [])).toEqual([])
    expect(checkAchievements({ ...emptyStats(), totalReviewCount: 100 }, [])).toEqual(['review-100'])
    expect(checkAchievements({ ...emptyStats(), totalReviewCount: 2000 }, [])).toEqual([
      'review-100', 'review-500', 'review-2000',
    ])
  })

  it('词库全部满级才解锁「首库告捷」，空词库不解锁', () => {
    expect(checkAchievements({ ...emptyStats(), bankMastered: false }, [])).toEqual([])
    expect(checkAchievements({ ...emptyStats(), bankMastered: true }, [])).toEqual(['bank-mastered'])
  })

  it('错题清零需要「曾有错题」且当前错题为 0', () => {
    // 从未有过错题：不解锁
    expect(checkAchievements({ ...emptyStats(), everHadWrong: false, wrongCount: 0 }, [])).toEqual([])
    // 曾有错题但仍有错题：不解锁
    expect(checkAchievements({ ...emptyStats(), everHadWrong: true, wrongCount: 2 }, [])).toEqual([])
    // 曾有错题且已清零：解锁
    expect(checkAchievements({ ...emptyStats(), everHadWrong: true, wrongCount: 0 }, [])).toEqual(['wrong-cleared'])
  })

  it('已解锁的成就不应重复返回', () => {
    const stats: AchievementStats = { ...emptyStats(), streakDays: 100, totalReviewCount: 2000, bankMastered: true, everHadWrong: true }
    // 第一次：解锁全部
    const first = checkAchievements(stats, [])
    expect(first).toHaveLength(9)
    // 第二次：传入已解锁集合，不再返回任何成就
    expect(checkAchievements(stats, first)).toEqual([])
    // 部分解锁：只返回剩余
    expect(checkAchievements(stats, first.slice(0, 8))).toEqual([first[8]])
  })

  it('应同时解锁多个维度的成就', () => {
    const stats: AchievementStats = {
      streakDays: 7,
      totalReviewCount: 500,
      bankMastered: false,
      wrongCount: 0,
      everHadWrong: false,
    }
    expect(checkAchievements(stats, [])).toEqual([
      'streak-3', 'streak-7', 'review-100', 'review-500',
    ])
  })

  it('已解锁集合支持传入 Set 与数组两种形态', () => {
    const stats = { ...emptyStats(), streakDays: 3 }
    expect(checkAchievements(stats, new Set(['streak-3']))).toEqual([])
    expect(checkAchievements(stats, ['streak-3'])).toEqual([])
  })
})
