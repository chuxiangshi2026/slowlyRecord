// @vitest-environment jsdom
/**
 * 同步服务器适配器（sync-server.ts）单元测试
 *
 * 覆盖：适配器单例管理、自定义/默认适配器的 uploadRaw / downloadRaw / ping 行为，
 * 以及 fetchWithTimeout 的超时中止链路。fetch 与日志按模块边界替换，不触网。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const logger = vi.hoisted(() => ({
  log: { d: vi.fn(), i: vi.fn(), w: vi.fn(), e: vi.fn() },
}))

vi.mock('@/utils/logger', () => logger)

import {
  getSyncServerAdapter,
  resetSyncServer,
  setSyncServerUrl,
} from './sync-server'

const CUSTOM_BASE = 'https://sync.example.test'
// 与 sync-server.ts 中未导出的 DEFAULT_SERVER_BASE 保持一致
const DEFAULT_BASE = 'https://1258475269-6fkx3oixct.ap-guangzhou.tencentscf.com'
// 与 sync-server.ts 中未导出的 SYNC_FETCH_TIMEOUT_MS 保持一致
const TIMEOUT_MS = 30000

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init.headers || {}) },
  })
}

function stubFetch() {
  const fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('SyncServerAdapter 适配器管理', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetSyncServer()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    resetSyncServer()
  })

  it('setSyncServerUrl 后 getSyncServerAdapter 复用同一个自定义实例', () => {
    setSyncServerUrl(CUSTOM_BASE)

    const first = getSyncServerAdapter()
    const second = getSyncServerAdapter()

    expect(first).toBe(second)
  })

  it('setSyncServerUrl 后的请求打到自定义地址', async () => {
    setSyncServerUrl(CUSTOM_BASE)
    const fetchMock = stubFetch()
    fetchMock.mockResolvedValueOnce(jsonResponse({ code: 'blob-1' }))

    await getSyncServerAdapter().uploadRaw('cipher')

    expect(fetchMock.mock.calls[0][0]).toBe(`${CUSTOM_BASE}/sync`)
  })

  it('resetSyncServer 后换成新的默认实例，且请求打到默认 CloudBase 地址', async () => {
    setSyncServerUrl(CUSTOM_BASE)
    const custom = getSyncServerAdapter()

    resetSyncServer()
    const fallback = getSyncServerAdapter()

    expect(fallback).not.toBe(custom)

    const fetchMock = stubFetch()
    fetchMock.mockResolvedValueOnce(jsonResponse({ code: 'blob-1' }))
    await fallback.uploadRaw('cipher')

    expect(fetchMock.mock.calls[0][0]).toBe(`${DEFAULT_BASE}/sync`)
  })
})

describe('CustomServerAdapter.uploadRaw', () => {
  let adapter: ReturnType<typeof getSyncServerAdapter>

  beforeEach(() => {
    vi.clearAllMocks()
    setSyncServerUrl(CUSTOM_BASE)
    adapter = getSyncServerAdapter()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    resetSyncServer()
  })

  it('兼容 code / id / key 三种同步码字段', async () => {
    const fetchMock = stubFetch()
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ code: 'from-code' }))
      .mockResolvedValueOnce(jsonResponse({ id: 'from-id' }))
      .mockResolvedValueOnce(jsonResponse({ key: 'from-key' }))

    await expect(adapter.uploadRaw('a')).resolves.toBe('from-code')
    await expect(adapter.uploadRaw('b')).resolves.toBe('from-id')
    await expect(adapter.uploadRaw('c')).resolves.toBe('from-key')
  })

  it('以 POST + JSON 上传加密载荷', async () => {
    const fetchMock = stubFetch()
    fetchMock.mockResolvedValueOnce(jsonResponse({ code: 'blob-1' }))

    await adapter.uploadRaw('payload')

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe(`${CUSTOM_BASE}/sync`)
    expect(options.method).toBe('POST')
    expect(options.headers).toEqual({ 'Content-Type': 'application/json' })
    expect(options.body).toBe(JSON.stringify({ e: 'payload' }))
    expect(options.signal).toBeInstanceOf(AbortSignal)
  })

  it('响应缺少同步码时抛错', async () => {
    const fetchMock = stubFetch()
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }))

    await expect(adapter.uploadRaw('payload')).rejects.toThrow('服务器未返回有效的同步码')
  })

  it('非 2xx 时抛上传失败并带上状态码', async () => {
    const fetchMock = stubFetch()
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 500, statusText: 'Server Error' }))

    await expect(adapter.uploadRaw('payload')).rejects.toThrow('上传失败: 500 Server Error')
  })

  it('上传成功后写 info 日志', async () => {
    const fetchMock = stubFetch()
    fetchMock.mockResolvedValueOnce(jsonResponse({ code: 'blob-1' }))

    await adapter.uploadRaw('payload')

    expect(logger.log.i).toHaveBeenCalledWith('加密数据已上传到自定义服务器, code:', 'blob-1')
  })
})

describe('CustomServerAdapter.downloadRaw', () => {
  let adapter: ReturnType<typeof getSyncServerAdapter>

  beforeEach(() => {
    vi.clearAllMocks()
    setSyncServerUrl(CUSTOM_BASE)
    adapter = getSyncServerAdapter()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    resetSyncServer()
  })

  it('200 且返回 e 字段时取出密文', async () => {
    const fetchMock = stubFetch()
    fetchMock.mockResolvedValueOnce(jsonResponse({ e: 'cipher' }))

    await expect(adapter.downloadRaw('blob-1')).resolves.toBe('cipher')

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe(`${CUSTOM_BASE}/sync/blob-1`)
    expect(options.method).toBe('GET')
  })

  it('404 时返回 null 并提示数据不存在或已过期', async () => {
    const fetchMock = stubFetch()
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 404, statusText: 'Not Found' }))

    await expect(adapter.downloadRaw('blob-1')).resolves.toBeNull()
    expect(logger.log.w).toHaveBeenCalledWith('同步数据不存在或已过期')
  })

  it('500 时内部兜底返回 null 并记录错误', async () => {
    const fetchMock = stubFetch()
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 500, statusText: 'Server Error' }))

    await expect(adapter.downloadRaw('blob-1')).resolves.toBeNull()
    expect(logger.log.e).toHaveBeenCalledWith(
      '从自定义服务器下载失败',
      expect.objectContaining({ message: '下载失败: 500 Server Error' }),
    )
  })

  it('200 但缺少 e 字段时返回 null 并记录格式异常', async () => {
    const fetchMock = stubFetch()
    fetchMock.mockResolvedValueOnce(jsonResponse({ data: 'unexpected' }))

    await expect(adapter.downloadRaw('blob-1')).resolves.toBeNull()
    expect(logger.log.e).toHaveBeenCalledWith('自定义服务器返回数据格式异常')
  })

  it('fetch 直接 reject 时返回 null 并记录错误', async () => {
    const fetchMock = stubFetch()
    fetchMock.mockRejectedValueOnce(new Error('network down'))

    await expect(adapter.downloadRaw('blob-1')).resolves.toBeNull()
    expect(logger.log.e).toHaveBeenCalledWith('从自定义服务器下载失败', expect.any(Error))
  })
})

describe('CustomServerAdapter.ping', () => {
  let adapter: ReturnType<typeof getSyncServerAdapter>

  beforeEach(() => {
    vi.clearAllMocks()
    setSyncServerUrl(CUSTOM_BASE)
    adapter = getSyncServerAdapter()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    resetSyncServer()
  })

  it('响应 ok 时返回 true', async () => {
    const fetchMock = stubFetch()
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }))

    await expect(adapter.ping()).resolves.toBe(true)
    expect(fetchMock.mock.calls[0][0]).toBe(`${CUSTOM_BASE}/ping`)
  })

  it('响应非 ok 时返回 false', async () => {
    const fetchMock = stubFetch()
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 503, statusText: 'Unavailable' }))

    await expect(adapter.ping()).resolves.toBe(false)
  })

  it('fetch reject 时返回 false', async () => {
    const fetchMock = stubFetch()
    fetchMock.mockRejectedValueOnce(new Error('network down'))

    await expect(adapter.ping()).resolves.toBe(false)
  })
})

describe('fetchWithTimeout 超时链路', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setSyncServerUrl(CUSTOM_BASE)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    resetSyncServer()
  })

  /** 挂起的 fetch：只有 signal abort 时才 reject，模拟网络黑洞 */
  function hangingFetch(onSignal: (signal: AbortSignal) => void) {
    const fetchMock = vi.fn((_url: string, options: RequestInit) => {
      const signal = options.signal!
      onSignal(signal)
      return new Promise<Response>((_resolve, reject) => {
        signal.addEventListener('abort', () => {
          reject(new DOMException('The operation was aborted.', 'AbortError'))
        })
      })
    })
    vi.stubGlobal('fetch', fetchMock)
  }

  it('达到超时后 abort 挂起的请求，ping 落成 false', async () => {
    vi.useFakeTimers()
    const adapter = getSyncServerAdapter()
    let signal: AbortSignal | undefined
    hangingFetch((s) => { signal = s })

    const pending = adapter.ping()
    expect(signal!.aborted).toBe(false)

    await vi.advanceTimersByTimeAsync(TIMEOUT_MS)

    expect(signal!.aborted).toBe(true)
    await expect(pending).resolves.toBe(false)
  })

  it('达到超时后 uploadRaw 的请求被中止并 reject', async () => {
    vi.useFakeTimers()
    const adapter = getSyncServerAdapter()
    let signal: AbortSignal | undefined
    hangingFetch((s) => { signal = s })

    const pending = adapter.uploadRaw('payload')
    const assertion = expect(pending).rejects.toThrow(/abort/i)
    await vi.advanceTimersByTimeAsync(TIMEOUT_MS)

    expect(signal!.aborted).toBe(true)
    await assertion
  })
})

describe('DefaultServerAdapter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetSyncServer()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    resetSyncServer()
  })

  it('uploadRaw 打到默认地址并返回同步码', async () => {
    const fetchMock = stubFetch()
    fetchMock.mockResolvedValueOnce(jsonResponse({ code: 'default-blob' }))

    await expect(getSyncServerAdapter().uploadRaw('payload')).resolves.toBe('default-blob')

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe(`${DEFAULT_BASE}/sync`)
    expect(options.method).toBe('POST')
    expect(logger.log.i).toHaveBeenCalledWith('加密数据已上传, code:', 'default-blob')
  })

  it('downloadRaw 404 时返回 null 并提示过期', async () => {
    const fetchMock = stubFetch()
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 404, statusText: 'Not Found' }))

    await expect(getSyncServerAdapter().downloadRaw('blob-1')).resolves.toBeNull()

    expect(fetchMock.mock.calls[0][0]).toBe(`${DEFAULT_BASE}/sync/blob-1`)
    expect(logger.log.w).toHaveBeenCalledWith('同步数据不存在或已过期')
  })
})
