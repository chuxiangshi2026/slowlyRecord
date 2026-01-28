import axios, {type AxiosError} from 'axios'
import CryptoJS from 'crypto-js'
import {translateWithPlatform} from './translation-api';
import {getCurrentUsageCount, hasCustomApiKey, incrementUsageCounter, isOverDailyLimit} from './usage-counter';
import {useWordsStore} from "@/stores/words.ts";
import {USAGE_LIMITS} from "@/constants";
import type {TranslationPlatform} from "@/types/words";
import {AppInfo} from "@/config.ts";

const API = 'https://openapi.youdao.com/ocrtransapi'

/** 符合官方要求的"截断"逻辑 */
function truncate(q: string) {
    const len = q.length
    return len <= 20 ? q : q.slice(0, 10) + len + q.slice(-10)
}

/** 生成签名（v3 版 SHA256） */
function sign(appKey: string, imgBase64: string, salt: string, curtime: number, secret: string) {
    const input = truncate(imgBase64)
    const str = appKey + input + salt + curtime + secret
    return CryptoJS.SHA256(str).toString(CryptoJS.enc.Hex)
}

/** 把 File 转成 base64 */
function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.readAsDataURL(file)
        reader.onload = () => {
            // 修复：移除 data:image/png;base64, 前缀，只保留Base64编码部分
            const base64WithPrefix = reader.result as string;
            const base64 = base64WithPrefix.split(',')[1];  // 只取逗号后的Base64部分
            resolve(base64)
        }
        reader.onerror = err => reject(err)
    })
}

export interface OcrResult {
    errorCode: string
    resRegions?: Array<{
        boundingBox: string
        context: string
        tranContent: string
    }>
}


/** 有道图片翻译：传入 File 对象，返回 Promise<OcrResult> */
export async function ocrTranslate(
    file: File,
    appKey: string,
    secret: string,
    from = 'auto',
    to = 'zh-CHS'
): Promise<OcrResult> {
    const img = await fileToBase64(file)
    console.log("base64", img.length)
    // 验证base64数据是否有效（检查是否包含字母数字+/=字符）
    const isValidBase64 = /^[A-Za-z0-9+/]*={0,2}$/.test(img);
    console.log("base64格式是否有效:", isValidBase64);

    const salt = CryptoJS.lib.WordArray.random(16).toString()
    const curtime = Math.round(Date.now() / 1000).toString()

    const params = new URLSearchParams({
        appKey,
        salt,
        sign: sign(appKey, img, salt, +curtime, secret),
        from,
        to,
        type: '1',          // 1=图片base64
        q: img,
        signType: 'v3',
        curtime
    })

    const {data} = await axios.post(API, params, {
        headers: {'Content-Type': 'application/x-www-form-urlencoded'}
    })
    return data as OcrResult
}

// 新增：多平台OCR翻译函数
export async function ocrTranslateMultiPlatform(
    file: File,
    platform: TranslationPlatform
): Promise<OcrResult> {
    // 检查是否超出了每日使用限制
    if (!hasCustomApiKey(platform)) {
        // 如果没有自定义API密钥，检查是否超过每日限制
        // OCR翻译使用独立的计数
        if (isOverDailyLimit('ocr')) {
            const usedCount = getCurrentUsageCount('ocr');
            throw new Error(`每日免费截图翻译次数已达上限 (${usedCount}/${USAGE_LIMITS.OCR_DAILY_LIMIT} 次)，请设置自定义API密钥以继续使用`);
        }

        // 增加使用计数
        const newCount = incrementUsageCounter('ocr');
        console.log(`OCR使用次数: ${newCount}/${USAGE_LIMITS.OCR_DAILY_LIMIT}`);
    }

    const {appkey, key} = getApiKey(platform);
    console.log('appkey+key', appkey, key)

    // 如果是使用有道平台，继续使用原有的OCR翻译
    if (platform === 'youdao') {
        return ocrTranslate(file, appkey, key, 'en', 'zh-CHS');
    } else if (platform === 'baidu') {
        // 百度OCR API的调用逻辑
        return await ocrTranslateBaidu(file, appkey, key);
    } else if (platform === 'ali') {
        // 阿里OCR API的调用逻辑
        return await ocrTranslateAli(file, appkey, key);
    }

    return {
        errorCode: '500',
        resRegions: []
    };
}

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

