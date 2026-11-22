/**
 * user-set 密钥字段的应用级加密（仅 uTools 商店版启用，由调用方门控）
 *
 * 用户填写的翻译/OCR API Key 需要随 uTools 账号同步到多端，但同步库不应留明文。
 * 这里用 AES-GCM-256 加密后再入库：密钥材料是固定的应用级常量（SHA-256 派生），
 * 目的是避免密钥在云端/导出文件里明文留存、防随手翻阅；它不防范能读到源码的
 * 定向攻击者，也不替代系统级密钥环。密文统一 `enc:v1:` 前缀，读写双侧据此识别，
 * 未加密的历史明文与加密值可在同一文档内并存（写路径会逐步收敛为密文）。
 */

const PREFIX = 'enc:v1:'
// 应用级密钥材料：仅用于派生 AES 密钥，不是任何服务的访问凭证
const KEY_MATERIAL = 'slowlyrecord/user-set-secret/v1'

export function isEncryptedSecret(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith(PREFIX)
}

function getSubtle(): SubtleCrypto | null {
  try {
    return globalThis.crypto?.subtle ?? null
  } catch {
    return null
  }
}

/** 当前环境是否支持加解密（不支持时调用方退化为不落库，绝不写明文） */
export function hasSecretCrypto(): boolean {
  return !!getSubtle()
}

let cachedKey: Promise<CryptoKey> | null = null

function getAesKey(): Promise<CryptoKey> {
  if (!cachedKey) {
    const subtle = getSubtle()
    if (!subtle) return Promise.reject(new Error('WebCrypto subtle 不可用'))
    cachedKey = subtle
      .digest('SHA-256', new TextEncoder().encode(KEY_MATERIAL))
      .then((digest) => subtle.importKey('raw', digest, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']))
  }
  return cachedKey
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

/** 加密单个密钥值；空串原样返回（空值不占密文），已是密文的值原样返回 */
export async function encryptSecret(plain: string): Promise<string> {
  if (!plain || isEncryptedSecret(plain)) return plain
  const subtle = getSubtle()
  if (!subtle) throw new Error('WebCrypto subtle 不可用')
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12))
  const cipher = await subtle.encrypt(
    { name: 'AES-GCM', iv },
    await getAesKey(),
    new TextEncoder().encode(plain),
  )
  const packed = new Uint8Array(iv.length + cipher.byteLength)
  packed.set(iv, 0)
  packed.set(new Uint8Array(cipher), iv.length)
  return PREFIX + bytesToBase64(packed)
}

/** 解密单个值；非密文原样返回，解密失败按空串处理（避免把密文当密钥发向第三方 API） */
export async function decryptSecret(value: string): Promise<string> {
  if (!isEncryptedSecret(value)) return value
  const subtle = getSubtle()
  if (!subtle) return ''
  try {
    const packed = base64ToBytes(value.slice(PREFIX.length))
    const iv = packed.slice(0, 12)
    const plain = await subtle.decrypt(
      { name: 'AES-GCM', iv },
      await getAesKey(),
      packed.slice(12),
    )
    return new TextDecoder().decode(plain)
  } catch {
    return ''
  }
}
