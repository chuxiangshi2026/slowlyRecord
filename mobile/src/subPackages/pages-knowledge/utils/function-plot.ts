/**
 * 函数图像纯函数工具：安全表达式编译、采样、可视范围计算与 canvas 2d 绘制。
 *
 * 与组件 / uni API 解耦，便于单测；页面侧拿到 canvas 2d context 后直接调用 drawPlot。
 * 绘制只使用 canvas 2d 基础 API（moveTo/lineTo/arc/fillText 等），兼容抖音小程序子集。
 */

/** 函数图像的可视范围（数据坐标） */
export interface PlotRange {
  xMin: number
  xMax: number
  yMin: number
  yMax: number
}

/** 一条折线段（断点处拆分，段内连续） */
export type PlotSegment = { x: number; y: number }[]

/** 绘制用到的最小 context 接口（与小程序 canvas 2d / 测试 mock 兼容） */
export interface PlotCtx {
  strokeStyle: string
  fillStyle: string
  lineWidth: number
  font: string
  textAlign: CanvasTextAlign
  textBaseline: CanvasTextBaseline
  beginPath(): void
  moveTo(x: number, y: number): void
  lineTo(x: number, y: number): void
  stroke(): void
  fillRect(x: number, y: number, w: number, h: number): void
  fillText(text: string, x: number, y: number): void
}

/** 支持的函数名（白名单，防止任意代码执行） */
const FUNCS: Record<string, (x: number) => number> = {
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  sqrt: Math.sqrt,
  abs: Math.abs,
  exp: Math.exp,
  ln: Math.log,
  log: Math.log,
}

const CONSTS: Record<string, number> = {
  pi: Math.PI,
  e: Math.E,
}

/**
 * 把安全表达式编译为 y=f(x) 函数。
 * 语法：四则运算 + - * /、幂 ^（右结合）、括号、一元负号、
 * 常量 pi/e、函数 sin/cos/tan/sqrt/abs/exp/ln/log、自变量 x。
 * 非法输入抛出 Error（不执行任何用户代码以外的逻辑）。
 */
