import type {TranslationPlatform, TranslationResult, YdParams} from "@/types/words";
import http from "@/utils/http.ts";
import type {AxiosResponse} from 'axios';
import CryptoJS from "crypto-js";
import {FROM, TO, USAGE_LIMITS} from "@/constants";
import {AppInfo} from "@/config.ts";
import {useWordsStore} from "@/stores/words.ts";
import {getCurrentUsageCount, hasCustomApiKey, incrementUsageCounter, isOverDailyLimit} from './usage-counter';
import {batchTranslateAndAddWords} from "@/utils/str-util.ts";
import {log} from "@/utils/logger.ts";
import {getTranslationApiKey} from "@/utils/get-api-key.ts";
import {translateWithLocalDictionaryAsync} from "./local-dictionary";

// 发音URL缓存 Map
const pronunciationCache = new Map<string, string>();

// 翻译结果内存缓存（按 platform+query 维度），TTL 7 天
// 避免相同单词在批量添加 / 重复操作时反复打 API
interface TranslationCacheEntry {
    result: TranslationResult;
    ts: number;
}
const translationCache = new Map<string, TranslationCacheEntry>();
const TRANSLATION_CACHE_TTL = 7 * 24 * 3600 * 1000;
// 上限保护，防止长时间运行后内存膨胀
const TRANSLATION_CACHE_MAX = 5000;

function translationCacheKey(query: string, platform: string, from: string, to: string): string {
    return `${platform}|${from}|${to}|${query.toLowerCase().trim()}`;
}

function getCachedTranslation(query: string, platform: string, from: string, to: string): TranslationResult | null {
    const key = translationCacheKey(query, platform, from, to);
    const hit = translationCache.get(key);
    if (!hit) return null;
    if (Date.now() - hit.ts > TRANSLATION_CACHE_TTL) {
        translationCache.delete(key);
        return null;
    }
    return hit.result;
}

function setCachedTranslation(query: string, platform: string, from: string, to: string, result: TranslationResult): void {
    // 仅缓存成功结果，失败/限流不进缓存以便下次重试
    if (!result || !result.success) return;
    // LRU 简化版：超上限时清理最旧 1/4
    if (translationCache.size >= TRANSLATION_CACHE_MAX) {
        const removeCount = Math.floor(TRANSLATION_CACHE_MAX / 4);
        const it = translationCache.keys();
        for (let i = 0; i < removeCount; i++) {
            const k = it.next().value;
            if (k === undefined) break;
            translationCache.delete(k);
        }
    }
    translationCache.set(translationCacheKey(query, platform, from, to), {
        result,
        ts: Date.now(),
    });
}

// TTS 配置
interface TTSConfig {
    name: string;
    url: string;
    priority: number; // 数字越小优先级越高
}

// TTS 源列表（按优先级排序）
const TTS_SOURCES: TTSConfig[] = [
    {
        name: 'edge',
        url: 'https://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1',
        priority: 1
    },
    {
        name: 'youdao',
        url: 'https://dict.youdao.com/dictvoice?audio={word}&type=1',
        priority: 2
    }
];

/**
 * 生成 Edge TTS 的请求配置
 * Edge TTS 使用 WebSocket 或特殊的 HTTP 请求
 */
function generateEdgeTTSConfig(word: string) {
    const voice = 'en-US-AnaNeural'; // 美式英语女声，音质很好
    const outputFormat = 'audio-24khz-48kbitrate-mono-mp3';

    // SSML 格式
    const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US">
        <voice name="${voice}">
            <prosody rate="0%" pitch="0%">${word}</prosody>
        </voice>
    </speak>`;

    return {
        url: `https://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=6A5AA1D4EAFF4E9FB37E23D68491D6F4`,
        headers: {
            'Authority': 'speech.platform.bing.com',
            'Cache-Control': 'max-age=0',
            'Sec-Ch-Ua': '"Not/A)Brand";v="99", "Microsoft Edge";v="115", "Chromium";v="115"',
            'Sec-Ch-Ua-Mobile': '?0',
            'Sec-Ch-Ua-Platform': '"Windows"',
            'Upgrade-Insecure-Requests': '1',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.0',
            'Accept': '*/*',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-Mode': 'cors',
            'Sec-Fetch-Dest': 'audio',
            'Accept-Encoding': 'gzip, deflate, br',
            'Accept-Language': 'en-US,en;q=0.9',
        },
        ssml,
        voice,
        outputFormat
    };
}

/**
 * 获取单词发音URL
 * 优先使用 Edge TTS（音质最好），回退到有道TTS
 * 带缓存机制
 */
async function getPronunciationUrl(word: string): Promise<string> {
    const cacheKey = word.toLowerCase().trim();

    // 1. 检查缓存
    if (pronunciationCache.has(cacheKey)) {
        return pronunciationCache.get(cacheKey)!;
    }

    // 2. 优先使用 Edge TTS（通过代理或直接使用）
    // 由于浏览器 CORS 限制，这里返回有道 TTS 的 URL
    // 实际的 Edge TTS 调用在 speakWithEdgeTTS 函数中
    const youdaoTtsUrl = `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(word)}&type=1`;
    pronunciationCache.set(cacheKey, youdaoTtsUrl);
    return youdaoTtsUrl;
}

/**
 * 同步获取发音URL（使用有道，稳定可靠）
 */
function getPronunciationUrlSync(word: string): string {
    const cacheKey = word.toLowerCase().trim();

    // 检查缓存
    if (pronunciationCache.has(cacheKey)) {
        return pronunciationCache.get(cacheKey)!;
    }

    // 使用有道TTS（最稳定，CORS 友好）
    const youdaoTtsUrl = `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(word)}&type=1`;
    pronunciationCache.set(cacheKey, youdaoTtsUrl);
    return youdaoTtsUrl;
}

/**
 * 等待语音列表加载完成
 */
function waitForVoices(): Promise<SpeechSynthesisVoice[]> {
    return new Promise((resolve) => {
        const voices = window.speechSynthesis.getVoices();
        if (voices.length > 0) {
            resolve(voices);
            return;
        }

        // 语音列表还未加载，等待加载完成
        window.speechSynthesis.onvoiceschanged = () => {
            resolve(window.speechSynthesis.getVoices());
        };

        // 超时处理（2秒）
        setTimeout(() => {
            resolve(window.speechSynthesis.getVoices());
        }, 2000);
    });
}

/**
 * 检测运行环境
 */
function detectEnvironment(): { isUTools: boolean; isEdge: boolean; isChrome: boolean } {
    const ua = navigator.userAgent;
    return {
        isUTools: typeof (window as any).utools !== 'undefined',
        isEdge: ua.includes('Edg'),
        isChrome: ua.includes('Chrome') && !ua.includes('Edg')
    };
}

/**
 * 使用 Edge TTS 播放发音（最佳音质）
 * 适配 uTools/Chromium 环境
 */
