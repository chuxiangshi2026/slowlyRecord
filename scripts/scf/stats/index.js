/**
 * 慢记统计采集函数（腾讯云函数 SCF + 函数 URL）
 *
 * 2026-11-28 起：本函数只做「转发」，不再把事件写进 CLS。
 * 旧客户端仍请求 https://stats.slowrecap.cn/collect，函数校验后把事件
 * POST 到 CVM 本机 collector（默认 https://mp.slowrecap.cn/collect），
 * 由 collector 追加本地 JSONL；客户端无需升级即可完成切换。
 *
 * 重要：SCF 平台仍会把每次调用的 START/END/REPORT 投递到 CLS，
 * 部署本文件后必须在「函数配置 → 日志配置」关闭日志投递，
 * 否则日志服务（CLS）费用不会停止。
 *
 * 数据收口（与客户端 src/utils/stats.ts 共同约定）：
 * - data 字段按事件名白名单过滤（DATA_KEY_WHITELIST），不在名单内的键直接丢弃；
 *   白名单外的事件只保留 label/value 两个分类标签/计数字段
 * - 单值 ≤500 字符、data 总量 ≤2KB、请求体 ≤32KB，事件名/平台/版本/安装 ID/路径均做类型与长度校验
 * - 用户输入文本、词库内容、翻译/OCR 原文、密钥、堆栈、文件路径等一律不进入白名单
 * - CORS 为 Access-Control-Allow-Origin: * 且不返回 Allow-Credentials：请求无凭据，
 *   uTools/Electron 插件页是 file://（Origin: null），只能放行 *；绝不携带 cookie/认证信息
 *
 * 成本保护：函数实例内滑动窗口限流（每实例 120 req/min，超限 429）。
 * ponytail: 每实例独立计数，多实例并发时总配额随实例数线性放大——单实例内防刷够用，
 * 如需全局防刷/更强成本保护，应在 API 网关层加规则，不要在函数内引入账号体系。
 *
 * 部署步骤（控制台，约 5 分钟）：
 * 1. 云函数控制台 → 找到 slowrecord-stats（运行时 Nodejs18/20）
 * 2. 把本文件内容整体粘贴进在线编辑器（入口 main_handler），部署
 * 3. 函数配置 → 环境变量：可选 STATS_FORWARD_URL 覆盖转发地址（默认 https://mp.slowrecap.cn/collect）
 * 4. 函数配置 → 日志配置 → 关闭日志投递（停止 CLS 计费；不关闭则只减少业务日志，平台日志仍会计费）
 * 5. 自定义域名 stats.slowrecap.cn 保持绑定，旧客户端继续可用
 *
 * 与同步函数分开部署、分开日志主题，避免数据混杂。
 */
'use strict'

const https = require('node:https')

const MAX_BODY = 32 * 1024
const FORWARD_URL = process.env.STATS_FORWARD_URL || 'https://mp.slowrecap.cn/collect'
const FORWARD_TIMEOUT_MS = 5000
// 事件名形如 word.add / page.view / translation.batch，最多 4 段
const NAME_RE = /^[a-z][a-z0-9]*(\.[a-z0-9_]+){1,3}$/
const PLATFORMS = new Set(['utools', 'electron', 'web'])

// 每类事件允许进入 data 的字段白名单（客户端与服务端共同收口，名单外的键直接丢弃）。
// feedback 是用户主动提交渠道，允许短文本与可选联系方式（客户端已分别截断 500/100 字符）；
// bug.error 只允许脱敏后的短消息与运行时标识；app.launch / source.landing 为启动与归因元数据。
const DATA_KEY_WHITELIST = {
  'feedback.submit': new Set(['text', 'contact']),
  'bug.error': new Set(['source', 'message', 'clientVersion', 'runtime', 'errorName']),
  'app.launch': new Set(['clientVersion', 'source', 'landingPage']),
  'source.landing': new Set(['source', 'page']),
}
// 其余常规事件（page.view / word.add / translation.* 等）只允许分类标签与计数值
const DEFAULT_DATA_KEYS = new Set(['label', 'value'])

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*', // 采集接口无凭据，file://(Origin: null) 与 https 页面均可直发
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
}

// 最小成本保护：单实例滑动窗口限流（每实例每 60 秒 RATE_LIMIT_PER_MIN 个请求，超限 429）
const RATE_LIMIT_PER_MIN = 120
const reqTimestamps = []
function allowRequest() {
  const now = Date.now()
  while (reqTimestamps.length && now - reqTimestamps[0] > 60_000) reqTimestamps.shift()
  if (reqTimestamps.length >= RATE_LIMIT_PER_MIN) return false
  reqTimestamps.push(now)
  return true
}

