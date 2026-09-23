/**
 * 函数表达式解析 / 求值 / 求根 / 采样：纯逻辑模块（零依赖，不依赖 uni API / DOM）
 *
 * 供「函数图像」工具页使用：
 * - parseExpression 把表达式文本解析为 AST，语法错误抛出带字符位置的中文提示；
 * - evaluateExpression 按上下文（自变量 x 与参数 a/b/c）求值，定义域外（如 sqrt(-1)）返回 NaN；
 * - compileExpression 解析一次得到可重复调用的求值函数，采样 / 求根时直接调用；
 * - findRoots 用「均匀采样 + 符号变化二分」求曲线与 x 轴交点（方程视角）；
 * - sampleCurve 按像素列把曲线采样为若干折线段，遇到定义域断点 / 大幅越界自动分段，
 *   避免反比例、正切等函数在渐近线两侧被错误地连成竖线。
 */

/** 求值上下文：自变量 x 与可调参数 a/b/c（与页面上的三条滑条对应） */
export interface ExprContext {
  x: number
  a: number
  b: number
  c: number
}

export type BinaryOp = '+' | '-' | '*' | '/' | '%' | '^'
export type FnName =
  | 'sin' | 'cos' | 'tan'
  | 'asin' | 'acos' | 'atan'
  | 'sqrt' | 'abs' | 'floor' | 'ceil'
  | 'ln' | 'log' | 'exp'

export type ExprNode =
  | { kind: 'num'; value: number }
  | { kind: 'var'; name: 'x' | 'a' | 'b' | 'c' }
  | { kind: 'const'; name: 'pi' | 'e' }
  | { kind: 'neg'; operand: ExprNode }
  | { kind: 'bin'; op: BinaryOp; left: ExprNode; right: ExprNode }
  | { kind: 'call'; fn: FnName; arg: ExprNode }

/** 表达式语法错误：message 统一为「第 N 个字符附近：…」格式，便于用户定位输入问题 */
export class ExprError extends Error {
  /** 出错位置在源码中的下标（0 起） */
  readonly pos: number
  constructor(pos: number, message: string) {
    super(`第 ${pos + 1} 个字符附近：${message}`)
    this.name = 'ExprError'
    this.pos = pos
  }
}

// ===== 词法分析 =====

interface Token {
  type: 'num' | 'ident' | 'op' | 'lparen' | 'rparen'
  value: string
  /** 在源码中的起始下标（0 起），用于报错定位 */
  pos: number
}

const BINARY_OPS = '+-*/%^'

function tokenize(src: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  while (i < src.length) {
    const ch = src[i]
    // 空白字符直接跳过
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
      i++
      continue
    }
    // 数字：整数 / 小数（.5 与 1. 均按 parseFloat 规则放行，多个小数点报错）
    if (/[0-9.]/.test(ch)) {
      const start = i
      let dotCount = 0
      while (i < src.length && /[0-9.]/.test(src[i])) {
        if (src[i] === '.') dotCount++
        if (dotCount > 1) throw new ExprError(i, '数字中的小数点过多')
        i++
      }
      tokens.push({ type: 'num', value: src.slice(start, i), pos: start })
      continue
    }
    // 标识符：变量 / 常量 / 函数名（字母或下划线开头）
    if (/[a-zA-Z_]/.test(ch)) {
      const start = i
      while (i < src.length && /[a-zA-Z0-9_]/.test(src[i])) i++
      tokens.push({ type: 'ident', value: src.slice(start, i), pos: start })
      continue
    }
    if (BINARY_OPS.includes(ch)) {
      tokens.push({ type: 'op', value: ch, pos: i })
      i++
      continue
    }
    if (ch === '(') {
      tokens.push({ type: 'lparen', value: ch, pos: i })
      i++
      continue
    }
    if (ch === ')') {
      tokens.push({ type: 'rparen', value: ch, pos: i })
      i++
      continue
    }
    throw new ExprError(i, `无法识别的字符「${ch}」`)
  }
  return tokens
}

// ===== 语法分析（Pratt 优先级爬升） =====

/** 二元运算符优先级：幂最高；幂右结合（2^3^2 = 2^(3^2)），其余左结合 */
const BIN_PREC: Record<BinaryOp, number> = { '+': 1, '-': 1, '*': 2, '/': 2, '%': 2, '^': 3 }
const POW_PREC = BIN_PREC['^']

