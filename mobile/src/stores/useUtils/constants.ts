/**
 * 共享 SRS 常量（与桌面端 src/constants/index.ts 的 DEFAULT_INTERVALS 逐值一致）
 *
 * 抽取到独立文件供 useMobileWords / usePhoneticMemory / useKnowledgeMemory 共用，
 * 避免多处定义漂移破坏双端同步互通。
 */

/** 默认复习间隔（单位：分钟），下标即记忆等级 level 0-13 */
export const DEFAULT_INTERVALS = [
  1, 5, 30, 6 * 60, 12 * 60, 24 * 60,
  2 * 24 * 60, 4 * 24 * 60, 7 * 24 * 60,
  15 * 24 * 60, 30 * 24 * 60, 3 * 30 * 24 * 60,
  6 * 30 * 24 * 60, 12 * 30 * 24 * 60
]
