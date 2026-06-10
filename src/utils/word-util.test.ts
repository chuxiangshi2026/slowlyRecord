import { describe, it, expect, vi, beforeEach } from 'vitest'
import { parseFileContent, filterWordsForJsonExport, filterWordsForTextExport, validateImportedWords } from './word-util'
import type { Word } from '@/types/words'

// 模拟 uuid
vi.mock('uuid', () => ({
  v4: vi.fn().mockReturnValue('test-uuid-123')
}))

// 模拟 constants
vi.mock('@/constants', () => ({
  DB_KEY: 'words-list'
}))

// 辅助函数：创建完整的 Word 对象
function createWord(overrides: Partial<Word> = {}): Word {
  return {
    text: 'test',
    explains: '测试',
    explainedHidden: false,
    isReview: true,
    ctime: new Date('2024-01-15T10:30:00'),
    learnDate: new Date('2024-01-15T10:30:00'),
    level: 1,
    _id: 'words-listtest-id',
    image: '',
    phonetic: '',
    remember: false,
    pronunciation: '',
    ...overrides
  }
}

describe('parseFileContent', () => {
  it('应该正确解析简单的单词列表', () => {
    const content = 'hello\nworld\ntest'
    const result = parseFileContent(content)

    expect(result).toHaveLength(3)
    expect(result[0].text).toBe('hello')
    expect(result[1].text).toBe('world')
    expect(result[2].text).toBe('test')
  })

  it('应该正确处理 Windows 换行符', () => {
    const content = 'hello\r\nworld\r\ntest'
    const result = parseFileContent(content)

    expect(result).toHaveLength(3)
    expect(result[0].text).toBe('hello')
    expect(result[1].text).toBe('world')
  })

  it('应该过滤空行', () => {
    const content = 'hello\n\n\nworld\n   \ntest'
    const result = parseFileContent(content)

    expect(result).toHaveLength(3)
  })

  it('应该正确解析 CSV 格式', () => {
    const content = 'hello,你好,true,false,2024-01-15 10:30:00,2024-01-15 10:30:00,3'
    const result = parseFileContent(content)

    expect(result).toHaveLength(1)
    expect(result[0].text).toBe('hello')
    expect(result[0].explains).toBe('你好')
    expect(result[0].explainedHidden).toBe(true)
    expect(result[0].isReview).toBe(false)
    expect(result[0].level).toBe(3)
  })

  it('应该正确处理无效的等级值', () => {
    const content = 'hello,你好,true,true,2024-01-15 10:30:00,2024-01-15 10:30:00,invalid'
    const result = parseFileContent(content)

    expect(result[0].level).toBe(1) // 默认值
  })

  it('应该正确处理超出范围的等级值', () => {
    const content = 'hello,你好,true,true,2024-01-15 10:30:00,2024-01-15 10:30:00,15'
    const result = parseFileContent(content)

    expect(result[0].level).toBe(1) // 超出范围使用默认值
  })

  it('应该正确处理负的等级值', () => {
    const content = 'hello,你好,true,true,2024-01-15 10:30:00,2024-01-15 10:30:00,-1'
    const result = parseFileContent(content)

    expect(result[0].level).toBe(1) // 负值使用默认值
  })

  it('应该正确解析日期字符串', () => {
    const content = 'hello,你好,true,true,2024-06-20 14:30:00,2024-06-21 15:45:00,2'
    const result = parseFileContent(content)

    expect(result[0].ctime).toBeInstanceOf(Date)
    expect(result[0].learnDate).toBeInstanceOf(Date)
  })

  it('应该正确处理没有可选字段的 CSV', () => {
    const content = 'hello'
    const result = parseFileContent(content)

    expect(result[0].text).toBe('hello')
    expect(result[0].explains).toBe('')
    expect(result[0].explainedHidden).toBe(false)
    expect(result[0].isReview).toBe(true)
  })

  it('应该为每个单词生成唯一 ID', () => {
    const content = 'hello\nworld'
    const result = parseFileContent(content)

    expect(result[0]._id).toBe('words-listtest-uuid-123')
    expect(result[1]._id).toBe('words-listtest-uuid-123')
  })

  it('应该正确处理只有单词和释义的 CSV', () => {
    const content = 'hello,你好'
    const result = parseFileContent(content)

    expect(result[0].text).toBe('hello')
    expect(result[0].explains).toBe('你好')
    expect(result[0].level).toBe(1)
  })

  it('应该正确处理等级边界值 0', () => {
    const content = 'hello,你好,true,true,2024-01-15 10:30:00,2024-01-15 10:30:00,0'
    const result = parseFileContent(content)

    expect(result[0].level).toBe(0)
  })

  it('应该正确处理等级边界值 12', () => {
    const content = 'hello,你好,true,true,2024-01-15 10:30:00,2024-01-15 10:30:00,12'
    const result = parseFileContent(content)

    expect(result[0].level).toBe(12)
  })

  // === 词组 CSV 解析测试 ===
  it('解析词组 CSV 时应保留空格', () => {
    const content = 'take off,起飞；脱下'
    const result = parseFileContent(content)

    expect(result[0].text).toBe('take off')
    expect(result[0].itemType).toBe('phrase')
  })

  it('解析包含引号的 CSV 时应正确处理', () => {
    const content = '"look, look",仔细看;看起来'
    const result = parseFileContent(content)

    expect(result[0].text).toBe('look, look')
    expect(result[0].explains).toBe('仔细看;看起来')
  })

  it('解析包含转义引号的 CSV 时应正确处理', () => {
    // 含引号的字段需要用外层引号包裹，内部引号用 "" 转义
    const content = '"say ""hello""","说""你好"""'
    const result = parseFileContent(content)

    expect(result[0].text).toBe('say "hello"')
    expect(result[0].explains).toBe('说"你好"')
  })

  it('解析多字段 CSV 时应正确处理逗号', () => {
    const content = '"take care of",照顾;保重,true,true,2024-01-15 10:30:00,2024-01-15 10:30:00,2'
    const result = parseFileContent(content)

    expect(result[0].text).toBe('take care of')
    expect(result[0].explains).toBe('照顾;保重')
    expect(result[0].level).toBe(2)
  })

  it('应该为每行去除首尾空格', () => {
    const content = '  hello  \n  world  '
    const result = parseFileContent(content)

    expect(result[0].text).toBe('hello')
    expect(result[1].text).toBe('world')
  })

  it('应该正确处理空的 ctime 和 learnDate 字段', () => {
    const content = 'hello,你好,true,true,,,3'
    const result = parseFileContent(content)

    expect(result[0].ctime).toBeInstanceOf(Date)
    expect(result[0].learnDate).toBeInstanceOf(Date)
  })

  it('应该初始化 image 和 phonetic 为空字符串', () => {
    const content = 'hello'
    const result = parseFileContent(content)

    expect(result[0].image).toBe('')
    expect(result[0].phonetic).toBe('')
  })

  it('应该初始化 remember 为 false', () => {
    const content = 'hello'
    const result = parseFileContent(content)

    expect(result[0].remember).toBe(false)
  })

  it('应该解析非格式化的 ctime 日期字符串（如 ISO 格式）', () => {
    const content = 'hello,你好,true,true,2024-06-20T14:30:00.000Z,2024-01-15 10:30:00,2'
    const result = parseFileContent(content)

    expect(result[0].ctime).toBeInstanceOf(Date)
    expect(result[0].ctime.getFullYear()).toBe(2024)
  })

  it('应该解析非格式化的 learnDate 日期字符串（如 ISO 格式）', () => {
    const content = 'hello,你好,true,true,2024-01-15 10:30:00,2024-06-20T14:30:00.000Z,2'
    const result = parseFileContent(content)

    expect(result[0].learnDate).toBeInstanceOf(Date)
    expect(result[0].learnDate.getFullYear()).toBe(2024)
  })

  it('ctime 为无效日期字符串时应使用当前时间', () => {
    const content = 'hello,你好,true,true,not-a-date,2024-01-15 10:30:00,2'
    const result = parseFileContent(content)

    expect(result[0].ctime).toBeInstanceOf(Date)
  })

  it('learnDate 为无效日期字符串时应使用当前时间', () => {
    const content = 'hello,你好,true,true,2024-01-15 10:30:00,not-a-date,2'
    const result = parseFileContent(content)

    expect(result[0].learnDate).toBeInstanceOf(Date)
  })

  it('应该处理只包含空格的行', () => {
    const content = 'hello\n   \nworld'
    const result = parseFileContent(content)

    expect(result).toHaveLength(2)
  })

  it('应该处理包含尾随逗号的行', () => {
    const content = 'hello,你好,'
    const result = parseFileContent(content)

    expect(result[0].text).toBe('hello')
    expect(result[0].explains).toBe('你好')
  })
})

