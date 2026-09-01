/**
 * 数字记忆条目 SRS（间隔重复）工具
 *
 * 复用全局 DEFAULT_INTERVALS（分钟单位），level 0-12，答对且过复习间隔才升级，答错降级。
 * 内部委托给共享 srs.ts，保持导出签名不变。
 */
import {DEFAULT_INTERVALS} from '@/constants';
import type {NumberMemoryEntry} from '@/types/number-memory';
import type {MemoryFirmnessType} from '@/types/words';
import {
    canLevelUp as canLevelUpShared,
    clampLevel as clampLevelShared,
    computeLevelDown,
    computeLevelUp,
    isDue as isDueShared,
    MASTERED_LEVEL,
    MAX_LEVEL,
} from '@/utils/srs';

/** level 上限 */
export {MAX_LEVEL};

/** 掌握阈值 */
export {MASTERED_LEVEL};

/** 新条目默认等级（旧数据无 level 时按 1 处理） */
export const DEFAULT_LEVEL = 1;

/**
 * 将等级限制在 [0, MAX_LEVEL]
 */
export function clampLevel(level: number): number {
    return clampLevelShared(level, MAX_LEVEL);
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
    return isDueShared(entry.learnDate, getEntryLevel(entry), now, DEFAULT_INTERVALS);
}

/**
 * 答对后更新条目 SRS 状态
 * - 在升级窗口内：按记忆牢固度升 1~3 级，封顶 12
 * - 未到期或到期但超窗：刷新 learnDate，不升级
 */
export function markCorrect(
    entry: NumberMemoryEntry,
    now: number = Date.now(),
    firmness?: MemoryFirmnessType | string,
): NumberMemoryEntry {
    const level = getEntryLevel(entry);
    if (canLevelUpShared(entry.learnDate, level, now, DEFAULT_INTERVALS)) {
        return {
            ...entry,
            level: computeLevelUp(level, firmness) as NumberMemoryEntry['level'],
            learnDate: now,
        };
    }
    // 未到期或太晚：刷新 learnDate，保持等级
    return {
        ...entry,
        learnDate: now,
    };
}

/**
 * 答错后更新条目 SRS 状态
 * 12 级答错直接重置为 1 级，否则降级
 */
export function markWrong(entry: NumberMemoryEntry, now: number = Date.now()): NumberMemoryEntry {
    const level = getEntryLevel(entry);
    return {
        ...entry,
        level: computeLevelDown(level) as NumberMemoryEntry['level'],
        learnDate: now,
    };
}
