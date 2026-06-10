import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  fetchWordBank,
  fetchWordBankLegacy,
  clearWordBankCache,
  getWordBankInfo,
  isWordBankCached,
  WORDBANK_LIST,
  DEFAULT_STRATEGY,
  type WordBankType
} from './wordbank-service'

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { store = {} },
    get length() { return Object.keys(store).length },
    key: (index: number) => Object.keys(store)[index] ?? null,
  }
})()

vi.stubGlobal('localStorage', localStorageMock)

// Mock fetch
const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

describe('wordbank-service', () => {
  beforeEach(() => {
    localStorageMock.clear()
    vi.resetAllMocks()
  })

  describe('常量定义', () => {
    it('应该包含所有词库类型', () => {
      const expectedTypes = ['cet4', 'cet6', 'bec', 'gmat', 'gre', 'ielts',
        'kaogong', 'kaoyan', 'level4', 'level8', 'sat', 'toefl', 'zsb', 'roots',
        'phrasal-verbs', 'collocations', 'idioms']
      
      expect(WORDBANK_LIST).toHaveLength(expectedTypes.length)
      
      for (const type of expectedTypes) {
        expect(WORDBANK_LIST.some(wb => wb.id === type)).toBe(true)
      }
    })

    it('每个词库应该有必要的属性', () => {
      for (const wordbank of WORDBANK_LIST) {
        expect(wordbank).toHaveProperty('id')
        expect(wordbank).toHaveProperty('name')
        expect(wordbank).toHaveProperty('description')
        expect(wordbank).toHaveProperty('wordCount')
        expect(typeof wordbank.name).toBe('string')
        expect(typeof wordbank.description).toBe('string')
      }
    })

    it('默认策略应该正确配置', () => {
      expect(DEFAULT_STRATEGY).toEqual({
        priority: 'local',
        useCache: true,
        timeout: 5000
      })
    })
  })

  describe('getWordBankInfo', () => {
    it('应该返回存在的词库信息', () => {
      const info = getWordBankInfo('cet4')
      expect(info).toBeDefined()
      expect(info?.id).toBe('cet4')
      expect(info?.name).toBe('四级词汇')
    })

    it('对不存在的词库应该返回 undefined', () => {
      const info = getWordBankInfo('nonexistent' as WordBankType)
      expect(info).toBeUndefined()
    })

    it('应该返回不同词库的正确信息', () => {
      const cet6 = getWordBankInfo('cet6')
      expect(cet6?.name).toBe('六级词汇')
      
      const gre = getWordBankInfo('gre')
      expect(gre?.name).toBe('GRE词汇')
      
      const ielts = getWordBankInfo('ielts')
      expect(ielts?.name).toBe('雅思词汇')
    })
  })

  describe('缓存功能', () => {
    it('isWordBankCached 应该在没有缓存时返回 false', () => {
      expect(isWordBankCached('cet4')).toBe(false)
    })

    it('clearWordBankCache 应该清除指定词库的缓存', () => {
      const cacheKey = 'wordbank_cache_v2_cet4'
      const mockData = JSON.stringify({ words: Array(30).fill({ _id: '1', text: 'test' }), timestamp: Date.now() })
      localStorage.setItem(cacheKey, mockData)
      
      clearWordBankCache('cet4')
      
      expect(localStorage.getItem(cacheKey)).toBeNull()
    })

    it('clearWordBankCache 不传参数应该清除所有词库缓存', () => {
      const mockData = JSON.stringify({ timestamp: Date.now(), words: Array(30).fill({ _id: '1', text: 'test' }) })
      localStorage.setItem('wordbank_cache_v2_cet4', mockData)
      localStorage.setItem('wordbank_cache_v2_cet6', mockData)
      localStorage.setItem('other_key', 'other')
      
      clearWordBankCache()
      
      expect(localStorage.getItem('wordbank_cache_v2_cet4')).toBeNull()
      expect(localStorage.getItem('wordbank_cache_v2_cet6')).toBeNull()
      expect(localStorage.getItem('other_key')).toBe('other')
    })
  })

  describe('isWordBankCached', () => {
    it('有有效缓存时应返回 true', () => {
      const cacheKey = 'wordbank_cache_v2_cet4'
      const mockData = JSON.stringify({ words: Array(30).fill({ _id: '1', text: 'test' }), timestamp: Date.now() })
      localStorage.setItem(cacheKey, mockData)

      expect(isWordBankCached('cet4')).toBe(true)
    })

    it('缓存数据过少时应返回 false', () => {
      const cacheKey = 'wordbank_cache_v2_cet4'
      const mockData = JSON.stringify({ words: Array(10).fill({ _id: '1', text: 'test' }), timestamp: Date.now() })
      localStorage.setItem(cacheKey, mockData)

      expect(isWordBankCached('cet4')).toBe(false)
    })

    it('缓存过期时应返回 false', () => {
      const cacheKey = 'wordbank_cache_v2_cet4'
      const expiredTimestamp = Date.now() - 8 * 24 * 60 * 60 * 1000 // 8天前
      const mockData = JSON.stringify({ words: Array(30).fill({ _id: '1', text: 'test' }), timestamp: expiredTimestamp })
      localStorage.setItem(cacheKey, mockData)

      expect(isWordBankCached('cet4')).toBe(false)
    })
  })

  describe('fetchWordBank', () => {
    it('应从本地加载词库并缓存', async () => {
      const mockWords = Array(50).fill(null).map((_, i) => ({ word: `word${i}`, explains: `释义${i}` }))
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ words: mockWords })
      })

      const result = await fetchWordBank('cet4')

      expect(result.length).toBe(50)
      expect(result[0].text).toBe('word0')
      expect(fetchMock).toHaveBeenCalled()
    })

    it('应使用缓存数据（当缓存有效时）', async () => {
      const cachedWords = Array(30).fill(null).map((_, i) => ({
        _id: `wb_${i}`, text: `cached${i}`, explains: `缓存${i}`,
        isReview: true, ctime: new Date(), learnDate: new Date(), level: 1,
        explainedHidden: false, remember: false
      }))
      const cacheKey = 'wordbank_cache_v2_cet4'
      localStorage.setItem(cacheKey, JSON.stringify({ words: cachedWords, timestamp: Date.now() }))

      const result = await fetchWordBank('cet4', { useCache: true })

      expect(result.length).toBe(30)
      expect(result[0].text).toBe('cached0')
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('useCache 为 false 时应跳过缓存', async () => {
      const cachedWords = Array(30).fill(null).map((_, i) => ({
        _id: `wb_${i}`, text: `cached${i}`, explains: `缓存${i}`,
        isReview: true, ctime: new Date(), learnDate: new Date(), level: 1,
        explainedHidden: false, remember: false
      }))
      const cacheKey = 'wordbank_cache_v2_cet4'
      localStorage.setItem(cacheKey, JSON.stringify({ words: cachedWords, timestamp: Date.now() }))

      const mockWords = Array(50).fill(null).map((_, i) => ({ word: `new${i}`, explains: `新${i}` }))
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ words: mockWords })
      })

      const result = await fetchWordBank('cet4', { useCache: false })

      expect(fetchMock).toHaveBeenCalled()
      expect(result[0].text).toBe('new0')
    })

    it('本地加载失败时应使用备用词库', async () => {
      fetchMock.mockResolvedValueOnce({ ok: false, status: 404 })

      const result = await fetchWordBank('cet4')

      expect(result.length).toBeGreaterThan(0)
      expect(result[0].text).toBe('abandon')
    })

    it('fetch 抛出异常时应使用备用词库', async () => {
      fetchMock.mockRejectedValueOnce(new Error('Network error'))

      const result = await fetchWordBank('cet4')

      expect(result.length).toBeGreaterThan(0)
    })

    it('应处理数组格式的词库数据', async () => {
      const mockWords = [{ word: 'test', explains: '测试' }]
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockWords)  // 直接返回数组
      })

      const result = await fetchWordBank('cet6')

      expect(result.length).toBe(1)
      expect(result[0].text).toBe('test')
    })

    it('应过滤掉空文本的单词', async () => {
      const mockWords = [
        { word: 'valid', explains: '有效' },
        { word: '', explains: '空' },
        { word: '   ', explains: '空白' }
      ]
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ words: mockWords })
      })

      const result = await fetchWordBank('gre')

      expect(result.length).toBe(1)
      expect(result[0].text).toBe('valid')
    })

    it('加载成功后应保存到缓存', async () => {
      const mockWords = Array(50).fill(null).map((_, i) => ({ word: `word${i}`, explains: `释义${i}` }))
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ words: mockWords })
      })

      await fetchWordBank('ielts', { useCache: true })

      const cacheKey = 'wordbank_cache_v2_ielts'
      const cached = localStorage.getItem(cacheKey)
      expect(cached).not.toBeNull()
      const parsed = JSON.parse(cached!)
      expect(parsed.words.length).toBe(50)
    })

    it('useCache 为 false 时不保存缓存', async () => {
      const mockWords = Array(50).fill(null).map((_, i) => ({ word: `word${i}`, explains: `释义${i}` }))
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ words: mockWords })
      })

      await fetchWordBank('toefl', { useCache: false })

      const cacheKey = 'wordbank_cache_v2_toefl'
      const cached = localStorage.getItem(cacheKey)
      expect(cached).toBeNull()
    })

    it('应处理非数组格式的响应数据', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve('invalid data')
      })

      const result = await fetchWordBank('cet4')

      // 非数组数据会走到备用词库
      expect(result.length).toBeGreaterThan(0)
    })

    it('备用词库应返回有效数据', async () => {
      fetchMock.mockRejectedValueOnce(new Error('fail'))

      const result = await fetchWordBank('kaoyan')

      expect(result.length).toBeGreaterThan(0)
      // 所有词库共享相同的备用数据
      expect(result[0].text).toBe('abandon')
    })

    it('normalizeWords 应正确处理不同字段名', async () => {
      const mockWords = [
        { word: 'test1', translation: '翻译1' },
        { text: 'test2', meaning: '意思2' },
        { word: 'test3', explains: ['释义3a', '释义3b'] }
      ]
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ words: mockWords })
      })

      const result = await fetchWordBank('cet4')

      expect(result.length).toBe(3)
      expect(result[0].text).toBe('test1')
      expect(result[0].explains).toBe('翻译1')
      expect(result[1].text).toBe('test2')
      expect(result[1].explains).toBe('意思2')
      expect(result[2].text).toBe('test3')
      expect(result[2].explains).toBe('释义3a; 释义3b')
    })
  })

  describe('fetchWordBankLegacy', () => {
    it('应该兼容旧版调用方式', async () => {
      const mockWords = Array(50).fill(null).map((_, i) => ({ word: `word${i}`, explains: `释义${i}` }))
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ words: mockWords })
      })

      const result = await fetchWordBankLegacy('cet4', true)

      expect(result.length).toBe(50)
    })

    it('useCache 为 false 时不应使用缓存', async () => {
      const mockWords = Array(30).fill(null).map((_, i) => ({
        _id: `wb_${i}`, text: `cached${i}`, explains: `缓存${i}`,
        isReview: true, ctime: new Date(), learnDate: new Date(), level: 1,
        explainedHidden: false, remember: false
      }))
      localStorage.setItem('wordbank_cache_v2_cet4', JSON.stringify({ words: mockWords, timestamp: Date.now() }))

      const newWords = Array(50).fill(null).map((_, i) => ({ word: `new${i}`, explains: `新${i}` }))
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ words: newWords })
      })

      const result = await fetchWordBankLegacy('cet4', false)

      expect(fetchMock).toHaveBeenCalled()
    })
  })
})
