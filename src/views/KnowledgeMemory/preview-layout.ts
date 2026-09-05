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

/** 镧系（57-71）/锕系（89-103）序数范围（f 区，折入独立行展示） */
const LANTHANIDE_RANGE: [number, number] = [57, 71];
const ACTINIDE_RANGE: [number, number] = [89, 103];

/** 镧系折行在返回网格中的行下标（7 个主周期行之后），锕系行为其下一行 */
export const F_BLOCK_ROW_START = 7;

/** 支持的最大原子序数 */
export const MAX_ATOMIC_NUMBER = 118;

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
 * 按 extras.序数 把元素排进 18 列周期表。
 * 返回 9 行：7 个主周期行 + 镧系/锕系 2 个折行（从第 3 列起排 15 格，
 * 对应主行第 6/7 周期第 3 列留空作 f 区占位）。
 * 第 1 周期特殊：H 在第 1 列、He 在第 18 列。
 * 有条目缺少正整数序数、或序数超过 MAX_ATOMIC_NUMBER 时返回 null（调用方回退通用表格）。
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
    for (let i = 0; i < F_BLOCK_ROW_START + 2; i++) {
        rows.push(new Array<PeriodicCell | null>(PERIODIC_COLUMNS).fill(null));
    }

    const put = (row: number, col: number, item: KnowledgeItem, n: number) => {
        rows[row][col] = {atomicNumber: n, symbol: item.question, name: item.answer, itemId: item.id};
    };

    for (const {item, n} of parsed) {
        if (n > MAX_ATOMIC_NUMBER) return null;
        if (n === 1) {
            put(0, 0, item, n); // H
            continue;
        }
        if (n === 2) {
            put(0, PERIODIC_COLUMNS - 1, item, n); // He
            continue;
        }
        if (n >= LANTHANIDE_RANGE[0] && n <= LANTHANIDE_RANGE[1]) {
            // 镧系折行：La 从第 3 列起连排 15 格
            put(F_BLOCK_ROW_START, n - LANTHANIDE_RANGE[0] + 2, item, n);
            continue;
        }
        if (n >= ACTINIDE_RANGE[0] && n <= ACTINIDE_RANGE[1]) {
            // 锕系折行：Ac 从第 3 列起连排 15 格
            put(F_BLOCK_ROW_START + 1, n - ACTINIDE_RANGE[0] + 2, item, n);
            continue;
        }
        // 主行：第 2-5 周期按周期内序连排；第 6/7 周期跳过第 3 列（f 区占位）
        let row: number;
        let col: number;
        if (n <= 10) { row = 1; col = n - 3; }
        else if (n <= 18) { row = 2; col = n - 11; }
        else if (n <= 36) { row = 3; col = n - 19; }
        else if (n <= 54) { row = 4; col = n - 37; }
        else if (n <= 56) { row = 5; col = n - 55; }
        else if (n <= 86) { row = 5; col = n - 69; }  // 72→3 … 86→17
        else if (n <= 88) { row = 6; col = n - 87; }
        else { row = 6; col = n - 101; }              // 104→3 … 118→17
        if (col < 0 || col >= PERIODIC_COLUMNS) return null;
        put(row, col, item, n);
    }
    return rows;
}