const VARS = ['x', 'a', 'b', 'c'] as const
const CONSTS: Record<'pi' | 'e', number> = { pi: Math.PI, e: Math.E }
const FUNCS: readonly FnName[] = [
  'sin', 'cos', 'tan',
  'asin', 'acos', 'atan',
  'sqrt', 'abs', 'floor', 'ceil',
  'ln', 'log', 'exp',
]

export function parseExpression(src: string): ExprNode {
  const tokens = tokenize(src)
  if (tokens.length === 0) throw new ExprError(0, '表达式为空')
  let index = 0
  const peek = () => tokens[index]
  const take = () => tokens[index++]

  /** 解析优先级 >= minPrec 的二元运算链 */
  function parseExpr(minPrec: number): ExprNode {
    let left = parsePrefix()
    for (;;) {
      const tok = peek()
      if (!tok || tok.type !== 'op') break
      const prec = BIN_PREC[tok.value as BinaryOp]
      if (prec === undefined || prec < minPrec) break
      take()
      // 右结合运算符右侧用同级优先级递归，其余用更高优先级，保证左结合
      const right = parseExpr(tok.value === '^' ? prec : prec + 1)
      left = { kind: 'bin', op: tok.value as BinaryOp, left, right }
    }
    return left
  }

  /** 解析前缀位置：数字 / 标识符 / 括号 / 一元正负号 */
  function parsePrefix(): ExprNode {
    const tok = take()
    if (!tok) throw new ExprError(src.length, '表达式不完整')
    if (tok.type === 'op') {
      if (tok.value === '+') return parsePrefix()
      if (tok.value === '-') {
        // 一元负号优先级介于幂与乘除之间：-2^2 = -(2^2) = -4，同时支持 2^-3
        return { kind: 'neg', operand: parseExpr(POW_PREC) }
      }
      throw new ExprError(tok.pos, `「${tok.value}」不能放在这里`)
    }
    if (tok.type === 'num') return { kind: 'num', value: parseFloat(tok.value) }
    if (tok.type === 'lparen') {
      const inner = parseExpr(0)
      const close = take()
      if (!close || close.type !== 'rparen') throw new ExprError(tok.pos, '缺少右括号')
      return inner
    }
    if (tok.type === 'ident') {
      const name = tok.value.toLowerCase()
      if ((VARS as readonly string[]).includes(name)) {
        return { kind: 'var', name: name as 'x' | 'a' | 'b' | 'c' }
      }
      if (name === 'pi' || name === 'e') {
        return { kind: 'const', name }
      }
      if ((FUNCS as readonly string[]).includes(name)) {
        const open = take()
        if (!open || open.type !== 'lparen') {
          throw new ExprError(tok.pos, `函数 ${name} 后面需要括号，如 ${name}(x)`)
        }
        const arg = parseExpr(0)
        const close = take()
        if (!close || close.type !== 'rparen') {
          throw new ExprError(tok.pos, `函数 ${name} 缺少右括号`)
        }
        return { kind: 'call', fn: name as FnName, arg }
      }
      throw new ExprError(tok.pos, `未定义的符号「${tok.value}」（可用变量 x/a/b/c、常量 pi/e）`)
    }
    // 右括号等落在前缀位置
    throw new ExprError(tok.pos, `「${tok.value}」不能放在这里`)
  }

  const root = parseExpr(0)
  if (index < tokens.length) {
    throw new ExprError(tokens[index].pos, `「${tokens[index].value}」附近有多余的内容`)
  }
  return root
}

// ===== 求值 =====

/** 函数表：ln 为自然对数，log 为常用对数（以 10 为底） */
const FN_IMPL: Record<FnName, (v: number) => number> = {
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  asin: Math.asin,
  acos: Math.acos,
  atan: Math.atan,
  sqrt: Math.sqrt,
  abs: Math.abs,
  floor: Math.floor,
  ceil: Math.ceil,
  ln: Math.log,
  log: Math.log10,
  exp: Math.exp,
}

export function evaluateExpression(node: ExprNode, ctx: ExprContext): number {
  let v: number
  switch (node.kind) {
    case 'num':
      return node.value
    case 'var':
      return ctx[node.name]
    case 'const':
      return CONSTS[node.name]
    case 'neg':
      v = -evaluateExpression(node.operand, ctx)
      break
    case 'bin': {
      const l = evaluateExpression(node.left, ctx)
      const r = evaluateExpression(node.right, ctx)
      switch (node.op) {
        case '+': v = l + r; break
        case '-': v = l - r; break
        case '*': v = l * r; break
        case '/': v = l / r; break
        case '%': v = l % r; break
        case '^': v = Math.pow(l, r); break
      }
      break
    }
    case 'call':
      v = FN_IMPL[node.fn](evaluateExpression(node.arg, ctx))
      break
  }
  // 定义域外（sqrt 负数、ln(0)、0/0 等产生 NaN/±Infinity）统一归一为 NaN，
  // 采样与求根侧遇到 NaN 会跳过分段，不会中断绘制
  return Number.isFinite(v) ? v : NaN
}

