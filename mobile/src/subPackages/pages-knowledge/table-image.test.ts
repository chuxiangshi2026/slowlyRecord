/**
 * table-image 纯逻辑测试：换行、布局计算、表格数据组装、绘制调用
 */
import { describe, it, expect } from 'vitest'
import {
  wrapText,
  computeTableLayout,
  buildTableImageData,
  createMeasure,
  drawTableImage,
  type TableImageData,
  type TableImageCtx,
  type MeasureTextFn,
} from './table-image'
import type { KnowledgePack } from '@/stores/useUtils/types'

/** 固定测量：每字符 10px，便于手算断言 */
const measure10: MeasureTextFn = text => text.length * 10

const DATA: TableImageData = {
  title: '小九九乘法表',
  columns: [
    { header: '题目', values: ['1×1', '1×2'] },
    { header: '答案', values: ['1', '2'] },
  ],
}

describe('wrapText', () => {
  it('空字符串返回一个空行（填空位）', () => {
    expect(wrapText('', 100, measure10)).toEqual([''])
  })

  it('宽度足够时不换行', () => {
    expect(wrapText('hello world', 200, measure10)).toEqual(['hello world'])
  })

  it('优先在空格处断行', () => {
    // 'hello'(50) + ' ' + 'world'(50) = 110 > 100 → 断成两行
    expect(wrapText('hello world', 100, measure10)).toEqual(['hello', 'world'])
  })

  it('单个超长词按字符硬切', () => {
    // 'abcdefg' 宽 70 > 50 → 按字符切到宽度内
    expect(wrapText('abcdefg', 50, measure10)).toEqual(['abcde', 'fg'])
  })
})

describe('computeTableLayout', () => {
  it('列宽 = 内容最大宽度 + 水平内边距', () => {
    const layout = computeTableLayout(DATA, measure10)
    // 题目列 max(2, 3)*10 + 32 = 62；答案列 32 + 32 = 64... 表头「题目」20、「答案」20
    expect(layout.columnWidths[0]).toBe(3 * 10 + 32)
    expect(layout.columnWidths[1]).toBe(2 * 10 + 32)
    expect(layout.canvasWidth).toBe(62 + 52)
  })

  it('总宽超出 maxWidth 时整体等比缩放', () => {
    const layout = computeTableLayout(DATA, measure10, { maxWidth: 57 })
    expect(layout.canvasWidth).toBe(57)
    expect(layout.columnWidths[0]).toBeCloseTo(62 * (57 / 114), 5)
  })

  it('画布高度 = 标题区 + 表头 + 各数据行 + 底部留白', () => {
    const layout = computeTableLayout(DATA, measure10)
    // 标题 1 行：24*1.6 + 20；表头：16*1.6 + 20；两行数据同高；底部 20
    const rowH = 16 * 1.6 + 20
    expect(layout.titleHeight).toBeCloseTo(24 * 1.6 + 20)
    expect(layout.headerHeight).toBeCloseTo(rowH)
    expect(layout.rowHeights).toEqual([rowH, rowH])
    expect(layout.canvasHeight).toBe(Math.round(layout.titleHeight + layout.headerHeight + rowH * 2 + 20))
  })

  it('空表格（无列）高度只有标题区 + 留白', () => {
    const layout = computeTableLayout({ title: '空', columns: [] }, measure10)
    expect(layout.headerHeight).toBe(0)
    expect(layout.rowHeights).toEqual([])
  })
})

function makePack(): KnowledgePack {
  return {
    id: 'p1',
    name: '测试包',
    description: '',
    ordered: true,
    usableAsPeg: false,
    items: [
      { id: '2', question: '二', answer: '2', order: 2 },
      { id: '1', question: '一', answer: '1', order: 1 },
    ],
  }
}

describe('buildTableImageData', () => {
  it('完整表：题目/答案两列，有序包按 order 排序', () => {
    const data = buildTableImageData(makePack(), 'full')
    expect(data.title).toBe('测试包')
    expect(data.columns[0].header).toBe('题目')
    expect(data.columns[0].values).toEqual(['一', '二'])
    expect(data.columns[1].values).toEqual(['1', '2'])
  })

  it('填空表：答案列全部留空（供绘制下划线）', () => {
    const data = buildTableImageData(makePack(), 'blank')
    expect(data.columns[1].values).toEqual(['', ''])
  })
})

