import { describe, it, expect } from 'vitest'
import {
  calcPlotYRange,
  compileExpression,
  dataToPx,
  isPlotDiscontinuity,
  niceStep,
  sampleFunction,
} from './function-plot'

describe('compileExpression', () => {
  it('常量与四则运算', () => {
    expect(compileExpression('1+2*3')(0)).toBe(7)
    expect(compileExpression('(1+2)*3')(0)).toBe(9)
    expect(compileExpression('10/4')(0)).toBe(2.5)
  })

  it('幂运算右结合', () => {
    expect(compileExpression('2^3^2')(0)).toBe(512)
    expect(compileExpression('x^2')(3)).toBe(9)
    expect(compileExpression('-x^2')(2)).toBe(-4) // 一元负号优先级低于幂
  })

  it('一元负号', () => {
    expect(compileExpression('-x + 1')(5)).toBe(-4)
    expect(compileExpression('--x')(5)).toBe(5)
  })

  it('常量 pi 与 e', () => {
    expect(compileExpression('pi')(0)).toBeCloseTo(Math.PI)
    expect(compileExpression('e')(0)).toBeCloseTo(Math.E)
  })

  it('函数白名单', () => {
    expect(compileExpression('sin(0)')(0)).toBe(0)
    expect(compileExpression('sqrt(x)')(16)).toBe(4)
    expect(compileExpression('exp(0)')(0)).toBe(1)
    expect(compileExpression('ln(e)')(0)).toBeCloseTo(1)
    expect(compileExpression('abs(-3)')(0)).toBe(3)
  })

  it('复合表达式', () => {
    expect(compileExpression('exp(-x^2/2)/sqrt(2*pi)')(0)).toBeCloseTo(0.3989, 3)
    expect(compileExpression('x^3-3*x')(2)).toBe(2)
  })

  it('非法输入抛错', () => {
    expect(() => compileExpression('')).toThrow()
    expect(() => compileExpression('x +')) .toThrow()
    expect(() => compileExpression('foo(1)')).toThrow()
    expect(() => compileExpression('alert(1)')).toThrow()
    expect(() => compileExpression('x 1')).toThrow()
    expect(() => compileExpression('(x')).toThrow()
  })
})

describe('isPlotDiscontinuity', () => {
  it('非有限值断开', () => {
    expect(isPlotDiscontinuity(NaN, 1)).toBe(true)
    expect(isPlotDiscontinuity(1, Infinity)).toBe(true)
  })
  it('过零点不断开', () => {
    expect(isPlotDiscontinuity(-0.1, 0.2)).toBe(false)
  })
  it('渐近线两侧大值断开', () => {
    expect(isPlotDiscontinuity(-500, 500)).toBe(true)
  })
  it('正常单调段不断开', () => {
    expect(isPlotDiscontinuity(1, 2)).toBe(false)
    expect(isPlotDiscontinuity(-2, -5)).toBe(false)
  })
})

describe('sampleFunction', () => {
  it('连续函数单段', () => {
    const segs = sampleFunction(x => x * x, -2, 2, 100)
    expect(segs.length).toBe(1)
    expect(segs[0].length).toBe(101)
  })

  it('1/x 在 0 处断开为多段', () => {
    const segs = sampleFunction(x => 1 / x, -2, 2, 200)
    expect(segs.length).toBe(2)
  })

  it('sin x/x 在 0 处（可去间断）断开', () => {
    const segs = sampleFunction(x => (x === 0 ? NaN : Math.sin(x) / x), -1, 1, 100)
    expect(segs.length).toBe(2)
  })

  it('空区间外的非法值被跳过', () => {
    const segs = sampleFunction(x => (x > 0.5 ? NaN : x), -1, 1, 100)
    expect(segs.length).toBe(1)
  })
})

describe('calcPlotYRange', () => {
  it('按采样值留边距', () => {
    const segs = sampleFunction(x => x * x, -2, 2, 100)
    const { yMin, yMax } = calcPlotYRange(segs)
    expect(yMin).toBeLessThan(0)
    expect(yMax).toBeGreaterThan(4)
  })
  it('无有效点回退 [-1,1]', () => {
    expect(calcPlotYRange([])).toEqual({ yMin: -1, yMax: 1 })
  })
  it('常值函数展开一个单位', () => {
    const { yMin, yMax } = calcPlotYRange([[{ x: 0, y: 5 }]])
    expect(yMin).toBe(4)
    expect(yMax).toBe(6)
  })
})

describe('dataToPx', () => {
  const range = { xMin: -1, xMax: 1, yMin: -1, yMax: 1 }
  it('y 轴翻转', () => {
    expect(dataToPx(0, 0, range, 100, 100)).toEqual({ x: 50, y: 50 })
    expect(dataToPx(1, 1, range, 100, 100)).toEqual({ x: 100, y: 0 })
    expect(dataToPx(-1, -1, range, 100, 100)).toEqual({ x: 0, y: 100 })
  })
})

describe('niceStep', () => {
  it('取 1/2/5×10^n', () => {
    expect(niceStep(0.9)).toBe(1)
    expect(niceStep(1.2)).toBe(2)
    expect(niceStep(3)).toBe(5)
    expect(niceStep(8)).toBe(10)
    expect(niceStep(0.03)).toBeCloseTo(0.05)
  })
})
