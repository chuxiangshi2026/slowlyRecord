/**
 * OCR 语言包按需下载单测
 * 覆盖：eng 内置直通、gzip 解压、IndexedDB 缓存命中、CDN 失败报错、未注册语言
 * 网络用 vi.stubGlobal 拦截 fetch，IndexedDB 用 fake-indexeddb
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import 'fake-indexeddb/auto'

// gzip 压缩工具（Node 18+ 有 zlib）
import { gzipSync } from 'node:zlib'

vi.mock('@/adapters/platform', () => ({ isUtools: () => false }))
// mock uTools storage（lsGet/lsPut 兜底缓存走 getDbStorage）
const lsStore = new Map<string, string>()
vi.mock('@/adapters/db', () => ({
  getDbStorage: () => ({
    getItem: (k: string) => lsStore.get(k) ?? null,
    setItem: (k: string, v: string) => { lsStore.set(k, v) },
  }),
}))

// lang 名 → profile.ocrLang 走 lang-core（test-setup 已注入）
import { ensureTrainedData, needsLangPack } from './ocr-lang-pack'

function gzipBytes(data: Uint8Array): Uint8Array {
  return new Uint8Array(gzipSync(Buffer.from(data)))
}

const RAW = new TextEncoder().encode('FAKE-TRAINEDDATA-CONTENT')

function mockFetchOnce(body: Uint8Array | null, ok = true, status = 200) {
  const fetchMock = vi.fn(async () => {
    if (body === null) return new Response(null, { status })
    const resp = new Response(new Blob([new Uint8Array(body)]), { status: ok ? 200 : status })
    // 补 content-length 让实现走流式分支
    Object.defineProperty(resp, 'headers', {
      value: new Headers({ 'content-length': String(body.length) }),
    })
    return resp
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

beforeEach(async () => {
  vi.unstubAllGlobals()
  lsStore.clear()
  // 用例隔离：彻底删除缓存库再让实现自己建 store
  // （不能预创建空库：实现以 version 1 打开，空库存在时 onupgradeneeded 不触发，
  //   traineddata store 缺失会导致缓存静默失效）
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase('SlowlyRecord_OCR_LangPack')
    req.onsuccess = () => resolve()
    req.onerror = () => resolve()
    req.onblocked = () => resolve()
    setTimeout(resolve, 500) // 兜底：防止挂起
  })
})

describe('ocr-lang-pack', () => {
  it('needsLangPack：eng false，其他 true', () => {
    expect(needsLangPack('en')).toBe(false)
    expect(needsLangPack('ja')).toBe(true)
    expect(needsLangPack('ru')).toBe(true)
  })

  it('ensureTrainedData(eng) 直接返回 null（走内置文件）', async () => {
    const fetchMock = mockFetchOnce(null)
    expect(await ensureTrainedData('en')).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('未注册下载地址的语言返回 null', async () => {
    const result = await ensureTrainedData('de' as any)
    expect(result).toBeNull()
  })

  it('下载 gzip 语言包并解压返回原始字节', async () => {
    const gz = gzipBytes(RAW)
    const fetchMock = mockFetchOnce(gz)
    const result = await ensureTrainedData('ja')
    expect(result).not.toBeNull()
    expect(new TextDecoder().decode(result!)).toBe('FAKE-TRAINEDDATA-CONTENT')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(String(fetchMock.mock.calls[0][0])).toContain('jpn.traineddata.gz')
  })

  it('第二次调用命中缓存（不再发请求）', async () => {
    const gz = gzipBytes(RAW)
    const fetchMock = mockFetchOnce(gz)
    await ensureTrainedData('ja')
    const second = await ensureTrainedData('ja')
    expect(second).not.toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(1) // 缓存命中
  })

  it('HTTP 失败抛错', async () => {
    mockFetchOnce(null, false, 404)
    await expect(ensureTrainedData('ja')).rejects.toThrow(/下载失败/)
  })

  it('下载进度回调被调用', async () => {
    const gz = gzipBytes(RAW)
    mockFetchOnce(gz)
    const onProgress = vi.fn()
    await ensureTrainedData('ja', { onProgress })
    expect(onProgress).toHaveBeenCalled()
    expect(onProgress.mock.calls.at(-1)![0]).toBe(1)
  })
})
