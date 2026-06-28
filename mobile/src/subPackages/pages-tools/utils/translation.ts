/**
 * 翻译引擎 - 重量级模块，仅被分包页面引用
 * 包含 10 个翻译引擎 + MD5/HMAC-SHA1/SHA-1 签名
 * 
 * ⚠️ 已迁移到分包目录，主包页面请从 translation-settings.ts 导入设置函数
 */

import type { TranslationResult } from '@/stores/useUtils/types'
export type { TranslationPlatform, TranslationResult } from '@/stores/useUtils/types'

// 从轻量设置模块重导出
export { setTranslationPlatform, getTranslationPlatform, getTranslationApiKey, setTranslationApiKey, hasCustomTranslationApiKey, TRANSLATION_PLATFORM_LINKS, currentPlatform } from '@/stores/useUtils/translation-settings'

import { getTranslationApiKey, currentPlatform } from '@/stores/useUtils/translation-settings'
import { queryOfflineDict, queryPhoneticFromCache, getPronunciationUrl } from '@/stores/useUtils/offline-dict'
import type { TranslationPlatform } from '@/stores/useUtils/types'

interface TranslationCacheEntry {
  result: TranslationResult
  ts: number
}
const TRANSLATION_CACHE_STORAGE_KEY = 'slowly_translation_cache_v1'
const TRANSLATION_CACHE_TTL = 7 * 24 * 3600 * 1000
const TRANSLATION_CACHE_MAX = 3000
const AI_BATCH_PLATFORMS = new Set<TranslationPlatform>(['glm', 'deepseek', 'qwen', 'kimi', 'ollama'])
const AI_BATCH_SIZE = 20
const translationCache = new Map<string, TranslationCacheEntry>()
let translationCacheLoaded = false
let translationCachePersistTimer: ReturnType<typeof setTimeout> | null = null

function translationCacheKey(query: string, platform: TranslationPlatform, from: string, to: string): string {
  const config = getTranslationApiKey(platform)
  return `${platform}|${from}|${to}|${config.appkey || ''}:${config.key || ''}|${query.toLowerCase().trim()}`
}

function trimTranslationCache(): void {
  const now = Date.now()
  for (const [key, entry] of translationCache) {
    if (!entry?.result?.success || now - entry.ts > TRANSLATION_CACHE_TTL) translationCache.delete(key)
  }
  while (translationCache.size > TRANSLATION_CACHE_MAX) {
    const key = translationCache.keys().next().value
    if (key === undefined) break
    translationCache.delete(key)
  }
}

function ensureTranslationCacheLoaded(): void {
  if (translationCacheLoaded) return
  translationCacheLoaded = true
  try {
    const stored = uni.getStorageSync(TRANSLATION_CACHE_STORAGE_KEY)
    const entries = Array.isArray(stored) ? stored : []
    const now = Date.now()
    entries.forEach(([key, entry]: [string, TranslationCacheEntry]) => {
      if (entry?.result?.success && typeof entry.ts === 'number' && now - entry.ts <= TRANSLATION_CACHE_TTL) {
        translationCache.set(key, entry)
      }
    })
    trimTranslationCache()
  } catch { /* ignore */ }
}

function persistTranslationCache(): void {
  try { uni.setStorageSync(TRANSLATION_CACHE_STORAGE_KEY, Array.from(translationCache.entries())) } catch { /* ignore */ }
}

function schedulePersistTranslationCache(): void {
  if (translationCachePersistTimer) return
  translationCachePersistTimer = setTimeout(() => {
    translationCachePersistTimer = null
    persistTranslationCache()
  }, 1000)
}

function getCachedTranslation(query: string, platform: TranslationPlatform, from: string, to: string): TranslationResult | null {
  ensureTranslationCacheLoaded()
  const key = translationCacheKey(query, platform, from, to)
  const hit = translationCache.get(key)
  if (!hit) return null
  if (Date.now() - hit.ts > TRANSLATION_CACHE_TTL) {
    translationCache.delete(key)
    schedulePersistTranslationCache()
    return null
  }
  return hit.result
}

function setCachedTranslation(query: string, platform: TranslationPlatform, from: string, to: string, result: TranslationResult): void {
  if (!result?.success) return
  ensureTranslationCacheLoaded()
  translationCache.set(translationCacheKey(query, platform, from, to), { result, ts: Date.now() })
  trimTranslationCache()
  schedulePersistTranslationCache()
}

// ==================== MD5 辅助函数 ====================

