import { describe, expect, it } from 'vitest'
import {
  ExprError,
  compileExpression,
  evaluateExpression,
  findRoots,
  parseExpression,
  sampleCurve,
} from './func-expr'

const evalSrc = (src: string, x = 0, params = { a: 1, b: 1, c: 1 }) =>
  evaluateExpression(parseExpression(src), { x, ...params })

describe('parseExpression + evaluateExpression：四则与优先级', () => {
  it('乘除优先于加减', () => {
    expect(evalSrc('2+3*4')).toBe(14)
    expect(evalSrc('(2+3)*4')).toBe(20)
  })

  it('同级左结合', () => {
    expect(evalSrc('10-4-3')).toBe(3)
    expect(evalSrc('16/4/2')).toBe(2)
  })

  it('幂右结合', () => {
    expect(evalSrc('2^3^2')).toBe(512)
    expect(evalSrc('4^0.5')).toBe(2)
  })

  it('一元负号优先级低于幂：-2^2 = -(2^2)', () => {
    expect(evalSrc('-2^2')).toBe(-4)
    expect(evalSrc('--3')).toBe(3)
    expect(evalSrc('3*-2')).toBe(-6)
  })

  it('负指数', () => {
    expect(evalSrc('2^-3')).toBeCloseTo(0.125)
  })

  it('取模运算', () => {
    expect(evalSrc('10%3')).toBe(1)
    expect(evalSrc('10%(2+1)')).toBe(1)
  })

  it('小数（含 .5 与 1. 形式）', () => {
    expect(evalSrc('.5*4')).toBe(2)
    expect(evalSrc('1.+1')).toBe(2)
  })
})

describe('parseExpression + evaluateExpression：常量 / 变量 / 函数', () => {
  it('常量 pi / e', () => {
    expect(evalSrc('pi')).toBeCloseTo(Math.PI)
    expect(evalSrc('e')).toBeCloseTo(Math.E)
  })

  it('变量 x 与参数 a/b/c', () => {
    expect(evalSrc('x^2', 3)).toBe(9)
    expect(evalSrc('a*x+b', 2, { a: 3, b: 4, c: 0 })).toBe(10)
    expect(evalSrc('a+b+c', 0, { a: 1, b: 2, c: 3 })).toBe(6)
  })

  it('三角 / 反三角 / 根号 / 绝对值 / 取整', () => {
    expect(evalSrc('sin(pi/2)')).toBeCloseTo(1)
    expect(evalSrc('cos(0)')).toBe(1)
    expect(evalSrc('tan(0)')).toBe(0)
    expect(evalSrc('asin(1)')).toBeCloseTo(Math.PI / 2)
    expect(evalSrc('acos(1)')).toBe(0)
    expect(evalSrc('atan(1)')).toBeCloseTo(Math.PI / 4)
    expect(evalSrc('sqrt(9)')).toBe(3)
    expect(evalSrc('abs(-2)')).toBe(2)
    expect(evalSrc('floor(2.9)')).toBe(2)
    expect(evalSrc('ceil(2.1)')).toBe(3)
  })

  it('对数 / 指数', () => {
    expect(evalSrc('ln(e)')).toBeCloseTo(1)
    expect(evalSrc('log(1000)')).toBeCloseTo(3)
    expect(evalSrc('exp(0)')).toBe(1)
  })

  it('函数名与变量大小写不敏感', () => {
    expect(evalSrc('SIN(X)', Math.PI / 2)).toBeCloseTo(1)
    expect(evalSrc('PI')).toBeCloseTo(Math.PI)
  })

  it('定义域外返回 NaN 而不是抛错', () => {
    expect(Number.isNaN(evalSrc('sqrt(-1)'))).toBe(true)
    expect(Number.isNaN(evalSrc('ln(-1)'))).toBe(true)
    expect(Number.isNaN(evalSrc('1/0'))).toBe(true)
    expect(Number.isNaN(evalSrc('asin(2)'))).toBe(true)
  })
})

describe('parseExpression：语法错误的中文定位提示', () => {
  it('空表达式', () => {
    expect(() => parseExpression('')).toThrow(ExprError)
    expect(() => parseExpression('   ')).toThrow(/第 1 个字符附近：表达式为空/)
  })

  it('缺少操作数', () => {
    expect(() => parseExpression('2+')).toThrow(/表达式不完整/)
  })

  it('未定义符号', () => {
    expect(() => parseExpression('y+1')).toThrow(/未定义的符号「y」/)
  })

  it('函数后缺括号', () => {
    expect(() => parseExpression('sin x')).toThrow(/函数 sin 后面需要括号/)
  })

  it('缺少右括号', () => {
    expect(() => parseExpression('(1+2')).toThrow(/缺少右括号/)
    expect(() => parseExpression('sin(1')).toThrow(/函数 sin 缺少右括号/)
  })

  it('无法识别的字符（报出 1 起的字符位置）', () => {
    expect(() => parseExpression('1@2')).toThrow(/第 2 个字符附近/)
  })

  it('多余的内容', () => {
    expect(() => parseExpression('1 2')).toThrow(/附近有多余的内容/)
  })

  it('数字中多个小数点', () => {
    expect(() => parseExpression('1.2.3')).toThrow(/小数点过多/)
  })
})

