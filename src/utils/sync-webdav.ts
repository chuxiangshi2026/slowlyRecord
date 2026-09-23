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
 *   内容 = base64( XOR( pako压缩( 同步数据 JSON ), 凭据密钥 ) )
 *   内层 JSON 的 version 字段标识格式：完整 SyncData（SYNC_VERSION，四模块齐全）
 *   或旧 MobileCompatSyncData（version:1，无快捷键/字母映射等模块）。
 *   恢复时按 version 分流：完整格式直通 restoreSyncData，旧格式先经 convertMobileCompatToSyncData 转换。
 *   采用 XOR 而非 AES-GCM 是因为微信小程序没有 WebCrypto，XOR 是两端唯一共同可用的
 *   对称方案（与现有移动端服务器同步的加密强度一致）；文件存于用户私有网盘，
 *   威胁模型仅为「网盘侧不可读」。
 *
 * 传输仅使用 GET / PUT，不用 PROPFIND/MKCOL：
 * 微信小程序 wx.request 不支持这两个方法，文件固定在 WebDAV 根目录，根目录必然存在。
 */

import pako from 'pako'
import type { SyncData, SyncServerResult } from '@/types/sync'
import { SYNC_VERSION } from '@/types/sync'
import { collectSyncData, DEFAULT_RESTORE_OPTIONS, restoreSyncData, type RestoreOptions, type RestoreResult } from '@/utils/sync-manager'
import {
  base64ToUint8Array,
  convertMobileCompatToSyncData,
  uint8ArrayToBase64,
  xorCrypt,
  type MobileCompatSyncData,
} from '@/utils/sync-server'

/** 同步请求超时：网络黑洞时 fetch 永不落定，同步状态机会卡死在 uploading/downloading 只能重启 */
const SYNC_FETCH_TIMEOUT_MS = 30000

function fetchWithTimeout(url: string, options: RequestInit = {}): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), SYNC_FETCH_TIMEOUT_MS)
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer))
}
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

