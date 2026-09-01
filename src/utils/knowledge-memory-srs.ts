/**
 * 通用知识包 SRS（间隔重复）工具
 *
 * 复用全局 DEFAULT_INTERVALS（分钟单位），level 0-12，答对且过复习间隔才升级，答错降级。
 * 内部委托给共享 srs.ts，保持导出签名不变。
 */

import {DEFAULT_INTERVALS} from '@/constants';
import type {KnowledgeItemProgress} from '@/types/knowledge-memory';
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

/** 新条目默认等级（旧数据无 level 时按 0 处理） */
export const DEFAULT_LEVEL = 0;

/**
 * 将等级限制在 [0, MAX_LEVEL]
 */
export function clampLevel(level: number): number {
    return clampLevelShared(level, MAX_LEVEL);
}

/**
 * 创建默认进度
 */
export function createDefaultProgress(itemId: string): KnowledgeItemProgress {
    return {
        itemId,
        level: DEFAULT_LEVEL,
        learnDate: 0,
        correct: 0,
        wrong: 0,
    };
}

/**
 * 获取条目的有效等级
 */
export function getItemLevel(progress?: KnowledgeItemProgress): number {
    if (!progress || typeof progress.level !== 'number') return DEFAULT_LEVEL;
    return clampLevel(progress.level);
}

/**
 * 判断条目是否已记住
 */
export function isRemembered(progress?: KnowledgeItemProgress): boolean {
    return getItemLevel(progress) >= MASTERED_LEVEL;
}

/**
 * 判断条目是否到期需要复习
 */
export function isDue(progress: KnowledgeItemProgress | undefined, now: number): boolean {
    const level = getItemLevel(progress);
    if (!progress) return true;
    return isDueShared(progress.learnDate, level, now, DEFAULT_INTERVALS);
}

/**
 * 答对后更新进度
 * - 在升级窗口内：按记忆牢固度升 1~3 级，封顶 12
 * - 未到期或到期但超窗：刷新 learnDate，不升级
 */
export function markCorrect(
    progress: KnowledgeItemProgress,
    now: number = Date.now(),
    firmness?: MemoryFirmnessType | string,
): KnowledgeItemProgress {
    const level = getItemLevel(progress);
    if (canLevelUpShared(progress.learnDate, level, now, DEFAULT_INTERVALS)) {
        return {
            ...progress,
            level: computeLevelUp(level, firmness),
            learnDate: now,
            correct: progress.correct + 1,
        };
    }
    // 未到期或太晚：刷新 learnDate，保持等级
    return {
        ...progress,
        learnDate: now,
        correct: progress.correct + 1,
    };
}

/**
 * 答错后更新进度
 * 12 级答错直接重置为 1 级，否则降级
 */
export function markWrong(
    progress: KnowledgeItemProgress,
    now: number = Date.now(),
): KnowledgeItemProgress {
    const level = getItemLevel(progress);
    return {
        ...progress,
        level: computeLevelDown(level),
        learnDate: now,
        wrong: progress.wrong + 1,
    };
}