export function compileExpression(src: string): (x: number) => number {
  const tokens = tokenize(src)
  let pos = 0
  const peek = () => tokens[pos]
  const next = () => tokens[pos++]

  function parseExpr(): (x: number) => number {
    let left = parseTerm()
    while (peek()?.type === 'op' && (peek().value === '+' || peek().value === '-')) {
      const op = next().value
      const right = parseTerm()
      const l = left
      left = op === '+' ? x => l(x) + right(x) : x => l(x) - right(x)
    }
    return left
  }

  function parseTerm(): (x: number) => number {
    let left = parseFactor()
    while (peek()?.type === 'op' && (peek().value === '*' || peek().value === '/')) {
      const op = next().value
      const right = parseFactor()
      const l = left
      left = op === '*' ? x => l(x) * right(x) : x => l(x) / right(x)
    }
    return left
  }

  function parseFactor(): (x: number) => number {
    // 一元 +/- 在幂之外：-x^2 = -(x^2)；2^-3 中 ^ 右侧再递归解析
    const t = peek()
    if (t?.type === 'op' && (t.value === '-' || t.value === '+')) {
      next()
      const v = parseFactor()
      return t.value === '-' ? x => -v(x) : v
    }
    const base = parsePrimary()
    // 幂运算右结合：a^b^c = a^(b^c)
    if (peek()?.type === 'op' && peek().value === '^') {
      next()
      const exp = parseFactor()
      const b = base
      return x => Math.pow(b(x), exp(x))
    }
    return base
  }

  function parsePrimary(): (x: number) => number {
    const t = next()
    if (!t) throw new Error('表达式意外结束')
    if (t.type === 'num') return () => t.value as number
    if (t.type === 'ident') {
      const name = t.value as string
      if (name === 'x') return x => x
      if (name in CONSTS) return () => CONSTS[name]
      if (name in FUNCS) {
        const open = next()
        if (open?.type !== 'lparen') throw new Error(`函数 ${name} 后缺少括号`)
        const arg = parseExpr()
        const close = next()
        if (close?.type !== 'rparen') throw new Error(`函数 ${name} 缺少右括号`)
        const fn = FUNCS[name]
        return x => fn(arg(x))
      }
      throw new Error(`未知标识符：${name}`)
    }
    if (t.type === 'lparen') {
      const inner = parseExpr()
      const close = next()
      if (close?.type !== 'rparen') throw new Error('缺少右括号')
      return inner
    }
    throw new Error(`意外的符号：${String(t.value)}`)
  }

  type Token = { type: 'num' | 'ident' | 'op' | 'lparen' | 'rparen'; value: string | number }
  function tokenize(s: string): Token[] {
    const out: Token[] = []
    let i = 0
    while (i < s.length) {
      const ch = s[i]
      if (/\s/.test(ch)) { i++; continue }
      if (/[0-9.]/.test(ch)) {
        const m = /^\d*\.?\d+/.exec(s.slice(i))
        if (!m) throw new Error(`非法数字：${s.slice(i, i + 5)}`)
        out.push({ type: 'num', value: Number(m[0]) })
        i += m[0].length
        continue
      }
      if (/[a-zA-Z]/.test(ch)) {
        const m = /^[a-zA-Z]+/.exec(s.slice(i))!
        out.push({ type: 'ident', value: m[0].toLowerCase() })
        i += m[0].length
        continue
      }
      if ('+-*/^'.includes(ch)) { out.push({ type: 'op', value: ch }); i++; continue }
      if (ch === '(') { out.push({ type: 'lparen', value: ch }); i++; continue }
      if (ch === ')') { out.push({ type: 'rparen', value: ch }); i++; continue }
      throw new Error(`不支持的字符：${ch}`)
    }
    return out
  }

  const body = parseExpr()
  if (pos !== tokens.length) throw new Error('表达式末尾有多余内容')
  return x => body(x)
}

/** 断点检测：相邻两点是否断开连线（渐近线、洞、溢出） */
export function isPlotDiscontinuity(y1: number, y2: number): boolean {
  if (!Number.isFinite(y1) || !Number.isFinite(y2)) return true
  if (y1 === 0 || y2 === 0) return false
  if (Math.sign(y1) === Math.sign(y2)) return false
  const a = Math.abs(y1)
  const b = Math.abs(y2)
  const smaller = Math.min(a, b)
  const larger = Math.max(a, b)
  // 符号相反且至少一侧绝对值很大 → 视为渐近线跳变
  return smaller > 10 || larger / smaller > 1000
}

/**
 * 在 [xMin, xMax] 上采样函数并拆分成连续段。
 * y 值超出 clip 范围（渐近线附近溢出）的点视为断点。
 */
export function sampleFunction(
  fn: (x: number) => number,
  xMin: number,
  xMax: number,
  samples = 240,
  yClip = 1e6,
): PlotSegment[] {
  const segments: PlotSegment[] = []
  let cur: PlotSegment = []
  const step = (xMax - xMin) / samples
  let prevY = 0
  for (let i = 0; i <= samples; i++) {
    const x = xMin + step * i
    let y = fn(x)
    if (Number.isFinite(y) && Math.abs(y) > yClip) y = NaN
    const broken = i > 0 && isPlotDiscontinuity(prevY, y)
    if (!Number.isFinite(y) || broken) {
      if (cur.length > 1) segments.push(cur)
      cur = []
    } else {
      cur.push({ x, y })
    }
    prevY = y
  }
  if (cur.length > 1) segments.push(cur)
  return segments
}

