import axios from 'axios'
import CryptoJS from 'crypto-js'
import {getCurrentUsageCount, hasCustomApiKey, incrementUsageCounter, isOverDailyLimit} from './usage-counter';
import {useWordsStore} from "@/stores/words.ts";
import {USAGE_LIMITS} from "@/constants";
import type {OcrPlatform, TranslationPlatform} from "@/types/words";
import {AppInfo} from "@/config.ts";
import {getOcrApiKey, getTranslationApiKey} from "@/utils/get-api-key.ts";

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
    return data as OcrResult
}

// 新增：多平台OCR翻译函数
export async function ocrTranslateMultiPlatform(): Promise<OcrResult> {


    const wordsStore = useWordsStore();
    const platform = wordsStore.currentTranslationPlatform || 'youdao';
    const ocrPlatform = wordsStore.currentOcrPlatform || 'youdao';

    // 检查是否超出了每日使用限制
    if (!hasCustomApiKey(ocrPlatform)) {
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

    // const {appkey, key} = getTranslationApiKey(platform);
    const {appkey, key} = getOcrApiKey(ocrPlatform);
    // console.log('appkey+key', appkey, key)

    // 将 utools.screenCapture 包装为 Promise
    return new Promise((resolve, reject) => {
        utools.screenCapture(async (image) => {
            console.log('截图回调：', image)

            try {
                // 去除 data:image/png;base64, 前缀
                const base64 = image.includes(',') ? image.split(',')[1] : image;

                let result: OcrResult;
                if (ocrPlatform === 'youdao') {
                    result = await ocrTranslate(base64, appkey, key, 'en', 'zh-CHS');
                } else if (ocrPlatform === 'baidu') {
                    result = await ocrTranslateBaidu(base64, appkey, key);
                } else if (ocrPlatform === 'ali') {
                    result = await ocrTranslateAli(base64, appkey, key);
                } else if (ocrPlatform === 'tencent') {
                    result = await ocrTranslateTencent(base64, appkey, key);
                } else {
                    result = { errorCode: '500', resRegions: [] };
                }
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
            throw new Error('Qwen API key is required');
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
            throw new Error('Kimi API key is required');
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
