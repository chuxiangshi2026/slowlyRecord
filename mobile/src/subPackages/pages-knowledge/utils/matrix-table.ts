/**
 * 横屏表格页的乘法矩阵检测。
 *
 * 知识包条目的 question 全部形如 "a×b"（小九九 9×9、大九九 19×19 等）时，
 * 横屏表格页可把条目按矩阵铺开（行 = 第一个乘数，列 = 第二个乘数，格子 = 积），
 * 交互与详情页完整周期表一致（双指缩放 + 拖动）。
 */
import type { KnowledgeItem } from '@/stores/useUtils/types'

export const MATRIX_RE = /^(\d+)\s*[×xX*]\s*(\d+)$/

export interface MatrixData {
  rows: number[]
  cols: number[]
  /** `${r}×${c}` → 条目（缺组合时该格留空） */
  cells: Map<string, KnowledgeItem>
  /** 格子边长 px：矩阵越大格子越小 */
  cellSize: number
}

/** 检测条目集合是否构成乘法矩阵；任一 question 不匹配或维度不足时返回 null */
export function detectMultiplicationMatrix(items: KnowledgeItem[]): MatrixData | null {
  if (!items.length) return null
  const cells = new Map<string, KnowledgeItem>()
  const rowSet = new Set<number>()
  const colSet = new Set<number>()
  for (const it of items) {
    const m = String(it.question).match(MATRIX_RE)
    if (!m) return null
    const r = Number(m[1])
    const c = Number(m[2])
    rowSet.add(r)
    colSet.add(c)
    cells.set(`${r}×${c}`, it)
  }
  const rows = [...rowSet].sort((a, b) => a - b)
  const cols = [...colSet].sort((a, b) => a - b)
  // 单行/单列铺开没意义，退回列表视图
  if (rows.length < 2 || cols.length < 2) return null
  const n = Math.max(rows.length, cols.length)
  const cellSize = Math.max(26, Math.min(56, Math.floor(620 / n)))
  return { rows, cols, cells, cellSize }
}