// 百度OCR翻译实现
async function ocrTranslateBaidu(
    file: File,
    apiKey: string,
    secretKey: string
): Promise<OcrResult> {
    const url = 'https://fanyi-api.baidu.com/api/trans/sdk/picture';

    /* 1. 读文件并计算图片 md5 */
    const buffer  = await file.arrayBuffer();
    const imgBytes= new Uint8Array(buffer);
    const imgMd5  = await md5Bytes(imgBytes);

    /* 2. 业务参数 */
    const salt = Date.now().toString();
    const cuid = 'APICUID';
    const mac  = 'mac';
    const from = 'en';
    const to   = 'zh';

    /* 3. 签名 */
    const sign = await md5String(
        `${apiKey}${imgMd5}${salt}${cuid}${mac}${secretKey}`
    );

    /* 4. 查询串 */
    const qs = new URLSearchParams({
        from, to, appid: apiKey, salt, sign, cuid, mac, version: '3',
    });

    /* 5. multipart/form-data */
    const form = new FormData();
    form.append('image', new Blob([imgBytes]), file.name);

    /* 6. 用 axios 发 POST */
    const resp = await axios.post(`${url}?${qs.toString()}`, form, {
        // headers: form.getHeaders?.() || { 'Content-Type': 'multipart/form-data' },
        timeout: 15000,
        responseType: 'json',
    });
    /* 7. 解析结果 */
    const data = resp.data;
    // console.log(JSON.stringify(data, null, 2));
    // if (data.error_code) return { errorCode: data.error_code };

    return {
        errorCode: '0',
        resRegions: data.data.content.map((it: any) => ({
            boundingBox: it.rect,          // "27 9 152 18"
            context: it.src,               // 原文
            tranContent: it.dst,           // 译文
        })),
    };
}

/* =============== 工具函数 =============== */
async function md5Bytes(bytes: Uint8Array): Promise<string> {
    // Uint8Array → WordArray
    const words: number[] = [];
    for (let i = 0; i < bytes.length; i += 4) {
        words.push(
            ((bytes[i]   ?? 0) << 24) |
            ((bytes[i+1] ?? 0) << 16) |
            ((bytes[i+2] ?? 0) <<  8) |
            ((bytes[i+3] ?? 0))
        );
    }
    const wa = CryptoJS.lib.WordArray.create(words, bytes.length);
    return CryptoJS.MD5(wa).toString();
}

async function md5String(str: string): Promise<string> {
    return CryptoJS.MD5(str).toString();
}

