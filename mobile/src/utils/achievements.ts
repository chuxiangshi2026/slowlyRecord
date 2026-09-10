/**
 * 里程碑成就体系：成就定义与检查器（纯逻辑，无 uni / storage 依赖，便于测试）
 *
 * 背景见 docs/mobile-product-review-2026-09-10.md 四.3：
 * 纯本地（无账号、无排行榜）轻量激励。解锁状态由 useAchievements store
 * 持久化到本地 storage，解锁时页面内弹非模态成就条，打卡页设成就墙。
 *
 * 首次行为类成就（首次完成拼写一轮 / 首次完成文本背诵）需要对应模块
 * 上报事件，本次未接入；扩展方式：在 AchievementStats 中补字段，
 * 并在 ACHIEVEMENTS 中新增定义即可，检查器无需改动。
 */

/** 成就检查所需的统计数据（由各 store 汇总后传入，保持纯函数） */
export interface AchievementStats {
  /** 连续打卡天数 */
  streakDays: number
  /** 累计复习词次（全部词库 reviewCount 总和） */
  totalReviewCount: number
  /** 当前词库是否已学完（有词且全部 level >= 12） */
  bankMastered: boolean
  /** 当前错题数（低等级且复习过，与错题本页口径一致） */
  wrongCount: number
  /** 曾经出现过错题（本地持久化标记，错题清零成就的前置条件） */
  everHadWrong: boolean
}

/** 单个成就定义 */
export interface AchievementDef {
  id: string
  /** 名称（解锁通知与成就墙标题） */
  name: string
  /** 图标 emoji */
  icon: string
  /** 描述（成就墙上展示） */
  desc: string
  /** 目标文案（未解锁时的灰色提示） */
  target: string
  /** 达成判定：输入统计数据，返回是否达成 */
  check: (stats: AchievementStats) => boolean
}

/** 全部成就清单（共 9 个） */
export const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: 'streak-3',
    name: '初露头角',
    icon: '🔥',
    desc: '连续打卡 3 天',
    target: '连续打卡 3 天',
    check: s => s.streakDays >= 3,
  },
  {
    id: 'streak-7',
    name: '一周坚持',
    icon: '📅',
    desc: '连续打卡 7 天',
    target: '连续打卡 7 天',
    check: s => s.streakDays >= 7,
  },
  {
    id: 'streak-30',
    name: '习惯养成',
    icon: '💪',
    desc: '连续打卡 30 天',
    target: '连续打卡 30 天',
    check: s => s.streakDays >= 30,
  },
  {
    id: 'streak-100',
    name: '百日筑基',
    icon: '🏅',
    desc: '连续打卡 100 天',
    target: '连续打卡 100 天',
    check: s => s.streakDays >= 100,
  },
  {
    id: 'review-100',
    name: '百次磨砺',
    icon: '📖',
    desc: '累计复习 100 词次',
    target: '累计复习 100 词次',
    check: s => s.totalReviewCount >= 100,
  },
  {
    id: 'review-500',
    name: '学而不倦',
    icon: '✏️',
    desc: '累计复习 500 词次',
    target: '累计复习 500 词次',
    check: s => s.totalReviewCount >= 500,
  },
  {
    id: 'review-2000',
    name: '记忆大师',
    icon: '🎓',
    desc: '累计复习 2000 词次',
    target: '累计复习 2000 词次',
    check: s => s.totalReviewCount >= 2000,
  },
  {
    id: 'bank-mastered',
    name: '首库告捷',
    icon: '🏆',
    desc: '首个词库全部学完（所有单词达到满级）',
    target: '将一个词库全部学到满级',
    check: s => s.bankMastered,
  },
  {
    id: 'wrong-cleared',
    name: '错题清零',
    icon: '🧹',
    desc: '曾经有过错题，如今全部攻克',
    target: '把错题本里的错题全部复习过关',
    check: s => s.everHadWrong && s.wrongCount === 0,
  },
]

/**
 * 纯函数成就检查器：输入统计数据与已解锁 id 集合，返回本次新解锁的成就 id 列表。
 * 不修改任何状态；解锁时间戳由调用方（store）统一落盘。
 */
export function checkAchievements(
  stats: AchievementStats,
  unlockedIds: ReadonlySet<string> | readonly string[],
): string[] {
  const unlocked = unlockedIds instanceof Set ? unlockedIds : new Set(unlockedIds)
  const newlyUnlocked: string[] = []
  for (const def of ACHIEVEMENTS) {
    if (!unlocked.has(def.id) && def.check(stats)) {
      newlyUnlocked.push(def.id)
    }
  }
  return newlyUnlocked
}