function md5(input: string): string {
  function safeAdd(x: number, y: number): number {
    const lsw = (x & 0xFFFF) + (y & 0xFFFF)
    const msw = (x >> 16) + (y >> 16) + (lsw >> 16)
    return (msw << 16) | (lsw & 0xFFFF)
  }
  function bitRotateLeft(num: number, cnt: number): number {
    return (num << cnt) | (num >>> (32 - cnt))
  }
  function md5cmn(q: number, a: number, b: number, x: number, s: number, t: number): number {
    return safeAdd(bitRotateLeft(safeAdd(safeAdd(a, q), safeAdd(x, t)), s), b)
  }
  function md5ff(a: number, b: number, c: number, d: number, x: number, s: number, t: number): number {
    return md5cmn((b & c) | (~b & d), a, b, x, s, t)
  }
  function md5gg(a: number, b: number, c: number, d: number, x: number, s: number, t: number): number {
    return md5cmn((b & d) | (c & ~d), a, b, x, s, t)
  }
  function md5hh(a: number, b: number, c: number, d: number, x: number, s: number, t: number): number {
    return md5cmn(b ^ c ^ d, a, b, x, s, t)
  }
  function md5ii(a: number, b: number, c: number, d: number, x: number, s: number, t: number): number {
    return md5cmn(c ^ (b | ~d), a, b, x, s, t)
  }
  function binlMD5(x: number[], len: number): number[] {
    x[len >> 5] |= 0x80 << (len % 32)
    x[(((len + 64) >>> 9) << 4) + 14] = len
    let a = 1732584193, b = -271733879, c = -1732584194, d = 271733878
    for (let i = 0; i < x.length; i += 16) {
      const oa = a, ob = b, oc = c, od = d
      a=md5ff(a,b,c,d,x[i],7,-680876936);d=md5ff(d,a,b,c,x[i+1],12,-389564586)
      c=md5ff(c,d,a,b,x[i+2],17,606105819);b=md5ff(b,c,d,a,x[i+3],22,-1044525330)
      a=md5ff(a,b,c,d,x[i+4],7,-176418897);d=md5ff(d,a,b,c,x[i+5],12,1200080426)
      c=md5ff(c,d,a,b,x[i+6],17,-1473231341);b=md5ff(b,c,d,a,x[i+7],22,-45705983)
      a=md5ff(a,b,c,d,x[i+8],7,1770035416);d=md5ff(d,a,b,c,x[i+9],12,-1958414417)
      c=md5ff(c,d,a,b,x[i+10],17,-42063);b=md5ff(b,c,d,a,x[i+11],22,-1990404162)
      a=md5ff(a,b,c,d,x[i+12],7,1804603682);d=md5ff(d,a,b,c,x[i+13],12,-40341101)
      c=md5ff(c,d,a,b,x[i+14],17,-1502002290);b=md5ff(b,c,d,a,x[i+15],22,1236535329)
      a=md5gg(a,b,c,d,x[i+1],5,-165796510);d=md5gg(d,a,b,c,x[i+6],9,-1069501632)
      c=md5gg(c,d,a,b,x[i+11],14,643717713);b=md5gg(b,c,d,a,x[i],20,-373897302)
      a=md5gg(a,b,c,d,x[i+5],5,-701558691);d=md5gg(d,a,b,c,x[i+10],9,38016083)
      c=md5gg(c,d,a,b,x[i+15],14,-660478335);b=md5gg(b,c,d,a,x[i+4],20,-405537848)
      a=md5gg(a,b,c,d,x[i+9],5,568446438);d=md5gg(d,a,b,c,x[i+14],9,-1019803690)
      c=md5gg(c,d,a,b,x[i+3],14,-187363961);b=md5gg(b,c,d,a,x[i+8],20,1163531501)
      a=md5gg(a,b,c,d,x[i+13],5,-1444681467);d=md5gg(d,a,b,c,x[i+2],9,-51403784)
      c=md5gg(c,d,a,b,x[i+7],14,1735328473);b=md5gg(b,c,d,a,x[i+12],20,-1926607734)
      a=md5hh(a,b,c,d,x[i+5],4,-378558);d=md5hh(d,a,b,c,x[i+8],11,-2022574463)
      c=md5hh(c,d,a,b,x[i+11],16,1839030562);b=md5hh(b,c,d,a,x[i+14],23,-35309556)
      a=md5hh(a,b,c,d,x[i+1],4,-1530992060);d=md5hh(d,a,b,c,x[i+4],11,1272893353)
      c=md5hh(c,d,a,b,x[i+7],16,-155497632);b=md5hh(b,c,d,a,x[i+10],23,-1094730640)
      a=md5hh(a,b,c,d,x[i+13],4,681279174);d=md5hh(d,a,b,c,x[i],11,-358537222)
      c=md5hh(c,d,a,b,x[i+3],16,-722521979);b=md5hh(b,c,d,a,x[i+6],23,76029189)
      a=md5hh(a,b,c,d,x[i+9],4,-640364487);d=md5hh(d,a,b,c,x[i+12],11,-421815835)
      c=md5hh(c,d,a,b,x[i+15],16,530742520);b=md5hh(b,c,d,a,x[i+2],23,-995338651)
      a=md5ii(a,b,c,d,x[i],6,-198630844);d=md5ii(d,a,b,c,x[i+7],10,1126891415)
      c=md5ii(c,d,a,b,x[i+14],15,-1416354905);b=md5ii(b,c,d,a,x[i+5],21,-57434055)
      a=md5ii(a,b,c,d,x[i+12],6,1700485571);d=md5ii(d,a,b,c,x[i+3],10,-1894986606)
      c=md5ii(c,d,a,b,x[i+10],15,-1051523);b=md5ii(b,c,d,a,x[i+1],21,-2054922799)
      a=md5ii(a,b,c,d,x[i+8],6,1873313359);d=md5ii(d,a,b,c,x[i+15],10,-30611744)
      c=md5ii(c,d,a,b,x[i+6],15,-1560198380);b=md5ii(b,c,d,a,x[i+13],21,1309151649)
      a=md5ii(a,b,c,d,x[i+4],6,-145523070);d=md5ii(d,a,b,c,x[i+11],10,-1120210379)
      c=md5ii(c,d,a,b,x[i+2],15,718787259);b=md5ii(b,c,d,a,x[i+9],21,-343485551)
      a=safeAdd(a,oa);b=safeAdd(b,ob);c=safeAdd(c,oc);d=safeAdd(d,od)
    }
    return [a, b, c, d]
  }
  function str2binl(str: string): number[] {
    const bin: number[] = []
    const mask = (1 << 8) - 1
    for (let i = 0; i < str.length * 8; i += 8) {
      bin[i >> 5] |= (str.charCodeAt(i / 8) & mask) << (i % 32)
    }
    return bin
  }
  function binl2hex(binarray: number[]): string {
    const hexTab = '0123456789abcdef'
    let str = ''
    for (let i = 0; i < binarray.length * 4; i++) {
      str += hexTab.charAt((binarray[i >> 2] >> ((i % 4) * 8 + 4)) & 0xF) +
             hexTab.charAt((binarray[i >> 2] >> ((i % 4) * 8)) & 0xF)
    }
    return str
  }
  const utf8 = unescape(encodeURIComponent(input))
  return binl2hex(binlMD5(str2binl(utf8), utf8.length * 8))
}

// ==================== HMAC-SHA1 / SHA-1 ====================

