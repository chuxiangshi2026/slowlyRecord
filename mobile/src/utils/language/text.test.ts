import { afterEach, describe, expect, it, vi } from 'vitest'
import { getProfile } from './profiles'
import {
  isPhraseText,
  isWordText,
  normalizeForCompare,
  splitSpellUnits,
  tokenize,
  wordCount,
} from './text'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('移动端多语言文本处理', () => {
  it('保持英语单词、词组和大小写行为', () => {
    const profile = getProfile('en')
    expect(isWordText('apple', profile)).toBe(true)
    expect(isWordText("mother-in-law's", profile)).toBe(true)
    expect(isPhraseText('take care', profile)).toBe(true)
    expect(isWordText('こんにちは', profile)).toBe(false)
    expect(normalizeForCompare('  Apple   Pie ', profile)).toBe('apple pie')
  })

  it('支持俄语和法语重音字符', () => {
    expect(isWordText('Привет', getProfile('ru'))).toBe(true)
    expect(normalizeForCompare('ПРИВЕТ', getProfile('ru'))).toBe('привет')
    expect(isWordText('café', getProfile('fr'))).toBe(true)
    expect(normalizeForCompare('Cafe\u0301', getProfile('fr'))).toBe('café')
  })

  it('日语不使用大小写折叠，小假名并入前一个拼写单位', () => {
    const profile = getProfile('ja')
    expect(isWordText('こんにちは', profile)).toBe(true)
    expect(isWordText('hello', profile)).toBe(false)
    expect(normalizeForCompare('  こんにちは  ', profile)).toBe('こんにちは')
    expect(splitSpellUnits('きゃく', profile)).toEqual(['きゃ', 'く'])
  })

  it('没有 Intl.Segmenter 时日语分词和字素切分仍可用', () => {
    vi.stubGlobal('Intl', { Segmenter: undefined })
    const profile = getProfile('ja')
    expect(tokenize('私は学生です', profile)).toEqual(['私は学生です'])
    expect(wordCount('私は学生です', profile)).toBe(1)
    expect(isPhraseText('私は 学生 です', profile)).toBe(true)
    expect(splitSpellUnits('しゅみ', profile)).toEqual(['しゅ', 'み'])
  })
})
