/**
 * 商店版（uTools + __STORE_BUILD__）外置词典存储行为：
 * 词条本体分块写入本机存储，同步库只留版本号与导入标记；旧版含 words 的文档自动迁移。
 */
import 'fake-indexeddb/auto'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {
  getExternalDictionaryCount,
  hasDictionaryInDB,
  loadDictionaryFromDB,
  removeDictionaryFromDB,
  saveDictionaryToDB,
} from './dictionary-db'
import {
  _setStoreLocalOnlyForTest,
  initLocalBulkStore,
  localBulkGet,
  localBulkRemove,
} from '@/adapters/local-bulk-store'

const mockGet = vi.fn()
const mockPromisesPut = vi.fn()
const mockPromisesRemove = vi.fn()
const mockStorageSetItem = vi.fn()
const mockStorageRemoveItem = vi.fn()

vi.mock('@/adapters/db', () => ({
  getDbAdapter: () => ({
    get: mockGet,
    promises: {put: mockPromisesPut, remove: mockPromisesRemove},
  }),
  getDbStorage: () => ({
    getItem: vi.fn(() => null),
    setItem: mockStorageSetItem,
    removeItem: mockStorageRemoveItem,
  }),
}))

const DICTIONARY_KEY = 'external_dictionary'
const LOCAL_META_KEY = 'external_dictionary_meta'
const LOCAL_CHUNK_PREFIX = 'external_dictionary_chunk_'

function makeWords(n: number): Record<string, any> {
  const words: Record<string, any> = {}
  for (let i = 0; i < n; i++) {
    words[`word${i}`] = {word: `word${i}`, explains: `释义${i}`}
  }
  return words
}

describe('dictionary-db（商店版本机存储）', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    mockGet.mockReturnValue(null)
    mockPromisesPut.mockResolvedValue({ok: true})
    mockPromisesRemove.mockResolvedValue({ok: true})
    _setStoreLocalOnlyForTest(true)
    await initLocalBulkStore()
    // 清理上次用例的本机存储
    const meta = localBulkGet<{ chunks: number }>(LOCAL_META_KEY)
    if (meta) {
      for (let i = 0; i < meta.chunks; i++) {
        await localBulkRemove(LOCAL_CHUNK_PREFIX + i)
      }
      await localBulkRemove(LOCAL_META_KEY)
    }
  })

  afterEach(() => {
    _setStoreLocalOnlyForTest(null)
  })

  it('词条本体写入本机存储，同步库只留标记（不含 words）', async () => {
    const ok = await saveDictionaryToDB(makeWords(3), '2.0')
    expect(ok).toBe(true)

    const meta = localBulkGet<{ version: string; total: number; chunks: number }>(LOCAL_META_KEY)
    expect(meta).toEqual({version: '2.0', total: 3, chunks: 1})
    expect(Object.keys(localBulkGet(LOCAL_CHUNK_PREFIX + 0)!)).toHaveLength(3)

    // 同步库只收到标记文档
    const marker = mockPromisesPut.mock.calls.map(c => c[0]).find(d => d?._id === DICTIONARY_KEY)
    expect(marker).toBeTruthy()
    expect(marker.words).toBeUndefined()
    expect(marker.storage).toBe('local')
    expect(marker.version).toBe('2.0')
    expect(marker.total).toBe(3)
    expect(mockStorageSetItem).toHaveBeenCalledWith('dictionary_version', '2.0')
  })

  it('超过 4000 词时分批写入多个分块', async () => {
    const ok = await saveDictionaryToDB(makeWords(4001), '1.0')
    expect(ok).toBe(true)
    const meta = localBulkGet<{ chunks: number }>(LOCAL_META_KEY)!
    expect(meta.chunks).toBe(2)
    expect(Object.keys(localBulkGet(LOCAL_CHUNK_PREFIX + 0)!)).toHaveLength(4000)
    expect(Object.keys(localBulkGet(LOCAL_CHUNK_PREFIX + 1)!)).toHaveLength(1)
  })

  it('load/has/count 读本机存储；remove 同时清理本机与同步库标记', async () => {
    await saveDictionaryToDB(makeWords(5), '1.0')
    expect(hasDictionaryInDB()).toBe(true)
    expect(getExternalDictionaryCount()).toBe(5)
    const dict = loadDictionaryFromDB()
    expect(dict).not.toBeNull()
    expect(dict!['word3'].explains).toBe('释义3')

    expect(await removeDictionaryFromDB()).toBe(true)
    expect(localBulkGet(LOCAL_META_KEY)).toBeNull()
    expect(hasDictionaryInDB()).toBe(false)
    expect(mockPromisesRemove).toHaveBeenCalledWith(DICTIONARY_KEY)
    expect(mockStorageRemoveItem).toHaveBeenCalledWith('dictionary_version')
  })

  it('旧版同步库文档（含 words）读取时先用并异步迁移到本机存储', async () => {
    const legacyWords = makeWords(2)
    mockGet.mockImplementation((id: string) =>
      id === DICTIONARY_KEY ? {_id: DICTIONARY_KEY, version: '9.9', total: 2, words: legacyWords} : null)

    const dict = loadDictionaryFromDB()
    expect(dict).not.toBeNull()
    expect(dict!['word1'].explains).toBe('释义1')

    // 迁移为异步：等待本机 meta 与同步库标记出现
    await vi.waitFor(() => {
      expect(localBulkGet(LOCAL_META_KEY)).toEqual({version: '9.9', total: 2, chunks: 1})
    })
    await vi.waitFor(() => {
      const marker = mockPromisesPut.mock.calls.map(c => c[0]).find(d => d?._id === DICTIONARY_KEY)
      expect(marker?.words).toBeUndefined()
      expect(marker?.storage).toBe('local')
    })
  })
})
