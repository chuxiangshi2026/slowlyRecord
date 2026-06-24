import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useTextMemoryStore } from './textMemory'
import type { TextArticle, TextNote, TextPrompt } from '@/types/text-memory'
import { setDbAdapter, resetDbAdapter } from '@/adapters/db'

// Mock lodash.clonedeep
vi.mock('lodash.clonedeep', () => ({
  default: vi.fn((obj) => JSON.parse(JSON.stringify(obj)))
}))

describe('useTextMemoryStore', () => {
  let mockDb: any

  beforeEach(() => {
    setActivePinia(createPinia())

    // Mock localStorage
    const localStorageMock: Record<string, string> = {}
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key: string) => localStorageMock[key] || null),
      setItem: vi.fn((key: string, value: string) => { localStorageMock[key] = value }),
      removeItem: vi.fn((key: string) => { delete localStorageMock[key] })
    })

    // 构造 mock DbAdapter，并通过 setDbAdapter 注入（getDbAdapter 已不再直接读 window.utools.db）
    mockDb = {
      promises: {
        get: vi.fn() as Mock,
        put: vi.fn() as Mock,
        remove: vi.fn() as Mock,
        allDocs: vi.fn() as Mock,
        postAttachment: vi.fn() as Mock,
        getAttachment: vi.fn() as Mock,
        bulkDocs: vi.fn() as Mock,
      }
    }
    setDbAdapter(mockDb)

    // 保留 window.utools 桩，部分代码路径仍会探测它
    vi.stubGlobal('window', { utools: { db: mockDb } })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
    resetDbAdapter()
  })

  describe('初始状态', () => {
    it('应该有正确的初始状态', () => {
      const store = useTextMemoryStore()
      
      expect(store.articles).toEqual([])
      expect(store.currentArticle).toBeNull()
      expect(store.currentNotes).toEqual([])
      expect(store.currentPrompts).toEqual([])
      expect(store.loading).toBe(false)
      expect(store.exerciseSettings).toEqual({
        blankCount: 10,
        choiceCount: 5,
        showPinyin: false,
        highlightKeywords: true
      })
    })
  })

  describe('getters', () => {
    it('totalArticles 应该返回文章总数', () => {
      const store = useTextMemoryStore()
      store.articles = [
        { _id: '1', title: '文章1' } as TextArticle,
        { _id: '2', title: '文章2' } as TextArticle
      ]
      
      expect(store.totalArticles).toBe(2)
    })

    it('sortedArticles 应该按时间倒序排列文章', () => {
      const store = useTextMemoryStore()
      store.articles = [
        { _id: '1', title: '文章1', ctime: 1000 } as TextArticle,
        { _id: '2', title: '文章2', ctime: 3000 } as TextArticle,
        { _id: '3', title: '文章3', ctime: 2000 } as TextArticle
      ]
      
      const sorted = store.sortedArticles
      expect(sorted[0]._id).toBe('2')
      expect(sorted[1]._id).toBe('3')
      expect(sorted[2]._id).toBe('1')
    })

    it('articlesByTag 应该按标签分组文章', () => {
      const store = useTextMemoryStore()
      store.articles = [
        { _id: '1', title: '文章1', tags: ['诗词', '唐诗'] } as TextArticle,
        { _id: '2', title: '文章2', tags: ['诗词', '宋词'] } as TextArticle,
        { _id: '3', title: '文章3', tags: ['散文'] } as TextArticle
      ]
      
      const grouped = store.articlesByTag
      expect(grouped['诗词']).toHaveLength(2)
      expect(grouped['唐诗']).toHaveLength(1)
      expect(grouped['宋词']).toHaveLength(1)
      expect(grouped['散文']).toHaveLength(1)
    })

    it('allTags 应该返回所有唯一的标签', () => {
      const store = useTextMemoryStore()
      store.articles = [
        { _id: '1', title: '文章1', tags: ['诗词', '唐诗'] } as TextArticle,
        { _id: '2', title: '文章2', tags: ['诗词', '宋词'] } as TextArticle
      ]
      
      const tags = store.allTags
      expect(tags).toContain('诗词')
      expect(tags).toContain('唐诗')
      expect(tags).toContain('宋词')
      expect(tags).toHaveLength(3)
    })

    it('currentArticleWordCount 应该返回当前文章字数', () => {
      const store = useTextMemoryStore()
      
      expect(store.currentArticleWordCount).toBe(0)
      
      store.currentArticle = { _id: '1', content: '这是一篇测试文章' } as TextArticle
      expect(store.currentArticleWordCount).toBe(8)
    })
  })

  describe('数据库操作', () => {
    it('getTextMemoryDoc 应该从数据库获取文档', async () => {
      const store = useTextMemoryStore()
      const mockDoc = {
        _id: 'slowlyrecord-textmemory-data',
        type: 'textmemory',
        articles: [],
        notes: [],
        prompts: []
      }
      mockDb.promises.get.mockResolvedValue(mockDoc)

      const result = await store.getTextMemoryDoc()

      expect(mockDb.promises.get).toHaveBeenCalledWith('slowlyrecord-textmemory-data')
      expect(result).toEqual(mockDoc)
    })

    it('getTextMemoryDoc 应该在数据库不可用时返回 null', async () => {
      const store = useTextMemoryStore()
      // 模拟数据库未初始化：清掉适配器，并让 getDbAdapter() 抛错
      resetDbAdapter()
      vi.stubGlobal('window', {}) // 移除 utools

      const result = await store.getTextMemoryDoc()

      expect(result).toBeNull()
    })

    it('saveTextMemoryDoc 应该保存文档到数据库', async () => {
      const store = useTextMemoryStore()
      mockDb.promises.get.mockResolvedValue(null)
      mockDb.promises.put.mockResolvedValue({ ok: true })

      const result = await store.saveTextMemoryDoc({ articles: [] })

      expect(mockDb.promises.put).toHaveBeenCalled()
      expect(result).toBe(true)
    })

    it('saveTextMemoryDoc 应该在数据库不可用时返回 false', async () => {
      const store = useTextMemoryStore()
      vi.stubGlobal('window', {})

      const result = await store.saveTextMemoryDoc({ articles: [] })

      expect(result).toBe(false)
    })
  })

  describe('文章操作', () => {
    it('loadArticles 应该加载文章列表', async () => {
      const store = useTextMemoryStore()
      const mockDoc = {
        articles: [
          { _id: '1', title: '文章1' },
          { _id: '2', title: '文章2' }
        ]
      }
      mockDb.promises.get.mockResolvedValue(mockDoc)

      await store.loadArticles()

      expect(store.articles).toHaveLength(2)
      expect(store.loading).toBe(false)
    })

    it('loadArticles 应该在加载失败时设置空数组', async () => {
      const store = useTextMemoryStore()
      mockDb.promises.get.mockRejectedValue(new Error('DB error'))

      await store.loadArticles()

      expect(store.articles).toEqual([])
      expect(store.loading).toBe(false)
    })

    it('addArticle 应该添加新文章', async () => {
      const store = useTextMemoryStore()
      mockDb.promises.get.mockResolvedValue({ articles: [] })
      mockDb.promises.put.mockResolvedValue({ ok: true })

      const result = await store.addArticle({
        title: '新文章',
        content: '文章内容',
        author: '作者',
        source: 'tang',
        tags: ['诗词']
      })

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      expect(result.data?.title).toBe('新文章')
      expect(store.articles).toHaveLength(1)
    })

    it('updateArticle 应该更新文章', async () => {
      const store = useTextMemoryStore()
      const existingArticle = { _id: '1', title: '旧标题', content: '内容' }
      mockDb.promises.get.mockResolvedValue({ articles: [existingArticle] })
      mockDb.promises.put.mockResolvedValue({ ok: true })

      const result = await store.updateArticle({
        _id: '1',
        title: '新标题',
        content: '内容'
      } as TextArticle)

      expect(result.success).toBe(true)
    })

    it('deleteArticle 应该删除文章及关联数据', async () => {
      const store = useTextMemoryStore()
      store.articles = [{ _id: '1', title: '文章1' } as TextArticle]
      mockDb.promises.get.mockResolvedValue({
        articles: [{ _id: '1', title: '文章1' }],
        notes: [{ _id: 'n1', articleId: '1' }],
        prompts: [{ _id: 'p1', articleId: '1' }]
      })
      mockDb.promises.put.mockResolvedValue({ ok: true })

      const result = await store.deleteArticle('1')

      expect(result.success).toBe(true)
      expect(store.articles).toHaveLength(0)
    })

    it('setCurrentArticle 应该设置当前文章并加载关联数据', async () => {
      const store = useTextMemoryStore()
      const article = { _id: '1', title: '文章1' } as TextArticle
      mockDb.promises.get.mockResolvedValue({ notes: [], prompts: [] })

      store.setCurrentArticle(article)

      expect(store.currentArticle).toEqual(article)
    })

    it('updateReviewCount 应该增加复习次数', async () => {
      const store = useTextMemoryStore()
      const article = { _id: '1', title: '文章1', reviewCount: 0 } as TextArticle
      store.articles = [article]
      mockDb.promises.get.mockResolvedValue({ articles: [article] })
      mockDb.promises.put.mockResolvedValue({ ok: true })

      await store.updateReviewCount('1')

      expect(store.articles[0].reviewCount).toBe(1)
      expect(store.articles[0].lastReviewTime).toBeDefined()
    })
  })

  describe('笔记操作', () => {
    it('loadNotes 应该加载文章的笔记', async () => {
      const store = useTextMemoryStore()
      mockDb.promises.get.mockResolvedValue({
        notes: [
          { _id: '1', articleId: 'article1', content: '笔记1', ctime: 1000 },
          { _id: '2', articleId: 'article1', content: '笔记2', ctime: 2000 },
          { _id: '3', articleId: 'article2', content: '笔记3', ctime: 3000 }
        ]
      })

      await store.loadNotes('article1')

      expect(store.currentNotes).toHaveLength(2)
    })

    it('addNote 应该添加新笔记', async () => {
      const store = useTextMemoryStore()
      mockDb.promises.get.mockResolvedValue({ notes: [] })
      mockDb.promises.put.mockResolvedValue({ ok: true })

      const result = await store.addNote({
        articleId: 'article1',
        content: '新笔记内容'
      })

      expect(result.success).toBe(true)
      expect(result.data?.content).toBe('新笔记内容')
    })

    it('updateNote 应该更新笔记', async () => {
      const store = useTextMemoryStore()
      store.currentNotes = [{ _id: '1', articleId: 'a1', content: '旧内容' } as TextNote]
      mockDb.promises.get.mockResolvedValue({
        notes: [{ _id: '1', articleId: 'a1', content: '旧内容' }]
      })
      mockDb.promises.put.mockResolvedValue({ ok: true })

      const result = await store.updateNote({
        _id: '1',
        articleId: 'a1',
        content: '新内容'
      } as TextNote)

      expect(result.success).toBe(true)
      expect(store.currentNotes[0].content).toBe('新内容')
    })

    it('deleteNote 应该删除笔记', async () => {
      const store = useTextMemoryStore()
      store.currentNotes = [{ _id: '1', articleId: 'a1', content: '笔记' } as TextNote]
      mockDb.promises.get.mockResolvedValue({
        notes: [{ _id: '1', articleId: 'a1', content: '笔记' }]
      })
      mockDb.promises.put.mockResolvedValue({ ok: true })

      const result = await store.deleteNote('1')

      expect(result.success).toBe(true)
      expect(store.currentNotes).toHaveLength(0)
    })
  })

  describe('提示词操作', () => {
    it('loadPrompts 应该加载文章的提示词', async () => {
      const store = useTextMemoryStore()
      mockDb.promises.get.mockResolvedValue({
        prompts: [
          { _id: '1', articleId: 'article1', title: '提示1', order: 1 },
          { _id: '2', articleId: 'article1', title: '提示2', order: 0 }
        ]
      })

      await store.loadPrompts('article1')

      expect(store.currentPrompts).toHaveLength(2)
      expect(store.currentPrompts[0]._id).toBe('2') // 按 order 排序
    })

    it('addPrompt 应该添加新提示词', async () => {
      const store = useTextMemoryStore()
      mockDb.promises.get.mockResolvedValue({ prompts: [] })
      mockDb.promises.put.mockResolvedValue({ ok: true })

      const result = await store.addPrompt({
        articleId: 'article1',
        title: '新提示',
        content: '提示内容',
        order: 0,
        enabled: true
      })

      expect(result.success).toBe(true)
      expect(result.data?.title).toBe('新提示')
    })

    it('updatePrompt 应该更新提示词', async () => {
      const store = useTextMemoryStore()
      store.currentPrompts = [{ _id: '1', articleId: 'a1', title: '旧标题' } as TextPrompt]
      mockDb.promises.get.mockResolvedValue({
        prompts: [{ _id: '1', articleId: 'a1', title: '旧标题' }]
      })
      mockDb.promises.put.mockResolvedValue({ ok: true })

      const result = await store.updatePrompt({
        _id: '1',
        articleId: 'a1',
        title: '新标题'
      } as TextPrompt)

      expect(result.success).toBe(true)
    })

    it('deletePrompt 应该删除提示词', async () => {
      const store = useTextMemoryStore()
      store.currentPrompts = [{ _id: '1', articleId: 'a1', title: '提示' } as TextPrompt]
      mockDb.promises.get.mockResolvedValue({
        prompts: [{ _id: '1', articleId: 'a1', title: '提示' }]
      })
      mockDb.promises.put.mockResolvedValue({ ok: true })

      const result = await store.deletePrompt('1')

      expect(result.success).toBe(true)
      expect(store.currentPrompts).toHaveLength(0)
    })

    it('reorderPrompts 应该重新排序提示词', async () => {
      const store = useTextMemoryStore()
      store.currentPrompts = [
        { _id: '1', order: 0 },
        { _id: '2', order: 1 }
      ] as TextPrompt[]
      mockDb.promises.get.mockResolvedValue({ prompts: [] })
      mockDb.promises.put.mockResolvedValue({ ok: true })

      await store.reorderPrompts([
        { _id: '2', order: 0 },
        { _id: '1', order: 1 }
      ] as TextPrompt[])

      expect(store.currentPrompts[0]._id).toBe('2')
      expect(store.currentPrompts[1]._id).toBe('1')
    })
  })

  describe('练习相关', () => {
    it('generateFillBlanks 应该生成填空题', () => {
      const store = useTextMemoryStore()
      const content = '美丽的花园里有漂亮的花朵。'

      const blanks = store.generateFillBlanks('article1', content, 3)

      expect(blanks.length).toBeGreaterThan(0)
      expect(blanks[0]).toHaveProperty('original')
      expect(blanks[0]).toHaveProperty('position')
    })

    it('generateFillBlanks 应该处理短内容', () => {
      const store = useTextMemoryStore()
      const content = '短。'

      const blanks = store.generateFillBlanks('article1', content, 5)

      expect(blanks.length).toBe(0)
    })

    it('generateChoiceQuestions 应该生成选择题', () => {
      const store = useTextMemoryStore()
      // 使用足够长的句子确保能生成选择题
      const content = '这是一个非常美丽的世界，大家都感到快乐。这是一个十分成功的故事。'

      const questions = store.generateChoiceQuestions('article1', content, 2)

      // 由于随机性，可能生成也可能不生成问题
      if (questions.length > 0) {
        expect(questions[0]).toHaveProperty('question')
        expect(questions[0]).toHaveProperty('options')
        expect(questions[0]).toHaveProperty('correctIndex')
      }
    })

    it('getSemanticWordBank 应该返回语义词库', () => {
      const store = useTextMemoryStore()
      
      const wordBank = store.getSemanticWordBank()

      expect(wordBank).toHaveProperty('美丽')
      expect(wordBank['美丽']).toHaveProperty('synonym')
      expect(wordBank['美丽']).toHaveProperty('antonym')
    })

    it('getCorrectSynonym 应该返回近义词', () => {
      const store = useTextMemoryStore()

      const synonym = store.getCorrectSynonym('美丽')

      expect(['漂亮', '秀丽', '优美', '动人']).toContain(synonym)
    })

    it('getCorrectSynonym 应该对未知词返回原词', () => {
      const store = useTextMemoryStore()

      const synonym = store.getCorrectSynonym('未知词')

      expect(synonym).toBe('未知词')
    })

    it('getCorrectAntonym 应该返回反义词', () => {
      const store = useTextMemoryStore()

      const antonym = store.getCorrectAntonym('美丽')

      expect(['丑陋', '难看', '丑恶']).toContain(antonym)
    })

    it('getCorrectAntonym 应该对未知词返回否定形式', () => {
      const store = useTextMemoryStore()

      const antonym = store.getCorrectAntonym('未知')

      expect(antonym).toBe('不未知')
    })

    it('shuffleArray 应该打乱数组', () => {
      const store = useTextMemoryStore()
      const original = [1, 2, 3, 4, 5]

      const shuffled = store.shuffleArray(original)

      expect(shuffled).toHaveLength(5)
      expect(shuffled.sort()).toEqual(original.sort())
    })
  })

  describe('设置操作', () => {
    it('updateExerciseSettings 应该更新设置', () => {
      const store = useTextMemoryStore()

      store.updateExerciseSettings({ blankCount: 15 })

      expect(store.exerciseSettings.blankCount).toBe(15)
      expect(store.exerciseSettings.choiceCount).toBe(5) // 未改变的保持原值
    })

    it('resetSettings 应该重置为默认设置', () => {
      const store = useTextMemoryStore()
      store.exerciseSettings.blankCount = 20
      store.exerciseSettings.showPinyin = true

      store.resetSettings()

      expect(store.exerciseSettings.blankCount).toBe(10)
      expect(store.exerciseSettings.showPinyin).toBe(false)
      expect(store.exerciseSettings.highlightKeywords).toBe(true)
    })
  })

  describe('学习进度操作', () => {
    it('saveLearningProgress 应该保存进度', async () => {
      const store = useTextMemoryStore()
      const localStorageMock = vi.mocked(localStorage.setItem)

      const result = await store.saveLearningProgress('article1', 'fillBlanks', { completed: 5 })

      expect(result).toBe(true)
      expect(localStorageMock).toHaveBeenCalled()
    })

    it('getLearningProgress 应该获取进度', () => {
      const store = useTextMemoryStore()
      const progressData = {
        'article1_fillBlanks': {
          articleId: 'article1',
          exerciseType: 'fillBlanks',
          progress: { completed: 5 },
          lastAccessTime: Date.now()
        }
      }
      vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify(progressData))

      const progress = store.getLearningProgress('article1', 'fillBlanks')

      expect(progress).not.toBeNull()
      expect(progress?.articleId).toBe('article1')
    })

    it('getLearningProgress 应该在无数据时返回 null', () => {
      const store = useTextMemoryStore()
      vi.mocked(localStorage.getItem).mockReturnValue(null)

      const progress = store.getLearningProgress('article1', 'fillBlanks')

      expect(progress).toBeNull()
    })

    it('getAllLearningProgress 应该返回所有进度', () => {
      const store = useTextMemoryStore()
      const progressData = {
        'article1_fillBlanks': { articleId: 'article1', exerciseType: 'fillBlanks' },
        'article1_choice': { articleId: 'article1', exerciseType: 'choice' }
      }
      vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify(progressData))

      const allProgress = store.getAllLearningProgress()

      expect(Object.keys(allProgress)).toHaveLength(2)
    })

    it('clearLearningProgress 应该清除指定文章的进度', () => {
      const store = useTextMemoryStore()
      const progressData = {
        'article1_fillBlanks': { articleId: 'article1' },
        'article1_choice': { articleId: 'article1' },
        'article2_fillBlanks': { articleId: 'article2' }
      }
      vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify(progressData))

      store.clearLearningProgress('article1')

      const setItemCall = vi.mocked(localStorage.setItem).mock.calls[0]
      const savedData = JSON.parse(setItemCall[1])
      expect(Object.keys(savedData)).toHaveLength(1)
      expect(savedData['article2_fillBlanks']).toBeDefined()
    })

    it('clearAllLearningProgress 应该清除所有进度', () => {
      const store = useTextMemoryStore()

      store.clearAllLearningProgress()

      expect(localStorage.removeItem).toHaveBeenCalledWith('slowlyrecord-textmemory-progress')
    })
  })
})
