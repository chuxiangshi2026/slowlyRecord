/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  saveDictionaryToDB,
  loadDictionaryFromDB,
  hasDictionaryInDB,
  getDictionaryVersion,
  removeDictionaryFromDB,
  queryWordFromDB,
  getExternalDictionaryCount,
} from './dictionary-db'

// Mock the DB adapter
const mockGet = vi.fn()
const mockAllDocs = vi.fn()
const mockRemove = vi.fn()
const mockPromisesPut = vi.fn()
const mockPromisesRemove = vi.fn()
const mockStorageGetItem = vi.fn()
const mockStorageSetItem = vi.fn()
const mockStorageRemoveItem = vi.fn()

vi.mock('@/adapters/db', () => ({
  getDbAdapter: () => ({
    get: mockGet,
    allDocs: mockAllDocs,
    remove: mockRemove,
    promises: {
      put: mockPromisesPut,
      remove: mockPromisesRemove,
    },
  }),
  getDbStorage: () => ({
    getItem: mockStorageGetItem,
    setItem: mockStorageSetItem,
    removeItem: mockStorageRemoveItem,
  }),
}))

const DICTIONARY_KEY = 'external_dictionary'
const DICTIONARY_VERSION_KEY = 'dictionary_version'

describe('dictionary-db', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('saveDictionaryToDB', () => {
    const sampleWords = {
      hello: { word: 'hello', explains: '你好' } as any,
      world: { word: 'world', explains: '世界' } as any,
    }

    it('应该成功保存词典', async () => {
      mockGet.mockReturnValue(null)
      mockPromisesPut.mockResolvedValue({ ok: true })

      const result = await saveDictionaryToDB(sampleWords, '1.0')

      expect(result).toBe(true)
      expect(mockGet).toHaveBeenCalledWith(DICTIONARY_KEY)
      expect(mockPromisesPut).toHaveBeenCalled()
      expect(mockStorageSetItem).toHaveBeenCalledWith(DICTIONARY_VERSION_KEY, '1.0')
    })

    it('已存在词典时保留 _rev', async () => {
      mockGet.mockReturnValue({ _id: DICTIONARY_KEY, _rev: 'old-rev', words: {} })
      mockPromisesPut.mockResolvedValue({ ok: true })

      const result = await saveDictionaryToDB(sampleWords)

      expect(result).toBe(true)
      const savedDoc = mockPromisesPut.mock.calls[0][0]
      expect(savedDoc._rev).toBe('old-rev')
    })

    it('保存失败应返回 false', async () => {
      mockGet.mockReturnValue(null)
      mockPromisesPut.mockResolvedValue({ ok: false })

      const result = await saveDictionaryToDB(sampleWords)

      expect(result).toBe(false)
    })

    it('异常时返回 false', async () => {
      mockGet.mockImplementation(() => { throw new Error('DB error') })

      const result = await saveDictionaryToDB(sampleWords)

      expect(result).toBe(false)
    })

    it('默认版本号为 1.0', async () => {
      mockGet.mockReturnValue(null)
      mockPromisesPut.mockResolvedValue({ ok: true })

      await saveDictionaryToDB(sampleWords)

      expect(mockStorageSetItem).toHaveBeenCalledWith(DICTIONARY_VERSION_KEY, '1.0')
    })

    it('应记录正确的单词总数', async () => {
      mockGet.mockReturnValue(null)
      mockPromisesPut.mockResolvedValue({ ok: true })

      await saveDictionaryToDB(sampleWords)

      const savedDoc = mockPromisesPut.mock.calls[0][0]
      expect(savedDoc.total).toBe(2)
    })
  })

  describe('loadDictionaryFromDB', () => {
    it('应该加载词典数据', () => {
      const words = { test: { word: 'test' } }
      mockGet.mockReturnValue({ _id: DICTIONARY_KEY, words, total: 1 })

      const result = loadDictionaryFromDB()

      expect(result).toEqual(words)
      expect(mockGet).toHaveBeenCalledWith(DICTIONARY_KEY)
    })

    it('词典不存在时返回 null', () => {
      mockGet.mockReturnValue(null)

      const result = loadDictionaryFromDB()

      expect(result).toBeNull()
    })

    it('词典数据为空时返回 null', () => {
      mockGet.mockReturnValue({ _id: DICTIONARY_KEY, words: null, total: 0 })

      const result = loadDictionaryFromDB()

      expect(result).toBeNull()
    })

    it('异常时返回 null', () => {
      mockGet.mockImplementation(() => { throw new Error('DB error') })

      const result = loadDictionaryFromDB()

      expect(result).toBeNull()
    })
  })

  describe('hasDictionaryInDB', () => {
    it('词典存在时返回 true', () => {
      mockGet.mockReturnValue({ _id: DICTIONARY_KEY })

      expect(hasDictionaryInDB()).toBe(true)
    })

    it('词典不存在时返回 false', () => {
      mockGet.mockReturnValue(null)

      expect(hasDictionaryInDB()).toBe(false)
    })
  })

  describe('getDictionaryVersion', () => {
    it('返回版本号', () => {
      mockStorageGetItem.mockReturnValue('2.0')

      expect(getDictionaryVersion()).toBe('2.0')
      expect(mockStorageGetItem).toHaveBeenCalledWith(DICTIONARY_VERSION_KEY)
    })

    it('无版本号时返回 null', () => {
      mockStorageGetItem.mockReturnValue(null)

      expect(getDictionaryVersion()).toBeNull()
    })
  })

  describe('removeDictionaryFromDB', () => {
    it('应该成功删除词典', async () => {
      mockPromisesRemove.mockResolvedValue({ ok: true })

      const result = await removeDictionaryFromDB()

      expect(result).toBe(true)
      expect(mockPromisesRemove).toHaveBeenCalledWith(DICTIONARY_KEY)
      expect(mockStorageRemoveItem).toHaveBeenCalledWith(DICTIONARY_VERSION_KEY)
    })

    it('删除失败返回 false', async () => {
      mockPromisesRemove.mockResolvedValue({ ok: false })

      const result = await removeDictionaryFromDB()

      expect(result).toBe(false)
    })

    it('异常时返回 false', async () => {
      mockPromisesRemove.mockRejectedValue(new Error('DB error'))

      const result = await removeDictionaryFromDB()

      expect(result).toBe(false)
    })
  })

  describe('queryWordFromDB', () => {
    it('查询存在的单词', () => {
      const words = { hello: { word: 'hello', explains: '你好' } }
      mockGet.mockReturnValue({ _id: DICTIONARY_KEY, words, total: 1 })

      const result = queryWordFromDB('hello')

      expect(result).toEqual(words.hello)
    })

    it('查询不存在的单词返回 null', () => {
      const words = { test: { word: 'test' } }
      mockGet.mockReturnValue({ _id: DICTIONARY_KEY, words, total: 1 })

      const result = queryWordFromDB('unknown')

      expect(result).toBeNull()
    })

    it('大小写不敏感查询', () => {
      const words = { hello: { word: 'hello' } }
      mockGet.mockReturnValue({ _id: DICTIONARY_KEY, words, total: 1 })

      const result = queryWordFromDB('HELLO')

      expect(result).toEqual(words.hello)
    })

    it('词典未加载时返回 null', () => {
      mockGet.mockReturnValue(null)

      const result = queryWordFromDB('hello')

      expect(result).toBeNull()
    })
  })

  describe('getExternalDictionaryCount', () => {
    it('返回词典单词数量', () => {
      const words = { a: {} as any, b: {} as any, c: {} as any }
      mockGet.mockReturnValue({ _id: DICTIONARY_KEY, words, total: 3 })

      expect(getExternalDictionaryCount()).toBe(3)
    })

    it('无词典时返回 0', () => {
      mockGet.mockReturnValue(null)

      expect(getExternalDictionaryCount()).toBe(0)
    })

    it('空词典时返回 0', () => {
      mockGet.mockReturnValue({ _id: DICTIONARY_KEY, words: {}, total: 0 })

      expect(getExternalDictionaryCount()).toBe(0)
    })
  })
})
