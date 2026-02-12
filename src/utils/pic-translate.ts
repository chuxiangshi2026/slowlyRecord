import axios from 'axios'
import CryptoJS from 'crypto-js'
import {getCurrentUsageCount, hasCustomApiKey, incrementUsageCounter, isOverDailyLimit} from './usage-counter';
import {useWordsStore} from "@/stores/words.ts";
import {USAGE_LIMITS} from "@/constants";
import type {OcrPlatform, TranslationPlatform} from "@/types/words";
import {AppInfo} from "@/config.ts";
import {getOcrApiKey, getTranslationApiKey} from "@/utils/get-api-key.ts";
import {log} from "@/utils/logger.ts";
import {ElMessage} from "element-plus";

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
    errorMessage?: string
    resRegions?: Array<{
        boundingBox: string
        context: string
        tranContent: string
    }>
}


/** 有道图片翻译：传入 File 对象，返回 Promise<OcrResult> */
export async function ocrTranslate(
    img: string,
    appKey: string,
    secret: string,
    from = 'auto',
    to = 'zh-CHS'
): Promise<OcrResult> {
    // const img = await fileToBase64(file)
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

    // 处理有道 API 错误码
    if (data.errorCode !== '0') {
        console.error('有道OCR错误:', data.errorCode, data);
        return {
            errorCode: data.errorCode,
            resRegions: []
        };
    }

    return data as OcrResult
}

// 新增：多平台OCR翻译函数
export async function ocrTranslateMultiPlatform(): Promise<OcrResult> {
    console.log('[OCR] 开始多平台OCR翻译流程');

    const wordsStore = useWordsStore();
    const ocrPlatform = wordsStore.currentOcrPlatform || 'tencent';

    // 添加调试日志
    console.log('[OCR] 当前OCR平台:', ocrPlatform);
    console.log('[OCR] Store中的currentOcrPlatform:', wordsStore.currentOcrPlatform);

    // 检查是否超出了每日使用限制（本地OCR不记次数）
    if (ocrPlatform !== 'local' && !hasCustomApiKey(ocrPlatform)) {
        // 如果没有自定义API密钥，检查是否超过每日限制
        // 腾讯 OCR 使用独立的计数器，其他 OCR 使用通用计数器
        const counterKey = ocrPlatform === 'tencent' ? 'tencent_ocr' : 'ocr';
        const dailyLimit = ocrPlatform === 'tencent' ? USAGE_LIMITS.TENCENT_OCR_DAILY_LIMIT : USAGE_LIMITS.OCR_DAILY_LIMIT;

        if (isOverDailyLimit(counterKey)) {
            const usedCount = getCurrentUsageCount(counterKey);
            throw new Error(`每日免费${ocrPlatform === 'tencent' ? '腾讯' : ''}截图翻译次数已达上限 (${usedCount}/${dailyLimit} 次)，请设置自定义API密钥以继续使用`);
        }

        // 增加使用计数
        const newCount = incrementUsageCounter(counterKey);
        console.log(`${ocrPlatform === 'tencent' ? '腾讯' : ''}OCR使用次数: ${newCount}/${dailyLimit}`);
    }

    // const {appkey, key} = getTranslationApiKey(platform);
    const {appkey, key} = getOcrApiKey(ocrPlatform);
    console.log('[OCR] API密钥状态:', { appkey: appkey ? '已设置' : '未设置', key: key ? '已设置' : '未设置' });

    // 将 utools.screenCapture 包装为 Promise
    return new Promise((resolve, reject) => {
        console.log('[OCR] 调用utools.screenCapture...');
        utools.screenCapture(async (image) => {
            console.log('[OCR] 截图回调触发，图片数据长度:', image ? image.length : 0);
            if (!image) {
                console.error('[OCR] 截图取消或失败');
                reject(new Error('截图取消或失败'));
                return;
            }

            try {
                // 去除 data:image/png;base64, 前缀
                const base64 = image.includes(',') ? image.split(',')[1] : image;
                console.log('[OCR] 开始调用平台:', ocrPlatform);

                let result: OcrResult;
                if (ocrPlatform === 'youdao') {
                    result = await ocrTranslate(base64, appkey, key, 'en', 'zh-CHS');
                } else if (ocrPlatform === 'baidu') {
                    result = await ocrTranslateBaidu(base64, appkey, key);
                } else if (ocrPlatform === 'ali') {
                    result = await ocrTranslateAli(base64, appkey, key);
                } else if (ocrPlatform === 'tencent') {
                    result = await ocrTranslateTencent(base64, appkey, key);
                } else if (ocrPlatform === 'local') {
                    // 本地OCR：使用 Tesseract.js
                    const translatePlatform = wordsStore.currentTranslationPlatform || 'local';
                    result = await ocrTranslateLocal(base64, translatePlatform);
                } else {
                    result = { errorCode: '500', resRegions: [] };
                }
                console.log('[OCR] 平台返回结果:', { errorCode: result.errorCode, resRegionsCount: result.resRegions?.length || 0 });
                resolve(result);
            } catch (error) {
                reject(error);
            }
        });
    });
}