function utf8ToBytes_HMAC(str: string): Uint8Array {
  const bytes: number[] = []
  for (let i = 0; i < str.length; i++) {
    let code = str.charCodeAt(i)
    if (code < 0x80) { bytes.push(code) }
    else if (code < 0x800) { bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f)) }
    else if (code >= 0xd800 && code <= 0xdbff) {
      code = 0x10000 + ((code & 0x3ff) << 10) | (str.charCodeAt(++i) & 0x3ff)
      bytes.push(0xf0 | (code >> 18), 0x80 | ((code >> 12) & 0x3f), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f))
    } else {
      bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f))
    }
  }
  return new Uint8Array(bytes)
}

function sha1Raw(data: Uint8Array): Uint8Array {
  const msgLen = data.length
  const bitLen = msgLen * 8
  let paddedLen = msgLen + 1
  while (paddedLen % 64 !== 56) paddedLen++
  paddedLen += 8
  const padded = new Uint8Array(paddedLen)
  padded.set(data)
  padded[msgLen] = 0x80
  const dv = new DataView(padded.buffer)
  dv.setUint32(paddedLen - 4, bitLen, false)
  let h0 = 0x67452301, h1 = 0xEFCDAB89, h2 = 0x98BADCFE, h3 = 0x10325476, h4 = 0xC3D2E1F0
  for (let offset = 0; offset < paddedLen; offset += 64) {
    const w = new Uint32Array(80)
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(offset + i * 4, false)
    for (let i = 16; i < 80; i++) w[i] = ((w[i-3] ^ w[i-8] ^ w[i-14] ^ w[i-16]) << 1) | ((w[i-3] ^ w[i-8] ^ w[i-14] ^ w[i-16]) >>> 31)
    let a = h0, b = h1, c = h2, d = h3, e = h4
    for (let i = 0; i < 80; i++) {
      let f: number, k: number
      if (i < 20) { f = (b & c) | (~b & d); k = 0x5A827999 }
      else if (i < 40) { f = b ^ c ^ d; k = 0x6ED9EBA1 }
      else if (i < 60) { f = (b & c) | (b & d) | (c & d); k = 0x8F1BBCDC }
      else { f = b ^ c ^ d; k = 0xCA62C1D6 }
      const temp = (((a << 5) | (a >>> 27)) + (f >>> 0) + e + k + w[i]) >>> 0
      e = d; d = c; c = ((b << 30) | (b >>> 2)); b = a; a = temp
    }
    h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0; h4 = (h4 + e) >>> 0
  }
  const out = new Uint8Array(20)
  const rdv = new DataView(out.buffer)
  rdv.setUint32(0, h0, false); rdv.setUint32(4, h1, false); rdv.setUint32(8, h2, false); rdv.setUint32(12, h3, false); rdv.setUint32(16, h4, false)
  return out
}

function uint8ToBase64(bytes: Uint8Array): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  let result = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const b1 = bytes[i], b2 = bytes[i + 1] || 0, b3 = bytes[i + 2] || 0
    result += chars[b1 >> 2] + chars[((b1 & 3) << 4) | (b2 >> 4)] + (i + 1 < bytes.length ? chars[((b2 & 15) << 2) | (b3 >> 6)] : '=') + (i + 2 < bytes.length ? chars[b3 & 63] : '=')
  }
  return result
}

function hmacSha1Base64(message: string, key: string): string {
  const rawKeyBytes = utf8ToBytes_HMAC(key)
  const msgBytes = utf8ToBytes_HMAC(message)
  const blockSize = 64
  const keyBytes = rawKeyBytes.length > blockSize ? sha1Raw(rawKeyBytes) : rawKeyBytes
  const iKey = new Uint8Array(blockSize), oKey = new Uint8Array(blockSize)
  for (let i = 0; i < blockSize; i++) {
    iKey[i] = (keyBytes[i] || 0) ^ 0x36
    oKey[i] = (keyBytes[i] || 0) ^ 0x5c
  }
  const inner = sha1Raw(new Uint8Array([...iKey, ...msgBytes]))
  const result = sha1Raw(new Uint8Array([...oKey, ...inner]))
  return uint8ToBase64(result)
}

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
  return hmacSha1Base64(stringToSign, accessKeySecret + '&')
}

// ==================== SHA256 / HMAC-SHA256（腾讯云签名用） ====================

function sha256Pure(data: Uint8Array): Uint8Array {
  const K = new Uint32Array([0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2])
  const msgLen = data.length
  const bitLen = msgLen * 8
  let paddedLen = msgLen + 1
  while (paddedLen % 64 !== 56) paddedLen++
  paddedLen += 8
  const padded = new Uint8Array(paddedLen)
  padded.set(data)
  padded[msgLen] = 0x80
  const dv = new DataView(padded.buffer)
  dv.setUint32(paddedLen - 4, 0, false)
  dv.setUint32(paddedLen - 8, bitLen, false)
  let H0=0x6a09e667,H1=0xbb67ae85,H2=0x3c6ef372,H3=0xa54ff53a,H4=0x510e527f,H5=0x9b05688c,H6=0x1f83d9ab,H7=0x5be0cd19
  for (let offset = 0; offset < paddedLen; offset += 64) {
    const w = new Uint32Array(64)
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(offset + i * 4, false)
    for (let i = 16; i < 64; i++) {
      const s0 = ((w[i-15] >>> 7) | (w[i-15] << 25)) ^ ((w[i-15] >>> 18) | (w[i-15] << 14)) ^ (w[i-15] >>> 3)
      const s1 = ((w[i-2] >>> 17) | (w[i-2] << 15)) ^ ((w[i-2] >>> 19) | (w[i-2] << 13)) ^ (w[i-2] >>> 10)
      w[i] = (w[i-16] + s0 + w[i-7] + s1) | 0
    }
    let a=H0,b=H1,c=H2,d=H3,e=H4,f=H5,g=H6,h=H7
    for (let i = 0; i < 64; i++) {
      const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7))
      const ch = (e & f) ^ (~e & g)
      const temp1 = (h + S1 + ch + K[i] + w[i]) | 0
      const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10))
      const maj = (a & b) ^ (a & c) ^ (b & c)
      const temp2 = (S0 + maj) | 0
      h=g;g=f;f=e;e=(d+temp1)|0;d=c;c=b;b=a;a=(temp1+temp2)|0
    }
    H0=(H0+a)|0;H1=(H1+b)|0;H2=(H2+c)|0;H3=(H3+d)|0;H4=(H4+e)|0;H5=(H5+f)|0;H6=(H6+g)|0;H7=(H7+h)|0
  }
  const out = new Uint8Array(32)
  const rdv = new DataView(out.buffer)
  rdv.setUint32(0,H0,false);rdv.setUint32(4,H1,false);rdv.setUint32(8,H2,false);rdv.setUint32(12,H3,false)
  rdv.setUint32(16,H4,false);rdv.setUint32(20,H5,false);rdv.setUint32(24,H6,false);rdv.setUint32(28,H7,false)
  return out
}

