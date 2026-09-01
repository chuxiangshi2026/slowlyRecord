/**
 * 通用知识包 SRS（间隔重复）工具
 *
 * 复用全局 DEFAULT_INTERVALS（分钟单位），level 0-12，答对且过复习间隔才升级，答错降级。
 */

import {DEFAULT_INTERVALS} from '@/constants';
import type {KnowledgeItemProgress} from '@/types/knowledge-memory';

/** level 上限 */
export const MAX_LEVEL = Math.min(12, DEFAULT_INTERVALS.length - 1);

/** 掌握阈值 */
export const MASTERED_LEVEL = 12;

/** 新条目默认等级（旧数据无 level 时按 0 处理） */
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
    if (!progress || !progress.learnDate) return true;
    const intervalMinutes = DEFAULT_INTERVALS[level] ?? DEFAULT_INTERVALS[DEFAULT_LEVEL];
    const intervalMs = intervalMinutes * 60 * 1000;
    return now - progress.learnDate >= intervalMs;
}

/**
 * 答对后更新进度
 * 只有到期才会升级；未到期时不做任何变更（仅更新 learnDate 会破坏 SRS，故保持原样）
 */
export function markCorrect(
    progress: KnowledgeItemProgress,
    now: number = Date.now(),
): KnowledgeItemProgress {
    if (!isDue(progress, now)) {
        return progress;
    }
    return {
        ...progress,
        level: clampLevel(getItemLevel(progress) + 1),
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
    const nextLevel = level >= MASTERED_LEVEL ? 1 : clampLevel(level - 1);
    return {
        ...progress,
        level: nextLevel,
        learnDate: now,
        wrong: progress.wrong + 1,
    };
}
