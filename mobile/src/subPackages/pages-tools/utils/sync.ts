/**
 * 同步服务 - 重量级模块，已迁移到分包
 * 包含 XOR 加密、pako 压缩、服务器通信
 */

import type { MobileSyncBank, MobileSyncData, SyncResult, RestoreResult } from '@/stores/useUtils/types'
import { applyTranslationSettings, getAllTranslationApiKeys, getTranslationPlatform } from '@/stores/useUtils/translation-settings'

export type { MobileSyncBank, MobileSyncData, SyncResult, RestoreResult }

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

function utf8ToBytes(str: string): Uint8Array {
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

function bytesToUtf8(bytes: Uint8Array): string {
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

function uint8ArrayToBase64(bytes: Uint8Array): string {
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

function base64ToUint8Array(base64: string): Uint8Array {
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

function xorCrypt(data: Uint8Array, key: string): Uint8Array {
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

// ==================== 同步主入口 ====================

function collectSyncData(banks: MobileSyncBank[]): MobileSyncData {
  return {
    version: 1,
    exportedAt: Date.now(),
    platform: 'mobile',
    banks,
    userSettings: {
      translationPlatform: getTranslationPlatform(),
      keys: getAllTranslationApiKeys(),
    },
  }
}

export async function pushToServer(banks: MobileSyncBank[]): Promise<SyncResult> {
  try {
    const data = collectSyncData(banks)
    const json = JSON.stringify(data)
    const jsonBytes = utf8ToBytes(json)
    const pako = (await import('pako')).default
    const compressed = pako.deflate(jsonBytes)
    const aesKey = generateAesKey()
    const encrypted = xorCrypt(compressed, aesKey)
    const encryptedBase64 = uint8ArrayToBase64(encrypted)
    const blobId = await uploadRaw(encryptedBase64)
    const syncCode = buildSyncCode(blobId, aesKey)
    return { success: true, code: syncCode }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}

export async function pullFromServer(syncCode: string): Promise<RestoreResult> {
  try {
    const parsed = parseSyncCode(syncCode.trim())
    if (!parsed) return { success: false, error: '同步码格式无效' }
    const { blobId, aesKey } = parsed
    const encrypted = await downloadRaw(blobId)
    if (!encrypted) return { success: false, error: '同步码无效或数据已过期' }
    const encryptedBytes = base64ToUint8Array(encrypted)
    const compressed = xorCrypt(encryptedBytes, aesKey)
    const pako = (await import('pako')).default
    const jsonBytes = pako.inflate(compressed)
    const json = bytesToUtf8(jsonBytes)
    try {
      const data: MobileSyncData = JSON.parse(json)
      if (data.userSettings) {
        applyTranslationSettings(data.userSettings)
      }
      return { success: true, banks: data.banks }
    } catch {
      return { success: false, error: '数据解析失败' }
    }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}
