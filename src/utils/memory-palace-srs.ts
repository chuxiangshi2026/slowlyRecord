/**
 * 记忆宫殿桩挂载 SRS（间隔重复）工具
 *
 * 复用全局 DEFAULT_INTERVALS（分钟单位），level 0-12。
 * 巡视自评"记住"且已过复习间隔才升级，自评"忘记"降级（12 级直接重置为 1 级）。
 * 内部委托给共享 srs.ts，保持导出签名不变。
 */
import {DEFAULT_INTERVALS} from '@/constants';
import type {PegItem} from '@/types/memory-palace';
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

/** 新挂载默认等级（未自评过时按 0 处理） */
export const DEFAULT_LEVEL = 0;

/**
 * 将等级限制在 [0, MAX_LEVEL]
 */
export function clampLevel(level: number): number {
    return clampLevelShared(level, MAX_LEVEL);
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
    return isDueShared(peg.learnDate, getPegLevel(peg), now, DEFAULT_INTERVALS);
}

/**
 * 自评"记住"后更新 SRS 状态
 * - 在升级窗口内：按记忆牢固度升 1~3 级，封顶 12
 * - 未到期或到期但超窗：刷新 learnDate，不升级
 */
export function markRemembered(
    peg: PegItem,
    now: number = Date.now(),
    firmness?: MemoryFirmnessType | string,
): PegItem {
    const level = getPegLevel(peg);
    if (canLevelUpShared(peg.learnDate, level, now, DEFAULT_INTERVALS)) {
        return {
            ...peg,
            level: computeLevelUp(level, firmness),
            learnDate: now,
        };
    }
    // 未到期或太晚：刷新 learnDate，保持等级
    return {
        ...peg,
        learnDate: now,
    };
}

/**
 * 自评"忘记"后更新 SRS 状态
 * 12 级忘记直接重置为 1 级，否则降级
 */
export function markForgotten(peg: PegItem, now: number = Date.now()): PegItem {
    const level = getPegLevel(peg);
    return {
        ...peg,
        level: computeLevelDown(level),
        learnDate: now,
    };
}
