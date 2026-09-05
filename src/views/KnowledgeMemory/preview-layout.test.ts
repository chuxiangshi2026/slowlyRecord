import {describe, it, expect} from 'vitest'
import {
  parseFactors,
  buildMultiplicationGrid,
  buildPeriodicTable,
  PERIODIC_COLUMNS,
} from './preview-layout'
import type {KnowledgeItem} from '@/types/knowledge-memory'

function makeItem(id: string, question: string, answer: string, extras?: Record<string, string>): KnowledgeItem {
  return {id, question, answer, extras}
}

/** 生成 start~end 的完整乘法表条目 */
function makeMultItems(start: number, end: number): KnowledgeItem[] {
  const items: KnowledgeItem[] = []
  for (let a = start; a <= end; a++) {
    for (let b = start; b <= end; b++) {
      items.push(makeItem(`m-${a}-${b}`, `${a}×${b}`, String(a * b)))
    }
  }
  return items
}

describe('parseFactors', () => {
  it('解析标准「a×b」', () => {
    expect(parseFactors('7×8')).toEqual({a: 7, b: 8})
  })

  it('兼容 x、X、* 与空白', () => {
    expect(parseFactors('3x4')).toEqual({a: 3, b: 4})
    expect(parseFactors('3X4')).toEqual({a: 3, b: 4})
    expect(parseFactors(' 3 * 4 ')).toEqual({a: 3, b: 4})
  })

  it('非乘法问题返回 null', () => {
    expect(parseFactors('H')).toBeNull()
    expect(parseFactors('一次函数')).toBeNull()
    expect(parseFactors('')).toBeNull()
    expect(parseFactors('1×2×3')).toBeNull()
  })
})

describe('buildMultiplicationGrid', () => {
  it('9×9 完整表生成 9 行 9 列方阵', () => {
    const grid = buildMultiplicationGrid(makeMultItems(1, 9))
    expect(grid).not.toBeNull()
    expect(grid!.start).toBe(1)
    expect(grid!.end).toBe(9)
    expect(grid!.cells).toHaveLength(9)
    expect(grid!.cells[0]).toHaveLength(9)
    // 7×8=56 位于 cells[6][7]
    expect(grid!.cells[6][7]).toMatchObject({a: 7, b: 8, answer: '56'})
    // 对角线 9×9=81
    expect(grid!.cells[8][8]).toMatchObject({answer: '81'})
  })

  it('19×19（10-19）生成 10 行 10 列方阵', () => {
    const grid = buildMultiplicationGrid(makeMultItems(10, 19))
    expect(grid).not.toBeNull()
    expect(grid!.start).toBe(10)
    expect(grid!.end).toBe(19)
    expect(grid!.cells).toHaveLength(10)
    expect(grid!.cells[0][0]).toMatchObject({a: 10, b: 10, answer: '100'})
    expect(grid!.cells[9][9]).toMatchObject({answer: '361'})
  })

  it('条目不全（方阵未填满）时返回 null', () => {
    const items = makeMultItems(1, 2).slice(0, 3) // 缺 2×2
    expect(buildMultiplicationGrid(items)).toBeNull()
  })

  it('单个乘法条目不误判为方阵', () => {
    expect(buildMultiplicationGrid([makeItem('i1', '2×3', '6')])).toBeNull()
  })

  it('含不可解析条目时返回 null', () => {
    const items = [...makeMultItems(1, 2), makeItem('x', 'Q', 'A')]
    expect(buildMultiplicationGrid(items)).toBeNull()
  })

  it('空数组返回 null', () => {
    expect(buildMultiplicationGrid([])).toBeNull()
  })
})

