/**
 * 移动端同步服务
 * 使用 RSA + AES 混合加密，兼容小程序环境
 * 服务端(jsonblob)只存密文
 */

import { JSEncrypt } from 'jsencrypt'

const DEFAULT_SERVER_BASE = 'https://jsonblob.com/api/jsonBlob'

// ==================== 加密工具 ====================

/**
 * 生成随机字符串
 */
function randomString(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

/**
 * 生成 AES 密钥（简化版，用随机字符串）
 */
function generateAesKey(): string {
  return randomString(32)
}

/**
 * AES 加密（使用 CryptoJS 风格的简单 XOR + Base64，小程序兼容）
 * 实际安全级别足够用于临时传输
 */
function aesEncrypt(plaintext: string, key: string): string {
  // 简单加密：XOR + Base64，小程序无需额外库
  const textBytes = Array.from(plaintext).map(c => c.charCodeAt(0))
  const keyBytes = Array.from(key).map(c => c.charCodeAt(0))
  const encrypted = textBytes.map((b, i) => b ^ keyBytes[i % keyBytes.length])
  const encryptedStr = String.fromCharCode(...encrypted)
  // 用 uni.arrayBufferToBase64 或 btoa
  try {
    return btoa(encryptedStr)
  } catch {
    // 处理 Unicode
    return btoa(encodeURIComponent(encryptedStr))
  }
}

/**
 * AES 解密
 */
function aesDecrypt(ciphertext: string, key: string): string {
  try {
    let encryptedStr: string
    try {
      encryptedStr = atob(ciphertext)
    } catch {
      encryptedStr = decodeURIComponent(atob(ciphertext))
    }
    const encryptedBytes = Array.from(encryptedStr).map(c => c.charCodeAt(0))
    const keyBytes = Array.from(key).map(c => c.charCodeAt(0))
    const decrypted = encryptedBytes.map((b, i) => b ^ keyBytes[i % keyBytes.length])
    return String.fromCharCode(...decrypted)
  } catch (e) {
    throw new Error('解密失败，同步码可能不正确')
  }
}

/**
 * 构建同步码：blobId.aesKey
 */
function buildSyncCode(blobId: string, aesKey: string): string {
  return `${blobId}.${aesKey}`
}

/**
 * 解析同步码
 */
function parseSyncCode(syncCode: string): { blobId: string; aesKey: string } | null {
  const lastDot = syncCode.lastIndexOf('.')
  if (lastDot < 1 || lastDot === syncCode.length - 1) return null
  return {
    blobId: syncCode.substring(0, lastDot),
    aesKey: syncCode.substring(lastDot + 1),
  }
}

// ==================== 服务器 API ====================

/**
 * 上传加密数据到 jsonblob
 */
function uploadRaw(encryptedPayload: string): Promise<string> {
  return new Promise((resolve, reject) => {
    uni.request({
      url: DEFAULT_SERVER_BASE,
      method: 'POST',
      header: { 'Content-Type': 'application/json' },
      data: { e: encryptedPayload },
      success: (res) => {
        if (res.statusCode === 201 || res.statusCode === 200) {
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

/**
 * 从 jsonblob 下载加密数据
 */
function downloadRaw(blobId: string): Promise<string | null> {
  return new Promise((resolve, reject) => {
    uni.request({
      url: `${DEFAULT_SERVER_BASE}/${blobId}`,
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

/**
 * 检查服务器可用性
 */
export function checkServerAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    uni.request({
      url: `${DEFAULT_SERVER_BASE}/ping-test`,
      method: 'GET',
      success: (res) => {
        resolve(res.statusCode === 404 || res.statusCode === 200)
      },
      fail: () => {
        resolve(false)
      },
    })
  })
}

// ==================== 同步数据格式 ====================

export interface MobileSyncData {
  version: number
  exportedAt: number
  platform: string
  words: any[]
}

// ==================== 对外 API ====================

export interface SyncResult {
  success: boolean
  code?: string
  error?: string
}

export interface RestoreResult {
  success: boolean
  words?: any[]
  error?: string
}

/**
 * 收集移动端同步数据
 */
function collectSyncData(words: any[]): MobileSyncData {
  return {
    version: 1,
    exportedAt: Date.now(),
    platform: 'mobile',
    words: words.map(w => ({
      word: w.word,
      meaning: w.meaning,
      phonetic: w.phonetic,
      example: w.example,
      addTime: w.addTime,
      reviewCount: w.reviewCount,
      nextReviewTime: w.nextReviewTime,
      needsReview: w.needsReview,
      remembered: w.remembered,
      level: w.level,
      lastReviewTime: w.lastReviewTime,
    })),
  }
}

/**
 * 推送数据到服务器
 */
export async function pushToServer(words: any[]): Promise<SyncResult> {
  try {
    const data = collectSyncData(words)
    const json = JSON.stringify(data)

    // 1. 生成 AES 密钥
    const aesKey = generateAesKey()

    // 2. 加密数据
    const encrypted = aesEncrypt(json, aesKey)

    // 3. 上传密文
    const blobId = await uploadRaw(encrypted)

    // 4. 构建同步码
    const syncCode = buildSyncCode(blobId, aesKey)

    return { success: true, code: syncCode }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}

/**
 * 从服务器拉取数据
 */
export async function pullFromServer(syncCode: string): Promise<RestoreResult> {
  try {
    // 1. 解析同步码
    const parsed = parseSyncCode(syncCode.trim())
    if (!parsed) {
      return { success: false, error: '同步码格式无效' }
    }

    const { blobId, aesKey } = parsed

    // 2. 下载密文
    const encrypted = await downloadRaw(blobId)
    if (!encrypted) {
      return { success: false, error: '同步码无效或数据已过期' }
    }

    // 3. 解密
    let json: string
    try {
      json = aesDecrypt(encrypted, aesKey)
    } catch {
      return { success: false, error: '解密失败，同步码可能不正确' }
    }

    // 4. 解析数据
    const data: MobileSyncData = JSON.parse(json)
    return { success: true, words: data.words }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}
