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

import type { SyncData, SyncServerResult, SyncStatus, SyncTextMemory, SyncNumberMemory, SyncSignin, SyncMemoryPalace, SyncSentences, SyncKnowledgeMemory, SyncPhoneticMemory } from '@/types/sync'
import { SYNC_VERSION } from '@/types/sync'
import { collectSyncData, restoreSyncData, DEFAULT_RESTORE_OPTIONS, type RestoreOptions, type RestoreResult } from '@/utils/sync-manager'
import { getSetDb } from '@/utils/user-set-db-util'
import { collectSigninSync } from '@/utils/signin-db'
import { getTombstones } from '@/utils/sync-tombstone'
import { exportToJson, importFromJson } from '@/utils/sync-file'
import { log } from '@/utils/logger'
import { getAllWordBanks } from '@/utils/wordbank-manager'
import pako from 'pako'

/** 默认同步服务器地址（腾讯云 CloudBase 云函数） */
const DEFAULT_SERVER_BASE = 'https://1258475269-6fkx3oixct.ap-guangzhou.tencentscf.com'

/**
 * 上传 payload 体积上限（字节）
 * CloudBase 云函数 HTTP 触发器请求体上限约 6MB，留 1MB 余量给 JSON 包装和 base64 膨胀
 */
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024

/** localStorage key：上次成功推送的 JSON 哈希，用于跳过未变更的同步 */
const LAST_PUSH_HASH_KEY = 'slowlyrecord-last-push-hash'

/** 计算 SHA-256 哈希（hex 字符串），用于判断数据是否变更 */
async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text)
  const hashBuffer = await crypto.subtle.digest('SHA-256', bytes)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

// ==================== 客户端加密 ====================

/**
 * 将 ArrayBuffer 转为 base64url 字符串
 */
export function toBase64Url(buffer: ArrayBuffer): string {
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
export function fromBase64Url(str: string): ArrayBuffer {
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
export async function encrypt(plaintext: string, aesKey: CryptoKey, iv: Uint8Array): Promise<string> {
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
export async function decrypt(encryptedBase64: string, aesKey: CryptoKey): Promise<string> {
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
export async function generateAesKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true, // 可导出
    ['encrypt', 'decrypt'],
  )
}

/**
 * 导出 AES 密钥为 base64url
 */
export async function exportKey(key: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey('raw', key)
  return toBase64Url(raw)
}

/**
 * 从 base64url 导入 AES 密钥
 */
export async function importKey(base64Key: string): Promise<CryptoKey> {
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
export function parseSyncCode(syncCode: string): { blobId: string; keyBase64: string } | null {
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

/** 同步请求超时：网络黑洞时 fetch 永不落定，同步状态机会卡死在 uploading/downloading 只能重启 */
const SYNC_FETCH_TIMEOUT_MS = 30000

function fetchWithTimeout(url: string, options: RequestInit = {}): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), SYNC_FETCH_TIMEOUT_MS)
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer))
}

class DefaultServerAdapter implements SyncServerAdapter {
  private baseUrl = DEFAULT_SERVER_BASE

