/**
 * 移动端词库服务测试。
 *
 * 覆盖：本地缓存读写/过期/损坏、小程序端缓存优先与错误包装、
 * 词库信息查询、缓存清理、导入截断，以及离线音标查询（旧缓存 + 远程缓存）。
 *
 * 说明：vitest 不执行 uni-app 的 #ifdef 条件编译，因此 loadWordBank 中
 * 「小程序：只从缓存读取」分支在测试中同样生效，远程下载分支不可达；
 * 本文件按该编译结果断言真实行为。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { Word } from './types'

const remote = vi.hoisted(() => ({
  cachedIds: [] as string[],
  cachedWords: {} as Record<string, Word[] | null>,
  downloadCalls: [] as string[],
}))

vi.mock('@/utils/remote-wordbank', () => ({
  downloadWordBank: vi.fn(async (type: string) => {
    remote.downloadCalls.push(type)
    return remote.cachedWords[type] ?? []
  }),
  getCachedBankIds: () => remote.cachedIds,
  loadCachedWordBank: (id: string) => remote.cachedWords[id] ?? null,
}))

import {
  DEFAULT_STRATEGY,
  WORDBANK_LIST,
  saveWordBankCache,
  loadWordBank,
  downloadWordBank,
  getWordBankInfo,
  getAllWordBankInfo,
  isWordBankCached,
  clearWordBankCache,
  importWordsFromBank,
  queryPhoneticFromWordBankCache,
} from './wordbank'

const CACHE_PREFIX = 'wordbank_cache_v3_'
const DAY = 24 * 60 * 60 * 1000

const storage = new Map<string, string>()
;(globalThis as any).uni = {
  getStorageSync: (key: string) => storage.get(key) ?? '',
  setStorageSync: (key: string, value: string) => {
    storage.set(key, value)
  },
  removeStorageSync: (key: string) => {
    storage.delete(key)
  },
  getStorageInfoSync: () => ({ keys: Array.from(storage.keys()) }),
}

function makeWord(word: string, phonetic?: string): Word {
  return { word, meaning: `${word} 的释义`, phonetic }
}

function putCache(type: string, words: Word[], timestamp = Date.now()): void {
  storage.set(CACHE_PREFIX + type, JSON.stringify({ timestamp, words }))
}

beforeEach(() => {
  storage.clear()
  remote.cachedIds = []
  remote.cachedWords = {}
  remote.downloadCalls = []
})

describe('常量', () => {
  it('默认加载策略：本地优先、使用缓存、5 秒超时', () => {
    expect(DEFAULT_STRATEGY).toEqual({ priority: 'local', useCache: true, timeout: 5000 })
  })

  it('内置词库清单 id 唯一且包含常用考试词库', () => {
    const ids = WORDBANK_LIST.map(info => info.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toEqual(expect.arrayContaining(['cet4', 'cet6', 'level8', 'kaoyan', 'toefl']))
  })
})

describe('缓存读写', () => {
  it('saveWordBankCache 后 isWordBankCached 为 true', () => {
    saveWordBankCache('cet4', [makeWord('apple')])
    expect(isWordBankCached('cet4')).toBe(true)
    const cached = JSON.parse(storage.get(CACHE_PREFIX + 'cet4')!) as { timestamp: number; words: Word[] }
    expect(cached.words).toHaveLength(1)
    expect(Date.now() - cached.timestamp).toBeLessThan(5000)
  })

  it('无缓存 / 空词表 / 过期 / JSON 损坏时 isWordBankCached 为 false', () => {
    expect(isWordBankCached('cet4')).toBe(false)

    putCache('cet4', [])
    expect(isWordBankCached('cet4')).toBe(false)

    putCache('cet4', [makeWord('apple')], Date.now() - 8 * DAY)
    expect(isWordBankCached('cet4')).toBe(false)

    storage.set(CACHE_PREFIX + 'cet4', '{broken')
    expect(isWordBankCached('cet4')).toBe(false)
  })

  it('缓存写入失败时被吞掉并记录错误，不抛异常', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const setSpy = vi.spyOn((globalThis as any).uni, 'setStorageSync').mockImplementationOnce(() => {
      throw new Error('quota exceeded')
    })
    expect(() => saveWordBankCache('cet4', [makeWord('apple')])).not.toThrow()
    expect(errorSpy).toHaveBeenCalled()
    setSpy.mockRestore()
    errorSpy.mockRestore()
  })

  it('loadWordBank 命中未过期缓存直接返回，不触发远程下载', async () => {
    putCache('cet4', [makeWord('apple', 'ˈæpl'), makeWord('book')])
    const words = await loadWordBank('cet4')
    expect(words.map(w => w.word)).toEqual(['apple', 'book'])
    expect(remote.downloadCalls).toHaveLength(0)
  })

  it('useCache=false 时仍会走小程序缓存分支（条件编译结果）', async () => {
    putCache('cet4', [makeWord('apple')])
    const words = await loadWordBank('cet4', { ...DEFAULT_STRATEGY, useCache: false })
    expect(words.map(w => w.word)).toEqual(['apple'])
    expect(remote.downloadCalls).toHaveLength(0)
  })

  it('过期缓存被删除，且在小程序分支下抛出可见错误', async () => {
    putCache('cet4', [makeWord('apple')], Date.now() - 8 * DAY)
    await expect(loadWordBank('cet4')).rejects.toThrow('加载词库失败')
    await expect(loadWordBank('cet4')).rejects.toThrow('词库管理')
    expect(storage.has(CACHE_PREFIX + 'cet4')).toBe(false)
    expect(remote.downloadCalls).toHaveLength(0)
  })

  it('缓存 JSON 损坏时按未命中处理并抛出可见错误', async () => {
    storage.set(CACHE_PREFIX + 'cet4', '{broken')
    await expect(loadWordBank('cet4')).rejects.toThrow('加载词库失败')
  })

  it('downloadWordBank 复用 loadWordBank 的缓存逻辑', async () => {
    putCache('gre', [makeWord('abandon')])
    const words = await downloadWordBank('gre')
    expect(words.map(w => w.word)).toEqual(['abandon'])
  })
})

describe('clearWordBankCache', () => {
  it('指定类型时只删除该词库缓存', () => {
    putCache('cet4', [makeWord('apple')])
    putCache('cet6', [makeWord('banana')])
    clearWordBankCache('cet4')
    expect(storage.has(CACHE_PREFIX + 'cet4')).toBe(false)
    expect(storage.has(CACHE_PREFIX + 'cet6')).toBe(true)
  })

  it('不指定类型时清空全部词库缓存，保留其他 key', () => {
    putCache('cet4', [makeWord('apple')])
    putCache('toefl', [makeWord('banana')])
    storage.set('other_key', 'keep')
    clearWordBankCache()
    expect(storage.has(CACHE_PREFIX + 'cet4')).toBe(false)
    expect(storage.has(CACHE_PREFIX + 'toefl')).toBe(false)
    expect(storage.get('other_key')).toBe('keep')
  })
})

describe('importWordsFromBank', () => {
  it('按 count 截断缓存词表', async () => {
    putCache('cet4', [makeWord('a'), makeWord('b'), makeWord('c')])
    const words = await importWordsFromBank('cet4', 2)
    expect(words.map(w => w.word)).toEqual(['a', 'b'])
  })

  it('默认最多导入 50 个词', async () => {
    putCache('cet4', Array.from({ length: 60 }, (_, i) => makeWord(`w${i}`)))
    const words = await importWordsFromBank('cet4')
    expect(words).toHaveLength(50)
  })
})

describe('getWordBankInfo / getAllWordBankInfo', () => {
  it('缓存可用时返回元数据并以缓存词数覆盖 wordCount', async () => {
    putCache('cet4', [makeWord('a'), makeWord('b')])
    const info = await getWordBankInfo('cet4')
    expect(info).toMatchObject({ id: 'cet4', name: '四级词汇', wordCount: 2 })
  })

  it('未知词库返回 null', async () => {
    await expect(getWordBankInfo('not-exist' as any)).resolves.toBeNull()
  })

  it('加载失败时回退到清单里的静态词数', async () => {
    const info = await getWordBankInfo('cet4')
    expect(info).toMatchObject({ id: 'cet4', wordCount: 3739 })
  })

  it('getAllWordBankInfo 返回完整清单', async () => {
    const list = await getAllWordBankInfo()
    expect(list).toHaveLength(WORDBANK_LIST.length)
    expect(list[0]).toEqual(WORDBANK_LIST[0])
  })
})

describe('queryPhoneticFromWordBankCache', () => {
  it('从旧版缓存中大小写不敏感地命中音标', () => {
    putCache('gre', [makeWord('Hello', 'həˈləʊ')])
    expect(queryPhoneticFromWordBankCache('  HELLO ')).toBe('həˈləʊ')
  })

  it('跳过无音标词条，继续查后面的词库', () => {
    putCache('cet4', [makeWord('apple')])
    putCache('cet6', [makeWord('apple', 'ˈæpl')])
    expect(queryPhoneticFromWordBankCache('apple')).toBe('ˈæpl')
  })

  it('跳过过期缓存', () => {
    putCache('cet4', [makeWord('apple', 'ˈæpl')], Date.now() - 8 * DAY)
    expect(queryPhoneticFromWordBankCache('apple')).toBeNull()
  })

  it('旧缓存无结果时回退到远程词库缓存（新安装场景）', () => {
    remote.cachedIds = ['cet4', 'gre']
    remote.cachedWords = { gre: [makeWord('apple', 'ˈæpl')] }
    expect(queryPhoneticFromWordBankCache('apple')).toBe('ˈæpl')
  })

  it('未命中任何缓存时返回 null', () => {
    remote.cachedIds = ['cet4']
    remote.cachedWords = { cet4: [makeWord('book')] }
    expect(queryPhoneticFromWordBankCache('apple')).toBeNull()
  })
})
