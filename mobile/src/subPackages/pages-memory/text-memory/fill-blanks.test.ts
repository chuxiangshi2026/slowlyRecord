/**
 * 填空练习挖空逻辑测试
 */
import { describe, it, expect } from 'vitest'
import { tokenizeForCloze, buildClozeUnits } from './fill-blanks'

describe('挖空单元切分', () => {
  it('汉字逐字成单元', () => {
    const units = tokenizeForCloze('床前')
    expect(units).toEqual([
      { text: '床', type: 'char' },
      { text: '前', type: 'char' },
    ])
  })

  it('拉丁字母/数字连续段聚成词单元', () => {
    const units = tokenizeForCloze('Hello world2024')
    expect(units).toEqual([
      { text: 'Hello', type: 'word' },
      { text: ' ', type: 'sep' },
      { text: 'world2024', type: 'word' },
    ])
  })

  it('标点、空白、换行为间隔单元', () => {
    const units = tokenizeForCloze('春眠不觉晓，\n处处闻啼鸟。')
    expect(units.filter((u) => u.type === 'sep').map((u) => u.text)).toEqual(['，', '\n', '。'])
    expect(units.filter((u) => u.type === 'char')).toHaveLength(10)
  })
})

describe('挖空挑选', () => {
  it('按比例挖空且只挖非间隔单元', () => {
    const units = buildClozeUnits('春眠不觉晓处处闻啼鸟', 0.3, () => 0.5)
    const blanked = units.filter((u) => u.blanked)
    expect(blanked).toHaveLength(3) // 10 × 0.3
    expect(blanked.every((u) => u.type !== 'sep')).toBe(true)
  })

  it('注入固定 rng 时结果可复现', () => {
    const seq = [0.1, 0.7, 0.3, 0.9, 0.2, 0.6, 0.4, 0.8, 0.05, 0.55]
    let i = 0
    const rng = () => seq[i++ % seq.length]
    const a = buildClozeUnits('春眠不觉晓', 0.4, rng)
    i = 0
    const b = buildClozeUnits('春眠不觉晓', 0.4, rng)
    expect(a.map((u) => u.blanked)).toEqual(b.map((u) => u.blanked))
  })

  it('比例钳制在 0~1，且至少挖 1 个', () => {
    const units = buildClozeUnits('春眠', 2, () => 0)
    expect(units.filter((u) => u.blanked)).toHaveLength(2)
    const min = buildClozeUnits('春眠', 0, () => 0)
    expect(min.filter((u) => u.blanked)).toHaveLength(1)
  })

  it('纯标点/空内容不挖任何单元', () => {
    expect(buildClozeUnits('。，！', 0.5, () => 0).every((u) => !u.blanked)).toBe(true)
    expect(buildClozeUnits('', 0.5, () => 0)).toEqual([])
  })

  it('中英混排：中文按字、英文按词挖空', () => {
    const units = buildClozeUnits('我爱 Apple 和 Banana', 1, () => 0)
    const blankedTexts = units.filter((u) => u.blanked).map((u) => u.text)
    expect(blankedTexts).toContain('我')
    expect(blankedTexts).toContain('爱')
    expect(blankedTexts).toContain('Apple')
    expect(blankedTexts).toContain('Banana')
    expect(blankedTexts).not.toContain(' ')
  })
})
