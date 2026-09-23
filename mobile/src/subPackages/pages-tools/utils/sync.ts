/**
 * 同步服务 - 重量级模块，已迁移到分包
 * 包含 XOR 加密、pako 压缩、服务器通信
 *
 * pako 必须静态 import：uni-app alpha 编译 mp-weixin 时 import('pako') 会被
 * 编译成纯字符串字面量（renderDynamicImport 返回 '(' + ')'），真机拿不到模块。
 */

import pako from 'pako'
import type {
  MobileSyncBank,
  MobileSyncData,
  SyncResult,
  RestoreResult,
  MobileTextMemory,
  MobileNumberMemory,
  MobileKnowledgeMemory,
  MobilePhoneticMemory,
  MobileSigninData,
  MobileMemoryPalace,
  MobileSentences,
} from '@/stores/useUtils/types'
import { applyTranslationSettings, getAllTranslationApiKeys, getTranslationPlatform } from '@/stores/useUtils/translation-settings'
import { filterByTombstones, mergeTombstones } from '@/stores/useUtils/sync-tombstone'
import { log } from '../../../utils/logger'

export type {
  MobileSyncBank,
  MobileSyncData,
  SyncResult,
  RestoreResult,
  MobileTextMemory,
  MobileNumberMemory,
  MobileKnowledgeMemory,
  MobilePhoneticMemory,
  MobileSigninData,
  MobileMemoryPalace,
  MobileSentences,
}

// ==================== 服务器配置 ====================

const STORAGE_KEY_SERVER_URL = 'slowly_sync_server_url'

function getServerBase(): string {
  const customUrl = uni.getStorageSync(STORAGE_KEY_SERVER_URL)
  if (customUrl) return customUrl.replace(/\/$/, '')
  return 'https://1258475269-6fkx3oixct.ap-guangzhou.tencentscf.com'
}

export function setSyncServerUrl(url: string): void {
  if (url && url.trim()) {
    uni.setStorageSync(STORAGE_KEY_SERVER_URL, url.trim().replace(/\/$/, ''))
  } else {
    uni.removeStorageSync(STORAGE_KEY_SERVER_URL)
  }
}

export function getSyncServerUrl(): string {
  return getServerBase()
}

export function resetSyncServer(): void {
  uni.removeStorageSync(STORAGE_KEY_SERVER_URL)
}

// ==================== 加密工具 ====================

function randomString(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < length; i++) result += chars.charAt(Math.floor(Math.random() * chars.length))
  return result
}

function generateAesKey(): string { return randomString(32) }

function hasWebCryptoSubtle(): boolean {
  try {
    const subtle = (globalThis as any)?.crypto?.subtle
    return !!subtle && typeof subtle.encrypt === 'function' && typeof subtle.decrypt === 'function'
  } catch { return false }
}

function getRandomBytes(length: number): Uint8Array {
  try {
    const c = (globalThis as any)?.crypto
    if (c?.getRandomValues) {
      const bytes = new Uint8Array(length)
      c.getRandomValues(bytes)
      return bytes
    }
  } catch { /* ignore */ }
  const bytes = new Uint8Array(length)
  for (let i = 0; i < length; i++) bytes[i] = Math.floor(Math.random() * 256)
  return bytes
}

function bytesToBase64Url(bytes: Uint8Array): string {
  return uint8ArrayToBase64(bytes).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
}

function base64UrlToBytes(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padLen = (4 - (normalized.length % 4)) % 4
  return base64ToUint8Array(normalized + '='.repeat(padLen))
}

async function importAesKeyFromBase64(keyBase64: string): Promise<CryptoKey> {
  const raw = base64UrlToBytes(keyBase64)
  return (globalThis as any).crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'])
}

