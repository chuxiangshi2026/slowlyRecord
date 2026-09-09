/**
 * 元素周期表完整网格布局的纯函数：由序数推导 18 列标准周期表坐标。
 *
 * 与组件解耦，便于单测。与桌面端 src/views/KnowledgeMemory/preview-layout.ts 的
 * buildPeriodicTable 同一套坐标规则（数据同源：public/knowledgebanks/elements.json）。
 */
import type { KnowledgeItem } from '@/stores/useUtils/types'

/** 周期表列数（标准 18 列） */
export const PERIODIC_COLUMNS = 18

/** 镧系（57-71）/锕系（89-103）序数范围（f 区，折入独立行展示） */
const LANTHANIDE_RANGE: [number, number] = [57, 71]
const ACTINIDE_RANGE: [number, number] = [89, 103]

/** 镧系折行在返回网格中的行下标（7 个主周期行之后），锕系行为其下一行 */
export const F_BLOCK_ROW_START = 7

/** 网格总行数：7 个主周期行 + 镧系/锕系 2 个折行 */
export const PERIODIC_ROWS = F_BLOCK_ROW_START + 2

/** 支持的最大原子序数 */
export const MAX_ATOMIC_NUMBER = 118

/** 周期表中的一个格子 */
export interface PeriodicCell {
  /** 原子序数 */
  atomicNumber: number
  /** 元素符号 */
  symbol: string
  /** 中文名 */
  name: string
  /** 来源条目 id */
  itemId: string
  /** 类别（extras「类别」，无则空串） */
  kind: string
}

/**
 * 按 extras.序数 把元素排进 18 列周期表。
 * 返回 9 行：7 个主周期行 + 镧系/锕系 2 个折行（从第 3 列起排 15 格，
 * 对应主行第 6/7 周期第 3 列留空作 f 区占位）。
 * 第 1 周期特殊：H 在第 1 列、He 在第 18 列。
 * 有条目缺少正整数序数、或序数超过 MAX_ATOMIC_NUMBER 时返回 null（调用方回退）。
 */
export function buildPeriodicGrid(items: KnowledgeItem[]): (PeriodicCell | null)[][] | null {
  if (items.length === 0) return null

  const parsed: { item: KnowledgeItem; n: number }[] = []
  for (const item of items) {
    const n = Number.parseInt(String(item.extras?.['序数'] ?? ''), 10)
    if (!Number.isInteger(n) || n <= 0) return null
    parsed.push({ item, n })
  }
  parsed.sort((a, b) => a.n - b.n)

  const rows: (PeriodicCell | null)[][] = []
  for (let i = 0; i < PERIODIC_ROWS; i++) {
    rows.push(new Array<PeriodicCell | null>(PERIODIC_COLUMNS).fill(null))
  }

  const put = (row: number, col: number, item: KnowledgeItem, n: number) => {
    rows[row][col] = {
      atomicNumber: n,
      symbol: item.question,
      name: item.answer,
      itemId: item.id,
      kind: item.extras?.['类别'] ?? '',
    }
  }

  for (const { item, n } of parsed) {
    if (n > MAX_ATOMIC_NUMBER) return null
    if (n === 1) {
      put(0, 0, item, n) // H
      continue
    }
    if (n === 2) {
      put(0, PERIODIC_COLUMNS - 1, item, n) // He
      continue
    }
    if (n >= LANTHANIDE_RANGE[0] && n <= LANTHANIDE_RANGE[1]) {
      // 镧系折行：La 从第 3 列起连排 15 格
      put(F_BLOCK_ROW_START, n - LANTHANIDE_RANGE[0] + 2, item, n)
      continue
    }
    if (n >= ACTINIDE_RANGE[0] && n <= ACTINIDE_RANGE[1]) {
      // 锕系折行：Ac 从第 3 列起连排 15 格
      put(F_BLOCK_ROW_START + 1, n - ACTINIDE_RANGE[0] + 2, item, n)
      continue
    }
    // 主行：第 4/5 周期 18 列连排；第 2/3 周期中间留 10 列过渡金属空位
    //（B 族从第 13 列起）；第 6/7 周期跳过第 3 列（f 区占位）
    let row: number
    let col: number
    if (n <= 10) { row = 1; col = n <= 4 ? n - 3 : n - 3 + 10 }
    else if (n <= 18) { row = 2; col = n <= 12 ? n - 11 : n - 11 + 10 }
    else if (n <= 36) { row = 3; col = n - 19 }
    else if (n <= 54) { row = 4; col = n - 37 }
    else if (n <= 56) { row = 5; col = n - 55 }
    else if (n <= 86) { row = 5; col = n - 69 }  // 72→3 … 86→17
    else if (n <= 88) { row = 6; col = n - 87 }
    else { row = 6; col = n - 101 }              // 104→3 … 118→17
    if (col < 0 || col >= PERIODIC_COLUMNS) return null
    put(row, col, item, n)
  }
  return rows
}
