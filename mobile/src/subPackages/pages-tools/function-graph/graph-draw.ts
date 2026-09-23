/**
 * 函数图像 canvas 绘制：薄 canvas 层（纯函数，使用逻辑坐标，调用前自行按 dpr scale）。
 *
 * 参照 pages-knowledge/table-image.ts 的分层方式：坐标映射、网格步长、刻度标注、
 * 曲线与交点绘制都在这里完成，页面侧只负责拿到小程序 canvas 2d context 后调用。
 */

import type { CurvePoint } from './func-expr'

/** 视口窗口（数据坐标） */
export interface GraphView {
  xMin: number
  xMax: number
  yMin: number
  yMax: number
}

/** 绘制用到的最小 context 接口（与小程序 canvas 2d / 测试 mock 兼容） */
export interface GraphCtx {
  fillStyle: string
  strokeStyle: string
  font: string
  textAlign: CanvasTextAlign
  textBaseline: CanvasTextBaseline
  lineWidth: number
  beginPath(): void
  moveTo(x: number, y: number): void
  lineTo(x: number, y: number): void
  stroke(): void
  fill(): void
  fillRect(x: number, y: number, w: number, h: number): void
  fillText(text: string, x: number, y: number): void
  arc(x: number, y: number, radius: number, startAngle: number, endAngle: number): void
}

export interface GraphColors {
  background?: string
  grid?: string
  axis?: string
  label?: string
  curve?: string
  rootMarker?: string
  rootLabel?: string
}

export interface GraphDrawInput {
  /** 画布逻辑尺寸（px） */
  width: number
  height: number
  /** 视口窗口（数据坐标） */
  view: GraphView
  /** 曲线折线段（数据坐标，见 sampleCurve） */
  segments: CurvePoint[][]
  /** 曲线与 x 轴交点的 x 坐标（数据坐标） */
  roots: number[]
  colors?: GraphColors
}

const DEFAULT_COLORS = {
  background: '#ffffff',
  grid: '#e3ece7',
  axis: '#9db8ae',
  label: '#8aa39a',
  curve: '#52796f',
  rootMarker: '#c0764f',
  rootLabel: '#c0764f',
}

/** 把 raw 向上取到 1/2/5 × 10^n 系列，保证网格步长是「好看」的数 */
function niceStep(raw: number): number {
  const pow = Math.pow(10, Math.floor(Math.log10(raw)))
  const n = raw / pow
  if (n <= 1) return pow
  if (n <= 2) return 2 * pow
  if (n <= 5) return 5 * pow
  return 10 * pow
}

/** 刻度数字：消除浮点尾巴，去掉无意义的 -0 */
function formatTick(v: number): string {
  const r = Math.round(v * 100) / 100
  return Object.is(r, -0) ? '0' : String(r)
}

/** 交点坐标：保留 3 位小数（交点 y 恒为 0，只格式化 x） */
function formatRoot(v: number): string {
  const r = Math.round(v * 1000) / 1000
  return Object.is(r, -0) ? '0' : String(r)
}

/**
 * 在 canvas 2d context 上绘制函数图像：
 * 背景 → 网格 → 坐标轴与刻度 → 曲线 → 与 x 轴交点（圆点 + 坐标标注）。
 * 画布坐标系为左上角原点、y 向下，数据坐标经视口线性映射。
 */
