import { describe, it, expect } from 'vitest'
import { splitLetters, letterChainOf, chainToStory } from './letter-chain'
import { LETTER_PRESETS, COMBO_PRESETS, getDefaultSuggestion } from '@/utils/letter-preset'

describe('letter-preset 数据完整性', () => {
  it('26 个字母全覆盖且每个都有默认映射', () => {
    expect(LETTER_PRESETS).toHaveLength(26)
    const letters = LETTER_PRESETS.map((p) => p.letter).sort()
    expect(letters).toEqual('abcdefghijklmnopqrstuvwxyz'.split(''))
    for (const p of LETTER_PRESETS) {
      expect(p.suggestions.length).toBeGreaterThanOrEqual(1)
      expect(p.suggestions[0].name).toBeTruthy()
      expect(p.suggestions[0].emoji).toBeTruthy()
    }
  })

  it('组合预设均有默认映射', () => {
    expect(COMBO_PRESETS.length).toBeGreaterThan(0)
    for (const p of COMBO_PRESETS) {
      expect(p.suggestions[0]?.name).toBeTruthy()
    }
  })
})

describe('splitLetters', () => {
  it('普通字母串逐字母切分', () => {
    expect(splitLetters('KFC')).toEqual(['k', 'f', 'c'])
  })

  it('组合优先于单字母（最长匹配）', () => {
    expect(splitLetters('shop')).toEqual(['sh', 'o', 'p'])
    expect(splitLetters('night')).toEqual(['n', 'igh', 't'])
    expect(splitLetters('kitchen')).toEqual(['k', 'i', 'tch', 'e', 'n'])
  })

  it('忽略非字母字符并转小写', () => {
    expect(splitLetters('A-B C!')).toEqual(['a', 'b', 'c'])
    expect(splitLetters('123')).toEqual([])
  })
})

describe('letterChainOf / chainToStory', () => {
  const lookup = (letters: string) => getDefaultSuggestion(letters)

  it('KFC → 钥匙/鱼/猫 图像链', () => {
    const chain = letterChainOf('KFC', lookup)
    expect(chain.map((l) => l.letters)).toEqual(['k', 'f', 'c'])
    expect(chain.map((l) => l.name)).toEqual(['钥匙', '鱼', '猫'])
    expect(chainToStory(chain)).toBe('钥匙 → 鱼 → 猫')
  })

  it('组合参与编码：shop → 鞋子/橙子/桃子', () => {
    expect(chainToStory(letterChainOf('shop', lookup))).toBe('鞋子 → 橙子 → 桃子')
  })

  it('查不到映射的段用字母占位', () => {
    const chain = letterChainOf('ab', () => undefined)
    expect(chainToStory(chain)).toBe('a → b')
  })
})
