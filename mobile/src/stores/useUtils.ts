/**
* 移动端工具模块 - 统一入口
* 合并所有工具到单文件，避免微信小程序模块注册问题
*/

// ==================== 翻译 API ====================
// 与桌面端保持一致，支持 10 个翻译引擎

export type TranslationPlatform = 'youdao' | 'baidu' | 'ali' | 'tencent' | 'deepseek' | 'qwen' | 'kimi' | 'glm' | 'ollama' | 'local'

// 敏感配置从独立文件导入（该文件受 git-crypt 加密保护）
import { DefaultApiKeys } from '@/config'

export interface TranslationResult {
  success: boolean
  explains: string
  /** 兼容旧代码 */
  translatedText: string
  phonetic?: string
  pronunciation?: string
  errorMsg?: string
  platform: string
  // AI 模型扩展字段
  examples?: { english: string; chinese: string }[]
  synonyms?: string[]
  antonyms?: string[]
  memoryTip?: string
  memoryImage?: string
  memoryImageUrl?: string
}

// ==================== 翻译设置管理 ====================

const STORAGE_KEY_TRANSLATION_PLATFORM = 'slowly_translation_platform'
const STORAGE_KEY_TRANSLATION_KEYS = 'slowly_translation_keys'

// 翻译平台申请链接（与桌面端一致）
export const TRANSLATION_PLATFORM_LINKS: { name: string; key: TranslationPlatform; content: string; url: string }[] = [
  { name: '有道', key: 'youdao', content: '申请有道密钥', url: 'https://ai.youdao.com/console/#/service-singleton/text-translation' },
  { name: '阿里', key: 'ali', content: '申请阿里密钥', url: 'https://mt.console.aliyun.com/service' },
  { name: '百度', key: 'baidu', content: '申请百度密钥', url: 'https://fanyi-api.baidu.com/choose' },
  { name: '阿里千问', key: 'qwen', content: '申请千问密钥', url: 'https://bailian.console.aliyun.com/cn-beijing/?tab=model#/efm/model_experience_center/text' },
  { name: 'DeepSeek', key: 'deepseek', content: '申请DeepSeek密钥', url: 'https://platform.deepseek.com/usage' },
  { name: 'Kimi', key: 'kimi', content: '申请Kimi密钥', url: 'https://platform.moonshot.cn/console/account' },
  { name: 'Ollama', key: 'ollama', content: '下载Ollama', url: 'https://ollama.com/download' },
  { name: '智谱GLM', key: 'glm', content: '申请GLM密钥（有免费额度）', url: 'https://open.bigmodel.cn/usercenter/apikeys' },
]

// 运行时状态
let currentPlatform: TranslationPlatform = 'glm' // 默认使用智谱GLM（与桌面端一致）

// 加载持久化的翻译设置
function loadTranslationSettings() {
  try {
    const saved = uni.getStorageSync(STORAGE_KEY_TRANSLATION_PLATFORM)
    if (saved && typeof saved === 'string') {
      currentPlatform = saved as TranslationPlatform
    }
  } catch { /* ignore */ }
}

// 初始化时加载
try { loadTranslationSettings() } catch { /* ignore */ }

// 用户自定义 API 密钥存储
const userApiKeys: Record<TranslationPlatform, { appkey: string; key: string }> = (() => {
  try {
    const saved = uni.getStorageSync(STORAGE_KEY_TRANSLATION_KEYS)
    if (saved && typeof saved === 'object') return saved
  } catch { /* ignore */ }
  return {} as Record<TranslationPlatform, { appkey: string; key: string }>
})()

export function setTranslationPlatform(platform: TranslationPlatform) {
  currentPlatform = platform
  try { uni.setStorageSync(STORAGE_KEY_TRANSLATION_PLATFORM, platform) } catch { /* ignore */ }
}

export function getTranslationPlatform(): TranslationPlatform {
  return currentPlatform
}

/** 获取当前平台的 API 密钥（用户设置优先，否则使用默认配置） */
export function getTranslationApiKey(provider: TranslationPlatform): { appkey: string; key: string } {
  const userKey = userApiKeys[provider]
  const defaultKey = DefaultApiKeys[provider]
  const appkey = (userKey?.appkey?.trim()) ? userKey.appkey.trim() : (defaultKey?.appkey || '')
  const key = (userKey?.key?.trim()) ? userKey.key.trim() : (defaultKey?.key || '')
  return { appkey, key }
}

/** 设置自定义 API 密钥 */
export function setTranslationApiKey(provider: TranslationPlatform, appkey: string, key: string) {
  if (!userApiKeys[provider]) userApiKeys[provider] = { appkey: '', key: '' }
  userApiKeys[provider].appkey = appkey
  userApiKeys[provider].key = key
  try { uni.setStorageSync(STORAGE_KEY_TRANSLATION_KEYS, userApiKeys) } catch { /* ignore */ }
}

/** 判断用户是否设置了自定义密钥 */
export function hasCustomTranslationApiKey(provider: TranslationPlatform): boolean {
  const uk = userApiKeys[provider]
  return !!(uk?.appkey?.trim())
}

// ---- MD5 辅助函数（纯JS实现，用于国内API签名）----
function md5(input: string): string {
  const K = [0xd76aa478,0xe8c7b756,0x242070db,0xc1bdceee,0xf57c0faf,0x4787c62a,0xa8304613,0xfd469501,
    0x698098d8,0x8b44f7af,0xffff5bb1,0x895cd7be,0x6b901122,0xfd987193,0xa679438e,0x49b40821,
    0xf61e2562,0xc040b340,0x265e5a51,0xe9b6c7aa,0xd62f105d,0x02441453,0xd8a1e681,0xe7d3fbc8,
    0x21e1cde6,0xc33707d6,0xf4d50d87,0x455a14ed,0xa9e3e905,0xfcefa3f8,0x676f02d9,0x8d2a4c8a,
    0xfffa3942,0x8771f681,0x6d9d6122,0xfde5380c,0xa4beea44,0x4bdecfa9,0xf6bb4b60,0xbebfbc70,
    0x289b7ec6,0xeaa127fa,0xd4ef3085,0x04881d05,0xd9d4d039,0xe6db99e5,0x1fa27cf8,0xc4ac5665,
    0xf4292244,0x432aff97,0xab9423a7,0xfc93a039,0x655b59c3,0x8f0ccc92,0xffeff47d,0x85845dd1,
    0x6fa87e4f,0xfe2ce6e0,0xa3014314,0x4e0811a1,0xf7537e82,0xbd3af235,0x2ad7d2bb,0xeb86d391]
  const S = [7,12,17,22,7,12,17,22,7,12,17,22,7,12,17,22,5,9,14,20,5,9,14,20,5,9,14,20,5,9,14,20,
    4,11,16,23,4,11,16,23,4,11,16,23,4,11,16,23,6,10,15,21,6,10,15,21,6,10,15,21,6,10,15,21]
  const hex = '0123456789abcdef'
  const bytes: number[] = []
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i)
    if (c < 0x80) bytes.push(c)
    else if (c < 0x800) bytes.push(0xc0|(c>>6),0x80|(c&0x3f))
    else if (c < 0xd800 || c > 0xdbff) bytes.push(0xe0|(c>>12),0x80|((c>>6)&0x3f),0x80|(c&0x3f))
    else { const c2=input.charCodeAt(++i); const cp=((c&0x3ff)<<10)|(c2&0x3ff); bytes.push(0xf0|(cp>>18),0x80|((cp>>12)&0x3f),0x80|((cp>>6)&0x3f),0x80|(cp&0x3f)) }
  }
  const origLen = bytes.length * 8
  bytes.push(0x80)
  while ((bytes.length % 64) !== 56) bytes.push(0)
  for (let i = 0; i < 8; i++) bytes.push((origLen >>> (i * 8)) & 0xff)
  let a=0x67452301,b=0xefcdab89,c=0x98badcfe,d=0x10325476
  for (let i=0;i<bytes.length;i+=64) {
    const w:number[]=[]
    for (let j=0;j<64;j+=4) w.push(bytes[i+j]|(bytes[i+j+1]<<8)|(bytes[i+j+2]<<16)|(bytes[i+j+3]<<24))
    let A=a,B=b,C=c,D=d
    for (let j=0;j<64;j++) {
      let f:number,g:number
      if (j<16){f=(B&C)|(~B&D);g=j}
      else if (j<32){f=(D&B)|(~D&C);g=(5*j+1)%16}
      else if (j<48){f=B^C^D;g=(3*j+5)%16}
      else {f=C^(B|~D);g=(7*j)%16}
      const x=((A+f+K[j]+w[g])|0)
      const tmp=D
      D=C;C=B;B=(B+((x<<S[j])|(x>>>(32-S[j]))))|0;A=tmp
    }
    a=(a+A)|0;b=(b+B)|0;c=(c+C)|0;d=(d+D)|0
  }
  let hash=''
  for (const n of [a,b,c,d]) for (let i=0;i<4;i++) { const v=(n>>>(i*8))&0xff; hash+=hex[v>>>4]+hex[v&0xf] }
  return hash
}

/**
 * 翻译文本（主入口）
 * 策略：1. 离线词典 2. 当前选择的翻译引擎
 */
export async function translateText(
  text: string,
  from: string = 'auto',
  to: string = 'zh'
): Promise<TranslationResult> {
  const trimmed = text.trim().toLowerCase()
  if (!trimmed) {
    return { success: false, explains: '', translatedText: '', errorMsg: '请输入要翻译的文本', platform: 'local' }
  }

  // 1. 先查离线词典（单个单词）
  if (!trimmed.includes(' ')) {
    const offline = queryOfflineDict(trimmed)
    if (offline) {
      return {
        success: true,
        explains: offline,
        translatedText: offline,
        pronunciation: getPronunciationUrl(trimmed),
        platform: 'local'
      }
    }
  }

  // 2. 使用当前选择的翻译引擎
  try {
    switch (currentPlatform) {
      case 'youdao': return await translateWithYoudao(text, from, to)
      case 'baidu': return await translateWithBaidu(text, from, to)
      case 'ali': return await translateWithAli(text, from, to)
      case 'tencent': return await translateWithTencent(text, from, to)
      case 'deepseek': return await translateWithDeepseek(text, from, to)
      case 'qwen': return await translateWithQwen(text, from, to)
      case 'kimi': return await translateWithKimi(text, from, to)
      case 'glm': return await translateWithGlm(text, from, to)
      case 'ollama': return await translateWithOllama(text, from, to)
      case 'local': return await translateWithLocalDict(text, from, to)
      default: return await translateWithGlm(text, from, to)
    }
  } catch (e) {
    return {
      success: false,
      explains: text,
      translatedText: text,
      errorMsg: '翻译服务暂不可用，显示原文',
      platform: 'fallback'
    }
  }
}

