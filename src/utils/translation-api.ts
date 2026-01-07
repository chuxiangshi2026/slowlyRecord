import type { TranslationPlatform, TranslationResult, YdParams } from "@/types/words";
import http from "@/utils/http.ts";
import { log } from "@/utils/logger.ts";
import type { AxiosResponse } from 'axios';
import CryptoJS from "crypto-js";
import { truncate } from "lodash";
import { FROM, TO } from "@/constants";
import { AppInfo } from "@/config.ts";
import {useWordsStore} from "@/stores/words.ts";


/**
 * 获取当前使用的API密钥 - 优先使用用户设置的，否则使用默认配置
 */
function getApiKey(provider: TranslationPlatform) {
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

/**
 * 生成有道翻译签名参数
 */
function generateYoudaoParams(query: string): YdParams {
    const { appkey, key } = getApiKey('youdao');
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
    const { appkey, key: secretKey } = getApiKey('baidu');
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
async function generateAliParams(query: string) {
    const { appkey, key: accessKeySecret } = getApiKey('ali');
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

    // ────── 调试日志：打印待签名字符串 ──────
    const sortedKeys = Object.keys(params).sort();
    const canonicalQueryString = sortedKeys
        .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
        .join('&');

    const stringToSign = `GET&${encodeURIComponent('/')}&${encodeURIComponent(canonicalQueryString)}`;

    console.log('【待签名字符串(StringToSign)】');
    console.log(stringToSign); // 复制这个值

    // ────── 生成签名 ──────
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(accessKeySecret + '&'),
        { name: 'HMAC', hash: 'SHA-1' },
        false,
        ['sign']
    );
    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(stringToSign));
    const base64Signature = btoa(String.fromCharCode(...new Uint8Array(signature)));

    console.log('【生成的签名】');
    console.log(base64Signature); // 对比这个值

    params.Signature = base64Signature;
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
    console.log('待翻译参数', query)
    try {
        switch (platform) {
            case 'youdao':
                console.log('调用有道')
                const youdaoParams = generateYoudaoParams(query);
                const youdaoResponse = await http.get('/', { ...youdaoParams }, {
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
                const baiduResponse = await http.get('https://fanyi-api.baidu.com/api/trans/vip/translate', { ...baiduParams }, {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    }
                });
                return handleBaiduResponse(baiduResponse.data);

            case 'ali':
                console.log('调用阿里翻译');

                const aliParams = await generateAliParams(query);

                // 1. 修正URL（去掉末尾空格）
                // 2. 手动构造查询字符串
                const queryString = Object.entries(aliParams)
                    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
                    .join('&');

                const fullUrl = `https://mt.aliyuncs.com/?${queryString}`;

                // 3. 使用fetch或XMLHttpRequest发送请求
                const aliResponse = await fetch(fullUrl, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                    }
                });

                const data = await aliResponse.json();
                return handleAliResponse(data);

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
 * 调用翻译接口
 */
export async function translation(payload: YdParams): Promise<AxiosResponse> {
    return await http.get('/', { ...payload })
}

export default {
    translateWithPlatform,
    translation
};