// 阿里图片翻译实现
/** 主函数：阿里云图片翻译（普通版） */
export async function ocrTranslateAli(
    file: File,
    accessKeyId: string,
    accessKeySecret: string,
    targetLang = 'zh'
): Promise<OcrResult> {
    try {
        const imgBase64 = await fileToBase64(file);

        console.log('ak', accessKeyId, 'sk', accessKeySecret);
        if (!accessKeyId || !accessKeySecret) {
            alert('请先配置 AccessKeyId 和 AccessKeySecret');
        }

        /* ========== 1. 构造公共参数 ========== */
        const timestamp = new Date().toISOString().replace(/\.\d{3}Z/, 'Z'); // 毫秒置 0
        const nonce = Math.random().toString(36).substring(2, 15);
        const params: Record<string, string> = {
            Format: 'JSON',
            Version: '2018-10-12',
            AccessKeyId: accessKeyId,
            SignatureMethod: 'HMAC-SHA1',
            Timestamp: timestamp,
            SignatureVersion: '1.0',
            SignatureNonce: nonce,
            Action: 'TranslateImage',
            SourceLanguage: 'auto',
            TargetLanguage: targetLang,
            Image: imgBase64,
            FormatType: 'image',
            TaskType: 'Image',
            Scene: 'general',   // ←新增
            RegionId: 'cn-hangzhou'   // ←新增
        };

        /* ========== 2. 计算签名 ========== */
        const sortedKeys = Object.keys(params).sort();
        const canonical = sortedKeys
            .filter(k => k !== 'Signature')
            .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`)
            .join('&');
        const stringToSign = `POST&${encodeURIComponent('/')}&${encodeURIComponent(canonical)}`;
        const signature = CryptoJS.HmacSHA1(stringToSign, accessKeySecret + '&').toString(CryptoJS.enc.Base64);
        params.Signature = signature;

        /* ========== 3. 通过本地代理发送POST请求（避免跨域和大请求头问题） ========== */
        const response = await axios.post('/api/ali', {}, {
            params: params,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            timeout: 25000
        });

        console.log('success', response.data);
        console.log("resp:", response);

        /* ========== 4. 解析结果 ========== */
        const d = response.data;
        if (d?.Code === '200' && d.Data) {
            return {
                errorCode: '0',
                resRegions: [{
                    context: d.Data.SourceText || '',
                    tranContent: d.Data.Translated || '',
                    boundingBox: '0,0,100,50'
                }]
            };
        }
        return { errorCode: d.Code || '500', resRegions: [] };
    } catch (e) {
        console.error('[AliOcr] error:', e);
        const code = (e as AxiosError)?.response?.status || 500;
        return {errorCode: String(code), resRegions: []};
    }
}

// 为前端优化的百度OCR翻译实现（使用CORS代理）
export async function ocrTranslateBaiduWithProxy(
    file: File,
    apiKey: string,
    secretKey: string,
    corsProxyUrl?: string
): Promise<OcrResult> {
    try {
        const img = await fileToBase64(file);

        // 如果提供了CORS代理URL，使用代理调用
        let apiUrl = `https://aip.baidubce.com/rest/2.0/ocr/v1/general_basic`;
        if (corsProxyUrl) {
            apiUrl = `${corsProxyUrl}?url=${encodeURIComponent(apiUrl)}`;
        }

        // 首先获取访问令牌
        const tokenUrl = `https://aip.baidubce.com/oauth/2.0/token`;
        const tokenParams = new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: apiKey,
            client_secret: secretKey
        });

        // 使用代理获取token（如果提供）
        let tokenApiUrl = tokenUrl;
        if (corsProxyUrl) {
            tokenApiUrl = `${corsProxyUrl}?url=${encodeURIComponent(tokenUrl)}`;
        }

        const tokenResponse = await axios.post(
            tokenApiUrl,
            tokenParams,
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            }
        );

        const accessToken = tokenResponse.data.access_token;
        if (!accessToken) {
            throw new Error('Failed to get access token from Baidu');
        }

        // 使用token调用OCR API
        const ocrParams = new URLSearchParams({
            image: img,
            language_type: 'ENG'
        });

        const ocrResponse = await axios.post(
            `${apiUrl}?access_token=${accessToken}`,
            ocrParams,
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            }
        );

        const ocrData = ocrResponse.data;
        if (ocrData.words_result && ocrData.words_result.length > 0) {
            const results = [];

            // 对每个识别的文本进行翻译
            for (const wordResult of ocrData.words_result) {
                const text = wordResult.words;

                // 使用翻译API进行翻译
                const translationResult = await translateWithPlatform(text, 'baidu');

                results.push({
                    context: text,
                    tranContent: translationResult.success ? translationResult.explains : text,
                    boundingBox: wordResult.location ?
                        `${wordResult.location.left},${wordResult.location.top},${wordResult.location.width},${wordResult.location.height}` : ''
                });
            }

            return {
                errorCode: '0',
                resRegions: results
            };
        } else {
            return {
                errorCode: ocrData.error_code || '52001',
                resRegions: []
            };
        }
    } catch (error) {
        console.error('百度OCR识别失败:', error);
        return {
            errorCode: '52001',
            resRegions: []
        };
    }
}
