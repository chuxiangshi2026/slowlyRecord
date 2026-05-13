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
import { collectSyncData, restoreSyncData, DEFAULT_RESTORE_OPTIONS, type RestoreOptions, type RestoreResult } from '@/utils/sync-manager'
import { exportToJson, importFromJson } from '@/utils/sync-file'
import { log } from '@/utils/logger'

/** 默认同步服务器地址（jsonblob.com 是免费的临时 JSON 存储） */
const DEFAULT_SERVER_BASE = 'https://jsonblob.com/api/jsonBlob'

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
 * JsonBlob 适配器（默认）
 *
 * jsonblob.com 提供免费的临时 JSON 存储：
 * - POST 创建 blob，返回 blob ID
 * - GET 读取 blob
 * - 无需鉴权，数据无 TTL 但可手动删除
 * - 上传的是加密后的密文，服务器无法解读
 */
class JsonBlobAdapter implements SyncServerAdapter {
  private baseUrl = DEFAULT_SERVER_BASE

  async uploadRaw(encryptedPayload: string): Promise<string> {
    const maxRetries = 5

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // 服务器看到的只是无法解读的密文 + 元信息
        body: JSON.stringify({ e: encryptedPayload }),
      })

      if (response.ok) {
        const location = response.headers.get('Location') || response.headers.get('location')
        if (!location) {
          throw new Error('服务器未返回数据标识')
        }

        const blobId = location.split('/').pop() || location
        log.i('加密数据已上传, blobId:', blobId)
        return blobId
      }

      // 429 限流：自动指数退避重试
      if (response.status === 429 && attempt < maxRetries - 1) {
        const retryAfter = response.headers.get('Retry-After')
        const delayMs = retryAfter
          ? parseInt(retryAfter, 10) * 1000
          : 3000 + attempt * 3000 // 3s, 6s, 9s, 12s
        log.w(`服务器限流(429), ${delayMs}ms 后第 ${attempt + 2} 次尝试...`)
        await new Promise(resolve => setTimeout(resolve, delayMs))
        continue
      }

      throw new Error(`上传失败: ${response.status} ${response.statusText}`)
    }

    throw new Error('上传失败: 服务器限流，请 1~2 分钟后重试')
  }

  async downloadRaw(blobId: string): Promise<string | null> {
    const maxRetries = 5

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await fetch(`${this.baseUrl}/${blobId}`, {
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

        // 429 限流：自动指数退避重试
        if (response.status === 429 && attempt < maxRetries - 1) {
          const retryAfter = response.headers.get('Retry-After')
          const delayMs = retryAfter
            ? parseInt(retryAfter, 10) * 1000
            : 3000 + attempt * 3000
          log.w(`下载限流(429), ${delayMs}ms 后第 ${attempt + 2} 次尝试...`)
          await new Promise(resolve => setTimeout(resolve, delayMs))
          continue
        }

        throw new Error(`下载失败: ${response.status} ${response.statusText}`)
      } catch (e) {
        // 网络层异常（非 HTTP 错误）不重试，直接失败
        log.e('下载加密数据失败', e)
        return null
      }
    }

    log.e('下载失败: 服务器限流，请 1~2 分钟后重试')
    return null
  }

  async ping(): Promise<boolean> {
    // jsonblob.com 对探测请求会返回 ERR_ABORTED/404，反而在控制台制造噪音。
    // 直接视为可用，真实可用性由上传/下载时自然验证。
    return true
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
  _adapter = new JsonBlobAdapter()
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
  _adapter = new JsonBlobAdapter()
}

// ==================== 高级 API（含加密） ====================

const EMPTY_RESTORE_RESULT: RestoreResult = {
  success: false,
  wordBanksRestored: 0,
  userSettingsRestored: false,
  textMemoryRestored: false,
  numberMemoryRestored: false,
  shortcutMemoryRestored: false,
  errors: [],
}

/**
 * 上传当前设备数据到服务器（自动加密）
 * @returns 同步码（blobId.key），用于在另一台设备下载
 */
export async function uploadToServer(): Promise<SyncServerResult> {
  try {
    const data = await collectSyncData()
    const json = exportToJson(data)

    // 1. 生成随机 AES 密钥和 IV
    const aesKey = await generateAesKey()
    const iv = randomBytes(12) // GCM 推荐 12 字节

    // 2. 加密数据
    const encrypted = await encrypt(json, aesKey, iv)

    // 3. 上传密文
    const adapter = getSyncServerAdapter()
    const blobId = await adapter.uploadRaw(encrypted)

    // 4. 导出密钥，构建同步码
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
 * 从服务器下载数据并还原（自动解密）
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

    // 3. 导入 AES 密钥
    const aesKey = await importKey(keyBase64)

    // 4. 解密数据
    let json: string
    try {
      json = await decrypt(encrypted, aesKey)
    } catch {
      return { ...EMPTY_RESTORE_RESULT, errors: ['解密失败，同步码可能不正确或数据已被篡改'] }
    }

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