function hmacSha256Pure(key: Uint8Array, msg: Uint8Array): Uint8Array {
  const blockSize = 64
  let k = key.length > blockSize ? sha256Pure(key) : key
  const iKey = new Uint8Array(blockSize), oKey = new Uint8Array(blockSize)
  for (let i = 0; i < blockSize; i++) { iKey[i] = (k[i] || 0) ^ 0x36; oKey[i] = (k[i] || 0) ^ 0x5c }
  return sha256Pure(new Uint8Array([...oKey, ...sha256Pure(new Uint8Array([...iKey, ...msg]))]))
}

function arrayToHex(arr: Uint8Array): string {
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('')
}

function sha256Hex(input: string): string {
  return arrayToHex(sha256Pure(utf8ToBytes_HMAC(input)))
}

function youdaoSignInput(q: string): string {
  if (!q) return ''
  if (q.length <= 20) return q
  return q.substring(0, 10) + q.length + q.substring(q.length - 10)
}

/** 腾讯云 TC3-HMAC-SHA256 签名请求（翻译和 OCR 共用） */
export function tencentCloudRequest(
  service: string, host: string, action: string, version: string, region: string, bodyObj: Record<string, any>
): Promise<any> {
  const { appkey: secretId, key: secretKey } = getTranslationApiKey('tencent')
  if (!secretId || !secretKey) return Promise.reject(new Error('腾讯云API密钥未配置'))
  const timestamp = Math.floor(Date.now() / 1000)
  const date = new Date(timestamp * 1000).toISOString().slice(0, 10)
  const payload = JSON.stringify(bodyObj)
  const canonicalHeaders = `content-type:application/json; charset=utf-8\nhost:${host}\nx-tc-action:${action.toLowerCase()}\n`
  const signedHeaders = 'content-type;host;x-tc-action'
  const hashedPayload = arrayToHex(sha256Pure(utf8ToBytes_HMAC(payload)))
  const canonicalRequest = `POST\n/\n\n${canonicalHeaders}\n${signedHeaders}\n${hashedPayload}`
  const credentialScope = `${date}/${service}/tc3_request`
  const hashedCanonicalRequest = arrayToHex(sha256Pure(utf8ToBytes_HMAC(canonicalRequest)))
  const stringToSign = `TC3-HMAC-SHA256\n${timestamp}\n${credentialScope}\n${hashedCanonicalRequest}`
  const kDate = hmacSha256Pure(utf8ToBytes_HMAC(`TC3${secretKey}`), utf8ToBytes_HMAC(date))
  const kService = hmacSha256Pure(kDate, utf8ToBytes_HMAC(service))
  const kSigning = hmacSha256Pure(kService, utf8ToBytes_HMAC('tc3_request'))
  const signature = arrayToHex(hmacSha256Pure(kSigning, utf8ToBytes_HMAC(stringToSign)))
  const authorization = `TC3-HMAC-SHA256 Credential=${secretId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`
  return new Promise((resolve, reject) => {
    uni.request({
      url: `https://${host}`, method: 'POST',
      header: { 'Content-Type': 'application/json; charset=utf-8', 'Host': host, 'X-TC-Action': action, 'X-TC-Version': version, 'X-TC-Region': region, 'X-TC-Timestamp': String(timestamp), 'Authorization': authorization },
      data: bodyObj, dataType: 'json',
      success: (res) => { const data = res.data as any; if (data.Response?.Error) { reject(new Error(`腾讯云API错误[${data.Response.Error.Code}]: ${data.Response.Error.Message}`)); return } resolve(data) },
      fail: (err) => { reject(new Error(`腾讯云请求失败[${service}/${action}]: ` + (err.errMsg || '网络错误'))) }
    })
  })
}

// ==================== 翻译引擎实现 ====================

async function translateWithYoudao(text: string, from: string = 'auto', to: string = 'zh'): Promise<TranslationResult> {
  const { appkey: appKey, key: appSecret } = getTranslationApiKey('youdao')
  if (!appKey || !appSecret) return { success: false, explains: text, translatedText: text, errorMsg: '有道翻译：请先配置API密钥', platform: 'youdao' }
  const salt = '' + Date.now()
  const curtime = Math.round(Date.now() / 1000)
  const sign = sha256Hex(appKey + youdaoSignInput(text) + salt + curtime + appSecret)
  return new Promise((resolve) => {
    uni.request({
      url: 'https://openapi.youdao.com/api', method: 'GET',
      data: { q: text, appKey, salt, from: from === 'auto' ? 'auto' : from, to, sign, signType: 'v3', curtime, ext: 'mp3' },
      success: (res) => {
        const data = res.data as any
        if (data.errorCode === '0') {
          resolve({ success: true, explains: data.translation?.[0] || text, translatedText: data.translation?.[0] || text, phonetic: data.basic?.phonetic || '', pronunciation: `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(text)}&type=1`, platform: 'youdao' })
        } else {
          resolve({ success: false, explains: text, translatedText: text, errorMsg: `有道翻译错误[${data.errorCode}]: ${data.errorCode === '202' ? '签名检验失败，请检查密钥或系统时间' : '请检查密钥配置'}`, platform: 'youdao' })
        }
      },
      fail: (err) => resolve({ success: false, explains: text, translatedText: text, errorMsg: '有道翻译请求失败: ' + (err.errMsg || '请检查网络连接或小程序域名白名单'), platform: 'youdao' })
    })
  })
}

