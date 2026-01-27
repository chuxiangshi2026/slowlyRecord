import { sha256 } from 'js-sha256';

// 根据官方文档定义 API 请求参数类型[citation:1]
export interface YoudaoImgTransRequest {
    type: string; // 固定为 '1'，表示Base64
    q: string;    // 图片的Base64编码字符串 (需URL编码)
    from: string; // 源语言，如 'en'
    to: string;   // 目标语言，如 'zh-CHS'
    appKey: string;
    salt: string; // UUID，用于签名
    sign: string;
    signType: string; // 固定为 'v3'
    curtime: string;  // 当前UTC时间戳（秒）
    ext?: string;     // 可选，如 'mp3'
    docType?: string; // 固定为 'json'
    render?: string;  // 是否返回渲染图，'0'或'1'
}

// API 响应数据类型（根据文档简化，可依据实际返回字段扩展）[citation:1]
export interface YoudaoImgTransResponse {
    errorCode: string;
    lanFrom: string;
    lanTo: string;
    resRegions?: Array<{
        context: string;
        tranContent: string;
        boundingBox: string;
    }>;
    translation?: string[]; // 如果返回了整合的翻译结果
}




/*
/!**
 * 生成调用有道图片翻译API所需的签名
 * 签名规则：sign = sha256(appKey + input + salt + curtime + appSecret)
 * 其中，input的计算方式为：
 *   - 如果q长度 > 20: input = q前10个字符 + q长度 + q后10个字符
 *   - 如果q长度 <= 20: input = q
 * @param appKey 应用ID
 * @param appSecret 应用密钥
 * @param q 图片的Base64编码字符串（未URL编码的原始字符串）
 * @param salt 随机字符串
 * @param curtime 当前时间戳（秒）
 * @returns 计算得到的签名
 *!/
function generateSign(
    appKey: string,
    appSecret: string,
    q: string,
    salt: string,
    curtime: string
): string {
    let input = q;
    if (q.length > 20) {
        input = q.substring(0, 10) + q.length + q.substring(q.length - 10);
    }
    const signStr = appKey + input + salt + curtime + appSecret;
    return sha256(signStr);
}

/!**
 * 调用有道图片翻译API
 * @param imageBase64 图片的Base64编码字符串（不含data:image前缀）
 * @param from 源语言代码
 * @param to 目标语言代码
 * @param appKey 应用ID
 * @param appSecret 应用密钥
 * @returns  Promise解析为API响应数据
 *!/
export async function translateImage(
    imageBase64: string,
    from: string,
    to: string,
    appKey: string,
    appSecret: string
): Promise<YoudaoImgTransResponse> {
    const salt = Date.now().toString(); // 简单生成salt，也可用UUID
    const curtime = Math.round(Date.now() / 1000).toString();

    // 1. 生成签名（使用原始的Base64字符串）
    const sign = generateSign(appKey, appSecret, imageBase64, salt, curtime);

    // 2. 构建请求参数（注意：q参数需要URL编码）
    const params: YoudaoImgTransRequest = {
        type: '1',
        q: encodeURIComponent(imageBase64), // 发送前进行URL编码[citation:1]
        from,
        to,
        appKey,
        salt,
        sign,
        signType: 'v3',
        curtime,
        docType: 'json',
        render: '0' // 不需要服务端返回渲染图
    };

    // 3. 使用FormData发送POST请求
    const formData = new FormData();
    Object.entries(params).forEach(([key, value]) => {
        formData.append(key, value);
    });

    const response = await fetch('https://openapi.youdao.com/ocrtransapi', {
        method: 'POST',
        body: formData
    });

    if (!response.ok) {
        throw new Error(`网络请求失败: ${response.status}`);
    }

    return await response.json() as YoudaoImgTransResponse;
}

/!**
 * 将File对象转换为纯Base64字符串（不含data:image前缀）
 * @param file 图片文件
 * @returns Promise解析为Base64字符串
 *!/
export function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            // 移除 data:image/png;base64, 前缀
            const base64WithPrefix = reader.result as string;
            const base64 = base64WithPrefix.split(',')[1];
            resolve(base64);
        };
        reader.onerror = (error) => reject(error);
    });
}
*/

import axios from 'axios'
import CryptoJS from 'crypto-js'

const API = 'https://openapi.youdao.com/ocrtransapi'

/** 符合官方要求的“截断”逻辑 */
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
        // color: "default"
        // colors: ['default']
        context: "(action.code === 'jietu'"
        dir: "h"
        lang: "ms"
        lineheight: 31
        linesCount: 1
        tranContent: "（action.code === 'jietu'" }>
}

/** 统一入口：传入 File 对象，返回 Promise<OcrResult> */
export async function ocrTranslate(
    file: File,
    appKey: string,
    secret: string,
    from = 'auto',
    to = 'zh-CHS'
): Promise<OcrResult> {
    const img = await fileToBase64(file)
    console.log("base64",img.length)
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

    const { data } = await axios.post(API, params, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    })
    return data as OcrResult
}
