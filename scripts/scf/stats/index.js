/**
 * 慢记统计采集函数（腾讯云函数 SCF + 函数 URL）
 *
 * 只做一件事：校验事件格式后写一行 JSON 日志（console.log → 函数日志主题 CLS）。
 * 不存库、不读库、不记录请求方 IP。数据由本地脚本 scripts/pull-stats-logs.mjs 定期拉取分析。
 *
 * 部署步骤（控制台，约 5 分钟）：
 * 1. 云函数控制台 → 新建 → 从头开始：函数名 slowrecord-stats，运行时 Nodejs18/20，空白模板
 * 2. 把本文件内容整体粘贴进在线编辑器（入口 main_handler），部署
 * 3. 函数配置 → 触发器 → 开启「函数 URL」（公网访问、免鉴权），记下 URL 回填 src/config.ts 的 STATS_ENDPOINT
 * 4. 日志配置：确认已开启日志投递到 CLS（新建函数默认开启），记下 日志集/主题 ID 供拉取脚本使用
 * 5. CLS 主题留存期当前设 7 天（压存储费；漏拉超过一周数据即丢失，
 *    数据量涨上来或需要容错时可在 CLS 控制台改回 30 天，成本几乎无感）
 *
 * 与同步函数分开部署、分开日志主题，避免数据混杂。
 */
'use strict'

const MAX_BODY = 32 * 1024
// 事件名形如 word.add / page.view / translation.batch，最多 4 段
const NAME_RE = /^[a-z][a-z0-9]*(\.[a-z0-9_]+){1,3}$/
const PLATFORMS = new Set(['utools', 'electron', 'web'])

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*', // 采集接口无凭据，file://(Origin: null) 与 https 页面均可直发
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
}

function reply(statusCode, obj) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    body: JSON.stringify(obj),
  }
}

/** data 字段收口：只留 string/number，总量 ≤2KB，防止恶意大字段刷日志存储 */
function sanitizeData(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return undefined
  const out = {}
  let size = 0
  for (const [k, v] of Object.entries(data)) {
    if (typeof v !== 'string' && typeof v !== 'number') continue
    const key = String(k).slice(0, 40)
    const val = typeof v === 'string' ? v.slice(0, 500) : v
    size += key.length + String(val).length
    if (size > 2048) break
    out[key] = val
  }
  return Object.keys(out).length ? out : undefined
}

exports.main_handler = async (event) => {
  // 函数 URL / API 网关触发均为 HTTP 事件格式
  const method = String(event.httpMethod || event.requestContext?.http?.method || '').toUpperCase()
  if (method === 'OPTIONS') return { statusCode: 204, headers: CORS_HEADERS, body: '' }
  if (method !== 'POST') return reply(405, { ok: false })

  const raw = typeof event.body === 'string' ? event.body : ''
  if (!raw || raw.length > MAX_BODY) return reply(413, { ok: false })

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
    data: sanitizeData(evt.data),
  }
  // [stats] 前缀用于拉取时过滤冷启动等系统日志行
  console.log('[stats] ' + JSON.stringify(record))
  return reply(200, { ok: true })
}