describe('buildPeriodicTable', () => {
  const element = (n: number, symbol: string, name: string) =>
    makeItem(`elements-${symbol}`, symbol, name, {'序数': String(n)})

  it('前 36 号元素排成 9 行（7 主周期 + 镧锕系 2 折行）18 列', () => {
    // 简化：符号用 E<n> 代替，序数 1-36 连续
    const items = Array.from({length: 36}, (_, i) => element(i + 1, `E${i + 1}`, `元素${i + 1}`))
    const rows = buildPeriodicTable(items)
    expect(rows).not.toBeNull()
    expect(rows!).toHaveLength(9)
    expect(rows![0]).toHaveLength(PERIODIC_COLUMNS)
  })

  it('H 在第 1 列、He 在第 18 列，第 1 周期其余为空', () => {
    const items = [element(1, 'H', '氢'), element(2, 'He', '氦')]
    const rows = buildPeriodicTable(items)!
    expect(rows[0][0]).toMatchObject({symbol: 'H', atomicNumber: 1})
    expect(rows[0][PERIODIC_COLUMNS - 1]).toMatchObject({symbol: 'He', atomicNumber: 2})
    expect(rows[0].slice(1, PERIODIC_COLUMNS - 1).every(c => c === null)).toBe(true)
  })

  it('第 2、3 周期各 8 格连续排列', () => {
    const items = Array.from({length: 36}, (_, i) => element(i + 1, `E${i + 1}`, `元素${i + 1}`))
    const rows = buildPeriodicTable(items)!
    // 第 2 周期：3-10 号放第 1-8 列
    expect(rows[1][0]).toMatchObject({atomicNumber: 3})
    expect(rows[1][7]).toMatchObject({atomicNumber: 10})
    expect(rows[1].slice(8).every(c => c === null)).toBe(true)
    // 第 3 周期：11-18 号
    expect(rows[2][0]).toMatchObject({atomicNumber: 11})
    expect(rows[2][7]).toMatchObject({atomicNumber: 18})
    // 第 4 周期：19-36 号占满 18 列
    expect(rows[3][0]).toMatchObject({atomicNumber: 19})
    expect(rows[3][17]).toMatchObject({atomicNumber: 36})
  })

  it('序数缺失或非法时返回 null', () => {
    expect(buildPeriodicTable([makeItem('i1', 'H', '氢')])).toBeNull()
    expect(buildPeriodicTable([element(0, 'X', 'x')])).toBeNull()
    expect(buildPeriodicTable([makeItem('i2', 'He', '氦', {'序数': 'abc'})])).toBeNull()
  })

  it('空数组返回 null', () => {
    expect(buildPeriodicTable([])).toBeNull()
  })

  it('第 6/7 周期主行跳过第 3 列，镧系/锕系折行从第 3 列起排 15 格', () => {
    const items = Array.from({length: 118}, (_, i) => element(i + 1, `E${i + 1}`, `元素${i + 1}`))
    const rows = buildPeriodicTable(items)!
    expect(rows).toHaveLength(9)
    // 第 6 周期主行：Cs/Ba 在第 1/2 列，第 3 列留空（f 区占位），Hf 起第 4 列，Rn 收尾第 18 列
    expect(rows[5][0]).toMatchObject({atomicNumber: 55})
    expect(rows[5][1]).toMatchObject({atomicNumber: 56})
    expect(rows[5][2]).toBeNull()
    expect(rows[5][3]).toMatchObject({atomicNumber: 72})
    expect(rows[5][17]).toMatchObject({atomicNumber: 86})
    // 第 7 周期主行同理
    expect(rows[6][0]).toMatchObject({atomicNumber: 87})
    expect(rows[6][2]).toBeNull()
    expect(rows[6][17]).toMatchObject({atomicNumber: 118})
    // 镧系折行：La-Lu 占第 3-17 列
    expect(rows[7][0]).toBeNull()
    expect(rows[7][2]).toMatchObject({atomicNumber: 57})
    expect(rows[7][16]).toMatchObject({atomicNumber: 71})
    expect(rows[7][17]).toBeNull()
    // 锕系折行：Ac-Lr
    expect(rows[8][2]).toMatchObject({atomicNumber: 89})
    expect(rows[8][16]).toMatchObject({atomicNumber: 103})
  })

  it('仅前 54 号（旧数据）时主行排布不变，折行为空行', () => {
    const items = Array.from({length: 54}, (_, i) => element(i + 1, `E${i + 1}`, `元素${i + 1}`))
    const rows = buildPeriodicTable(items)!
    expect(rows).toHaveLength(9)
    expect(rows[4][17]).toMatchObject({atomicNumber: 54})
    expect(rows[7].every(c => c === null)).toBe(true)
    expect(rows[8].every(c => c === null)).toBe(true)
  })

  it('序数超过 118 时回退 null', () => {
    expect(buildPeriodicTable([element(119, 'E119', '未来元素')])).toBeNull()
  })
})
