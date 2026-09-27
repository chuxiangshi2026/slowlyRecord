/**
 * 知识表格图片导出：纯逻辑模块（不依赖 uni API / DOM）
 *
 * 移植自桌面端 src/utils/table-image-export.ts，绘制风格与其导出的 PNG 对齐：
 * 白底、浅灰表头、细网格线、标题加粗居中、填空位画下划线。
 * 布局计算（computeTableLayout / wrapText）与绘制（drawTableImage）抽成纯函数，
 * 页面侧拿到小程序 canvas 2d context 后直接调用 drawTableImage 绘制。
 */

import type { KnowledgePack } from '@/stores/useUtils/types'

/** 表格形态：full 完整表（含答案）/ blank 填空自测表（答案留空画下划线） */
export type TableForm = 'full' | 'blank'

export interface TableColumnData {
  /** 表头文本 */
  header: string
  /** 该列所有单元格文本（各列等长；填空表留空字符串即可） */
  values: string[]
}

export interface TableImageData {
  /** 表格标题（知识包名） */
  title: string
  /** 列定义 */
  columns: TableColumnData[]
}

/** 文本测量函数：返回给定字符串在当前字体下的像素宽度 */
export type MeasureTextFn = (text: string) => number

export interface TableImageOptions {
  /** 画布最大宽度（px），内容超出时整体等比缩放，默认 1200 */
  maxWidth?: number
  /** 单元格左右内边距，默认 16 */
  cellPaddingX?: number
  /** 单元格上下内边距，默认 10 */
  cellPaddingY?: number
  /** 正文字号，默认 16 */
  fontSize?: number
  /** 标题字号，默认 24 */
  titleFontSize?: number
  /** 行高（相对字号倍数），默认 1.6 */
  lineHeight?: number
  /** 表头底色，默认浅灰 */
  headerBg?: string
  /** 网格线颜色，默认浅灰 */
  gridColor?: string
  /** 标题颜色，默认深灰 */
  titleColor?: string
  /** 正文/表头文字颜色，默认深灰 */
  textColor?: string
  /** 填空下划线颜色，默认深灰 */
  blankColor?: string
  /** 画布背景色，默认白 */
  backgroundColor?: string
}

export interface TableLayoutResult {
  /** 画布宽度（px） */
  canvasWidth: number
  /** 画布高度（px） */
  canvasHeight: number
  /** 各列宽度（px） */
  columnWidths: number[]
  /** 表头行高（px） */
  headerHeight: number
  /** 标题区高度（px） */
  titleHeight: number
  /** 每行数据行高（px） */
  rowHeights: number[]
  /** 内容区底部留白（px） */
  paddingY: number
}

/** 绘制用到的最小 context 接口（与小程序 canvas 2d / 测试 mock 兼容） */
export interface TableImageCtx {
  fillStyle: string
  strokeStyle: string
  font: string
  textAlign: CanvasTextAlign
  textBaseline: CanvasTextBaseline
  lineWidth: number
  scale(x: number, y: number): void
  beginPath(): void
  closePath(): void
  moveTo(x: number, y: number): void
  lineTo(x: number, y: number): void
  stroke(): void
  fillRect(x: number, y: number, w: number, h: number): void
  fillText(text: string, x: number, y: number): void
  measureText(text: string): { width: number }
}

const DEFAULT_MAX_WIDTH = 1200
const DEFAULT_CELL_PADDING_X = 16
const DEFAULT_CELL_PADDING_Y = 10
const DEFAULT_FONT_SIZE = 16
const DEFAULT_TITLE_FONT_SIZE = 24
const DEFAULT_LINE_HEIGHT = 1.6

/**
 * 按最大宽度把文本拆成多行。
 * 优先在空格处断行，避免拆散英文单词；单个超长词按字符硬切。
 * 空字符串返回 ['']，表示一个空行（填空位）。
 */