// ==================== 各翻译引擎实现 ====================

/** 有道翻译（MD5签名） */
async function translateWithYoudao(
  text: string,
  from: string = 'auto',
  to: string = 'zh'
): Promise<TranslationResult> {
  const { appkey: appKey, key: appSecret } = getTranslationApiKey('youdao')
  const salt = '' + Date.now()
  const sign = md5(appKey + text + salt + appSecret)
  return new Promise((resolve) => {
    uni.request({
      url: 'https://openapi.youdao.com/api',
      method: 'GET',
      data: { q: text, appKey, salt, from: from === 'auto' ? 'auto' : from, to, sign },
      success: (res) => {
        const data = res.data as any
        if (data.errorCode === '0') {
          resolve({ success: true, explains: data.translation?.[0] || text, translatedText: data.translation?.[0] || text, phonetic: data.basic?.phonetic || '', pronunciation: `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(text)}&type=1`, platform: 'youdao' })
        } else {
          resolve({ success: false, explains: text, translatedText: text, errorMsg: `有道翻译错误: ${data.errorCode}`, platform: 'youdao' })
        }
      },
      fail: () => resolve({ success: false, explains: text, translatedText: text, errorMsg: '有道翻译请求失败', platform: 'youdao' })
    })
  })
}

/** 百度翻译（MD5签名） */
async function translateWithBaidu(
  text: string,
  from: string = 'auto',
  to: string = 'zh'
): Promise<TranslationResult> {
  const { appkey: appid, key: secretKey } = getTranslationApiKey('baidu')
  const salt = '' + Date.now()
  const sign = md5(appid + text + salt + secretKey)
  return new Promise((resolve) => {
    uni.request({
      url: 'https://fanyi-api.baidu.com/api/trans/vip/translate',
      method: 'GET',
      data: { q: text, from: from === 'auto' ? 'auto' : from, to, appid, salt, sign },
      success: (res) => {
        const data = res.data as any
        if (!data.error_code || data.error_code === '52000') {
          resolve({ success: true, explains: data.trans_result?.[0]?.dst || text, translatedText: data.trans_result?.[0]?.dst || text, pronunciation: `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(text)}&type=1`, platform: 'baidu' })
        } else {
          resolve({ success: false, explains: text, translatedText: text, errorMsg: `百度翻译错误: ${data.error_code}`, platform: 'baidu' })
        }
      },
      fail: () => resolve({ success: false, explains: text, translatedText: text, errorMsg: '百度翻译请求失败', platform: 'baidu' })
    })
  })
}

/** 阿里翻译 */
async function translateWithAli(
  text: string,
  from: string = 'auto',
  to: string = 'zh'
): Promise<TranslationResult> {
  const { appkey, key: secretKey } = getTranslationApiKey('ali')
  try {
    const timestamp = new Date().toISOString().replace(/\.\d+Z/, 'Z')
    const params: Record<string, string> = {
      Format: 'JSON', Version: '2018-10-12', AccessKeyId: appkey,
      SignatureMethod: 'HMAC-SHA1', Timestamp: timestamp, SignatureVersion: '1.0',
      SignatureNonce: Math.random().toString(36).slice(2, 15),
      Action: 'TranslateGeneral', SourceLanguage: from === 'auto' ? 'auto' : from,
      TargetLanguage: to, SourceText: text, FormatType: 'text', Scene: 'general',
    }
    const signature = hmacSha1Signature(params, secretKey)
    params.Signature = signature
    const queryString = Object.entries(params).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&')
    return new Promise((resolve) => {
      uni.request({
        url: `https://mt.aliyuncs.com/?${queryString}`,
        method: 'GET',
        success: (res) => {
          const data = res.data as any
          if (data.Code === '200' && data.Data) {
            resolve({ success: true, explains: data.Data.Translated, translatedText: data.Data.Translated, pronunciation: `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(text)}&type=1`, platform: 'ali' })
          } else {
            resolve({ success: false, explains: text, translatedText: text, errorMsg: `阿里翻译错误: ${data.Message || '未知错误'}`, platform: 'ali' })
          }
        },
        fail: () => resolve({ success: false, explains: text, translatedText: text, errorMsg: '阿里翻译请求失败', platform: 'ali' })
      })
    })
  } catch (e) {
    return { success: false, explains: text, translatedText: text, errorMsg: '阿里翻译错误: ' + String(e), platform: 'ali' }
  }
}

/** 阿里 API HMAC-SHA1 签名 */
function hmacSha1Signature(params: Record<string, string>, accessKeySecret: string): string {
  const sortedKeys = Object.keys(params).sort()
  let canonicalizedQueryString = ''
  for (const key of sortedKeys) {
    const encodedKey = encodeURIComponent(key).replace(/\!/g,'%21').replace(/\*/g,'%2A').replace(/'/g,'%27').replace(/\(/g,'%28').replace(/\)/g,'%29')
    const encodedValue = encodeURIComponent(params[key]).replace(/\!/g,'%21').replace(/\*/g,'%2A').replace(/'/g,'%27').replace(/\(/g,'%28').replace(/\)/g,'%29')
    canonicalizedQueryString += `&${encodedKey}=${encodedValue}`
  }
  canonicalizedQueryString = canonicalizedQueryString.substring(1)
  const stringToSign = `GET&${encodeURIComponent('/').replace(/\!/g,'%21').replace(/\*/g,'%2A')}&${encodeURIComponent(canonicalizedQueryString)}`
  // 纯JS HMAC-SHA1
  return hmacSha1Base64(stringToSign, accessKeySecret + '&')
}

/** 纯JS HMAC-SHA1 实现，返回 base64 */
function hmacSha1Base64(message: string, key: string): string {
  const keyBytes = utf8ToBytes_HMAC(key)
  const msgBytes = utf8ToBytes_HMAC(message)
  const blockSize = 64
  let iKey = new Uint8Array(blockSize), oKey = new Uint8Array(blockSize)
  for (let i = 0; i < blockSize; i++) {
    iKey[i] = (keyBytes[i] || 0) ^ 0x36
    oKey[i] = (keyBytes[i] || 0) ^ 0x5c
  }
  if (keyBytes.length > blockSize) {
    iKey = sha1Raw(new Uint8Array([...iKey.slice(0, blockSize)]))
    oKey = sha1Raw(new Uint8Array([...oKey.slice(0, blockSize)]))
  }
  const inner = sha1Raw(new Uint8Array([...iKey.slice(0, blockSize), ...msgBytes]))
  const result = sha1Raw(new Uint8Array([...oKey.slice(0, blockSize), ...inner]))
  return uint8ToBase64(result)
}

/** 纯JS SHA-1 */
function sha1Raw(data: Uint8Array): Uint8Array {
  const bytes = new Uint8Array(data)
  const ml = bytes.length * 8
  bytes.push(0x80)
  while ((bytes.length % 64) !== 56) bytes.push(0)
  const mlh = new Uint8Array(8)
  for (let i = 0; i < 8; i++) mlh[7 - i] = (ml >>> (i * 8)) & 0xff
  for (let i = 0; i < 8; i++) bytes.push(mlh[i])
  let h0 = 0x67452301, h1 = 0xEFCDAB89, h2 = 0x98BADCFE, h3 = 0x10325476, h4 = 0xC3D2E1F0
  for (let i = 0; i < bytes.length; i += 64) {
    const w = new Uint32Array(80)
    for (let j = 0; j < 16; j++) w[j] = (bytes[i + j * 4] << 24) | (bytes[i + j * 4 + 1] << 16) | (bytes[i + j * 4 + 2] << 8) | bytes[i + j * 4 + 3]
    for (let j = 16; j < 80; j++) { w[j] = rotl32(w[j - 3] ^ w[j - 8] ^ w[j - 14] ^ w[j - 16], 1) }
    let a = h0, b = h1, c = h2, d = h3, e = h4
    for (let j = 0; j < 80; j++) {
      let f: number, k: number
      if (j < 20) { f = (b & c) | ((~b) & d); k = 0x5A827999 }
      else if (j < 40) { f = b ^ c ^ d; k = 0x6ED9EBA1 }
      else if (j < 60) { f = (b & c) | (b & d) | (c & d); k = 0x8F1BBCDC }
      else { f = b ^ c ^ d; k = 0xCA62C1D6 }
      const temp = (rotl32(a, 5) + f + e + k + w[j]) >>> 0
      e = d; d = c; c = rotl32(b, 30); b = a; a = temp
    }
    h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0; h4 = (h4 + e) >>> 0
  }
  const out = new Uint8Array(20)
  const hs = [h0, h1, h2, h3, h4]
  for (let i = 0; i < 5; i++) { out[i * 4] = (hs[i] >>> 24) & 0xff; out[i * 4 + 1] = (hs[i] >>> 16) & 0xff; out[i * 4 + 2] = (hs[i] >>> 8) & 0xff; out[i * 4 + 3] = hs[i] & 0xff }
  return out
}

function rotl32(val: number, shift: number): number { return ((val << shift) | (val >>> (32 - shift))) >>> 0 }

function uint8ToBase64(bytes: Uint8Array): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  let result = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const b1 = bytes[i], b2 = bytes[i + 1] || 0, b3 = bytes[i + 2] || 0
    result += chars[b1 >> 2] + chars[((b1 & 3) << 4) | (b2 >> 4)] + (i + 1 < bytes.length ? chars[((b2 & 15) << 2) | (b3 >> 6)] : '=') + (i + 2 < bytes.length ? chars[b3 & 63] : '=')
  }
  return result
}

