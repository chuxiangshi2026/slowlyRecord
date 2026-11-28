/**
 * 统计采集云函数（scripts/scf/stats/index.js）单元测试
 * 以 CommonJS 语义执行 handler 源码（仓库 type:module，直接 require 会被当 ESM），
 * mock node:https 捕获转发请求；每次重新加载以重置模块内限流窗口。
 * 2026-11-28 起函数只做转发：断言重点是「转发出去的脱敏记录」，而不是平台日志。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const SRC = readFileSync(fileURLToPath(new URL('./index.js', import.meta.url)), 'utf8')

interface Forwarded {
  hostname: string
  path: string
  headers: Record<string, string>
  body: any
}

let handler: (event: any) => Promise<any>
let forwarded: Forwarded[]
let forwardStatus: number
let forwardDown: boolean

/** 假 https 模块：记录转发内容，按 forwardStatus / forwardDown 控制响应 */
function buildMockHttps() {
  return {
    request(opts: any, cb: any) {
      const reqHandlers: Record<string, (arg?: any) => void> = {}
      const req = {
        on(ev: string, fn: (arg?: any) => void) {
          reqHandlers[ev] = fn
          return req
        },
        destroy(err?: Error) {
          reqHandlers.error?.(err)
        },
        end(body: string) {
          if (forwardDown) {
            reqHandlers.error?.(new Error('connection refused'))
            return
          }
          forwarded.push({ hostname: opts.hostname, path: opts.path, headers: opts.headers, body: JSON.parse(body) })
          const resHandlers: Record<string, (chunk?: string) => void> = {}
          const res = {
            statusCode: forwardStatus,
            setEncoding() {},
            on(ev: string, fn: (chunk?: string) => void) {
              resHandlers[ev] = fn
              if (ev === 'end') {
                queueMicrotask(() => {
                  resHandlers.data?.('{"ok":true}')
                  resHandlers.end?.()
                })
              }
              return res
            },
          }
          cb(res)
        },
      }
      return req
    },
  }
}

beforeEach(() => {
  forwarded = []
  forwardStatus = 200
  forwardDown = false
  const moduleObj = { exports: {} as any }
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  new Function('exports', 'module', 'require', SRC)(moduleObj.exports, moduleObj, (id: string) => {
    if (id === 'node:https') return buildMockHttps()
    throw new Error(`unexpected require: ${id}`)
  })
  handler = moduleObj.exports.main_handler
})

afterEach(() => {
  vi.restoreAllMocks()
})

function httpEvent(method: string, body = '', extra: object = {}) {
  return { httpMethod: method, body, ...extra }
}

function post(evt: object, extra: object = {}) {
  return httpEvent('POST', JSON.stringify(evt), extra)
}