export function wrapText(text: string, maxWidth: number, measure: MeasureTextFn): string[] {
  if (!text) return ['']
  const words = text.split(/\s+/).filter(Boolean)
  if (words.length === 0) return ['']
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    // 单个词超过列宽时按字符硬切
    if (measure(word) > maxWidth) {
      if (current) {
        lines.push(current)
        current = ''
      }
      let rest = word
      while (rest) {
        let take = rest.length
        while (take > 1 && measure(rest.slice(0, take)) > maxWidth) take--
        lines.push(rest.slice(0, take))
        rest = rest.slice(take)
      }
      continue
    }
    const candidate = current ? `${current} ${word}` : word
    if (current && measure(candidate) > maxWidth) {
      lines.push(current)
      current = word
    } else {
      current = candidate
    }
  }
  if (current) lines.push(current)
  return lines
}

/**
 * 计算表格布局（纯函数）：列宽 / 行高 / 画布尺寸。
 * 列宽按「表头与内容的最大单行宽度 + 内边距」自适应，总宽超出 maxWidth 时整体等比缩放；
 * 行高按单元格换行后的行数自适应。
 */
export function computeTableLayout(
  data: TableImageData,
  measure: MeasureTextFn,
  options: TableImageOptions = {}
): TableLayoutResult {
  const maxWidth = options.maxWidth ?? DEFAULT_MAX_WIDTH
  const cellPaddingX = options.cellPaddingX ?? DEFAULT_CELL_PADDING_X
  const cellPaddingY = options.cellPaddingY ?? DEFAULT_CELL_PADDING_Y
  const fontSize = options.fontSize ?? DEFAULT_FONT_SIZE
  const titleFontSize = options.titleFontSize ?? DEFAULT_TITLE_FONT_SIZE
  const lineHeight = options.lineHeight ?? DEFAULT_LINE_HEIGHT

  // 1. 每列自然宽度 = max(表头, 全部内容) 单行宽度 + 水平内边距
  const naturalWidths = data.columns.map(col => {
    const headerW = measure(col.header)
    const maxValueW = col.values.reduce((max, v) => Math.max(max, measure(v)), 0)
    return Math.max(headerW, maxValueW) + cellPaddingX * 2
  })
  const naturalTotal = naturalWidths.reduce((sum, w) => sum + w, 0)

  // 2. 总宽超出画布最大宽度时整体等比缩放
  const scale = naturalTotal > maxWidth ? maxWidth / naturalTotal : 1
  const columnWidths = naturalWidths.map(w => w * scale)
  const canvasWidth = Math.round(columnWidths.reduce((sum, w) => sum + w, 0))

  // 3. 标题区高度（标题过长时自动换行）
  const titleInnerWidth = Math.max(canvasWidth - cellPaddingX * 2, 10)
  const titleLines = wrapText(data.title, titleInnerWidth, measure)
  const titleHeight = titleLines.length * titleFontSize * lineHeight + cellPaddingY * 2

  // 4. 表头行高
  let headerHeight = 0
  if (data.columns.length > 0) {
    const maxHeaderLines = data.columns.reduce((max, col, c) => {
      const innerW = Math.max(columnWidths[c] - cellPaddingX * 2, 10)
      return Math.max(max, wrapText(col.header, innerW, measure).length)
    }, 1)
    headerHeight = maxHeaderLines * fontSize * lineHeight + cellPaddingY * 2
  }

  // 5. 每行数据行高（按实际换行后的行数自适应）
  const rowCount = data.columns.length > 0 ? data.columns[0].values.length : 0
  const rowHeights: number[] = []
  for (let r = 0; r < rowCount; r++) {
    let maxLines = 1
    data.columns.forEach((col, c) => {
      const innerW = Math.max(columnWidths[c] - cellPaddingX * 2, 10)
      const lines = wrapText(col.values[r] ?? '', innerW, measure)
      maxLines = Math.max(maxLines, lines.length)
    })
    rowHeights.push(maxLines * fontSize * lineHeight + cellPaddingY * 2)
  }

  const canvasHeight = Math.round(
    titleHeight + headerHeight + rowHeights.reduce((sum, h) => sum + h, 0) + cellPaddingY * 2
  )

  return { canvasWidth, canvasHeight, columnWidths, headerHeight, titleHeight, rowHeights, paddingY: cellPaddingY }
}