describe('filterWordsForJsonExport', () => {
  it('应该正确过滤单词属性用于 JSON 导出', () => {
    const words: Word[] = [
      createWord({
        text: 'hello',
        explains: '你好',
        explainedHidden: false,
        isReview: true,
        ctime: new Date('2024-01-15T10:30:00'),
        learnDate: new Date('2024-01-15T10:30:00'),
        level: 3,
      })
    ]

    const result = filterWordsForJsonExport(words)

    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      text: 'hello',
      explains: '你好',
      explainedHidden: false,
      isReview: true,
      ctime: '2024-01-15 10:30:00',
      learnDate: '2024-01-15 10:30:00',
      level: 3
    })
  })

  it('应该正确处理多个单词', () => {
    const words: Word[] = [
      createWord({ text: 'hello', explains: '你好', level: 1 }),
      createWord({ text: 'world', explains: '世界', level: 2, explainedHidden: true, isReview: false })
    ]

    const result = filterWordsForJsonExport(words)

    expect(result).toHaveLength(2)
    expect(result[0].text).toBe('hello')
    expect(result[1].text).toBe('world')
  })

  it('应该正确处理空数组', () => {
    const result = filterWordsForJsonExport([])
    expect(result).toEqual([])
  })

  it('应该排除 _id、image、phonetic、remember、pronunciation 字段', () => {
    const words: Word[] = [createWord()]
    const result = filterWordsForJsonExport(words)

    expect(result[0]).not.toHaveProperty('_id')
    expect(result[0]).not.toHaveProperty('image')
    expect(result[0]).not.toHaveProperty('phonetic')
    expect(result[0]).not.toHaveProperty('remember')
    expect(result[0]).not.toHaveProperty('pronunciation')
  })

  it('JSON 导出应包含 itemType 字段', () => {
    const words: Word[] = [
      createWord({ text: 'take off', itemType: 'phrase' }),
      createWord({ text: 'hello', itemType: 'word' })
    ]
    const result = filterWordsForJsonExport(words)

    expect(result[0].itemType).toBe('phrase')
    expect(result[1].itemType).toBe('word')
  })

  it('应该将 Date 对象转换为格式化的时间字符串', () => {
    const words: Word[] = [
      createWord({
        ctime: new Date(2024, 5, 20, 14, 30, 0),
        learnDate: new Date(2024, 5, 21, 15, 45, 0)
      })
    ]

    const result = filterWordsForJsonExport(words)

    expect(typeof result[0].ctime).toBe('string')
    expect(typeof result[0].learnDate).toBe('string')
    expect(result[0].ctime).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
  })
})