describe('统计转发函数（scripts/scf/stats）', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  it('OPTIONS 返回 204 与 CORS 头；非 POST 返回 405，均不转发', async () => {
    const opt = await handler(httpEvent('OPTIONS'))
    expect(opt.statusCode).toBe(204)
    expect(opt.headers['Access-Control-Allow-Origin']).toBe('*')
    expect(opt.headers['Access-Control-Allow-Methods']).toContain('POST')

    const get = await handler(httpEvent('GET'))
    expect(get.statusCode).toBe(405)
    expect(forwarded).toHaveLength(0)
  })

  it('CORS 不带 Allow-Credentials（无凭据全开放，file:// Origin:null 可直发）', async () => {
    const opt = await handler(httpEvent('OPTIONS'))
    expect(opt.headers['Access-Control-Allow-Credentials']).toBeUndefined()
  })

  it('非法 JSON / 非法事件名 / 空体 / 超大体分别返回 400 / 400 / 413 / 413，均不转发', async () => {
    expect((await handler(httpEvent('POST', '{not-json'))).statusCode).toBe(400)
    expect((await handler(post({ name: 'UPPER.CASE', url: '/', platform: 'web', appVersion: 't', installId: 'i', ts: 0 }))).statusCode).toBe(400)
    expect((await handler(httpEvent('POST', ''))).statusCode).toBe(413)
    expect((await handler(httpEvent('POST', 'x'.repeat(33 * 1024)))).statusCode).toBe(413)
    expect(forwarded).toHaveLength(0)
  })

  it('合法事件 200 并转发脱敏记录：公共字段带类型与长度收口', async () => {
    const res = await handler(post({
      name: 'page.view', url: '/word'.padEnd(300, 'x'), platform: 'utools',
      appVersion: '1.2.3'.padEnd(40, 'x'), installId: 'id-1', ts: 123,
    }))
    expect(res.statusCode).toBe(200)
    expect(forwarded).toHaveLength(1)
    const fwd = forwarded[0]
    expect(fwd.hostname).toBe('mp.slowrecap.cn')
    expect(fwd.path).toBe('/collect')
    expect(fwd.headers['Content-Type']).toBe('application/json')
    expect(fwd.body.name).toBe('page.view')
    expect(fwd.body.url.length).toBe(200) // 截断
    expect(fwd.body.platform).toBe('utools')
    expect(fwd.body.appVersion.length).toBe(32) // 截断
    expect(fwd.body.installId).toBe('id-1')
    expect(fwd.body.ts).toBe(123)
  })

  it('isBase64Encoded 的请求体先解码再解析', async () => {
    const raw = JSON.stringify({ name: 'page.view', url: '/', platform: 'web', appVersion: '1', installId: 'i', ts: 1 })
    const res = await handler(httpEvent('POST', Buffer.from(raw).toString('base64'), { isBase64Encoded: true }))
    expect(res.statusCode).toBe(200)
    expect(forwarded[0].body.name).toBe('page.view')
  })

  it('未知平台归一为 unknown；非法 ts 回落服务端时间', async () => {
    await handler(post({ name: 'page.view', url: '/', platform: 'ios', appVersion: '', installId: '', ts: 'bad' }))
    const rec = forwarded[0].body
    expect(rec.platform).toBe('unknown')
    expect(rec.ts).toEqual(expect.any(Number))
  })

  it('常规事件 data 白名单：仅 label/value 保留，用户内容/密钥等键被丢弃', async () => {
    await handler(post({
      name: 'word.add', url: '/Word', platform: 'utools', appVersion: '1', installId: 'i', ts: 0,
      data: { label: 'ok', value: 2, word: '用户单词', meaning: '释义', apiKey: 'sk-xxx', stack: 'at ...' },
    }))
    expect(forwarded[0].body.data).toEqual({ label: 'ok', value: 2 })
  })

  it('bug.error data 白名单：脱敏消息与运行时标识保留，堆栈等被丢弃', async () => {
    await handler(post({
      name: 'bug.error', url: '/', platform: 'web', appVersion: '1', installId: 'i', ts: 0,
      data: { message: 'boom', source: 'js', clientVersion: '8.0', runtime: '120', errorName: 'Error', stack: '...', extra: 1 },
    }))
    expect(forwarded[0].body.data).toEqual({ message: 'boom', source: 'js', clientVersion: '8.0', runtime: '120', errorName: 'Error' })
  })

  it('feedback.submit data 白名单：text/contact 保留，其余键被丢弃', async () => {
    await handler(post({
      name: 'feedback.submit', url: '/', platform: 'utools', appVersion: '1', installId: 'i', ts: 0,
      data: { text: '你好', contact: 'qq:1', installId: 'other', label: 'x' },
    }))
    expect(forwarded[0].body.data).toEqual({ text: '你好', contact: 'qq:1' })
  })

  it('data 非 string/number 值（对象/数组/嵌套）被丢弃，单值截断 500 字符，总量超限截断', async () => {
    await handler(post({
      name: 'word.add', url: '/', platform: 'utools', appVersion: '1', installId: 'i', ts: 0,
      data: { label: 'y'.repeat(600), value: { nested: true }, arr: [1, 2] },
    }))
    const data = forwarded[0].body.data
    expect(data.label.length).toBe(500)
    expect(data.value).toBeUndefined()
    expect(data.arr).toBeUndefined()
  })

  it('data 与请求体之外的字段不进入转发记录', async () => {
    await handler(post({
      name: 'page.view', url: '/', platform: 'utools', appVersion: '1', installId: 'i', ts: 0,
      data: { label: 'a' }, userAgent: 'Mozilla/5.0', ip: '1.2.3.4', cookie: 'sid=1', headers: { secret: 'x' },
    }))
    const rec = forwarded[0].body
    expect(rec.userAgent).toBeUndefined()
    expect(rec.ip).toBeUndefined()
    expect(rec.cookie).toBeUndefined()
    expect(rec.headers).toBeUndefined()
  })

  it('透传客户端真实 IP（x-real-ip 优先，兼容大小写；缺失则不带头）', async () => {
    await handler(post(
      { name: 'page.view', url: '/', platform: 'web', appVersion: '1', installId: 'i', ts: 0 },
      { headers: { 'X-Real-IP': '203.0.113.9', 'x-forwarded-for': '198.51.100.1, 10.0.0.1' } },
    ))
    expect(forwarded[0].headers['X-Real-IP']).toBe('203.0.113.9')

    await handler(post({ name: 'page.view', url: '/', platform: 'web', appVersion: '1', installId: 'i', ts: 0 }))
    expect(forwarded[1].headers['X-Real-IP']).toBeUndefined()
  })

  it('转发失败返回 502，且错误日志不包含事件内容', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    forwardDown = true
    const res = await handler(post({
      name: 'bug.error', url: '/', platform: 'web', appVersion: '1', installId: 'i', ts: 0,
      data: { message: 'secret-user-content' },
    }))
    expect(res.statusCode).toBe(502)
    const logged = JSON.stringify(err.mock.calls)
    expect(logged).toContain('转发失败')
    expect(logged).not.toContain('secret-user-content')
  })

  it('上游非 2xx 原样返回状态码', async () => {
    forwardStatus = 429
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = await handler(post({ name: 'page.view', url: '/', platform: 'web', appVersion: '1', installId: 'i', ts: 0 }))
    expect(res.statusCode).toBe(429)
    expect(err).toHaveBeenCalled()
  })

  it('实例限流：第 121 个请求返回 429，且不转发', async () => {
    const evt = post({ name: 'page.view', url: '/', platform: 'web', appVersion: '1', installId: 'i', ts: 0 })
    let last: any
    for (let n = 0; n < 120; n++) last = await handler(evt)
    expect(last.statusCode).toBe(200)
    expect((await handler(evt)).statusCode).toBe(429)
    expect(forwarded).toHaveLength(120)
  })
})
