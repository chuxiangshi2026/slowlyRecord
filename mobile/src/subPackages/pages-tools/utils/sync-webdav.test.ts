/**
 * 移动端 WebDAV 同步（sync-webdav.ts）单元测试
 *
 * mock uni.request / uni.*StorageSync，对照桌面端 src/utils/sync-webdav.test.ts 的用例结构，
 * 聚焦验证：配置判断、连接测试状态码分支、上传/下载往返
 * （含网络错误、非 2xx、拉取 404 视为无备份）。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import pako from 'pako'
import {
  NUTSTORE_WEBDAV_URL,
  getWebDavConfig,
  isWebDavConfigured,
  pullFromWebDav,
  pushToWebDav,
  testWebDavConnection,
} from './sync-webdav'
import {
  base64ToUint8Array,
  bytesToUtf8,
  collectSyncData,
  uint8ArrayToBase64,
  utf8ToBytes,
  xorCrypt,
  type PushPayload,
} from './sync'

const cfg = { url: NUTSTORE_WEBDAV_URL, username: 'user@example.com', password: 'app-password' }
const key = `${cfg.username}:${cfg.password}`

function createMockUni() {
  const store = new Map<string, any>()
  const requestMock = vi.fn()
  const uniMock = {
    getStorageSync: vi.fn((k: string) => store.get(k) ?? ''),
    setStorageSync: vi.fn((k: string, v: any) => { store.set(k, v) }),
    removeStorageSync: vi.fn((k: string) => { store.delete(k) }),
    getStorageInfoSync: vi.fn(() => ({ keys: Array.from(store.keys()), currentSize: 0, limitSize: 10240 })),
    request: requestMock,
  }
  return { store, requestMock, uniMock }
}

let env: ReturnType<typeof createMockUni>

beforeEach(() => {
  env = createMockUni()
  ;(globalThis as any).uni = env.uniMock
})

/** 按坚果云 WebDAV 格式加密备份内容（pako 压缩 + XOR + base64） */
function encryptBackup(json: string): string {
  const compressed = pako.deflate(utf8ToBytes(json))
  return uint8ArrayToBase64(xorCrypt(compressed, key))
}

describe('isWebDavConfigured', () => {
  it('三项配置齐全时返回 true', () => {
    env.store.set('slowly_webdav_url', NUTSTORE_WEBDAV_URL)
    env.store.set('slowly_webdav_username', 'user@example.com')
    env.store.set('slowly_webdav_password', 'app-password')
    expect(isWebDavConfigured()).toBe(true)
  })

  it('存储为空（未配置）返回 false', () => {
    expect(isWebDavConfigured()).toBe(false)
  })

  it('缺少应用密码时返回 false', () => {
    env.store.set('slowly_webdav_url', NUTSTORE_WEBDAV_URL)
    env.store.set('slowly_webdav_username', 'user@example.com')
    expect(isWebDavConfigured()).toBe(false)
  })

  it('未配置地址时回退坚果云默认地址', () => {
    const c = getWebDavConfig()
    expect(c.url).toBe(NUTSTORE_WEBDAV_URL)
    expect(c.username).toBe('')
  })
})

describe('testWebDavConnection', () => {
  it('200 → 已有备份；404 → 连接正常但首次使用；401 → 凭据错误提示', async () => {
    env.requestMock.mockImplementationOnce((opts: any) => { opts.success({ statusCode: 200, data: '' }) })
    const ok = await testWebDavConnection(cfg)
    expect(ok.ok).toBe(true)
    expect(ok.message).toContain('已有同步数据')

    env.requestMock.mockImplementationOnce((opts: any) => { opts.success({ statusCode: 404, data: '' }) })
    const notFound = await testWebDavConnection(cfg)
    expect(notFound.ok).toBe(true)
    expect(notFound.message).toContain('首次使用')

    env.requestMock.mockImplementationOnce((opts: any) => { opts.success({ statusCode: 401, data: '' }) })
    const authed = await testWebDavConnection(cfg)
    expect(authed.ok).toBe(false)
    expect(authed.message).toContain('应用密码')
  })

  it('网络异常（如未配合法域名）给出可读提示', async () => {
    env.requestMock.mockImplementationOnce((opts: any) => { opts.fail({ errMsg: 'request:fail' }) })
    const result = await testWebDavConnection(cfg)
    expect(result.ok).toBe(false)
    expect(result.message).toContain('合法域名')
  })
})

