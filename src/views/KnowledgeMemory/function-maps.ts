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
    /** 「有趣值」注解：顶点、对称轴、周期、渐近线等，逐条展示在图像下方 */
    notes?: string[];
}

/** 公式 id → 函数实现 */
export const MATH_FORMULA_PLOTS: Record<string, PlotFunction> = {
    // 一次函数 y=2x+1（对应条目 一次函数）
    'math-formulas-21': {
        fn: (x) => 2 * x + 1,
        notes: [
            '斜率 k=2：x 每增加 1，y 增加 2，直线越陡 |k| 越大',
            'y 轴截距 b=1：直线必过点 (0, 1)，零点 x=-0.5',
        ],
    },
    // 二次函数 y=x²-2x-3（零点 x=-1、x=3，顶点 (1,-4)）
    'math-formulas-22': {
        fn: (x) => x * x - 2 * x - 3,
        notes: [
            '顶点 (1, -4) 即最小值点，对称轴 x=1（x=-b/2a）',
            '零点 x=-1 与 x=3：恰为方程 x²-2x-3=0 的两根',
            'a=1>0 开口向上；a 的符号决定开口方向，|a| 决定开口大小',
        ],
    },
    // 反比例函数 y=1/x（x=0 处有渐近线）
    'math-formulas-23': {
        fn: (x) => 1 / x,
        notes: [
            'x=0 与 y=0 是两条渐近线：曲线无限靠近但永不相交',
            '图像关于原点中心对称：f(-x)=-f(x)，无零点、无极值',
            'x·y 恒等于 k=1：曲线上每点与坐标轴围成的矩形面积不变',
        ],
    },
    // 正弦函数 y=sin x（周期 2π）
    'math-formulas-24': {
        fn: Math.sin,
        initialRange: {xMin: -2 * Math.PI, xMax: 2 * Math.PI, yMin: -1.5, yMax: 1.5},
        notes: [
            '周期 2π≈6.28：波形每 2π 完整重复一次',
            '最大值 1（x=π/2）、最小值 -1（x=-π/2），零点 x=kπ',
            '单位圆上点的纵坐标：角度 x 与 y=sin x 一一对应',
        ],
    },
};

/**
 * 根据知识包条目 id 查找可绘制函数。
 * @returns 可绘制函数描述；条目不可绘制时返回 null（调用方不显示按钮）
 */
export function getMathFormulaPlot(itemId: string): PlotFunction | null {
    return MATH_FORMULA_PLOTS[itemId] ?? null;
}