describe('filterWordsForTextExport', () => {
  it('应该正确格式化为 CSV 格式', () => {
    const words: Word[] = [
      createWord({
        text: 'hello',
        explains: '你好',
        explainedHidden: false,
        isReview: true,
        ctime: new Date('2024-01-15T10:30:00'),
        learnDate: new Date('2024-01-15T10:30:00'),
        level: 3,
      })
    ]

    const result = filterWordsForTextExport(words)

    expect(result).toBe('hello, 你好,false,true, 2024-01-15 10:30:00,2024-01-15 10:30:00, 3')
  })

  it('应该正确处理多个单词，用换行符分隔', () => {
    const words: Word[] = [
      createWord({ text: 'hello', explains: '你好' }),
      createWord({ text: 'world', explains: '世界' })
    ]

    const result = filterWordsForTextExport(words)
    const lines = result.split('\n')

    expect(lines).toHaveLength(2)
    expect(lines[0]).toContain('hello')
    expect(lines[1]).toContain('world')
  })

  it('应该正确处理空数组', () => {
    const result = filterWordsForTextExport([])
    expect(result).toBe('')
  })

  it('每行应该包含所有必要字段', () => {
    const words: Word[] = [
      createWord({
        text: 'test',
        explains: '测试',
        explainedHidden: true,
        isReview: false,
        level: 5
      })
    ]

    const result = filterWordsForTextExport(words)
    const line = result.split('\n')[0]

    expect(line).toContain('test')
    expect(line).toContain('测试')
    expect(line).toContain('true')
    expect(line).toContain('false')
    expect(line).toContain('5')
  })

  // === 词组导出测试 ===
  it('文本导出含逗号的词组时应加引号转义', () => {
    const words: Word[] = [
      createWord({ text: 'look, look', explains: '仔细看' })
    ]
    const result = filterWordsForTextExport(words)

    expect(result).toContain('"look, look"')
  })

  it('文本导出含引号的词组时应转义引号', () => {
    const words: Word[] = [
      createWord({ text: 'say "hello"', explains: '说你好' })
    ]
    const result = filterWordsForTextExport(words)

    expect(result).toContain('"say ""hello"""')
  })
})

