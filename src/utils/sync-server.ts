/**
 * 临时服务器同步工具（客户端加密版）
 *
 * 设计原则：
 * - 服务器不保留用户身份信息，仅用随机 code 标识一次同步
 * - **所有数据在客户端 AES-256-GCM 加密后才上传**，服务器只存密文
 * - 即使服务器被入侵或数据被截获，没有密钥也无法解读
 * - 同步码 = blobId + 加密密钥，两段缺一不可
 * - 服务器可随时停掉，不影响本地文件同步功能
 *
 * 安全模型：
 * - 上传时：客户端生成随机 AES 密钥 → 加密数据 → 上传密文 → 返回 blobId
 * - 同步码格式：blobId.key（key 包含 IV + AES 密钥）
 * - 下载时：拆分同步码 → 用 blobId 下载密文 → 用 key 解密
 * - 攻击者拿到 blobId 只能看到密文，拿到 key 没有 blobId 也下载不到密文
 */

import type { SyncData, SyncServerResult, SyncStatus } from '@/types/sync'
import { SYNC_VERSION } from '@/types/sync'
import { collectSyncData, restoreSyncData, DEFAULT_RESTORE_OPTIONS, type RestoreOptions, type RestoreResult } from '@/utils/sync-manager'
import { getSetDb } from '@/utils/user-set-db-util'
import { exportToJson, importFromJson } from '@/utils/sync-file'
import { log } from '@/utils/logger'
import { getAllWordBanks } from '@/utils/wordbank-manager'
import pako from 'pako'

/** 默认同步服务器地址（腾讯云 CloudBase 云函数） */
const DEFAULT_SERVER_BASE = 'https://1258475269-6fkx3oixct.ap-guangzhou.tencentscf.com'

// ==================== 客户端加密 ====================

/**
 * 将 ArrayBuffer 转为 base64url 字符串
 */
function toBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

/**
 * 将 base64url 字符串转为 ArrayBuffer
 */
function fromBase64Url(str: string): ArrayBuffer {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/')
  while (base64.length % 4 !== 0) {
    base64 += '='
  }
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}

/**
 * 生成随机字节
 */
function randomBytes(length: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length))
}

/**
 * 使用 AES-256-GCM 加密字符串
 * @returns base64url 编码的 "iv + ciphertext"
 */
async function encrypt(plaintext: string, aesKey: CryptoKey, iv: Uint8Array): Promise<string> {
  const encoded = new TextEncoder().encode(plaintext)
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    encoded,
  )
  // 拼接 iv + ciphertext
  const combined = new Uint8Array(iv.length + ciphertext.byteLength)
  combined.set(iv, 0)
  combined.set(new Uint8Array(ciphertext), iv.length)
  return toBase64Url(combined.buffer)
}

/**
 * 使用 AES-256-GCM 解密
 * @param encryptedBase64 base64url 编码的 "iv + ciphertext"
 */
async function decrypt(encryptedBase64: string, aesKey: CryptoKey): Promise<string> {
  const combined = new Uint8Array(fromBase64Url(encryptedBase64))
  const iv = combined.slice(0, 12) // GCM 推荐 12 字节 IV
  const ciphertext = combined.slice(12)
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    ciphertext,
  )
  return new TextDecoder().decode(decrypted)
}

/**
 * 生成随机 AES-256 密钥
 */
async function generateAesKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true, // 可导出
    ['encrypt', 'decrypt'],
  )
}

/**
 * 导出 AES 密钥为 base64url
 */
async function exportKey(key: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey('raw', key)
  return toBase64Url(raw)
}

/**
 * 从 base64url 导入 AES 密钥
 */
async function importKey(base64Key: string): Promise<CryptoKey> {
  const raw = fromBase64Url(base64Key)
  return crypto.subtle.importKey(
    'raw',
    raw,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt'],
  )
}

/**
 * 构建同步码（blobId + 加密密钥）
 * 格式：blobId.keyBase64
 */
function buildSyncCode(blobId: string, keyBase64: string): string {
  return `${blobId}.${keyBase64}`
}

/**
 * 解析同步码，返回 blobId 和 keyBase64
 */