// 百度OCR翻译实现
async function ocrTranslateBaidu(
    base64: string,
    apiKey: string,
    secretKey: string
): Promise<OcrResult> {
    log.i('百度OCR翻译')
    const url = 'https://fanyi-api.baidu.com/api/trans/sdk/picture';

    /* 1. base64 转 Uint8Array 并计算 md5 */
    const imgBytes = base64ToUint8Array(base64);
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
    form.append('image', new Blob([imgBytes]), 'image.png');

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

    // 检查数据结构，防止 undefined 错误
    if (!data.data || !Array.isArray(data.data.content)) {
        console.error('百度OCR返回错误:', data);
        // 处理百度错误码，提供更友好的提示
        let errorCode = data.error_code ? String(data.error_code) : '500';
        if (data.error_code === '52003' || data.error_msg?.includes('UNAUTHORIZED')) {
            errorCode = 'BAIDU_AUTH_FAILED';
            console.error('百度OCR鉴权失败，请检查：1) API密钥是否正确 2) 是否已开通图片翻译服务 3) 密钥是否过期');
        }
        return {
            errorCode: errorCode,
            resRegions: []
        };
    }

    return {
        errorCode: '0',
        resRegions: data.data.content.map((it: any) => ({
            boundingBox: it.rect,          // "27 9 152 18"
            context: it.src,               // 原文
            tranContent: it.dst,           // 译文
        })),
    };
}