describe('validateImportedWords', () => {
  it('应该过滤掉缺少 text 字段的单词', () => {
    const words = [
      { explains: '你好', level: 1 },
      { text: 'hello', explains: '你好', level: 1 }
    ]

    const result = validateImportedWords(words)

    expect(result).toHaveLength(1)
    expect(result[0].text).toBe('hello')
  })

  it('应该过滤掉 text 不是字符串的单词', () => {
    const words = [
      { text: 123, explains: '你好' },
      { text: 'hello', explains: '你好' }
    ]

    const result = validateImportedWords(words)

    expect(result).toHaveLength(1)
    expect(result[0].text).toBe('hello')
  })

  it('应该为缺少的字段提供默认值', () => {
    const words = [{ text: 'hello' }]

    const result = validateImportedWords(words)

    expect(result[0]).toMatchObject({
      text: 'hello',
      image: '',
      phonetic: '',
      explainedHidden: false,
      isReview: true,
      level: 1,
      remember: false,
      explains: '',
      pronunciation: ''
    })
  })

  it('应该保留已有的字段值', () => {
    const words = [{
      text: 'hello',
      explains: '你好',
      level: 5,
      remember: true,
      phonetic: '/həˈloʊ/'
    }]

    const result = validateImportedWords(words)

    expect(result[0].explains).toBe('你好')
    expect(result[0].level).toBe(5)
    expect(result[0].remember).toBe(true)
    expect(result[0].phonetic).toBe('/həˈloʊ/')
  })

  it('应该将字符串日期转换为 Date 对象', () => {
    const words = [{
      text: 'hello',
      ctime: '2024-01-15T10:30:00.000Z',
      learnDate: '2024-01-15T10:30:00.000Z'
    }]

    const result = validateImportedWords(words)

    expect(result[0].ctime).toBeInstanceOf(Date)
    expect(result[0].learnDate).toBeInstanceOf(Date)
  })

  it('应该限制 level 在 0-12 范围内', () => {
    const words = [
      { text: 'a', level: -1 },
      { text: 'b', level: 0 },
      { text: 'c', level: 12 },
      { text: 'd', level: 15 }
    ]

    const result = validateImportedWords(words)

    expect(result[0].level).toBe(1) // 负值变为默认值
    expect(result[1].level).toBe(0) // 边界值保留
    expect(result[2].level).toBe(12) // 边界值保留
    expect(result[3].level).toBe(1) // 超出范围变为默认值
  })

  it('应该正确处理空数组', () => {
    const result = validateImportedWords([])
    expect(result).toEqual([])
  })

  it('应该为缺少 _id 的单词生成 ID', () => {
    const words = [{ text: 'hello' }]
    const result = validateImportedWords(words)

    expect(result[0]._id).toBe('words-listtest-uuid-123')
  })

  it('应该保留已有的 _id', () => {
    const words = [{ text: 'hello', _id: 'words-list_existing-id' }]
    const result = validateImportedWords(words)

    expect(result[0]._id).toBe('words-list_existing-id')
  })

  it('isReview 为 false 时应该保留 false（修复 falsy 值 BUG）', () => {
    const words = [{ text: 'hello', isReview: false }]
    const result = validateImportedWords(words)

    expect(result[0].isReview).toBe(false)
  })

  it('explainedHidden 为 false 时应该保留 false', () => {
    const words = [{ text: 'hello', explainedHidden: false }]
    const result = validateImportedWords(words)

    expect(result[0].explainedHidden).toBe(false)
  })

  it('remember 为 false 时应该保留 false', () => {
    const words = [{ text: 'hello', remember: false }]
    const result = validateImportedWords(words)

    expect(result[0].remember).toBe(false)
  })

  it('remember 为 true 时应该保留 true', () => {
    const words = [{ text: 'hello', remember: true }]
    const result = validateImportedWords(words)

    expect(result[0].remember).toBe(true)
  })

  it('缺少 ctime 时应该使用当前时间', () => {
    const words = [{ text: 'hello' }]
    const beforeTime = new Date()
    const result = validateImportedWords(words)
    const afterTime = new Date()

    expect(result[0].ctime.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime())
    expect(result[0].ctime.getTime()).toBeLessThanOrEqual(afterTime.getTime())
  })

  it('缺少 learnDate 时应该使用当前时间', () => {
    const words = [{ text: 'hello' }]
    const beforeTime = new Date()
    const result = validateImportedWords(words)
    const afterTime = new Date()

    expect(result[0].learnDate.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime())
    expect(result[0].learnDate.getTime()).toBeLessThanOrEqual(afterTime.getTime())
  })

  it('应该正确处理 undefined 的 level', () => {
    const words = [{ text: 'hello', level: undefined }]
    const result = validateImportedWords(words)

    expect(result[0].level).toBe(1) // undefined 不在 0-12 范围内，使用默认值
  })

  it('应该正确处理已有 Date 对象的 ctime 和 learnDate', () => {
    const ctime = new Date('2024-01-15T10:30:00.000Z')
    const learnDate = new Date('2024-06-20T14:30:00.000Z')
    const words = [{ text: 'hello', ctime, learnDate }]
    const result = validateImportedWords(words)

    expect(result[0].ctime).toBeInstanceOf(Date)
    expect(result[0].learnDate).toBeInstanceOf(Date)
    expect(result[0].ctime.getTime()).toBe(ctime.getTime())
    expect(result[0].learnDate.getTime()).toBe(learnDate.getTime())
  })

  it('应该正确处理 explains 为空字符串', () => {
    const words = [{ text: 'hello', explains: '' }]
    const result = validateImportedWords(words)

    expect(result[0].explains).toBe('')
  })

  it('应该正确处理 pronunciation 字段', () => {
    const words = [{ text: 'hello', pronunciation: 'audio-url' }]
    const result = validateImportedWords(words)

    expect(result[0].pronunciation).toBe('audio-url')
  })

  it('缺少 pronunciation 时应该默认为空字符串', () => {
    const words = [{ text: 'hello' }]
    const result = validateImportedWords(words)

    expect(result[0].pronunciation).toBe('')
  })

  // === 词组 validate 测试 ===
  it('导入词组时应保留 itemType', () => {
    const words = [{ text: 'take off', itemType: 'phrase' }]
    const result = validateImportedWords(words)

    expect(result[0].itemType).toBe('phrase')
  })

  it('导入含空格的文本但无 itemType 时应自动推断为 phrase', () => {
    const words = [{ text: 'look forward to' }]
    const result = validateImportedWords(words)

    expect(result[0].itemType).toBe('phrase')
  })

  it('导入单词时应默认 itemType 为 word', () => {
    const words = [{ text: 'hello' }]
    const result = validateImportedWords(words)

    expect(result[0].itemType).toBe('word')
  })
})