/**
 * 导出用有效像素比（纯函数）：
 * 微信小程序 canvas 的物理尺寸过大（高分屏 × 长表，如 81 行乘法表 dpr=3 可达 8000px+）
 * 会导致 canvasToTempFilePath 失败或内存暴涨，故按 MAX_EXPORT_CANVAS_PX 限制物理边长，
 * 超出时自动降低 dpr——宁可略降清晰度也不让导出失败。
 */
export const MAX_EXPORT_CANVAS_PX = 4000

export function exportDpr(
  logicalW: number,
  logicalH: number,
  deviceDpr: number,
  maxPx = MAX_EXPORT_CANVAS_PX,
): number {
  const limit = Math.max(logicalW || 0, logicalH || 0)
  const dpr = Number.isFinite(deviceDpr) && deviceDpr > 0 ? deviceDpr : 2
  if (!Number.isFinite(limit) || limit <= 0) return Math.min(dpr, 3)
  const capped = Math.floor((maxPx / limit) * 100) / 100
  return Math.max(1, Math.min(dpr, capped))
}

/** 由知识包组装表格数据：题目/答案两列，完整表带答案、填空表答案留空（与桌面端一致） */
export function buildTableImageData(pack: KnowledgePack, form: TableForm): TableImageData {
  // 有序包按 order 排序，保证打印/导出顺序正确
  const items = pack.ordered
    ? [...pack.items].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    : pack.items
  return {
    title: pack.name,
    columns: [
      { header: '题目', values: items.map(i => i.question) },
      { header: '答案', values: items.map(i => (form === 'full' ? i.answer : '')) },
    ],
  }
}

/**
 * 基于 canvas 2d context 的测量函数。
 * 统一按正文字号测量（标题也按正文宽度估算，与桌面端 probe canvas 行为一致）。
 */
export function createMeasure(ctx: TableImageCtx, fontSize = DEFAULT_FONT_SIZE): MeasureTextFn {
  return (text: string) => {
    ctx.font = `${fontSize}px sans-serif`
    return ctx.measureText(text).width
  }
}

/** 在指定中心位置绘制多行文本（整体垂直居中） */
function drawCenteredLines(
  ctx: TableImageCtx,
  lines: string[],
  centerX: number,
  centerY: number,
  lineHeightPx: number,
  color: string
): void {
  ctx.fillStyle = color
  const totalH = lines.length * lineHeightPx
  let y = centerY - totalH / 2 + lineHeightPx / 2
  for (const line of lines) {
    ctx.fillText(line, centerX, y)
    y += lineHeightPx
  }
}

/**
 * 在 canvas 2d context 上绘制表格（逻辑坐标，调用前自行按 dpr scale）。
 * 乘号 ×、上下标等字符直接按文本绘制，与桌面端导出 PNG 风格对齐。
 */