/* base64 转 Uint8Array */
function base64ToUint8Array(base64: string): Uint8Array {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
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
    base64: string,
    accessKeyId: string,
    accessKeySecret: string,
    targetLang = 'zh'
): Promise<OcrResult> {
    // const base64 = await new Promise<string>((resolve, reject) => {
    //     const reader = new FileReader();
    //     reader.onload = () => resolve((reader.result as string).split(',')[1]);
    //     reader.onerror = reject;
    //     reader.readAsDataURL(file);
    // });

    const params: Record<string, string> = {
        AccessKeyId: accessKeyId,
        Action: 'TranslateImage',
        Ext: JSON.stringify({needEditorData: true}),
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

    console.log("str", stringToSign)
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

function alisign(sk: string, str: string) {
    return CryptoJS.HmacSHA1(str, sk).toString(CryptoJS.enc.Base64)
}

// 腾讯图片翻译实现
async function ocrTranslateTencent(
    base64: string,
    secretId: string,
    secretKey: string
): Promise<OcrResult> {
    const service = 'tmt';
    const host = 'tmt.tencentcloudapi.com';
    const region = 'ap-beijing';
    const action = 'ImageTranslate';
    const version = '2018-03-21';
    const timestamp = Math.floor(Date.now() / 1000);
    const date = new Date(timestamp * 1000).toISOString().slice(0, 10);

    // 将文件转换为base64
    // const base64 = await new Promise<string>((resolve, reject) => {
    //     const reader = new FileReader();
    //     reader.onload = () => resolve((reader.result as string).split(',')[1]);
    //     reader.onerror = reject;
    //     reader.readAsDataURL(file);
    // });

    // 请求参数
    const payload = JSON.stringify({
        SessionUuid: Date.now().toString(),
        Scene: 'doc',
        Data: base64,
        Source: 'auto',
        Target: 'zh',
        ProjectId: 0
    });

    // ========== 步骤 1: 拼接规范请求串 (CanonicalRequest) ==========
    const httpRequestMethod = 'POST';
    const canonicalUri = '/';
    const canonicalQueryString = '';
    const canonicalHeaders = `content-type:application/json; charset=utf-8\nhost:${host}\nx-tc-action:${action.toLowerCase()}\n`;
    const signedHeaders = 'content-type;host;x-tc-action';
    const hashedRequestPayload = sha256(payload);

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
    const hashedCanonicalRequest = sha256(canonicalRequest);

    const stringToSign = [
        algorithm,
        timestamp.toString(),
        credentialScope,
        hashedCanonicalRequest
    ].join('\n');

    // ========== 步骤 3: 计算签名 ==========
    const secretDate = hmacSha256(`TC3${secretKey}`, date);
    const secretService = hmacSha256(secretDate, service);
    const secretSigning = hmacSha256(secretService, 'tc3_request');
    const signature = hmacSha256Hex(secretSigning, stringToSign);

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

    // 处理响应
    if (data.Response && data.Response.ImageRecord) {
        const imageRecord = data.Response.ImageRecord;
        const resRegions = imageRecord.Value?.map((item: any) => ({
            boundingBox: `${item.X || 0},${item.Y || 0},${item.W || 0},${item.H || 0}`,
            context: item.SourceText || '',
            tranContent: item.TargetText || ''
        })) || [];

        return {
            errorCode: '0',
            resRegions: resRegions
        };
    } else if (data.Response && data.Response.Error) {
        return {
            errorCode: data.Response.Error.Code,
            resRegions: []
        };
    }

    return {
        errorCode: '500',
        resRegions: []
    };
}

// SHA256 哈希函数 (返回小写十六进制字符串)
function sha256(message: string): string {
    return CryptoJS.SHA256(message).toString(CryptoJS.enc.Hex);
}

// HMAC-SHA256 函数 (返回WordArray)
function hmacSha256(key: string | CryptoJS.lib.WordArray, message: string): CryptoJS.lib.WordArray {
    return CryptoJS.HmacSHA256(message, key);
}

// HMAC-SHA256 函数 (返回小写十六进制字符串)
function hmacSha256Hex(key: CryptoJS.lib.WordArray, message: string): string {
    return CryptoJS.HmacSHA256(message, key).toString(CryptoJS.enc.Hex);
}

/* ---------- 工具：长宽比 < 10:1 ---------- */
async function checkImageRatio(file: File): Promise<void> {
    return new Promise((resolve, reject) => {
        const img = new Image()
        img.onload = () => {
            const {width, height} = img
            const ratio = Math.max(width, height) / Math.min(width, height)
            if (ratio >= 10) reject(new Error('长宽比必须小于 10:1'))
            else resolve()
        }
        img.onerror = () => reject(new Error('图片解析失败'))
        img.src = URL.createObjectURL(file)
    })
}


/**
 * 从图片中提取文本 - 优先使用多模态大模型，备选传统OCR服务
 */
async function extractTextFromImage(file: File, platform?: TranslationPlatform): Promise<string> {
    // 如果指定了支持视觉识别的大模型，优先使用
    if (platform && ['qwen', 'kimi'].includes(platform)) {
        try {
            return await extractTextUsingVisionModel(file, platform);
        } catch (error) {
            console.warn(`${platform} 视觉模型提取失败，回退到传统OCR:`, error);
        }
    }

    // 如果有道OCR失败，尝试百度OCR
    try {
        const base64 = await fileToBase64(file);
        const baiduResult = await ocrTranslateBaidu(base64, AppInfo.baidu.appkey, AppInfo.baidu.key);
        if (baiduResult.errorCode === '0' && baiduResult.resRegions && baiduResult.resRegions.length > 0) {
            return baiduResult.resRegions.map(region => region.context).join(' ');
        }
    } catch (error) {
        console.warn('百度OCR提取失败:', error);
    }

    // 尝试使用有道OCR提取文本
    try {
        const base64 = await fileToBase64(file);
        const youdaoResult = await ocrTranslate(base64, AppInfo.youdao.appkey, AppInfo.youdao.key, 'auto', 'zh-CHS');
        if (youdaoResult.errorCode === '0' && youdaoResult.resRegions && youdaoResult.resRegions.length > 0) {
            // 提取所有识别到的文本
            return youdaoResult.resRegions.map(region => region.context).join(' ');
        }
    } catch (error) {
        console.warn('有道OCR提取失败:', error);
    }


    // 如果百度OCR也失败，尝试阿里OCR
    try {
        const base64 = await fileToBase64(file);
        const aliResult = await ocrTranslateAli(base64, AppInfo.ali.appkey, AppInfo.ali.key);
        if (aliResult.errorCode === '0' && aliResult.resRegions && aliResult.resRegions.length > 0) {
            return aliResult.resRegions.map(region => region.context).join(' ');
        }
    } catch (error) {
        console.warn('阿里OCR提取失败:', error);
    }

    // 尝试腾讯OCR
    try {
        const base64 = await fileToBase64(file);
        const {appkey: tencentKey, key: tencentSecret} = getOcrApiKey('tencent');
        const tencentResult = await ocrTranslateTencent(base64, tencentKey, tencentSecret);
        if (tencentResult.errorCode === '0' && tencentResult.resRegions && tencentResult.resRegions.length > 0) {
            return tencentResult.resRegions.map(region => region.context).join(' ');
        }
    } catch (error) {
        console.warn('腾讯OCR提取失败:', error);
    }

    // 如果所有OCR服务都失败，返回空字符串
    return "";
}

/**
 * 使用支持视觉的AI模型提取文本
 */
async function extractTextUsingVisionModel(file: File, platform: TranslationPlatform): Promise<string> {
    // 将文件转换为base64
    const base64 = await fileToBase64(file);

    // 根据不同的平台调用相应的视觉模型
    if (platform === 'qwen') {
        return await extractTextUsingQwenVision(base64);
    } else if (platform === 'kimi') {
        return await extractTextUsingKimiVision(base64);
    }
    // 注意：gpt4v 需要额外的实现

    throw new Error(`不支持的视觉模型平台: ${platform}`);
}

/**
 * 使用通义千问视觉模型提取文本
 */
async function extractTextUsingQwenVision(base64Image: string): Promise<string> {
    try {
        const {appkey: apiKey, key: model} = getTranslationApiKey('qwen');

        if (!apiKey) {
            throw new Error('请先配置Qwen模型密钥');
        }

        const modelType = model || 'qwen-vl-max'; // 视觉模型

        const response = await fetch('https://dashscope.aliyun.com/api/v1/services/aigc/multimodal-generation/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: modelType,
                input: {
                    messages: [
                        {
                            "role": "user",
                            "content": [
                                {
                                    "image": `data:image/jpeg;base64,${base64Image}`
                                },
                                {
                                    "text": "请识别并提取图片中的所有文本内容，只输出识别到的文本，不要有其他解释。"
                                }
                            ]
                        }
                    ]
                },
                parameters: {
                    temperature: 0.1
                }
            })
        });

        if (!response.ok) {
            throw new Error(`Qwen vision request failed: ${response.status}`);
        }

        const data = await response.json();
        // 解析返回的数据以提取文本
        const text = data.output.choices?.[0]?.message?.content?.[0]?.text || "";
        return text;
    } catch (error) {
        console.error('Qwen vision error:', error);
        throw error;
    }
}