export function drawFunctionGraph(ctx: GraphCtx, input: GraphDrawInput): void {
  const W = input.width
  const H = input.height
  const view = input.view
  const colors = { ...DEFAULT_COLORS, ...input.colors }

  const toPxX = (x: number) => ((x - view.xMin) / (view.xMax - view.xMin)) * W
  // 数据 y 向上增长，画布 y 向下增长，需要翻转
  const toPxY = (y: number) => H - ((y - view.yMin) / (view.yMax - view.yMin)) * H

  // 背景
  ctx.fillStyle = colors.background
  ctx.fillRect(0, 0, W, H)
  ctx.lineWidth = 1

  // 网格与刻度：视口范围 / 8 取整步长
  const stepX = niceStep((view.xMax - view.xMin) / 8)
  const stepY = niceStep((view.yMax - view.yMin) / 8)
  const xTicks: number[] = []
  for (let x = Math.ceil(view.xMin / stepX) * stepX; x <= view.xMax; x += stepX) xTicks.push(x)
  const yTicks: number[] = []
  for (let y = Math.ceil(view.yMin / stepY) * stepY; y <= view.yMax; y += stepY) yTicks.push(y)

  // 竖网格线
  ctx.strokeStyle = colors.grid
  for (const x of xTicks) {
    const px = Math.round(toPxX(x)) + 0.5
    ctx.beginPath()
    ctx.moveTo(px, 0)
    ctx.lineTo(px, H)
    ctx.stroke()
  }
  // 横网格线
  for (const y of yTicks) {
    const py = Math.round(toPxY(y)) + 0.5
    ctx.beginPath()
    ctx.moveTo(0, py)
    ctx.lineTo(W, py)
    ctx.stroke()
  }

  // 坐标轴（0 轴在视口内才画）
  ctx.strokeStyle = colors.axis
  const showYAxis = view.xMin < 0 && view.xMax > 0
  const showXAxis = view.yMin < 0 && view.yMax > 0
  if (showYAxis) {
    const px = Math.round(toPxX(0)) + 0.5
    ctx.beginPath()
    ctx.moveTo(px, 0)
    ctx.lineTo(px, H)
    ctx.stroke()
  }
  if (showXAxis) {
    const py = Math.round(toPxY(0)) + 0.5
    ctx.beginPath()
    ctx.moveTo(0, py)
    ctx.lineTo(W, py)
    ctx.stroke()
  }

  // 刻度数字：x 刻度沿 x 轴下方（轴不可见时贴底），y 刻度沿 y 轴左侧（轴不可见时贴左）
  ctx.fillStyle = colors.label
  ctx.font = '10px sans-serif'
  ctx.textBaseline = 'top'
  const labelY = showXAxis ? Math.min(Math.max(toPxY(0) + 3, 2), H - 13) : H - 13
  for (const x of xTicks) {
    ctx.textAlign = 'center'
    ctx.fillText(formatTick(x), toPxX(x), labelY)
  }
  const labelX = showYAxis ? Math.max(toPxX(0) - 4, 14) : 2
  for (const y of yTicks) {
    // 0 与 x 轴刻度重复，跳过
    if (Object.is(Math.round(y * 100) / 100, 0)) continue
    ctx.textAlign = 'right'
    ctx.fillText(formatTick(y), labelX, Math.min(Math.max(toPxY(y) - 6, 2), H - 13))
  }

  // 曲线
  ctx.strokeStyle = colors.curve
  ctx.lineWidth = 2
  for (const seg of input.segments) {
    if (seg.length < 2) continue
    ctx.beginPath()
    ctx.moveTo(toPxX(seg[0].x), toPxY(seg[0].y))
    for (let i = 1; i < seg.length; i++) {
      ctx.lineTo(toPxX(seg[i].x), toPxY(seg[i].y))
    }
    ctx.stroke()
  }

  // 与 x 轴交点：圆点 + 坐标标注（标在点上方，x 方向钳制在画布内）
  const axisPy = showXAxis ? toPxY(0) : null
  if (axisPy !== null) {
    ctx.font = '11px sans-serif'
    for (const rx of input.roots) {
      const px = toPxX(rx)
      if (px < -4 || px > W + 4) continue
      ctx.fillStyle = colors.rootMarker
      ctx.beginPath()
      ctx.arc(px, axisPy, 4, 0, Math.PI * 2)
      ctx.fill()
      const text = `(${formatRoot(rx)}, 0)`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'bottom'
      ctx.fillStyle = colors.rootLabel
      ctx.fillText(text, Math.min(Math.max(px, 30), W - 30), axisPy - 8)
    }
  }
}