/** 腾讯翻译（TC3-HMAC-SHA256 签名，纯JS实现）  */
async function translateWithTencent(
  text: string,
  from: string = 'auto',
  to: string = 'zh'
): Promise<TranslationResult> {
  try {
    const data = await tencentCloudRequest(
      'tmt',
      'tmt.tencentcloudapi.com',
      'TextTranslate',
      '2018-03-21',
      'ap-beijing',
      { SourceText: text, Source: from === 'auto' ? 'auto' : from, Target: to, ProjectId: 0 }
    )

    if (data.Response && data.Response.TargetText) {
      return { success: true, explains: data.Response.TargetText, translatedText: data.Response.TargetText, pronunciation: `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(text)}&type=1`, platform: 'tencent' }
    } else {
      return { success: false, explains: text, translatedText: text, errorMsg: `腾讯翻译错误: ${data.Response?.Error?.Message || '未知错误'}`, platform: 'tencent' }
    }
  } catch (e) {
    return { success: false, explains: text, translatedText: text, errorMsg: '腾讯翻译错误: ' + String(e), platform: 'tencent' }
  }
}

// ==================== AI 大模型翻译引擎 ====================

/** 构建 AI 翻译的系统提示词 */
function buildAiSystemPrompt(from: string, to: string): string {
  const isToEnglish = to === 'en'
  const isEnglishToChinese = (from === 'en' || from === 'auto') && to === 'zh'
  if (isEnglishToChinese) {
    return `你是一个专业的中英文翻译助手。请将用户输入的英文单词或短语翻译成中文，并以JSON格式返回以下信息：
{
  "translation": "中文翻译",
  "phonetic": "音标（如有）",
  "examples": [{"english": "英文例句1", "chinese": "中文翻译1"},{"english": "英文例句2", "chinese": "中文翻译2"}],
  "synonyms": ["近义词1", "近义词2"],
  "antonyms": ["反义词1", "反义词2"],
  "memoryTip": "记忆提示：用词根词缀、发音规律、谐音联想、场景联想等方法帮助记忆这个单词",
  "memoryImage": "描述一个生动的画面，帮助通过视觉联想记住这个单词的含义"
}
注意：必须返回有效的JSON格式，不要添加任何其他文字说明`
  } else if (isToEnglish) {
    return `你是一个专业的中英文翻译助手。请将用户输入的中文翻译成英文，并以JSON格式返回以下信息：
{
  "translation": "英文翻译",
  "phonetic": "音标（如有）",
  "examples": [{"english": "英文例句1", "chinese": "中文翻译1"},{"english": "英文例句2", "chinese": "中文翻译2"}],
  "synonyms": ["英文近义词1", "英文近义词2"],
  "antonyms": ["英文反义词1", "英文反义词2"],
  "memoryTip": "记忆提示：用中文解释如何记忆这个英文表达，可以是词根词缀、联想等方法",
  "memoryImage": "描述一个生动的画面，帮助通过视觉联想记住这个英文表达"
}
注意：必须返回有效的JSON格式，不要添加任何其他文字说明`
  }
  return `你是一个专业的翻译助手。请将用户输入的文本翻译成目标语言，并以JSON格式返回：{"translation":"翻译结果","examples":[{"source":"原文例句1","target":"翻译1"},{"source":"原文例句2","target":"翻译2"}]}。必须返回有效的JSON格式，不要添加任何其他文字说明`
}

/** 解析 AI 模型的 JSON 响应 */
function parseAiTranslationResponse(content: string, text: string, platform: string): TranslationResult {
  const pronunciation = `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(text)}&type=1`
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      return {
        success: true,
        explains: parsed.translation || content.trim(),
        translatedText: parsed.translation || content.trim(),
        phonetic: parsed.phonetic || '',
        pronunciation,
        platform,
        examples: parsed.examples || [],
        synonyms: parsed.synonyms || [],
        antonyms: parsed.antonyms || [],
        memoryTip: parsed.memoryTip || '',
        memoryImage: parsed.memoryImage || ''
      }
    }
  } catch { /* fall through */ }
  return { success: true, explains: content.trim(), translatedText: content.trim(), pronunciation, platform }
}

/** AI 引擎通用请求 */
function aiChatRequest(url: string, apiKey: string, model: string, systemPrompt: string, query: string, text: string, platform: string): Promise<TranslationResult> {
  return new Promise((resolve) => {
    uni.request({
      url,
      method: 'POST',
      header: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      data: { model, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: query }], stream: false },
      success: (res) => {
        const data = res.data as any
        const content = data.choices?.[0]?.message?.content
        if (content) {
          resolve(parseAiTranslationResponse(content, text, platform))
        } else {
          const errMsg = data.error?.message || '未知错误'
          resolve({ success: false, explains: text, translatedText: text, errorMsg: `${platform} 错误: ${errMsg}`, platform })
        }
      },
      fail: () => resolve({ success: false, explains: text, translatedText: text, errorMsg: `${platform} 请求失败`, platform })
    })
  })
}

/** DeepSeek 翻译 */
async function translateWithDeepseek(text: string, from: string = 'auto', to: string = 'zh'): Promise<TranslationResult> {
  const { appkey: apiKey, key: modelName } = getTranslationApiKey('deepseek')
  if (!apiKey) return { success: false, explains: text, translatedText: text, errorMsg: '请先配置DeepSeek API密钥', platform: 'deepseek' }
  return aiChatRequest('https://api.deepseek.com/v1/chat/completions', apiKey, modelName || 'deepseek-chat', buildAiSystemPrompt(from, to), text, text, 'deepseek')
}

/** 通义千问翻译 */
async function translateWithQwen(text: string, from: string = 'auto', to: string = 'zh'): Promise<TranslationResult> {
  const { appkey: apiKey, key: modelName } = getTranslationApiKey('qwen')
  if (!apiKey) return { success: false, explains: text, translatedText: text, errorMsg: '请先配置通义千问API密钥', platform: 'qwen' }
  return aiChatRequest('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', apiKey, modelName || 'qwen-max', buildAiSystemPrompt(from, to), text, text, 'qwen')
}

/** Kimi 翻译 */
async function translateWithKimi(text: string, from: string = 'auto', to: string = 'zh'): Promise<TranslationResult> {
  const { appkey: apiKey, key: modelName } = getTranslationApiKey('kimi')
  if (!apiKey) return { success: false, explains: text, translatedText: text, errorMsg: '请先配置Kimi API密钥', platform: 'kimi' }
  return aiChatRequest('https://api.moonshot.cn/v1/chat/completions', apiKey, modelName || 'kimi-k2-turbo-preview', buildAiSystemPrompt(from, to), text, text, 'kimi')
}

/** 智谱GLM翻译 */
async function translateWithGlm(text: string, from: string = 'auto', to: string = 'zh'): Promise<TranslationResult> {
  const { appkey: apiKey, key: modelName } = getTranslationApiKey('glm')
  if (!apiKey) return { success: false, explains: text, translatedText: text, errorMsg: '请先配置智谱GLM API密钥', platform: 'glm' }
  return aiChatRequest('https://open.bigmodel.cn/api/paas/v4/chat/completions', apiKey, modelName || 'glm-4-flash', buildAiSystemPrompt(from, to), text, text, 'glm')
}

/** Ollama 本地模型翻译 */
async function translateWithOllama(text: string, from: string = 'auto', to: string = 'zh'): Promise<TranslationResult> {
  const { appkey: baseUrl, key: modelName } = getTranslationApiKey('ollama')
  const ollamaUrl = baseUrl || 'http://localhost:11434'
  const model = modelName || 'qwen2.5:0.5b'
  const isToEnglish = to === 'en'
  const targetLang = isToEnglish ? '英文' : '中文'
  const sourceLang = from === 'zh' ? '中文' : (from === 'en' ? '英文' : '文本')
  return new Promise((resolve) => {
    uni.request({
      url: `${ollamaUrl}/api/generate`,
      method: 'POST',
      header: { 'Content-Type': 'application/json' },
      data: { model, prompt: `请将以下${sourceLang}翻译成${targetLang}：${text}`, stream: false },
      success: (res) => {
        const data = res.data as any
        const translation = data.response?.trim() || data.message?.content?.trim() || ''
        if (translation) {
          resolve(parseAiTranslationResponse(translation, text, 'ollama'))
        } else {
          resolve({ success: false, explains: text, translatedText: text, errorMsg: 'Ollama 返回为空', platform: 'ollama' })
        }
      },
      fail: () => resolve({ success: false, explains: text, translatedText: text, errorMsg: 'Ollama 请求失败，请确保服务已启动', platform: 'ollama' })
    })
  })
}

/** 本地离线词典翻译 */
async function translateWithLocalDict(text: string, _from: string = 'auto', _to: string = 'zh'): Promise<TranslationResult> {
  const offline = queryOfflineDict(text.toLowerCase().trim())
  if (offline) {
    return { success: true, explains: offline, translatedText: offline, pronunciation: getPronunciationUrl(text), platform: 'local' }
  }
  return { success: false, explains: text, translatedText: text, errorMsg: '离线词典未收录该单词', platform: 'local' }
}

// ==================== 图片识别（OCR） ====================

export interface OcrWordResult {
  word: string
  meaning: string
  phonetic?: string
}

/**
 * 腾讯云通用 TC3-HMAC-SHA256 签名请求（通用函数，翻译和 OCR 共用）
 */
