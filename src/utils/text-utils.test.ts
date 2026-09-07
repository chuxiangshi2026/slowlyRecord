import { describe, expect, it } from 'vitest'
import {
  compactText,
  getItemKey,
  getWordCount,
  inferItemType,
  isPhrase,
  normalizeItemText,
} from './text-utils'

/**
 * 英语行为快照测试（多语言适配的回归基线）
 * 这些用例锁定当前英语行为，后续多语言改造不得改变它们
 */
describe('text-utils 英语行为快照', () => {
  describe('normalizeItemText', () => {
    it('折叠连续空格并去首尾空白', () => {
      expect(normalizeItemText('  take   care  ')).toBe('take care')
      expect(normalizeItemText('hello')).toBe('hello')
      expect(normalizeItemText('  ')).toBe('')
    })
  })

  describe('getItemKey', () => {
    it('规范化后小写作为去重键', () => {
      expect(getItemKey('  Hello ')).toBe('hello')
      expect(getItemKey('Take  Care')).toBe('take care')
    })
  })

  describe('compactText', () => {
    it('移除所有空白字符', () => {
      expect(compactText('take care of')).toBe('takecareof')
      expect(compactText('  hello  ')).toBe('hello')
    })
  })

  describe('isPhrase', () => {
    it('itemType 为 phrase/collocation 时是词组', () => {
      expect(isPhrase({ itemType: 'phrase', text: 'take care' })).toBe(true)
      expect(isPhrase({ itemType: 'collocation', text: 'take care' })).toBe(true)
      expect(isPhrase({ itemType: 'word', text: 'hello' })).toBe(false)
    })

    it('未设置 itemType 时按空格判断', () => {
      expect(isPhrase({ text: 'take care' })).toBe(true)
      expect(isPhrase({ text: 'hello' })).toBe(false)
    })
  })

  describe('getWordCount', () => {
    it('按空格计数', () => {
      expect(getWordCount('hello')).toBe(1)
      expect(getWordCount('take care of')).toBe(3)
      expect(getWordCount('  take   care  ')).toBe(2)
      expect(getWordCount('')).toBe(0)
    })
  })

  describe('inferItemType', () => {
    it('单词与词组推断', () => {
      expect(inferItemType('hello')).toBe('word')
      expect(inferItemType('take care')).toBe('phrase')
    })
  })
})