/** 规范化网盘地址并拼出同步文件的完整 URL（路径逐段编码，支持中文子文件夹） */
export function webDavFileUrl(config: WebDavConfig): string {
  return encodeWebDavPath(`${normalizeWebDavUrl(config.url)}${FILE_NAME}`)
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

/**
 * 上传时的错误翻译：PUT 会自动创建文件，返回 404/409 只可能是父目录不存在
 * （地址填错，或填了网盘里还没创建的子文件夹），不能沿用下载的「请先备份」提示
 */
function explainUploadError(status: number, url: string): string {
  if (status === 404 || status === 409) {
    return `网盘目录不存在（HTTP ${status}）：实际请求 ${maskUrl(url)}。坚果云请填 https://dav.jianguoyun.com/dav/（可点「恢复默认地址」，同步文件会自动创建在根目录）；自建子文件夹需先在网盘中创建`
  }
  return explainHttpError(status)
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
    const resp = await fetchWithTimeout(webDavFileUrl(config), {
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

/** 诊断单步结果 */
export interface WebDavCheck {
  step: string
  /** HTTP 状态码；请求抛错（网络/跨域）时为 null */
  status: number | null
  detail?: string
}

export interface WebDavDiagnosis {
  dir: string
  fileUrl: string
  checks: WebDavCheck[]
  /** 结论（一句中文，直接展示给用户） */
  verdict: string
  /** 能读（认证通过且目录可见） */
  canRead: boolean
  /** 能写（探针文件创建成功） */
  canWrite: boolean
}

/** 诊断版本：改诊断逻辑时递增，便于确认用户跑的是哪一版（旧版报告会少几行） */
const DIAG_VERSION = '3（1字节+64KB探针，含响应正文）'

/** 探针文件名：诊断可写性用，用完即删，避免污染用户数据 */
const PROBE_FILE = 'slowlyRecord-probe.txt'

/** 探针体积约 64KB：小请求能过、大请求被代理/网关拦的情况靠它区分 */
const PROBE_BODY = 'slowlyRecord-webdav-probe'.repeat(2600)

/**
 * 诊断结论（纯函数，便于测试）：
 * 认证通过但写被拒 → 多半是应用密码只读/账号权限或流量受限，而非地址问题
 */
export function buildWebDavVerdict(checks: WebDavCheck[]): { verdict: string; canRead: boolean; canWrite: boolean } {
  const find = (step: string) => checks.find(c => c.step === step)
  const propfind = find('PROPFIND 目录')
  const get = find('GET 备份文件')
  const tinyPut = find('PUT 探针（1 字节）')
  const bigPut = find('PUT 探针（64KB）')
  const put = bigPut ?? tinyPut
  const ok = (c?: WebDavCheck) => c?.status === 201 || c?.status === 204
  const networkFailed = checks.some(c => c.status === null)

  const authed = propfind?.status === 207 || propfind?.status === 200
    || get?.status === 200 || get?.status === 404
    || put?.status === 201 || put?.status === 204
  if (!authed) {
    if (networkFailed) {
      return { verdict: '请求未能到达网盘（网络或跨域拦截），请检查网络与代理设置', canRead: false, canWrite: false }
    }
    const s = propfind?.status ?? get?.status ?? put?.status
    if (s === 401 || s === 403) {
      return { verdict: '认证失败：账号或应用密码不正确（注意要用「应用密码」，不是登录密码）', canRead: false, canWrite: false }
    }
    return { verdict: `无法确认网盘可用性（HTTP ${s ?? '未知'}），请把本页内容发给开发者`, canRead: false, canWrite: false }
  }

  const canWrite = ok(tinyPut) || ok(bigPut)
  if (ok(tinyPut) && !ok(bigPut)) {
    return {
      verdict: `网盘能创建小文件（1 字节成功），但 64KB 上传被拒（HTTP ${bigPut?.status ?? '未执行'}）——说明不是账号权限问题，而是请求体积或中间层（系统代理 / 公司网关 / MITM）拦截。请关闭代理后重试，或把本页内容发给开发者`,
      canRead: true,
      canWrite: true,
    }
  }
  if (canWrite) {
    return { verdict: '读写均正常（含 64KB 探针）。若正式备份仍失败，问题多半在请求体积或中间层，请把本页内容发给开发者', canRead: true, canWrite: true }
  }
  const putStatus = put?.status ?? '未执行'
  return {
    verdict: `认证通过、目录可读，且服务端 OPTIONS 声明支持 PUT（${find('OPTIONS 目录')?.status === 200 ? '已确认' : '未确认'}），但连 1 字节文件都创建不了（PUT 返回 ${putStatus}）。这属于账号侧写权限限制：请在坚果云「账户信息 → 安全选项 → 第三方应用管理」确认该应用密码是「读写」而非「只读」，并检查「流量明细」中本月上传流量是否已用尽`,
    canRead: true,
    canWrite: false,
  }
}

/** 逐步诊断 WebDAV：OPTIONS → PROPFIND → GET → PUT 探针 → DELETE 探针，逐项返回状态码 */
export async function diagnoseWebDav(config: WebDavConfig): Promise<WebDavDiagnosis> {
  const dir = normalizeWebDavUrl(config.url)
  const file = webDavFileUrl(config)
  const auth = buildAuthHeader(config)
  const checks: WebDavCheck[] = []

  const probe = async (
    step: string,
    url: string,
    init: { method: string; headers?: Record<string, string>; body?: string },
    detailFrom?: (r: Response) => string,
  ): Promise<Response | null> => {
    try {
      const resp = await fetchWithTimeout(url, { ...init, headers: { Authorization: auth, ...(init.headers || {}) } })
      let detail = detailFrom ? detailFrom(resp) : undefined
      // 错误响应的正文往往写明原因（如坚果云的权限/配额提示），抓下来便于定位
      if (!detail && resp.status >= 400) {
        try {
          const body = await resp.text()
          if (body) detail = `响应正文：${body.replace(/\s+/g, ' ').slice(0, 200)}`
        } catch {
          // 读正文失败不影响诊断
        }
      }
      checks.push({ step, status: resp.status, detail })
      return resp
    } catch (e) {
      checks.push({ step, status: null, detail: String(e).slice(0, 120) })
      return null
    }
  }

  await probe('OPTIONS 目录', dir, { method: 'OPTIONS' }, r => r.headers.get('allow') || r.headers.get('dav') || '')
  await probe('PROPFIND 目录', dir, { method: 'PROPFIND', headers: { Depth: '0' } })
  await probe('PROPFIND 目录（含子项）', dir, { method: 'PROPFIND', headers: { Depth: '1' } })
  await probe('GET 备份文件', file, { method: 'GET' })
  const probeUrl = `${dir}${PROBE_FILE}`
  // 先用 1 字节探针判断「能不能写」，再用 64KB 探针区分是否被体积/中间层限制
  const tinyResp = await probe('PUT 探针（1 字节）', probeUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: 'ping',
  })
  const created = tinyResp !== null && (tinyResp.status === 201 || tinyResp.status === 204)
  const bigResp = await probe('PUT 探针（64KB）', probeUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: PROBE_BODY,
  })
  if (created || (bigResp !== null && (bigResp.status === 201 || bigResp.status === 204))) {
    await probe('DELETE 探针文件', probeUrl, { method: 'DELETE' })
  }

  const { verdict, canRead, canWrite } = buildWebDavVerdict(checks)
  return { dir, fileUrl: file, checks, verdict, canRead, canWrite }
}

/** 诊断结果排版成可复制的文本（纯函数，便于测试） */
export function formatWebDavDiagnosis(d: WebDavDiagnosis): string {
  const lines = [
    '【WebDAV 诊断】',
    `诊断版本：${DIAG_VERSION}`,
    `目录：${d.dir}`,
    `文件：${d.fileUrl}`,
    ...d.checks.map(c => `${c.step}：${c.status === null ? '请求失败' : `HTTP ${c.status}`}${c.detail ? `（${c.detail}）` : ''}`),
    `结论：${d.verdict}`,
  ]
  return lines.join('\n')
}

/** 备份：收集全量数据（完整 SyncData 格式，四模块齐全）→ 加密打包 → PUT 到网盘 */
export async function uploadToWebDav(config: WebDavConfig): Promise<SyncServerResult> {
  try {
    const data = await collectSyncData()
    const json = JSON.stringify(data)
    const body = encodeWebDavFile(json, buildWebDavKey(config))
    log.i(`[WebDAV] 上传: JSON ${(new TextEncoder().encode(json).length / 1024).toFixed(1)}KB, 密文 ${(body.length / 1024).toFixed(1)}KB`)
    if (body.length > MAX_UPLOAD_BYTES) {
      return { success: false, error: `数据量过大（${(body.length / 1024 / 1024).toFixed(1)}MB），请减少词库或图片后重试` }
    }

    const resp = await fetchWithTimeout(webDavFileUrl(config), {
      method: 'PUT',
      headers: {
        Authorization: buildAuthHeader(config),
        'Content-Type': 'application/octet-stream',
      },
      body,
    })
    if (!resp.ok) {
      return { success: false, error: explainUploadError(resp.status, webDavFileUrl(config)) }
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
    const resp = await fetchWithTimeout(webDavFileUrl(config), {
      method: 'GET',
      headers: { Authorization: buildAuthHeader(config) },
    })
    if (!resp.ok) {
      return { ...empty, errors: [explainHttpError(resp.status)] }
    }
    const body = await resp.text()

    // 解密解包：内层 JSON 的 version 字段区分格式
    // - version === SYNC_VERSION 且 wordBanks 为数组 → 完整 SyncData，直通 restoreSyncData
    // - 其他（version:1 的 MobileCompatSyncData）→ 旧备份，先转换再还原
    let parsed: SyncData | MobileCompatSyncData
    try {
      parsed = JSON.parse(decodeWebDavFile(body, buildWebDavKey(config)))
    } catch {
      return { ...empty, errors: ['解密失败：应用密码与备份时不一致，或文件已损坏'] }
    }

    const restoreOpts = { ...DEFAULT_RESTORE_OPTIONS, ...options }
    if (parsed.version === SYNC_VERSION && Array.isArray((parsed as SyncData).wordBanks)) {
      return restoreSyncData(parsed as SyncData, restoreOpts)
    }

    const mobileData = parsed as MobileCompatSyncData
    if (!Array.isArray(mobileData.banks)) {
      return { ...empty, errors: ['文件内容不是有效的同步数据'] }
    }
    const syncData = convertMobileCompatToSyncData(mobileData)
    return restoreSyncData(syncData, restoreOpts)
  } catch (e) {
    log.e('[WebDAV] 恢复失败', e)
    return { ...empty, errors: [explainNetworkError(e)] }
  }
}