/**
 * 使用Google Gemini视觉模型提取文本
 */

/*async function extractTextUsingGeminiVision(base64Image: string): Promise<string> {
    try {
        const { appkey: apiKey, key: model } = getTranslationApiKey('gemini');

        if (!apiKey) {
            throw new Error('Gemini API key is required');
        }

        const modelType = model || 'gemini-pro-vision';

        // Gemini Vision API 调用
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelType}:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { text: "请识别并提取图片中的所有文本内容，只输出识别到的文本，不要有其他解释。" },
                        {
                            inline_data: {
                                mime_type: "image/jpeg",
                                data: base64Image
                            }
                        }
                    ]
                }]
            })
        });

        if (!response.ok) {
            throw new Error(`Gemini vision request failed: ${response.status}`);
        }

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
        return text;
    } catch (error) {
        console.error('Gemini vision error:', error);
        throw error;
    }
}*/

/**
 * 使用Kimi视觉模型提取文本（使用Moonshot API作为示例）
 */
async function extractTextUsingKimiVision(base64Image: string): Promise<string> {
    try {
        const {appkey: apiKey, key: model} = getTranslationApiKey('kimi');

        if (!apiKey) {
            throw new Error('请先配置Kimi模型密钥');
        }

        const modelType = model || 'moonshot-v1-8k';

        // 使用Moonshot API，因为Kimi目前没有公开的视觉API
        // 实际使用时需要替换为正确的Kimi视觉API
        const response = await fetch('https://api.moonshot.cn/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: modelType,
                messages: [
                    {
                        role: 'system',
                        content: '你是一个图像内容识别助手，请识别并提取图像中的所有文本内容。'
                    },
                    {
                        role: 'user',
                        content: [
                            {
                                type: 'text',
                                text: '请识别并提取图片中的所有文本内容，只输出识别到的文本，不要有其他解释。'
                            },
                            {
                                type: 'image_url',
                                image_url: {
                                    url: `data:image/jpeg;base64,${base64Image}`
                                }
                            }
                        ]
                    }
                ]
            })
        });

        if (!response.ok) {
            throw new Error(`Kimi/Moonshot vision request failed: ${response.status}`);
        }

        const data = await response.json();
        const text = data.choices?.[0]?.message?.content || "";
        return text;
    } catch (error) {
        console.error('Kimi vision error:', error);
        throw error;
    }
}

