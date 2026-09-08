import {useWordsStore} from '@/stores/words.ts';
import {USAGE_LIMITS} from '@/constants';
import {type OcrResult, ocrTranslateMultiPlatform} from "@/utils/pic-translate.ts";
import {AppInfo} from "@/config.ts";

/**
 * 获取今日日期字符串（格式：YYYY-MM-DD）
 */
function getTodayDateString(): string {
    return new Date().toISOString().split('T')[0];
}

/**
 * 检查是否超出每日使用限制
 * @param feature 功能名称（如 'ocr', 'translation', 'batch_translation'）
 * @returns 是否超出限制
 */
export function isOverDailyLimit(feature: string): boolean {
    const storeKey = `usage_${feature}_counter`;
    const storedData = localStorage.getItem(storeKey);

    if (!storedData) {
        return false; // 没有记录，说明还没开始使用
    }

    try {
        const data = JSON.parse(storedData);
        const lastUsedDate = data.date;
        const count = data.count || 0;

        // 检查是否是今天
        const today = getTodayDateString();

        if (lastUsedDate !== today) {
            // 不是今天，重置计数
            return false;
        }

        // 是今天，检查是否超过限制
        // 根据功能类型确定限制值
        let limit: number;
        if (feature === 'ocr') {
            limit = USAGE_LIMITS.OCR_DAILY_LIMIT;
        } else if (feature === 'tencent_ocr') {
            limit = USAGE_LIMITS.TENCENT_OCR_DAILY_LIMIT;
        } else {
            limit = USAGE_LIMITS.TRANSLATION_DAILY_LIMIT;
        }
        return count >= limit;
    } catch (error) {
        console.error('解析使用计数数据失败:', error);
        return false; // 解析失败，允许使用
    }
}

/**
 * 增加使用计数
 * @param feature 功能名称（如 'ocr', 'translation', 'batch_translation'）
 * @returns 当前计数值
 */
export function incrementUsageCounter(feature: string): number {
    const storeKey = `usage_${feature}_counter`;
    const today = getTodayDateString();

    const storedData = localStorage.getItem(storeKey);
    let count = 0;

    if (storedData) {
        try {
            const data = JSON.parse(storedData);
            if (data.date === today) {
                count = data.count || 0;
            }
        } catch (error) {
            console.error('解析使用计数数据失败:', error);
        }
    }

    // 增加计数
    count++;

    // 保存新的计数值和日期
    localStorage.setItem(storeKey, JSON.stringify({
        date: today,
        count: count
    }));

    return count;
}

/**
 * 获取当前使用计数
 * @param feature 功能名称（如 'ocr', 'translation', 'batch_translation'）
 * @returns 当前计数值
 */
export function getCurrentUsageCount(feature: string): number {
    const storeKey = `usage_${feature}_counter`;
    const storedData = localStorage.getItem(storeKey);

    if (!storedData) {
        return 0;
    }

    try {
        const data = JSON.parse(storedData);
        const lastUsedDate = data.date;
        const count = data.count || 0;

        // 检查是否是今天
        const today = getTodayDateString();

        if (lastUsedDate !== today) {
            // 不是今天，计数应为0（因为计数已重置）
            return 0;
        }

        return count;
    } catch (error) {
        console.error('解析使用计数数据失败:', error);
        return 0;
    }
}

/**
 * 检查用户是否设置了自定义API密钥
 * @param platform 平台名称
 * @returns 用户是否设置了自定义密钥
 */
import type {TranslationPlatform} from '@/types/words';

export function hasCustomApiKey(platform: TranslationPlatform): boolean {
    // 本地平台和 Google 免费接口不需要API密钥，直接返回true
    if (platform === 'local' || platform === 'google') {
        return true;
    }

    const wordsStore = useWordsStore();
    const userKeys = wordsStore.getApiKey(platform);

    // 检查用户是否设置了密钥（非空且非默认值）
    if (!userKeys.appkey || !userKeys.key) {
        return false;
    }

    // 从配置文件中获取默认值进行比较
    if (platform === 'youdao' || platform === 'baidu' || platform === 'ali') {
      const defaultConfig = AppInfo[platform];
      if (defaultConfig) {
        return !(userKeys.appkey === defaultConfig.appkey && userKeys.key === defaultConfig.key);
      }
    }

    return true;
}