function tencentCloudRequest(
  service: string,
  host: string,
  action: string,
  version: string,
  region: string,
  bodyObj: Record<string, any>
): Promise<any> {
  const { appkey: secretId, key: secretKey } = getTranslationApiKey('tencent')
  if (!secretId || !secretKey) {
    return Promise.reject(new Error('腾讯云API密钥未配置'))
  }

  const timestamp = Math.floor(Date.now() / 1000)
  const date = new Date(timestamp * 1000).toISOString().slice(0, 10)
  const payload = JSON.stringify(bodyObj)

  const canonicalHeaders = `content-type:application/json; charset=utf-8\nhost:${host}\nx-tc-action:${action.toLowerCase()}\n`
  const signedHeaders = 'content-type;host;x-tc-action'
  const hashedPayload = sha256Pure(utf8ToBytes_HMAC(payload))
  const canonicalRequest = `POST\n/\n\n${canonicalHeaders}\n${signedHeaders}\n${hashedPayload}`

  const credentialScope = `${date}/${service}/tc3_request`
  const hashedCanonicalRequest = sha256Pure(utf8ToBytes_HMAC(canonicalRequest))
  const stringToSign = `TC3-HMAC-SHA256\n${timestamp}\n${credentialScope}\n${hashedCanonicalRequest}`

  const kDate = hmacSha256Pure(utf8ToBytes_HMAC(`TC3${secretKey}`), utf8ToBytes_HMAC(date))
  const kService = hmacSha256Pure(kDate, utf8ToBytes_HMAC(service))
  const kSigning = hmacSha256Pure(kService, utf8ToBytes_HMAC('tc3_request'))
  const signature = arrayToHex(hmacSha256Pure(kSigning, utf8ToBytes_HMAC(stringToSign)))

  const authorization = `TC3-HMAC-SHA256 Credential=${secretId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`

  return new Promise((resolve, reject) => {
    uni.request({
      url: `https://${host}`,
      method: 'POST',
      header: {
        'Content-Type': 'application/json; charset=utf-8',
        'Host': host,
        'X-TC-Action': action,
        'X-TC-Version': version,
        'X-TC-Region': region,
        'X-TC-Timestamp': String(timestamp),
        'Authorization': authorization
      },
      // 直接传 JSON 字符串，确保请求体与签名的 payload 完全一致
      // （传对象时 uni.request 可能对 base64 等长字符串序列化结果不同）
      data: payload,
      success: (res) => {
        const data = res.data as any
        resolve(data)
      },
      fail: (err) => {
        reject(new Error(`腾讯云请求失败[${service}/${action}]: ` + (err.errMsg || '网络错误')))
      }
    })
  })
}

/**
 * 腾讯云通用印刷体识别
 * 专用 OCR API，比视觉大模型更准确、更稳定
 */
async function tencentCloudOcr(base64Image: string): Promise<string[]> {
  // 去掉 data: 前缀，腾讯云 OCR 只需要纯 base64
  const pureBase64 = base64Image.startsWith('data:')
    ? base64Image.substring(base64Image.indexOf(',') + 1)
    : base64Image

  const data = await tencentCloudRequest(
    'ocr',
    'ocr.tencentcloudapi.com',
    'GeneralBasicOCR',
    '2018-11-19',
    'ap-beijing',
    { ImageBase64: pureBase64 }
  )

  if (data.Response?.Error) {
    throw new Error(`腾讯云OCR错误[${data.Response.Error.Code}]: ${data.Response.Error.Message}`)
  }
  const detections: Array<{ DetectedText: string }> = data.Response?.TextDetections || []
  return detections.map(d => d.DetectedText).filter(t => t && t.trim())
}

/**
 * 从 OCR 识别出的文本行中提取英文单词
 * 过滤掉纯数字、标点、中文等非英文内容
 */
function extractEnglishWords(textLines: string[]): string[] {
  const wordSet = new Set<string>()
  for (const line of textLines) {
    // 用非字母字符分割，提取连续的英文字母串
    const words = line.split(/[^a-zA-Z]+/).filter(w => w.length > 1) // 至少2个字母
    for (const w of words) {
      wordSet.add(w.toLowerCase())
    }
  }
  return Array.from(wordSet)
}

/** 识别图片中的英文单词：OCR 识别文字 → 翻译 API 查词 */
export async function recognizeImageWords(base64Image: string): Promise<OcrWordResult[]> {
  // 策略 1：腾讯云专用 OCR（更准确、更稳定）→ 翻译 API 查词
  // 策略 2：降级到视觉大模型直接识别（OCR 失败时）

  // --- 策略 1：腾讯云 OCR ---
  const { appkey: tencentId } = getTranslationApiKey('tencent')
  if (tencentId) {
    try {
      const textLines = await tencentCloudOcr(base64Image)
      const words = extractEnglishWords(textLines)
      if (words.length > 0) {
        // 对每个单词调用翻译 API 获取释义和音标
        const results: OcrWordResult[] = []
        for (const word of words.slice(0, 10)) { // 最多处理10个单词
          try {
            const translation = await translateText(word, 'en', 'zh')
            results.push({
              word,
              meaning: translation.explains || translation.translatedText || word,
              phonetic: translation.phonetic || undefined
            })
          } catch {
            results.push({ word, meaning: '' })
          }
        }
        if (results.length > 0) return results
      }
    } catch (e: any) {
      console.warn('腾讯云OCR失败，降级到视觉模型:', e.message)
    }
  }

  // --- 策略 2：视觉大模型 fallback ---
  const { appkey: glmKey } = getTranslationApiKey('glm')
  const { appkey: qwenKey } = getTranslationApiKey('qwen')
  const errors: string[] = []

  if (glmKey) {
    try {
      return await recognizeImageWithApi(
        'https://open.bigmodel.cn/api/paas/v4/chat/completions',
        glmKey,
        'glm-4v-flash',
        base64Image
      )
    } catch (e: any) {
      errors.push(`GLM: ${e.message}`)
    }
  }

  if (qwenKey) {
    try {
      return await recognizeImageWithApi(
        'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
        qwenKey,
        'qwen-vl-max',
        base64Image
      )
    } catch (e: any) {
      errors.push(`Qwen: ${e.message}`)
    }
  }

  throw new Error('OCR识别失败（腾讯云OCR和视觉模型均不可用）: ' + errors.join('; '))
}

async function recognizeImageWithApi(
  url: string,
  apiKey: string,
  model: string,
  base64Image: string
): Promise<OcrWordResult[]> {
  // 构造 base64 data URL（视觉 API 要求此格式，不支持 HTTP URL）
  let dataUrl: string
  if (base64Image.startsWith('data:')) {
    dataUrl = base64Image
  } else {
    dataUrl = `data:image/jpeg;base64,${base64Image}`
  }

  // 检查 base64 大小，过大则警告
  const base64Size = base64Image.length * 0.75
  if (base64Size > 4 * 1024 * 1024) {
    console.warn(`OCR 图片 base64 较大: ${(base64Size / 1024 / 1024).toFixed(1)}MB，可能影响识别效果`)
  }

  return new Promise((resolve, reject) => {
    uni.request({
      url,
      method: 'POST',
      header: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      data: {
        model,
        messages: [{
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: dataUrl } },
            { type: 'text', text: 'You are an OCR assistant specialized in recognizing English text from images. Please carefully identify ALL English words visible in this image. For each word, provide the word itself, its Chinese meaning, and its phonetic transcription (IPA). Return the result as a JSON array: [{"word":"the_word","meaning":"中文释义","phonetic":"音标"}]. Rules: 1) Only include real English words (not abbreviations, numbers, or symbols). 2) Correct any OCR errors - if a letter looks ambiguous, use context to determine the correct word. 3) Each word should be lowercase. 4) If no English words are found, return an empty array []. 5) Return ONLY the JSON array, no other text.' }
          ]
        }],
        stream: false,
        temperature: 0.1,
        max_tokens: 2000
      },
      success: (res) => {
        const data = res.data as any
        // 检查 API 错误
        if (data.error) {
          reject(new Error(data.error.message || `API 错误: ${data.error.code || 'unknown'}`))
          return
        }
        const content = data.choices?.[0]?.message?.content
        if (!content) {
          reject(new Error('识别结果为空'))
          return
        }
        try {
          // 尝试提取 JSON 数组
          const jsonMatch = content.match(/\[[\s\S]*\]/)
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0])
            if (Array.isArray(parsed)) {
              // 过滤无效结果并规范化
              const results = parsed
                .filter((item: any) => item && typeof item.word === 'string' && item.word.trim())
                .map((item: any) => ({
                  word: String(item.word).trim().toLowerCase(),
                  meaning: String(item.meaning || '').trim(),
                  phonetic: item.phonetic ? String(item.phonetic).trim() : undefined
                }))
                .filter((item: OcrWordResult) => /^[a-z]+$/i.test(item.word) && item.word.length > 0)
              resolve(results)
            } else {
              resolve([])
            }
          } else {
            // 尝试提取单个单词（模型有时返回单个对象而非数组）
            const singleMatch = content.match(/\{[\s\S]*"word"[\s\S]*\}/)
            if (singleMatch) {
              const parsed = JSON.parse(singleMatch[0])
              if (parsed.word && typeof parsed.word === 'string') {
                resolve([{
                  word: String(parsed.word).trim().toLowerCase(),
                  meaning: String(parsed.meaning || '').trim(),
                  phonetic: parsed.phonetic ? String(parsed.phonetic).trim() : undefined
                }])
              } else {
                resolve([])
              }
            } else {
              resolve([])
            }
          }
        } catch {
          console.warn('OCR JSON 解析失败，原始内容:', content.substring(0, 200))
          resolve([])
        }
      },
      fail: (err) => {
        reject(new Error('图片识别请求失败: ' + (err.errMsg || '网络错误')))
      }
    })
  })
}

// ==================== 纯JS SHA256/HMAC-SHA256（腾讯API签名用） ====================

function utf8ToBytes_HMAC(str: string): Uint8Array {
  const bytes: number[] = []
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i)
    if (c < 0x80) bytes.push(c)
    else if (c < 0x800) bytes.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f))
    else if (c < 0xd800 || c > 0xdbff) bytes.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f))
    else { const c2 = str.charCodeAt(++i); const cp = ((c & 0x3ff) << 10) | (c2 & 0x3ff); bytes.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 0x3f), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f)) }
  }
  return new Uint8Array(bytes)
}

const SHA256_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
])