async function aesGcmEncrypt(plaintext: Uint8Array, keyBase64: string): Promise<string> {
  const iv = getRandomBytes(12)
  const cryptoKey = await importAesKeyFromBase64(keyBase64)
  const ciphertext = await (globalThis as any).crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    plaintext,
  )
  const combined = new Uint8Array(iv.byteLength + ciphertext.byteLength)
  combined.set(iv, 0)
  combined.set(new Uint8Array(ciphertext), iv.byteLength)
  return bytesToBase64Url(combined)
}

async function aesGcmDecrypt(payload: string, keyBase64: string): Promise<Uint8Array> {
  const combined = base64UrlToBytes(payload)
  const iv = combined.slice(0, 12)
  const ciphertext = combined.slice(12)
  const cryptoKey = await importAesKeyFromBase64(keyBase64)
  const decrypted = await (globalThis as any).crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    ciphertext,
  )
  return new Uint8Array(decrypted)
}

function generateSyncKey(): string {
  if (hasWebCryptoSubtle()) {
    return bytesToBase64Url(getRandomBytes(32))
  }
  return randomString(32)
}

export function utf8ToBytes(str: string): Uint8Array {
  try { if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(str) } catch { /* */ }
  const bytes: number[] = []
  for (let i = 0; i < str.length; i++) {
    let code = str.charCodeAt(i)
    if (code < 0x80) bytes.push(code)
    else if (code < 0x800) bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f))
    else if (code >= 0xd800 && code <= 0xdbff) {
      code = 0x10000 + ((code & 0x3ff) << 10) | (str.charCodeAt(++i) & 0x3ff)
      bytes.push(0xf0 | (code >> 18), 0x80 | ((code >> 12) & 0x3f), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f))
    } else bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f))
  }
  return new Uint8Array(bytes)
}

export function bytesToUtf8(bytes: Uint8Array): string {
  try { if (typeof TextDecoder !== 'undefined') return new TextDecoder().decode(bytes) } catch { /* */ }
  let str = '', i = 0
  while (i < bytes.length) {
    const b1 = bytes[i++]
    if (b1 < 0x80) str += String.fromCharCode(b1)
    else if (b1 < 0xe0) str += String.fromCharCode(((b1 & 0x1f) << 6) | (bytes[i++] & 0x3f))
    else if (b1 < 0xf0) str += String.fromCharCode(((b1 & 0x0f) << 12) | ((bytes[i++] & 0x3f) << 6) | (bytes[i++] & 0x3f))
    else {
      const cp = ((b1 & 0x07) << 18) | ((bytes[i++] & 0x3f) << 12) | ((bytes[i++] & 0x3f) << 6) | (bytes[i++] & 0x3f)
      str += String.fromCharCode(0xd800 | ((cp - 0x10000) >> 10), 0xdc00 | (cp & 0x3ff))
    }
  }
  return str
}

export function uint8ArrayToBase64(bytes: Uint8Array): string {
  try { if (typeof wx !== 'undefined' && wx.arrayBufferToBase64) return wx.arrayBufferToBase64(bytes.buffer as ArrayBuffer) } catch { /* */ }
  try { if (typeof tt !== 'undefined' && tt.arrayBufferToBase64) return tt.arrayBufferToBase64(bytes.buffer as ArrayBuffer) } catch { /* */ }
  try {
    const CHUNK = 0x8000, chunks: string[] = []
    for (let i = 0; i < bytes.length; i += CHUNK) { const slice = bytes.subarray(i, Math.min(i + CHUNK, bytes.length)); chunks.push(String.fromCharCode.apply(null, Array.from(slice))) }
    return btoa(chunks.join(''))
  } catch { /* */ }
  const base64Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  let result = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const b1 = bytes[i], b2 = bytes[i + 1], b3 = bytes[i + 2]
    result += base64Chars[b1 >> 2] + base64Chars[((b1 & 3) << 4) | ((b2 || 0) >> 4)]
    result += (i + 1 < bytes.length) ? base64Chars[((b2 & 15) << 2) | ((b3 || 0) >> 6)] : '='
    result += (i + 2 < bytes.length) ? base64Chars[(b3 || 0) & 63] : '='
  }
  return result
}

