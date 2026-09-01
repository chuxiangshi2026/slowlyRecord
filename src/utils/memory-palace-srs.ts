/**
 * 记忆宫殿桩挂载 SRS（间隔重复）工具
 *
 * 复用全局 DEFAULT_INTERVALS（分钟单位），level 0-12。
 * 巡视自评"记住"且已过复习间隔才升级，自评"忘记"降级（12 级直接重置为 1 级）。
 */
import {DEFAULT_INTERVALS} from '@/constants';
import type {PegItem} from '@/types/memory-palace';

/** level 上限 */
export const MAX_LEVEL = Math.min(12, DEFAULT_INTERVALS.length - 1);

/** 掌握阈值 */
export const MASTERED_LEVEL = 12;

/** 新挂载默认等级（未自评过时按 0 处理） */
export const DEFAULT_LEVEL = 0;

/**
 * 将等级限制在 [0, MAX_LEVEL]
 */
export function clampLevel(level: number): number {
  if (level < 0) return 0;
  if (level > MAX_LEVEL) return MAX_LEVEL;
  return level;
}

/**
 * 获取挂载的有效等级
 */
export function getPegLevel(peg: PegItem): number {
  return typeof peg.level === 'number' ? clampLevel(peg.level) : DEFAULT_LEVEL;
}

/**
 * 判断挂载是否已记住（满级）
 */
export function isMastered(peg: PegItem): boolean {
  return getPegLevel(peg) >= MASTERED_LEVEL;
}

/**
 * 判断挂载是否到期需要复习
 */
export function isDue(peg: PegItem, now: number): boolean {
  if (!peg.learnDate) return true;
  const level = getPegLevel(peg);
  const intervalMinutes = DEFAULT_INTERVALS[level] ?? DEFAULT_INTERVALS[DEFAULT_LEVEL];
  return now - peg.learnDate >= intervalMinutes * 60 * 1000;
}

/**
 * 自评"记住"后更新 SRS 状态
 * 只有到期才升级；未到期时不做任何变更
 */
export function markRemembered(peg: PegItem, now: number = Date.now()): PegItem {
  if (!isDue(peg, now)) {
    return peg;
  }
  return {
    ...peg,
    level: clampLevel(getPegLevel(peg) + 1),
    learnDate: now,
  };
}

/**
 * 自评"忘记"后更新 SRS 状态
 * 12 级忘记直接重置为 1 级，否则降级
 */
export function markForgotten(peg: PegItem, now: number = Date.now()): PegItem {
  const level = getPegLevel(peg);
  const nextLevel = level >= MASTERED_LEVEL ? 1 : clampLevel(level - 1);
  return {
    ...peg,
    level: nextLevel,
    learnDate: now,
  };
}
