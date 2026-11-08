// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// Mock 依赖
vi.mock('@shared/utils/letter-memory-db', () => ({
  getAllAssociations: vi.fn(() => []),
  saveAssociation: vi.fn(() => ({ ok: true })),
  removeAssociation: vi.fn(() => ({ ok: true })),
}))

vi.mock('@shared/utils/letter-memory-preset', () => ({
  getRecommendedImages: vi.fn((letter: string) => [
    { name: 'test', url: `url-${letter}`, description: `desc-${letter}` },
  ]),
  getLetterKeyword: vi.fn((letter: string) => `keyword-${letter}`),
  shuffleArray: vi.fn((arr: any[]) => [...arr]),
  getAlphabetLetters: vi.fn(() => ['a', 'b', 'c']),
  getComboLetters: vi.fn(() => ['ch', 'sh']),
}))

vi.mock('@shared/utils/logger', () => ({
  log: { i: vi.fn(), d: vi.fn(), e: vi.fn(), w: vi.fn() },
}))

import { useLetterMemoryStore } from './letterMemory'
import { getAllAssociations, saveAssociation, removeAssociation } from '@shared/utils/letter-memory-db'

describe('useLetterMemoryStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.resetAllMocks()
    vi.mocked(getAllAssociations).mockReturnValue([])
  })

  describe('初始状态', () => {
    it('应该有正确的初始值', () => {
      const store = useLetterMemoryStore()

      expect(store.associations).toEqual([])
      expect(store.isLoading).toBe(false)
      expect(store.associationCount).toBe(0)
      expect(store.hasAssociations).toBe(false)
    })

    it('字母列表应该来自预设', () => {
      const store = useLetterMemoryStore()

      expect(store.alphabetLetters).toEqual(['a', 'b', 'c'])
      expect(store.comboLetters).toEqual(['ch', 'sh'])
    })
  })

  describe('getters', () => {
    it('getAssociation 应该返回指定字母的关联', () => {
      const store = useLetterMemoryStore()
      store.associations = [
        { letter: 'a', imageUrl: '🍎', source: 'preset' as const },
        { letter: 'b', imageUrl: '🍌', source: 'preset' as const },
      ]

      const result = store.getAssociation('a')

      expect(result?.imageUrl).toBe('🍎')
    })

    it('hasAssociation 应该检查字母是否已映射', () => {
      const store = useLetterMemoryStore()
      store.associations = [{ letter: 'a', imageUrl: '🍎', source: 'preset' as const }]

      expect(store.hasAssociation('a')).toBe(true)
      expect(store.hasAssociation('b')).toBe(false)
    })

    it('mappedLetterCount 应该统计单字母映射数', () => {
      const store = useLetterMemoryStore()
      store.associations = [
        { letter: 'a', imageUrl: '🍎', source: 'preset' as const },
        { letter: 'b', imageUrl: '🍌', source: 'preset' as const },
        { letter: 'ch', imageUrl: '🪑', source: 'preset' as const },
      ]

      expect(store.mappedLetterCount).toBe(2)
      expect(store.mappedComboCount).toBe(1)
    })
  })

  describe('loadAssociations', () => {
    it('应该加载关联数据', () => {
      const store = useLetterMemoryStore()
      const mockAssociations = [
        { letter: 'a', imageUrl: '🍎', source: 'preset' as const },
      ]
      vi.mocked(getAllAssociations).mockReturnValue(mockAssociations)

      store.loadAssociations()

      expect(store.associations).toEqual(mockAssociations)
      expect(store.isLoading).toBe(false)
    })
  })

  describe('addAssociation', () => {
    it('应该添加新的关联', async () => {
      const store = useLetterMemoryStore()
      vi.mocked(saveAssociation).mockResolvedValue({ ok: true })

      const result = await store.addAssociation('a', '🍎', 'preset', 'Apple')

      expect(saveAssociation).toHaveBeenCalledWith({
        letter: 'a',
        imageUrl: '🍎',
        source: 'preset',
        description: 'Apple',
      })
      expect(result.ok).toBe(true)
    })

    it('对重复的字母应该返回错误', async () => {
      const store = useLetterMemoryStore()
      store.associations = [{ letter: 'a', imageUrl: '🍎', source: 'preset' as const }]

      const result = await store.addAssociation('a', '🍏', 'upload')

      expect(result.ok).toBe(false)
      expect(result.error).toBe('duplicate')
    })
  })

  describe('deleteAssociation', () => {
    it('应该删除关联', async () => {
      const store = useLetterMemoryStore()
      store.associations = [{ letter: 'a', imageUrl: '🍎', source: 'preset' as const }]
      vi.mocked(removeAssociation).mockResolvedValue({ ok: true })

      const result = await store.deleteAssociation('a')

      expect(removeAssociation).toHaveBeenCalledWith('a')
      expect(result.ok).toBe(true)
    })
  })

  describe('getRecommendations', () => {
    it('应该返回推荐图片', () => {
      const store = useLetterMemoryStore()

      const result = store.getRecommendations('a')

      expect(result).toEqual([{ name: 'test', url: 'url-a', description: 'desc-a' }])
    })
  })

  describe('getKeyword', () => {
    it('应该返回字母关键词', () => {
      const store = useLetterMemoryStore()

      const result = store.getKeyword('a')

      expect(result).toBe('keyword-a')
    })
  })

  describe('generateLetterToImageQuiz', () => {
    it('空关联时应该返回空数组', () => {
      const store = useLetterMemoryStore()

      const result = store.generateLetterToImageQuiz(5)

      expect(result).toEqual([])
    })

    it('应该生成字母到图片的测试题', () => {
      const store = useLetterMemoryStore()
      store.associations = [
        { letter: 'a', imageUrl: 'url-a', source: 'preset' as const },
        { letter: 'b', imageUrl: 'url-b', source: 'preset' as const },
        { letter: 'c', imageUrl: 'url-c', source: 'preset' as const },
        { letter: 'd', imageUrl: 'url-d', source: 'preset' as const },
      ]

      const result = store.generateLetterToImageQuiz(2)

      expect(result).toHaveLength(2)
      expect(result[0]).toHaveProperty('question')
      expect(result[0]).toHaveProperty('correctAnswer')
      expect(result[0]).toHaveProperty('options')
      expect(result[0].options).toHaveLength(4)
    })
  })

  describe('generateImageToLetterQuiz', () => {
    it('应该生成图片到字母的测试题', () => {
      const store = useLetterMemoryStore()
      store.associations = [
        { letter: 'a', imageUrl: 'url-a', source: 'preset' as const },
        { letter: 'b', imageUrl: 'url-b', source: 'preset' as const },
        { letter: 'c', imageUrl: 'url-c', source: 'preset' as const },
        { letter: 'd', imageUrl: 'url-d', source: 'preset' as const },
      ]

      const result = store.generateImageToLetterQuiz(2)

      expect(result).toHaveLength(2)
      expect(result[0]).toHaveProperty('question') // imageUrl
      expect(result[0]).toHaveProperty('correctAnswer') // letter
      expect(result[0]).toHaveProperty('options')
      expect(result[0].options).toHaveLength(4) // 正确答案 + 3 干扰项
    })
  })

  describe('batchImportPresets', () => {
    it('应该批量导入预设', async () => {
      const store = useLetterMemoryStore()
      vi.mocked(saveAssociation).mockResolvedValue({ ok: true })

      const count = await store.batchImportPresets(['a', 'b'])

      expect(count).toBe(2)
      expect(saveAssociation).toHaveBeenCalledTimes(2)
    })

    it('应该跳过已存在的字母', async () => {
      const store = useLetterMemoryStore()
      store.associations = [{ letter: 'a', imageUrl: 'existing', source: 'preset' as const }]
      vi.mocked(saveAssociation).mockResolvedValue({ ok: true })

      const count = await store.batchImportPresets(['a', 'b'])

      expect(count).toBe(1)
      expect(saveAssociation).toHaveBeenCalledTimes(1)
    })

    it('无参数时应该导入所有字母与字母组合', async () => {
      const store = useLetterMemoryStore()
      vi.mocked(saveAssociation).mockResolvedValue({ ok: true })

      const count = await store.batchImportPresets()

      expect(count).toBe(5) // a, b, c + ch, sh
    })
  })
})
