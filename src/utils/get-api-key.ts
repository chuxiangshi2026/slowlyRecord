import type {OcrPlatform, TranslationPlatform} from "@/types/words";
import {useWordsStore} from "@/stores/words.ts";
import {AppInfo, OcrKeyInfo} from "@/config.ts";

/**
 * 获取当前使用的API密钥 - 优先使用用户设置的，否则使用默认配置
 */
export function getTranslationApiKey(provider: TranslationPlatform) {
    // 本地翻译不需要API密钥，提前短路避免无谓的 store 访问
    if (provider === 'local') {
        return { appkey: '', key: '' };
    }

    const wordsStore = useWordsStore();
    const userKeys = wordsStore.getApiKey(provider);

    // 安全检查：当 store 返回 undefined/null（例如测试桩或新平台未配置）时降级到默认配置
    if (!userKeys) {
        return {
            appkey: AppInfo[provider]?.appkey ?? '',
            key: AppInfo[provider]?.key ?? '',
        };
    }

    // 如果用户设置了密钥（非空且非纯空格），则使用用户设置的；否则使用默认配置
    const trimmedAppKey = userKeys.appkey?.trim();
    const trimmedKey = userKeys.key?.trim();

    return {
        appkey: (trimmedAppKey && trimmedAppKey.length > 0) ? trimmedAppKey : (AppInfo[provider]?.appkey ?? ''),
        key: (trimmedKey && trimmedKey.length > 0) ? trimmedKey : (AppInfo[provider]?.key ?? '')
    };
}


export function getOcrApiKey(provider: OcrPlatform) {
    const wordsStore = useWordsStore();
    const userKeys = wordsStore.getOcrApiKey(provider);

    // 添加调试日志
    console.log(`getOcrApiKey调用: provider=${provider}, userKeys=`, userKeys);

    // 添加安全检查，防止userKeys为undefined
    if (!userKeys) {
        console.warn(`未找到${provider}平台的OCR API密钥配置，使用默认配置`);
        const result = {
            appkey: OcrKeyInfo[provider]?.appkey || '',
            key: OcrKeyInfo[provider]?.key || ''
        };
        console.log(`使用默认配置:`, result);
        return result;
    }

    // 如果用户设置了密钥（非空且非纯空格），则使用用户设置的；否则使用默认配置
    const trimmedAppKey = userKeys.appkey?.trim();
    const trimmedKey = userKeys.key?.trim();
    const result = {
        appkey: (trimmedAppKey && trimmedAppKey.length > 0) ? trimmedAppKey : OcrKeyInfo[provider]?.appkey || '',
        key: (trimmedKey && trimmedKey.length > 0) ? trimmedKey : OcrKeyInfo[provider]?.key || ''
    };
    console.log(`返回的API密钥: appkey=${result.appkey ? '已设置' : '未设置'}, key=${result.key ? '已设置' : '未设置'}`);
    return result;
}


