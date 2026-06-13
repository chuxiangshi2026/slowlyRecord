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
})