async function translateWithBaidu(text: string, from: string = 'auto', to: string = 'zh'): Promise<TranslationResult> {
  const { appkey: appid, key: secretKey } = getTranslationApiKey('baidu')
  if (!appid || !secretKey) return { success: false, explains: text, translatedText: text, errorMsg: '百度翻译：请先配置API密钥', platform: 'baidu' }
  const salt = '' + Date.now()
  const sign = md5(appid + text + salt + secretKey)
  return new Promise((resolve) => {
    uni.request({
      url: 'https://fanyi-api.baidu.com/api/trans/vip/translate', method: 'GET',
      data: { q: text, from: from === 'auto' ? 'auto' : from, to, appid, salt, sign },
      success: (res) => {
        const data = res.data as any
        if (!data.error_code || data.error_code === '52000') {
          resolve({ success: true, explains: data.trans_result?.[0]?.dst || text, translatedText: data.trans_result?.[0]?.dst || text, pronunciation: `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(text)}&type=1`, platform: 'baidu' })
        } else {
          const errMap: Record<string, string> = { '54000': '参数错误', '54001': '签名错误（请检查密钥）', '54003': '访问频率受限', '54004': '余额不足', '54005': '长query请求频繁', '58000': '客户端IP非法', '58001': '语言不支持', '58002': '服务已关闭', '90107': '认证未通过' }
          resolve({ success: false, explains: text, translatedText: text, errorMsg: `百度翻译错误[${data.error_code}]: ${errMap[data.error_code] || data.error_msg || '未知错误'}`, platform: 'baidu' })
        }
      },
      fail: (err) => resolve({ success: false, explains: text, translatedText: text, errorMsg: '百度翻译请求失败: ' + (err.errMsg || '请检查网络连接或小程序域名白名单'), platform: 'baidu' })
    })
  })
}

async function translateWithAli(text: string, from: string = 'auto', to: string = 'zh'): Promise<TranslationResult> {
  const { appkey, key: secretKey } = getTranslationApiKey('ali')
  if (!appkey || !secretKey) return { success: false, explains: text, translatedText: text, errorMsg: '阿里翻译：请先配置API密钥', platform: 'ali' }
  try {
    const timestamp = new Date().toISOString().replace(/\.\d+Z/, 'Z')
    const params: Record<string, string> = { Format: 'JSON', Version: '2018-10-12', AccessKeyId: appkey, SignatureMethod: 'HMAC-SHA1', Timestamp: timestamp, SignatureVersion: '1.0', SignatureNonce: Math.random().toString(36).slice(2, 15), Action: 'TranslateGeneral', SourceLanguage: from === 'auto' ? 'auto' : from, TargetLanguage: to, SourceText: text, FormatType: 'text', Scene: 'general' }
    params.Signature = hmacSha1Signature(params, secretKey)
    const queryString = Object.entries(params).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&')
    return new Promise((resolve) => {
      uni.request({
        url: `https://mt.aliyuncs.com/?${queryString}`, method: 'GET',
        success: (res) => {
          const data = res.data as any
          if (data.Code === '200' && data.Data) {
            resolve({ success: true, explains: data.Data.Translated, translatedText: data.Data.Translated, pronunciation: `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(text)}&type=1`, platform: 'ali' })
          } else {
            const errMsgMap: Record<string, string> = { 'InvalidAccessKeyId.NotFound': 'AccessKey不存在', 'SignatureDoesNotMatch': '签名不匹配（请检查密钥）', 'InvalidAction': '无效的Action', 'MissingParameter': '缺少必要参数', 'Throttling': '请求频率超限', 'ServiceUnavailable': '服务暂不可用' }
            resolve({ success: false, explains: text, translatedText: text, errorMsg: `阿里翻译错误[${data.Code}]: ${errMsgMap[data.Code] || data.Message || '未知错误'}`, platform: 'ali' })
          }
        },
        fail: (err) => resolve({ success: false, explains: text, translatedText: text, errorMsg: '阿里翻译请求失败: ' + (err.errMsg || '请检查网络连接或小程序域名白名单'), platform: 'ali' })
      })
    })
  } catch (e) {
    return { success: false, explains: text, translatedText: text, errorMsg: '阿里翻译错误: ' + String(e), platform: 'ali' }
  }
}

async function translateWithTencent(text: string, from: string = 'auto', to: string = 'zh'): Promise<TranslationResult> {
  const { appkey: secretId, key: secretKey } = getTranslationApiKey('tencent')
  if (!secretId || !secretKey) return { success: false, explains: text, translatedText: text, errorMsg: '腾讯翻译：请先配置API密钥', platform: 'tencent' }
  try {
    const data = await tencentCloudRequest('tmt', 'tmt.tencentcloudapi.com', 'TextTranslate', '2018-03-21', 'ap-beijing', { SourceText: text, Source: from === 'auto' ? 'auto' : from, Target: to, ProjectId: 0 })
    if (data.Response && data.Response.TargetText) {
      return { success: true, explains: data.Response.TargetText, translatedText: data.Response.TargetText, pronunciation: `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(text)}&type=1`, platform: 'tencent' }
    }
    const errCode = data.Response?.Error?.Code || ''
    const hintMap: Record<string, string> = { 'AuthFailure.SignatureFailure': '签名错误（请检查密钥）', 'AuthFailure.SecretIdNotFound': 'SecretId不存在', 'AuthFailure.SignatureExpire': '签名已过期（请检查系统时间）', 'ResourceInsufficient': '资源不足（免费额度已用完）', 'LimitExceeded': '请求频率超限' }
    return { success: false, explains: text, translatedText: text, errorMsg: `腾讯翻译错误${errCode ? '[' + errCode + ']' : ''}: ${hintMap[errCode] ? hintMap[errCode] + ' - ' : ''}${data.Response?.Error?.Message || '未知错误'}`, platform: 'tencent' }
  } catch (e) {
    return { success: false, explains: text, translatedText: text, errorMsg: '腾讯翻译错误: ' + String((e as Error).message || e), platform: 'tencent' }
  }
}

