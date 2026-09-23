/**
 * 中文在线发音音源（轻量模块，主包可安全引用）
 *
 * 背景：有道 dictvoice 仅支持英语（中文实测返回 500 "returned null audio"），
 * 谷歌翻译 TTS 在境内真机多被网络阻断，小程序 request/downloadFile 又受合法域名白名单限制，
 * 因此中文发音走「有道智云 TTS API」：与翻译接口共用用户已配置的应用凭证，
 * 域名 openapi.youdao.com 与有道翻译相同（已配翻译的用户白名单天然兼容）。
 *
 * 约束：
 * - 语音合成需在开放平台控制台额外绑定「语音合成」服务实例，未绑定时返回 errorCode 110，
 *   由 speakWord 的回退链兜底到谷歌翻译 TTS；
 * - 官方文档请求方式为 POST，但 GET 直接返回 audio/mp3 流，可直接作 innerAudio 的 src
 *   （GET 可用性需真机确认，失败同样走回退链）；
 * - 谷歌翻译 TTS（tl=zh-CN）在境外网络/开发工具可用，境内真机基本不可用，仅作最后兜底。
 */

import { getTranslationApiKey } from '@/stores/useUtils/translation-settings'

/** 有道智云语音合成 HTTPS 地址 */
export const YOUDAO_TTS_API = 'https://openapi.youdao.com/ttsapi'

/** 默认中文发音人：小薰（女声，常见语种，见有道 TTS 发音人列表） */
export const DEFAULT_ZH_VOICE_NAME = 'youxiaoxun'

/** 汉字（CJK 统一表意文字基本区 \u4e00-\u9fff + 扩展 A \u3400-\u4dbf）判定 */
export function containsChinese(text: string): boolean {
  return /[一-鿿㐀-䶿]/.test(text)
}

// ---------- SHA-256（与 pages-tools/utils/translation.ts 的有道 v3 签名同一实现，保持独立以免主包引入重量级翻译模块） ----------

function utf8Bytes(str: string): Uint8Array {
  const encoded = encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_m, hex: string) => String.fromCharCode(parseInt(hex, 16)))
  const bytes = new Uint8Array(encoded.length)
  for (let i = 0; i < encoded.length; i++) bytes[i] = encoded.charCodeAt(i)
  return bytes
}

function rightRotate(value: number, amount: number): number {
  return (value >>> amount) | (value << (32 - amount))
}

function sha256(data: Uint8Array): Uint8Array {
  const k = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ]
  const h = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]
  const bitLen = data.length * 8
  const withPadding = new Uint8Array(Math.ceil((data.length + 9) / 64) * 64)
  withPadding.set(data)
  withPadding[data.length] = 0x80
  const view = new DataView(withPadding.buffer)
  view.setUint32(withPadding.length - 4, bitLen >>> 0, false)
  view.setUint32(withPadding.length - 8, Math.floor(bitLen / 0x100000000), false)
  const w = new Array<number>(64)
  for (let block = 0; block < withPadding.length; block += 64) {
    for (let t = 0; t < 16; t++) w[t] = view.getUint32(block + t * 4, false)
    for (let t = 16; t < 64; t++) {
      const s0 = rightRotate(w[t - 15], 7) ^ rightRotate(w[t - 15], 18) ^ (w[t - 15] >>> 3)
      const s1 = rightRotate(w[t - 2], 17) ^ rightRotate(w[t - 2], 19) ^ (w[t - 2] >>> 10)
      w[t] = (w[t - 16] + s0 + w[t - 7] + s1) | 0
    }
    let [a, b, c, d, e, f, g, hh] = h
    for (let t = 0; t < 64; t++) {
      const s1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)
      const ch = (e & f) ^ (~e & g)
      const temp1 = (hh + s1 + ch + k[t] + w[t]) | 0
      const s0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)
      const maj = (a & b) ^ (a & c) ^ (b & c)
      const temp2 = (s0 + maj) | 0
      hh = g; g = f; f = e; e = (d + temp1) | 0; d = c; c = b; b = a; a = (temp1 + temp2) | 0
    }
    h[0] = (h[0] + a) | 0; h[1] = (h[1] + b) | 0; h[2] = (h[2] + c) | 0; h[3] = (h[3] + d) | 0
    h[4] = (h[4] + e) | 0; h[5] = (h[5] + f) | 0; h[6] = (h[6] + g) | 0; h[7] = (h[7] + hh) | 0
  }
  const out = new Uint8Array(32)
  const outView = new DataView(out.buffer)
  for (let i = 0; i < 8; i++) outView.setUint32(i * 4, h[i] >>> 0, false)
  return out
}

function toHex(bytes: Uint8Array): string {
  let hex = ''
  for (let i = 0; i < bytes.length; i++) hex += bytes[i].toString(16).padStart(2, '0')
  return hex
}

function sha256Hex(input: string): string {
  return toHex(sha256(utf8Bytes(input)))
}

/** 有道 v3 签名 input：q 长度 ≤20 取原文，否则 前10 + 长度 + 后10 */
function youdaoSignInput(q: string): string {
  if (!q) return q
  if (q.length <= 20) return q
  return q.substring(0, 10) + q.length + q.substring(q.length - 10)
}

// ---------- URL 构建 ----------

/**
 * 构建有道智云 TTS 的发音 URL（GET，直接返回 audio/mp3 流，可作 innerAudio 的 src）。
 * 密钥未配置时返回 null；签名等任何异常都容错返回 null，由调用方走兜底音源。
 */
export function buildYoudaoTtsUrl(text: string, voiceName: string = DEFAULT_ZH_VOICE_NAME): string | null {
  try {
    const { appkey, key } = getTranslationApiKey('youdao')
    if (!appkey || !key) return null
    const salt = '' + Date.now()
    const curtime = Math.round(Date.now() / 1000)
    const sign = sha256Hex(appkey + youdaoSignInput(text) + salt + curtime + key)
    const params = new URLSearchParams({
      q: text,
      appKey: appkey,
      salt,
      curtime: '' + curtime,
      sign,
      signType: 'v3',
      format: 'mp3',
      voiceName,
      speed: '1',
    })
    return `${YOUDAO_TTS_API}?${params.toString()}`
  } catch {
    return null
  }
}

/**
 * 中文发音音源链：有道智云 TTS（用户已配密钥时）→ 谷歌翻译 TTS（tl=zh-CN，境内真机多不可用，仅最后兜底）。
 * URL 的 q 参数与现有音频缓存键解析（parseAudioCacheWord）兼容，可正常落本地缓存。
 */
export function buildChineseAudioUrls(text: string): string[] {
  const urls: string[] = []
  const youdao = buildYoudaoTtsUrl(text)
  if (youdao) urls.push(youdao)
  urls.push(`https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=zh-CN&q=${encodeURIComponent(text)}`)
  return urls
}