export async function speakWithEdgeTTS(word: string): Promise<boolean> {
    try {
        console.log('尝试使用 Edge TTS:', word);

        const env = detectEnvironment();
        console.log('运行环境:', env);

        // 等待语音列表加载
        const voices = await waitForVoices();
        console.log('可用语音总数:', voices.length);

        // 打印所有英文语音供调试
        const englishVoices = voices.filter(v => v.lang.startsWith('en'));
        console.log('可用英文语音:', englishVoices.map(v => v.name));

        // uTools/Chromium 环境：优先使用 Google 语音（音质好）
        if (env.isUTools || env.isChrome) {
            const googleVoices = voices.filter(v =>
                v.name.includes('Google') && v.lang.startsWith('en')
            );

            if (googleVoices.length > 0) {
                const utterance = new SpeechSynthesisUtterance(word);
                utterance.lang = 'en-US';
                utterance.rate = 0.9;
                utterance.pitch = 1;
                utterance.volume = 1;

                // 优先选择 US 语音
                const voice = googleVoices.find(v => v.lang === 'en-US') ||
                             googleVoices.find(v => v.name.includes('US')) ||
                             googleVoices[0];

                utterance.voice = voice;
                console.log('使用 Google 语音 (uTools):', voice.name);

                return new Promise((resolve) => {
                    utterance.onstart = () => console.log('TTS 开始播放:', word);
                    utterance.onend = () => {
                        console.log('TTS 播放完成');
                        resolve(true);
                    };
                    utterance.onerror = (e) => {
                        console.error('TTS 播放错误:', e);
                        resolve(false);
                    };
                    window.speechSynthesis.speak(utterance);
                });
            }
        }

        // Edge 浏览器环境：优先使用 Microsoft 语音
        if (env.isEdge) {
            const microsoftVoices = voices.filter(v =>
                v.name.includes('Microsoft') && v.lang.startsWith('en')
            );

            if (microsoftVoices.length > 0) {
                const utterance = new SpeechSynthesisUtterance(word);
                utterance.lang = 'en-US';
                utterance.rate = 1.0;
                utterance.pitch = 1;
                utterance.volume = 1;

                const voice = microsoftVoices.find(v => v.name.includes('Online') && v.name.includes('Aria')) ||
                             microsoftVoices.find(v => v.name.includes('Online')) ||
                             microsoftVoices[0];

                utterance.voice = voice;
                console.log('使用 Microsoft 语音 (Edge):', voice.name);

                return new Promise((resolve) => {
                    utterance.onstart = () => console.log('TTS 开始播放:', word);
                    utterance.onend = () => {
                        console.log('TTS 播放完成');
                        resolve(true);
                    };
                    utterance.onerror = (e) => {
                        console.error('TTS 播放错误:', e);
                        resolve(false);
                    };
                    window.speechSynthesis.speak(utterance);
                });
            }
        }

        // Fallback：使用任意可用英文语音
        if (englishVoices.length > 0) {
            const utterance = new SpeechSynthesisUtterance(word);
            utterance.voice = englishVoices[0];
            utterance.lang = 'en-US';
            utterance.rate = 0.9;

            console.log('使用默认语音:', englishVoices[0].name);

            return new Promise((resolve) => {
                utterance.onend = () => resolve(true);
                utterance.onerror = () => resolve(false);
                window.speechSynthesis.speak(utterance);
            });
        }

        console.log('未找到合适的语音');
        return false;
    } catch (error) {
        console.warn('Edge TTS 失败:', error);
        return false;
    }
}

/**
 * 使用 Web Speech API 播放发音（支持 Microsoft Edge 语音）
 * 在 Edge 浏览器中会自动使用 Microsoft 的高质量语音
 */
export function speakWithWebSpeech(word: string): boolean {
    if (!('speechSynthesis' in window)) {
        console.warn('浏览器不支持 Web Speech API');
        return false;
    }

    // 取消当前正在播放的语音
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(word);
    utterance.lang = 'en-US';
    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.volume = 1;

    // 优先选择 Microsoft 语音（Edge 浏览器内置，音质最好）
    const voices = window.speechSynthesis.getVoices();

    // Microsoft 语音优先级列表
    const preferredVoices = [
        'Microsoft Aria Online (Natural) - English (United States)',
        'Microsoft Ana Online (Natural) - English (United States)',
        'Microsoft Jenny Online (Natural) - English (United States)',
        'Microsoft Guy Online (Natural) - English (United States)',
        'Microsoft Eric Online (Natural) - English (United States)',
        'Microsoft Steffan Online (Natural) - English (United States)',
        'Microsoft Sonia Online (Natural) - English (United Kingdom)',
        'Microsoft Libby Online (Natural) - English (United Kingdom)',
        'Microsoft Ryan Online (Natural) - English (United Kingdom)',
        'Microsoft Aria - English (United States)',
        'Microsoft Zira - English (United States)',
        'Microsoft David - English (United States)',
        'Microsoft Mark - English (United States)',
    ];

    // 查找最佳语音
    let selectedVoice = voices.find(v => preferredVoices.includes(v.name));

    // 如果没找到 Microsoft 语音，找其他英文语音
    if (!selectedVoice) {
        selectedVoice = voices.find(v =>
            v.lang.startsWith('en') &&
            (v.name.includes('Google') || v.name.includes('Samantha') || v.name.includes('Daniel'))
        );
    }

    // 最后 fallback 到任意英文语音
    if (!selectedVoice) {
        selectedVoice = voices.find(v => v.lang.startsWith('en'));
    }

    if (selectedVoice) {
        utterance.voice = selectedVoice;
        console.log('使用语音:', selectedVoice.name);
    } else {
        console.log('使用默认语音');
    }

    utterance.onstart = () => console.log('Web Speech 开始播放:', word);
    utterance.onend = () => console.log('Web Speech 播放完成');
    utterance.onerror = (e) => console.error('Web Speech 播放错误:', e);

    window.speechSynthesis.speak(utterance);
    return true;
}

/**
 * 获取可用的语音列表（用于调试）
 */
export function getAvailableVoices(): SpeechSynthesisVoice[] {
    if (!('speechSynthesis' in window)) {
        return [];
    }
    return window.speechSynthesis.getVoices();
}

/**
 * 打印所有可用语音（调试用）
 */
export function logAvailableVoices(): void {
    const voices = getAvailableVoices();
    console.log('=== 可用语音列表 ===');
    voices
        .filter(v => v.lang.startsWith('en'))
        .forEach((v, i) => {
            console.log(`${i + 1}. ${v.name} (${v.lang}) ${v.default ? '- 默认' : ''}`);
        });
}

/**
 * 获取当前使用的API密钥 - 优先使用用户设置的，否则使用默认配置
 */

