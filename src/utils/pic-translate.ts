import axios, {type AxiosError} from 'axios'
import CryptoJS from 'crypto-js'
import {translateWithPlatform} from './translation-api';
import {getCurrentUsageCount, hasCustomApiKey, incrementUsageCounter, isOverDailyLimit} from './usage-counter';
import {useWordsStore} from "@/stores/words.ts";
import {USAGE_LIMITS} from "@/constants";
import type {TranslationPlatform} from "@/types/words";
import {AppInfo} from "@/config.ts";
import picaliData from '../../picalidata.json';

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
    const buffer = await file.arrayBuffer();
    const imgBytes = new Uint8Array(buffer);
    const imgMd5 = await md5Bytes(imgBytes);

    /* 2. 业务参数 */
    const salt = Date.now().toString();
    const cuid = 'APICUID';
    const mac = 'mac';
    const from = 'en';
    const to = 'zh';

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
            ((bytes[i] ?? 0) << 24) |
            ((bytes[i + 1] ?? 0) << 16) |
            ((bytes[i + 2] ?? 0) << 8) |
            ((bytes[i + 3] ?? 0))
        );
    }
    const wa = CryptoJS.lib.WordArray.create(words, bytes.length);
    return CryptoJS.MD5(wa).toString();
}

async function md5String(str: string): Promise<string> {
    return CryptoJS.MD5(str).toString();
}



// 阿里图片翻译实现
export async function ocrTranslateAli(
    file: File,
    accessKeyId: string,
    accessKeySecret: string,
    targetLang = 'zh'
): Promise<OcrResult> {
    const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });

    const params: Record<string, string> = {
        AccessKeyId: accessKeyId,
        Action: 'TranslateImage',
        Ext: JSON.stringify({ needEditorData: true }),
        Field: 'general',
        Format: 'JSON',
        ImageBase64: base64,
        SignatureMethod: 'HMAC-SHA1',
        SignatureNonce: Math.random().toString(36).slice(2),
        SignatureVersion: '1.0',
        SourceLanguage: 'auto',
        TargetLanguage: targetLang,
        Timestamp: new Date().toISOString(),
        Version: '2018-10-12'
    };

    const canonicalQueryString = Object.keys(params)
        .sort()
        .map(key => `${rfc3986(key)}=${rfc3986(params[key])}`)
        .join('&');

    const stringToSign = `POST&${rfc3986('/')}&${rfc3986(canonicalQueryString)}`;

    console.log("str",stringToSign)
    // ✅ 核心修正：Secret 后必须加 &
    const key = accessKeySecret + "&";
    const signature = CryptoJS.HmacSHA1(
        CryptoJS.enc.Utf8.parse(stringToSign),
        CryptoJS.enc.Utf8.parse(key)
    ).toString(CryptoJS.enc.Base64);

    const body = `${canonicalQueryString}&Signature=${rfc3986(signature)}`;

    const res = await fetch('https://mt.cn-hangzhou.aliyuncs.com/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
            'User-Agent': 'uTools-Plugin/1.0'
        },
        body
    });

    const json = await res.json();
    // console.log('原始响应:', JSON.stringify(json, null, 2)); // ← 加这行
    // 检查返回的数据结构并相应处理
    if (json.Code === '200' && json.Data) {
        // 根据实际的数据结构进行处理
        // 从错误信息看，Data 包含的是图像处理结果，不是文本识别结果
        // 因此我们返回空的结果数组
        let resRegions = [];
        if (json.Data.TemplateJson) {
            try {
                const templateData = JSON.parse(json.Data.TemplateJson);

                // 提取文本元素及其翻译结果
                const elements = templateData.children.filter((child: any) =>
                    child.label === 'element' && child.type === 'text'
                );

                resRegions = elements.map((element: any) => {
                    // ocrContent 是原始文本，content 是翻译后文本
                    return {
                        boundingBox: `${element.left || 0},${element.top || 0},${element.width || 0},${element.height || 0}`,
                        context: element.ocrContent || '',      // 原始识别文本
                        tranContent: element.content || ''      // 翻译后文本
                    };
                });
            } catch (error) {
                console.error('解析 TemplateJson 失败:', error);
                resRegions = []; // 解析失败时返回空数组
            }
        }

        return {
            errorCode: json.Code,
            resRegions: resRegions // 阿里云图片翻译返回的数据结构与我们期望的不同
        };
    } else {
        return {
            errorCode: json.Code ?? 'UnknownError',
            resRegions: []
        };
    }
}

function rfc3986(str: string): string {
    return encodeURIComponent(str)
        .replace(/!/g, '%21')
        .replace(/'/g, '%27')
        .replace(/\(/g, '%28')
        .replace(/\)/g, '%29')
        .replace(/\*/g, '%2A');
}

function alisign(sk:string, str:string) {
    return CryptoJS.HmacSHA1(str, sk).toString(CryptoJS.enc.Base64)
}

/* ---------- 工具：长宽比 < 10:1 ---------- */
async function checkImageRatio(file: File): Promise<void> {
    return new Promise((resolve, reject) => {
        const img = new Image()
        img.onload = () => {
            const { width, height } = img
            const ratio = Math.max(width, height) / Math.min(width, height)
            if (ratio >= 10) reject(new Error('长宽比必须小于 10:1'))
            else resolve()
        }
        img.onerror = () => reject(new Error('图片解析失败'))
        img.src = URL.createObjectURL(file)
    })
}


