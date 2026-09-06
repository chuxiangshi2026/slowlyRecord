/**
 * 记忆测试基础词表单测：五语言各 30 词、无重复、无空词
 */
import { describe, expect, it } from 'vitest'
import { BASIC_WORDS_BY_LANG, getBasicWords } from './basic-words'

describe('language/data/basic-words', () => {
  it('五语言词表齐全', () => {
    expect(Object.keys(BASIC_WORDS_BY_LANG).sort()).toEqual(['en', 'es', 'fr', 'ja', 'ru'])
  })

  for (const [lang, words] of Object.entries(BASIC_WORDS_BY_LANG)) {
    it(`${lang}：30 词且无重复/空词`, () => {
      expect(words.length).toBe(30)
      expect(new Set(words).size).toBe(30)
      expect(words.every(w => w.trim().length > 0)).toBe(true)
    })
  }

  it('getBasicWords 非法语言回退英语', () => {
    expect(getBasicWords('xx')).toEqual(BASIC_WORDS_BY_LANG.en)
    expect(getBasicWords('ja').length).toBe(30)
  })
})
