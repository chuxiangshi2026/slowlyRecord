import { describe, expect, it } from 'vitest'
import { extractWordAndPhraseCandidates } from './text-candidates'

describe('extractWordAndPhraseCandidates', () => {
  it('应优先识别词库中的词组，并跳过被词组覆盖的单词', () => {
    const result = extractWordAndPhraseCandidates(
      'You should take care of yourself and look up the word.',
      ['take care', 'look up'],
    )

    expect(result.map(item => item.text)).toEqual([
      'You',
      'should',
      'take care',
      'of',
      'yourself',
      'and',
      'look up',
      'the',
      'word',
    ])
    expect(result.find(item => item.text === 'take care')?.itemType).toBe('phrase')
    expect(result.find(item => item.text === 'take')).toBeUndefined()
    expect(result.find(item => item.text === 'care')).toBeUndefined()
  })

  it('有重叠词组时应优先匹配最长词组', () => {
    const result = extractWordAndPhraseCandidates(
      'As a result of the change, sales increased.',
      ['as a result', 'as a result of'],
    )

    expect(result[0]).toEqual({ text: 'As a result of', itemType: 'phrase' })
    expect(result.find(item => item.text.toLowerCase() === 'as a result')).toBeUndefined()
  })

  it('短英文选中文本本身应作为词组候选', () => {
    const result = extractWordAndPhraseCandidates('take care', [])

    expect(result).toEqual([{ text: 'take care', itemType: 'phrase' }])
  })

  it('短词组候选会折叠多余空格', () => {
    const result = extractWordAndPhraseCandidates('take   care', [])

    expect(result).toEqual([{ text: 'take care', itemType: 'phrase' }])
  })

  it('未命中词组时应按原规则提取单词并去重', () => {
    const result = extractWordAndPhraseCandidates('Hello, hello world 123 IPv6', [])

    expect(result.map(item => item.text)).toEqual(['Hello', 'world', 'IPv6'])
  })

  // ---- 英语行为快照（多语言适配回归基线） ----

  it('短选中文本（≤6词）整体作为词组返回', () => {
    const result = extractWordAndPhraseCandidates("well-known don't give up", [])

    expect(result).toEqual([{ text: "well-known don't give up", itemType: 'phrase' }])
  })

  it('词组匹配大小写不敏感，保留词库词组的原写法', () => {
    // 长文本（>6词）走逐 token 匹配，命中词库词组时用词库中的写法
    const result = extractWordAndPhraseCandidates(
      'Please Take Care of the little dog while I am away from home',
      ['take care'],
    )

    expect(result.find(item => item.itemType === 'phrase')).toEqual({
      text: 'Take Care',
      itemType: 'phrase',
    })
  })

  it('单个单词的选中文本返回 word 而非 phrase', () => {
    const result = extractWordAndPhraseCandidates('hello', [])

    expect(result).toEqual([{ text: 'hello', itemType: 'word' }])
  })

  it('超过最大词长的选中文本按单词逐个提取', () => {
    const result = extractWordAndPhraseCandidates('a b c d e f g', [], 6)

    expect(result.every(item => item.itemType === 'word')).toBe(true)
    expect(result).toHaveLength(7)
  })
})