/*function getApiKey(provider: TranslationPlatform) {
    const wordsStore = useWordsStore();
    const userKeys = wordsStore.getApiKey(provider);
    // 如果用户设置了密钥（非空且非纯空格），则使用用户设置的；否则使用默认配置
    const trimmedAppKey = userKeys.appkey?.trim();
    const trimmedKey = userKeys.key?.trim();
    return {
        appkey: (trimmedAppKey && trimmedAppKey.length > 0) ? trimmedAppKey : AppInfo[provider].appkey,
        key: (trimmedKey && trimmedKey.length > 0) ? trimmedKey : AppInfo[provider].key
    };
}*/

/**
 * 生成有道翻译签名所需的 input 字段
 * 有道 v3 签名算法规则：
 *   - 当 q 的字符长度 <= 20 时，input = q
 *   - 当 q 的字符长度 > 20 时，input = q[0:10] + q.length + q[-10:]
 *
 * 注意：这里必须按 UTF-16 code unit 长度处理（与有道服务端一致），
 * 不能直接用 lodash 的 truncate（lodash 是「截断+...」语义，与有道无关）。
 *
 * 历史 bug：之前误用 lodash.truncate，导致 q 长度 > 20 时签名永远算错，
 * 服务端返回 errorCode=202（签名检验失败）。
 */
function youdaoSignInput(q: string): string {
    if (!q) return '';
    if (q.length <= 20) return q;
    return q.substring(0, 10) + q.length + q.substring(q.length - 10);
}

/**
 * 生成有道翻译签名参数
 */
function generateYoudaoParams(query: string, from: string = 'auto', to: string = 'zh'): YdParams {
    const {appkey, key} = getTranslationApiKey('youdao');
    const salt = (new Date).getTime();
    const curtime = Math.round(new Date().getTime() / 1000);
    const str1 = appkey + youdaoSignInput(query) + salt + curtime + key;
    const sign = CryptoJS.SHA256(str1).toString(CryptoJS.enc.Hex);

    return {
        q: query,
        appKey: appkey,
        salt: salt,
        from: from === 'auto' ? 'auto' : from,
        to: to,
        sign: sign,
        signType: "v3",
        curtime: curtime,
        ext: 'mp3'
    };
}

/**
 * 生成百度翻译签名参数
 */
function generateBaiduParams(query: string, from: string = 'auto', to: string = 'zh'): any {
    const {appkey, key: secretKey} = getTranslationApiKey('baidu');
    const appId = appkey;
    const salt = '' + (new Date).getTime();
    const signStr = appId + query + salt + secretKey;
    const sign = CryptoJS.MD5(signStr).toString();
    return {
        q: query,
        from: from === 'auto' ? 'auto' : from,
        to: to,
        appid: appId,
        salt: salt,
        sign: sign
    };
}

/**
 * 生成阿里翻译参数
 */
function generateAliParamsSync(query: string, from: string = 'auto', to: string = 'zh'): any {
    const {appkey, key: accessKeySecret} = getTranslationApiKey('ali');
    const timestamp = new Date().toISOString().replace(/\.\d+Z/, 'Z');

    const params: Record<string, string> = {
        Format: 'JSON',
        Version: '2018-10-12',
        AccessKeyId: appkey,
        SignatureMethod: 'HMAC-SHA1',
        Timestamp: timestamp,
        SignatureVersion: '1.0',
        SignatureNonce: Math.random().toString(36).slice(2, 15),
        Action: 'TranslateGeneral',
        SourceLanguage: from === 'auto' ? 'auto' : from,
        TargetLanguage: to,
        SourceText: String(query),
        FormatType: 'text',
        Scene: 'general',
    };

    // 生成签名
    const signature = buildSignature(params, accessKeySecret);
    params.Signature = signature;

    return params;
}

/**
 * 构建阿里云API签名
 */
function buildSignature(params: any, accessKeySecret: string): string {
    // 参数排序
    const sortedKeys = Object.keys(params).sort();

    // 构建规范化的请求字符串
    let canonicalizedQueryString = '';
    for (const key of sortedKeys) {
        if (key !== 'Signature') { // 排除Signature参数
            canonicalizedQueryString += `&${percentEncode(key)}=${percentEncode(params[key])}`;
        }
    }

    // 移除第一个&
    canonicalizedQueryString = canonicalizedQueryString.substring(1);

    // 构建待签名字符串
    const stringToSign = `GET&${percentEncode('/')}&${percentEncode(canonicalizedQueryString)}`;

    // 使用HMAC-SHA1算法计算签名
    const signature = CryptoJS.HmacSHA1(stringToSign, `${accessKeySecret}&`);
    return CryptoJS.enc.Base64.stringify(signature);
}

/**
 * URL编码函数
 */