// ==================== AI 大模型翻译引擎 ====================

function buildAiSystemPrompt(from: string, to: string): string {
  const isEnglishToChinese = (from === 'en' || from === 'auto') && to === 'zh'
  if (isEnglishToChinese) {
    return `你是一个专业的中英文翻译助手。请将用户输入的英文单词或短语翻译成中文，并以JSON格式返回以下信息：
{
  "meaning": "主要中文释义（多个释义用；分隔）",
  "phonetic": "国际音标（如有）",
  "examples": [{"english": "英文例句", "chinese": "中文翻译"}]
}
只返回JSON，不要其他内容。`
  }
  return `你是一个专业翻译助手。请将以下文本从${from === 'auto' ? '源语言' : from}翻译为${to}，以JSON格式返回：
{"meaning": "翻译结果", "examples": [{"english": "原文例句", "chinese": "翻译"}]}
只返回JSON。`
}

async function translateWithDeepseek(text: string, from: string = 'auto', to: string = 'zh'): Promise<TranslationResult> {
  const { appkey, key } = getTranslationApiKey('deepseek')
  if (!appkey || !key) return { success: false, explains: text, translatedText: text, errorMsg: 'DeepSeek：请先配置API密钥', platform: 'deepseek' }
  try {
    const res: any = await new Promise((resolve) => {
      uni.request({ url: 'https://api.deepseek.com/chat/completions', method: 'POST',
        header: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
        data: { model: 'deepseek-chat', messages: [{ role: 'system', content: buildAiSystemPrompt(from, to) }, { role: 'user', content: text }], temperature: 0.3, max_tokens: 1024 },
        success: (r) => resolve(r), fail: (e) => resolve(e)
      })
    })
    if (res.errMsg && !res.data) return { success: false, explains: text, translatedText: text, errorMsg: 'DeepSeek请求失败: ' + res.errMsg, platform: 'deepseek' }
    const content = res.data?.choices?.[0]?.message?.content || ''
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return { success: true, explains: content, translatedText: content, platform: 'deepseek' }
    const parsed = JSON.parse(jsonMatch[0])
    return { success: true, explains: parsed.meaning || content, translatedText: parsed.meaning || content, phonetic: parsed.phonetic, examples: parsed.examples, synonyms: parsed.synonyms, antonyms: parsed.antonyms, memoryTip: parsed.memoryTip, pronunciation: `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(text)}&type=1`, platform: 'deepseek' }
  } catch (e) { return { success: false, explains: text, translatedText: text, errorMsg: 'DeepSeek错误: ' + String(e), platform: 'deepseek' } }
}

async function translateWithQwen(text: string, from: string = 'auto', to: string = 'zh'): Promise<TranslationResult> {
  const { appkey, key } = getTranslationApiKey('qwen')
  if (!appkey || !key) return { success: false, explains: text, translatedText: text, errorMsg: '千问：请先配置API密钥', platform: 'qwen' }
  try {
    const res: any = await new Promise((resolve) => {
      uni.request({ url: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', method: 'POST',
        header: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
        data: { model: 'qwen-turbo', messages: [{ role: 'system', content: buildAiSystemPrompt(from, to) }, { role: 'user', content: text }], temperature: 0.3 },
        success: (r) => resolve(r), fail: (e) => resolve(e)
      })
    })
    if (res.errMsg && !res.data) return { success: false, explains: text, translatedText: text, errorMsg: '千问请求失败: ' + res.errMsg, platform: 'qwen' }
    const content = res.data?.choices?.[0]?.message?.content || ''
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return { success: true, explains: content, translatedText: content, platform: 'qwen' }
    const parsed = JSON.parse(jsonMatch[0])
    return { success: true, explains: parsed.meaning || content, translatedText: parsed.meaning || content, phonetic: parsed.phonetic, examples: parsed.examples, pronunciation: `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(text)}&type=1`, platform: 'qwen' }
  } catch (e) { return { success: false, explains: text, translatedText: text, errorMsg: '千问错误: ' + String(e), platform: 'qwen' } }
}

async function translateWithKimi(text: string, from: string = 'auto', to: string = 'zh'): Promise<TranslationResult> {
  const { appkey, key } = getTranslationApiKey('kimi')
  if (!appkey || !key) return { success: false, explains: text, translatedText: text, errorMsg: 'Kimi：请先配置API密钥', platform: 'kimi' }
  try {
    const res: any = await new Promise((resolve) => {
      uni.request({ url: 'https://api.moonshot.cn/v1/chat/completions', method: 'POST',
        header: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
        data: { model: 'moonshot-v1-8k', messages: [{ role: 'system', content: buildAiSystemPrompt(from, to) }, { role: 'user', content: text }], temperature: 0.3 },
        success: (r) => resolve(r), fail: (e) => resolve(e)
      })
    })
    if (res.errMsg && !res.data) return { success: false, explains: text, translatedText: text, errorMsg: 'Kimi请求失败: ' + res.errMsg, platform: 'kimi' }
    const content = res.data?.choices?.[0]?.message?.content || ''
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return { success: true, explains: content, translatedText: content, platform: 'kimi' }
    const parsed = JSON.parse(jsonMatch[0])
    return { success: true, explains: parsed.meaning || content, translatedText: parsed.meaning || content, phonetic: parsed.phonetic, examples: parsed.examples, pronunciation: `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(text)}&type=1`, platform: 'kimi' }
  } catch (e) { return { success: false, explains: text, translatedText: text, errorMsg: 'Kimi错误: ' + String(e), platform: 'kimi' } }
}