/** 按采样点自动计算 y 方向可视范围（上下各留 10% 边距；全非法时回退 [-1, 1]） */
export function calcPlotYRange(segments: PlotSegment[]): { yMin: number; yMax: number } {
  let yMin = Infinity
  let yMax = -Infinity
  for (const seg of segments) {
    for (const p of seg) {
      if (p.y < yMin) yMin = p.y
      if (p.y > yMax) yMax = p.y
    }
  }
  if (!Number.isFinite(yMin) || !Number.isFinite(yMax)) return { yMin: -1, yMax: 1 }
  if (yMax === yMin) return { yMin: yMin - 1, yMax: yMax + 1 }
  const pad = (yMax - yMin) * 0.1
  return { yMin: yMin - pad, yMax: yMax + pad }
}

/** 数据坐标 → 画布逻辑坐标（y 轴翻转） */
export function dataToPx(
  dx: number,
  dy: number,
  range: PlotRange,
  width: number,
  height: number,
): { x: number; y: number } {
  return {
    x: ((dx - range.xMin) / (range.xMax - range.xMin)) * width,
    y: ((range.yMax - dy) / (range.yMax - range.yMin)) * height,
  }
}

/**
 * 在 canvas 2d context 上绘制简化函数图像：边框、过原点坐标轴、刻度、曲线。
 * 调用前需自行处理 dpr 缩放（width/height 为逻辑尺寸）。
 */
export function drawPlot(
  ctx: PlotCtx,
  width: number,
  height: number,
  segments: PlotSegment[],
  range: PlotRange,
): void {
  const AXIS = '#b8c4be'
  const CURVE = '#52796f'
  const TICK = '#9aa5a0'

  // 背景与边框
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)
  ctx.strokeStyle = '#e3eae6'
  ctx.lineWidth = 1
  ctx.strokeRect(0.5, 0.5, width - 1, height - 1)

  // 坐标轴（过原点；原点不在范围内则贴边）
  const origin = dataToPx(0, 0, range, width, height)
  const xAxisY = Math.max(0, Math.min(height, origin.y))
  const yAxisX = Math.max(0, Math.min(width, origin.x))
  ctx.strokeStyle = AXIS
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(0, xAxisY)
  ctx.lineTo(width, xAxisY)
  ctx.moveTo(yAxisX, 0)
  ctx.lineTo(yAxisX, height)
  ctx.stroke()

  // 刻度：x/y 各取一个「好看」的步长
  const xStep = niceStep((range.xMax - range.xMin) / 6)
  const yStep = niceStep((range.yMax - range.yMin) / 6)
  ctx.fillStyle = TICK
  ctx.font = '10px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  for (let v = Math.ceil(range.xMin / xStep) * xStep; v <= range.xMax; v += xStep) {
    const p = dataToPx(v, 0, range, width, height)
    ctx.fillText(fmtTick(v), p.x, Math.min(height - 12, Math.max(2, xAxisY + 3)))
  }
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  for (let v = Math.ceil(range.yMin / yStep) * yStep; v <= range.yMax; v += yStep) {
    if (Math.abs(v) < yStep / 2) continue // 原点交给 x 轴刻度
    const p = dataToPx(0, v, range, width, height)
    ctx.fillText(fmtTick(v), Math.min(width - 24, Math.max(2, yAxisX + 3)), p.y)
  }

  // 曲线
  ctx.strokeStyle = CURVE
  ctx.lineWidth = 2
  for (const seg of segments) {
    ctx.beginPath()
    seg.forEach((p, i) => {
      const q = dataToPx(p.x, p.y, range, width, height)
      if (i === 0) ctx.moveTo(q.x, q.y)
      else ctx.lineTo(q.x, q.y)
    })
    ctx.stroke()
  }
}

/** 取「好看」的刻度步长（1/2/5×10^n） */
export function niceStep(raw: number): number {
  const pow = Math.pow(10, Math.floor(Math.log10(raw)))
  const n = raw / pow
  if (n <= 1) return pow
  if (n <= 2) return 2 * pow
  if (n <= 5) return 5 * pow
  return 10 * pow
}

/** 刻度数字格式化：整数去小数，否则保留 2 位有效小数 */
function fmtTick(v: number): string {
  const r = Math.round(v * 100) / 100
  return String(r)
}
