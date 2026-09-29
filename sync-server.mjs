/**
 * SlowlyRecord 同步服务器 - 最简实现
 *
 * 部署方式（3 选 1）：
 *
 * 1. 独立 Node 服务：
 *    - node sync-server.mjs 启动（仅直接运行时启动，被 import 不会监听端口）
 *    - 默认监听 3000 端口（PORT 环境变量可改）
 *
 * 2. CloudBase 云函数 / Vercel Serverless：
 *    - import { main } from './sync-server.mjs' 作为云函数入口
 *    - Vercel：改文件名为 api/sync.ts（本文件为合法 ESM JS，天然是合法 TS），
 *      用 handleRequest 包一层 export default 即可（见文件末尾注释样例）
 *
 * API：
 *   POST   /sync       → 上传加密数据，返回 { code }（一次性，阅后即焚）
 *   GET    /sync/:code → 下载加密数据，返回 { e } 或 404（阅后即焚）
 *   DELETE /sync/:code → 删除数据
 *   GET    /ping       → 健康检查
 *
 * 注意：客户端已做 AES-256-GCM 加密，服务端只存密文，无需关心数据内容
 */

// ============ 存储层（可替换为 Redis/SQLite/MySQL） ============

/**
 * @typedef {{ e: string, createdAt: number }} SyncRecord
 */

/** 内存存储（重启丢失，适合临时同步） @type {Map<string, SyncRecord>} */
const store = new Map()

/** 数据过期时间（毫秒），默认 24 小时 */
const TTL = 24 * 60 * 60 * 1000

/** 清理过期数据 */
function cleanup() {
  const now = Date.now()
  for (const [code, record] of store) {
    const age = now - record.createdAt
    if (age > TTL) {
      store.delete(code)
    }
  }
}

// 每 10 分钟清理一次
setInterval(cleanup, 10 * 60 * 1000)

// ============ 生成同步码 ============

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  let code = ''
  const arr = new Uint8Array(8)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(arr)
  } else {
    for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256)
  }
  for (let i = 0; i < 8; i++) {
    code += chars[arr[i] % chars.length]
  }
  return code
}

// ============ HTTP 处理 ============

/** @param {any} req */
function jsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', (/** @type {Buffer} */ chunk) => { body += chunk.toString() })
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}) }
      catch { reject(new Error('Invalid JSON')) }
    })
    req.on('error', reject)
  })
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

/** @param {any} res @param {number} statusCode @param {any} data */
function jsonResponse(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    ...CORS_HEADERS,
  })
  res.end(JSON.stringify(data))
}

/**
 * 处理 HTTP 请求（与框架无关）
 * @param {string} method
 * @param {string} path
 * @param {any} [body]
 * @returns {Promise<{ status: number, data: any }>}
 */
export async function handleRequest(method, path, body) {
  // CORS preflight
  if (method === 'OPTIONS') {
    return { status: 204, data: null }
  }

  // GET /ping
  if (method === 'GET' && path === '/ping') {
    return { status: 200, data: { ok: true } }
  }

  // POST /sync - 上传（阅后即焚）
  if (method === 'POST' && path === '/sync') {
    if (!body || !body.e) {
      return { status: 400, data: { error: 'Missing encrypted data' } }
    }

    const code = generateCode()
    store.set(code, { e: body.e, createdAt: Date.now() })

    console.log(`[sync] uploaded, code=${code}, size=${body.e.length}`)
    return { status: 200, data: { code } }
  }

  // GET /sync/:code - 下载（阅后即焚）
  const getMatch = path.match(/^\/sync\/([A-Za-z0-9_-]+)$/)
  if (method === 'GET' && getMatch) {
    const code = getMatch[1]
    const record = store.get(code)

    if (!record) {
      return { status: 404, data: { error: 'Not found or expired' } }
    }

    // 阅后即焚
    store.delete(code)
    console.log(`[sync] downloaded and deleted, code=${code}`)

    return { status: 200, data: { e: record.e } }
  }

  // DELETE /sync/:code - 手动删除
  const deleteMatch = path.match(/^\/sync\/([A-Za-z0-9_-]+)$/)
  if (method === 'DELETE' && deleteMatch) {
    const code = deleteMatch[1]
    store.delete(code)
    console.log(`[sync] deleted, code=${code}`)
    return { status: 200, data: { deleted: true } }
  }

  return { status: 404, data: { error: 'Not found' } }
}

// ============ 云函数入口（CloudBase 等） ============

export const main = async (/** @type {any} */ event) => {
  const { method, path, body } = event || {}
  const result = await handleRequest(method || 'GET', path || '/', body)
  return result.data
}

// ============ 独立 Node 服务（node sync-server.mjs 直接运行时启动） ============

import { createServer } from 'http'
import { pathToFileURL } from 'url'

async function startServer() {
  const PORT = process.env.PORT || 3000

  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url || '/', `http://localhost:${PORT}`)
      const body = req.method === 'POST' ? await jsonBody(req) : undefined
      const result = await handleRequest(req.method || 'GET', url.pathname, body)
      jsonResponse(res, result.status, result.data)
    } catch (e) {
      console.error('[sync] error', e)
      jsonResponse(res, 500, { error: 'Internal error' })
    }
  })

  server.listen(PORT, () => {
    console.log(`[sync] server listening on http://localhost:${PORT}`)
    console.log(`[sync] TTL = ${TTL / 1000 / 60 / 60} hours`)
  })
}

// 仅直接运行时启动（node sync-server.mjs）；被 import 作为模块时只暴露入口
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startServer()
}