function sha256Pure(data: Uint8Array): string {
  const pad = new Uint8Array((Math.ceil((data.length + 9) / 64) * 64))
  pad.set(data)
  pad[data.length] = 0x80
  const bitsLen = data.length * 8
  const view = new DataView(pad.buffer)
  view.setUint32(pad.length - 8, Math.floor(bitsLen / 0x100000000), false)
  view.setUint32(pad.length - 4, bitsLen >>> 0, false)

  const state = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19])
  const w = new Uint32Array(64)
  for (let i = 0; i < pad.length; i += 64) {
    for (let j = 0; j < 16; j++) w[j] = view.getUint32(i + j * 4, false)
    for (let j = 16; j < 64; j++) {
      const s0 = (rotR32(w[j - 15], 7) ^ rotR32(w[j - 15], 18) ^ (w[j - 15] >>> 3))
      const s1 = (rotR32(w[j - 2], 17) ^ rotR32(w[j - 2], 19) ^ (w[j - 2] >>> 10))
      w[j] = (w[j - 16] + s0 + w[j - 7] + s1) >>> 0
    }
    let [a, b, c, d, e, f, g, h] = state
    for (let j = 0; j < 64; j++) {
      const S1 = (rotR32(e, 6) ^ rotR32(e, 11) ^ rotR32(e, 25))
      const ch = (e & f) ^ ((~e) & g)
      const temp1 = (h + S1 + ch + SHA256_K[j] + w[j]) >>> 0
      const S0 = (rotR32(a, 2) ^ rotR32(a, 13) ^ rotR32(a, 22))
      const maj = (a & b) ^ (a & c) ^ (b & c)
      const temp2 = (S0 + maj) >>> 0
      h = g; g = f; f = e; e = (d + temp1) >>> 0; d = c; c = b; b = a; a = (temp1 + temp2) >>> 0
    }
    for (let j = 0; j < 8; j++) state[j] = (state[j] + [a, b, c, d, e, f, g, h][j]) >>> 0
  }
  return arrayToHex(new Uint8Array(state.buffer))
}

function rotR32(x: number, n: number): number { return ((x >>> n) | (x << (32 - n))) >>> 0 }

function hmacSha256Pure(key: Uint8Array, data: Uint8Array): Uint8Array {
  const blockSize = 64
  let iKey = new Uint8Array(blockSize), oKey = new Uint8Array(blockSize)
  const effectiveKey = key.length > blockSize ? new Uint8Array(sha256Pure(key).match(/.{2}/g)!.map(b => parseInt(b, 16))) : key
  for (let i = 0; i < 64; i++) {
    iKey[i] = (effectiveKey[i] || 0) ^ 0x36
    oKey[i] = (effectiveKey[i] || 0) ^ 0x5c
  }
  const innerHash = new Uint8Array(sha256Pure(new Uint8Array([...iKey, ...data])).match(/.{2}/g)!.map(b => parseInt(b, 16)))
  return new Uint8Array(sha256Pure(new Uint8Array([...oKey, ...innerHash])).match(/.{2}/g)!.map(b => parseInt(b, 16)))
}

function arrayToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * 批量翻译
 */
export async function batchTranslate(
  texts: string[],
  from: string = 'auto',
  to: string = 'zh'
): Promise<string[]> {
  const results: string[] = []
  for (const text of texts) {
    try {
      const result = await translateText(text, from, to)
      results.push(result.explains || text)
    } catch {
      results.push(text)
    }
  }
  return results
}

/**
 * 获取发音 URL
 */
export function getPronunciationUrl(word: string, lang: 'en' | 'us' = 'us'): string {
  const type = lang === 'us' ? '1' : '2'
  return `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(word)}&type=${type}`
}

/**
 * 播放发音
 */
export function playPronunciation(word: string, lang: 'en' | 'us' = 'us'): void {
  const url = getPronunciationUrl(word, lang)
  const audio = uni.createInnerAudioContext()
  audio.src = url
  audio.play()
}

// ==================== 离线词典 ====================

const OFFLINE_DICT: Record<string, string> = {
  hello: '你好；问候',
  world: '世界；领域',
  apple: '苹果',
  book: '书；预订',
  car: '汽车',
  dog: '狗',
  eat: '吃',
  fish: '鱼；钓鱼',
  good: '好的；善良的',
  hand: '手；交给',
  ice: '冰',
  job: '工作',
  king: '国王',
  love: '爱；热爱',
  milk: '牛奶',
  name: '名字；命名',
  open: '打开；开放的',
  pen: '钢笔',
  question: '问题；质疑',
  run: '跑；经营',
  sun: '太阳',
  time: '时间；时代',
  up: '向上；起来',
  very: '非常；很',
  water: '水；浇水',
  yellow: '黄色；黄色的',
  zoo: '动物园',
  the: '这；那（定冠词）',
  a: '一（个）',
  an: '一（个，用于元音前）',
  is: '是',
  are: '是（复数）',
  am: '是（第一人称）',
  was: '是（过去式）',
  were: '是（过去复数）',
  be: '是；存在',
  been: '是（过去分词）',
  being: '是（现在分词）',
  have: '有；吃',
  has: '有（第三人称）',
  had: '有（过去式）',
  do: '做；助动词',
  does: '做（第三人称）',
  did: '做（过去式）',
  will: '将；愿意',
  would: '将（过去式）；愿意',
  shall: '将（用于第一人称）',
  should: '应该',
  may: '可能；可以',
  might: '可能（过去式）',
  can: '能；可以',
  could: '能（过去式）',
  must: '必须',
  need: '需要',
  dare: '敢',
  ought: '应该',
  used: '过去常常',
  about: '关于；大约',
  above: '在...上方',
  across: '穿过；在对面',
  after: '在...之后',
  against: '反对；靠着',
  along: '沿着',
  among: '在...之中',
  around: '围绕；大约',
  at: '在（地点/时间）',
  before: '在...之前',
  behind: '在...后面',
  below: '在...下方',
  beneath: '在...下面',
  beside: '在...旁边',
  besides: '除...之外还',
  between: '在...之间',
  beyond: '超过；在...那边',
  but: '但是；除了',
  by: '通过；在...旁边',
  down: '向下；沿着',
  during: '在...期间',
  except: '除了',
  for: '为了；因为',
  from: '从；来自',
  in: '在...里面',
  inside: '在...内部',
  into: '进入',
  like: '像；喜欢',
  near: '靠近',
  of: '...的',
  off: '离开；关掉',
  on: '在...上面',
  onto: '到...上面',
  out: '出去；向外',
  outside: '在...外面',
  over: '在...上方；越过',
  past: '经过；过去',
  since: '自从；因为',
  through: '穿过；通过',
  throughout: '遍及',
  till: '直到',
  to: '到；向',
  toward: '朝向',
  under: '在...下面',
  until: '直到',
  upon: '在...之上',
  with: '和...一起；用',
  within: '在...之内',
  without: '没有；在...外面',
}

export function queryOfflineDict(word: string): string | null {
  const normalized = word.toLowerCase().trim()
  return OFFLINE_DICT[normalized] || null
}

export function hasOfflineDict(word: string): boolean {
  return !!queryOfflineDict(word)
}

export function getOfflineDictSize(): number {
  return Object.keys(OFFLINE_DICT).length
}

// ==================== 同步服务 ====================

// jsencrypt 未实际使用，已移除（同步使用 XOR 加密）
// pako 改为动态导入以减小主包体积

// 动态服务器地址配置
const STORAGE_KEY_SERVER_URL = 'slowly_sync_server_url'

function getServerBase(): string {
  // 优先从本地存储读取用户配置的地址
  const customUrl = uni.getStorageSync(STORAGE_KEY_SERVER_URL)
  if (customUrl) {
    // 去除末尾的斜杠，统一处理
    return customUrl.replace(/\/$/, '')
  }
  // 默认使用腾讯云 CloudBase 云函数
  return 'https://1258475269-6fkx3oixct.ap-guangzhou.tencentscf.com'
}

/**
 * 设置自定义同步服务器地址
 * @param url 服务器地址，如 'http://192.168.1.100:3000' 或 'https://sync.example.com'
 */
export function setSyncServerUrl(url: string): void {
  if (url && url.trim()) {
    const trimmedUrl = url.trim().replace(/\/$/, '')
    uni.setStorageSync(STORAGE_KEY_SERVER_URL, trimmedUrl)
  } else {
    // 清空则恢复默认
    uni.removeStorageSync(STORAGE_KEY_SERVER_URL)
  }
}

/**
 * 获取当前同步服务器地址
 */
export function getSyncServerUrl(): string {
  return getServerBase()
}

/**
 * 清除自定义服务器配置，恢复默认
 */
export function resetSyncServer(): void {
  uni.removeStorageSync(STORAGE_KEY_SERVER_URL)
}

function randomString(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

function generateAesKey(): string {
  return randomString(32)
}

/** UTF-8 字符串 → Uint8Array（兼容小程序真机） */
function utf8ToBytes(str: string): Uint8Array {
  try {
    if (typeof TextEncoder !== 'undefined') {
      return new TextEncoder().encode(str)
    }
  } catch { /* 小程序真机 TextEncoder 不可用 */ }
  // 手动 UTF-8 编码
  const bytes: number[] = []
  for (let i = 0; i < str.length; i++) {
    let code = str.charCodeAt(i)
    if (code < 0x80) {
      bytes.push(code)
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f))
    } else if (code >= 0xd800 && code <= 0xdbff) {
      // surrogate pair
      code = 0x10000 + ((code & 0x3ff) << 10) | (str.charCodeAt(++i) & 0x3ff)
      bytes.push(0xf0 | (code >> 18), 0x80 | ((code >> 12) & 0x3f), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f))
    } else {
      bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f))
    }
  }
  return new Uint8Array(bytes)
}

/** Uint8Array → UTF-8 字符串（兼容小程序真机） */
function bytesToUtf8(bytes: Uint8Array): string {
  try {
    if (typeof TextDecoder !== 'undefined') {
      return new TextDecoder().decode(bytes)
    }
  } catch { /* 小程序真机 TextDecoder 不可用 */ }
  // 手动 UTF-8 解码
  let str = ''
  let i = 0
  while (i < bytes.length) {
    const b1 = bytes[i++]
    if (b1 < 0x80) {
      str += String.fromCharCode(b1)
    } else if (b1 < 0xe0) {
      str += String.fromCharCode(((b1 & 0x1f) << 6) | (bytes[i++] & 0x3f))
    } else if (b1 < 0xf0) {
      str += String.fromCharCode(((b1 & 0x0f) << 12) | ((bytes[i++] & 0x3f) << 6) | (bytes[i++] & 0x3f))
    } else {
      const cp = ((b1 & 0x07) << 18) | ((bytes[i++] & 0x3f) << 12) | ((bytes[i++] & 0x3f) << 6) | (bytes[i++] & 0x3f)
      str += String.fromCharCode(0xd800 | ((cp - 0x10000) >> 10), 0xdc00 | (cp & 0x3ff))
    }
  }
  return str
}

