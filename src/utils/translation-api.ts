import type {TranslationPlatform, TranslationResult, YdParams} from "@/types/words";
import http from "@/utils/http.ts";
import type {AxiosResponse} from 'axios';
import CryptoJS from "crypto-js";
import {truncate} from "lodash";
import {FROM, TO, USAGE_LIMITS} from "@/constants";
import {AppInfo} from "@/config.ts";
import {useWordsStore} from "@/stores/words.ts";
import {getCurrentUsageCount, hasCustomApiKey, incrementUsageCounter, isOverDailyLimit} from './usage-counter';
import {batchTranslateAndAddWords} from "@/utils/str-util.ts";
import {log} from "@/utils/logger.ts";
import {getTranslationApiKey} from "@/utils/get-api-key.ts";

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
 * 生成有道翻译签名参数
 */
function generateYoudaoParams(query: string): YdParams {
    const {appkey, key} = getTranslationApiKey('youdao');
    const salt = (new Date).getTime();
    const curtime = Math.round(new Date().getTime() / 1000);
    const str1 = appkey + truncate(query) + salt + curtime + key;
    const sign = CryptoJS.SHA256(str1).toString(CryptoJS.enc.Hex);

    return {
        q: query,
        appKey: appkey,
        salt: salt,
        from: FROM,
        to: TO,
        sign: sign,
        signType: "v3",
        curtime: curtime,
        ext: 'mp3'
    };
}

/**
 * 生成百度翻译签名参数
 */
function generateBaiduParams(query: string): any {
    const {appkey, key: secretKey} = getTranslationApiKey('baidu');
    const appId = appkey;
    const salt = '' + (new Date).getTime();
    const signStr = appId + query + salt + secretKey;
    const sign = CryptoJS.MD5(signStr).toString();
    return {
        q: query,
        from: FROM,
        to: "zh",
        appid: appId,
        salt: salt,
        sign: sign
    };
}

/**
 * 生成阿里翻译参数
 */
function generateAliParamsSync(query: string): any {
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
        SourceLanguage: String(FROM || 'auto'),
        TargetLanguage: String(TO),
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
export async function translateWithPlatform(query: string, platform: TranslationPlatform = 'youdao'): Promise<TranslationResult> {
    log.i('待翻译参数', query)
    try {
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

        switch (platform) {
            case 'youdao':
                console.log('调用有道')
                const youdaoParams = generateYoudaoParams(query);
                const youdaoResponse = await http.get('/', {...youdaoParams}, {
                    headers: {
                        'Access-Control-Allow-Origin': 'https://openapi.youdao.com/api'
                    }
                });
                console.log('请求结果')
                return handleYoudaoResponse(youdaoResponse.data);

            case 'baidu':
                const baiduParams = generateBaiduParams(query);
                // 必须对q进行URL编码
                baiduParams.q = encodeURIComponent(baiduParams.q);
                const baiduResponse = await http.get('https://fanyi-api.baidu.com/api/trans/vip/translate', {...baiduParams}, {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    }
                });
                return handleBaiduResponse(baiduResponse.data);

            case 'ali':
                log.i('调用阿里翻译');

                const aliParams = generateAliParamsSync(query);

                // 手动构造查询字符串
                const queryString = Object.entries(aliParams)
                    .map(([key, value]) => `${encodeURIComponent(key as string)}=${encodeURIComponent(value as string)}`)
                    .join('&');

                const fullUrl = `https://mt.aliyuncs.com/?${queryString}`;

                // 使用fetch发送请求
                const aliResponse = await fetch(fullUrl, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                    }
                });

                const aliData = await aliResponse.json();
                return handleAliResponse(aliData);
            case 'utoolsai':
                let utoolAiData = callUtoolsAi(query);
                console.log('utool', utoolAiData)
                return utoolAiData;
            case 'deepseek':
                console.log('调用DeepSeek')
                return callDeepSeek(query);
            case 'qwen':
                console.log('调用通义千问')
                return callQwen(query);
            case 'kimi':
                console.log('调用Kimi')
                return callKimi(query);
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
function handleYoudaoResponse(data: any): TranslationResult {
    if (data.errorCode === '0') {
        const explains = data.translation?.[0] || '';
        const phonetic = data.basic?.phonetic || '';
        const pronunciation = data.speakUrl || '';

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
function handleBaiduResponse(data: any): TranslationResult {
    if (data.error_code === undefined || data.error_code === '52000') {
        const explains = data.trans_result?.[0]?.dst || '';
        return {
            success: true,
            explains
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
function handleAliResponse(data: any): TranslationResult {
    console.log("ali返回结果", data)
    if (data.Code === '200' && data.Data) {
        const explains = data.Data.Translated;
        return {
            success: true,
            explains
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
async function callUtoolsAi(query: string): Promise<TranslationResult> {
    try {

        const messages = [
            {
                role: "system" as const,
                content:
                    "你是一个中英文翻译专家，翻译结果要符合中英文语言习惯"
            },
            {
                role: 'user' as const,
                content: `请将以下文本翻译为中文：${query}`,
            }]

        // 尝试调用AI服务，使用类型断言避免编译错误
        const result: any = await window.utools.ai({messages});

        if (result && typeof result === 'object' && 'content' in result) {
            return {
                success: true,
                explains: result.content as string
            };
        } else if (typeof result === 'string') {
            return {
                success: true,
                explains: result
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
async function callOllama(query: string): Promise<TranslationResult> {
    try {
        const {appkey: baseUrl, key: modelName} = getTranslationApiKey('ollama');

        // 默认Ollama地址
        const ollamaUrl = baseUrl || 'http://localhost:11434';
        const model = modelName || 'llama3';

        const response = await fetch(`${ollamaUrl}/api/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: model,
                prompt: `请将以下文本翻译为中文：${query}`,
                stream: false
            })
        });

        if (!response.ok) {
            throw new Error(`Ollama request failed: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        return {
            success: true,
            explains: data.response || data.output || 'No response from Ollama'
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
async function callDeepSeek(query: string): Promise<TranslationResult> {
    try {
        const {appkey: apiKey, key: modelName} = getTranslationApiKey('deepseek');

        console.log('apikey', apiKey, modelName)
        if (!apiKey) {
            return {
                success: false,
                errorMsg: 'DeepSeek API key is required'
            };
        }

        const model = modelName || 'deepseek-chat';

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
                        content: 'You are a helpful translator. Please translate the following text to Chinese.'
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

        return {
            success: true,
            explains: content
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
async function callQwen(query: string): Promise<TranslationResult> {
    try {
        const {appkey: apiKey, key: modelName} = getTranslationApiKey('qwen');

        if (!apiKey) {
            return {
                success: false,
                errorMsg: 'Qwen API key is required'
            };
        }

        const model = modelName || 'qwen-max';

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
                        content: 'You are a helpful translator. Please translate the following text to Chinese.'
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

        return {
            success: true,
            explains: content
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
async function callKimi(query: string): Promise<TranslationResult> {
    try {
        const {appkey: apiKey, key: modelName} = getTranslationApiKey('kimi');

        if (!apiKey) {
            return {
                success: false,
                errorMsg: 'Kimi API key is required'
            };
        }

        const model = modelName || 'kimi-k2-turbo-preview';

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
                        content: 'You are a helpful translator. Please translate the following text to Chinese.'
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

        return {
            success: true,
            explains: content
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
 * 调用翻译接口
 */
export async function translation(payload: YdParams): Promise<AxiosResponse> {
    return await http.get('/', {...payload})
}


export default {
    translateWithPlatform,
    translation,
};
