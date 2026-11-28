/**
 * 慢记统计采集函数（腾讯云函数 SCF + 函数 URL）
 *
 * 已弃用（2026-11-28）：统计采集已迁移到 CVM 本机 collector（mp.slowrecap.cn/collect），
 * 日志落 /var/lib/slowrecap-stats/events/*.jsonl，不再经过 SCF/CLS。
 * 本函数仅保留历史参考；请勿重新部署，并确认其日志投递已关闭，避免日志服务继续计费。
 *
 * 只做一件事：校验事件格式后写一行 JSON 日志（console.log → 函数日志主题 CLS）。
 * 不存库、不读库、不记录请求方 IP。数据由本地脚本 scripts/pull-stats-logs.mjs 定期拉取分析。
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
 * 1. 云函数控制台 → 新建 → 从头开始：函数名 slowrecord-stats，运行时 Nodejs18/20，空白模板
 * 2. 把本文件内容整体粘贴进在线编辑器（入口 main_handler），部署
 * 3. 函数配置 → 触发器 → 开启「函数 URL」（公网访问、免鉴权），记下 URL 回填 src/config.ts 的 STATS_ENDPOINT
 * 4. 日志配置：确认已开启日志投递到 CLS（新建函数默认开启），记下 日志集/主题 ID 供拉取脚本使用
 * 5. CLS 主题留存期当前设 7 天（压存储费；漏拉超过一周数据即丢失，
 *    数据量涨上来或需要容错时可在 CLS 控制台改回 30 天，成本几乎无感）
 * 6. 自定义域名（如 stats.slowrecap.cn 经 EdgeOne/网关反代到函数 URL）：域名侧配置 DNS 与反向代理，
 *    反代需原样转发方法、 body 与响应状态码（OPTIONS 204 / 405 / 400 / 413 / 429 行为都要保留）
 *
 * 与同步函数分开部署、分开日志主题，避免数据混杂。
 */
'use strict'

const MAX_BODY = 32 * 1024
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

exports.main_handler = async (event) => {
  // 函数 URL / API 网关触发均为 HTTP 事件格式
  const method = String(event.httpMethod || event.requestContext?.http?.method || '').toUpperCase()
  if (method === 'OPTIONS') return { statusCode: 204, headers: CORS_HEADERS, body: '' }
  if (method !== 'POST') return reply(405, { ok: false })
  if (!allowRequest()) return reply(429, { ok: false })

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
    data: sanitizeData(evt.name, evt.data),
  }
  // [stats] 前缀用于拉取时过滤冷启动等系统日志行
  console.log('[stats] ' + JSON.stringify(record))
  return reply(200, { ok: true })
}