async function translateWithGlm(text: string, from: string = 'auto', to: string = 'zh'): Promise<TranslationResult> {
  const { appkey, key } = getTranslationApiKey('glm')
  if (!appkey || !key) return { success: false, explains: text, translatedText: text, errorMsg: '智谱GLM：请先配置API密钥', platform: 'glm' }
  try {
    const res: any = await new Promise((resolve) => {
      uni.request({ url: 'https://open.bigmodel.cn/api/paas/v4/chat/completions', method: 'POST',
        header: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
        data: { model: 'glm-4-flash', messages: [{ role: 'system', content: buildAiSystemPrompt(from, to) }, { role: 'user', content: text }], temperature: 0.3 },
        success: (r) => resolve(r), fail: (e) => resolve(e)
      })
    })
    if (res.errMsg && !res.data) return { success: false, explains: text, translatedText: text, errorMsg: 'GLM请求失败: ' + res.errMsg, platform: 'glm' }
    const content = res.data?.choices?.[0]?.message?.content || ''
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return { success: true, explains: content, translatedText: content, platform: 'glm' }
    const parsed = JSON.parse(jsonMatch[0])
    return { success: true, explains: parsed.meaning || content, translatedText: parsed.meaning || content, phonetic: parsed.phonetic, examples: parsed.examples, synonyms: parsed.synonyms, antonyms: parsed.antonyms, memoryTip: parsed.memoryTip, pronunciation: `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(text)}&type=1`, platform: 'glm' }
  } catch (e) { return { success: false, explains: text, translatedText: text, errorMsg: 'GLM错误: ' + String(e), platform: 'glm' } }
}

async function translateWithOllama(text: string, from: string = 'auto', to: string = 'zh'): Promise<TranslationResult> {
  const { appkey: host, key: model } = getTranslationApiKey('ollama')
  if (!host) return { success: false, explains: text, translatedText: text, errorMsg: 'Ollama：请先配置服务地址', platform: 'ollama' }
  try {
    const res: any = await new Promise((resolve) => {
      uni.request({ url: `${host}/api/chat`, method: 'POST',
        header: { 'Content-Type': 'application/json' },
        data: { model: model || 'qwen2.5:3b', messages: [{ role: 'system', content: buildAiSystemPrompt(from, to) }, { role: 'user', content: text }], stream: false },
        success: (r) => resolve(r), fail: (e) => resolve(e)
      })
    })
    if (res.errMsg && !res.data) return { success: false, explains: text, translatedText: text, errorMsg: 'Ollama请求失败: ' + res.errMsg, platform: 'ollama' }
    const content = res.data?.message?.content || ''
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return { success: true, explains: content, translatedText: content, platform: 'ollama' }
    const parsed = JSON.parse(jsonMatch[0])
    return { success: true, explains: parsed.meaning || content, translatedText: parsed.meaning || content, phonetic: parsed.phonetic, examples: parsed.examples, platform: 'ollama' }
  } catch (e) { return { success: false, explains: text, translatedText: text, errorMsg: 'Ollama错误: ' + String(e), platform: 'ollama' } }
}

async function translateWithLocalDict(text: string, from: string = 'auto', to: string = 'zh'): Promise<TranslationResult> {
  const offline = queryOfflineDict(text)
  if (offline) return { success: true, explains: offline, translatedText: offline, phonetic: queryPhoneticFromCache(text) || undefined, pronunciation: getPronunciationUrl(text), platform: 'local' }
  return { success: false, explains: text, translatedText: text, errorMsg: '离线词典中未找到该词', platform: 'local' }
}

interface BatchAiItem {
  query?: string
  word?: string
  text?: string
  translation?: string
  meaning?: string
  phonetic?: string
  examples?: any[]
}

function buildBatchAiPrompt(words: string[], from: string, to: string): string {
  return `请将以下${words.length}个文本从 ${from === 'auto' ? '自动识别语言' : from} 翻译为 ${to}。只返回 JSON 数组，不要 Markdown，不要额外说明。数组长度必须与输入数量一致，每项格式：{"query":"原文本","translation":"翻译结果","phonetic":"音标（没有则空字符串）","examples":[]}\n\n输入：\n${words.map((w, i) => `${i + 1}. ${w}`).join('\n')}`
}

function parseBatchAiContent(content: string): BatchAiItem[] {
  const arrayMatch = content.match(/\[[\s\S]*\]/)
  if (arrayMatch) {
    const parsed = JSON.parse(arrayMatch[0])
    if (Array.isArray(parsed)) return parsed
  }
  const objectMatch = content.match(/\{[\s\S]*\}/)
  if (objectMatch) {
    const parsed = JSON.parse(objectMatch[0])
    if (Array.isArray(parsed?.items)) return parsed.items
    if (Array.isArray(parsed?.results)) return parsed.results
    if (Array.isArray(parsed?.data)) return parsed.data
  }
  throw new Error('AI 批量翻译返回不是有效 JSON 数组')
}

function normalizeBatchAiResults(words: string[], items: BatchAiItem[], platform: TranslationPlatform): TranslationResult[] {
  return words.map((word, index) => {
    const item = items[index] || items.find(x => (x.query || x.word || x.text || '').trim().toLowerCase() === word.trim().toLowerCase())
    const translatedText = item?.translation || item?.meaning || ''
    if (!translatedText) return { success: false, explains: word, translatedText: word, errorMsg: 'AI 批量翻译缺少对应结果', platform }
    return { success: true, explains: translatedText, translatedText, phonetic: item?.phonetic, examples: item?.examples, pronunciation: getPronunciationUrl(word), platform }
  })
}

function requestOpenAiCompatibleBatch(url: string, apiKey: string, model: string, words: string[], platform: TranslationPlatform, from: string, to: string): Promise<TranslationResult[]> {
  return new Promise((resolve, reject) => {
    uni.request({
      url,
      method: 'POST',
      header: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      data: {
        model,
        messages: [
          { role: 'system', content: '你是专业翻译助手，必须只返回有效 JSON 数组。' },
          { role: 'user', content: buildBatchAiPrompt(words, from, to) },
        ],
        temperature: 0.2,
      },
      success: (res) => {
        try {
          const content = (res.data as any)?.choices?.[0]?.message?.content || ''
          resolve(normalizeBatchAiResults(words, parseBatchAiContent(content), platform))
        } catch (e) { reject(e) }
      },
      fail: reject,
    })
  })
}

