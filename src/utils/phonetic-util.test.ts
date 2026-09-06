/**
 * 音标工具单元测试
 *
 * mock 本地词典网络/存储层（queryLocalDictionaryAsync），
 * 只验证 isValidPhonetic 的脏数据判断与 lookupPhonetic 的
 * inflight 去重 / failedLookup 失败缓存逻辑。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { isValidPhonetic, lookupPhonetic, lookupPhoneticSync } from './phonetic-util'

// words store 在本测试中不会真正使用，但 phonetic-util 顶层引用了它；
// vitest 的 @/stores 别名指向 mobile 端实现，用空 mock 避免拉入 uni 依赖
vi.mock('@/stores/words', () => ({
  useWordsStore: vi.fn(),
}))

vi.mock('./local-dictionary', () => ({
  queryLocalDictionaryAsync: vi.fn(),
  queryLocalDictionary: vi.fn(),
}))

import { queryLocalDictionaryAsync, queryLocalDictionary } from './local-dictionary'

const mockQueryAsync = vi.mocked(queryLocalDictionaryAsync)
const mockQuerySync = vi.mocked(queryLocalDictionary)

describe('isValidPhonetic', () => {
  it('空串 / undefined / 纯空白均无效', () => {
    expect(isValidPhonetic(undefined)).toBe(false)
    expect(isValidPhonetic('')).toBe(false)
    expect(isValidPhonetic('   ')).toBe(false)
  })

  it('URL（http/https）无效', () => {
    expect(isValidPhonetic('https://example.com/a.mp3')).toBe(false)
    expect(isValidPhonetic('http://dict.youdao.com/dictvoice?audio=hello')).toBe(false)
  })

  it('与原文相同（占位退化结果）无效', () => {
    expect(isValidPhonetic('Hello', 'hello')).toBe(false)
    expect(isValidPhonetic('hello', 'hello')).toBe(false)
  })

  it('正常 IPA 音标有效', () => {
    expect(isValidPhonetic('/həˈləʊ/')).toBe(true)
    expect(isValidPhonetic('/həˈləʊ/', 'hello')).toBe(true)
    expect(isValidPhonetic(' [æpəl] ', 'apple')).toBe(true)
  })
})

describe('lookupPhonetic', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('命中时返回音标（trim 后）', async () => {
    mockQueryAsync.mockResolvedValue({ word: 'hello', phonetic: ' /həˈləʊ/ ', explains: [] })
    expect(await lookupPhonetic('Hello')).toBe('/həˈləʊ/')
    expect(mockQueryAsync).toHaveBeenCalledTimes(1)
  })

  it('key 统一小写：大小写变体共享同一查询', async () => {
    mockQueryAsync.mockResolvedValue({ word: 'world', phonetic: '/wɜːld/', explains: [] })
    expect(await lookupPhonetic('World')).toBe('/wɜːld/')
    expect(await lookupPhonetic(' WORLD ')).toBe('/wɜːld/')
    expect(mockQueryAsync).toHaveBeenCalledTimes(2) // 成功后不入 failedLookup，各查一次
  })

  it('inflight 去重：并发同词只查一次，结果共享', async () => {
    let resolveQuery!: (entry: any) => void
    mockQueryAsync.mockImplementation(
      () => new Promise(resolve => { resolveQuery = resolve }),
    )
    const p1 = lookupPhonetic('dedup-word')
    const p2 = lookupPhonetic('dedup-word')
    resolveQuery({ word: 'dedup-word', phonetic: '/diːdʌp/', explains: [] })
    await expect(p1).resolves.toBe('/diːdʌp/')
    await expect(p2).resolves.toBe('/diːdʌp/')
    expect(mockQueryAsync).toHaveBeenCalledTimes(1)
  })

  it('查不到时返回空串并写入 failedLookup，后续直接返回不再查询', async () => {
    mockQueryAsync.mockResolvedValue(null)
    expect(await lookupPhonetic('missing-word')).toBe('')
    expect(await lookupPhonetic('missing-word')).toBe('')
    expect(await lookupPhonetic('missing-word')).toBe('')
    expect(mockQueryAsync).toHaveBeenCalledTimes(1)
  })

  it('查询抛异常时同样计入失败缓存', async () => {
    mockQueryAsync.mockRejectedValue(new Error('db error'))
    expect(await lookupPhonetic('error-word')).toBe('')
    expect(await lookupPhonetic('error-word')).toBe('')
    expect(mockQueryAsync).toHaveBeenCalledTimes(1)
  })

  it('空字符串直接返回空', async () => {
    expect(await lookupPhonetic('')).toBe('')
    expect(await lookupPhonetic('   ')).toBe('')
    expect(mockQueryAsync).not.toHaveBeenCalled()
  })
})

describe('lookupPhoneticSync', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('命中时返回音标', () => {
    mockQuerySync.mockReturnValue({ word: 'sync-hit', phonetic: ' /sɪŋk/ ', explains: [] })
    expect(lookupPhoneticSync('sync-hit')).toBe('/sɪŋk/')
  })

  it('失败缓存中的词不再查询', async () => {
    // 先用 async 版本把 sync-cache-word 写入 failedLookup
    mockQueryAsync.mockResolvedValue(null)
    expect(await lookupPhonetic('sync-cache-word')).toBe('')
    mockQuerySync.mockReturnValue({ word: 'sync-cache-word', phonetic: '/x/', explains: [] })
    expect(lookupPhoneticSync('sync-cache-word')).toBe('')
    expect(mockQuerySync).not.toHaveBeenCalled()
  })
})
