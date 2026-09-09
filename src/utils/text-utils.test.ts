import { describe, expect, it } from 'vitest'
import {
  compactText,
  getItemKey,
  getWordCount,
  inferItemType,
  isPhrase,
  isSentenceLike,
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

  describe('isSentenceLike', () => {
    it('单词和词组不是句子', () => {
      expect(isSentenceLike('hello')).toBe(false)
      expect(isSentenceLike('take care of')).toBe(false)
      expect(isSentenceLike('美好')).toBe(false)
      expect(isSentenceLike('')).toBe(false)
      expect(isSentenceLike('   ')).toBe(false)
    })

    it('以中英文句末标点结尾是句子', () => {
      expect(isSentenceLike('愿所有美好如期而至。')).toBe(true)
      expect(isSentenceLike('真的吗？')).toBe(true)
      expect(isSentenceLike('The best is yet to come!')).toBe(true)
      expect(isSentenceLike('Hello world?')).toBe(true)
      expect(isSentenceLike('路漫漫其修远兮……')).toBe(true)
    })

    it('内部含句读标点是句子', () => {
      expect(isSentenceLike('你好，世界。欢迎')).toBe(true)
      expect(isSentenceLike('Spring is coming; flowers will bloom')).toBe(true)
      expect(isSentenceLike('一是婴儿哭啼，二是学游戏')).toBe(false) // 逗号不算句读
    })

    it('长英文按词数判定', () => {
      expect(isSentenceLike('The quick brown fox jumps over the lazy dog')).toBe(true) // 9 词
      expect(isSentenceLike('a b c d e f')).toBe(false) // 恰好 6 词
      expect(isSentenceLike('a b c d e f g')).toBe(true) // 7 词
    })

    it('纯中文连续文本按字数判定', () => {
      expect(isSentenceLike('愿你走出半生归来仍是少年')).toBe(false) // 12 字
      expect(isSentenceLike('愿你在被打击时记起你的珍贵抵抗恶意愿你在迷茫时坚信你的珍贵')).toBe(true) // >20 字
    })
  })
})
