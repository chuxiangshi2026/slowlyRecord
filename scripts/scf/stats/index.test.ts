/**
 * 统计采集云函数（scripts/scf/stats/index.js）单元测试
 * 以 CommonJS 语义执行 handler 源码（仓库 type:module，直接 require 会被当 ESM），
 * mock API 网关 HTTP 事件；每次重新加载以重置模块内限流窗口
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const SRC = readFileSync(fileURLToPath(new URL('./index.js', import.meta.url)), 'utf8')

let handler: (event: any) => Promise<any>

beforeEach(() => {
  const moduleObj = { exports: {} as any }
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  new Function('exports', 'module', 'require', SRC)(moduleObj.exports, moduleObj, () => { throw new Error('not used') })
  handler = moduleObj.exports.main_handler
})

afterEach(() => {
  vi.restoreAllMocks()
})

function httpEvent(method: string, body = '') {
  return { httpMethod: method, body }
}

function post(evt: object) {
  return httpEvent('POST', JSON.stringify(evt))
}

/** 取 [stats] 日志行解析出的记录 */
function loggedRecords(): any[] {
  return (console.log as any).mock.calls
    .map((c: any[]) => String(c[0]))
    .filter((line: string) => line.startsWith('[stats] '))
    .map((line: string) => JSON.parse(line.slice('[stats] '.length)))
}

describe('统计采集函数（scripts/scf/stats）', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  it('OPTIONS 返回 204 与 CORS 头；非 POST 返回 405', async () => {
    const opt = await handler(httpEvent('OPTIONS'))
    expect(opt.statusCode).toBe(204)
    expect(opt.headers['Access-Control-Allow-Origin']).toBe('*')
    expect(opt.headers['Access-Control-Allow-Methods']).toContain('POST')

    const get = await handler(httpEvent('GET'))
    expect(get.statusCode).toBe(405)
  })

  it('CORS 不带 Allow-Credentials（无凭据全开放，file:// Origin:null 可直发）', async () => {
    const opt = await handler(httpEvent('OPTIONS'))
    expect(opt.headers['Access-Control-Allow-Credentials']).toBeUndefined()
  })

  it('非法 JSON / 非法事件名 / 空体 / 超大体分别返回 400 / 400 / 413 / 413', async () => {
    expect((await handler(httpEvent('POST', '{not-json'))).statusCode).toBe(400)
    expect((await handler(post({ name: 'UPPER.CASE', url: '/', platform: 'web', appVersion: 't', installId: 'i', ts: 0 }))).statusCode).toBe(400)
    expect((await handler(httpEvent('POST', ''))).statusCode).toBe(413)
    expect((await handler(httpEvent('POST', 'x'.repeat(33 * 1024)))).statusCode).toBe(413)
  })

  it('合法事件 200 并落 [stats] 日志：公共字段带类型与长度收口', async () => {
    const res = await handler(post({
      name: 'page.view', url: '/word'.padEnd(300, 'x'), platform: 'utools',
      appVersion: '1.2.3'.padEnd(40, 'x'), installId: 'id-1', ts: 123,
    }))
    expect(res.statusCode).toBe(200)
    const rec = loggedRecords()[0]
    expect(rec.name).toBe('page.view')
    expect(rec.url.length).toBe(200) // 截断
    expect(rec.platform).toBe('utools')
    expect(rec.appVersion.length).toBe(32) // 截断
    expect(rec.installId).toBe('id-1')
    expect(rec.ts).toBe(123)
  })

  it('未知平台归一为 unknown；非法 ts 回落服务端时间', async () => {
    await handler(post({ name: 'page.view', url: '/', platform: 'ios', appVersion: '', installId: '', ts: 'bad' }))
    const rec = loggedRecords()[0]
    expect(rec.platform).toBe('unknown')
    expect(rec.ts).toEqual(expect.any(Number))
  })

  it('常规事件 data 白名单：仅 label/value 保留，用户内容/密钥等键被丢弃', async () => {
    await handler(post({
      name: 'word.add', url: '/Word', platform: 'utools', appVersion: '1', installId: 'i', ts: 0,
      data: { label: 'ok', value: 2, word: '用户单词', meaning: '释义', apiKey: 'sk-xxx', stack: 'at ...' },
    }))
    expect(loggedRecords()[0].data).toEqual({ label: 'ok', value: 2 })
  })

  it('bug.error data 白名单：脱敏消息与运行时标识保留，堆栈等被丢弃', async () => {
    await handler(post({
      name: 'bug.error', url: '/', platform: 'web', appVersion: '1', installId: 'i', ts: 0,
      data: { message: 'boom', source: 'js', clientVersion: '8.0', runtime: '120', errorName: 'Error', stack: '...', extra: 1 },
    }))
    expect(loggedRecords()[0].data).toEqual({ message: 'boom', source: 'js', clientVersion: '8.0', runtime: '120', errorName: 'Error' })
  })

  it('feedback.submit data 白名单：text/contact 保留，其余键被丢弃', async () => {
    await handler(post({
      name: 'feedback.submit', url: '/', platform: 'utools', appVersion: '1', installId: 'i', ts: 0,
      data: { text: '你好', contact: 'qq:1', installId: 'other', label: 'x' },
    }))
    expect(loggedRecords()[0].data).toEqual({ text: '你好', contact: 'qq:1' })
  })

  it('data 非 string/number 值（对象/数组/嵌套）被丢弃，单值截断 500 字符，总量超限截断', async () => {
    await handler(post({
      name: 'word.add', url: '/', platform: 'utools', appVersion: '1', installId: 'i', ts: 0,
      data: { label: 'y'.repeat(600), value: { nested: true }, arr: [1, 2] },
    }))
    const data = loggedRecords()[0].data
    expect(data.label.length).toBe(500)
    expect(data.value).toBeUndefined()
    expect(data.arr).toBeUndefined()
  })

  it('data 与请求体之外的字段不进入日志记录', async () => {
    await handler(post({
      name: 'page.view', url: '/', platform: 'utools', appVersion: '1', installId: 'i', ts: 0,
      data: { label: 'a' }, userAgent: 'Mozilla/5.0', ip: '1.2.3.4', cookie: 'sid=1', headers: { secret: 'x' },
    }))
    const rec = loggedRecords()[0]
    expect(rec.userAgent).toBeUndefined()
    expect(rec.ip).toBeUndefined()
    expect(rec.cookie).toBeUndefined()
    expect(rec.headers).toBeUndefined()
  })

  it('实例限流：第 121 个请求返回 429', async () => {
    const evt = post({ name: 'page.view', url: '/', platform: 'web', appVersion: '1', installId: 'i', ts: 0 })
    let last: any
    for (let n = 0; n < 120; n++) last = await handler(evt)
    expect(last.statusCode).toBe(200)
    expect((await handler(evt)).statusCode).toBe(429)
  })
})
