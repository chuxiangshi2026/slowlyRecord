/**
 * remote-wordbank.ts 缓存分块测试
 * 重点：超 1MB 词库（如 level8）整存必然写失败，必须分块写入且能读回；
 * 兼容旧版整存格式；导入后删除缓存含分块清理。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// 内存 Map 兜底 uni storage
const store = new Map<string, any>()
let mockDownloadContent = ''
vi.stubGlobal('uni', {
  getStorageSync: (k: string) => store.get(k) ?? '',
  setStorageSync: (k: string, v: any) => { store.set(k, v) },
  removeStorageSync: (k: string) => { store.delete(k) },
  downloadFile: ({ url, success }: any) => {
    if (url.includes('404')) return
    success({ statusCode: 200, tempFilePath: '/tmp/mock.json' })
  },
  getFileSystemManager: () => ({
    readFile: ({ success }: any) => success({ data: mockDownloadContent }),
  }),
})

import {
  loadCachedWordBank,
  removeCachedWordBank,
  getCachedBankIds,
  downloadWordBank,
} from '@/utils/remote-wordbank'

const CACHE_KEY_PREFIX = 'slowlyrecord_remote_wordbank_'

/** 直接调用模块内部分块逻辑不可行（未导出），写入侧通过 downloadWordBank 端到端验证。 */

describe('downloadWordBank 缓存写入', () => {
  beforeEach(() => store.clear())

  it('小词库整存，读回一致', async () => {
    const words = [{ word: 'apple', meaning: '苹果' }]
    mockDownloadContent = JSON.stringify(words)
    const result = await downloadWordBank('cet4')
    expect(result).toEqual(words)
    expect(typeof store.get(CACHE_KEY_PREFIX + 'cet4')).toBe('string')
    expect(loadCachedWordBank('cet4')).toEqual(words)
    expect(getCachedBankIds()).toContain('cet4')
  })

  it('超 1MB 大词库自动分块写入且能读回（level8 场景回归）', async () => {
    // 构造 >900KB 的 JSON：每个词约 60 字节，2 万个词约 1.2MB
    const words = Array.from({ length: 20000 }, (_, i) => ({
      word: `word${i}`, meaning: `释义${i}`, phonetic: `/wɜːd${i}/`,
    }))
    mockDownloadContent = JSON.stringify(words)
    expect(mockDownloadContent.length).toBeGreaterThan(900 * 1024)

    const result = await downloadWordBank('level8')
    expect(result.length).toBe(20000)
    // 主 key 存的是分块元信息而非整串
    const meta = store.get(CACHE_KEY_PREFIX + 'level8')
    expect(meta._chunks).toBeGreaterThan(1)
    expect(loadCachedWordBank('level8')).toEqual(words)
    expect(getCachedBankIds()).toContain('level8')
  })
})

describe('loadCachedWordBank', () => {
  beforeEach(() => store.clear())

  it('旧版整存格式（JSON 字符串）正常读回', () => {
    const words = [{ word: 'apple', meaning: '苹果' }]
    store.set(CACHE_KEY_PREFIX + 'cet4', JSON.stringify(words))
    expect(loadCachedWordBank('cet4')).toEqual(words)
  })

  it('分块格式读回：多块拼接后解析', () => {
    const words = [{ word: 'abandon', meaning: '放弃' }]
    const json = JSON.stringify(words)
    const mid = Math.ceil(json.length / 2)
    const key = CACHE_KEY_PREFIX + 'gre'
    store.set(`${key}__chunk__0`, json.slice(0, mid))
    store.set(`${key}__chunk__1`, json.slice(mid))
    store.set(key, { _chunks: 2, _chunkKeys: [`${key}__chunk__0`, `${key}__chunk__1`] })
    expect(loadCachedWordBank('gre')).toEqual(words)
  })

  it('分块缺失任一块返回 null（不返回半成品）', () => {
    const key = CACHE_KEY_PREFIX + 'gre'
    store.set(`${key}__chunk__0`, '[{"word":"a"}')
    store.set(key, { _chunks: 2, _chunkKeys: [`${key}__chunk__0`, `${key}__chunk__1`] })
    expect(loadCachedWordBank('gre')).toBeNull()
  })

  it('未缓存 / 非法内容返回 null', () => {
    expect(loadCachedWordBank('nonexistent')).toBeNull()
    store.set(CACHE_KEY_PREFIX + 'bad', '{not json')
    expect(loadCachedWordBank('bad')).toBeNull()
  })
})

describe('removeCachedWordBank', () => {
  beforeEach(() => store.clear())

  it('删除整存缓存', () => {
    store.set(CACHE_KEY_PREFIX + 'cet4', '[]')
    removeCachedWordBank('cet4')
    expect(store.has(CACHE_KEY_PREFIX + 'cet4')).toBe(false)
  })

  it('删除分块缓存时连带清理所有分块 key', () => {
    const key = CACHE_KEY_PREFIX + 'level8'
    store.set(`${key}__chunk__0`, 'a')
    store.set(`${key}__chunk__1`, 'b')
    store.set(key, { _chunks: 2, _chunkKeys: [`${key}__chunk__0`, `${key}__chunk__1`] })
    removeCachedWordBank('level8')
    expect(store.has(key)).toBe(false)
    expect(store.has(`${key}__chunk__0`)).toBe(false)
    expect(store.has(`${key}__chunk__1`)).toBe(false)
  })

  it('删除不存在的缓存不抛异常', () => {
    expect(() => removeCachedWordBank('nonexistent')).not.toThrow()
  })
})

describe('getCachedBankIds', () => {
  beforeEach(() => store.clear())

  it('空存储返回空数组', () => {
    expect(getCachedBankIds()).toEqual([])
  })

  it('读取已缓存 id 列表', () => {
    store.set('slowlyrecord_remote_wordbank_index', JSON.stringify(['cet4', 'gre']))
    expect(getCachedBankIds()).toEqual(['cet4', 'gre'])
  })
})
