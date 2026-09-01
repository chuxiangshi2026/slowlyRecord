/**
 * 数字记忆条目 SRS（间隔重复）工具
 *
 * 复用全局 DEFAULT_INTERVALS（分钟单位），level 0-12，答对且过复习间隔才升级，答错降级。
 */
import {DEFAULT_INTERVALS} from '@/constants';
import type {NumberMemoryEntry} from '@/types/number-memory';

/** level 上限 */
export const MAX_LEVEL = Math.min(12, DEFAULT_INTERVALS.length - 1);

/** 掌握阈值 */
export const MASTERED_LEVEL = 12;

/** 新条目默认等级（旧数据无 level 时按 1 处理） */
export const DEFAULT_LEVEL = 1;

/**
 * 将等级限制在 [0, MAX_LEVEL]
 */
export function clampLevel(level: number): number {
    if (level < 0) return 0;
    if (level > MAX_LEVEL) return MAX_LEVEL;
    return level;
}

/**
 * 获取条目的有效等级
 */
export function getEntryLevel(entry: NumberMemoryEntry): number {
    return typeof entry.level === 'number' ? clampLevel(entry.level) : DEFAULT_LEVEL;
}

/**
 * 判断条目是否已记住
 */
export function isRemembered(entry: NumberMemoryEntry): boolean {
    return getEntryLevel(entry) >= MASTERED_LEVEL;
}

/**
 * 判断条目是否到期需要复习
 * @param entry 数字记忆条目
 * @param now 当前时间戳
 */
export function isDue(entry: NumberMemoryEntry, now: number): boolean {
    if (!entry.learnDate) return true;
    const level = getEntryLevel(entry);
    const intervalMinutes = DEFAULT_INTERVALS[level] ?? DEFAULT_INTERVALS[DEFAULT_LEVEL];
    const intervalMs = intervalMinutes * 60 * 1000;
    return now - entry.learnDate >= intervalMs;
}

/**
 * 答对后更新条目 SRS 状态
 * 只有到期才会升级；未到期时不做任何变更
 */
export function markCorrect(entry: NumberMemoryEntry, now: number = Date.now()): NumberMemoryEntry {
    if (!isDue(entry, now)) {
        return entry;
    }
    return {
        ...entry,
        level: clampLevel(getEntryLevel(entry) + 1),
        learnDate: now,
    };
}

/**
 * 答错后更新条目 SRS 状态
 * 12 级答错直接重置为 1 级，否则降级
 */
export function markWrong(entry: NumberMemoryEntry, now: number = Date.now()): NumberMemoryEntry {
    const level = getEntryLevel(entry);
    const nextLevel = level >= MASTERED_LEVEL ? 1 : clampLevel(level - 1);
    return {
        ...entry,
        level: nextLevel,
        learnDate: now,
    };
}