/** 将 Uint8Array 转为 base64 */
function uint8ArrayToBase64(bytes: Uint8Array): string {
  // 小程序真机没有 btoa，使用 wx API
  try {
    if (typeof wx !== 'undefined' && wx.arrayBufferToBase64) {
      return wx.arrayBufferToBase64(bytes.buffer as ArrayBuffer)
    }
  } catch { /* wx API 不可用 */ }
  // 降级方案（模拟器等环境）
  try {
    const CHUNK = 0x8000
    const chunks: string[] = []
    for (let i = 0; i < bytes.length; i += CHUNK) {
      const slice = bytes.subarray(i, Math.min(i + CHUNK, bytes.length))
      chunks.push(String.fromCharCode.apply(null, Array.from(slice)))
    }
    return btoa(chunks.join(''))
  } catch { /* btoa 不可用，手动编码 */ }
  // 最终降级：手动 base64 编码
  const base64Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  let result = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const b1 = bytes[i], b2 = bytes[i + 1], b3 = bytes[i + 2]
    result += base64Chars[b1 >> 2]
    result += base64Chars[((b1 & 3) << 4) | ((b2 || 0) >> 4)]
    result += (i + 1 < bytes.length) ? base64Chars[((b2 & 15) << 2) | ((b3 || 0) >> 6)] : '='
    result += (i + 2 < bytes.length) ? base64Chars[(b3 || 0) & 63] : '='
  }
  return result
}

/** 将 base64 转为 Uint8Array */
function base64ToUint8Array(base64: string): Uint8Array {
  // 小程序真机没有 atob，使用 wx API
  try {
    if (typeof wx !== 'undefined' && wx.base64ToArrayBuffer) {
      return new Uint8Array(wx.base64ToArrayBuffer(base64))
    }
  } catch { /* wx API 不可用 */ }
  // 降级方案（模拟器等环境）
  try {
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i)
    }
    return bytes
  } catch { /* atob 不可用，手动解码 */ }
  // 最终降级：手动 base64 解码
  const base64Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  const lookup = new Uint8Array(256)
  for (let i = 0; i < base64Chars.length; i++) lookup[base64Chars.charCodeAt(i)] = i
  const cleaned = base64.replace(/=+$/, '')
  const bytes = new Uint8Array(Math.floor(cleaned.length * 3 / 4))
  let pos = 0
  for (let i = 0; i < cleaned.length; i += 4) {
    const a = lookup[cleaned.charCodeAt(i)], b = lookup[cleaned.charCodeAt(i + 1)]
    const c = lookup[cleaned.charCodeAt(i + 2)], d = lookup[cleaned.charCodeAt(i + 3)]
    bytes[pos++] = (a << 2) | (b >> 4)
    if (pos < bytes.length) bytes[pos++] = ((b & 15) << 4) | ((c >> 2) & 15)
    if (pos < bytes.length) bytes[pos++] = ((c & 3) << 6) | (d & 63)
  }
  return bytes
}

/** XOR 加密/解密 Uint8Array（对称操作） */
function xorCrypt(data: Uint8Array, key: string): Uint8Array {
  const keyBytes = utf8ToBytes(key)
  const keyLen = keyBytes.length
  const result = new Uint8Array(data.length)
  for (let i = 0; i < data.length; i++) {
    result[i] = data[i] ^ keyBytes[i % keyLen]
  }
  return result
}

function buildSyncCode(blobId: string, aesKey: string): string {
  return `${blobId}.${aesKey}`
}

function parseSyncCode(syncCode: string): { blobId: string; aesKey: string } | null {
  const lastDot = syncCode.lastIndexOf('.')
  if (lastDot < 1 || lastDot === syncCode.length - 1) return null
  return {
    blobId: syncCode.substring(0, lastDot),
    aesKey: syncCode.substring(lastDot + 1),
  }
}

function uploadRaw(encryptedPayload: string): Promise<string> {
  return new Promise((resolve, reject) => {
    uni.request({
      url: `${getServerBase()}/sync`,
      method: 'POST',
      header: { 'Content-Type': 'application/json' },
      data: { e: encryptedPayload },
      success: (res) => {
        if (res.statusCode === 201 || res.statusCode === 200) {
          // 优先从 JSON body 读取（自定义服务器返回 { code: 'xxx' }）
          const data = res.data as any
          if (data && (data.code || data.id || data.key)) {
            resolve(data.code || data.id || data.key)
            return
          }
          // 兼容旧版 jsonblob.com（从 Location header 提取）
          const location = (res.header?.Location || res.header?.location || '') as string
          const blobId = location.split('/').pop() || location
          if (blobId) {
            resolve(blobId)
          } else {
            reject(new Error('服务器未返回数据标识'))
          }
        } else {
          reject(new Error(`上传失败: ${res.statusCode}`))
        }
      },
      fail: (err) => {
        reject(new Error(`上传失败: ${err.errMsg || '网络错误'}`))
      },
    })
  })
}

function downloadRaw(blobId: string): Promise<string | null> {
  return new Promise((resolve, reject) => {
    uni.request({
      url: `${getServerBase()}/sync/${blobId}`,
      method: 'GET',
      header: { 'Accept': 'application/json' },
      success: (res) => {
        if (res.statusCode === 200) {
          const data = res.data as any
          if (data && data.e) {
            resolve(data.e as string)
          } else {
            resolve(null)
          }
        } else if (res.statusCode === 404) {
          resolve(null)
        } else {
          reject(new Error(`下载失败: ${res.statusCode}`))
        }
      },
      fail: (err) => {
        reject(new Error(`下载失败: ${err.errMsg || '网络错误'}`))
      },
    })
  })
}

export function checkServerAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    uni.request({
      url: `${getServerBase()}/ping`,
      method: 'GET',
      success: (res) => {
        resolve(res.statusCode === 200)
      },
      fail: () => {
        resolve(false)
      },
    })
  })
}

export interface MobileSyncBank {
  id: string
  name: string
  words: any[]
}

export interface MobileSyncData {
  version: number
  exportedAt: number
  platform: string
  banks: MobileSyncBank[]
}

export interface SyncResult {
  success: boolean
  code?: string
  error?: string
}

export interface RestoreResult {
  success: boolean
  banks?: MobileSyncBank[]
  error?: string
}

function collectSyncData(banks: MobileSyncBank[]): MobileSyncData {
  return {
    version: 1,
    exportedAt: Date.now(),
    platform: 'mobile',
    banks,
  }
}

/**
 * 推送数据到服务器
 * 流程：JSON → pako 压缩 → XOR 加密 → base64 → 上传
 */
