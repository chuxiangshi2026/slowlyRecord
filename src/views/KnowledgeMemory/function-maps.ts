/**
 * 数学类知识包（math-formulas / math-calculus）：公式条目 → 可绘制函数的映射表。
 * 仅覆盖知识包中实际出现的函数类型，覆盖不了的条目不显示「函数图像」按钮。
 */
import type {ViewRange} from '@/utils/function-plot-util';

/** 组合数 C(n, k)；k 非整数或越界时返回 0（离散分布绘图用） */
function binom(n: number, k: number): number {
    if (!Number.isInteger(k) || k < 0 || k > n) return 0;
    let r = 1;
    for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
    return r;
}

/** 一个可绘制函数的描述 */
export interface PlotFunction {
    /** 函数实现 y = f(x) */
    fn: (x: number) => number;
    /** 初始可视范围（不传则按 f 自动计算） */
    initialRange?: ViewRange;
    /** 「有趣值」注解：顶点、对称轴、周期、渐近线等，逐条展示在图像下方 */
    notes?: string[];
    /** 自变量标签（如 r、a），显示在输入框与分析面板中，默认 "x" */
    xLabel?: string;
    /** 几何联动图形：按动点取值同步画出对应图形（圆：半径 r；正方形：边长 a） */
    geometry?: 'circle' | 'square';
    /** 第二条曲线 y=g(x)（红色实线）：用于方程组联立，两曲线交点即方程组的解 */
    fn2?: (x: number) => number;
}