describe('pushToWebDav', () => {
  it('PUT 到固定路径，带 Basic 认证头，body 可按凭据解密还原', async () => {
    let seen: any
    env.requestMock.mockImplementationOnce((opts: any) => {
      seen = opts
      opts.success({ statusCode: 201, data: '' })
    })

    const payload: PushPayload = { banks: [{ id: 'b1', name: '测试词库', words: [] }] }
    const result = await pushToWebDav(cfg, payload)
    expect(result.success).toBe(true)
    expect(seen.method).toBe('PUT')
    expect(seen.url).toBe(`${NUTSTORE_WEBDAV_URL}slowlyRecord-sync.enc`)
    expect(String(seen.header.Authorization)).toMatch(/^Basic /)

    const decoded = JSON.parse(bytesToUtf8(pako.inflate(xorCrypt(base64ToUint8Array(String(seen.data)), key))))
    expect(decoded.banks[0].name).toBe('测试词库')
  })

  it('401 时返回应用密码错误提示', async () => {
    env.requestMock.mockImplementationOnce((opts: any) => { opts.success({ statusCode: 401, data: '' }) })
    const result = await pushToWebDav(cfg, { banks: [] })
    expect(result.success).toBe(false)
    expect(result.error).toContain('应用密码')
  })

  it('507 时提示网盘空间不足', async () => {
    env.requestMock.mockImplementationOnce((opts: any) => { opts.success({ statusCode: 507, data: '' }) })
    const result = await pushToWebDav(cfg, { banks: [] })
    expect(result.success).toBe(false)
    expect(result.error).toContain('空间不足')
  })

  it('网络失败时提示上传失败', async () => {
    env.requestMock.mockImplementationOnce((opts: any) => { opts.fail({ errMsg: 'request:fail timeout' }) })
    const result = await pushToWebDav(cfg, { banks: [] })
    expect(result.success).toBe(false)
    expect(result.error).toContain('上传失败')
    expect(result.error).toContain('timeout')
  })
})

describe('pullFromWebDav', () => {
  it('404 → 失败并提示先备份（首次使用）', async () => {
    env.requestMock.mockImplementationOnce((opts: any) => { opts.success({ statusCode: 404, data: '' }) })
    const result = await pullFromWebDav(cfg)
    expect(result.success).toBe(false)
    expect(result.error).toContain('首次使用')
  })

  it('GET 固定路径，下载密文 → 解密解压 → 返回词库数据', async () => {
    const data = collectSyncData({
      banks: [{ id: 'b1', name: '测试词库', words: [{ word: 'hello' }] }],
    })
    const body = encryptBackup(JSON.stringify(data))

    let seen: any
    env.requestMock.mockImplementationOnce((opts: any) => {
      seen = opts
      opts.success({ statusCode: 200, data: body })
    })

    const result = await pullFromWebDav(cfg)
    expect(result.success).toBe(true)
    expect(seen.method).toBe('GET')
    expect(seen.url).toBe(`${NUTSTORE_WEBDAV_URL}slowlyRecord-sync.enc`)
    expect(String(seen.header.Authorization)).toMatch(/^Basic /)
    expect(result.banks?.[0].name).toBe('测试词库')
  })

  it('密文损坏时提示解密失败', async () => {
    env.requestMock.mockImplementationOnce((opts: any) => { opts.success({ statusCode: 200, data: 'not-valid-base64!!!' }) })
    const result = await pullFromWebDav(cfg)
    expect(result.success).toBe(false)
    expect(result.error).toContain('解密失败')
  })

  it('解密后缺少 banks 字段时提示不是有效的同步数据', async () => {
    env.requestMock.mockImplementationOnce((opts: any) => {
      opts.success({ statusCode: 200, data: encryptBackup(JSON.stringify({ hello: 1 })) })
    })
    const result = await pullFromWebDav(cfg)
    expect(result.success).toBe(false)
    expect(result.error).toContain('不是有效的同步数据')
  })

  it('网络失败时提示下载失败', async () => {
    env.requestMock.mockImplementationOnce((opts: any) => { opts.fail({ errMsg: 'request:fail' }) })
    const result = await pullFromWebDav(cfg)
    expect(result.success).toBe(false)
    expect(result.error).toContain('下载失败')
  })
})