export function base64ToUint8Array(base64: string): Uint8Array {
  try { if (typeof wx !== 'undefined' && wx.base64ToArrayBuffer) return new Uint8Array(wx.base64ToArrayBuffer(base64)) } catch { /* */ }
  try { if (typeof tt !== 'undefined' && tt.base64ToArrayBuffer) return new Uint8Array(tt.base64ToArrayBuffer(base64)) } catch { /* */ }
  try { const binary = atob(base64); const bytes = new Uint8Array(binary.length); for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i); return bytes } catch { /* */ }
  const base64Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  const lookup = new Uint8Array(256); for (let i = 0; i < base64Chars.length; i++) lookup[base64Chars.charCodeAt(i)] = i
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

export function xorCrypt(data: Uint8Array, key: string): Uint8Array {
  const keyBytes = utf8ToBytes(key)
  const result = new Uint8Array(data.length)
  for (let i = 0; i < data.length; i++) result[i] = data[i] ^ keyBytes[i % keyBytes.length]
  return result
}

function buildSyncCode(blobId: string, aesKey: string): string { return `${blobId}.${aesKey}` }

function parseSyncCode(syncCode: string): { blobId: string; aesKey: string } | null {
  const lastDot = syncCode.lastIndexOf('.')
  if (lastDot < 1 || lastDot === syncCode.length - 1) return null
  return { blobId: syncCode.substring(0, lastDot), aesKey: syncCode.substring(lastDot + 1) }
}

// ==================== 网络通信 ====================

function uploadRaw(encryptedPayload: string): Promise<string> {
  return new Promise((resolve, reject) => {
    uni.request({
      url: `${getServerBase()}/sync`, method: 'POST',
      header: { 'Content-Type': 'application/json' },
      data: { e: encryptedPayload },
      success: (res) => {
        if (res.statusCode === 201 || res.statusCode === 200) {
          const data = res.data as any
          if (data && (data.code || data.id || data.key)) { resolve(data.code || data.id || data.key); return }
          const location = (res.header?.Location || res.header?.location || '') as string
          const blobId = location.split('/').pop() || location
          if (blobId) resolve(blobId); else reject(new Error('服务器未返回数据标识'))
        } else reject(new Error(`上传失败: ${res.statusCode}`))
      },
      fail: (err) => reject(new Error(`上传失败: ${err.errMsg || '网络错误'}`)),
    })
  })
}

function downloadRaw(blobId: string): Promise<string | null> {
  return new Promise((resolve, reject) => {
    uni.request({
      url: `${getServerBase()}/sync/${blobId}`, method: 'GET',
      header: { 'Accept': 'application/json' },
      success: (res) => {
        if (res.statusCode === 200) { const data = res.data as any; resolve(data && data.e ? data.e as string : null) }
        else if (res.statusCode === 404) resolve(null)
        else reject(new Error(`下载失败: ${res.statusCode}`))
      },
      fail: (err) => reject(new Error(`下载失败: ${err.errMsg || '网络错误'}`)),
    })
  })
}

export function checkServerAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    uni.request({
      url: `${getServerBase()}/ping`, method: 'GET',
      success: (res) => resolve(res.statusCode === 200),
      fail: () => resolve(false),
    })
  })
}

/**
 * 上传 payload 体积上限（字节）
 * CloudBase 云函数 HTTP 触发器请求体上限约 6MB，留 1MB 余量
 */
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024

/**
 * 单张图片的同步体积上限（字符数 ≈ 字节数）
 * 超过此大小的 dataURL 在收集同步数据时被剔除，避免 payload 膨胀
 */
const MAX_SYNC_IMAGE_CHARS = 32 * 1024

/** uni storage key：上次成功推送的 JSON 哈希，用于跳过未变更的同步 */
const LAST_PUSH_HASH_KEY = 'slowlyrecord-last-push-hash'

