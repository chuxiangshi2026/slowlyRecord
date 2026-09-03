/**
 * math-formulas 知识包：公式条目 → 可绘制函数的映射表。
 * 仅覆盖知识包中实际出现的函数类型，覆盖不了的条目不显示「函数图像」按钮。
 */
import type {ViewRange} from '@/utils/function-plot-util';

/** 一个可绘制函数的描述 */
export interface PlotFunction {
    /** 函数实现 y = f(x) */
    fn: (x: number) => number;
    /** 初始可视范围（不传则按 f 自动计算） */
    initialRange?: ViewRange;
}

/** 公式 id → 函数实现 */
export const MATH_FORMULA_PLOTS: Record<string, PlotFunction> = {
    // 一次函数 y=2x+1（对应条目 一次函数）
    'math-formulas-21': {fn: (x) => 2 * x + 1},
    // 二次函数 y=x²-2x-3（零点 x=-1、x=3，顶点 (1,-4)）
    'math-formulas-22': {fn: (x) => x * x - 2 * x - 3},
    // 反比例函数 y=1/x（x=0 处有渐近线）
    'math-formulas-23': {fn: (x) => 1 / x},
    // 正弦函数 y=sin x（周期 2π）
    'math-formulas-24': {fn: Math.sin},
};

/**
 * 根据知识包条目 id 查找可绘制函数。
 * @returns 可绘制函数描述；条目不可绘制时返回 null（调用方不显示按钮）
 */
export function getMathFormulaPlot(itemId: string): PlotFunction | null {
    return MATH_FORMULA_PLOTS[itemId] ?? null;
}