function percentEncode(str: string): string {
    // 遵循RFC3986编码规则
    return encodeURIComponent(str)
        .replace(/\!/g, '%21')
        .replace(/\*/g, '%2A')
        .replace(/\'/g, '%27')
        .replace(/\(/g, '%28')
        .replace(/\)/g, '%29');
}

/**
 * 调用不同平台的翻译接口
 */
export async function translateWithPlatform(
    query: string,
    platform: TranslationPlatform = 'tencent',
    from: string = 'auto',
    to: string = 'zh'
): Promise<TranslationResult> {
    log.i('待翻译参数', query)

    // 缓存优先：相同 (platform, from, to, query) 7 天内直接返回，避免重复打 API
    // 注意：ollama / local 也走缓存，不影响正确性（命中即为之前同一引擎的成功结果）
    const cached = getCachedTranslation(query, platform, from, to);
    if (cached) {
        log.i('翻译缓存命中', query, platform);
        return cached;
    }

    try {
        // 本地翻译不使用限制检查
        if (platform !== 'local') {
            // 检查是否超出了每日使用限制
            if (!hasCustomApiKey(platform)) {
                // 如果没有自定义API密钥，检查是否超过每日限制
                // 普通翻译和批量翻译一起计数
                const featureType = 'translation'; // 普通翻译与批量翻译共用计数

                if (isOverDailyLimit(featureType)) {
                    const usedCount = getCurrentUsageCount(featureType);
                    return {
                        success: false,
                        errorMsg: `每日免费翻译次数已达上限 (${usedCount}/${USAGE_LIMITS.TRANSLATION_DAILY_LIMIT} 次)，请设置自定义API密钥以继续使用`
                    };
                }

                // 增加使用计数
                const newCount = incrementUsageCounter(featureType);
                log.i(`翻译使用次数: ${newCount}/${USAGE_LIMITS.TRANSLATION_DAILY_LIMIT}`);
            }
        }

        switch (platform) {
            case 'youdao':
                console.log('调用有道')
                const youdaoParams = generateYoudaoParams(query, from, to);
                const youdaoResponse = await http.get('/', {...youdaoParams}, {
                    headers: {
                        'Access-Control-Allow-Origin': 'https://openapi.youdao.com/api'
                    }
                });
                console.log('请求结果')
                {
                    const r = handleYoudaoResponse(youdaoResponse.data, query);
                    setCachedTranslation(query, platform, from, to, r);
                    return r;
                }

            case 'baidu':
                const baiduParams = generateBaiduParams(query, from, to);
                baiduParams.q = encodeURIComponent(baiduParams.q);
                const baiduResponse = await http.get('https://fanyi-api.baidu.com/api/trans/vip/translate', {...baiduParams}, {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    }
                });
                {
                    const r = handleBaiduResponse(baiduResponse.data, query);
                    setCachedTranslation(query, platform, from, to, r);
                    return r;
                }

            case 'ali':
                log.i('调用阿里翻译');
                const aliParams = generateAliParamsSync(query, from, to);
                const queryString = Object.entries(aliParams)
                    .map(([key, value]) => `${encodeURIComponent(key as string)}=${encodeURIComponent(value as string)}`)
                    .join('&');
                const fullUrl = `https://mt.aliyuncs.com/?${queryString}`;
                const aliResponse = await fetch(fullUrl, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                    }
                });
                const aliData = await aliResponse.json();
                {
                    const r = handleAliResponse(aliData, query);
                    setCachedTranslation(query, platform, from, to, r);
                    return r;
                }
            case 'utoolsai':
                let utoolAiData = await callUtoolsAi(query, from, to);
                console.log('utool', utoolAiData)
                setCachedTranslation(query, platform, from, to, utoolAiData);
                return utoolAiData;
            case 'deepseek':
                console.log('调用DeepSeek')
                {
                    const r = await callDeepSeek(query, from, to);
                    setCachedTranslation(query, platform, from, to, r);
                    return r;
                }
            case 'qwen':
                console.log('调用通义千问')
                {
                    const r = await callQwen(query, from, to);
                    setCachedTranslation(query, platform, from, to, r);
                    return r;
                }
            case 'kimi':
                console.log('调用Kimi')
                {
                    const r = await callKimi(query, from, to);
                    setCachedTranslation(query, platform, from, to, r);
                    return r;
                }
            case 'glm':
                console.log('调用智谱GLM')
                {
                    const r = await callGlm(query, from, to);
                    setCachedTranslation(query, platform, from, to, r);
                    return r;
                }
            case 'ollama':
                console.log('调用Ollama')
                {
                    const r = await callOllama(query, from, to);
                    setCachedTranslation(query, platform, from, to, r);
                    return r;
                }
            case 'tencent':
                console.log('调用腾讯翻译')
                {
                    const r = await callTencent(query, from, to);
                    setCachedTranslation(query, platform, from, to, r);
                    return r;
                }
            case 'local':
                console.log('调用本地词典翻译, 查询词:', query)
                const localResult = await translateWithLocalDictionaryAsync(query);
                console.log('本地翻译结果:', localResult)
                if (!localResult.success) {
                    console.log('本地词典未收录，直接显示原文:', query)
                    const fallback: TranslationResult = {
                        success: true,
                        explains: query,
                        phonetic: '',
                        pronunciation: ''
                    };
                    setCachedTranslation(query, platform, from, to, fallback);
                    return fallback;
                }
                setCachedTranslation(query, platform, from, to, localResult);
                return localResult;
            /*           case 'google':
                           // Google翻译API通常需要服务端实现，这里提供基本结构
                           const googleParams = {
                               q: query,
                               source: FROM,
                               target: TO,
                               format: 'text'
                           };
                           // 注意：Google翻译API需要服务端实现，因为浏览器端直接调用会有CORS问题
                           const googleResponse = await http.get('https://translation.googleapis.com/language/translate/v2', { ...googleParams });
                           return handleGoogleResponse(googleResponse.data);*/

            default:
                return {
                    success: false,
                    errorMsg: 'Unsupported translation platform'
                };
        }
    } catch (error) {
        console.error('Translation error:', error);
        return {
            success: false,
            errorMsg: 'Translation failed: ' + (error as Error).message
        };
    }
}

/**
 * 处理有道翻译返回结果
 */
function handleYoudaoResponse(data: any, query: string): TranslationResult {
    if (data.errorCode === '0') {
        const explains = data.translation?.[0] || '';
        const phonetic = data.basic?.phonetic || '';
        // 优先使用有道发音（更可靠），百度作为备选
        const pronunciation = `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(query)}&type=1`;

        return {
            success: true,
            explains,
            phonetic,
            pronunciation
        };
    } else {
        return {
            success: false,
            errorMsg: `Youdao API error: ${data.errorCode}`
        };
    }
}

/**
 * 处理百度翻译返回结果
 */
function handleBaiduResponse(data: any, query: string): TranslationResult {
    if (data.error_code === undefined || data.error_code === '52000') {
        const explains = data.trans_result?.[0]?.dst || '';
        // 使用统一的发音获取（优先百度）
        const pronunciation = getPronunciationUrlSync(query);
        return {
            success: true,
            explains,
            pronunciation
        };
    } else {
        return {
            success: false,
            errorMsg: `Baidu API error: ${data.error_code}`
        };
    }
}

/**
 * 处理阿里翻译响应
 */
function handleAliResponse(data: any, query: string): TranslationResult {
    console.log("ali返回结果", data)
    if (data.Code === '200' && data.Data) {
        const explains = data.Data.Translated;
        // 使用统一的发音获取（优先百度，回退有道）
        const pronunciation = getPronunciationUrlSync(query);
        return {
            success: true,
            explains,
            pronunciation
        };
    } else {
        return {
            success: false,
            errorMsg: `Ali API error: ${data.Message || 'Unknown error'}`
        };
    }
}

/**
 * 处理谷歌翻译返回结果
 */
function handleGoogleResponse(data: any): TranslationResult {
    if (data.data) {
        const explains = data.data.translations?.[0]?.translatedText || '';
        return {
            success: true,
            explains
        };
    } else {
        return {
            success: false,
            errorMsg: 'Google API error'
        };
    }
}

/**
 * 调用uTools AI引擎
 */
async function callUtoolsAi(query: string, from: string = 'auto', to: string = 'zh'): Promise<TranslationResult> {
    try {
        // 根据语言方向确定翻译指令
        const isToEnglish = to === 'en';
        const targetLang = isToEnglish ? '英文' : '中文';
        const sourceLang = from === 'zh' ? '中文' : (from === 'en' ? '英文' : '文本');

        const messages = [
            {
                role: "system" as const,
                content: `你是一个专业翻译专家，请将${sourceLang}翻译成${targetLang}，翻译结果要地道自然。`
            },
            {
                role: 'user' as const,
                content: query,
            }]

        // 尝试调用AI服务，使用类型断言避免编译错误
        const utoolsApi = (window as any).utools;
        if (!utoolsApi?.ai) {
            return { success: false, errorMsg: 'uTools AI 不可用' };
        }
        const result: any = await utoolsApi.ai({messages});

        // 获取发音URL
        const pronunciation = getPronunciationUrlSync(query);

        if (result && typeof result === 'object' && 'content' in result) {
            return {
                success: true,
                explains: result.content as string,
                pronunciation
            };
        } else if (typeof result === 'string') {
            return {
                success: true,
                explains: result,
                pronunciation
            };
        } else {
            return {
                success: false,
                errorMsg: 'uTools AI 失败'
            };
        }
    } catch (error) {
        console.error('uTools AI error:', error);
        return {
            success: false,
            errorMsg: 'uTools AI 服务错误: ' + (error as Error).message
        };
    }
}