function requestOllamaBatch(words: string[], from: string, to: string): Promise<TranslationResult[]> {
  const { appkey: host, key: model } = getTranslationApiKey('ollama')
  return new Promise((resolve, reject) => {
    uni.request({
      url: `${host || 'http://localhost:11434'}/api/chat`,
      method: 'POST',
      header: { 'Content-Type': 'application/json' },
      data: {
        model: model || 'qwen2.5:3b',
        messages: [
          { role: 'system', content: '你是专业翻译助手，必须只返回有效 JSON 数组。' },
          { role: 'user', content: buildBatchAiPrompt(words, from, to) },
        ],
        stream: false,
      },
      success: (res) => {
        try {
          const content = (res.data as any)?.message?.content || (res.data as any)?.response || ''
          resolve(normalizeBatchAiResults(words, parseBatchAiContent(content), 'ollama'))
        } catch (e) { reject(e) }
      },
      fail: reject,
    })
  })
}

async function translateBatchWithAi(words: string[], from: string, to: string): Promise<TranslationResult[]> {
  if (currentPlatform === 'ollama') return requestOllamaBatch(words, from, to)
  const { appkey, key } = getTranslationApiKey(currentPlatform)
  if (!appkey) throw new Error(`请先配置${currentPlatform} API Key`)
  if (currentPlatform === 'glm') return requestOpenAiCompatibleBatch('https://open.bigmodel.cn/api/paas/v4/chat/completions', appkey, key || 'glm-4-flash', words, 'glm', from, to)
  if (currentPlatform === 'deepseek') return requestOpenAiCompatibleBatch('https://api.deepseek.com/v1/chat/completions', appkey, key || 'deepseek-chat', words, 'deepseek', from, to)
  if (currentPlatform === 'qwen') return requestOpenAiCompatibleBatch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', appkey, key || 'qwen-max', words, 'qwen', from, to)
  if (currentPlatform === 'kimi') return requestOpenAiCompatibleBatch('https://api.moonshot.cn/v1/chat/completions', appkey, key || 'kimi-k2-turbo-preview', words, 'kimi', from, to)
  throw new Error(`Unsupported AI batch platform: ${currentPlatform}`)
}

// ==================== 翻译主入口 ====================

export async function translateText(text: string, from: string = 'auto', to: string = 'zh'): Promise<TranslationResult> {
  const trimmed = text.trim().toLowerCase()
  if (!trimmed) return { success: false, explains: '', translatedText: '', errorMsg: '请输入要翻译的文本', platform: 'local' }

  const cached = getCachedTranslation(text, currentPlatform, from, to)
  if (cached) return cached

  if (!trimmed.includes(' ')) {
    const offline = queryOfflineDict(trimmed)
    if (offline) {
      const localResult = { success: true, explains: offline, translatedText: offline, phonetic: queryPhoneticFromCache(trimmed) || undefined, pronunciation: getPronunciationUrl(trimmed), platform: 'local' as const }
      setCachedTranslation(text, currentPlatform, from, to, localResult)
      return localResult
    }
  }
  try {
    let result: TranslationResult
    switch (currentPlatform) {
      case 'youdao': result = await translateWithYoudao(text, from, to); break
      case 'baidu': result = await translateWithBaidu(text, from, to); break
      case 'ali': result = await translateWithAli(text, from, to); break
      case 'tencent': result = await translateWithTencent(text, from, to); break
      case 'deepseek': result = await translateWithDeepseek(text, from, to); break
      case 'qwen': result = await translateWithQwen(text, from, to); break
      case 'kimi': result = await translateWithKimi(text, from, to); break
      case 'glm': result = await translateWithGlm(text, from, to); break
      case 'ollama': result = await translateWithOllama(text, from, to); break
      case 'local': result = await translateWithLocalDict(text, from, to); break
      default: result = await translateWithGlm(text, from, to); break
    }
    if (!result.phonetic && !trimmed.includes(' ')) result.phonetic = queryPhoneticFromCache(trimmed) || undefined
    setCachedTranslation(text, currentPlatform, from, to, result)
    return result
  } catch (e) {
    return { success: false, explains: text, translatedText: text, errorMsg: '翻译服务异常: ' + String((e as Error).message || e), platform: 'fallback' }
  }
}

export async function batchTranslate(words: string[], from: string = 'auto', to: string = 'zh'): Promise<TranslationResult[]> {
  const CONCURRENCY_LIMITS: Record<string, number> = {
    baidu: 1,
    youdao: 4,
    ali: 5,
    tencent: 5,
    deepseek: 5,
    qwen: 5,
    kimi: 5,
    glm: 5,
    ollama: 5,
    local: 50,
    default: 3,
  }
  const results: TranslationResult[] = new Array(words.length)
  const misses: Array<{ word: string; index: number }> = []

  words.forEach((word, index) => {
    const cached = getCachedTranslation(word, currentPlatform, from, to)
    if (cached) results[index] = cached
    else misses.push({ word, index })
  })

  if (AI_BATCH_PLATFORMS.has(currentPlatform) && misses.length > 1) {
    for (let i = 0; i < misses.length; i += AI_BATCH_SIZE) {
      const chunk = misses.slice(i, i + AI_BATCH_SIZE)
      try {
        const batchResults = await translateBatchWithAi(chunk.map(x => x.word), from, to)
        batchResults.forEach((result, idx) => {
          const target = chunk[idx]
          if (result?.success) {
            setCachedTranslation(target.word, currentPlatform, from, to, result)
            results[target.index] = result
          }
        })
      } catch { /* fallback below */ }
    }
  }

  const remaining = misses.filter(item => !results[item.index])
  let index = 0
  const limit = CONCURRENCY_LIMITS[currentPlatform] ?? CONCURRENCY_LIMITS.default
  const worker = async () => {
    while (index < remaining.length) {
      const currentIndex = index++
      const item = remaining[currentIndex]
      results[item.index] = await translateText(item.word, from, to)
      if (currentPlatform === 'baidu' && currentIndex < remaining.length - 1) {
        await new Promise(r => setTimeout(r, 1000))
      }
    }
  }

  const workerCount = Math.min(limit, remaining.length)
  await Promise.all(Array.from({ length: workerCount }, () => worker()))
  return results
}