/**
 * 使用大模型翻译文本
 */
async function translateWithLargeModel(text: string, platform: TranslationPlatform) {
    // 直接导入翻译API
    const {translateWithPlatform} = await import('./translation-api');

    // 使用大模型平台进行翻译
    return await translateWithPlatform(text, platform);
}

/**
 * 本地OCR识别 - 使用 Tesseract.js
 * 轻量级离线OCR，在浏览器端运行
 *
 * 注意：默认从 CDN 下载语言模型，如需完全离线，请配置 langPath 指向本地文件
 * @param base64 图片base64
 * @param translatePlatform 翻译平台，如果为'local'则使用本地词典，否则使用指定翻译平台
 */
/**
 * 检测是否在 uTools 环境中
 */
function isUTools(): boolean {
    return typeof utools !== 'undefined' && !!utools.getPath;
}

/**
 * 写入日志到文件（用于打包后调试）
 */
function logToFile(message: string) {
    try {
        if (isUTools()) {
            const fs = (window as any).require('fs');
            const path = (window as any).require('path');
            const logPath = path.join(utools.getPath('temp'), 'slowlyrecord-ocr.log');
            const timestamp = new Date().toISOString();
            fs.appendFileSync(logPath, `[${timestamp}] ${message}\n`);
        }
    } catch (e) {
        // 忽略日志写入错误
    }
}

/**
 * 显示调试信息（控制台 + 日志文件）
 */
function debugLog(...args: any[]) {
    const message = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
    console.log(...args);
    logToFile(message);
}

/**
 * 获取 uTools 插件目录
 */
function getPluginDir(): string {
    // 从当前路径提取插件目录
    // 路径格式: file:///C:/Users/.../plugins/xxx.asar/index.html
    const href = window.location.href;
    const match = href.match(/file:\/\/\/(.*?)\/index\.html/);
    if (match) {
        return '/' + match[1];
    }
    return '';
}

/**
 * 读取本地文件为 ArrayBuffer
 * 解决 uTools 插件环境中 file 协议访问问题
 */