/**
 * 调用Ollama本地模型
 */
async function callOllama(query: string, from: string = 'auto', to: string = 'zh'): Promise<TranslationResult> {
    try {
        const {appkey: baseUrl, key: modelName} = getTranslationApiKey('ollama');

        // 默认Ollama地址
        const ollamaUrl = baseUrl || 'http://localhost:11434';
        const model = modelName || 'qwen2.5:0.5b';

        // 根据语言方向确定翻译指令
        const isToEnglish = to === 'en';
        const targetLang = isToEnglish ? '英文' : '中文';
        const sourceLang = from === 'zh' ? '中文' : (from === 'en' ? '英文' : '文本');

        const response = await fetch(`${ollamaUrl}/api/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: model,
                prompt: `请将以下${sourceLang}翻译成${targetLang}：${query}`,
                stream: false
            })
        });

        if (!response.ok) {
            throw new Error(`Ollama request failed: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();

        // Ollama API 返回格式处理
        let translationResult = '';
        if (data.response) {
            // 直接返回模式
            translationResult = data.response.trim();
        } else if (data.message && data.message.content) {
            // 聊天模式返回
            translationResult = data.message.content.trim();
        } else if (typeof data === 'string') {
            // 字符串直接返回
            translationResult = data.trim();
        } else {
            // 其他情况尝试获取响应
            translationResult = data.output || data.result || JSON.stringify(data);
        }

        if (!translationResult || translationResult.toLowerCase().includes('error')) {
            throw new Error('Invalid response from Ollama: ' + translationResult);
        }

        // 获取发音URL
        const pronunciation = getPronunciationUrlSync(query);

        return {
            success: true,
            explains: translationResult,
            pronunciation
        };
    } catch (error) {
        console.error('Ollama error:', error);
        return {
            success: false,
            errorMsg: 'Ollama service error: ' + (error as Error).message
        };
    }
}

/**
 * 调用DeepSeek模型
 */
async function callDeepSeek(query: string, from: string = 'auto', to: string = 'zh'): Promise<TranslationResult> {
    try {
        const {appkey: apiKey, key: modelName} = getTranslationApiKey('deepseek');

        console.log('apikey', apiKey, modelName)
        if (!apiKey) {
            return {
                success: false,
                errorMsg: '请先配置DeepSeek模型密钥'
            };
        }

        const model = modelName || 'deepseek-chat';

        // 根据语言方向确定翻译方向和提示词
        const isToEnglish = to === 'en';
        const isEnglishToChinese = (from === 'en' || from === 'auto') && to === 'zh';

        let systemPrompt: string;

        if (isEnglishToChinese) {
            // 英文到中文：提供详细的单词学习信息
            systemPrompt = `你是一个专业的中英文翻译助手。请将用户输入的英文单词或短语翻译成中文，并以JSON格式返回以下信息：
{
  "translation": "中文翻译",
  "phonetic": "音标（如有）",
  "examples": [
    {"english": "英文例句1", "chinese": "中文翻译1"},
    {"english": "英文例句2", "chinese": "中文翻译2"}
  ],
  "synonyms": ["近义词1", "近义词2"],
  "antonyms": ["反义词1", "反义词2"],
  "memoryTip": "记忆提示：用词根词缀、发音规律、谐音联想、场景联想等方法帮助记忆这个单词",
  "memoryImage": "描述一个生动的画面，帮助通过视觉联想记住这个单词的含义"
}
注意：
1. 如果是单个单词，请提供音标、2-3个例句、近义词和反义词、记忆提示和记忆画面描述
2. 如果是短语或句子，只需提供translation和examples
3. memoryTip要求：使用中文，50字以内，优先使用词根词缀、发音规律等语言学方法，也可用谐音联想
4. memoryImage要求：用中文描述一个具体的视觉画面（如：一只大象在...），帮助用户通过画面感记住单词，80字以内
5. 必须返回有效的JSON格式，不要添加任何其他文字说明`;
        } else if (isToEnglish) {
            // 中文到英文
            systemPrompt = `你是一个专业的中英文翻译助手。请将用户输入的中文翻译成英文，并以JSON格式返回以下信息：
{
  "translation": "英文翻译",
  "phonetic": "音标（如有）",
  "examples": [
    {"english": "英文例句1", "chinese": "中文翻译1"},
    {"english": "英文例句2", "chinese": "中文翻译2"}
  ],
  "synonyms": ["英文近义词1", "英文近义词2"],
  "antonyms": ["英文反义词1", "英文反义词2"],
  "memoryTip": "记忆提示：用中文解释如何记忆这个英文表达，可以是词根词缀、联想等方法",
  "memoryImage": "描述一个生动的画面，帮助通过视觉联想记住这个英文表达"
}
注意：
1. 如果是单个单词或短语，请提供音标、2-3个例句、近义词和反义词、记忆提示和记忆画面描述
2. 如果是长句子，只需提供translation和examples
3. memoryTip要求：使用中文，50字以内
4. memoryImage要求：用中文描述一个具体的视觉画面，80字以内
5. 必须返回有效的JSON格式，不要添加任何其他文字说明`;
        } else {
            // 其他语言组合，简化处理
            systemPrompt = `你是一个专业的翻译助手。请将用户输入的文本翻译成目标语言，并以JSON格式返回：
{
  "translation": "翻译结果",
  "examples": [
    {"source": "原文例句1", "target": "翻译1"},
    {"source": "原文例句2", "target": "翻译2"}
  ]
}
必须返回有效的JSON格式，不要添加任何其他文字说明`;
        }

        const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: model,
                messages: [
                    {
                        role: 'system',
                        content: systemPrompt
                    },
                    {
                        role: 'user',
                        content: query
                    }
                ],
                stream: false
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({error: 'Unknown error'}));
            throw new Error(`DeepSeek request failed: ${response.status} - ${JSON.stringify(errorData)}`);
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;

        if (!content) {
            throw new Error('Invalid response from DeepSeek');
        }

        // 获取发音URL
        const pronunciation = getPronunciationUrlSync(query);

        // 尝试解析JSON响应
        try {
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                return {
                    success: true,
                    explains: parsed.translation || content.trim(),
                    phonetic: parsed.phonetic || '',
                    pronunciation,
                    examples: parsed.examples || [],
                    synonyms: parsed.synonyms || [],
                    antonyms: parsed.antonyms || [],
                    memoryTip: parsed.memoryTip || '',
                    memoryImage: parsed.memoryImage || ''
                };
            }
        } catch (e) {
            console.log('DeepSeek 返回非JSON格式，使用纯文本');
        }

        return {
            success: true,
            explains: content,
            pronunciation
        };
    } catch (error) {
        console.error('DeepSeek error:', error);
        return {
            success: false,
            errorMsg: 'DeepSeek service error: ' + (error as Error).message
        };
    }
}

