import { describe, expect, it } from 'vitest'
import { inferMobileItemType, normalizeMobileItemText } from './text'

describe('mobile text utils', () => {
  it('应规范化词组中多余空格', () => {
    expect(normalizeMobileItemText(' take   care ')).toBe('take care')
  })

  it('应识别单词、词组和句子', () => {
    expect(inferMobileItemType('apple')).toBe('word')
    expect(inferMobileItemType('take care')).toBe('phrase')
    expect(inferMobileItemType('I will take care of it.')).toBe('sentence')
    expect(inferMobileItemType('this is a long expression without punctuation')).toBe('sentence')
  })
})
