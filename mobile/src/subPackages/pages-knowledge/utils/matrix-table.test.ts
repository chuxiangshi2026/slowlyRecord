import { describe, it, expect } from 'vitest'
import { detectMultiplicationMatrix } from './matrix-table'
import type { KnowledgeItem } from '@/stores/useUtils/types'

function item(question: string, answer = ''): KnowledgeItem {
  return { id: `k-${question}`, question, answer } as KnowledgeItem
}

describe('detectMultiplicationMatrix', () => {
  it('9×9 全集：81 格全填，行/列 1-9', () => {
    const items: KnowledgeItem[] = []
    for (let r = 1; r <= 9; r++) {
      for (let c = 1; c <= 9; c++) items.push(item(`${r}×${c}`, String(r * c)))
    }
    const m = detectMultiplicationMatrix(items)
    expect(m).not.toBeNull()
    expect(m!.rows).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9])
    expect(m!.cols).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9])
    expect(m!.cells.get('3×7')?.answer).toBe('21')
    expect(m!.cellSize).toBe(56)
  })

  it('大九九（10-19）：10×10 维矩阵，格子取上限', () => {
    const items: KnowledgeItem[] = []
    for (let r = 10; r <= 19; r++) {
      for (let c = 10; c <= 19; c++) items.push(item(`${r}×${c}`, String(r * c)))
    }
    const m = detectMultiplicationMatrix(items)
    expect(m).not.toBeNull()
    expect(m!.rows[0]).toBe(10)
    expect(m!.rows.length).toBe(10)
    expect(m!.cellSize).toBe(56)
  })

  it('缺组合的格子留空但矩阵仍成立', () => {
    const m = detectMultiplicationMatrix([item('1×1', '1'), item('2×2', '4')])
    expect(m).not.toBeNull()
    expect(m!.cells.get('1×2')).toBeUndefined()
  })

  it('任一 question 不匹配则整体退回 null', () => {
    expect(detectMultiplicationMatrix([item('1×1'), item('H')])).toBeNull()
  })

  it('空数组 / 一维矩阵返回 null', () => {
    expect(detectMultiplicationMatrix([])).toBeNull()
    expect(detectMultiplicationMatrix([item('1×1'), item('1×2')])).toBeNull()
  })

  it('兼容 x / * 与空白写法', () => {
    const m = detectMultiplicationMatrix([
      item('2 x 3', '6'),
      item('2*4', '8'),
      item('3 × 5', '15'),
    ])
    expect(m).not.toBeNull()
    expect(m!.cells.get('2×3')?.answer).toBe('6')
    expect(m!.cells.get('3×5')?.answer).toBe('15')
  })
})