/**
 * 调用通义千问模型
 */
async function callQwen(query: string, from: string = 'auto', to: string = 'zh'): Promise<TranslationResult> {
    try {
        const {appkey: apiKey, key: modelName} = getTranslationApiKey('qwen');

        if (!apiKey) {
            return {
                success: false,
                errorMsg: '请先配置Qwen模型密钥'
            };
        }

        const model = modelName || 'qwen-max';

        // 根据语言方向确定翻译方向和提示词
        const isToEnglish = to === 'en';
        const isEnglishToChinese = (from === 'en' || from === 'auto') && to === 'zh';

        let systemPrompt: string;

        if (isEnglishToChinese) {
            systemPrompt = `你是一个专业的中英文翻译助手。请将用户输入的英文单词或短语翻译成中文，并以JSON格式返回以下信息：
{
  "translation": "中文翻译",
  "phonetic": "音标（如有）",
  "examples": [
    {"english": "英文例句1", "chinese": "中文翻译1"},
    {"english": "英文例句2", "chinese": "中文翻译2"}
  ],
  "synonyms": ["近义词1", "近义词2"],
  "antonyms": ["反义词1", "反义词2"],
  "memoryTip": "记忆提示：用词根词缀、发音规律、谐音联想、场景联想等方法帮助记忆这个单词",
  "memoryImage": "描述一个生动的画面，帮助通过视觉联想记住这个单词的含义"
}
注意：
1. 如果是单个单词，请提供音标、2-3个例句、近义词和反义词、记忆提示和记忆画面描述
2. 如果是短语或句子，只需提供translation和examples
3. memoryTip要求：使用中文，50字以内，优先使用词根词缀、发音规律等语言学方法，也可用谐音联想
4. memoryImage要求：用中文描述一个具体的视觉画面（如：一只大象在...），帮助用户通过画面感记住单词，80字以内
5. 必须返回有效的JSON格式，不要添加任何其他文字说明`;
        } else if (isToEnglish) {
            systemPrompt = `你是一个专业的中英文翻译助手。请将用户输入的中文翻译成英文，并以JSON格式返回以下信息：
{
  "translation": "英文翻译",
  "phonetic": "音标（如有）",
  "examples": [
    {"english": "英文例句1", "chinese": "中文翻译1"},
    {"english": "英文例句2", "chinese": "中文翻译2"}
  ],
  "synonyms": ["英文近义词1", "英文近义词2"],
  "antonyms": ["英文反义词1", "英文反义词2"],
  "memoryTip": "记忆提示：用中文解释如何记忆这个英文表达，可以是词根词缀、联想等方法",
  "memoryImage": "描述一个生动的画面，帮助通过视觉联想记住这个英文表达"
}
注意：
1. 如果是单个单词或短语，请提供音标、2-3个例句、近义词和反义词、记忆提示和记忆画面描述
2. 如果是长句子，只需提供translation和examples
3. memoryTip要求：使用中文，50字以内
4. memoryImage要求：用中文描述一个具体的视觉画面，80字以内
5. 必须返回有效的JSON格式，不要添加任何其他文字说明`;
        } else {
            systemPrompt = `你是一个专业的翻译助手。请将用户输入的文本翻译成目标语言，并以JSON格式返回：
{
  "translation": "翻译结果",
  "examples": [
    {"source": "原文例句1", "target": "翻译1"},
    {"source": "原文例句2", "target": "翻译2"}
  ]
}
必须返回有效的JSON格式，不要添加任何其他文字说明`;
        }

        const response = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: model,
                messages: [
                    {
                        role: 'system',
                        content: systemPrompt
                    },
                    {
                        role: 'user',
                        content: query
                    }
                ]
            })
        });
        log.i('Qwen response:', response);
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({error: 'Unknown error'}));
            throw new Error(`Qwen request failed: ${response.status} - ${JSON.stringify(errorData)}`);
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;

        if (!content) {
            throw new Error('Invalid response from Qwen');
        }

        // 获取发音URL
        const pronunciation = getPronunciationUrlSync(query);

        // 尝试解析JSON响应
        try {
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                return {
                    success: true,
                    explains: parsed.translation || content.trim(),
                    phonetic: parsed.phonetic || '',
                    pronunciation,
                    examples: parsed.examples || [],
                    synonyms: parsed.synonyms || [],
                    antonyms: parsed.antonyms || [],
                    memoryTip: parsed.memoryTip || '',
                    memoryImage: parsed.memoryImage || ''
                };
            }
        } catch (e) {
            console.log('Qwen 返回非JSON格式，使用纯文本');
        }

        return {
            success: true,
            explains: content,
            pronunciation
        };
    } catch (error) {
        console.error('Qwen error:', error);
        return {
            success: false,
            errorMsg: 'Qwen service error: ' + (error as Error).message
        };
    }
}

/**
 * 调用Kimi模型
 */