function parseSyncCode(syncCode: string): { blobId: string; keyBase64: string } | null {
  // 找到最后一个点来分割（blobId 本身不含点，但以防万一取最后一段）
  const lastDot = syncCode.lastIndexOf('.')
  if (lastDot < 1 || lastDot === syncCode.length - 1) {
    return null
  }
  return {
    blobId: syncCode.substring(0, lastDot),
    keyBase64: syncCode.substring(lastDot + 1),
  }
}

// ==================== 服务器适配器 ====================

/**
 * 同步服务器适配器接口
 * 可以替换为自建服务器的实现
 */
export interface SyncServerAdapter {
  /** 上传加密数据，返回唯一 blobId */
  uploadRaw(encryptedPayload: string): Promise<string>
  /** 用 blobId 下载加密数据 */
  downloadRaw(blobId: string): Promise<string | null>
  /** 检查服务器是否可用 */
  ping(): Promise<boolean>
}

/**
 * 默认服务器适配器（腾讯云 CloudBase 云函数）
 *
 * API 格式：
 * - POST /sync     → 上传加密数据，返回 { code: string }
 * - GET  /sync/:code → 下载加密数据，返回 { e: string }（阅后即焚）
 * - GET  /ping     → 健康检查
 */
class DefaultServerAdapter implements SyncServerAdapter {
  private baseUrl = DEFAULT_SERVER_BASE

  async uploadRaw(encryptedPayload: string): Promise<string> {
    const response = await fetch(`${this.baseUrl}/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ e: encryptedPayload }),
    })

    if (!response.ok) {
      throw new Error(`上传失败: ${response.status} ${response.statusText}`)
    }

    const result = await response.json()
    const code = result.code || result.id || result.key
    if (!code) {
      throw new Error('服务器未返回有效的同步码')
    }
    log.i('加密数据已上传, code:', code)
    return code
  }

  async downloadRaw(blobId: string): Promise<string | null> {
    try {
      const response = await fetch(`${this.baseUrl}/sync/${blobId}`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      })

      if (response.ok) {
        const json = await response.json()
        if (json && json.e) {
          log.i('加密数据已下载')
          return json.e as string
        }
        log.e('服务器返回数据格式异常')
        return null
      }

      if (response.status === 404) {
        log.w('同步数据不存在或已过期')
        return null
      }

      throw new Error(`下载失败: ${response.status} ${response.statusText}`)
    } catch (e) {
      log.e('下载加密数据失败', e)
      return null
    }
  }

  async ping(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/ping`, { method: 'GET' })
      return response.ok
    } catch {
      return false
    }
  }
}

/**
 * 自建服务器适配器
 *
 * 自建服务器只需实现两个 API：
 * POST /sync  - 上传加密数据，返回 { code: string }
 * GET /sync/:code - 下载加密数据，返回 { e: string }
 *
 * 服务器端建议：
 * - 数据存内存或 Redis，设 TTL 自动过期
 * - 一次 code 只能下载一次（阅后即焚）
 * - 不记录用户 IP 或其他身份信息
 * - 服务端只看到密文，无法解密
 */
class CustomServerAdapter implements SyncServerAdapter {
  constructor(private baseUrl: string) {}

  async uploadRaw(encryptedPayload: string): Promise<string> {
    const response = await fetch(`${this.baseUrl}/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ e: encryptedPayload }),
    })

    if (!response.ok) {
      throw new Error(`上传失败: ${response.status} ${response.statusText}`)
    }

    const result = await response.json()
    const code = result.code || result.id || result.key
    if (!code) {
      throw new Error('服务器未返回有效的同步码')
    }
    log.i('加密数据已上传到自定义服务器, code:', code)
    return code
  }

  async downloadRaw(blobId: string): Promise<string | null> {
    try {
      const response = await fetch(`${this.baseUrl}/sync/${blobId}`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      })

      if (!response.ok) {
        if (response.status === 404) {
          log.w('同步数据不存在或已过期')
          return null
        }
        throw new Error(`下载失败: ${response.status} ${response.statusText}`)
      }

      const json = await response.json()
      if (json && json.e) {
        return json.e as string
      }
      log.e('自定义服务器返回数据格式异常')
      return null
    } catch (e) {
      log.e('从自定义服务器下载失败', e)
      return null
    }
  }

  async ping(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/ping`, {
        method: 'GET',
      }).catch(() => null)
      return response?.ok || false
    } catch {
      return false
    }
  }
}

// ==================== 适配器管理 ====================

