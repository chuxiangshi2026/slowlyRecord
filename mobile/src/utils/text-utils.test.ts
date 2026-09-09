import { describe, expect, it } from 'vitest'
import { getWordKey, normalizeWordText } from './text-utils'

describe('normalizeWordText: 文本规范化', () => {
  it('去掉首尾空格', () => {
    expect(normalizeWordText('  apple  ')).toBe('apple')
  })

  it('折叠中间连续空白为单个空格（词组）', () => {
    expect(normalizeWordText('take   care')).toBe('take care')
  })
})

describe('getWordKey: 去重键（添加单词查重用）', () => {
  it('大小写不敏感', () => {
    expect(getWordKey('Apple')).toBe(getWordKey('apple'))
  })

  it('首尾空格与多余空白不影响判重', () => {
    expect(getWordKey(' take  care ')).toBe(getWordKey('take care'))
  })

  it('不同单词键不同', () => {
    expect(getWordKey('apple')).not.toBe(getWordKey('apply'))
  })

  it('空字符串键为空', () => {
    expect(getWordKey('')).toBe('')
  })
})
