/**
 * 默写对比 LCS 算法测试（与桌面端 PromptsDialog 行为对齐）
 */
import { describe, it, expect } from 'vitest'
import { compareText } from './text-compare'

describe('compareText', () => {
  it('完全一致：100 分，无任何差异', () => {
    const r = compareText('床前明月光', '床前明月光')
    expect(r.accuracy).toBe(100)
    expect(r.errors).toEqual([])
    expect(r.missing).toEqual([])
    expect(r.extra).toEqual([])
  })

  it('写错字：计入 errors 并标出所写字符', () => {
    const r = compareText('床前明月光', '床前名月光')
    expect(r.errors).toEqual([{ char: '名', position: 2 }])
    expect(r.accuracy).toBe(80)
  })

  it('漏字：计入 missing 并带原文字符', () => {
    const r = compareText('床前明月光', '床明月光')
    expect(r.missing).toEqual([{ char: '前', position: 1 }])
    expect(r.accuracy).toBe(80)
  })

  it('多写字：计入 extra，不扣正确率', () => {
    const r = compareText('床前', '床前后')
    expect(r.extra).toEqual([{ char: '后', position: 2 }])
    expect(r.accuracy).toBe(100)
  })

  it('对齐优于逐位：插入一个字后后续仍能全部匹配', () => {
    // 逐位对比会把「明月光」全判错；LCS 对齐只报一处遗漏
    const r = compareText('床前明月光', '床明月光')
    expect(r.errors).toEqual([])
    expect(r.missing).toHaveLength(1)
  })

  it('空原文：accuracy 为 0；空默写：全部遗漏', () => {
    expect(compareText('', 'abc').accuracy).toBe(0)
    const r = compareText('床前', '')
    expect(r.missing).toHaveLength(2)
    expect(r.accuracy).toBe(0)
  })

  it('忽略首尾空白', () => {
    const r = compareText(' 床前 ', '\n床前\n')
    expect(r.accuracy).toBe(100)
  })
})
