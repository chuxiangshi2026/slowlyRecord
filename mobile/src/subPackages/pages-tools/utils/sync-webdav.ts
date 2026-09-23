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

import pako from 'pako'
import {
  base64ToUint8Array,
  buildRestoreResult,
  bytesToUtf8,
  collectSyncData,
  uint8ArrayToBase64,
  utf8ToBytes,
  xorCrypt,
  type MobileSyncData,
  type PushPayload,
  type RestoreResult,
  type SyncResult,
} from './sync'
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

/** 凭据只存本机 storage，不上传到任何地方（与翻译 API key 同级）；地址顺手规范化 */
export function saveWebDavConfig(cfg: WebDavConfig): void {
  uni.setStorageSync(K_URL, normalizeWebDavUrl(cfg.url))
  uni.setStorageSync(K_USER, cfg.username.trim())
  uni.setStorageSync(K_PASS, cfg.password.trim())
}

export function isWebDavConfigured(): boolean {
  const cfg = getWebDavConfig()
  return !!(cfg.url.trim() && cfg.username.trim() && cfg.password.trim())
}

/**
 * 规范化 WebDAV 地址（用户手填，容错常见笔误）：
 * - 去掉零宽字符、全角/半角空白、首尾误带的引号或尖括号
 * - 缺协议时补 https://
 * - 误把同步文件全路径粘进来时去掉文件名
 * - 坚果云只填了主机（dav.jianguoyun.com）时自动补 /dav/——否则 PUT 会打到不存在的集合，
 *   网盘返回 404/409，用户看到的却是「目录不存在」而无从下手
 * - 折叠重复斜杠并统一补尾部斜杠
 */
export function normalizeWebDavUrl(raw: string): string {
  let s = String(raw || '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[\s\u3000]+/g, '')
    .replace(/^[<"']+|[>"']+$/g, '')
  if (!s) return NUTSTORE_WEBDAV_URL
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`
  if (s.toLowerCase().endsWith(`/${FILE_NAME.toLowerCase()}`)) {
    s = s.slice(0, -(FILE_NAME.length + 1))
  }
  // 折叠重复斜杠（协议后的 // 不处理）
  s = s.replace(/([^:]\/)\/+/g, '$1')
  // 坚果云：只填主机或根路径都视为官方 DAV 根目录
  if (/^https?:\/\/dav\.jianguoyun\.com\/?$/i.test(s)) return NUTSTORE_WEBDAV_URL
  return s.endsWith('/') ? s : `${s}/`
}

/** 逐段 URL 编码路径（支持中文、含空格的子文件夹），保留协议与目录结构 */
function encodeWebDavPath(url: string): string {
  const m = /^(https?:\/\/[^/]+)(\/.*)?$/i.exec(url)
  if (!m) return url
  const path = m[2] || '/'
  return m[1] + path.split('/').map(seg => (seg ? encodeURIComponent(seg) : '')).join('/')
}

/** 展示用地址：抹掉可能被写进 URL 的账号密码 */
function maskUrl(url: string): string {
  return url.replace(/\/\/[^/@]+@/, '//***@')
}

function fileUrl(cfg: WebDavConfig): string {
  return encodeWebDavPath(`${normalizeWebDavUrl(cfg.url)}${FILE_NAME}`)
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

/** 上传时的错误翻译：PUT 会自动创建文件，404/409 只可能是父目录不存在（地址填错或子文件夹未创建） */
function explainPushStatus(status: number, url: string): string {
  if (status === 404 || status === 409) {
    return `网盘目录不存在（HTTP ${status}）：实际请求 ${maskUrl(url)}。坚果云请填 https://dav.jianguoyun.com/dav/（可点「默认地址」，同步文件会自动创建在根目录）；自建子文件夹需先在网盘中创建`
  }
  return explainStatus(status)
}

/** 诊断单步结果 */
export interface WebDavCheck {
  step: string
  /** HTTP 状态码；请求失败（网络/未配白名单）时为 null */
  status: number | null
  detail?: string
}

/** 探针文件名：诊断可写性用，用完即删，避免污染用户数据 */
const PROBE_FILE = 'slowlyRecord-probe.txt'

/** 探针体积约 64KB：小请求能过、大请求被网关拦的情况靠它区分 */
const PROBE_BODY = 'slowlyRecord-webdav-probe'.repeat(2600)

/** 单次请求并记录状态码（小程序不支持 PROPFIND/OPTIONS，只用 GET/PUT/DELETE） */
function requestOnce(cfg: WebDavConfig, url: string, method: string, data?: string): Promise<WebDavCheck> {
  return new Promise((resolve) => {
    uni.request({
      url,
      method: method as any,
      header: data
        ? { Authorization: authHeader(cfg), 'Content-Type': 'application/octet-stream' }
        : { Authorization: authHeader(cfg) },
      data,
      success: (res) => resolve({ step: '', status: res.statusCode }),
      fail: (err) => resolve({ step: '', status: null, detail: err.errMsg || '网络错误' }),
    })
  })
}

/** 诊断结论（纯函数，便于测试）：能读不能写通常是账号侧限制，而非地址问题 */
export function buildWebDavVerdict(checks: WebDavCheck[]): string {
  const find = (step: string) => checks.find(c => c.step === step)
  const get = find('GET 备份文件')
  const put = find('PUT 探针文件')
  if (checks.every(c => c.status === null)) {
    return '请求未能到达网盘：网络不可用，或该域名未加入微信后台的 request 合法域名'
  }
  if (put?.status === 201 || put?.status === 204) {
    return '读写均正常（探针约 64KB）。若正式备份仍失败，问题多半在请求体积或中间层，请把本页内容发给开发者'
  }
  if (get?.status === 401 || put?.status === 401) {
    return '认证失败：账号或应用密码不正确（注意要用「应用密码」，不是登录密码）'
  }
  const readable = get?.status === 200 || get?.status === 404
  if (readable) {
    return `认证通过、目录可读，但网盘拒绝创建文件（PUT 返回 ${put?.status ?? '未执行'}）。这种「能读不能写」通常是账号侧限制：应用密码被设为只读、或本月上传流量已用尽，请在坚果云「账户信息 → 安全选项 → 第三方应用管理 / 流量明细」中确认`
  }
  return `无法确认网盘可用性（GET ${get?.status ?? '未执行'} / PUT ${put?.status ?? '未执行'}），请把本页内容发给开发者`
}

/** 逐步诊断：GET 备份文件 → PUT 探针 → DELETE 探针，逐项返回状态码与结论 */
export async function diagnoseWebDav(cfg: WebDavConfig): Promise<{ checks: WebDavCheck[]; verdict: string; text: string }> {
  const dir = normalizeWebDavUrl(cfg.url)
  const file = fileUrl(cfg)
  const probeUrl = `${dir}${PROBE_FILE}`
  const checks: WebDavCheck[] = []

  const get = await requestOnce(cfg, file, 'GET')
  checks.push({ ...get, step: 'GET 备份文件' })

  const put = await requestOnce(cfg, probeUrl, 'PUT', PROBE_BODY)
  checks.push({ ...put, step: 'PUT 探针文件' })

  if (put.status === 201 || put.status === 204) {
    const del = await requestOnce(cfg, probeUrl, 'DELETE')
    checks.push({ ...del, step: 'DELETE 探针文件' })
  }

  const verdict = buildWebDavVerdict(checks)
  const text = [
    '【WebDAV 诊断】',
    `目录：${dir}`,
    `文件：${file}`,
    ...checks.map(c => `${c.step}：${c.status === null ? '请求失败' : `HTTP ${c.status}`}${c.detail ? `（${c.detail}）` : ''}`),
    `结论：${verdict}`,
  ].join('\n')
  return { checks, verdict, text }
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
          else resolve({ success: false, error: explainPushStatus(res.statusCode, fileUrl(cfg)) })
        },
        fail: (err) => resolve({ success: false, error: `上传失败：${err.errMsg || '网络错误'}` }),
      })
    })
  } catch (e) {
    return { success: false, error: String(e) }
  }
}

