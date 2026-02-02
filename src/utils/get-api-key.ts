import type {OcrPlatform, TranslationPlatform} from "@/types/words";
import {useWordsStore} from "@/stores/words.ts";
import {AppInfo, OcrKeyInfo} from "@/config.ts";

/**
 * 获取当前使用的API密钥 - 优先使用用户设置的，否则使用默认配置
 */
export function getTranslationApiKey(provider: TranslationPlatform) {
    const wordsStore = useWordsStore();
    const userKeys = wordsStore.getApiKey(provider);
    // 如果用户设置了密钥（非空且非纯空格），则使用用户设置的；否则使用默认配置
    const trimmedAppKey = userKeys.appkey?.trim();
    const trimmedKey = userKeys.key?.trim();
    return {
        appkey: (trimmedAppKey && trimmedAppKey.length > 0) ? trimmedAppKey : AppInfo[provider].appkey,
        key: (trimmedKey && trimmedKey.length > 0) ? trimmedKey : AppInfo[provider].key
    };
}


export function getOcrApiKey(provider: OcrPlatform) {
    const wordsStore = useWordsStore();
    const userKeys = wordsStore.getOcrApiKey(provider);
    
    // 添加安全检查，防止userKeys为undefined
    if (!userKeys) {
        console.warn(`未找到${provider}平台的OCR API密钥配置，使用默认配置`);
        return {
            appkey: OcrKeyInfo[provider]?.appkey || '',
            key: OcrKeyInfo[provider]?.key || ''
        };
    }
    
    // 如果用户设置了密钥（非空且非纯空格），则使用用户设置的；否则使用默认配置
    const trimmedAppKey = userKeys.appkey?.trim();
    const trimmedKey = userKeys.key?.trim();
    return {
        appkey: (trimmedAppKey && trimmedAppKey.length > 0) ? trimmedAppKey : OcrKeyInfo[provider]?.appkey || '',
        key: (trimmedKey && trimmedKey.length > 0) ? trimmedKey : OcrKeyInfo[provider]?.key || ''
    };
}