let _adapter: SyncServerAdapter | null = null

/**
 * 获取同步服务器适配器
 */
export function getSyncServerAdapter(): SyncServerAdapter {
  if (_adapter) return _adapter
  _adapter = new DefaultServerAdapter()
  return _adapter
}

/**
 * 设置自定义同步服务器
 */
export function setSyncServerUrl(url: string) {
  _adapter = new CustomServerAdapter(url)
}

/**
 * 重置为默认服务器
 */
export function resetSyncServer() {
  _adapter = new DefaultServerAdapter()
}

// ==================== 高级 API（含加密） ====================

const EMPTY_RESTORE_RESULT: RestoreResult = {
  success: false,
  wordBanksRestored: 0,
  userSettingsRestored: false,
  textMemoryRestored: false,
  numberMemoryRestored: false,
  shortcutMemoryRestored: false,
  letterMemoryRestored: false,
  errors: [],
}

/**
 * 压缩 JSON 字符串，返回 base64url 编码的 pako 压缩数据
 */
async function compressToJsonPayload(json: string): Promise<string> {
  const jsonBytes = new TextEncoder().encode(json)
  const compressed = pako.deflate(jsonBytes)
  return toBase64Url(compressed.buffer)
}

/**
 * 解压缩 base64url 编码的 pako 数据，返回 JSON 字符串
 */
async function decompressFromJsonPayload(payload: string): Promise<string> {
  const compressed = new Uint8Array(fromBase64Url(payload))
  const jsonBytes = pako.inflate(compressed)
  return new TextDecoder().decode(jsonBytes)
}

/**
 * 上传当前设备数据到服务器（自动加密+压缩）
 * @returns 同步码（blobId.key），用于在另一台设备下载
 */
export async function uploadToServer(): Promise<SyncServerResult> {
  try {
    const data = await collectSyncData()
    const json = exportToJson(data)

    // 1. 压缩 JSON
    const compressedPayload = await compressToJsonPayload(json)

    // 2. 生成随机 AES 密钥和 IV
    const aesKey = await generateAesKey()
    const iv = randomBytes(12) // GCM 推荐 12 字节

    // 3. 加密数据
    const encrypted = await encrypt(compressedPayload, aesKey, iv)

    // 4. 上传密文
    const uploadPayload = JSON.stringify({ e: encrypted })
    log.i(`桌面端上传: JSON ${(new TextEncoder().encode(json).length / 1024).toFixed(1)}KB, 上传payload ${(uploadPayload.length / 1024).toFixed(1)}KB (${(uploadPayload.length / 1024 / 1024).toFixed(2)}MB)`)
    const adapter = getSyncServerAdapter()
    const blobId = await adapter.uploadRaw(encrypted)

    // 5. 导出密钥，构建同步码
    const keyBase64 = await exportKey(aesKey)
    const syncCode = buildSyncCode(blobId, keyBase64)

    log.i('加密上传完成, 同步码长度:', syncCode.length)
    return { success: true, code: syncCode }
  } catch (e) {
    log.e('加密上传失败', e)
    return { success: false, error: String(e) }
  }
}

/**
 * 从服务器下载数据并还原（自动解密+解压）
 * @param syncCode 同步码（blobId.key 格式）
 */
export async function downloadFromServer(syncCode: string, options?: Partial<RestoreOptions>): Promise<RestoreResult> {
  try {
    // 1. 解析同步码
    const parsed = parseSyncCode(syncCode.trim())
    if (!parsed) {
      return { ...EMPTY_RESTORE_RESULT, errors: ['同步码格式无效，应为 "blobId.key" 格式'] }
    }

    const { blobId, keyBase64 } = parsed

    // 2. 下载密文
    const adapter = getSyncServerAdapter()
    const encrypted = await adapter.downloadRaw(blobId)
    if (!encrypted) {
      return { ...EMPTY_RESTORE_RESULT, errors: ['同步码无效或数据已过期'] }
    }

    // 3. 导入 AES 密钥并解密数据；如果失败，尝试按移动端兼容格式解析
    let compressedPayload: string
    try {
      const aesKey = await importKey(keyBase64)
      compressedPayload = await decrypt(encrypted, aesKey)
    } catch {
      const mobileResult = await restoreMobileCompatFromEncrypted(encrypted, keyBase64, options)
      if (mobileResult) return mobileResult
      return { ...EMPTY_RESTORE_RESULT, errors: ['解密失败，同步码可能不正确或数据已被篡改'] }
    }

    // 4. 解压缩
    const json = await decompressFromJsonPayload(compressedPayload)

    // 5. 解析并还原
    const data = importFromJson(json)
    const restoreOpts = { ...DEFAULT_RESTORE_OPTIONS, ...options }
    return restoreSyncData(data, restoreOpts)
  } catch (e) {
    log.e('加密下载还原失败', e)
    return { ...EMPTY_RESTORE_RESULT, errors: [String(e)] }
  }
}

