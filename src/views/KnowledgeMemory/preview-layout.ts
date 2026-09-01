/**
 * 知识包预览布局的纯函数：乘法表方阵坐标解析、元素周期表排布。
 * 与组件解耦，便于单元测试。
 */
import type {KnowledgeItem} from '@/types/knowledge-memory';

/** 乘法方阵中的一个格子 */
export interface MultCell {
    /** 行乘数（首列表头） */
    a: number;
    /** 列乘数（首行表头） */
    b: number;
    /** 积 */
    answer: string;
    /** 来源条目 id */
    itemId: string;
}

/** 乘法方阵：start~end 的连续乘数范围 + 行列格子 */
export interface MultiplicationGrid {
    /** 最小乘数 */
    start: number;
    /** 最大乘数 */
    end: number;
    /** cells[a-start][b-start]，缺失为 null */
    cells: (MultCell | null)[][];
}

/**
 * 解析「a×b」形式的问题（兼容 x、X、* 写法）。
 * @returns 两个乘数；无法解析时返回 null
 */
export function parseFactors(question: string): {a: number; b: number} | null {
    const m = /^\s*(\d+)\s*[×xX*]\s*(\d+)\s*$/.exec(question);
    if (!m) return null;
    return {a: Number(m[1]), b: Number(m[2])};
}

/**
 * 由条目构建乘法方阵。
 * 仅当所有条目都可解析为「a×b」且 [start..end]×[start..end] 被完整填满时返回方阵，
 * 否则返回 null（调用方回退为通用表格）。
 */
export function buildMultiplicationGrid(items: KnowledgeItem[]): MultiplicationGrid | null {
    if (items.length === 0) return null;

    const map = new Map<string, MultCell>();
    let min = Infinity;
    let max = -Infinity;
    for (const item of items) {
        const f = parseFactors(item.question);
        if (!f) return null;
        min = Math.min(min, f.a, f.b);
        max = Math.max(max, f.a, f.b);
        map.set(`${f.a}-${f.b}`, {a: f.a, b: f.b, answer: item.answer, itemId: item.id});
    }

    const size = max - min + 1;
    // 要求完整填满，避免把零散的乘法题误判成方阵
    if (size <= 0 || map.size !== size * size) return null;

    const cells: (MultCell | null)[][] = [];
    for (let a = min; a <= max; a++) {
        const row: (MultCell | null)[] = [];
        for (let b = min; b <= max; b++) {
            row.push(map.get(`${a}-${b}`) ?? null);
        }
        cells.push(row);
    }
    return {start: min, end: max, cells};
}

/** 周期表列数（标准 18 列） */
export const PERIODIC_COLUMNS = 18;

/** 每周期容纳的元素数（前 5 周期足够覆盖前 36 号元素） */
const PERIOD_LENGTHS = [2, 8, 8, 18, 18];

/** 周期表中的一个格子 */
export interface PeriodicCell {
    /** 原子序数 */
    atomicNumber: number;
    /** 元素符号 */
    symbol: string;
    /** 中文名 */
    name: string;
    /** 来源条目 id */
    itemId: string;
}

/**
 * 按 extras.序数 把元素排进 18 列周期表（行 = 周期，列按周期内顺序连续排列；
 * 第 1 周期特殊：H 在第 1 列、He 在第 18 列）。
 * 有条目缺少正整数序数、或超出已知周期范围时返回 null（调用方回退通用表格）。
 */
export function buildPeriodicTable(items: KnowledgeItem[]): (PeriodicCell | null)[][] | null {
    if (items.length === 0) return null;

    const parsed: {item: KnowledgeItem; n: number}[] = [];
    for (const item of items) {
        const n = Number(item.extras?.['序数']);
        if (!Number.isInteger(n) || n <= 0) return null;
        parsed.push({item, n});
    }
    parsed.sort((x, y) => x.n - y.n);

    const rows: (PeriodicCell | null)[][] = [];
    let period = 0;
    let col = 0;
    for (const {item, n} of parsed) {
        // 当前周期放满则进入下一周期
        while (period < PERIOD_LENGTHS.length && col >= PERIOD_LENGTHS[period]) {
            period++;
            col = 0;
        }
        if (period >= PERIOD_LENGTHS.length) return null;
        while (rows.length <= period) {
            rows.push(new Array<PeriodicCell | null>(PERIODIC_COLUMNS).fill(null));
        }
        // 第 1 周期的第 2 个元素（He）放最后一列
        const targetCol = period === 0 && col === 1 ? PERIODIC_COLUMNS - 1 : col;
        rows[period][targetCol] = {
            atomicNumber: n,
            symbol: item.question,
            name: item.answer,
            itemId: item.id,
        };
        col++;
    }
    return rows;
}