async function callKimi(query: string, from: string = 'auto', to: string = 'zh'): Promise<TranslationResult> {
    try {
        const {appkey: apiKey, key: modelName} = getTranslationApiKey('kimi');

        if (!apiKey) {
            return {
                success: false,
                errorMsg: '请先配置kimi模型密钥'
            };
        }

        const model = modelName || 'kimi-k2-turbo-preview';

        // 根据语言方向确定翻译方向和提示词
        const isToEnglish = to === 'en';
        const isEnglishToChinese = (from === 'en' || from === 'auto') && to === 'zh';

        let systemPrompt: string;

        if (isEnglishToChinese) {
            systemPrompt = `你是一个专业的中英文翻译助手。请将用户输入的英文单词或短语翻译成中文，并以JSON格式返回以下信息：
{
  "translation": "中文翻译",
  "phonetic": "音标（如有）",
  "examples": [
    {"english": "英文例句1", "chinese": "中文翻译1"},
    {"english": "英文例句2", "chinese": "中文翻译2"}
  ],
  "synonyms": ["近义词1", "近义词2"],
  "antonyms": ["反义词1", "反义词2"],
  "memoryTip": "记忆提示：用词根词缀、发音规律、谐音联想、场景联想等方法帮助记忆这个单词",
  "memoryImage": "描述一个生动的画面，帮助通过视觉联想记住这个单词的含义"
}
注意：
1. 如果是单个单词，请提供音标、2-3个例句、近义词和反义词、记忆提示和记忆画面描述
2. 如果是短语或句子，只需提供translation和examples
3. memoryTip要求：使用中文，50字以内，优先使用词根词缀、发音规律等语言学方法，也可用谐音联想
4. memoryImage要求：用中文描述一个具体的视觉画面（如：一只大象在...），帮助用户通过画面感记住单词，80字以内
5. 必须返回有效的JSON格式，不要添加任何其他文字说明`;
        } else if (isToEnglish) {
            systemPrompt = `你是一个专业的中英文翻译助手。请将用户输入的中文翻译成英文，并以JSON格式返回以下信息：
{
  "translation": "英文翻译",
  "phonetic": "音标（如有）",
  "examples": [
    {"english": "英文例句1", "chinese": "中文翻译1"},
    {"english": "英文例句2", "chinese": "中文翻译2"}
  ],
  "synonyms": ["英文近义词1", "英文近义词2"],
  "antonyms": ["英文反义词1", "英文反义词2"],
  "memoryTip": "记忆提示：用中文解释如何记忆这个英文表达，可以是词根词缀、联想等方法",
  "memoryImage": "描述一个生动的画面，帮助通过视觉联想记住这个英文表达"
}
注意：
1. 如果是单个单词或短语，请提供音标、2-3个例句、近义词和反义词、记忆提示和记忆画面描述
2. 如果是长句子，只需提供translation和examples
3. memoryTip要求：使用中文，50字以内
4. memoryImage要求：用中文描述一个具体的视觉画面，80字以内
5. 必须返回有效的JSON格式，不要添加任何其他文字说明`;
        } else {
            systemPrompt = `你是一个专业的翻译助手。请将用户输入的文本翻译成目标语言，并以JSON格式返回：
{
  "translation": "翻译结果",
  "examples": [
    {"source": "原文例句1", "target": "翻译1"},
    {"source": "原文例句2", "target": "翻译2"}
  ]
}
必须返回有效的JSON格式，不要添加任何其他文字说明`;
        }

        // Kimi由月之暗面开发，但目前API可能需要特定接入方式
        // 这里使用Moonshot API作为示例（Kimi的提供商）
        const response = await fetch('https://api.moonshot.cn/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: model,
                messages: [
                    {
                        role: 'system',
                        content: systemPrompt
                    },
                    {
                        role: 'user',
                        content: query
                    }
                ]
            })
        });

        log.i('Kimi/Moonshot response:', response);
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({error: {message: 'Unknown error'}}));

            // 处理账户余额不足的情况
            if (response.status === 429 && errorData.error?.type === 'exceeded_current_quota_error') {
                return {
                    success: false,
                    errorMsg: 'Kimi API账户余额不足，请充值后重试或联系服务商'
                };
            }

            throw new Error(`Kimi/Moonshot request failed: ${response.status} - ${JSON.stringify(errorData)}`);
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;

        if (!content) {
            throw new Error('Invalid response from Kimi');
        }

        // 获取发音URL
        const pronunciation = getPronunciationUrlSync(query);

        // 尝试解析JSON响应
        try {
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                return {
                    success: true,
                    explains: parsed.translation || content.trim(),
                    phonetic: parsed.phonetic || '',
                    pronunciation,
                    examples: parsed.examples || [],
                    synonyms: parsed.synonyms || [],
                    antonyms: parsed.antonyms || [],
                    memoryTip: parsed.memoryTip || '',
                    memoryImage: parsed.memoryImage || ''
                };
            }
        } catch (e) {
            console.log('Kimi 返回非JSON格式，使用纯文本');
        }

        return {
            success: true,
            explains: content,
            pronunciation
        };
    } catch (error) {
        console.error('Kimi error:', error);
        const errorMessage = (error as Error).message;

        // 处理余额不足的特殊情况
        if (errorMessage.includes('insufficient balance')) {
            return {
                success: false,
                errorMsg: 'Kimi API账户余额不足，请充值后重试'
            };
        }

        return {
            success: false,
            errorMsg: 'Kimi service error: ' + errorMessage
        };
    }
}

/**
 * 调用智谱GLM模型
 */
async function callGlm(query: string, from: string = 'auto', to: string = 'zh'): Promise<TranslationResult> {
    try {
        const {appkey: apiKey, key: modelName} = getTranslationApiKey('glm');

        if (!apiKey) {
            return {
                success: false,
                errorMsg: '请先配置智谱GLM模型密钥'
            };
        }

        const model = modelName || 'glm-4-flash';

        // 根据语言方向确定翻译方向和提示词
        const isToEnglish = to === 'en';
        const isEnglishToChinese = (from === 'en' || from === 'auto') && to === 'zh';

        let systemPrompt: string;

        if (isEnglishToChinese) {
            systemPrompt = `你是一个专业的中英文翻译助手。请将用户输入的英文单词或短语翻译成中文，并以JSON格式返回以下信息：
{
  "translation": "中文翻译",
  "phonetic": "音标（如有）",
  "examples": [
    {"english": "英文例句1", "chinese": "中文翻译1"},
    {"english": "英文例句2", "chinese": "中文翻译2"}
  ],
  "synonyms": ["近义词1", "近义词2"],
  "antonyms": ["反义词1", "反义词2"],
  "memoryTip": "记忆提示：用词根词缀、发音规律、谐音联想、场景联想等方法帮助记忆这个单词",
  "memoryImage": "描述一个生动的画面，帮助通过视觉联想记住这个单词的含义"
}
注意：
1. 如果是单个单词，请提供音标、2-3个例句、近义词和反义词、记忆提示和记忆画面描述
2. 如果是短语或句子，只需提供translation和examples
3. memoryTip要求：使用中文，50字以内，优先使用词根词缀、发音规律等语言学方法，也可用谐音联想
4. memoryImage要求：用中文描述一个具体的视觉画面（如：一只大象在...），帮助用户通过画面感记住单词，80字以内
5. 必须返回有效的JSON格式，不要添加任何其他文字说明`;
        } else if (isToEnglish) {
            systemPrompt = `你是一个专业的中英文翻译助手。请将用户输入的中文翻译成英文，并以JSON格式返回以下信息：
{
  "translation": "英文翻译",
  "phonetic": "音标（如有）",
  "examples": [
    {"english": "英文例句1", "chinese": "中文翻译1"},
    {"english": "英文例句2", "chinese": "中文翻译2"}
  ],
  "synonyms": ["英文近义词1", "英文近义词2"],
  "antonyms": ["英文反义词1", "英文反义词2"],
  "memoryTip": "记忆提示：用中文解释如何记忆这个英文表达，可以是词根词缀、联想等方法",
  "memoryImage": "描述一个生动的画面，帮助通过视觉联想记住这个英文表达"
}
注意：
1. 如果是单个单词或短语，请提供音标、2-3个例句、近义词和反义词、记忆提示和记忆画面描述
2. 如果是长句子，只需提供translation和examples
3. memoryTip要求：使用中文，50字以内
4. memoryImage要求：用中文描述一个具体的视觉画面，80字以内
5. 必须返回有效的JSON格式，不要添加任何其他文字说明`;
        } else {
            systemPrompt = `你是一个专业的翻译助手。请将用户输入的文本翻译成目标语言，并以JSON格式返回：
{
  "translation": "翻译结果",
  "examples": [
    {"source": "原文例句1", "target": "翻译1"},
    {"source": "原文例句2", "target": "翻译2"}
  ]
}
必须返回有效的JSON格式，不要添加任何其他文字说明`;
        }

        const response = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: model,
                messages: [
                    {
                        role: 'system',
                        content: systemPrompt
                    },
                    {
                        role: 'user',
                        content: query
                    }
                ]
            })
        });

        log.i('GLM response:', response);
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({error: {message: 'Unknown error'}}));
            throw new Error(`GLM request failed: ${response.status} - ${JSON.stringify(errorData)}`);
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;

        if (!content) {
            throw new Error('Invalid response from GLM');
        }

        // 获取发音URL
        const pronunciation = getPronunciationUrlSync(query);

        // 尝试解析JSON响应
        try {
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                return {
                    success: true,
                    explains: parsed.translation || content.trim(),
                    phonetic: parsed.phonetic || '',
                    pronunciation,
                    examples: parsed.examples || [],
                    synonyms: parsed.synonyms || [],
                    antonyms: parsed.antonyms || [],
                    memoryTip: parsed.memoryTip || '',
                    memoryImage: parsed.memoryImage || ''
                };
            }
        } catch (e) {
            console.log('GLM 返回非JSON格式，使用纯文本');
        }

        return {
            success: true,
            explains: content.trim(),
            pronunciation
        };
    } catch (error) {
        console.error('GLM error:', error);
        return {
            success: false,
            errorMsg: 'GLM service error: ' + (error as Error).message
        };
    }
}

