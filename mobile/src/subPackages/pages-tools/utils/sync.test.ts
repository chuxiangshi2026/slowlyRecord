/**
 * 移动端同步服务（utils/sync.ts）墓碑透传与拉取过滤单元测试
 *
 * mock uni.request / uni.*StorageSync / DB 适配器，验证：
 * - collectSyncData 将 payload.tombstones 带入同步包
 * - pullFromServer 合并 payload.tombstones 到本地墓碑文档
 * - pullFromServer 按墓碑过滤入库词条（移动端双设备间删除不复活）
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import pako from 'pako'
import {
  collectSyncData,
  pullFromServer,
  utf8ToBytes,
  uint8ArrayToBase64,
  xorCrypt,
} from './sync'
import { setDbAdapter, resetDbAdapter, type DbAdapter } from '@/adapters/index'
import { getTombstones, TOMBSTONES_DOC_ID } from '@/stores/useUtils/sync-tombstone'

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

function createMockDbAdapter(): DbAdapter {
  const store = new Map<string, any>()
  let revCounter = 0

  function putDoc(doc: any) {
    const existing = store.get(doc._id)
    if (existing && doc._rev !== existing._rev) {
      return { id: doc._id, ok: false, error: true, message: 'conflict' }
    }
    const rev = `rev-${++revCounter}`
    store.set(doc._id, { ...doc, _rev: rev })
    return { id: doc._id, ok: true, rev }
  }

  return {
    get: vi.fn((id: string) => store.get(id) || null),
    put: vi.fn((doc: any) => putDoc(doc)),
    remove: vi.fn((doc: any) => {
      const id = typeof doc === 'string' ? doc : doc._id
      store.delete(id)
      return { id, ok: true }
    }),
    allDocs: vi.fn((prefix?: string) => {
      const docs = Array.from(store.values())
      return prefix ? docs.filter((d: any) => d._id.startsWith(prefix)) : docs
    }),
    bulkDocs: vi.fn((docs: any[]) => docs.map(doc => putDoc(doc))),
    promises: {
      get: vi.fn(async (id: string) => store.get(id) || null),
      put: vi.fn(async (doc: any) => putDoc(doc)),
      remove: vi.fn(async (doc: any) => {
        const id = typeof doc === 'string' ? doc : doc._id
        store.delete(id)
        return { id, ok: true }
      }),
      bulkDocs: vi.fn(async (docs: any[]) => docs.map(doc => putDoc(doc))),
      asyncPut: vi.fn(async (doc: any) => putDoc(doc)),
      asyncBulkDocs: vi.fn(async (docs: any[]) => docs.map(doc => putDoc(doc))),
    },
  }
}

let env: ReturnType<typeof createMockUni>

beforeEach(() => {
  env = createMockUni()
  ;(globalThis as any).uni = env.uniMock
  resetDbAdapter()
  setDbAdapter(createMockDbAdapter())
})

/** 用 XOR 通道构造服务端密文（pako 压缩 + XOR + base64），兼容无 WebCrypto 的测试环境 */
function encryptJson(json: string, key: string): string {
  const compressed = pako.deflate(utf8ToBytes(json))
  return uint8ArrayToBase64(xorCrypt(compressed, key))
}

function mockDownload(encrypted: string) {
  env.requestMock.mockImplementationOnce((opts: any) => {
    opts.success({ statusCode: 200, data: { e: encrypted } })
  })
}

describe('collectSyncData 墓碑透传', () => {
  it('payload 带 tombstones 时进入同步包', () => {
    const data = collectSyncData({
      banks: [],
      tombstones: { 'mobile_words_1': 1726579200000 },
    })
    expect(data.tombstones).toEqual({ 'mobile_words_1': 1726579200000 })
  })

  it('payload 不带 tombstones 时字段为空（JSON 序列化自动省略）', () => {
    const data = collectSyncData({ banks: [] })
    expect(data.tombstones).toBeUndefined()
  })
})

describe('pullFromServer 墓碑过滤', () => {
  const aesKey = 'test-sync-key-0123456789abcdef' // 32 字节

  it('payload 带墓碑时：合并进本地墓碑文档，被删词条被过滤', async () => {
    const now = Date.now()
    const payload = {
      version: 1,
      exportedAt: now,
      platform: 'mobile',
      banks: [{
        id: 'bank-1',
        name: '测试词库',
        words: [
          { id: 'mobile_words_w1', word: 'deleted', meaning: '已删', addTime: 1, reviewCount: 0, nextReviewTime: 1 },
          { id: 'mobile_words_w2', word: 'alive', meaning: '存活', addTime: 1, reviewCount: 0, nextReviewTime: 1 },
        ],
      }],
      tombstones: { 'mobile_words_w1': now },
    }
    mockDownload(encryptJson(JSON.stringify(payload), aesKey))

    const result = await pullFromServer(`blob-1.${aesKey}`)

    expect(result.success).toBe(true)
    expect(result.banks).toHaveLength(1)
    // 被删词过滤掉，正常词保留
    expect(result.banks![0].words.map((w: any) => w.id)).toEqual(['mobile_words_w2'])
    // 远端墓碑已合并进本地墓碑文档（双端同 key / 同结构，桌面端可互通）
    expect(getTombstones()['mobile_words_w1']).toBe(now)
  })

  it('payload 无墓碑但本地有墓碑时：本地被删词条同样被过滤', async () => {
    const now = Date.now()
    const db = (await import('@/adapters/index')).getDbAdapter()
    db.put({
      _id: TOMBSTONES_DOC_ID,
      type: 'sync-tombstones',
      tombstones: { 'mobile_words_w2': now },
      updatedAt: now,
    } as any)

    const payload = {
      version: 1,
      exportedAt: now,
      platform: 'mobile',
      banks: [{
        id: 'bank-1',
        name: '测试词库',
        words: [
          { id: 'mobile_words_w1', word: 'alive', meaning: '存活', addTime: 1, reviewCount: 0, nextReviewTime: 1 },
          { id: 'mobile_words_w2', word: 'deleted', meaning: '已删', addTime: 1, reviewCount: 0, nextReviewTime: 1 },
        ],
      }],
    }
    mockDownload(encryptJson(JSON.stringify(payload), aesKey))

    const result = await pullFromServer(`blob-2.${aesKey}`)

    expect(result.success).toBe(true)
    expect(result.banks![0].words.map((w: any) => w.id)).toEqual(['mobile_words_w1'])
  })

  it('payload 与本地均无墓碑时：词条原样返回，且不产生墓碑文档回写', async () => {
    const now = Date.now()
    const payload = {
      version: 1,
      exportedAt: now,
      platform: 'mobile',
      banks: [{
        id: 'bank-1',
        name: '测试词库',
        words: [
          { id: 'mobile_words_w1', word: 'alive', meaning: '存活', addTime: 1, reviewCount: 0, nextReviewTime: 1 },
        ],
      }],
      tombstones: {},
    }
    mockDownload(encryptJson(JSON.stringify(payload), aesKey))

    const result = await pullFromServer(`blob-3.${aesKey}`)

    expect(result.success).toBe(true)
    expect(result.banks![0].words).toHaveLength(1)
    // 空 remote 墓碑不触发回写（不产生墓碑文档）
    expect(getTombstones()).toEqual({})
  })
})
