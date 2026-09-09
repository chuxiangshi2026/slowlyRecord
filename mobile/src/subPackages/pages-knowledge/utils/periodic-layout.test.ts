import { describe, it, expect } from 'vitest'
import {
  buildPeriodicGrid,
  F_BLOCK_ROW_START,
  MAX_ATOMIC_NUMBER,
  PERIODIC_COLUMNS,
  PERIODIC_ROWS,
  type PeriodicCell,
} from './periodic-layout'
import elementsPack from '../knowledgebanks/elements'
import type { KnowledgeItem } from '@/stores/useUtils/types'

/** 造一个最小元素条目 */
function el(n: number, symbol = `E${n}`): KnowledgeItem {
  return {
    id: `el-${n}`,
    question: symbol,
    answer: `元${n}`,
    extras: { 序数: String(n), 类别: '其他' },
  }
}

/** 从网格中按序数找格子及其坐标 */
function findCell(rows: (PeriodicCell | null)[][], n: number): { row: number; col: number; cell: PeriodicCell } {
  for (let r = 0; r < rows.length; r++) {
    for (let c = 0; c < rows[r].length; c++) {
      const cell = rows[r][c]
      if (cell?.atomicNumber === n) return { row: r, col: c, cell }
    }
  }
  throw new Error(`序数 ${n} 不在网格中`)
}

describe('buildPeriodicGrid', () => {
  it('空数组返回 null', () => {
    expect(buildPeriodicGrid([])).toBeNull()
  })

  it('缺序数 / 非法序数返回 null', () => {
    expect(buildPeriodicGrid([{ id: 'a', question: 'A', answer: '甲' }])).toBeNull()
    expect(buildPeriodicGrid([el(MAX_ATOMIC_NUMBER + 1)])).toBeNull()
  })

  it('返回 9 行 × 18 列', () => {
    const rows = buildPeriodicGrid(elementsPack.items)!
    expect(rows.length).toBe(PERIODIC_ROWS)
    expect(rows.every(r => r.length === PERIODIC_COLUMNS)).toBe(true)
  })

  it('第 1 周期：H 在第 1 列、He 在第 18 列', () => {
    const rows = buildPeriodicGrid(elementsPack.items)!
    expect(findCell(rows, 1).col).toBe(0)
    expect(findCell(rows, 2).col).toBe(PERIODIC_COLUMNS - 1)
  })

  it('前 54 号主行坐标：Li→(1,0)、Ne→(1,17)、Na→(2,0)、Ar→(2,17)、K→(3,0)、Kr→(3,17)', () => {
    const rows = buildPeriodicGrid([el(3), el(10), el(11), el(18), el(19), el(36)])!
    expect(findCell(rows, 3)).toMatchObject({ row: 1, col: 0 })
    expect(findCell(rows, 10)).toMatchObject({ row: 1, col: 17 })
    expect(findCell(rows, 11)).toMatchObject({ row: 2, col: 0 })
    expect(findCell(rows, 18)).toMatchObject({ row: 2, col: 17 })
    expect(findCell(rows, 19)).toMatchObject({ row: 3, col: 0 })
    expect(findCell(rows, 36)).toMatchObject({ row: 3, col: 17 })
  })

  it('第 2/3 周期中间留空：第 2 周期第 2~11 列为 null', () => {
    const rows = buildPeriodicGrid([el(5)])!
    expect(rows[1][2]).toBeNull()
    expect(rows[1][11]).toBeNull()
    expect(findCell(rows, 5)).toMatchObject({ row: 1, col: 12 })
  })

  it('镧系（57-71）折到第 8 行第 3 列起；锕系（89-103）折到第 9 行', () => {
    const rows = buildPeriodicGrid([el(57), el(71), el(89), el(103)])!
    expect(findCell(rows, 57)).toMatchObject({ row: F_BLOCK_ROW_START, col: 2 })
    expect(findCell(rows, 71)).toMatchObject({ row: F_BLOCK_ROW_START, col: 16 })
    expect(findCell(rows, 89)).toMatchObject({ row: F_BLOCK_ROW_START + 1, col: 2 })
    expect(findCell(rows, 103)).toMatchObject({ row: F_BLOCK_ROW_START + 1, col: 16 })
  })

  it('第 6 周期主行跳过第 3 列：Cs→(5,0)、Ba→(5,1)、Hf→(5,3)', () => {
    const rows = buildPeriodicGrid([el(55), el(56), el(72)])!
    expect(findCell(rows, 55)).toMatchObject({ row: 5, col: 0 })
    expect(findCell(rows, 56)).toMatchObject({ row: 5, col: 1 })
    expect(findCell(rows, 72)).toMatchObject({ row: 5, col: 3 })
  })

  it('完整内置元素包（1-118）无重叠无遗漏', () => {
    const rows = buildPeriodicGrid(elementsPack.items)!
    const seen: number[] = []
    for (const row of rows) {
      for (const cell of row) {
        if (cell) seen.push(cell.atomicNumber)
      }
    }
    expect(seen.length).toBe(118)
    expect([...seen].sort((a, b) => a - b)).toEqual(Array.from({ length: 118 }, (_, i) => i + 1))
  })
})
