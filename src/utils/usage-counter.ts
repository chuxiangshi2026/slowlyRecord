import { useWordsStore } from '@/stores/words.ts';
import { USAGE_LIMITS } from '@/constants';
import {type OcrResult,  ocrTranslateMultiPlatform} from "@/utils/pic-translate.ts";

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
    const limit = feature === 'ocr' ? USAGE_LIMITS.OCR_DAILY_LIMIT : USAGE_LIMITS.TRANSLATION_DAILY_LIMIT;
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
  const wordsStore = useWordsStore();
  const userKeys = wordsStore.getApiKey(platform);

  // 检查用户是否设置了密钥（非空且非默认值）
  if (!userKeys.appkey || !userKeys.key) {
    return false;
  }

  // 检查是否为默认配置（避免用户恰好设置了相同值的情况，这里我们假设默认值不太可能被用户重复设置）
  // 更准确的方式是比较是否与默认配置相同
  const defaultAppKey = 'REDACTED_YOUDAO_APPKEY'; // 有道默认值
  const defaultKey = 'REDACTED_YOUDAO_SECRET'; // 有道默认值

  // 对于不同平台检查不同的默认值
  if (platform === 'youdao') {
    return !(userKeys.appkey === defaultAppKey && userKeys.key === defaultKey);
  } else if (platform === 'baidu') {
    // 检查是否为百度默认值
    return !(userKeys.appkey === 'REDACTED_BAIDU_APPKEY' && userKeys.key === 'REDACTED_BAIDU_SECRET');
  } else if (platform === 'ali') {
    // 检查是否为阿里默认值
    return !(userKeys.appkey === 'REDACTED_ALI_APPKEY' && userKeys.key === 'REDACTED_ALI_SECRET');
  }

  return true;
}

// 新增：多平台OCR翻译函数
export async function ocrMultiPlatform(
    file: File,
    platform: 'youdao' | 'baidu' | 'ali' = 'youdao'
): Promise<OcrResult> {
    // 检查是否超出了每日使用限制
    if (!hasCustomApiKey(platform)) {
        // 如果没有自定义API密钥，检查是否超过每日限制
        // OCR翻译使用独立的计数
        if (isOverDailyLimit('ocr')) {
            const limit = USAGE_LIMITS.OCR_DAILY_LIMIT;
            const currentCount = getCurrentUsageCount('ocr');
            throw new Error(`每日免费截图翻译次数已达上限 (${currentCount}/${limit} 次)，请设置自定义API密钥以继续使用`);
        }

        // 增加使用计数
        const newCount = incrementUsageCounter('ocr');
        console.log(`OCR使用次数: ${newCount}/${USAGE_LIMITS.OCR_DAILY_LIMIT}`);
    }

    // const wordsStore = useWordsStore();
    // const { appkey, key } = wordsStore.getApiKey(platform);

    // 如果是使用有道平台，继续使用原有的OCR翻译

    return  ocrTranslateMultiPlatform(file,platform)
    // if (platform === 'youdao') {
    //     return ocrTranslate(file, appkey, key, 'en', 'zh-CHS');
    // } else if (platform === 'baidu') {
    //     // 百度OCR API的调用逻辑
    //     return await ocrTranslateBaidu(file, appkey, key);
    // } else if (platform === 'ali') {
    //     // 阿里OCR API的调用逻辑
    //     return await ocrTranslateAli(file, appkey, key);
    // }

    // return {
    //     errorCode: '500',
    //     resRegions: []
    // };
}
