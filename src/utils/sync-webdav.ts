/**
 * WebDAV 网盘同步（坚果云等）
 *
 * 与服务器同步码模式的区别：
 * - 数据存到用户自己的网盘账号，长期保留，不受临时服务器 TTL 限制
 * - 无同步码：凭据（账号+应用密码）即身份，两台设备填同样的凭据即可互相同步
 * - 加密密钥直接从凭据派生（见 buildWebDavKey），无需额外传输
 *
 * 文件格式（与移动端共享，两端可互传）：
 *   固定路径 {网盘地址}/slowlyRecord-sync.enc
 *   内容 = base64( XOR( pako压缩( MobileCompatSyncData JSON ), 凭据密钥 ) )
 *   采用 XOR 而非 AES-GCM 是因为微信小程序没有 WebCrypto，XOR 是两端唯一共同可用的
 *   对称方案（与现有移动端服务器同步的加密强度一致）；文件存于用户私有网盘，
 *   威胁模型仅为「网盘侧不可读」。
 *
 * 传输仅使用 GET / PUT，不用 PROPFIND/MKCOL：
 * 微信小程序 wx.request 不支持这两个方法，文件固定在 WebDAV 根目录，根目录必然存在。
 */

import pako from 'pako'
import type { SyncServerResult } from '@/types/sync'
import { DEFAULT_RESTORE_OPTIONS, restoreSyncData, type RestoreOptions, type RestoreResult } from '@/utils/sync-manager'
import {
  base64ToUint8Array,
  collectMobileCompatData,
  convertMobileCompatToSyncData,
  uint8ArrayToBase64,
  xorCrypt,
  type MobileCompatSyncData,
} from '@/utils/sync-server'
import { log } from '@/utils/logger'

export interface WebDavConfig {
  url: string
  username: string
  password: string
}

/** 坚果云 WebDAV 固定地址（预设值，用户可改成其他 WebDAV 服务） */
export const NUTSTORE_WEBDAV_URL = 'https://dav.jianguoyun.com/dav/'

/** 同步文件在 WebDAV 根目录下的固定文件名（不用子目录，避免 MKCOL 兼容问题） */
const FILE_NAME = 'slowlyRecord-sync.enc'

/** 上传体积上限：坚果云免费版单文件 500MB，这里沿用服务器同步的 5MB 自律上限 */
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024

/** 规范化网盘地址并拼出同步文件的完整 URL */
export function webDavFileUrl(config: WebDavConfig): string {
  return `${config.url.trim().replace(/\/+$/, '')}/${FILE_NAME}`
}

/** 凭据派生加密密钥：两台设备凭据相同则密钥相同，无需传输密钥 */
function buildWebDavKey(config: WebDavConfig): string {
  return `${config.username}:${config.password}`
}

/** Basic 认证头（经 UTF-8 编码，避免 btoa 遇非 Latin1 字符抛错） */
function buildAuthHeader(config: WebDavConfig): string {
  return `Basic ${uint8ArrayToBase64(new TextEncoder().encode(`${config.username}:${config.password}`))}`
}

/** 加密打包：JSON → pako → XOR → base64（纯函数，便于测试） */
export function encodeWebDavFile(json: string, key: string): string {
  const compressed = pako.deflate(new TextEncoder().encode(json))
  return uint8ArrayToBase64(xorCrypt(compressed, key))
}

/** 解密解包：base64 → XOR → pako → JSON（纯函数，便于测试） */
export function decodeWebDavFile(body: string, key: string): string {
  const compressed = xorCrypt(base64ToUint8Array(body.trim()), key)
  return new TextDecoder().decode(pako.inflate(compressed))
}

/** 把网络异常翻译成用户可懂的提示 */
function explainHttpError(status: number): string {
  if (status === 401 || status === 403) return '账号或应用密码错误（注意：密码是「应用密码」，不是登录密码）'
  if (status === 404) return '网盘上还没有同步数据（首次使用请先备份）'
  if (status === 507) return '网盘空间不足'
  return `网盘返回错误（${status}）`
}

function explainNetworkError(e: unknown): string {
  const msg = String(e)
  if (/Failed to fetch|NetworkError|Load failed/i.test(msg)) {
    return '网络请求被拦截：浏览器直连 WebDAV 受跨域限制，请使用 uTools / Electron / 小程序端'
  }
  return msg
}

/**
 * 测试连接：GET 一次同步文件
 * 200=已有备份，404=连接正常但首次使用，401=凭据错误
 */
export async function testWebDavConnection(config: WebDavConfig): Promise<{ ok: boolean; message: string }> {
  try {
    const resp = await fetch(webDavFileUrl(config), {
      method: 'GET',
      headers: { Authorization: buildAuthHeader(config) },
    })
    if (resp.ok) return { ok: true, message: '连接成功，网盘上已有同步数据' }
    if (resp.status === 404) return { ok: true, message: '连接成功（网盘上暂无数据，首次使用请先备份）' }
    return { ok: false, message: explainHttpError(resp.status) }
  } catch (e) {
    return { ok: false, message: explainNetworkError(e) }
  }
}

/** 备份：收集全量数据 → 加密打包 → PUT 到网盘 */
export async function uploadToWebDav(config: WebDavConfig): Promise<SyncServerResult> {
  try {
    const data = await collectMobileCompatData()
    const json = JSON.stringify(data)
    const body = encodeWebDavFile(json, buildWebDavKey(config))
    log.i(`[WebDAV] 上传: JSON ${(new TextEncoder().encode(json).length / 1024).toFixed(1)}KB, 密文 ${(body.length / 1024).toFixed(1)}KB`)
    if (body.length > MAX_UPLOAD_BYTES) {
      return { success: false, error: `数据量过大（${(body.length / 1024 / 1024).toFixed(1)}MB），请减少词库或图片后重试` }
    }

    const resp = await fetch(webDavFileUrl(config), {
      method: 'PUT',
      headers: {
        Authorization: buildAuthHeader(config),
        'Content-Type': 'application/octet-stream',
      },
      body,
    })
    if (!resp.ok) {
      return { success: false, error: explainHttpError(resp.status) }
    }
    log.i('[WebDAV] 备份完成')
    return { success: true }
  } catch (e) {
    log.e('[WebDAV] 备份失败', e)
    return { success: false, error: explainNetworkError(e) }
  }
}

/** 恢复：GET 网盘文件 → 解密 → 按 id 合并到本地 */
export async function downloadFromWebDav(
  config: WebDavConfig,
  options?: Partial<RestoreOptions>,
): Promise<RestoreResult> {
  const empty: RestoreResult = {
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
  try {
    const resp = await fetch(webDavFileUrl(config), {
      method: 'GET',
      headers: { Authorization: buildAuthHeader(config) },
    })
    if (!resp.ok) {
      return { ...empty, errors: [explainHttpError(resp.status)] }
    }
    const body = await resp.text()

    let mobileData: MobileCompatSyncData
    try {
      mobileData = JSON.parse(decodeWebDavFile(body, buildWebDavKey(config)))
    } catch {
      return { ...empty, errors: ['解密失败：应用密码与备份时不一致，或文件已损坏'] }
    }
    if (!Array.isArray(mobileData.banks)) {
      return { ...empty, errors: ['文件内容不是有效的同步数据'] }
    }

    const syncData = convertMobileCompatToSyncData(mobileData)
    return restoreSyncData(syncData, { ...DEFAULT_RESTORE_OPTIONS, ...options })
  } catch (e) {
    log.e('[WebDAV] 恢复失败', e)
    return { ...empty, errors: [explainNetworkError(e)] }
  }
}