export function drawTableImage(
  ctx: TableImageCtx,
  data: TableImageData,
  layout: TableLayoutResult,
  measure: MeasureTextFn,
  options: TableImageOptions = {}
): void {
  const cellPaddingX = options.cellPaddingX ?? DEFAULT_CELL_PADDING_X
  const fontSize = options.fontSize ?? DEFAULT_FONT_SIZE
  const titleFontSize = options.titleFontSize ?? DEFAULT_TITLE_FONT_SIZE
  const lineHeight = options.lineHeight ?? DEFAULT_LINE_HEIGHT
  const headerBg = options.headerBg ?? '#f2f3f5'
  const gridColor = options.gridColor ?? '#c9c9c9'
  const titleColor = options.titleColor ?? '#333333'
  const textColor = options.textColor ?? '#333333'
  const blankColor = options.blankColor ?? '#555555'
  const backgroundColor = options.backgroundColor ?? '#ffffff'

  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  // 背景
  ctx.fillStyle = backgroundColor
  ctx.fillRect(0, 0, layout.canvasWidth, layout.canvasHeight)

  let y = 0

  // 标题
  const titleLines = wrapText(data.title, Math.max(layout.canvasWidth - cellPaddingX * 2, 10), measure)
  ctx.font = `bold ${titleFontSize}px sans-serif`
  drawCenteredLines(
    ctx,
    titleLines,
    layout.canvasWidth / 2,
    y + layout.titleHeight / 2,
    titleFontSize * lineHeight,
    titleColor
  )
  y += layout.titleHeight

  // 表头（底色 + 居中文本）
  if (data.columns.length > 0) {
    ctx.fillStyle = headerBg
    ctx.fillRect(0, y, layout.canvasWidth, layout.headerHeight)
    ctx.font = `bold ${fontSize}px sans-serif`
    let x = 0
    data.columns.forEach((col, c) => {
      const innerW = Math.max(layout.columnWidths[c] - cellPaddingX * 2, 10)
      const lines = wrapText(col.header, innerW, measure)
      drawCenteredLines(
        ctx,
        lines,
        x + layout.columnWidths[c] / 2,
        y + layout.headerHeight / 2,
        fontSize * lineHeight,
        textColor
      )
      x += layout.columnWidths[c]
    })
    y += layout.headerHeight
  }

  // 数据行：有内容居中绘制，空内容画填空下划线
  ctx.font = `${fontSize}px sans-serif`
  const rowCount = data.columns.length > 0 ? data.columns[0].values.length : 0
  for (let r = 0; r < rowCount; r++) {
    const rowH = layout.rowHeights[r] ?? 0
    const centerY = y + rowH / 2
    let x = 0
    data.columns.forEach((col, c) => {
      const colW = layout.columnWidths[c] ?? 0
      const cx = x + colW / 2
      const text = col.values[r] ?? ''
      if (text) {
        const innerW = Math.max(colW - cellPaddingX * 2, 10)
        const lines = wrapText(text, innerW, measure)
        drawCenteredLines(ctx, lines, cx, centerY, fontSize * lineHeight, textColor)
      } else {
        // 填空空位：画一条居中的下划线
        const blankW = Math.min(colW - cellPaddingX * 2, 80)
        ctx.strokeStyle = blankColor
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.moveTo(cx - blankW / 2, centerY + 8)
        ctx.lineTo(cx + blankW / 2, centerY + 8)
        ctx.stroke()
      }
      x += colW
    })
    y += rowH
  }

  // 网格线（外框 + 列分隔线 + 行分隔线）
  ctx.strokeStyle = gridColor
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(0.5, 0.5)
  ctx.lineTo(layout.canvasWidth - 0.5, 0.5)
  ctx.lineTo(layout.canvasWidth - 0.5, layout.canvasHeight - 0.5)
  ctx.lineTo(0.5, layout.canvasHeight - 0.5)
  ctx.closePath()
  ctx.stroke()

  let vx = 0
  for (let c = 0; c < layout.columnWidths.length - 1; c++) {
    vx += layout.columnWidths[c]
    ctx.beginPath()
    ctx.moveTo(vx + 0.5, 0)
    ctx.lineTo(vx + 0.5, layout.canvasHeight)
    ctx.stroke()
  }

  let hy = layout.titleHeight
  if (data.columns.length > 0) {
    ctx.beginPath()
    ctx.moveTo(0, hy + 0.5)
    ctx.lineTo(layout.canvasWidth, hy + 0.5)
    ctx.stroke()
    hy += layout.headerHeight
  }
  for (let r = 0; r < layout.rowHeights.length; r++) {
    hy += layout.rowHeights[r]
    if (r < layout.rowHeights.length - 1) {
      ctx.beginPath()
      ctx.moveTo(0, hy + 0.5)
      ctx.lineTo(layout.canvasWidth, hy + 0.5)
      ctx.stroke()
    }
  }
}