/** 记录调用的 mock context */
function createMockCtx() {
  const calls: { method: string; args: unknown[] }[] = []
  const texts: string[] = []
  const ctx: TableImageCtx = {
    fillStyle: '',
    strokeStyle: '',
    font: '',
    textAlign: 'left',
    textBaseline: 'alphabetic',
    lineWidth: 1,
    scale(...args) { calls.push({ method: 'scale', args }) },
    beginPath() { calls.push({ method: 'beginPath', args: [] }) },
    closePath() { calls.push({ method: 'closePath', args: [] }) },
    moveTo(...args) { calls.push({ method: 'moveTo', args }) },
    lineTo(...args) { calls.push({ method: 'lineTo', args }) },
    stroke() { calls.push({ method: 'stroke', args: [] }) },
    fillRect(...args) { calls.push({ method: 'fillRect', args }) },
    fillText(text, ...rest) { texts.push(text); calls.push({ method: 'fillText', args: [text, ...rest] }) },
    measureText(text) { calls.push({ method: 'measureText', args: [text] }); return { width: text.length * 10 } },
  }
  return { ctx, calls, texts }
}

describe('drawTableImage 绘制调用', () => {
  const data = buildTableImageData(makePack(), 'full')
  const layout = computeTableLayout(data, measure10)

  it('写出标题、表头与全部单元格内容', () => {
    const { ctx, texts } = createMockCtx()
    drawTableImage(ctx, data, layout, measure10)
    expect(texts).toContain('测试包')
    expect(texts).toContain('题目')
    expect(texts).toContain('答案')
    expect(texts).toContain('一')
    expect(texts).toContain('二')
    expect(texts).toContain('1')
    expect(texts).toContain('2')
  })

  it('表头有底色填充，背景为白色底', () => {
    const { ctx, calls } = createMockCtx()
    drawTableImage(ctx, data, layout, measure10)
    const fills = calls.filter(c => c.method === 'fillRect')
    expect(fills.length).toBeGreaterThanOrEqual(2) // 背景 + 表头
    const headerFill = fills.find(c => c.args[3] === layout.headerHeight)
    expect(headerFill).toBeTruthy()
  })

  it('完整表只画网格线，填空表额外为每个空位画一条下划线', () => {
    const full = createMockCtx()
    drawTableImage(full.ctx, data, layout, measure10)
    // 纯网格线：外框 1 + 列分隔 1 + 表头分隔 1 + 行间分隔 1 = 4
    expect(full.calls.filter(c => c.method === 'stroke')).toHaveLength(4)

    const blankData = buildTableImageData(makePack(), 'blank')
    const blankLayout = computeTableLayout(blankData, measure10)
    const blank = createMockCtx()
    drawTableImage(blank.ctx, blankData, blankLayout, measure10)
    // 外框 1 + 列分隔 1 + 表头分隔 1 + 行间分隔 1 = 4 条网格线 stroke；再加 2 条答案下划线
    expect(blank.calls.filter(c => c.method === 'stroke')).toHaveLength(6)
  })

  it('网格线数量：外框 + 列分隔 + 表头分隔 + 行间分隔', () => {
    const { ctx, calls } = createMockCtx()
    drawTableImage(ctx, data, layout, measure10)
    // 2 列 → 1 条列分隔；1 条表头下分隔；2 行数据 → 1 条行间分隔；+ 外框 1
    expect(calls.filter(c => c.method === 'stroke')).toHaveLength(4)
  })

  it('createMeasure 统一按正文字号测量', () => {
    const { ctx, calls } = createMockCtx()
    const measure = createMeasure(ctx, 16)
    expect(measure('abc')).toBe(30)
    expect(calls.filter(c => c.method === 'measureText')).toHaveLength(1)
    expect(ctx.font).toBe('16px sans-serif')
  })
})
