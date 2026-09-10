import { describe, expect, it } from 'vitest'
import {
  defaultSelectedTokens,
  toggleTokenSelection,
  selectedTokenList,
  summarizeBatchAdd
} from './translate-tokens'

describe('defaultSelectedTokens', () => {
  it('默认全选所有词条', () => {
    const selected = defaultSelectedTokens(['apple', 'banana'])
    expect(selected.size).toBe(2)
    expect(selected.has('apple')).toBe(true)
    expect(selected.has('banana')).toBe(true)
  })

  it('空列表返回空集合', () => {
    expect(defaultSelectedTokens([]).size).toBe(0)
  })
})

describe('toggleTokenSelection', () => {
  it('取消已选中的词条', () => {
    const next = toggleTokenSelection(new Set(['apple']), 'apple')
    expect(next.has('apple')).toBe(false)
  })

  it('选中未选中的词条', () => {
    const next = toggleTokenSelection(new Set(['apple']), 'Banana')
    expect(next.has('banana')).toBe(true)
    expect(next.has('apple')).toBe(true)
  })

  it('不改原集合', () => {
    const original = new Set(['apple'])
    toggleTokenSelection(original, 'banana')
    expect(original.size).toBe(1)
  })
})

describe('selectedTokenList', () => {
  it('按原顺序筛出选中词条', () => {
    const tokens = ['apple', 'banana', 'cherry']
    const selected = new Set(['banana', 'cherry'])
    expect(selectedTokenList(tokens, selected)).toEqual(['banana', 'cherry'])
  })

  it('选中集合为空时返回空数组', () => {
    expect(selectedTokenList(['apple'], new Set())).toEqual([])
  })
})

describe('summarizeBatchAdd', () => {
  it('全部成功且无重复', () => {
    expect(summarizeBatchAdd(3, 0, 0)).toBe('已加入 3 个，0 个已在词库')
  })

  it('含重复与成功', () => {
    expect(summarizeBatchAdd(2, 1, 0)).toBe('已加入 2 个，1 个已在词库')
  })

  it('含失败时追加失败数', () => {
    expect(summarizeBatchAdd(2, 1, 1)).toBe('已加入 2 个，1 个已在词库，1 个失败')
  })
})