/** 编译结果：给定 x 与参数 a/b/c，返回函数值（定义域外为 NaN） */
export type ExprEvaluator = (x: number, params: { a: number; b: number; c: number }) => number

/** 解析并编译为可重复调用的求值函数；语法错误抛 ExprError */
export function compileExpression(src: string): ExprEvaluator {
  const node = parseExpression(src)
  return (x, params) => evaluateExpression(node, { x, ...params })
}

// ===== 求根：均匀采样 + 符号变化二分 =====

export interface RootOptions {
  /** 均匀采样段数，默认 1000（视口宽 20 时步长约 0.02） */
  samples?: number
  /** 最多返回的交点个数，超出即截断，默认 32 */
  maxRoots?: number
}

/** 二分求单根：前提是 f(lo) 与 f(hi) 异号 */
function bisect(fn: (x: number) => number, lo: number, hi: number): number {
  let fLo = fn(lo)
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2
    const fMid = fn(mid)
    if (fMid === 0) return mid
    if (fLo * fMid < 0) {
      hi = mid
    } else {
      lo = mid
      fLo = fMid
    }
  }
  return (lo + hi) / 2
}

function pushRoot(roots: number[], x: number): void {
  // 去掉重复根（恰好落在相邻两段分点上的情况）
  if (roots.length === 0 || Math.abs(x - roots[roots.length - 1]) > 1e-6) {
    roots.push(x)
  }
}

/**
 * 求 fn 在 [xMin, xMax] 内与 x 轴的交点（即方程 f(x)=0 的数值解）。
 * 按 samples 均匀采样，相邻采样点符号变化处用二分法细化；定义域外（NaN）跳过。
 * 注意：与轴相切但不变号的根（如 x^2 的 0 点）采样法抓不到。
 */
export function findRoots(
  fn: (x: number) => number,
  xMin: number,
  xMax: number,
  options: RootOptions = {}
): number[] {
  const samples = options.samples ?? 1000
  const maxRoots = options.maxRoots ?? 32
  const roots: number[] = []
  const step = (xMax - xMin) / samples

  let prevX = xMin
  let prevY = fn(prevX)
  if (prevY === 0) roots.push(prevX)

  for (let i = 1; i <= samples && roots.length < maxRoots; i++) {
    const x = xMin + i * step
    const y = fn(x)
    if (Number.isNaN(y)) {
      prevX = x
      prevY = y
      continue
    }
    if (y === 0) {
      pushRoot(roots, x)
    } else if (!Number.isNaN(prevY) && prevY * y < 0) {
      pushRoot(roots, bisect(fn, prevX, x))
    }
    prevX = x
    prevY = y
  }
  return roots
}

// ===== 曲线采样 =====

export interface CurvePoint {
  x: number
  y: number
}

/**
 * 把曲线 y=fn(x) 在视口 [xMin,xMax]×[yMin,yMax] 内采样为若干折线段（数据坐标）。
 * 每逻辑像素约 2 个采样点；遇到非有限值（定义域外）或 y 超出视口 4 倍高度
 * （渐近线另一侧）时截断当前段，下一点另起新段，避免竖直假线。
 */
export function sampleCurve(
  fn: (x: number) => number,
  xMin: number,
  xMax: number,
  yMin: number,
  yMax: number,
  pixelWidth: number
): CurvePoint[][] {
  const count = Math.max(64, Math.min(4096, Math.round(pixelWidth * 2)))
  const step = (xMax - xMin) / count
  const yPad = (yMax - yMin) * 4
  const segments: CurvePoint[][] = []
  let current: CurvePoint[] = []
  for (let i = 0; i <= count; i++) {
    const x = xMin + i * step
    const y = fn(x)
    const usable = Number.isFinite(y) && y >= yMin - yPad && y <= yMax + yPad
    if (!usable) {
      if (current.length > 1) segments.push(current)
      current = []
      continue
    }
    current.push({ x, y })
  }
  if (current.length > 1) segments.push(current)
  return segments
}
