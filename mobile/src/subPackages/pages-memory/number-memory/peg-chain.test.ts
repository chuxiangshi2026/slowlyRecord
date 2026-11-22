import { describe, expect, it } from 'vitest'
import { splitIntoPairs, pegChainOf, pegNounOf, chainToStory } from './peg-chain'
import { DEFAULT_PEG_SUGGESTIONS } from './default-pegs'

const suggest = (num: string) => DEFAULT_PEG_SUGGESTIONS[num]

describe('splitIntoPairs', () => {
  it('偶数位两两一对', () => {
    expect(splitIntoPairs('1234')).toEqual(['12', '34'])
  })

  it('奇数位首段为单数字（手机号 11 位 = 1+5×2）', () => {
    expect(splitIntoPairs('13912345678')).toEqual(['1', '39', '12', '34', '56', '78'])
  })

  it('忽略空格等非数字字符', () => {
    expect(splitIntoPairs('139 1234 5678')).toEqual(['1', '39', '12', '34', '56', '78'])
  })

  it('空串返回空数组', () => {
    expect(splitIntoPairs('')).toEqual([])
    expect(splitIntoPairs('abc')).toEqual([])
  })
})

describe('pegChainOf / chainToStory', () => {
  it('手机号编码成桩链', () => {
    const chain = pegChainOf('13912345678', suggest)
    expect(chain).toHaveLength(6)
    expect(chain[0]).toEqual({ number: '1', description: '蜡烛（1 像蜡烛）' })
    expect(chain[1].description).toBe('三角（39 谐音）')
    expect(chainToStory(chain)).toBe('蜡烛 → 三角 → 椅儿 → 山寺 → 蜗牛 → 青蛙')
  })

  it('两位数字带前导零时先查原样再查去零', () => {
    const chain = pegChainOf('03', suggest)
    expect(chain[0].description).toBe('耳朵（3 像耳朵）')
  })

  it('查不到桩时描述为空、故事用数字占位', () => {
    const chain = pegChainOf('99', () => undefined)
    expect(chain[0].description).toBe('')
    expect(chainToStory(chain)).toBe('99')
  })

  it('默认桩表 00-99 全覆盖', () => {
    for (let i = 0; i <= 99; i++) {
      const num = String(i).padStart(2, '0')
      expect(DEFAULT_PEG_SUGGESTIONS[num], `${num} 缺默认桩`).toBeTruthy()
    }
  })
})

describe('pegNounOf', () => {
  it('去掉括号说明取主名词', () => {
    expect(pegNounOf('雨伞（13 谐音）')).toBe('雨伞')
    expect(pegNounOf('望远镜（两个圆）')).toBe('望远镜')
  })
})