  async uploadRaw(encryptedPayload: string): Promise<string> {
    const response = await fetchWithTimeout(`${this.baseUrl}/sync`, {
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
      const response = await fetchWithTimeout(`${this.baseUrl}/sync/${blobId}`, {
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
      const response = await fetchWithTimeout(`${this.baseUrl}/ping`, { method: 'GET' })
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
    const response = await fetchWithTimeout(`${this.baseUrl}/sync`, {
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
      const response = await fetchWithTimeout(`${this.baseUrl}/sync/${blobId}`, {
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
      const response = await fetchWithTimeout(`${this.baseUrl}/ping`, {
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
  knowledgeMemoryRestored: false,
  phoneticMemoryRestored: false,
  signinRestored: false,
  memoryPalaceRestored: false,
  sentencesRestored: false,
  errors: [],
}

/**
 * 压缩 JSON 字符串，返回 base64url 编码的 pako 压缩数据
 */
export async function compressToJsonPayload(json: string): Promise<string> {
  const jsonBytes = new TextEncoder().encode(json)
  const compressed = pako.deflate(jsonBytes)
  return toBase64Url(compressed.buffer)
}

/**
 * 解压缩 base64url 编码的 pako 数据，返回 JSON 字符串
 */
export async function decompressFromJsonPayload(payload: string): Promise<string> {
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

    // 跳过未变更的同步：对 JSON 取哈希，与上次成功推送的哈希比对
    const hash = await sha256Hex(json)
    const lastHash = localStorage.getItem(LAST_PUSH_HASH_KEY)
    if (lastHash && hash === lastHash) {
      log.i('数据未变更，跳过上传')
      return { success: true, code: '', skipped: true }
    }

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
    if (uploadPayload.length > MAX_UPLOAD_BYTES) {
      const mb = (uploadPayload.length / 1024 / 1024).toFixed(1)
      log.e(`上传 payload ${mb}MB 超过 ${MAX_UPLOAD_BYTES / 1024 / 1024}MB 上限`)
      return { success: false, error: `数据量过大（${mb}MB），请减少词库或图片后重试` }
    }
    const adapter = getSyncServerAdapter()
    const blobId = await adapter.uploadRaw(encrypted)

    // 上传成功后记录哈希，下次未变更则跳过
    localStorage.setItem(LAST_PUSH_HASH_KEY, hash)

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
export function uint8ArrayToBase64(bytes: Uint8Array): string {
  const CHUNK = 0x8000
  const chunks: string[] = []
  for (let i = 0; i < bytes.length; i += CHUNK) {
    const slice = bytes.subarray(i, Math.min(i + CHUNK, bytes.length))
    chunks.push(String.fromCharCode.apply(null, Array.from(slice)))
  }
  return btoa(chunks.join(''))
}

export function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

/** XOR 加密/解密 Uint8Array（对称操作） */
export function xorCrypt(data: Uint8Array, key: string): Uint8Array {
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

/** 移动端兼容同步数据（wire format） */
export interface MobileCompatSyncData {
  version: number
  exportedAt: number
  platform: string
  /** 词库分组 */
  banks: MobileCompatBank[]
  userSettings?: MobileCompatUserSettings
  /** 文本记忆数据（与桌面端 SyncTextMemory 同 wire format） */
  textMemory?: SyncTextMemory
  /** 数字记忆数据（与桌面端 SyncNumberMemory 同 wire format；移动端可能省略 trainingResults） */
  numberMemory?: SyncNumberMemory
  /** 每日打卡记录（与桌面端 SyncSignin 同 wire format） */
  signin?: SyncSignin
  /** 记忆宫殿（与桌面端 SyncMemoryPalace 同 wire format） */
  memoryPalace?: SyncMemoryPalace
  /** 句子库（与桌面端 SyncSentences 同 wire format） */
  sentences?: SyncSentences
  /** 通用知识包进度（与桌面端 SyncKnowledgeMemory 同 wire format；旧客户端忽略） */
  knowledgeMemory?: SyncKnowledgeMemory
  /** 音标学习进度（与桌面端 SyncPhoneticMemory 同 wire format；旧客户端忽略） */
  phoneticMemory?: SyncPhoneticMemory
  /** 删除墓碑表 id → deletedAt（旧客户端忽略；restore 端合并取较大 deletedAt） */
  tombstones?: Record<string, number>
}

/**
 * 把移动端 association 适配到桌面端 NumberImageAssociation
 *
 * 移动端第一阶段使用 type='text' + description；桌面端的 imageUrl 字段同时
 * 支持图片 (base64) 与 emoji/文字（参见 ImageAssociationDialog 的 isBase64Image 分支）。
 * 因此当移动端 imageUrl 为空时，把 description 作为兜底填入 imageUrl，让桌面端
 * 现有渲染逻辑把它当作文字桩展示。
 */
function adaptMobileAssociation(a: any): any {
  if (!a) return a
  const next: any = { ...a }
  if (!next.imageUrl && next.description) {
    next.imageUrl = next.description
  }
  if (!next.source) next.source = 'upload'
  return next
}

export function convertDesktopWordToMobile(w: any): MobileCompatWord {
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

export async function collectMobileCompatData(): Promise<MobileCompatSyncData> {
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

  // 复用桌面端的 collectSyncData 拿到文本/数字记忆片段（wire format 一致）
  // 注意：collectSyncData 还会拉词库等其他数据，但读取本身廉价（已缓存）
  let textMemory: SyncTextMemory | undefined
  let numberMemory: SyncNumberMemory | undefined
  let memoryPalace: SyncMemoryPalace | undefined
  let sentences: SyncSentences | undefined
  let knowledgeMemory: SyncKnowledgeMemory | undefined
  let phoneticMemory: SyncPhoneticMemory | undefined
  try {
    const fullData = await collectSyncData()
    textMemory = fullData.textMemory || undefined
    numberMemory = fullData.numberMemory || undefined
    memoryPalace = fullData.memoryPalace || undefined
    sentences = fullData.sentences || undefined
    knowledgeMemory = fullData.knowledgeMemory || undefined
    phoneticMemory = fullData.phoneticMemory || undefined
  } catch (e) {
    log.w('收集文本/数字记忆数据失败，将以空数据上传', e)
  }

  return {
    version: 1,
    exportedAt: Date.now(),
    platform: 'desktop',
    banks,
    userSettings: collectMobileCompatUserSettings(),
    textMemory,
    numberMemory,
    signin: collectSigninSync() || undefined,
    memoryPalace,
    sentences,
    knowledgeMemory,
    phoneticMemory,
    tombstones: getTombstones(),
  }
}

export function convertMobileCompatToSyncData(data: MobileCompatSyncData): SyncData {
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
      focusMode: { alwaysOnTop: true, opacity: 1.0, edgeStickEnabled: true, fontColor: '', fontSize: 20, explainFontSize: 11, backgroundImage: '', backgroundImageOpacity: 0.35 },
    } : null,
    textMemory: data.textMemory ?? null,
    numberMemory: data.numberMemory
      ? {
          ...data.numberMemory,
          associations: (data.numberMemory.associations || []).map(adaptMobileAssociation),
          // 移动端可能不带这两个字段，给空数组兜底
          trainingResults: data.numberMemory.trainingResults || [],
        }
      : null,
    shortcutMemory: null,
    letterMemory: null,
    signin: data.signin ?? null,
    memoryPalace: data.memoryPalace ?? null,
    sentences: data.sentences ?? null,
    // 透传知识包/音标进度：此前未透传，移动端推来的这两个模块进度被静默丢弃
    knowledgeMemory: data.knowledgeMemory ?? null,
    phoneticMemory: data.phoneticMemory ?? null,
    // 透传墓碑表：restore 端合并进本地墓碑
    tombstones: data.tombstones,
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
    if (uploadPayload.length > MAX_UPLOAD_BYTES) {
      const mb = (uploadPayload.length / 1024 / 1024).toFixed(1)
      log.e(`移动端兼容推送 payload ${mb}MB 超过 ${MAX_UPLOAD_BYTES / 1024 / 1024}MB 上限`)
      return { success: false, error: `数据量过大（${mb}MB），请减少词库或图片后重试` }
    }
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
