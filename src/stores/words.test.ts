import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import type { Word, TranslationPlatform, OcrPlatform, MemoryFirmnessTpye } from '@/types/words'

// Mock localStorage
global.localStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn()
} as unknown as Storage

// Mock wordbank-manager
vi.mock('@/utils/wordbank-manager.ts', () => ({
  getAllWordBanks: vi.fn(),
  getCurrentWordBankId: vi.fn(() => Promise.resolve('default')),
  setCurrentWordBankId: vi.fn(),
  getWordBank: vi.fn(),
  saveWordBank: vi.fn(),
  createDefaultWordBank: vi.fn(() => ({
    id: 'default',
    name: '默认词库',
    words: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    isDefault: true
  }))
}))

// Mock db-util
vi.mock('@/utils/db-util.ts', () => ({
  addAndUpdateDbWord: vi.fn(() => Promise.resolve()),
  cleanDbWord: vi.fn(),
  listDbWords: vi.fn(() => []),
  removeDbWordById: vi.fn(),
  updateDbWordList: vi.fn(() => Promise.resolve())
}))

// Mock user-set-db-util
vi.mock('@/utils/user-set-db-util.ts', () => ({
  addAndUpdateSetDb: vi.fn(),
  getSetDb: vi.fn(() => null)
}))

// Mock logger
vi.mock('@/utils/logger.ts', () => ({
  log: {
    i: vi.fn(),
    e: vi.fn(),
    w: vi.fn()
  }
}))

// Mock translation-api
vi.mock('@/utils/translation-api', () => ({
  translateWithPlatform: vi.fn(() => Promise.resolve({ success: true, explains: '翻译结果' }))
}))

// Mock uuid
vi.mock('uuid', () => ({
  v4: vi.fn(() => 'mock-uuid-1234')
}))

import {
  getWordBank,
  saveWordBank,
  getCurrentWordBankId,
  type WordBank
} from '@/utils/wordbank-manager.ts'

import { addAndUpdateSetDb, getSetDb } from '@/utils/user-set-db-util.ts'
import { addAndUpdateDbWord, cleanDbWord, listDbWords, removeDbWordById, updateDbWordList } from '@/utils/db-util.ts'
import { translateWithPlatform } from '@/utils/translation-api'

// 辅助函数：创建标准 Word 对象
function createWord(overrides: Partial<Word> = {}): Word {
  return {
    _id: '1',
    text: 'hello',
    explains: '你好',
    isReview: true,
    ctime: new Date(),
    learnDate: new Date(),
    level: 1,
    explainedHidden: false,
    remember: false,
    ...overrides
  }
}

// 辅助函数：创建标准 WordBank 对象
function createWordBank(overrides: Partial<WordBank> = {}): WordBank {
  return {
    id: 'default',
    name: '默认词库',
    words: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    isDefault: true,
    ...overrides
  }
}