export async function pushToServer(banks: MobileSyncBank[]): Promise<SyncResult> {
  try {
    const data = collectSyncData(banks)
    const json = JSON.stringify(data)

    // 1. pako 压缩
    const jsonBytes = utf8ToBytes(json)
    const pako = (await import('pako')).default
    const compressed = pako.deflate(jsonBytes)

    // 2. XOR 加密
    const aesKey = generateAesKey()
    const encrypted = xorCrypt(compressed, aesKey)

    // 3. base64 编码 + 上传
    const encryptedBase64 = uint8ArrayToBase64(encrypted)
    const blobId = await uploadRaw(encryptedBase64)
    const syncCode = buildSyncCode(blobId, aesKey)
    return { success: true, code: syncCode }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}

/**
 * 从服务器拉取数据
 * 流程：下载 → base64 解码 → XOR 解密 → pako 解压 → JSON
 */
export async function pullFromServer(syncCode: string): Promise<RestoreResult> {
  try {
    const parsed = parseSyncCode(syncCode.trim())
    if (!parsed) {
      return { success: false, error: '同步码格式无效' }
    }
    const { blobId, aesKey } = parsed
    const encrypted = await downloadRaw(blobId)
    if (!encrypted) {
      return { success: false, error: '同步码无效或数据已过期' }
    }

    // 1. base64 解码 → XOR 解密
    const encryptedBytes = base64ToUint8Array(encrypted)
    const compressed = xorCrypt(encryptedBytes, aesKey)

    // 2. pako 解压
    const pako = (await import('pako')).default
    const jsonBytes = pako.inflate(compressed)
    const json = bytesToUtf8(jsonBytes)

    // 3. 解析 JSON
    try {
      const data: MobileSyncData = JSON.parse(json)
      return { success: true, banks: data.banks }
    } catch {
      return { success: false, error: '数据解析失败' }
    }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}

// ==================== 词库服务 ====================

export type WordBankType =
  | 'cet4'
  | 'cet6'
  | 'kaogong'
  | 'kaoyan'
  | 'ielts'
  | 'toefl'
  | 'gre'
  | 'gmat'
  | 'bec'
  | 'level4'
  | 'level8'
  | 'zsb'
  | 'sat'
  | 'nul'

export interface WordBankInfo {
  id: WordBankType
  name: string
  description: string
  wordCount: number
  icon?: string
}

export interface Word {
  word: string
  meaning: string
  phonetic?: string
  example?: string
  /** 原始释义（词库数据使用，如 "explains"） */
  explains?: string
}

export interface LoadStrategy {
  priority: 'local' | 'online'
  useCache: boolean
  timeout: number
}

export const DEFAULT_STRATEGY: LoadStrategy = {
  priority: 'local',
  useCache: true,
  timeout: 5000,
}

export const WORDBANK_LIST: WordBankInfo[] = [
  { id: 'cet4', name: '四级词汇', description: '大学英语四级核心词汇', wordCount: 3739 },
  { id: 'cet6', name: '六级词汇', description: '大学英语六级核心词汇', wordCount: 2078 },
  { id: 'bec', name: '商务英语', description: '商务英语考试核心词汇', wordCount: 2825 },
  { id: 'gmat', name: 'GMAT词汇', description: 'GMAT考试核心词汇', wordCount: 3254 },
  { id: 'gre', name: 'GRE词汇', description: 'GRE考试核心词汇', wordCount: 7199 },
  { id: 'ielts', name: '雅思词汇', description: '雅思考试核心词汇', wordCount: 3427 },
  { id: 'kaogong', name: '考公词汇', description: '公务员考试英语词汇', wordCount: 313 },
  { id: 'kaoyan', name: '考研词汇', description: '研究生入学考试核心词汇', wordCount: 4533 },
  { id: 'level4', name: '专业四级', description: '英语专业四级核心词汇', wordCount: 4025 },
  { id: 'level8', name: '专业八级', description: '英语专业八级核心词汇', wordCount: 12197 },
  { id: 'sat', name: 'SAT词汇', description: 'SAT考试核心词汇', wordCount: 4423 },
  { id: 'toefl', name: '托福词汇', description: '托福考试核心词汇', wordCount: 9213 },
  { id: 'zsb', name: '专升本词汇', description: '专升本英语考试核心词汇', wordCount: 297 },
  { id: 'nul', name: '新概念词汇', description: '新概念英语核心词汇', wordCount: 600 },
]

const CACHE_KEY_PREFIX = 'wordbank_cache_v2_'
const CACHE_EXPIRY = 7 * 24 * 60 * 60 * 1000

interface CacheData {
  timestamp: number
  words: Word[]
}

function getFromCache(type: WordBankType): Word[] | null {
  try {
    const cacheStr = uni.getStorageSync(CACHE_KEY_PREFIX + type)
    if (!cacheStr) return null
    const cache: CacheData = JSON.parse(cacheStr)
    if (Date.now() - cache.timestamp > CACHE_EXPIRY) {
      uni.removeStorageSync(CACHE_KEY_PREFIX + type)
      return null
    }
    return cache.words
  } catch {
    return null
  }
}

export function saveWordBankCache(type: WordBankType, words: Word[]): void {
  try {
    const cache: CacheData = {
      timestamp: Date.now(),
      words,
    }
    uni.setStorageSync(CACHE_KEY_PREFIX + type, JSON.stringify(cache))
  } catch (e) {
    console.error('缓存词库失败:', e)
  }
}

export async function loadWordBank(
  type: WordBankType,
  strategy: LoadStrategy = DEFAULT_STRATEGY
): Promise<Word[]> {
  if (strategy.useCache) {
    const cached = getFromCache(type)
    if (cached && cached.length > 0) {
      return cached
    }
  }

  try {
    let rawData: any
    // #ifdef MP-WEIXIN
    // 微信小程序：词库数据在分包中，主包只从缓存读取
    // 如果没有缓存，提示用户先在词库管理页面下载
    const cached = getFromCache(type)
    if (cached && cached.length > 0) {
      return cached
    }
    throw new Error('请先在"词库管理"页面下载词库')
    // #endif
    // #ifndef MP-WEIXIN
    const importLoaders: Record<string, () => Promise<any>> = {
      cet4: () => import('@/subPackages/wordbank-b/wordbanks/cet4'),
      cet6: () => import('@/subPackages/wordbank-b/wordbanks/cet6'),
      bec: () => import('@/subPackages/wordbank-b/wordbanks/bec'),
      gre: () => import('@/subPackages/wordbank-c/wordbanks/gre'),
      gmat: () => import('@/subPackages/wordbank-a/wordbanks/gmat'),
      ielts: () => import('@/subPackages/wordbank-b/wordbanks/ielts'),
      kaogong: () => import('@/subPackages/wordbank-b/wordbanks/kaogong'),
      kaoyan: () => import('@/subPackages/wordbank-a/wordbanks/kaoyan'),
      level4: () => import('@/subPackages/wordbank-c/wordbanks/level4'),
      level8: () => import('@/subPackages/wordbank-level8/wordbanks/level8'),
      sat: () => import('@/subPackages/wordbank-c/wordbanks/sat'),
      toefl: () => import('@/subPackages/wordbank-b/wordbanks/toefl'),
      zsb: () => import('@/subPackages/wordbank-b/wordbanks/zsb'),
      nul: () => import('@/subPackages/wordbank-b/wordbanks/nul'),
    }
    const impLoader = importLoaders[type]
    if (!impLoader) throw new Error(`未知词库类型: ${type}`)
    const h5Module = await impLoader()
    rawData = h5Module.default || h5Module
    const words = (Array.isArray(rawData) ? rawData : []).map((w: any) => ({
      word: w.word || '',
      meaning: w.meaning || w.explains || '',
      phonetic: w.phonetic,
      example: w.example,
    }))
    if (strategy.useCache) saveWordBankCache(type, words)
    return words
    // #endif
  } catch (e: any) {
    const cache = getFromCache(type)
    if (cache) return cache
    throw new Error(`加载词库失败: ${e.message || '模块加载错误'}`)
  }
}

export async function getWordBankInfo(type: WordBankType): Promise<WordBankInfo | null> {
  const info = WORDBANK_LIST.find((w) => w.id === type)
  if (!info) return null
  try {
    const words = await loadWordBank(type, { ...DEFAULT_STRATEGY, useCache: true })
    return { ...info, wordCount: words.length }
  } catch {
    return info
  }
}

export async function getAllWordBankInfo(): Promise<WordBankInfo[]> {
  // 页面初始化时仅返回列表信息，不预加载词库内容（避免串行加载13个文件导致超时）
  return WORDBANK_LIST.map(info => info)
}

export function isWordBankCached(type: WordBankType): boolean {
  try {
    const cacheStr = uni.getStorageSync(CACHE_KEY_PREFIX + type)
    if (!cacheStr) return false
    const cache: CacheData = JSON.parse(cacheStr)
    return Date.now() - cache.timestamp < CACHE_EXPIRY && cache.words.length > 0
  } catch {
    return false
  }
}

export async function downloadWordBank(type: WordBankType): Promise<Word[]> {
  return loadWordBank(type, { ...DEFAULT_STRATEGY, useCache: true })
}

export function clearWordBankCache(type?: WordBankType): void {
  if (type) {
    uni.removeStorageSync(CACHE_KEY_PREFIX + type)
  } else {
    const keys = uni.getStorageInfoSync().keys || []
    for (const key of keys) {
      if (key.startsWith(CACHE_KEY_PREFIX)) {
        uni.removeStorageSync(key)
      }
    }
  }
}

export async function importWordsFromBank(
  type: WordBankType,
  count: number = 50
): Promise<Word[]> {
  const words = await loadWordBank(type)
  return words.slice(0, count)
}

// ==================== 二维码绘制 ====================

function encodeUTF8(str: string): number[] {
  const result: number[] = []
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i)
    if (code < 0x80) {
      result.push(code)
    } else if (code < 0x800) {
      result.push(0xC0 | (code >> 6), 0x80 | (code & 0x3F))
    } else if (code >= 0xD800 && code <= 0xDBFF) {
      const hi = code
      const lo = str.charCodeAt(++i)
      const cp = ((hi - 0xD800) << 10) + (lo - 0xDC00) + 0x10000
      result.push(0xF0 | (cp >> 18), 0x80 | ((cp >> 12) & 0x3F), 0x80 | ((cp >> 6) & 0x3F), 0x80 | (cp & 0x3F))
    } else {
      result.push(0xE0 | (code >> 12), 0x80 | ((code >> 6) & 0x3F), 0x80 | (code & 0x3F))
    }
  }
  return result
}

const BYTE_CAPACITY_M = [
  0, 14, 26, 42, 62, 84, 106, 122, 152, 180, 213,
  251, 287, 331, 362, 412, 450, 504, 560, 624, 666,
  711, 779, 857, 911, 997, 1059, 1125, 1190, 1264,
  1370, 1452, 1538, 1628, 1722, 1809, 1911, 1989, 2099, 2213
]

function getByteCapacity(version: number, ecl: number): number {
  return BYTE_CAPACITY_M[version] || 0
}

function drawFinderPattern(matrix: boolean[][], reserved: boolean[][], row: number, col: number) {
  for (let r = -1; r <= 7; r++) {
    for (let c = -1; c <= 7; c++) {
      const tr = row + r, tc = col + c
      if (tr < 0 || tc < 0 || tr >= matrix.length || tc >= matrix.length) continue
      reserved[tr][tc] = true
      if ((0 <= r && r <= 6 && (c === 0 || c === 6)) ||
          (0 <= c && c <= 6 && (r === 0 || r === 6)) ||
          (2 <= r && r <= 4 && 2 <= c && c <= 4)) {
        matrix[tr][tc] = true
      } else {
        matrix[tr][tc] = false
      }
    }
  }
}

function drawAlignmentPattern(matrix: boolean[][], reserved: boolean[][], row: number, col: number) {
  for (let r = -2; r <= 2; r++) {
    for (let c = -2; c <= 2; c++) {
      const tr = row + r, tc = col + c
      reserved[tr][tc] = true
      if (r === -2 || r === 2 || c === -2 || c === 2 || (r === 0 && c === 0)) {
        matrix[tr][tc] = true
      } else {
        matrix[tr][tc] = false
      }
    }
  }
}

function getAlignmentPositions(version: number): number[] {
  if (version === 1) return []
  const positions = [6]
  const size = version * 4 + 17
  const last = size - 7
  const count = Math.floor(version / 7) + 2
  const step = version === 32 ? 26 : Math.ceil((last - 6) / (count - 1) / 2) * 2
  for (let i = 1; i < count - 1; i++) {
    positions.push(6 + step * i)
  }
  positions.push(last)
  return positions
}

function encodeData(data: number[], version: number, ecl: number): number[] {
  const bits: number[] = []
  const dataLen = data.length
  bits.push(0, 1, 0, 0)
  const ccBits = version < 10 ? 8 : 16
  for (let i = ccBits - 1; i >= 0; i--) {
    bits.push((dataLen >> i) & 1)
  }
  for (const byte of data) {
    for (let i = 7; i >= 0; i--) {
      bits.push((byte >> i) & 1)
    }
  }
  const totalBits = getTotalDataBits(version, ecl)
  for (let i = 0; i < 4 && bits.length < totalBits; i++) bits.push(0)
  while (bits.length % 8 !== 0 && bits.length < totalBits) bits.push(0)
  const padBytes = [0xEC, 0x11]
  let pi = 0
  while (bits.length < totalBits) {
    for (let i = 7; i >= 0; i--) {
      bits.push((padBytes[pi] >> i) & 1)
    }
    pi = (pi + 1) % 2
  }
  return bits
}

