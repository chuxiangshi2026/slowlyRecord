#!/usr/bin/env node
/**
 * 统计日志拉取脚本：从 CLS 拉取云函数写入的 [stats] 日志行，落成本地 JSONL。
 *
 * 用法：
 *   TENCENT_SECRET_ID=xxx TENCENT_SECRET_KEY=xxx STATS_TOPIC_ID=xxxx \
 *     node scripts/pull-stats-logs.mjs [--since 7d] [--from 2026-11-01] [--to 2026-11-16]
 *
 * 环境变量：
 *   TENCENT_SECRET_ID / TENCENT_SECRET_KEY  CAM API 密钥（建议子账号，仅授 CLS 只读）
 *   STATS_TOPIC_ID      函数日志主题 ID（CLS 控制台查看）
 *   STATS_REGION        地域，默认 ap-guangzhou（与函数一致即可）
 *
 * 前置条件：日志主题需在 CLS 控制台开启「全文索引」（一键开启），否则检索不到日志。
 * 增量拉取：上次拉取时间记录在输出文件旁的 .last-pull 文件，默认从该时间继续；
 * 重复行按整行去重。输出默认 scripts/data/stats-events.jsonl。
 *
 * 密钥只经环境变量传入，不要写进任何文件。
 */
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const REGION = process.env.STATS_REGION || 'ap-guangzhou'
const TOPIC_ID = process.env.STATS_TOPIC_ID || ''
const SECRET_ID = process.env.TENCENT_SECRET_ID || ''
const SECRET_KEY = process.env.TENCENT_SECRET_KEY || ''

const OUT_FILE = path.resolve('scripts/data/stats-events.jsonl')
const STATE_FILE = OUT_FILE + '.last-pull'

// ===== 参数解析 =====
function parseArgs() {
  const args = process.argv.slice(2)
  const opt = { from: 0, to: Date.now() }
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--since') {
      const m = /^(\d+)([dhm])$/.exec(args[++i] || '')
      if (!m) throw new Error('--since 格式如 7d / 24h / 30m')
      const unit = { d: 86400000, h: 3600000, m: 60000 }[m[2]]
      opt.from = Date.now() - Number(m[1]) * unit
    } else if (args[i] === '--from') {
      opt.from = new Date(args[++i]).getTime()
    } else if (args[i] === '--to') {
      opt.to = new Date(args[++i]).getTime()
    }
  }
  if (!opt.from) {
    try { opt.from = Number(fs.readFileSync(STATE_FILE, 'utf8').trim()) || 0 } catch { /* 首次 */ }
  }
  if (!opt.from) opt.from = Date.now() - 7 * 86400000 // 默认最近 7 天
  return opt
}

// ===== 腾讯云 TC3-HMAC-SHA256 签名（标准流程，无 SDK 依赖） =====
function sha256hex(s) { return crypto.createHash('sha256').update(s, 'utf8').digest('hex') }
function hmac(key, s) { return crypto.createHmac('sha256', key).update(s, 'utf8').digest() }

function signedHeaders(payload) {
  const service = 'cls'
  const host = `cls.${REGION}.tencentcloudapi.com`
  const timestamp = Math.floor(Date.now() / 1000)
  const date = new Date(timestamp * 1000).toISOString().slice(0, 10)

  const canonicalRequest = ['POST', '/', '', `content-type:application/json; charset=utf-8\nhost:${host}\n`, 'content-type;host', sha256hex(payload)].join('\n')
  const credentialScope = `${date}/${service}/tc3_request`
  const stringToSign = ['TC3-HMAC-SHA256', timestamp, credentialScope, sha256hex(canonicalRequest)].join('\n')
  const secretSigning = hmac(hmac(hmac(`TC3${SECRET_KEY}`, date), service), 'tc3_request')
  const signature = crypto.createHmac('sha256', secretSigning).update(stringToSign, 'utf8').digest('hex')

  return {
    'Content-Type': 'application/json; charset=utf-8',
    'Host': host,
    'X-TC-Action': 'SearchLog',
    'X-TC-Version': '2020-10-16',
    'X-TC-Region': REGION,
    'X-TC-Timestamp': String(timestamp),
    'Authorization': `TC3-HMAC-SHA256 Credential=${SECRET_ID}/${credentialScope}, SignedHeaders=content-type;host, Signature=${signature}`,
  }
}

async function searchLog(from, to, context) {
  const payload = JSON.stringify({
    TopicId: TOPIC_ID, From: from, To: to,
    Query: '*', Limit: 100, Sort: 'asc', ...(context ? { Context: context } : {}),
  })
  const res = await fetch(`https://cls.${REGION}.tencentcloudapi.com/`, {
    method: 'POST', headers: signedHeaders(payload), body: payload,
  })
  const json = await res.json().catch(() => null)
  if (!res.ok || !json?.Response) throw new Error(`CLS 请求失败: HTTP ${res.status}`)
  if (json.Response.Error) throw new Error(`CLS ${json.Response.Error.Code}: ${json.Response.Error.Message}`)
  return json.Response
}

/** 从一条 CLS 日志内容里取出 [stats] 后的 JSON 记录；取不到返回 null（冷启动等系统行） */
function extractStatsRecord(content) {
  const text = typeof content === 'string' ? content : String(content?.content || '')
  const idx = text.indexOf('[stats] ')
  if (idx < 0) return null
  try { return JSON.parse(text.slice(idx + 8).trim()) } catch { return null }
}

async function main() {
  if (!SECRET_ID || !SECRET_KEY || !TOPIC_ID) {
    console.error('缺少环境变量：TENCENT_SECRET_ID / TENCENT_SECRET_KEY / STATS_TOPIC_ID')
    process.exit(1)
  }
  const { from, to } = parseArgs()
  console.error(`拉取区间: ${new Date(from).toISOString()} ~ ${new Date(to).toISOString()}`)

  const seen = new Set()
  try {
    for (const line of fs.readFileSync(OUT_FILE, 'utf8').split('\n')) if (line.trim()) seen.add(line.trim())
  } catch { /* 首次运行无文件 */ }

  let context = ''
  let total = 0, added = 0
  const out = fs.createWriteStream(OUT_FILE, { flags: 'a' })
  for (;;) {
    const resp = await searchLog(from, to, context)
    const results = resp.Results || []
    for (const item of results) {
      const rec = extractStatsRecord(item.Content ?? item.content)
      if (!rec) continue
      total++
      const line = JSON.stringify(rec)
      if (seen.has(line)) continue
      seen.add(line)
      out.write(line + '\n')
      added++
    }
    if (resp.ListOver || !resp.Context || results.length === 0) break
    context = resp.Context
  }
  await new Promise(r => out.end(r))
  fs.writeFileSync(STATE_FILE, String(to))
  console.error(`完成：扫描 ${total} 条统计事件，新增 ${added} 条，累计 ${seen.size} 条 → ${OUT_FILE}`)
}

main().catch(err => { console.error(err.message); process.exit(1) })