// 动态导入 store 以避免在 mock 之前加载
describe('useWordsStore', () => {
  let useWordsStore: typeof import('./words').useWordsStore

  beforeEach(async () => {
    setActivePinia(createPinia())
    vi.resetAllMocks()
    // 动态导入 store
    useWordsStore = (await import('./words')).useWordsStore
  })

  describe('初始状态', () => {
    it('应该有正确的初始值', () => {
      const store = useWordsStore()

      expect(store.words).toEqual([])
      expect(store.currentWordBankId).toBe('')
      expect(store.currentWordBank).toBeNull()
      expect(store.count).toBe(0)
      expect(store.forgetCount).toBe(0)
      expect(store.rememberCount).toBe(0)
      expect(store.reviewCount).toBe(0)
      expect(store.lastAddedWordText).toBe('')
      expect(store.currentTranslationPlatform).toBe('glm')
      expect(store.currentOcrPlatform).toBe('local')
      expect(store.memoryFirmness).toBe('正常')
      expect(store.pluginStatus).toBe(false)
      expect(store.shortcutEnabled).toBe(false)
      expect(store.focusMode).toEqual({
        alwaysOnTop: true,
        opacity: 1.0,
        edgeStickEnabled: true
      })
      expect(store.lastVisitedPage).toBe('')
      expect(store.hiddenExplain).toBe('')
    })
  })

  describe('单词列表操作', () => {
    it('应该能直接修改单词列表', () => {
      const store = useWordsStore()
      const mockWords: Word[] = [createWord()]

      store.words = mockWords

      expect(store.words).toEqual(mockWords)
      expect(store.count).toBe(1)
    })
  })

  describe('词库切换', () => {
    it('应该成功切换词库', async () => {
      const store = useWordsStore()
      const mockBank = createWordBank({
        id: 'test-bank',
        name: '测试词库',
        words: [createWord({ text: 'test', explains: '测试' })]
      })

      vi.mocked(getWordBank).mockResolvedValue(mockBank)

      const result = await store.switchWordBank('test-bank')

      expect(result).toBe(true)
      expect(store.currentWordBankId).toBe('test-bank')
      expect(store.currentWordBank).toEqual(mockBank)
      expect(store.words.length).toBe(1)
    })

    it('切换词库失败时应该返回 false', async () => {
      const store = useWordsStore()

      vi.mocked(getWordBank).mockResolvedValue(null)

      const result = await store.switchWordBank('non-existent')

      expect(result).toBe(false)
    })
  })

  describe('添加和更新单词', () => {
    it('应该添加新单词到当前词库', async () => {
      const store = useWordsStore()
      const mockBank = createWordBank({ words: [] })

      store.currentWordBankId = 'default'
      store.currentWordBank = mockBank

      const newWord = createWord()
      vi.mocked(saveWordBank).mockResolvedValue(true)

      await store.addAndUpdateWord(newWord)

      expect(store.words.length).toBe(1)
      expect(store.words[0].text).toBe('hello')
      expect(mockBank.words.length).toBe(1)
      expect(saveWordBank).toHaveBeenCalledWith(mockBank)
    })

    it('应该更新已存在的单词', async () => {
      const store = useWordsStore()
      const existingWord = createWord()
      const mockBank = createWordBank({ words: [{ ...existingWord }] })

      store.currentWordBankId = 'default'
      store.currentWordBank = mockBank
      store.words = [{ ...existingWord }]

      const updatedWord: Word = { ...existingWord, explains: '你好啊', level: 2 }

      vi.mocked(saveWordBank).mockResolvedValue(true)

      await store.addAndUpdateWord(updatedWord)

      expect(store.words[0].explains).toBe('你好啊')
      expect(store.words[0].level).toBe(2)
    })

    it('currentWordBank 不匹配时应该重新加载词库', async () => {
      const store = useWordsStore()
      store.currentWordBankId = 'default'
      store.currentWordBank = createWordBank({ id: 'other-bank' })
      store.words = []

      const reloadedBank = createWordBank({ words: [] })
      vi.mocked(getWordBank).mockResolvedValue(reloadedBank)
      vi.mocked(saveWordBank).mockResolvedValue(true)

      const newWord = createWord()
      await store.addAndUpdateWord(newWord)

      expect(getWordBank).toHaveBeenCalledWith('default')
      expect(store.currentWordBank).toEqual(reloadedBank)
    })
  })

  describe('批量添加和更新单词', () => {
    it('应该批量添加新单词到当前词库', async () => {
      const store = useWordsStore()
      store.currentWordBankId = 'default'

      const mockBank = createWordBank({ words: [] })
      vi.mocked(getWordBank).mockResolvedValue(mockBank)
      vi.mocked(saveWordBank).mockResolvedValue(true)

      const words: Word[] = [
        createWord({ _id: '1', text: 'hello' }),
        createWord({ _id: '2', text: 'world' })
      ]

      const result = await store.addAndUpdateWords(words)

      expect(result).toBe(true)
      expect(store.words.length).toBe(2)
      expect(mockBank.words.length).toBe(2)
      expect(updateDbWordList).toHaveBeenCalledWith(words)
    })

    it('应该去重合并批量添加的单词', async () => {
      const store = useWordsStore()
      store.currentWordBankId = 'default'

      const existingWord = createWord({ _id: '1', text: 'hello' })
      const mockBank = createWordBank({ words: [existingWord] })
      vi.mocked(getWordBank).mockResolvedValue(mockBank)
      vi.mocked(saveWordBank).mockResolvedValue(true)

      const words: Word[] = [
        createWord({ _id: '1', text: 'hello' }), // 重复
        createWord({ _id: '2', text: 'world' })  // 新词
      ]

      const result = await store.addAndUpdateWords(words)

      expect(result).toBe(true)
      // 词库中应该只有 2 个：原有 1 个 + 去重后新增 1 个
      expect(mockBank.words.length).toBe(2)
    })

    // === 词组批量添加测试 ===
    it('批量添加词组时应保留空格', async () => {
      const store = useWordsStore()
      store.currentWordBankId = 'default'

      const mockBank = createWordBank({ words: [] })
      vi.mocked(getWordBank).mockResolvedValue(mockBank)
      vi.mocked(saveWordBank).mockResolvedValue(true)

      const words: Word[] = [
        createWord({ _id: '1', text: 'take off', itemType: 'phrase' }),
        createWord({ _id: '2', text: 'look forward to', itemType: 'phrase' })
      ]

      const result = await store.addAndUpdateWords(words)

      expect(result).toBe(true)
      expect(store.words.length).toBe(2)
      expect(store.words[0].text).toBe('take off')
      expect(store.words[1].text).toBe('look forward to')
    })

    it('批量添加词组时词组与单词不应互相去重', async () => {
      const store = useWordsStore()
      store.currentWordBankId = 'default'

      const existingWord = createWord({ _id: '1', text: 'takeoff' })
      const mockBank = createWordBank({ words: [existingWord] })
      vi.mocked(getWordBank).mockResolvedValue(mockBank)
      vi.mocked(saveWordBank).mockResolvedValue(true)

      // "take off" 不应与 "takeoff" 视为重复
      const words: Word[] = [
        createWord({ _id: '2', text: 'take off', itemType: 'phrase' })
      ]

      const result = await store.addAndUpdateWords(words)

      expect(result).toBe(true)
      expect(mockBank.words.length).toBe(2)
    })

    it('批量添加词组时多余空格应折叠后去重', async () => {
      const store = useWordsStore()
      store.currentWordBankId = 'default'

      const mockBank = createWordBank({ words: [] })
      vi.mocked(getWordBank).mockResolvedValue(mockBank)
      vi.mocked(saveWordBank).mockResolvedValue(true)

      // "take  off" 和 "take off" 规范化后相同，应视为重复
      const words: Word[] = [
        createWord({ _id: '1', text: 'take  off', itemType: 'phrase' }),
        createWord({ _id: '2', text: 'take off', itemType: 'phrase' })
      ]

      const result = await store.addAndUpdateWords(words)

      expect(result).toBe(true)
      // store.words 经过 pushWords 内去重后应只有 1 个
      expect(store.words.length).toBe(1)
      expect(store.words[0].text).toBe('take off')
    })

    it('批量添加失败时应该返回 false', async () => {
      const store = useWordsStore()
      store.currentWordBankId = 'default'

      vi.mocked(getWordBank).mockRejectedValue(new Error('DB error'))

      const result = await store.addAndUpdateWords([createWord()])

      expect(result).toBe(false)
    })

    it('词库不存在时应该正常处理', async () => {
      const store = useWordsStore()
      store.currentWordBankId = 'default'

      vi.mocked(getWordBank).mockResolvedValue(null)
      vi.mocked(saveWordBank).mockResolvedValue(true)

      const result = await store.addAndUpdateWords([createWord()])

      // 词库不存在，不保存，但仍添加到内存
      expect(result).toBe(true)
      expect(store.words.length).toBe(1)
    })
  })

  describe('删除单词', () => {
    it('应该从词库中删除单词', async () => {
      const store = useWordsStore()
      const wordToDelete = createWord()
      const mockBank = createWordBank({ words: [wordToDelete] })

      store.currentWordBankId = 'default'
      store.currentWordBank = mockBank
      store.words = [wordToDelete]

      vi.mocked(saveWordBank).mockResolvedValue(true)

      await store.deleteWord(0)

      expect(store.words.length).toBe(0)
      expect(mockBank.words.length).toBe(0)
      expect(removeDbWordById).toHaveBeenCalledWith('1')
    })

    it('删除不存在的索引应该不报错', async () => {
      const store = useWordsStore()
      store.words = []

      await expect(store.deleteWord(0)).resolves.not.toThrow()
      expect(store.words.length).toBe(0)
    })

    it('删除负数索引应该不报错', async () => {
      const store = useWordsStore()
      store.words = [createWord()]

      await expect(store.deleteWord(-1)).resolves.not.toThrow()
      expect(store.words.length).toBe(1)
    })

    it('删除时 currentWordBank 不匹配应该重新加载词库', async () => {
      const store = useWordsStore()
      const word = createWord()
      store.currentWordBankId = 'default'
      store.currentWordBank = createWordBank({ id: 'other-bank' })
      store.words = [word]

      const reloadedBank = createWordBank({ words: [word] })
      vi.mocked(getWordBank).mockResolvedValue(reloadedBank)
      vi.mocked(saveWordBank).mockResolvedValue(true)

      await store.deleteWord(0)

      expect(store.words.length).toBe(0)
      expect(reloadedBank.words.length).toBe(0)
    })
  })

  describe('removeWords', () => {
    it('应该清空单词列表并清理数据库', () => {
      const store = useWordsStore()
      store.words = [createWord()]

      store.removeWords()

      expect(store.words).toEqual([])
      expect(cleanDbWord).toHaveBeenCalled()
    })
  })

  describe('计算属性', () => {
    it('应该正确计算待复习单词数', () => {
      const store = useWordsStore()
      store.words = [
        createWord({ _id: '1', text: 'a', isReview: true }),
        createWord({ _id: '2', text: 'b', isReview: false }),
        createWord({ _id: '3', text: 'c', isReview: true })
      ]

      expect(store.forgetCount).toBe(2)
    })

    it('应该正确计算已记住单词数', () => {
      const store = useWordsStore()
      store.words = [
        createWord({ _id: '1', text: 'a', remember: true, isReview: false, level: 12 }),
        createWord({ _id: '2', text: 'b', remember: false, isReview: false }),
        createWord({ _id: '3', text: 'c', remember: true, isReview: false, level: 12 })
      ]

      expect(store.rememberCount).toBe(2)
    })

    it('应该正确计算已复习单词数', () => {
      const store = useWordsStore()
      store.words = [
        createWord({ _id: '1', text: 'a', isReview: false, remember: false }),
        createWord({ _id: '2', text: 'b', isReview: false, remember: true }),
        createWord({ _id: '3', text: 'c', isReview: true })
      ]

      // reviewCount = 非 isReview 数量 - rememberCount
      // = 2 - 1 = 1
      expect(store.reviewCount).toBe(1)
    })
  })

  describe('findWord', () => {
    it('应该能找到存在的单词', () => {
      const store = useWordsStore()
      store.words = [createWord()]

      const found = store.findWord('hello')

      expect(found).toBeDefined()
      expect(found?.text).toBe('hello')
    })

    it('应该返回 undefined 当单词不存在', () => {
      const store = useWordsStore()
      store.words = []

      const found = store.findWord('nonexistent')

      expect(found).toBeUndefined()
    })

    // === 词组 find 测试 ===
    it('应该能找到存在的词组', () => {
      const store = useWordsStore()
      store.words = [createWord({ text: 'take off', itemType: 'phrase' })]

      const found = store.findWord('take off')

      expect(found).toBeDefined()
      expect(found?.text).toBe('take off')
    })

    it('查找词组时应折叠多余空格匹配', () => {
      const store = useWordsStore()
      store.words = [createWord({ text: 'take off', itemType: 'phrase' })]

      // 传入多余空格，应能折叠后匹配
      const found = store.findWord('take  off')

      expect(found).toBeDefined()
      expect(found?.text).toBe('take off')
    })

    it('查找词组时不应与单字词混淆', () => {
      const store = useWordsStore()
      store.words = [
        createWord({ text: 'takeoff' }),
        createWord({ text: 'take off', itemType: 'phrase' })
      ]

      const foundWord = store.findWord('takeoff')
      expect(foundWord).toBeDefined()
      expect(foundWord?.text).toBe('takeoff')

      const foundPhrase = store.findWord('take off')
      expect(foundPhrase).toBeDefined()
      expect(foundPhrase?.text).toBe('take off')
      expect(foundPhrase?.itemType).toBe('phrase')
    })
  })

  describe('setLastAddedWordText', () => {
    it('应该更新最新添加的单词文本', () => {
      const store = useWordsStore()
      store.setLastAddedWordText('world')
      expect(store.lastAddedWordText).toBe('world')
    })

    it('应该支持空字符串', () => {
      const store = useWordsStore()
      store.setLastAddedWordText('hello')
      store.setLastAddedWordText('')
      expect(store.lastAddedWordText).toBe('')
    })
  })

  describe('setClosePlugin', () => {
    it('应该更新插件状态并持久化（用户设置已存在）', () => {
      const store = useWordsStore()
      const mockUserSet = { pluginStatus: false, shortcutEnabled: false }
      vi.mocked(getSetDb).mockReturnValue(mockUserSet as any)

      store.setClosePlugin(true)

      expect(store.pluginStatus).toBe(true)
      expect(mockUserSet.pluginStatus).toBe(true)
      expect(addAndUpdateSetDb).toHaveBeenCalledWith(mockUserSet)
    })

    it('应该初始化用户设置后再持久化（用户设置不存在）', () => {
      const store = useWordsStore()
      vi.mocked(getSetDb).mockReturnValue(null)

      store.setClosePlugin(true)

      expect(store.pluginStatus).toBe(true)
      expect(addAndUpdateSetDb).toHaveBeenCalled()
    })
  })

  describe('setTranslationPlatform', () => {
    it('应该更新翻译平台并持久化', () => {
      const store = useWordsStore()
      const mockUserSet = { translationPlatform: 'tencent' }
      vi.mocked(getSetDb).mockReturnValue(mockUserSet as any)

      store.setTranslationPlatform('youdao')

      expect(store.currentTranslationPlatform).toBe('youdao')
      expect(mockUserSet.translationPlatform).toBe('youdao')
      expect(addAndUpdateSetDb).toHaveBeenCalledWith(mockUserSet)
    })

    it('应该支持所有翻译平台', () => {
      const store = useWordsStore()
      const platforms: TranslationPlatform[] = ['glm', 'tencent', 'youdao', 'baidu', 'ali', 'deepseek', 'qwen', 'kimi', 'ollama', 'local']

      for (const platform of platforms) {
        store.setTranslationPlatform(platform)
        expect(store.currentTranslationPlatform).toBe(platform)
      }
    })
  })

  describe('setOcrPlatform', () => {
    it('应该更新 OCR 平台并持久化', () => {
      const store = useWordsStore()
      const mockUserSet = { ocrPlatform: 'tencent' }
      vi.mocked(getSetDb).mockReturnValue(mockUserSet as any)

      store.setOcrPlatform('baidu')

      expect(store.currentOcrPlatform).toBe('baidu')
      expect(mockUserSet.ocrPlatform).toBe('baidu')
      expect(addAndUpdateSetDb).toHaveBeenCalled()
    })
  })

  describe('setMemoryFirmness', () => {
    it('应该更新记忆牢固度并持久化', () => {
      const store = useWordsStore()
      const mockUserSet = { memoryFirmness: '正常' }
      vi.mocked(getSetDb).mockReturnValue(mockUserSet as any)

      store.setMemoryFirmness('较强')

      expect(store.memoryFirmness).toBe('较强')
      expect(mockUserSet.memoryFirmness).toBe('较强')
      expect(addAndUpdateSetDb).toHaveBeenCalled()
    })

    it('应该支持所有记忆牢固度类型', () => {
      const store = useWordsStore()
      const firmnessLevels: MemoryFirmnessTpye[] = ['正常', '较强', '极强']

      for (const f of firmnessLevels) {
        store.setMemoryFirmness(f)
        expect(store.memoryFirmness).toBe(f)
      }
    })
  })

  describe('setShortcutEnabled', () => {
    it('应该更新快捷键开关并持久化', () => {
      const store = useWordsStore()
      const mockUserSet = { shortcutEnabled: false }
      vi.mocked(getSetDb).mockReturnValue(mockUserSet as any)

      store.setShortcutEnabled(true)

      expect(store.shortcutEnabled).toBe(true)
      expect(mockUserSet.shortcutEnabled).toBe(true)
      expect(addAndUpdateSetDb).toHaveBeenCalled()
    })
  })

  describe('setFocusMode', () => {
    it('应该部分更新专注模式设置并持久化', () => {
      const store = useWordsStore()
      const mockUserSet = { focusMode: { alwaysOnTop: true, opacity: 1.0, edgeStickEnabled: true } }
      vi.mocked(getSetDb).mockReturnValue(mockUserSet as any)

      store.setFocusMode({ opacity: 0.5 })

      expect(store.focusMode.opacity).toBe(0.5)
      expect(store.focusMode.alwaysOnTop).toBe(true) // 保留原值
      expect(addAndUpdateSetDb).toHaveBeenCalled()
    })

    it('应该支持同时更新多个专注模式设置', () => {
      const store = useWordsStore()

      store.setFocusMode({ alwaysOnTop: false, edgeStickEnabled: false })

      expect(store.focusMode.alwaysOnTop).toBe(false)
      expect(store.focusMode.edgeStickEnabled).toBe(false)
      expect(store.focusMode.opacity).toBe(1.0) // 保留默认
    })
  })

  describe('setLastVisitedPage', () => {
    it('应该更新最后访问页面路径', () => {
      const store = useWordsStore()
      store.setLastVisitedPage('/review')
      expect(store.lastVisitedPage).toBe('/review')
    })
  })

  describe('setUserApiKeys', () => {
    it('应该批量更新用户 API 密钥', () => {
      const store = useWordsStore()
      const keys = {
        glm: { appkey: 'glm-key', key: 'glm-secret' },
        tencent: { appkey: 'tencent-key', key: 'tencent-secret' },
        ali: { appkey: '', key: '' },
        youdao: { appkey: '', key: '' },
        baidu: { appkey: '', key: '' },
        utoolsai: { appkey: '', key: '' },
        ollama: { appkey: '', key: '' },
        deepseek: { appkey: '', key: '' },
        qwen: { appkey: '', key: '' },
        kimi: { appkey: '', key: '' },
        local: { appkey: '', key: '' }
      }

      store.setUserApiKeys(keys)

      expect(store.userApiKeys.glm.appkey).toBe('glm-key')
      expect(store.userApiKeys.tencent.key).toBe('tencent-secret')
    })
  })

  describe('setApiKey / getApiKey', () => {
    it('应该设置单个翻译 API 密钥并持久化', () => {
      const store = useWordsStore()
      const mockUserSet = { keys: {} }
      vi.mocked(getSetDb).mockReturnValue(mockUserSet as any)

      store.setApiKey('youdao', 'my-appkey', 'my-key')

      expect(store.userApiKeys.youdao.appkey).toBe('my-appkey')
      expect(store.userApiKeys.youdao.key).toBe('my-key')
      expect(addAndUpdateSetDb).toHaveBeenCalled()
    })

    it('用户设置存在时应该更新已有 keys', () => {
      const store = useWordsStore()
      const mockUserSet = { keys: { youdao: { appkey: 'old', key: 'old' } } }
      vi.mocked(getSetDb).mockReturnValue(mockUserSet as any)

      store.setApiKey('youdao', 'new-appkey', 'new-key')

      expect(store.userApiKeys.youdao.appkey).toBe('new-appkey')
      expect(mockUserSet.keys.youdao.appkey).toBe('new-appkey')
    })

    it('用户设置不存在时应该初始化后再持久化', () => {
      const store = useWordsStore()
      vi.mocked(getSetDb).mockReturnValue(null)

      store.setApiKey('baidu', 'b-appkey', 'b-key')

      expect(store.userApiKeys.baidu.appkey).toBe('b-appkey')
      expect(addAndUpdateSetDb).toHaveBeenCalled()
    })

    it('getApiKey 应该返回对应平台的密钥', () => {
      const store = useWordsStore()
      store.setApiKey('glm', 'glm-appkey', 'glm-key')

      const result = store.getApiKey('glm')

      expect(result.appkey).toBe('glm-appkey')
      expect(result.key).toBe('glm-key')
    })
  })

  describe('setOcrApiKey / getOcrApiKey', () => {
    it('应该设置单个 OCR API 密钥并持久化', () => {
      const store = useWordsStore()
      const mockUserSet = { ocrKeys: {} }
      vi.mocked(getSetDb).mockReturnValue(mockUserSet as any)

      store.setOcrApiKey('baidu', 'ocr-appkey', 'ocr-key')

      expect(store.userOcrApiKeys.baidu.appkey).toBe('ocr-appkey')
      expect(store.userOcrApiKeys.baidu.key).toBe('ocr-key')
      expect(addAndUpdateSetDb).toHaveBeenCalled()
    })

    it('用户设置不存在时应该初始化后再持久化', () => {
      const store = useWordsStore()
      vi.mocked(getSetDb).mockReturnValue(null)

      store.setOcrApiKey('ali', 'ali-appkey', 'ali-key')

      expect(store.userOcrApiKeys.ali.appkey).toBe('ali-appkey')
      expect(addAndUpdateSetDb).toHaveBeenCalled()
    })

    it('getOcrApiKey 应该返回对应平台的密钥', () => {
      const store = useWordsStore()

      const result = store.getOcrApiKey('tencent')

      expect(result).toBeDefined()
      expect(result.appkey).toBeDefined()
      expect(result.key).toBeDefined()
    })
  })

  describe('initWordBankInfo', () => {
    it('应该初始化词库 ID 和词库信息', async () => {
      const store = useWordsStore()
      const mockBank = createWordBank({ id: 'my-bank' })
      vi.mocked(getCurrentWordBankId).mockResolvedValue('my-bank')
      vi.mocked(getWordBank).mockResolvedValue(mockBank)

      await store.initWordBankInfo()

      expect(store.currentWordBankId).toBe('my-bank')
      expect(store.currentWordBank).toEqual(mockBank)
    })
  })

  describe('listWords', () => {
    it('应该从词库获取单词', async () => {
      const store = useWordsStore()
      const word = createWord()
      const mockBank = createWordBank({ words: [word] })
      vi.mocked(getWordBank).mockResolvedValue(mockBank)

      store.currentWordBankId = 'default'
      const result = await store.listWords()

      expect(result.length).toBe(1)
      expect(store.words.length).toBe(1)
    })

    it('应该从旧数据库迁移数据到空的默认词库', async () => {
      const store = useWordsStore()
      const oldWord = createWord({ text: 'old-word' })
      const mockBank = createWordBank({ words: [], isDefault: true })

      vi.mocked(getWordBank).mockResolvedValue(mockBank)
      vi.mocked(listDbWords).mockReturnValue([oldWord])
      vi.mocked(saveWordBank).mockResolvedValue(true)

      store.currentWordBankId = 'default'
      const result = await store.listWords()

      expect(store.words.length).toBe(1)
      expect(store.words[0].text).toBe('old-word')
      expect(saveWordBank).toHaveBeenCalled()
    })

    it('空的默认词库且旧数据库也为空时应该正常加载', async () => {
      const store = useWordsStore()
      const mockBank = createWordBank({ words: [], isDefault: true })

      vi.mocked(getWordBank).mockResolvedValue(mockBank)
      vi.mocked(listDbWords).mockReturnValue([])

      store.currentWordBankId = 'default'
      const result = await store.listWords()

      expect(store.words).toEqual([])
    })

    it('词库信息未初始化时应该先初始化', async () => {
      const store = useWordsStore()
      const mockBank = createWordBank({ id: 'auto-bank' })

      vi.mocked(getCurrentWordBankId).mockResolvedValue('auto-bank')
      vi.mocked(getWordBank).mockResolvedValue(mockBank)

      store.currentWordBankId = ''
      await store.listWords()

      expect(store.currentWordBankId).toBe('auto-bank')
    })

    it('非默认词库且非空时应该直接加载', async () => {
      const store = useWordsStore()
      const word = createWord()
      const mockBank = createWordBank({ words: [word], isDefault: false, id: 'custom-bank' })

      vi.mocked(getWordBank).mockResolvedValue(mockBank)

      store.currentWordBankId = 'custom-bank'
      await store.listWords()

      expect(store.words.length).toBe(1)
      expect(listDbWords).not.toHaveBeenCalled() // 不需要检查旧数据库
    })
  })

  describe('upReview', () => {
    it('应该将到了复习时间的单词设为待复习', () => {
      const store = useWordsStore()
      // learnDate 是很久之前，level=1，间隔5分钟，肯定已过复习时间
      const pastDate = new Date(Date.now() - 100 * 60 * 1000)
      const word = createWord({ isReview: false, learnDate: pastDate, ctime: pastDate })

      store.words = [word]
      store.upReview()

      expect(store.words[0].isReview).toBe(true)
      expect(addAndUpdateDbWord).toHaveBeenCalled()
    })

    it('不应该将还没到复习时间的非新单词设为待复习', () => {
      const store = useWordsStore()
      // learnDate 是2分钟前，level=2 对应间隔30分钟，还没到复习时间
      // ctime 和 learnDate 差距大，不是新单词
      // now - learnDate > 60000 (已过1分钟) => 满足取消条件
      const learnDate = new Date(Date.now() - 2 * 60 * 1000)
      const ctime = new Date(Date.now() - 200 * 60 * 1000)
      const word = createWord({ isReview: true, learnDate, ctime, level: 2 })

      store.words = [word]
      store.upReview()

      expect(store.words[0].isReview).toBe(false)
    })

    it('新添加的单词不应该被取消待复习状态', () => {
      const store = useWordsStore()
      // learnDate 和 ctime 接近（5秒内）=> 新单词
      const now = new Date()
      const futureDate = new Date(Date.now() + 100 * 60 * 1000)
      const word = createWord({ isReview: true, learnDate: futureDate, ctime: now })

      store.words = [word]
      store.upReview()

      // 新单词即使还没到复习时间也保持 isReview=true
      expect(store.words[0].isReview).toBe(true)
    })

    it('应该处理 learnDate 为字符串的情况', () => {
      const store = useWordsStore()
      const pastDate = new Date(Date.now() - 100 * 60 * 1000)
      const word = createWord({
        isReview: false,
        learnDate: pastDate.toISOString() as any,
        ctime: pastDate.toISOString() as any
      })

      store.words = [word]
      store.upReview()

      expect(store.words[0].isReview).toBe(true)
    })

    it('无效 level 应该回退到默认间隔', () => {
      const store = useWordsStore()
      const pastDate = new Date(Date.now() - 100 * 60 * 1000)
      // level 为 undefined/NaN 应该使用默认间隔
      const word = createWord({ isReview: false, learnDate: pastDate, ctime: pastDate, level: undefined as any })

      store.words = [word]
      store.upReview()

      // 默认 level=1 对应 5 分钟间隔，过去100分钟，应该需要复习
      expect(store.words[0].isReview).toBe(true)
    })
  })

  describe('translateWithPlatform', () => {
    it('应该使用当前翻译平台调用翻译', async () => {
      const store = useWordsStore()
      store.currentTranslationPlatform = 'glm'

      await store.translateWithPlatform('hello')

      expect(translateWithPlatform).toHaveBeenCalledWith('hello', 'glm')
    })

    it('应该使用不同的翻译平台', async () => {
      const store = useWordsStore()
      store.currentTranslationPlatform = 'deepseek'

      await store.translateWithPlatform('world')

      expect(translateWithPlatform).toHaveBeenCalledWith('world', 'deepseek')
    })
  })
})