function getTotalDataBits(version: number, ecl: number): number {
  const dataCodewords = BYTE_CAPACITY_M[version]
  return dataCodewords * 8
}

const RS_BLOCK_TABLE = [
  [1,26,19],[1,26,16],[1,26,13],[1,26,9],
  [1,44,34],[1,44,28],[1,44,22],[1,44,16],
  [1,70,55],[1,70,44],[2,35,17],[2,35,13],
  [1,100,80],[2,50,32],[2,50,24],[4,25,9],
  [1,134,108],[2,67,43],[2,33,15,2,34,16],[2,33,11,2,34,12],
  [2,86,68],[4,43,27],[4,43,19],[4,43,15],
  [2,98,78],[4,49,31],[2,32,14,4,33,15],[4,39,13,1,40,14],
  [2,121,97],[2,60,38,2,61,39],[4,40,18,2,41,19],[4,40,14,2,41,15],
  [2,146,116],[3,58,36,2,59,37],[4,36,16,4,37,17],[4,36,12,4,37,13],
  [2,86,68,2,87,69],[4,69,43,1,70,44],[6,43,19,2,44,20],[6,43,15,2,44,16],
  [4,101,81],[1,80,50,4,81,51],[4,50,22,4,51,23],[3,36,12,8,37,13],
  [2,116,92,2,117,93],[6,58,36,2,59,37],[4,46,20,6,47,21],[7,42,14,4,43,15],
  [4,133,107],[8,59,37,1,60,38],[8,44,20,4,45,21],[12,33,11,4,34,12],
  [3,145,115,1,146,116],[4,64,40,5,65,41],[11,36,16,5,37,17],[11,36,12,5,37,13],
  [5,109,87,1,110,88],[5,65,41,5,66,42],[5,54,24,7,55,25],[11,36,12,7,37,13],
  [5,122,98,1,123,99],[7,73,45,3,74,46],[15,43,19,2,44,20],[3,45,15,13,46,16],
  [1,135,107,5,136,108],[10,74,46,1,75,47],[1,50,22,15,51,23],[2,42,14,17,43,15],
  [5,150,120,1,151,121],[9,69,43,4,70,44],[17,50,22,1,51,23],[2,42,14,19,43,15],
  [3,141,113,4,142,114],[3,70,44,11,71,45],[17,47,21,4,48,22],[9,39,13,16,40,14],
  [3,135,107,5,136,108],[3,67,41,13,68,42],[15,54,24,5,55,25],[15,43,15,10,44,16],
  [4,144,116,4,145,117],[17,68,42],[17,50,22,6,51,23],[19,46,16,6,47,17],
  [2,139,111,7,140,112],[17,74,46],[7,54,24,16,55,25],[34,37,13],
  [4,151,121,5,152,122],[4,75,47,14,76,48],[11,54,24,14,55,25],[16,45,15,14,46,16],
  [6,147,117,4,148,118],[6,73,45,14,74,46],[11,54,24,16,55,25],[30,46,16,2,47,17],
  [8,132,106,4,133,107],[8,75,47,13,76,48],[7,54,24,22,55,25],[22,45,15,13,46,16],
  [10,142,114,2,143,115],[19,74,46,4,75,47],[28,50,22,6,51,23],[33,46,16,4,47,17],
  [8,152,122,4,153,123],[22,73,45,3,74,46],[8,53,23,26,54,24],[12,45,15,28,46,16],
  [3,147,117,10,148,118],[3,73,45,23,74,46],[4,54,24,31,55,25],[11,45,15,31,46,16],
  [7,146,116,7,147,117],[21,73,45,7,74,46],[1,53,23,37,54,24],[19,45,15,26,46,16],
  [5,145,115,10,146,116],[19,75,47,10,76,48],[15,54,24,25,55,25],[23,45,15,25,46,16],
  [13,145,115,3,146,116],[2,74,46,29,75,47],[42,54,24,1,55,25],[23,45,15,28,46,16],
  [17,145,115],[10,74,46,23,75,47],[10,54,24,35,55,25],[19,45,15,35,46,16],
  [17,145,115,1,146,116],[14,74,46,21,75,47],[29,54,24,19,55,25],[11,45,15,46,46,16],
  [13,145,115,6,146,116],[14,74,46,23,75,47],[44,54,24,7,55,25],[59,46,16,1,47,17],
  [12,151,121,7,152,122],[12,75,47,26,76,48],[39,54,24,14,55,25],[22,45,15,41,46,16],
  [6,151,121,14,152,122],[6,75,47,34,76,48],[46,54,24,10,55,25],[2,45,15,64,46,16],
  [17,152,122,4,153,123],[29,74,46,14,75,47],[49,54,24,10,55,25],[24,45,15,46,46,16],
  [4,152,122,18,153,123],[13,74,46,32,75,47],[48,54,24,14,55,25],[42,45,15,32,46,16],
  [20,147,117,4,148,118],[40,75,47,7,76,48],[43,54,24,22,55,25],[10,45,15,67,46,16],
  [19,148,118,6,149,119],[18,75,47,31,76,48],[34,54,24,34,55,25],[20,45,15,61,46,16]
]

function getFormatBits(ecl: number, maskPattern: number): number {
  const data = (ecl << 3) | maskPattern
  let bits = data << 10
  for (let i = 0; i < 15; i++) {
    if ((bits >>> (14 - i)) & 1) {
      bits ^= (0x537 << (9 - i))
    }
  }
  return ((data << 10) | bits) ^ 0x5412
}

function getVersionBits(version: number): number {
  let d = version << 12
  for (let i = 0; i < 18; i++) {
    if (d & (1 << (17 - i))) {
      d ^= (0x1F25 << (17 - i - 12))
    }
  }
  return (version << 12) | d
}

function writeFormatInfo(matrix: boolean[][], size: number, formatBits: number) {
  for (let i = 0; i < 15; i++) {
    const bit = ((formatBits >> i) & 1) === 1
    if (i < 6) matrix[8][i] = bit
    else if (i < 8) matrix[8][i + 1] = bit
    else if (i < 9) matrix[8][size - 15 + i] = bit
    else matrix[8][size - 15 + i] = bit
    if (i < 8) matrix[size - 1 - i][8] = bit
    else matrix[14 - i][8] = bit
  }
}

function writeVersionInfo(matrix: boolean[][], size: number, versionBits: number) {
  for (let i = 0; i < 18; i++) {
    const bit = ((versionBits >> i) & 1) === 1
    const r = Math.floor(i / 3)
    const c = size - 11 + (i % 3)
    matrix[r][c] = bit
    matrix[c][r] = bit
  }
}

export function generateQRMatrix(text: string): boolean[][] {
  const data = encodeUTF8(text)
  const ecl = 0
  let version = 1
  for (; version <= 40; version++) {
    const capacity = getByteCapacity(version, ecl)
    if (capacity >= data.length) break
  }
  if (version > 40) throw new Error('数据太长，无法生成二维码')
  const size = version * 4 + 17
  const matrix = Array.from({ length: size }, () => Array(size).fill(false))
  const reserved = Array.from({ length: size }, () => Array(size).fill(false))

  drawFinderPattern(matrix, reserved, 0, 0)
  drawFinderPattern(matrix, reserved, 0, size - 7)
  drawFinderPattern(matrix, reserved, size - 7, 0)

  const alignPos = getAlignmentPositions(version)
  for (const r of alignPos) {
    for (const c of alignPos) {
      if (reserved[r][c]) continue
      drawAlignmentPattern(matrix, reserved, r, c)
    }
  }

  for (let i = 8; i < size - 8; i++) {
    if (!reserved[6][i]) {
      matrix[6][i] = i % 2 === 0
      reserved[6][i] = true
    }
    if (!reserved[i][6]) {
      matrix[i][6] = i % 2 === 0
      reserved[i][6] = true
    }
  }

  for (let i = 0; i < 9; i++) {
    reserved[8][i] = true
    reserved[i][8] = true
    reserved[8][size - 8 + i] = true
    reserved[size - 8 + i][8] = true
  }
  reserved[size - 8][8] = true

  if (version >= 7) {
    for (let i = 0; i < 6; i++) {
      for (let j = 0; j < 3; j++) {
        reserved[i][size - 11 + j] = true
        reserved[size - 11 + j][i] = true
      }
    }
  }

  const dataBits = encodeData(data, version, ecl)
  let bitIdx = 0
  let upward = true
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5
    for (let vert = 0; vert < size; vert++) {
      const row = upward ? size - 1 - vert : vert
      for (let c = 0; c < 2; c++) {
        const col = right - c
        if (col < 0 || reserved[row][col]) continue
        if (bitIdx < dataBits.length) {
          matrix[row][col] = dataBits[bitIdx] === 1
          bitIdx++
        }
      }
    }
    upward = !upward
  }

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (!reserved[r][c] && (r + c) % 2 === 0) {
        matrix[r][c] = !matrix[r][c]
      }
    }
  }

  const formatBits = getFormatBits(ecl, 0)
  writeFormatInfo(matrix, size, formatBits)

  if (version >= 7) {
    const versionBits = getVersionBits(version)
    writeVersionInfo(matrix, size, versionBits)
  }

  return matrix
}

export function drawQrCode(
  canvasId: string,
  text: string,
  componentInstance?: any,
  options?: { size?: number; margin?: number }
) {
  const size = options?.size || 180
  const margin = options?.margin || 2
  const matrix = generateQRMatrix(text)
  const cellSize = Math.floor((size - margin * 2) / matrix.length)
  const actualSize = cellSize * matrix.length + margin * 2

  const ctx = uni.createCanvasContext(canvasId, componentInstance)
  ctx.setFillStyle('#ffffff')
  ctx.fillRect(0, 0, actualSize, actualSize)
  ctx.setFillStyle('#000000')
  for (let r = 0; r < matrix.length; r++) {
    for (let c = 0; c < matrix[r].length; c++) {
      if (matrix[r][c]) {
        ctx.fillRect(margin + c * cellSize, margin + r * cellSize, cellSize, cellSize)
      }
    }
  }
  ctx.draw()
}