describe('compileExpression', () => {
  it('解析一次后可对不同的 x 与参数反复求值', () => {
    const fn = compileExpression('a*x^2 + b*x + c')
    expect(fn(0, { a: 1, b: 0, c: -4 })).toBe(-4)
    expect(fn(2, { a: 1, b: 0, c: -4 })).toBe(0)
    expect(fn(0, { a: 2, b: 1, c: 1 })).toBe(1)
  })

  it('语法错误照样抛 ExprError', () => {
    expect(() => compileExpression('*2')).toThrow(ExprError)
  })
})

describe('findRoots：曲线与 x 轴交点', () => {
  it('二次函数两个交点：x^2-4 = 0 → ±2', () => {
    const fn = compileExpression('x^2-4')
    const roots = findRoots(x => fn(x, { a: 0, b: 0, c: 0 }), -10, 10)
    expect(roots.length).toBe(2)
    expect(roots[0]).toBeCloseTo(-2, 5)
    expect(roots[1]).toBeCloseTo(2, 5)
  })

  it('无交点：x^2+1', () => {
    const fn = compileExpression('x^2+1')
    expect(findRoots(x => fn(x, { a: 0, b: 0, c: 0 }), -10, 10)).toEqual([])
  })

  it('三个交点：x^3-x = 0 → -1, 0, 1', () => {
    const fn = compileExpression('x^3-x')
    const roots = findRoots(x => fn(x, { a: 0, b: 0, c: 0 }), -10, 10)
    expect(roots.length).toBe(3)
    expect(roots[0]).toBeCloseTo(-1, 5)
    expect(roots[1]).toBeCloseTo(0, 5)
    expect(roots[2]).toBeCloseTo(1, 5)
  })

  it('一次函数交点随参数移动：a*x+b = 0', () => {
    const fn = compileExpression('a*x+b')
    const roots = findRoots(x => fn(x, { a: 2, b: -6, c: 0 }), -10, 10)
    expect(roots.length).toBe(1)
    expect(roots[0]).toBeCloseTo(3, 5)
  })

  it('定义域断点（对数）不影响求根：ln(x) = 0 → 1', () => {
    const fn = compileExpression('ln(x)')
    const roots = findRoots(x => fn(x, { a: 0, b: 0, c: 0 }), -10, 10)
    expect(roots.length).toBe(1)
    expect(roots[0]).toBeCloseTo(1, 5)
  })

  it('渐近线不误报为根：tan(x) 在 [-5,5] 只返回 -π、0、π', () => {
    const fn = compileExpression('tan(x)')
    const roots = findRoots(x => fn(x, { a: 0, b: 0, c: 0 }), -5, 5)
    expect(roots.length).toBe(3)
    expect(roots[0]).toBeCloseTo(-Math.PI, 4)
    expect(roots[1]).toBeCloseTo(0, 4)
    expect(roots[2]).toBeCloseTo(Math.PI, 4)
  })

  it('渐近线不误报为根：1/x 无交点', () => {
    const fn = compileExpression('1/x')
    expect(findRoots(x => fn(x, { a: 0, b: 0, c: 0 }), -10, 10)).toEqual([])
  })

  it('渐近线落在采样点之间也不误报：1/(x-2.001) 无交点', () => {
    const fn = compileExpression('1/(x-2.001)')
    expect(findRoots(x => fn(x, { a: 0, b: 0, c: 0 }), -10, 10)).toEqual([])
  })
})

describe('sampleCurve：折线段采样', () => {
  it('连续曲线产出单段且端点覆盖视口', () => {
    const fn = compileExpression('x^2')
    const segs = sampleCurve(x => fn(x, { a: 0, b: 0, c: 0 }), -10, 10, -5, 100, 300)
    expect(segs.length).toBe(1)
    expect(segs[0].length).toBeGreaterThan(64)
    expect(segs[0][0].x).toBeCloseTo(-10)
    expect(segs[0][segs[0].length - 1].x).toBeCloseTo(10)
    expect(segs[0].every(p => Number.isFinite(p.y))).toBe(true)
  })

  it('反比例在 x=0 断为两段，段内不跨轴', () => {
    const fn = compileExpression('1/x')
    const segs = sampleCurve(x => fn(x, { a: 0, b: 0, c: 0 }), -10, 10, -10, 10, 300)
    expect(segs.length).toBeGreaterThanOrEqual(2)
    for (const seg of segs) {
      const allNeg = seg.every(p => p.x < 0)
      const allPos = seg.every(p => p.x > 0)
      expect(allNeg || allPos).toBe(true)
    }
  })

  it('全程定义域外（NaN）返回空数组', () => {
    expect(sampleCurve(() => NaN, -10, 10, -10, 10, 300)).toEqual([])
  })
})
