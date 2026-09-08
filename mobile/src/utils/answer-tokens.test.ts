import { describe, expect, it } from 'vitest'
import { tokenizeAnswer, buildFragmentTiles, shuffleTiles } from './answer-tokens'

describe('tokenizeAnswer: 答案 token 化', () => {
  it('物理公式 S=πr² 按字符拆分', () => {
    expect(tokenizeAnswer('S=πr²')).toEqual(['S', '=', 'π', 'r', '²'])
  })

  it('单字答案 1 个 token', () => {
    expect(tokenizeAnswer('氢')).toEqual(['氢'])
  })

  it('化学方程式逐字符拆分（含重复 token）', () => {
    expect(tokenizeAnswer('2H₂+O₂=2H₂O')).toEqual([
      '2', 'H', '₂', '+', 'O', '₂', '=', '2', 'H', '₂', 'O',
    ])
  })

  it('空答案返回空数组', () => {
    expect(tokenizeAnswer('')).toEqual([])
  })
})

describe('buildFragmentTiles: 碎片格子生成', () => {
  const normalize = (s: string) => s.toLowerCase()

  it('包含全部正确 token，干扰碎片数量符合要求', () => {
    const tiles = buildFragmentTiles(['S', '=', 'π', 'r', '²'], ['H', 'O', 'π'], 2, normalize)
    expect(tiles).toHaveLength(7)
    const texts = tiles.map(t => t.text)
    // 正确 token 全部在格子中
    for (const t of ['S', '=', 'π', 'r', '²']) expect(texts).toContain(t)
    // 多出的 2 个干扰碎片均来自候选池（按多重集合差值统计，π 若被抽中不算额外碎片）
    const remaining = [...texts]
    for (const t of ['S', '=', 'π', 'r', '²']) remaining.splice(remaining.indexOf(t), 1)
    expect(remaining).toHaveLength(2)
    for (const t of remaining) expect(['H', 'O', 'π']).toContain(t)
  })

  it('id 唯一且可携带重复文本', () => {
    const tiles = buildFragmentTiles(['₂', '₂'], ['₂', 'H'], 2, normalize)
    expect(tiles.filter(t => t.text === '₂').length).toBe(3)
    expect(new Set(tiles.map(t => t.id)).size).toBe(tiles.length)
  })

  it('候选池不足时有多少取多少', () => {
    const tiles = buildFragmentTiles(['a'], ['x'], 3, normalize)
    expect(tiles).toHaveLength(2)
  })

  it('候选池按归一化结果去重', () => {
    const tiles = buildFragmentTiles(['a'], ['X', 'x', 'X'], 5, normalize)
    expect(tiles).toHaveLength(2)
    expect(tiles.map(t => t.text)).toContain('X')
  })

  it('干扰碎片数为 0 时仅含正确 token', () => {
    const tiles = buildFragmentTiles(['π', 'r'], ['x', 'y'], 0, normalize)
    expect(tiles).toHaveLength(2)
    expect([...tiles.map(t => t.text)].sort()).toEqual(['π', 'r'].sort())
  })
})

describe('shuffleTiles: 打乱', () => {
  it('不改变元素集合', () => {
    const input = [1, 2, 3, 4, 5]
    const out = shuffleTiles(input)
    expect([...out].sort()).toEqual(input)
    expect(input).toEqual([1, 2, 3, 4, 5])
  })
})
