import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock uuid
vi.mock('uuid', () => ({
  v4: vi.fn().mockReturnValue('test-uuid-123')
}))

// Mock constants
vi.mock('@/constants', () => ({
  DB_KEY: 'words-list'
}))

// Mock element-plus
vi.mock('element-plus', () => ({
  ElMessage: {
    success: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    error: vi.fn()
  }
}))

// Mock logger
vi.mock('@/utils/logger', () => ({
  log: {
    i: vi.fn(),
    d: vi.fn(),
    w: vi.fn(),
    e: vi.fn()
  }
}))

// Mock local-dictionary
vi.mock('@/utils/local-dictionary', () => ({
  queryLocalDictionaryAsync: vi.fn()
}))

import { queryLocalDictionaryAsync } from '@/utils/local-dictionary'
import { ElMessage } from 'element-plus'

// Mock words store
const mockFindWord = vi.fn()
const mockAddAndUpdateWord = vi.fn()
const mockAddAndUpdateWords = vi.fn()
const mockTranslateWithPlatform = vi.fn()
const mockTranslateBatchWithPlatform = vi.fn()
const mockSetLastAddedWordText = vi.fn()

vi.mock('@/stores/words', () => ({
  useWordsStore: vi.fn(() => ({
    findWord: mockFindWord,
    addAndUpdateWord: mockAddAndUpdateWord,
    addAndUpdateWords: mockAddAndUpdateWords,
    translateWithPlatform: mockTranslateWithPlatform,
    translateBatchWithPlatform: mockTranslateBatchWithPlatform,
    setLastAddedWordText: mockSetLastAddedWordText,
    lastFocusWordText: '',
    words: []
  }))
}))

// Import after mocks
const { getInitWord, addWord, batchAddWords, batchTranslateAndAddWords } = await import('./str-util')

