/**
 * 坚果云等 WebDAV 网盘同步（移动端）
 *
 * 与桌面端 src/utils/sync-webdav.ts 共用同一文件格式，两端可互传：
 *   固定路径 {网盘地址}/slowlyRecord-sync.enc（WebDAV 根目录，必然存在，
 *   避免使用微信小程序不支持的 MKCOL 建目录）
 *   内容 = base64( XOR( pako压缩( MobileSyncData JSON ), 凭据密钥 ) )
 * 加密密钥由凭据派生（账号:应用密码），两台设备凭据相同即可互通，无需同步码。
 * 传输只用 GET / PUT——wx.request 不支持 PROPFIND/MKCOL。
 *
 * 微信小程序需先把 https://dav.jianguoyun.com 配进 request 合法域名。
 */

import {
  base64ToUint8Array,
  bytesToUtf8,
  collectSyncData,
  uint8ArrayToBase64,
  utf8ToBytes,
  xorCrypt,
  type PushPayload,
  type RestoreResult,
  type SyncResult,
} from './sync'
import { applyTranslationSettings } from '@/stores/useUtils/translation-settings'
import { log } from '../../../utils/logger'

export interface WebDavConfig {
  url: string
  username: string
  password: string
}

/** 坚果云 WebDAV 固定地址（预设值，可改其他 WebDAV 服务） */
export const NUTSTORE_WEBDAV_URL = 'https://dav.jianguoyun.com/dav/'

const FILE_NAME = 'slowlyRecord-sync.enc'
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024

const K_URL = 'slowly_webdav_url'
const K_USER = 'slowly_webdav_username'
const K_PASS = 'slowly_webdav_password'

export function getWebDavConfig(): WebDavConfig {
  return {
    url: uni.getStorageSync(K_URL) || NUTSTORE_WEBDAV_URL,
    username: uni.getStorageSync(K_USER) || '',
    password: uni.getStorageSync(K_PASS) || '',
  }
}

/** 凭据只存本机 storage，不上传到任何地方（与翻译 API key 同级） */
export function saveWebDavConfig(cfg: WebDavConfig): void {
  uni.setStorageSync(K_URL, cfg.url.trim())
  uni.setStorageSync(K_USER, cfg.username.trim())
  uni.setStorageSync(K_PASS, cfg.password.trim())
}

export function isWebDavConfigured(): boolean {
  const cfg = getWebDavConfig()
  return !!(cfg.url.trim() && cfg.username.trim() && cfg.password.trim())
}

function fileUrl(cfg: WebDavConfig): string {
  return `${cfg.url.trim().replace(/\/+$/, '')}/${FILE_NAME}`
}

function authHeader(cfg: WebDavConfig): string {
  return `Basic ${uint8ArrayToBase64(utf8ToBytes(`${cfg.username}:${cfg.password}`))}`
}

function explainStatus(status: number): string {
  if (status === 401 || status === 403) return '账号或应用密码错误（填的是「应用密码」，不是登录密码）'
  if (status === 404) return '网盘上还没有同步数据（首次使用请先备份）'
  if (status === 507) return '网盘空间不足'
  return `网盘返回错误（${status}）`
}

/** 测试连接：GET 同步文件；200=已有备份，404=连接正常但首次使用 */
export function testWebDavConnection(cfg: WebDavConfig): Promise<{ ok: boolean; message: string }> {
  return new Promise((resolve) => {
    uni.request({
      url: fileUrl(cfg),
      method: 'GET',
      header: { Authorization: authHeader(cfg) },
      success: (res) => {
        if (res.statusCode === 200) resolve({ ok: true, message: '连接成功，网盘上已有同步数据' })
        else if (res.statusCode === 404) resolve({ ok: true, message: '连接成功（网盘上暂无数据，首次使用请先备份）' })
        else resolve({ ok: false, message: explainStatus(res.statusCode) })
      },
      fail: (err) => resolve({ ok: false, message: `连接失败：${err.errMsg || '网络错误'}（小程序端需先配置 request 合法域名）` }),
    })
  })
}

/** 备份到网盘：与服务器推送共用同一套数据收集 */
export async function pushToWebDav(cfg: WebDavConfig, payload: PushPayload): Promise<SyncResult> {
  try {
    const data = collectSyncData(payload)
    const json = JSON.stringify(data)
    const pako = (await import('pako')).default
    const compressed = pako.deflate(utf8ToBytes(json))
    const body = uint8ArrayToBase64(xorCrypt(compressed, `${cfg.username}:${cfg.password}`))
    log.i(`[WebDAV] 上传: JSON ${(utf8ToBytes(json).length / 1024).toFixed(1)}KB, 密文 ${(body.length / 1024).toFixed(1)}KB`)
    if (body.length > MAX_UPLOAD_BYTES) {
      return { success: false, error: `数据量过大（${(body.length / 1024 / 1024).toFixed(1)}MB），请减少词库或图片后重试` }
    }

    return await new Promise((resolve) => {
      uni.request({
        url: fileUrl(cfg),
        method: 'PUT',
        header: { Authorization: authHeader(cfg), 'Content-Type': 'application/octet-stream' },
        data: body,
        success: (res) => {
          if (res.statusCode >= 200 && res.statusCode < 300) resolve({ success: true })
          else resolve({ success: false, error: explainStatus(res.statusCode) })
        },
        fail: (err) => resolve({ success: false, error: `上传失败：${err.errMsg || '网络错误'}` }),
      })
    })
  } catch (e) {
    return { success: false, error: String(e) }
  }
}

/** 从网盘恢复：返回结构与 pullFromServer 一致，复用页面上的 applyPullResult */
export function pullFromWebDav(cfg: WebDavConfig): Promise<RestoreResult> {
  return new Promise((resolve) => {
    uni.request({
      url: fileUrl(cfg),
      method: 'GET',
      header: { Authorization: authHeader(cfg) },
      success: async (res) => {
        if (res.statusCode !== 200) {
          resolve({ success: false, error: explainStatus(res.statusCode) })
          return
        }
        try {
          const body = typeof res.data === 'string' ? res.data : String(res.data || '')
          const pako = (await import('pako')).default
          const compressed = xorCrypt(base64ToUint8Array(body.trim()), `${cfg.username}:${cfg.password}`)
          const data = JSON.parse(bytesToUtf8(pako.inflate(compressed)))
          if (!Array.isArray(data.banks)) {
            resolve({ success: false, error: '文件内容不是有效的同步数据' })
            return
          }
          if (data.userSettings) {
            applyTranslationSettings(data.userSettings)
          }
          resolve({
            success: true,
            banks: data.banks,
            textMemory: data.textMemory,
            numberMemory: data.numberMemory,
            knowledgeMemory: data.knowledgeMemory,
            phoneticMemory: data.phoneticMemory,
            signin: data.signin,
            memoryPalace: data.memoryPalace,
            sentences: data.sentences,
          })
        } catch {
          resolve({ success: false, error: '解密失败：应用密码与备份时不一致，或文件已损坏' })
        }
      },
      fail: (err) => resolve({ success: false, error: `下载失败：${err.errMsg || '网络错误'}` }),
    })
  })
}