/**
 * 桌面端单词 → 移动端同步词条（与桌面端 convertDesktopWordToMobile 镜像，
 * 桌面词是 text/explains/learnDate 字段系，移动端是 word/meaning/addTime 字段系）
 */
function convertDesktopWord(w: any) {
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

/**
 * 把网盘上的备份统一成 MobileSyncData：
 * - 移动端备份：version:1 带 banks，原样返回
 * - 桌面端备份：完整 SyncData 带 wordBanks，词字段系转换后落到 banks
 * 其余模块（文本/数字/知识包/音标/打卡/宫殿/句子/墓碑）两端 wire format 一致，直通。
 */
function normalizePulledData(data: any): MobileSyncData | null {
  if (Array.isArray(data?.banks)) return data as MobileSyncData
  if (!Array.isArray(data?.wordBanks)) return null
  return {
    ...data,
    banks: data.wordBanks.map((bank: any) => ({
      id: bank.id,
      name: bank.name,
      words: (bank.words || []).map(convertDesktopWord),
    })),
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
          const compressed = xorCrypt(base64ToUint8Array(body.trim()), `${cfg.username}:${cfg.password}`)
          const data = normalizePulledData(JSON.parse(bytesToUtf8(pako.inflate(compressed))))
          if (!data) {
            resolve({ success: false, error: '文件内容不是有效的同步数据' })
            return
          }
          // 与服务器拉取共用同一入库处理：应用翻译设置 + 墓碑合并过滤
          resolve(await buildRestoreResult(data))
        } catch {
          resolve({ success: false, error: '解密失败：应用密码与备份时不一致，或文件已损坏' })
        }
      },
      fail: (err) => resolve({ success: false, error: `下载失败：${err.errMsg || '网络错误'}` }),
    })
  })
}