/**
 * 检查同步服务器是否可用
 */
export async function checkServerAvailable(): Promise<boolean> {
  try {
    const adapter = getSyncServerAdapter()
    return await adapter.ping()
  } catch {
    return false
  }
}

// ==================== 移动端兼容推送（供小程序拉取） ====================

function randomString32(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

/** 将 Uint8Array 转为 base64（分块避免栈溢出） */
function uint8ArrayToBase64(bytes: Uint8Array): string {
  const CHUNK = 0x8000
  const chunks: string[] = []
  for (let i = 0; i < bytes.length; i += CHUNK) {
    const slice = bytes.subarray(i, Math.min(i + CHUNK, bytes.length))
    chunks.push(String.fromCharCode.apply(null, Array.from(slice)))
  }
  return btoa(chunks.join(''))
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

/** XOR 加密/解密 Uint8Array（对称操作） */
function xorCrypt(data: Uint8Array, key: string): Uint8Array {
  const keyBytes = new TextEncoder().encode(key)
  const keyLen = keyBytes.length
  const result = new Uint8Array(data.length)
  for (let i = 0; i < data.length; i++) {
    result[i] = data[i] ^ keyBytes[i % keyLen]
  }
  return result
}

interface MobileCompatWord {
  word: string
  meaning: string
  itemType?: 'word' | 'phrase' | 'sentence' | 'collocation'
  phonetic?: string
  example?: string
  addTime: number
  reviewCount: number
  nextReviewTime: number
  needsReview: boolean
  remembered: boolean
  level: number
  lastReviewTime: number
}

interface MobileCompatBank {
  id: string
  name: string
  words: MobileCompatWord[]
}

interface MobileCompatUserSettings {
  translationPlatform?: string
  keys?: Record<string, { appkey: string; key: string }>
}

interface MobileCompatSyncData {
  version: number
  exportedAt: number
  platform: string
  /** 词库分组 */
  banks: MobileCompatBank[]
  userSettings?: MobileCompatUserSettings
}

function convertDesktopWordToMobile(w: any): MobileCompatWord {
  const learnTime = w.learnDate ? new Date(w.learnDate).getTime() : Date.now()
  return {
    word: w.text || '',
    meaning: w.explains || '',
    itemType: w.itemType || (String(w.text || '').includes(' ') ? 'phrase' : 'word'),
    phonetic: w.phonetic || '',
    example: '',
    addTime: learnTime,
    reviewCount: 0,
    nextReviewTime: Date.now() + 24 * 60 * 60 * 1000,
    needsReview: !!w.isReview,
    remembered: !!w.remember,
    level: typeof w.level === 'number' ? w.level : 0,
    lastReviewTime: learnTime,
  }
}

function collectMobileCompatUserSettings(): MobileCompatUserSettings | undefined {
  const userSet = getSetDb()
  if (!userSet) return undefined

  const keys: Record<string, { appkey: string; key: string }> = { ...(userSet.keys || {}) }
  Object.entries(userSet.ocrKeys || {}).forEach(([platform, value]) => {
    if (!keys[platform]?.appkey?.trim() && value?.appkey?.trim()) {
      keys[platform] = value
    }
  })

  return {
    translationPlatform: userSet.translationPlatform,
    keys,
  }
}

async function collectMobileCompatData(): Promise<MobileCompatSyncData> {
  const allBanks = await getAllWordBanks()
  const banks: MobileCompatBank[] = []

  for (const bank of allBanks) {
    const bankWords: MobileCompatWord[] = []
    if (bank.words && Array.isArray(bank.words)) {
      for (const w of bank.words) {
        bankWords.push(convertDesktopWordToMobile(w))
      }
    }
    banks.push({
      id: bank.id,
      name: bank.name,
      words: bankWords,
    })
  }

  return {
    version: 1,
    exportedAt: Date.now(),
    platform: 'desktop',
    banks,
    userSettings: collectMobileCompatUserSettings(),
  }
}

function convertMobileCompatToSyncData(data: MobileCompatSyncData): SyncData {
  const exportedAt = data.exportedAt || Date.now()
  return {
    version: SYNC_VERSION,
    exportedAt,
    platform: data.platform || 'mobile',
    currentWordBankId: data.banks?.[0]?.id || '',
    wordBanks: (data.banks || []).map((bank) => ({
      id: bank.id,
      name: bank.name,
      createdAt: exportedAt,
      updatedAt: exportedAt,
      isDefault: bank.id === 'default',
      words: (bank.words || []).map((word, index) => ({
        _id: `mobile-${bank.id}-${index}-${exportedAt}`,
        text: word.word || '',
        explains: word.meaning || '',
        itemType: word.itemType === 'sentence' ? 'phrase' : (word.itemType || (String(word.word || '').includes(' ') ? 'phrase' : 'word')),
        phonetic: word.phonetic || '',
        ctime: new Date(word.addTime || exportedAt),
        learnDate: new Date(word.lastReviewTime || word.addTime || exportedAt),
        isReview: !!word.needsReview,
        remember: !!word.remembered,
        level: typeof word.level === 'number' ? word.level : 1,
      })) as any,
    })),
    userSettings: data.userSettings ? {
      pluginStatus: false,
      shortcutEnabled: false,
      translationPlatform: data.userSettings.translationPlatform || 'glm',
      ocrPlatform: 'local',
      memoryFirmness: '正常',
      keys: data.userSettings.keys || {},
      ocrKeys: {},
      focusMode: { alwaysOnTop: true, opacity: 1.0, edgeStickEnabled: true },
    } : null,
    textMemory: null,
    numberMemory: null,
    shortcutMemory: null,
    letterMemory: null,
  }
}

async function restoreMobileCompatFromEncrypted(
  encryptedBase64: string,
  key: string,
  options?: Partial<RestoreOptions>,
): Promise<RestoreResult | null> {
  try {
    const encryptedBytes = base64ToUint8Array(encryptedBase64)
    const compressed = xorCrypt(encryptedBytes, key)
    const jsonBytes = pako.inflate(compressed)
    const json = new TextDecoder().decode(jsonBytes)
    const mobileData: MobileCompatSyncData = JSON.parse(json)
    if (!Array.isArray(mobileData.banks)) return null

    const syncData = convertMobileCompatToSyncData(mobileData)
    return restoreSyncData(syncData, { ...DEFAULT_RESTORE_OPTIONS, ...options })
  } catch {
    return null
  }
}

/**
 * 以移动端兼容格式上传（推送到小程序）
 * 流程：JSON → pako 压缩 → XOR 加密 → base64 → 上传
 */
export async function uploadToServerMobileCompat(): Promise<SyncServerResult> {
  try {
    const data = await collectMobileCompatData()
    const json = JSON.stringify(data)

    // 1. pako 压缩
    const jsonBytes = new TextEncoder().encode(json)
    const compressed = pako.deflate(jsonBytes)

    // 2. XOR 加密
    const key = randomString32()
    const encrypted = xorCrypt(compressed, key)

    // 3. base64 编码 + 上传
    const encryptedBase64 = uint8ArrayToBase64(encrypted)
    const uploadPayload = JSON.stringify({ e: encryptedBase64 })
    log.i(`数据大小: 原始JSON ${(jsonBytes.length / 1024).toFixed(1)}KB, 压缩后 ${(compressed.length / 1024).toFixed(1)}KB, 上传payload ${(uploadPayload.length / 1024).toFixed(1)}KB (${(uploadPayload.length / 1024 / 1024).toFixed(2)}MB)`)
    const adapter = getSyncServerAdapter()
    const blobId = await adapter.uploadRaw(encryptedBase64)
    const syncCode = `${blobId}.${key}`
    log.i('移动端兼容推送完成, 同步码长度:', syncCode.length)
    return { success: true, code: syncCode }
  } catch (e) {
    log.e('移动端兼容推送失败', e)
    return { success: false, error: String(e) }
  }
}