function reply(statusCode, obj) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    body: JSON.stringify(obj),
  }
}

/**
 * data 字段收口：按事件名白名单过滤 + 只留 string/number，
 * 单值 ≤500 字符、总量 ≤2KB，防止恶意大字段刷日志存储
 */
function sanitizeData(name, data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return undefined
  const allowed = DATA_KEY_WHITELIST[name] || DEFAULT_DATA_KEYS
  const out = {}
  let size = 0
  for (const [k, v] of Object.entries(data)) {
    if (!allowed.has(k)) continue
    if (typeof v !== 'string' && typeof v !== 'number') continue
    const key = String(k).slice(0, 40)
    const val = typeof v === 'string' ? v.slice(0, 500) : v
    size += key.length + String(val).length
    if (size > 2048) break
    out[key] = val
  }
  return Object.keys(out).length ? out : undefined
}

/** 取客户端真实 IP，转发给 CVM 侧按 IP 限流；SCF 头部大小写不固定 */
function clientIp(event) {
  const headers = event.headers || {}
  for (const key of Object.keys(headers)) {
    const lower = key.toLowerCase()
    if (lower === 'x-real-ip' || lower === 'x-forwarded-for') {
      const ip = String(headers[key] || '').split(',')[0].trim()
      if (ip) return ip
    }
  }
  return ''
}

/** 把事件转发到 CVM collector；只转发脱敏后的记录，不转发原始请求体 */
function forward(record, ip) {
  return new Promise((resolve) => {
    let url
    try {
      url = new URL(FORWARD_URL)
    } catch {
      resolve({ statusCode: 500, body: '{"ok":false}' })
      return
    }
    const body = JSON.stringify(record)
    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
    }
    if (ip) headers['X-Real-IP'] = ip
    const req = https.request(
      {
        hostname: url.hostname,
        port: url.port || 443,
        path: url.pathname,
        method: 'POST',
        headers,
        timeout: FORWARD_TIMEOUT_MS,
      },
      (res) => {
        let text = ''
        res.setEncoding('utf8')
        res.on('data', (c) => { text += c })
        res.on('end', () => resolve({ statusCode: res.statusCode || 502, body: text || '{"ok":false}' }))
      },
    )
    req.on('timeout', () => req.destroy(new Error('forward timeout')))
    req.on('error', () => resolve({ statusCode: 502, body: '{"ok":false}' }))
    req.end(body)
  })
}

exports.main_handler = async (event) => {
  // 函数 URL / API 网关触发均为 HTTP 事件格式
  const method = String(event.httpMethod || event.requestContext?.http?.method || '').toUpperCase()
  if (method === 'OPTIONS') return { statusCode: 204, headers: CORS_HEADERS, body: '' }
  if (method !== 'POST') return reply(405, { ok: false })
  if (!allowRequest()) return reply(429, { ok: false })

  let raw = typeof event.body === 'string' ? event.body : ''
  if (!raw || raw.length > MAX_BODY) return reply(413, { ok: false })
  if (event.isBase64Encoded) {
    try { raw = Buffer.from(raw, 'base64').toString('utf8') } catch { return reply(400, { ok: false }) }
  }

  let evt
  try { evt = JSON.parse(raw) } catch { return reply(400, { ok: false }) }

  if (!NAME_RE.test(typeof evt.name === 'string' ? evt.name : '')) return reply(400, { ok: false })

  const record = {
    ts: Number.isFinite(evt.ts) ? Number(evt.ts) : Date.now(),
    name: evt.name,
    url: String(evt.url || '').slice(0, 200),
    platform: PLATFORMS.has(evt.platform) ? evt.platform : 'unknown',
    appVersion: String(evt.appVersion || '').slice(0, 32),
    installId: String(evt.installId || '').slice(0, 64),
    data: sanitizeData(evt.name, evt.data),
  }

  const result = await forward(record, clientIp(event))
  // 不打印事件内容；转发失败只记一行错误，避免把业务数据写进平台日志
  if (result.statusCode < 200 || result.statusCode >= 300) {
    console.error('[stats] 转发失败:', result.statusCode)
  }
  return {
    statusCode: result.statusCode,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    body: result.body,
  }
}
