/**
 * 共享 SRS（间隔重复）工具
 *
 * 统一处理 learnDate 归一化、到期判断、升级时间窗、等级升降计算。
 * 与 Word 模块 remember/forget 基准实现保持一致：
 * - 升级窗口：开始时间 = learnDate + DEFAULT_INTERVALS[level]
 *              结束时间 = learnDate + DEFAULT_INTERVALS[min(level+3, len-1)]
 * - 记忆牢固度：'较强' +2，'极强' +3，其余 +1，封顶 12
 * - 降级：每次 -4，下限 1（12 级答错降到 8 级，不再重置回 1）
 */
import {DEFAULT_INTERVALS} from '@/constants';
import type {MemoryFirmnessType} from '@/types/words';

/** level 上限 */
export const MAX_LEVEL = 12;

/** 掌握阈值 */
export const MASTERED_LEVEL = 12;

/**
 * 将 learnDate 归一化为毫秒时间戳
 * 支持 number | string | Date；无效值（NaN、非法字符串、无效 Date 等）返回 Date.now()
 */
export function normalizeLearnDate(learnDate: number | string | Date | undefined | null): number {
    if (learnDate === undefined || learnDate === null) return Date.now();
    if (typeof learnDate === 'number') {
        return Number.isNaN(learnDate) ? Date.now() : learnDate;
    }
    if (typeof learnDate === 'string') {
        const d = new Date(learnDate);
        return Number.isNaN(d.getTime()) ? Date.now() : d.getTime();
    }
    if (learnDate instanceof Date) {
        return Number.isNaN(learnDate.getTime()) ? Date.now() : learnDate.getTime();
    }
    return Date.now();
}

/**
 * 将等级限制在 [0, maxLevel]
 */
export function clampLevel(level: number, maxLevel: number = MAX_LEVEL): number {
    if (level < 0) return 0;
    if (level > maxLevel) return maxLevel;
    return level;
}

/**
 * 判断条目是否到期需要复习
 * @param learnDate 上次学习时间（支持 number|string|Date）
 * @param level 当前等级
 * @param now 当前时间戳
 * @param intervals 间隔数组，默认 DEFAULT_INTERVALS
 */
export function isDue(
    learnDate: number | string | Date | undefined | null,
    level: number,
    now: number,
    intervals: number[] = DEFAULT_INTERVALS,
): boolean {
    // 0 / undefined / null 视为从未学习，立即到期
    if (!learnDate) return true;
    const ts = normalizeLearnDate(learnDate);
    const clampedLevel = clampLevel(level, intervals.length - 1);
    const intervalMinutes = intervals[clampedLevel] ?? intervals[0];
    return now - ts >= intervalMinutes * 60 * 1000;
}

/**
 * 判断当前是否在可升级时间窗口内
 * 当前时间必须大于开始时间且小于结束时间；未学过（learnDate 为假值）时允许升级
 */
export function canLevelUp(
    learnDate: number | string | Date | undefined | null,
    level: number,
    now: number,
    intervals: number[] = DEFAULT_INTERVALS,
): boolean {
    // 从未学习过时，首次答对允许升级
    if (!learnDate) return true;
    const ts = normalizeLearnDate(learnDate);
    const clampedLevel = clampLevel(level, intervals.length - 1);
    const startLearnDate = ts + (intervals[clampedLevel] ?? intervals[0]) * 60 * 1000;
    const endLearnDate = ts + intervals[Math.min(clampedLevel + 3, intervals.length - 1)] * 60 * 1000;
    return now > startLearnDate && now < endLearnDate;
}

/**
 * 根据记忆牢固度计算升级后的等级
 * @param level 当前等级
 * @param firmness 记忆牢固度
 */
export function computeLevelUp(level: number, firmness: MemoryFirmnessType | string | undefined): number {
    let increment = 1; // 默认正常：+1
    if (firmness === '较强') {
        increment = 2;
    } else if (firmness === '极强') {
        increment = 3;
    }
    return Math.min(level + increment, MAX_LEVEL);
}

/**
 * 计算降级后的等级
 * 降级幅度封顶 -4，下限 1：12 级答错降到 8 级，低等级行为不变
 */
export function computeLevelDown(level: number): number {
    return Math.max(level - 4, 1);
}