/** 计算 SHA-256 哈希（hex 字符串），用于判断数据是否变更 */
async function sha256Hex(text: string): Promise<string> {
  const subtle = (globalThis as any)?.crypto?.subtle
  if (!subtle) {
    // 无 WebCrypto 时退回简单哈希（djb2），只用于去重判断
    let hash = 5381
    for (let i = 0; i < text.length; i++) hash = ((hash << 5) + hash + text.charCodeAt(i)) | 0
    return hash.toString(16)
  }
  const bytes = utf8ToBytes(text)
  const hashBuffer = await subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

export interface PushPayload {
  banks: MobileSyncBank[]
  textMemory?: MobileTextMemory
  numberMemory?: MobileNumberMemory
  knowledgeMemory?: MobileKnowledgeMemory
  phoneticMemory?: MobilePhoneticMemory
  signin?: MobileSigninData
  memoryPalace?: MobileMemoryPalace
  sentences?: MobileSentences
  /** 同步墓碑：本机删除埋点随 payload 透传，对端拉取时按它过滤「删除复活」的条目 */
  tombstones?: Record<string, number>
}

export function collectSyncData(payload: PushPayload): MobileSyncData {
  return {
    version: 1,
    exportedAt: Date.now(),
    platform: 'mobile',
    banks: payload.banks,
    userSettings: {
      translationPlatform: getTranslationPlatform(),
      keys: getAllTranslationApiKeys(),
    },
    textMemory: payload.textMemory,
    numberMemory: payload.numberMemory,
    knowledgeMemory: payload.knowledgeMemory,
    phoneticMemory: payload.phoneticMemory,
    signin: payload.signin,
    memoryPalace: payload.memoryPalace,
    sentences: payload.sentences,
    tombstones: payload.tombstones,
  }
}

/**
 * 推送到服务器
 *
 * 兼容旧调用：第一参数若为数组直接当作 banks（向前兼容）
 */
export async function pushToServer(
  banksOrPayload: MobileSyncBank[] | PushPayload,
  extra?: {
    textMemory?: MobileTextMemory
    numberMemory?: MobileNumberMemory
    knowledgeMemory?: MobileKnowledgeMemory
    phoneticMemory?: MobilePhoneticMemory
    signin?: MobileSigninData
    memoryPalace?: MobileMemoryPalace
    sentences?: MobileSentences
  },
): Promise<SyncResult> {
  try {
    const payload: PushPayload = Array.isArray(banksOrPayload)
      ? { banks: banksOrPayload, ...extra }
      : banksOrPayload
    const data = collectSyncData(payload)
    const json = JSON.stringify(data)

    // 跳过未变更的同步：对 JSON 取哈希，与上次成功推送的哈希比对
    const hash = await sha256Hex(json)
    const lastHash = uni.getStorageSync(LAST_PUSH_HASH_KEY)
    if (lastHash && hash === lastHash) {
      log.i('[sync] 数据未变更，跳过上传')
      return { success: true, code: '', skipped: true }
    }

    const jsonBytes = utf8ToBytes(json)
    const compressed = pako.deflate(jsonBytes)
    const syncKey = generateSyncKey()
    let encryptedBase64: string
    if (hasWebCryptoSubtle()) {
      try {
        encryptedBase64 = await aesGcmEncrypt(compressed, syncKey)
      } catch (cryptoError) {
        log.w('[sync] AES-GCM 加密失败，回退到 XOR：', cryptoError)
        encryptedBase64 = uint8ArrayToBase64(xorCrypt(compressed, syncKey))
      }
    } else {
      encryptedBase64 = uint8ArrayToBase64(xorCrypt(compressed, syncKey))
    }
    const uploadPayload = JSON.stringify({ e: encryptedBase64 })
    log.i(`[sync] 数据大小: 原始JSON ${(jsonBytes.length / 1024).toFixed(1)}KB, 上传payload ${(uploadPayload.length / 1024).toFixed(1)}KB (${(uploadPayload.length / 1024 / 1024).toFixed(2)}MB)`)
    if (uploadPayload.length > MAX_UPLOAD_BYTES) {
      const mb = (uploadPayload.length / 1024 / 1024).toFixed(1)
      return { success: false, error: `数据量过大（${mb}MB），请减少词库或图片后重试` }
    }
    const blobId = await uploadRaw(encryptedBase64)
    uni.setStorageSync(LAST_PUSH_HASH_KEY, hash)
    const syncCode = buildSyncCode(blobId, syncKey)
    return { success: true, code: syncCode }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}

/**
 * 拉取到 MobileSyncData 后的统一入库前处理：应用翻译设置、合并墓碑并按墓碑
 * 过滤「删除复活」的词条/宫殿。pullFromServer 与 pullFromWebDav 共用，
 * 保证服务器同步码与 WebDAV 网盘两条拉取链路行为一致。
 */
export async function buildRestoreResult(data: MobileSyncData): Promise<RestoreResult> {
  if (data.userSettings) {
    applyTranslationSettings(data.userSettings)
  }
  // 墓碑合并 + 按墓碑过滤入库条目：已被任一端删除的词/词库不让它复活。
  // 注意两端 id 体系不同（桌面词 _id ≠ 移动端词 id），桌面侧删除的词在移动端
  // 无法按 id 匹配；移动端双设备间经 payload 透传 id，删除可互通。
  const tombstones = await mergeTombstones(data.tombstones)
  let banks = data.banks
  if (Array.isArray(banks) && Object.keys(tombstones).length > 0) {
    banks = banks.map(bank => ({
      ...bank,
      words: filterByTombstones(bank.words || [], 'remote', tombstones),
    }))
  }
  // 宫殿级墓碑过滤：已删宫殿不复活（pegs 随宫殿一并跳过）
  let memoryPalace = data.memoryPalace
  if (memoryPalace && Array.isArray(memoryPalace.palaces) && Object.keys(tombstones).length > 0) {
    const palaces = filterByTombstones(memoryPalace.palaces, 'remote', tombstones)
    const keptIds = new Set(palaces.map(p => p._id))
    memoryPalace = {
      ...memoryPalace,
      palaces,
      pegs: Object.fromEntries(
        Object.entries(memoryPalace.pegs || {}).filter(([palaceId]) => keptIds.has(palaceId))
      ),
    }
  }
  return {
    success: true,
    banks,
    textMemory: data.textMemory,
    numberMemory: data.numberMemory,
    knowledgeMemory: data.knowledgeMemory,
    phoneticMemory: data.phoneticMemory,
    signin: data.signin,
    memoryPalace,
    sentences: data.sentences,
  }
}

export async function pullFromServer(syncCode: string): Promise<RestoreResult> {
  try {
    const parsed = parseSyncCode(syncCode.trim())
    if (!parsed) return { success: false, error: '同步码格式无效' }
    const { blobId, aesKey } = parsed
    const encrypted = await downloadRaw(blobId)
    if (!encrypted) return { success: false, error: '同步码无效或数据已过期' }
    let compressed: Uint8Array | null = null
    if (hasWebCryptoSubtle()) {
      try {
        compressed = await aesGcmDecrypt(encrypted, aesKey)
      } catch (cryptoError) {
        log.w('[sync] AES-GCM 解密失败，尝试旧 XOR 同步码：', cryptoError)
      }
    }
    if (!compressed) {
      try {
        compressed = xorCrypt(base64ToUint8Array(encrypted), aesKey)
      } catch (e) {
        return { success: false, error: '解密失败，同步码可能不正确或数据已被篡改' }
      }
    }
    const jsonBytes = pako.inflate(compressed)
    const json = bytesToUtf8(jsonBytes)
    let data: MobileSyncData
    try {
      data = JSON.parse(json)
    } catch {
      return { success: false, error: '数据解析失败' }
    }
    return buildRestoreResult(data)
  } catch (e) {
    return { success: false, error: String(e) }
  }
}
