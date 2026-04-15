import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
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

describe('wordbank-service', () => {
  beforeEach(() => {
    localStorageMock.clear()
    vi.resetAllMocks()
  })

  describe('常量定义', () => {
    it('应该包含所有词库类型', () => {
      const expectedTypes = ['cet4', 'cet6', 'bec', 'gmat', 'gre', 'ielts', 
        'kaogong', 'kaoyan', 'level4', 'level8', 'sat', 'toefl', 'zsb']
      
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
})