async function readLocalFile(filePath: string): Promise<ArrayBuffer> {
    const pluginDir = getPluginDir();
    debugLog('[本地OCR] 插件目录:', pluginDir);

    // 在 uTools 环境中，尝试使用 preload 中暴露的 Node.js API
    if (isUTools()) {
        try {
            // @ts-ignore - preload 脚本中暴露的 services
            const { fs, path } = window.services || {};
            if (fs && path) {
                const fullPath = path.join(pluginDir, filePath.replace(/^\.\//, ''));
                debugLog('[本地OCR] 尝试 services.fs 读取:', fullPath);
                if (fs.existsSync(fullPath)) {
                    const data = fs.readFileSync(fullPath);
                    debugLog('[本地OCR] services.fs 读取成功:', fullPath, '大小:', data.length);
                    if (Buffer.isBuffer(data)) {
                        return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
                    }
                    return data;
                }
            }
        } catch (e: any) {
            debugLog('[本地OCR] services.fs 读取失败:', e?.message);
        }
    }

    // 回退到 fetch 方式
    debugLog('[本地OCR] 使用 fetch 加载:', filePath);
    const response = await fetch(filePath);
    if (!response.ok) {
        throw new Error(`Fetch failed: ${response.status} ${response.statusText}`);
    }
    return response.arrayBuffer();
}

/**
 * 将 ArrayBuffer 转为 base64 字符串
 */
function arrayBufferToBase64(data: ArrayBuffer): string {
    const bytes = new Uint8Array(data);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

/**
 * 创建 Data URL
 */
function createDataUrl(data: ArrayBuffer, type: string): string {
    return `data:${type};base64,${arrayBufferToBase64(data)}`;
}

/**
 * 创建内联 Worker 脚本
 * 将 worker、core 和语言数据合并，避免外部请求
 */
function createInlineWorkerScript(workerCode: string, coreCode: string, langDataBase64: string): string {
    const script = `
// 内联的 tesseract-core 代码 - 直接执行，不通过 importScripts
${coreCode}

// 注入语言数据
(function() {
    // 等待 TesseractCore 加载完成
    const checkAndInject = function() {
        if (typeof TesseractCore !== 'undefined' && TesseractCore.FS) {
            try {
                // 创建 tessdata 目录
                try { TesseractCore.FS.mkdir('/tessdata'); } catch(e) {}
                // 写入语言数据
                const langData = Uint8Array.from(atob('${langDataBase64}'), c => c.charCodeAt(0));
                TesseractCore.FS.writeFile('/tessdata/eng.traineddata', langData);
                console.log('[Worker] 语言数据注入成功');
            } catch (e) {
                console.error('[Worker] 语言数据注入失败:', e);
            }
        } else {
            // 稍后重试
            setTimeout(checkAndInject, 10);
        }
    };
    checkAndInject();
})();

// worker 代码
${workerCode}
`;
    return createDataUrl(new TextEncoder().encode(script), 'application/javascript');
}



async function ocrTranslateLocal(base64: string, translatePlatform: TranslationPlatform = 'local'): Promise<OcrResult> {
    let worker: any = null;

    try {
        // 动态导入 tesseract.js
        const { createWorker } = await import('tesseract.js');

        // 将 base64 转换为 data URL
        const imageUrl = `data:image/png;base64,${base64}`;

        debugLog('[本地OCR] 是否在 uTools 环境:', isUTools());
        debugLog('[本地OCR] 当前路径:', window.location.href);

        // 预加载所有资源文件
        debugLog('[本地OCR] 开始预加载资源文件...');
        let workerData: ArrayBuffer, coreData: ArrayBuffer, langData: ArrayBuffer;
        try {
            [workerData, coreData, langData] = await Promise.all([
                readLocalFile('./worker.min.js'),
                readLocalFile('./tesseract-core-simd-lstm.wasm.js'),
                readLocalFile('./tessdata/eng.traineddata')
            ]);
            debugLog('[本地OCR] 文件大小 - worker:', workerData.byteLength, 'core:', coreData.byteLength, 'lang:', langData.byteLength);
        } catch (fileError: any) {
            debugLog('[本地OCR] 读取文件失败:', fileError);
            return {
                errorCode: 'LOCAL_OCR_FILE_READ_FAILED',
                errorMessage: '读取 OCR 资源文件失败: ' + (fileError?.message || '未知错误'),
                resRegions: []
            };
        }

        // 将文件内容转为字符串
        const workerCode = new TextDecoder().decode(workerData);
        const coreCode = new TextDecoder().decode(coreData);

        // 将语言数据转为 base64
        const langDataBase64 = arrayBufferToBase64(langData);

        // 创建内联 Worker 脚本（合并 worker、core 和语言数据）
        const workerUrl = createInlineWorkerScript(workerCode, coreCode, langDataBase64);

        debugLog('[本地OCR] 所有资源加载完成，内联 Worker（含语言数据）创建成功');

        // 创建 worker 配置
        // workerPath 指向内联脚本，corePath 留空（已内联）
        const workerConfig: any = {
            workerPath: workerUrl,
            corePath: '',  // core 已内联在 worker 中
            logger: (m: any) => {
                debugLog('[本地OCR] Worker 日志:', m);
            },
            errorHandler: (err: any) => {
                debugLog('[本地OCR] Worker 错误:', err);
            }
        };

        debugLog('[本地OCR] 创建 Worker...');

        // 创建 worker（不指定语言，稍后手动加载）
        // @ts-ignore - Tesseract.js 允许不传语言
        try {
            worker = await createWorker(undefined, 1, workerConfig);
        } catch (workerError: any) {
            debugLog('[本地OCR] 创建 Worker 失败:', workerError);
            debugLog('[本地OCR] 错误堆栈:', workerError?.stack);

            return {
                errorCode: 'LOCAL_OCR_INIT_FAILED',
                errorMessage: '本地 OCR 引擎启动失败: ' + (workerError?.message || '未知错误'),
                resRegions: []
            };
        }

        debugLog('[本地OCR] Worker 创建成功（语言数据已内联）');

        // 等待语言数据注入完成
        debugLog('[本地OCR] 等待初始化...');
        try {
            // 等待一小段时间让语言数据注入完成
            await new Promise(resolve => setTimeout(resolve, 100));
            // 初始化语言（语言数据已经在 Worker FS 中）
            await worker.initialize('eng');
            debugLog('[本地OCR] 语言初始化成功');
        } catch (initError: any) {
            debugLog('[本地OCR] 初始化语言失败:', initError);
            await worker.terminate();
            return {
                errorCode: 'LOCAL_OCR_INIT_LANG_FAILED',
                errorMessage: '初始化语言失败: ' + (initError?.message || '未知错误'),
                resRegions: []
            };
        }

        debugLog('[本地OCR] 开始识别...');
        let result: any;
        try {
            result = await worker.recognize(imageUrl);
        } catch (recognizeError: any) {
            debugLog('[本地OCR] 识别失败:', recognizeError);
            await worker.terminate();
            return {
                errorCode: 'LOCAL_OCR_RECOGNIZE_FAILED',
                errorMessage: `识别失败: ${recognizeError?.message || '未知错误'}`,
                resRegions: []
            };
        }

        debugLog('[本地OCR] 识别完成:', result.data.text);

        // 清理资源
        await worker.terminate();

        const text = result.data.text?.trim();
        ElMessage.success({ message: '识别结果: ' + text, duration: 10000 })

        if (text) {
            debugLog('[本地OCR] 识别文本:', text);
            debugLog('[本地OCR] 翻译平台:', translatePlatform);

            let translatedText: string;

            if (translatePlatform === 'local') {
                // 使用本地词典翻译
                const {translateWithLocalDictionaryAsync} = await import('./local-dictionary');
                const translationResult = await translateWithLocalDictionaryAsync(text);
                debugLog('[本地OCR] 本地翻译结果:', translationResult);
                translatedText = translationResult.success
                    ? (translationResult.explains || '')
                    : text; // 翻译失败时显示原文
            } else {
                // 使用指定的翻译平台进行翻译
                try {
                    const {translateWithPlatform} = await import('./translation-api');
                    const translationResult = await translateWithPlatform(text, translatePlatform);
                    translatedText = translationResult.explains || text;
                    console.log('[本地OCR] 平台翻译结果:', translatedText);
                } catch (error) {
                    console.error('[本地OCR] 平台翻译失败，使用原文:', error);
                    translatedText = text;
                }
            }

            // 将识别结果作为一个整体返回
            // 注意：Tesseract.js 的段落检测不够精确，我们返回整体文本
            return {
                errorCode: '0',
                resRegions: [{
                    boundingBox: '0,0,0,0',
                    context: text,
                    tranContent: translatedText
                }]
            };
        } else {
            return {
                errorCode: 'LOCAL_OCR_NO_TEXT',
                resRegions: []
            };
        }
    } catch (error: any) {
        console.error('[本地OCR] 识别失败:', error);
        const errorMessage = error?.message || String(error) || '未知错误';

        ElMessage.error({ message: '[本地OCR] 识别失败: ' + errorMessage, duration: 20000 });

        return {
            errorCode: 'LOCAL_OCR_FAILED',
            errorMessage: `本地OCR失败: ${errorMessage}`,
            resRegions: []
        };
    }
}