describe('str-util', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFindWord.mockReturnValue(null)
    mockTranslateWithPlatform.mockResolvedValue({
      success: true,
      explains: '释义',
      pronunciation: 'pronunciation.mp3',
      phonetic: '/fəʊnetɪk/'
    })
    // 批量入口默认实现：复用单词翻译 mock，保持顺序与输入一致
    mockTranslateBatchWithPlatform.mockImplementation(async (queries: string[]) =>
      Promise.all(queries.map(q => mockTranslateWithPlatform(q)))
    )
  })

  describe('getInitWord', () => {
    it('应该创建包含所有必需字段的单词对象', () => {
      const result = getInitWord('hello', '你好', 'pronunciation.mp3', 'image.jpg', '/həˈləʊ/')

      expect(result.text).toBe('hello')
      expect(result.explains).toBe('你好')
      expect(result.pronunciation).toBe('pronunciation.mp3')
      expect(result.image).toBe('image.jpg')
      expect(result.phonetic).toBe('/həˈləʊ/')
      expect(result._id).toBe('words-listtest-uuid-123')
      expect(result.explainedHidden).toBe(false)
      expect(result.isReview).toBe(true)
      expect(result.level).toBe(1)
      expect(result.remember).toBe(false)
    })

    it('应该使用默认值创建单词对象', () => {
      const result = getInitWord('test', '测试', '')

      expect(result.image).toBe('')
      expect(result.phonetic).toBe('')
    })

    it('应该设置正确的创建时间和学习时间', () => {
      const before = new Date()
      const result = getInitWord('hello', '你好', '')
      const after = new Date()

      expect(result.ctime.getTime()).toBeGreaterThanOrEqual(before.getTime())
      expect(result.ctime.getTime()).toBeLessThanOrEqual(after.getTime())
      expect(result.learnDate.getTime()).toBeGreaterThanOrEqual(before.getTime())
      expect(result.learnDate.getTime()).toBeLessThanOrEqual(after.getTime())
    })

    // === 词组测试 ===
    it('创建词组时应保留空格并自动推断 itemType 为 phrase', () => {
      const result = getInitWord('take off', '起飞；脱下', '')

      expect(result.text).toBe('take off')
      expect(result.itemType).toBe('phrase')
    })

    it('创建词组时应折叠多余空格', () => {
      const result = getInitWord('look   forward   to', '期待', '')

      expect(result.text).toBe('look forward to')
      expect(result.itemType).toBe('phrase')
    })

    it('创建单个单词时 itemType 应为 word', () => {
      const result = getInitWord('hello', '你好', '')

      expect(result.itemType).toBe('word')
    })
  })

  describe('addWord', () => {
    it('应该拒绝空单词', async () => {
      const result = await addWord('   ')

      expect(result.success).toBe(false)
      expect(result.message).toBe('不能添加空单词')
    })

    it('应该处理已存在且有释义的单词', async () => {
      const existingWord = {
        text: 'hello',
        explains: '你好',
        isReview: false,
        explainedHidden: true
      }
      mockFindWord.mockReturnValue(existingWord)

      const result = await addWord('hello')

      expect(result.success).toBe(false)
      expect(result.message).toBe('单词已存在')
      expect(mockAddAndUpdateWord).toHaveBeenCalled()
    })

    it('应该为已存在但没有释义的单词更新翻译', async () => {
      const existingWord = {
        text: 'hello',
        explains: '',
        isReview: false,
        explainedHidden: true,
        level: 0,
        phonetic: ''
      }
      mockFindWord.mockReturnValue(existingWord)

      const result = await addWord('hello')

      expect(result.success).toBe(true)
      expect(result.message).toBe('更新成功')
      expect(mockTranslateWithPlatform).toHaveBeenCalledWith('hello')
      expect(mockAddAndUpdateWord).toHaveBeenCalled()
      expect(ElMessage.success).toHaveBeenCalledWith('更新成功')
    })

    it('应该添加新单词到词库', async () => {
      mockFindWord.mockReturnValue(null)

      const result = await addWord('newword')

      expect(result.success).toBe(true)
      expect(mockTranslateWithPlatform).toHaveBeenCalledWith('newword')
      expect(mockAddAndUpdateWords).toHaveBeenCalled()
    })

    it('应该处理翻译失败的情况', async () => {
      mockFindWord.mockReturnValue(null)
      mockTranslateWithPlatform.mockResolvedValue({
        success: false,
        errorMsg: '翻译服务不可用'
      })

      const result = await addWord('failword')

      expect(result.success).toBe(false)
      expect(result.message).toBe('翻译服务不可用')
    })

    it('应该处理翻译 API 抛出异常', async () => {
      mockFindWord.mockReturnValue(null)
      mockTranslateWithPlatform.mockRejectedValue(new Error('Network error'))

      const result = await addWord('errorword')

      expect(result.success).toBe(false)
      expect(result.message).toContain('翻译失败')
    })

    it('应该从本地词典获取音标', async () => {
      mockFindWord.mockReturnValue(null)
      mockTranslateWithPlatform.mockResolvedValue({
        success: true,
        explains: '你好',
        pronunciation: '',
        phonetic: ''
      })
      vi.mocked(queryLocalDictionaryAsync).mockResolvedValue({
        phonetic: '/ˈləʊkəl/'
      } as any)

      const result = await addWord('localword')

      expect(queryLocalDictionaryAsync).toHaveBeenCalledWith('localword')
      expect(result.success).toBe(true)
    })

    it('应该过滤掉 URL 形式的音标', async () => {
      const existingWord = {
        text: 'hello',
        explains: '',
        isReview: false,
        explainedHidden: true,
        level: 0,
        phonetic: ''
      }
      mockFindWord.mockReturnValue(existingWord)
      mockTranslateWithPlatform.mockResolvedValue({
        success: true,
        explains: '你好',
        pronunciation: '',
        phonetic: 'https://example.com/audio.mp3'
      })
      vi.mocked(queryLocalDictionaryAsync).mockResolvedValue({
        phonetic: '/ˈhɛləʊ/'
      } as any)

      await addWord('hello')

      const updatedWord = mockAddAndUpdateWord.mock.calls[0][0]
      expect(updatedWord.phonetic).toBe('/ˈhɛləʊ/')
    })
  })

  describe('batchTranslateAndAddWords', () => {
    it('应该过滤重复单词', async () => {
      mockFindWord.mockReturnValue(null)

      await batchTranslateAndAddWords(['word', 'word', 'word'])

      expect(mockTranslateWithPlatform).toHaveBeenCalledTimes(1)
    })

    it('应该过滤空单词', async () => {
      mockFindWord.mockReturnValue(null)

      await batchTranslateAndAddWords(['word', '   ', '', 'another'])

      expect(mockTranslateWithPlatform).toHaveBeenCalledTimes(2)
    })

    it('应该跳过已存在且有释义的单词', async () => {
      mockFindWord.mockReturnValue({
        text: 'existing',
        explains: '已存在',
        isReview: true
      })

      await batchTranslateAndAddWords(['existing'])

      expect(ElMessage.info).toHaveBeenCalledWith('单词都已存在，无需处理')
    })

    it('应该处理已存在但无释义的单词', async () => {
      mockFindWord.mockReturnValueOnce({
        text: 'existing',
        explains: '',
        isReview: true
      }).mockReturnValueOnce(null)

      await batchTranslateAndAddWords(['existing', 'newword'])

      expect(mockTranslateWithPlatform).toHaveBeenCalled()
    })

    it('应该在处理空列表时显示警告', async () => {
      await batchTranslateAndAddWords([])

      expect(ElMessage.warning).toHaveBeenCalledWith('没有可添加单词')
    })

    it('应该在全是重复单词时显示信息提示', async () => {
      mockFindWord.mockReturnValue({
        text: 'existing',
        explains: '已存在',
        isReview: true
      })

      await batchTranslateAndAddWords(['existing'])

      expect(ElMessage.info).toHaveBeenCalledWith('单词都已存在，无需处理')
    })

    it('应该调用进度回调', async () => {
      mockFindWord.mockReturnValue(null)
      const onProgress = vi.fn()

      await batchTranslateAndAddWords(['word1', 'word2'], onProgress)

      expect(onProgress).toHaveBeenCalled()
    })

    // === 词组批量测试 ===
    it('批量添加词组时应保留空格', async () => {
      mockFindWord.mockReturnValue(null)

      await batchTranslateAndAddWords(['take off', 'look forward to'])

      expect(mockTranslateWithPlatform).toHaveBeenCalledWith('take off')
      expect(mockTranslateWithPlatform).toHaveBeenCalledWith('look forward to')
    })

    it('批量添加词组时应折叠多余空格后去重', async () => {
      mockFindWord.mockReturnValue(null)

      await batchTranslateAndAddWords(['take  off', 'take off', 'take off'])

      // 虽然写的时候有多余空格，但 normalizeItemText 后前两者相同，只应处理一次（第三个重复）
      expect(mockTranslateWithPlatform).toHaveBeenCalledTimes(1)
    })
  })

  describe('batchAddWords', () => {
    it('应该调用 batchTranslateAndAddWords', async () => {
      mockFindWord.mockReturnValue(null)

      await batchAddWords(['word1', 'word2'])

      expect(mockTranslateWithPlatform).toHaveBeenCalled()
    })
  })
})