/**
 * 调用翻译接口
 */
/**
 * 处理腾讯翻译响应
 */
function handleTencentResponse(data: any, query: string): TranslationResult {
    if (data.Response && data.Response.TargetText) {
        const explains = data.Response.TargetText;
        // 使用统一的发音获取（优先百度，回退有道）
        const pronunciation = getPronunciationUrlSync(query);
        return {
            success: true,
            explains,
            pronunciation
        };
    } else {
        return {
            success: false,
            errorMsg: `Tencent API error: ${data.Response?.Error?.Message || 'Unknown error'}`
        };
    }
}

export async function translation(payload: YdParams): Promise<AxiosResponse> {
    return await http.get('/', {...payload})
}


/**
 * 调用腾讯翻译API
 */
async function callTencent(query: string, from: string = 'auto', to: string = 'zh'): Promise<TranslationResult> {
    try {
        const {appkey: secretId, key: secretKey} = getTranslationApiKey('tencent');

        if (!secretId || !secretKey) {
            return {
                success: false,
                errorMsg: '腾讯翻译API密钥未配置，请在设置中填写SecretId和SecretKey'
            };
        }

        const service = 'tmt';
        const host = 'tmt.tencentcloudapi.com';
        const region = 'ap-beijing';
        const action = 'TextTranslate';
        const version = '2018-03-21';
        const timestamp = Math.floor(Date.now() / 1000);

        // 获取UTC日期 (YYYY-MM-DD)
        const date = new Date(timestamp * 1000).toISOString().slice(0, 10);

        // 请求参数
        const payload = JSON.stringify({
            SourceText: query,
            Source: from === 'auto' ? 'auto' : from,
            Target: to,
            ProjectId: 0
        });

        // ========== 步骤 1: 拼接规范请求串 (CanonicalRequest) ==========
        const httpRequestMethod = 'POST';
        const canonicalUri = '/';
        const canonicalQueryString = '';
        const canonicalHeaders = `content-type:application/json; charset=utf-8\nhost:${host}\nx-tc-action:${action.toLowerCase()}\n`;
        const signedHeaders = 'content-type;host;x-tc-action';
        const hashedRequestPayload = await sha256(payload);

        const canonicalRequest = [
            httpRequestMethod,
            canonicalUri,
            canonicalQueryString,
            canonicalHeaders,
            signedHeaders,
            hashedRequestPayload
        ].join('\n');

        // ========== 步骤 2: 拼接待签名字符串 (StringToSign) ==========
        const algorithm = 'TC3-HMAC-SHA256';
        const credentialScope = `${date}/${service}/tc3_request`;
        const hashedCanonicalRequest = await sha256(canonicalRequest);

        const stringToSign = [
            algorithm,
            timestamp.toString(),
            credentialScope,
            hashedCanonicalRequest
        ].join('\n');

        // ========== 步骤 3: 计算签名 ==========
        // 派生签名密钥
        const secretDate = await hmacSha256(`TC3${secretKey}`, date);
        const secretService = await hmacSha256(secretDate, service);
        const secretSigning = await hmacSha256(secretService, 'tc3_request');
        const signature = await hmacSha256Hex(secretSigning, stringToSign);

        // ========== 步骤 4: 拼接 Authorization ==========
        const authorization = `${algorithm} Credential=${secretId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

        // 发送请求
        const headers = {
            'Content-Type': 'application/json; charset=utf-8',
            'Host': host,
            'X-TC-Action': action,
            'X-TC-Version': version,
            'X-TC-Region': region,
            'X-TC-Timestamp': timestamp.toString(),
            'Authorization': authorization
        };

        const response = await fetch(`https://${host}`, {
            method: 'POST',
            headers: headers,
            body: payload
        });

        const data = await response.json();
        return handleTencentResponse(data, query);
    } catch (error) {
        console.error('Tencent translation error:', error);
        return {
            success: false,
            errorMsg: '腾讯翻译API错误: ' + (error as Error).message
        };
    }
}

// SHA256 哈希函数 (返回小写十六进制字符串)
async function sha256(message: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// HMAC-SHA256 函数 (返回二进制)
async function hmacSha256(key: string | ArrayBuffer, message: string): Promise<ArrayBuffer> {
    const encoder = new TextEncoder();
    const keyData = typeof key === 'string' ? encoder.encode(key) : key;
    const messageData = encoder.encode(message);

    const cryptoKey = await crypto.subtle.importKey(
        'raw',
        keyData,
        {name: 'HMAC', hash: 'SHA-256'},
        false,
        ['sign']
    );

    return await crypto.subtle.sign('HMAC', cryptoKey, messageData);
}

// HMAC-SHA256 函数 (返回小写十六进制字符串)
async function hmacSha256Hex(key: ArrayBuffer, message: string): Promise<string> {
    const result = await hmacSha256(key, message);
    const hashArray = Array.from(new Uint8Array(result));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}


export default {
    translateWithPlatform,
    translation,
};
