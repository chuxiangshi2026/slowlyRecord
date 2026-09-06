/**
 * 文本记忆多语言工具单测
 */
import { describe, expect, it } from 'vitest'
import {
  detectTextLanguage,
  extractForeignKeywords,
  extractKeywordTexts,
  getArticleLanguage,
  getLanguageTag,
  normalizeArticleLanguage,
  TEXT_LANGUAGE_OPTIONS,
} from './text-memory-util'

describe('text-memory-util/detectTextLanguage', () => {
  it('纯中文 → zh', () => {
    expect(detectTextLanguage('床前明月光，疑是地上霜。举头望明月，低头思故乡。')).toBe('zh')
  })

  it('纯英文 → en', () => {
    expect(detectTextLanguage('The quick brown fox jumps over the lazy dog.')).toBe('en')
  })

  it('含假名的日文 → ja', () => {
    expect(detectTextLanguage('春はあけぼの。やうやう白くなりゆく山際、少し明かりて、紫だちたる雲の細くたなびきたる。')).toBe('ja')
  })

  it('纯西里尔（俄语） → ru', () => {
    expect(detectTextLanguage('Все счастливые семьи похожи друг на друга, каждая несчастливая семья несчастлива по-своему.')).toBe('ru')
  })

  it('中西混排以中文为主 → zh', () => {
    expect(detectTextLanguage('这是一个包含 some English words 的中文段落，主要仍然是汉字内容。')).toBe('zh')
  })

  it('西语/法语等拉丁语系统一归 en', () => {
    expect(detectTextLanguage('En un lugar de la Mancha, de cuyo nombre no quiero acordarme.')).toBe('en')
    expect(detectTextLanguage("Il y a des fleurs partout pour qui veut bien les voir.")).toBe('en')
  })

  it('无字母/汉字内容 → zh', () => {
    expect(detectTextLanguage('12345678，。！？')).toBe('zh')
    expect(detectTextLanguage('')).toBe('zh')
  })
})

describe('text-memory-util/语言取值', () => {
  it('normalizeArticleLanguage 非法/空值回退 zh', () => {
    expect(normalizeArticleLanguage(undefined)).toBe('zh')
    expect(normalizeArticleLanguage('')).toBe('zh')
    expect(normalizeArticleLanguage('de')).toBe('zh')
    expect(normalizeArticleLanguage('en')).toBe('en')
  })

  it('getArticleLanguage 缺省视为 zh', () => {
    expect(getArticleLanguage(null)).toBe('zh')
    expect(getArticleLanguage({})).toBe('zh')
    expect(getArticleLanguage({ language: 'ja' })).toBe('ja')
  })

  it('getLanguageTag：中文返回「中」，其余返回大写码', () => {
    expect(getLanguageTag('zh')).toBe('中')
    expect(getLanguageTag('en')).toBe('EN')
    expect(getLanguageTag(undefined)).toBe('中')
  })

  it('语言选项含六种语言且 zh 在首位', () => {
    expect(TEXT_LANGUAGE_OPTIONS.map(o => o.code)).toEqual(['zh', 'en', 'ja', 'ru', 'es', 'fr'])
  })
})

describe('text-memory-util/extractForeignKeywords', () => {
  it('英文：提取长度≥2 的实词并带正确位置', () => {
    const content = 'The quick brown fox jumps over the lazy dog.'
    const keywords = extractForeignKeywords(content, 'en')
    const words = keywords.map(k => k.word)
    expect(words).toContain('quick')
    expect(words).toContain('brown')
    expect(words).toContain('jumps')
    // 单词位置与原文一致
    const quick = keywords.find(k => k.word === 'quick')!
    expect(content.substring(quick.start, quick.end)).toBe('quick')
    // 长度≥3 的词优先级为 2
    expect(quick.priority).toBe(2)
  })

  it('短词（长度<2）与数字被过滤', () => {
    const keywords = extractForeignKeywords('a 12 to be ok', 'en')
    const words = keywords.map(k => k.word)
    expect(words).not.toContain('12')
    expect(words).toEqual(expect.arrayContaining(['ok']))
  })

  it('俄语：西里尔词提取', () => {
    const content = 'Москва — столица России.'
    const words = extractForeignKeywords(content, 'ru').map(k => k.word)
    expect(words).toContain('Москва')
    expect(words).toContain('столица')
    expect(words).toContain('России')
  })

  it('提取结果互不重叠且按原文顺序', () => {
    const content = 'Practice makes perfect, and perfect practice makes permanent.'
    const keywords = extractForeignKeywords(content, 'en')
    for (let i = 1; i < keywords.length; i++) {
      expect(keywords[i].start).toBeGreaterThanOrEqual(keywords[i - 1].end)
    }
  })
})

describe('text-memory-util/extractKeywordTexts', () => {
  it('中文走原有中文正则', () => {
    const result = extractKeywordTexts('春眠不觉晓，处处闻啼鸟。', 'zh')
    expect(result.length).toBeGreaterThan(0)
    for (const word of result) {
      expect(/^[\u4e00-\u9fa5]{2,4}$/.test(word)).toBe(true)
    }
  })

  it('英文按分词提取并去重（大小写不敏感）', () => {
    const result = extractKeywordTexts('The Practice and the practice makes Perfect.', 'en', 5)
    expect(result.length).toBeLessThanOrEqual(5)
    const lowered = result.map(w => w.toLowerCase())
    expect(new Set(lowered).size).toBe(lowered.length)
    expect(lowered).toContain('practice')
    expect(lowered).toContain('perfect')
  })

  it('缺省语言按中文处理', () => {
    const zh = extractKeywordTexts('春眠不觉晓，处处闻啼鸟。', undefined as any)
    const en = extractKeywordTexts('Practice makes perfect.', undefined as any)
    expect(zh).toEqual(expect.arrayContaining(['春眠不觉']))
    expect(en).toEqual([])
  })
})