/** 公式 id → 函数实现 */
export const MATH_FORMULA_PLOTS: Record<string, PlotFunction> = {
    // 圆的面积 S=πr²（r≥0 的抛物线分支，右侧联动画出半径 r 的圆）
    'math-formulas-1': {
        fn: (r) => Math.PI * r * r,
        initialRange: {xMin: 0, xMax: 5, yMin: -5, yMax: 80},
        xLabel: 'r',
        geometry: 'circle',
        notes: [
            '面积是半径的二次函数：半径翻倍，面积变 4 倍',
            '圆方程 x²+y²=r² 整体不是函数（一个 x 对应两个 y），可拆成上、下两个半圆函数 y=±√(r²-x²)',
            '右侧几何图随 r 联动：圆内阴影的面积就是曲线上动点的纵坐标 S',
        ],
    },
    // 圆的周长 C=2πr（正比例函数，右侧联动画出半径 r 的圆）
    'math-formulas-2': {
        fn: (r) => 2 * Math.PI * r,
        initialRange: {xMin: 0, xMax: 5, yMin: -2, yMax: 32},
        xLabel: 'r',
        geometry: 'circle',
        notes: [
            '周长是半径的正比例函数：半径翻倍，周长也翻倍，图像过原点',
            '与圆面积的关系：S(r)=πr² 的变化率（导数）恰好就是 C(r)=2πr',
        ],
    },
    // 正方形面积 S=a²（y=x² 抛物线的右半支，右侧联动画出边长 a 的正方形）
    'math-formulas-4': {
        fn: (a) => a * a,
        initialRange: {xMin: 0, xMax: 5, yMin: -2, yMax: 26},
        xLabel: 'a',
        geometry: 'square',
        notes: [
            '与二次函数 y=x² 同一条抛物线，实际意义只取 a≥0 的右半支',
            '边长翻倍，面积变 4 倍（平方关系）',
        ],
    },
    // 正方体体积 V=a³（立方函数）
    'math-formulas-9': {
        fn: (a) => a * a * a,
        initialRange: {xMin: 0, xMax: 4, yMin: -4, yMax: 64},
        xLabel: 'a',
        notes: [
            '棱长翻倍，体积变 8 倍（立方关系），比面积增长快得多',
            'y=x³ 是奇函数：图像关于原点对称，把 x 轴拖向负值可看到完整 S 形',
        ],
    },
    // 勾股定理：固定斜边 c=5，一条直角边 b 随 a 变化 b=√(25-a²)，即四分之一圆
    'math-formulas-13': {
        fn: (a) => Math.sqrt(Math.max(0, 25 - a * a)),
        initialRange: {xMin: 0, xMax: 6, yMin: -1, yMax: 6},
        xLabel: 'a',
        notes: [
            '固定斜边 c=5：b=√(25-a²)，图像恰是半径为 5 的四分之一圆',
            '3-4-5 直角三角形：a=3 时 b=4，动点拖到 x=3 可验证',
            '这也说明圆 x²+y²=r² 拆成的半圆函数 y=√(r²-x²) 长什么样',
        ],
    },
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
    // 余弦函数 y=cos x（sin 向左平移 π/2）
    'math-formulas-25': {
        fn: Math.cos,
        initialRange: {xMin: -2 * Math.PI, xMax: 2 * Math.PI, yMin: -1.5, yMax: 1.5},
        notes: [
            '与 sin x 同形，只是向左平移 π/2：cos x = sin(x+π/2)',
            '偶函数：图像关于 y 轴对称，cos(-x)=cos x，x=0 处取最大值 1',
            '单位圆上点的横坐标：与 sin（纵坐标）合起来正好描出一个圆',
        ],
    },
    // 正切函数 y=tan x（渐近线 x=π/2+kπ）
    'math-formulas-26': {
        fn: Math.tan,
        initialRange: {xMin: -Math.PI, xMax: Math.PI, yMin: -5, yMax: 5},
        notes: [
            '周期只有 π：每个区间 (-π/2+kπ, π/2+kπ) 上都重复同一段',
            'x=±π/2 是渐近线：函数值趋向无穷，曲线自动断开',
            'tan x = sin x / cos x：cos x=0 处正是渐近线位置',
        ],
    },
    // 弧度制：角度 → 弧度换算 y=πx/180
    'math-formulas-27': {
        fn: (d) => (Math.PI / 180) * d,
        initialRange: {xMin: 0, xMax: 360, yMin: -0.5, yMax: 7},
        xLabel: '角度°',
        notes: [
            '换算是一条过原点的直线：180° 对应 π≈3.14 rad',
            '动点拖到 180 看 y≈3.1416，拖到 360 看 y≈6.2832（即 2π）',
            '用弧度后 sin、cos 的公式才最简洁，所以高等数学一律用弧度',
        ],
    },
    // 指数函数 y=2^x
    'math-formulas-28': {
        fn: (x) => Math.pow(2, x),
        initialRange: {xMin: -5, xMax: 5, yMin: -2, yMax: 32},
        notes: [
            '恒过点 (0, 1)：任何数的 0 次方都是 1',
            'x 轴是渐近线：x 越小越贴近 0 但永不为负',
            '爆炸式增长：x 每 +1 函数值翻倍，细胞分裂、复利都是它',
        ],
    },
    // 对数函数 y=ln x
    'math-formulas-29': {
        fn: Math.log,
        initialRange: {xMin: 0, xMax: 10, yMin: -4, yMax: 3},
        notes: [
            '定义域 x>0：y 轴（x=0）是渐近线，左侧没有图像',
            '恒过点 (1, 0)：ln 1=0；增长极慢，x=10 时 y 才约 2.3',
            '与指数函数互为反函数：y=ln x 与 y=e^x 关于直线 y=x 对称',
        ],
    },
    // 导数：以 y=x² 为例，动点处切线的斜率就是导数
    'math-formulas-30': {
        fn: (x) => x * x,
        initialRange: {xMin: -4, xMax: 4, yMin: -2, yMax: 16},
        notes: [
            '几何意义：动点处红色虚线切线的斜率就是 f\'(x)=2x',
            'x>0 时切线斜率为正（函数上升），x<0 时为负（下降）',
            'x=0 处切线水平（斜率 0），恰好是极小值点——极值处导数为 0',
        ],
    },
    // 定积分：以 y=x² 为例，阴影面积就是 ∫₀ˣ
    'math-formulas-31': {
        fn: (x) => x * x,
        initialRange: {xMin: -3, xMax: 3, yMin: -1, yMax: 9},
        notes: [
            '几何意义：图中阴影的有向面积就是 ∫₀ˣ t²dt = x³/3',
            '动点拖到 x=1：面积≈0.333 即 ⅓；拖到 x=2：≈2.667 即 8/3',
            '积分与导数互逆：面积函数 x³/3 的导数恰好回到 x²（微积分基本定理）',
        ],
    },
    // 一元二次方程求根公式：零点即两根（与二次函数条目同例 y=x²-2x-3）
    'math-formulas-16': {
        fn: (x) => x * x - 2 * x - 3,
        notes: [
            '方程 x²-2x-3=0 的解就是抛物线与 x 轴的交点：x=-1 与 x=3',
            '判别式 Δ=b²-4ac=16>0 → 两个交点；Δ=0 相切（一个交点），Δ<0 无交点',
            '求根公式 x=[-b±√Δ]/2a 算出的正是这两个交点的横坐标',
        ],
    },
    // 一元一次方程 3x-6=0：解 = 直线 y=3x-6 的零点
    'math-formulas-32': {
        fn: (x) => 3 * x - 6,
        notes: [
            '解方程 3x-6=0 等价于找直线 y=3x-6 与 x 轴的交点：x=2',
            '动点拖到 x=2：纵坐标恰为 0——「方程的解 = 函数零点」',
            'a 的符号决定直线走向：a>0 上升，a<0 下降',
        ],
    },
    // 二元一次方程组：y=2x+1 与 y=-x+4 联立，交点 (1,3) 即解
    'math-formulas-33': {
        fn: (x) => 2 * x + 1,
        fn2: (x) => -x + 4,
        initialRange: {xMin: -4, xMax: 6, yMin: -6, yMax: 8},
        notes: [
            '绿色线与红色线的交点 (1, 3) 就是方程组的解 x=1, y=3',
            '交点处两函数值相等：2x+1=-x+4，移项即 3x-3=0，化归为一元一次方程',
            '若两线平行（斜率相等）则无交点——方程组无解；重合则无穷多解',
        ],
    },
    // ===== math-calculus 微积分包 =====
    // 重要极限一：y=sin x / x，x→0 时趋于 1（x=0 处补上极限值便于观察）
    'math-calculus-2': {
        fn: (x) => (x === 0 ? 1 : Math.sin(x) / x),
        initialRange: {xMin: -20, xMax: 20, yMin: -0.5, yMax: 1.2},
        notes: [
            '动点拖近 x=0：两侧函数值都无限逼近 1，这就是 lim(x→0) sin x/x = 1',
            '图像是振荡衰减的「Sinc 函数」，零点在 x=kπ',
            '该极限成立的前提是 x 用弧度——这也是微积分一律用弧度的原因',
        ],
    },
    // 重要极限二：y=(1+1/x)^x 单调逼近红线 y=e
    'math-calculus-3': {
        fn: (x) => (x <= 0 ? NaN : Math.pow(1 + 1 / x, x)),
        fn2: () => Math.E,
        initialRange: {xMin: 0, xMax: 50, yMin: 0, yMax: 4},
        notes: [
            '绿线 (1+1/x)^x 单调上升，无限逼近但永不触碰红线 y=e≈2.718',
            'x=1 时值为 2，x=10 时约 2.59，x=100 时约 2.705——越涨越慢',
            '复利极限：年利率 100% 按无穷多次复利，本息和就是 e 倍',
        ],
    },
    // 导数的定义：以 y=x³ 为例，切线斜率即 f'(x)=3x²
    'math-calculus-4': {
        fn: (x) => x * x * x,
        initialRange: {xMin: -3, xMax: 3, yMin: -10, yMax: 10},
        notes: [
            '动点处红色切线的斜率就是 f\'(x)=3x²，拖动可验证：x=1 时斜率 3',
            'x=0 处切线水平但不是极值点——导数为 0 只是极值的必要条件',
            '定义中的 Δx→0 过程：切线就是割线两端点无限靠近的极限位置',
        ],
    },
    // 微分：y=x² 的切线近似 Δy≈dy=f'(x)dx
    'math-calculus-7': {
        fn: (x) => x * x,
        initialRange: {xMin: -4, xMax: 4, yMin: -2, yMax: 16},
        notes: [
            '微分 dy=f\'(x)dx 的几何意义：沿红色切线的增量，近似代替曲线真实增量 Δy',
            'x=2 处切线斜率 4：x 微增 0.1，y 约增 0.4（真实值 0.41）',
            '「以直代曲」是微积分近似的核心思想',
        ],
    },
    // 导数与单调性、极值：y=x³-3x 在 x=±1 取极值
    'math-calculus-9': {
        fn: (x) => x * x * x - 3 * x,
        initialRange: {xMin: -3, xMax: 3, yMin: -3, yMax: 3},
        notes: [
            'f\'(x)=3x²-3=0 解得 x=±1：x=-1 极大值 2，x=1 极小值 -2（图中橙点）',
            'x<-1 与 x>1 区间切线斜率为正（递增），-1<x<1 为负（递减）',
            '拖动动点看切线斜率正负变化，「递增/递减/极值」一目了然',
        ],
    },
    // 牛顿-莱布尼茨：y=x² 的阴影面积 ∫₀ˣ = x³/3
    'math-calculus-11': {
        fn: (x) => x * x,
        initialRange: {xMin: -3, xMax: 3, yMin: -1, yMax: 9},
        notes: [
            '阴影面积 ∫₀ˣ t²dt = F(x)-F(0)，其中原函数 F(x)=x³/3',
            'x=2 时面积 = 8/3 - 0 ≈ 2.667：定积分变成原函数「两头相减」',
            '这就是牛顿-莱布尼茨公式 ∫ₐᵇf(x)dx=F(b)-F(a) 的直观含义',
        ],
    },
    // 泰勒公式：绿线 e^x 与红色二次逼近 1+x+x²/2
    'math-calculus-13': {
        fn: Math.exp,
        fn2: (x) => 1 + x + (x * x) / 2,
        initialRange: {xMin: -4, xMax: 3, yMin: -2, yMax: 22},
        notes: [
            '红线是 eˣ 在 x=0 处的二次泰勒逼近 1+x+x²/2，在 0 附近与绿线几乎重合',
            'x 远离 0 后两线分离：项数不够了，加 x³/6 一项会贴合得更远',
            '泰勒思想：任何光滑函数都能在一点附近用多项式逼近',
        ],
    },
    // ===== math-linalg 线性代数包 =====
    // 特征值：A=[[2,1],[1,2]] 的特征多项式 λ²-4λ+3，零点即特征值 1 和 3
    'math-linalg-13': {
        fn: (λ) => λ * λ - 4 * λ + 3,
        initialRange: {xMin: -1, xMax: 5, yMin: -2, yMax: 6},
        xLabel: 'λ',
        notes: [
            '以矩阵 A=[[2,1],[1,2]] 为例：特征方程 det(A-λI)=λ²-4λ+3=0',
            '图像与 x 轴的两个交点 λ=1、λ=3 就是 A 的两个特征值',
            '求特征值 = 解特征多项式的零点，和「方程的解=函数零点」完全同构',
        ],
    },
    // ===== math-probability 概率统计包 =====
    // 组合数：n=10 固定，C(10,k) 随 k 变化（钟形，对称）
    'math-probability-2': {
        fn: (k) => binom(10, Math.round(k)),
        initialRange: {xMin: -1, xMax: 11, yMin: -10, yMax: 260},
        xLabel: 'k',
        notes: [
            'n=10 固定：C(10,k) 先增后减，最大值在 k=5 处为 252',
            '图像左右对称：C(n,k)=C(n,n-k)，取 3 个与取 7 个一样多',
            '实际是 k=0,1,…,10 的离散点，连线仅为示意（杨辉三角第 10 行）',
        ],
    },
    // 二项分布 B(10, 0.5) 的概率分布
    'math-probability-12': {
        fn: (k) => binom(10, Math.round(k)) * Math.pow(0.5, 10),
        initialRange: {xMin: -1, xMax: 11, yMin: -0.02, yMax: 0.3},
        xLabel: 'k',
        notes: [
            '抛 10 次硬币正面 k 次的概率：k=5 最大约 0.246，k=0 或 10 仅约 0.001',
            '形状与组合数图一致——二项分布就是组合数乘上 pᵏ(1-p)ⁿ⁻ᵏ',
            '阴影面积累加近似总概率 1（离散分布的严格求和是竖条面积之和）',
        ],
    },
    // 标准正态分布密度曲线：阴影面积即概率
    'math-probability-13': {
        fn: (x) => Math.exp(-(x * x) / 2) / Math.sqrt(2 * Math.PI),
        initialRange: {xMin: -4, xMax: 4, yMin: -0.05, yMax: 0.45},
        notes: [
            '标准正态 N(0,1)：μ=0 处的钟形曲线，两侧关于 y 轴对称',
            '阴影面积就是概率：x=1 时 [0,1] 面积≈0.34，即 P(0<X<1)≈34%',
            '68-95-99.7 法则：±1σ/±2σ/±3σ 内的面积约为 68%/95%/99.7%',
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
