/**
 * 各翻译/OCR 引擎的语言代码映射
 * 集中一处维护；不支持的组合返回 null，由调用方显式降级（如回退本地 OCR）
 * 代码表依据各引擎官方文档：
 *  - 百度翻译: https://fanyi-api.baidu.com/doc/21 (ja/rue/spa/fr...)
 *  - 有道翻译: q=语言代码 (ja/fr/ru/es...)
 *  - 阿里翻译: https://help.aliyun.com/document_detail/1916981.html (ja/ru/fr/es...)
 *  - 腾讯翻译: https://cloud.tencent.com/document/product/551/15619 (ja/fr/ru/es...)
 *  - 百度OCR:  https://cloud.baidu.com/doc/OCR/s/8k3h7y26b (JAP/RUS/SPA_FRA_LATE/FRE...)
 */
import type { LanguageCode } from '@/utils/language'

type EngineLangMap = Partial<Record<LanguageCode, string>>

/** 翻译引擎源语言映射（'en' 映射到各引擎的英语代码） */
const TRANSLATE_MAPS: Partial<Record<string, EngineLangMap>> = {
    youdao: { en: 'en', ja: 'ja', ru: 'ru', es: 'es', fr: 'fr' },
    baidu: { en: 'en', ja: 'jp', ru: 'ru', es: 'spa', fr: 'fra' },
    ali: { en: 'en', ja: 'ja', ru: 'ru', es: 'es', fr: 'fr' },
    tencent: { en: 'en', ja: 'ja', ru: 'ru', es: 'es', fr: 'fr' },
};

/** OCR 引擎源语言映射（百度 OCR 用大写专有代码） */
const OCR_MAPS: Partial<Record<string, EngineLangMap>> = {
    youdao: { en: 'en', ja: 'ja', ru: 'ru', es: 'es', fr: 'fr' },
    baidu: { en: 'ENG', ja: 'JAP', ru: 'RUS', es: 'SPA', fr: 'FRE' },
    tencent: { en: 'auto', ja: 'auto', ru: 'auto', es: 'auto', fr: 'auto' }, // 腾讯 OCR auto 识别
};

/**
 * 翻译引擎的源语言代码；平台不支持该语言时返回 null
 * AI 引擎（glm/deepseek/qwen/kimi/ollama/minimax/hunyuan/openai/claude/gemini/utoolsai）
 * 语言无关，直接返回语言代码
 */
export function toEngineLang(platform: string, lang: LanguageCode, kind: 'translate' | 'ocr' = 'translate'): string | null {
    const map = kind === 'ocr' ? OCR_MAPS[platform] : TRANSLATE_MAPS[platform];
    if (!map) return lang; // AI 引擎或未注册平台：语言无关，原样透传
    return map[lang] ?? null;
}
