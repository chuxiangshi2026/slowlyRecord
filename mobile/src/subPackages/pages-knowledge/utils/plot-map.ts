/**
 * 知识条目 → 可绘制函数的映射表（移动端函数图像功能）。
 *
 * 桌面端（src/views/KnowledgeMemory/function-maps.ts）用闭包编码函数，无法序列化进 JSON；
 * 移动端改为声明式表达式字符串（由 utils/function-plot.ts 的安全解析器编译），
 * 只覆盖桌面端映射中「单变量连续曲线」的子集（几何联动、双曲线联立等桌面专属能力不迁移）。
 */
export interface MobilePlotSpec {
  /** 安全表达式（自变量 x），如 'pi*x^2' */
  expr: string
  /** x 轴可视范围 */
  xMin: number
  xMax: number
  /** 自变量标签（如 r、a），缺省 x */
  xLabel?: string
}

/** 条目 id → 函数图像描述 */
export const MOBILE_PLOT_MAP: Record<string, MobilePlotSpec> = {
  // 圆的面积 S=πr² / 周长 C=2πr
  'math-formulas-1': { expr: 'pi*x^2', xMin: 0, xMax: 5, xLabel: 'r' },
  'math-formulas-2': { expr: '2*pi*x', xMin: 0, xMax: 5, xLabel: 'r' },
  // 正方形面积 S=a² / 正方体体积 V=a³
  'math-formulas-4': { expr: 'x^2', xMin: 0, xMax: 5, xLabel: 'a' },
  'math-formulas-9': { expr: 'x^3', xMin: 0, xMax: 4, xLabel: 'a' },
  // 重要极限一：sin x/x（x=0 处为可去间断点，采样自动断开）
  'math-calculus-2': { expr: 'sin(x)/x', xMin: -20, xMax: 20 },
  // 重要极限二：(1+1/x)^x 单调逼近 e
  'math-calculus-3': { expr: '(1+1/x)^x', xMin: 0.2, xMax: 50 },
  // 导数定义以 y=x³ 为例
  'math-calculus-4': { expr: 'x^3', xMin: -3, xMax: 3 },
  // 微分：y=x² 切线近似
  'math-calculus-7': { expr: 'x^2', xMin: -4, xMax: 4 },
  // 极值：y=x³-3x 在 x=±1 取极值
  'math-calculus-9': { expr: 'x^3-3*x', xMin: -3, xMax: 3 },
  // 牛顿-莱布尼茨：y=x² 面积函数
  'math-calculus-11': { expr: 'x^2', xMin: -3, xMax: 3 },
  // 泰勒公式：e^x
  'math-calculus-13': { expr: 'exp(x)', xMin: -4, xMax: 3 },
  // 标准正态分布密度 N(0,1)
  'math-probability-13': { expr: 'exp(-x^2/2)/sqrt(2*pi)', xMin: -4, xMax: 4 },
  // ===== 以下迁移自桌面端 function-maps.ts 的剩余单变量条目 =====
  // 圆面积随半径/弦长变化（桌面端量程 0..6）
  'math-formulas-13': { expr: 'sqrt(25-x^2)', xMin: 0, xMax: 6, xLabel: 'a' },
  // 方程与函数：抛物线 y=x²-2x-3（顶点 (1,-4)，零点 -1/3）
  'math-formulas-16': { expr: 'x^2-2*x-3', xMin: -4, xMax: 6 },
  // 一次函数 y=2x+1（斜率与截距）
  'math-formulas-21': { expr: '2*x+1', xMin: -5, xMax: 5 },
  // 二次函数 y=x²-2x-3（开口方向与顶点）
  'math-formulas-22': { expr: 'x^2-2*x-3', xMin: -4, xMax: 6 },
  // 反比例函数 y=1/x（x=0 渐近线，采样自动断开）
  'math-formulas-23': { expr: '1/x', xMin: -5, xMax: 5 },
  // 三角函数：sin/cos/tan（周期与渐近线）
  'math-formulas-24': { expr: 'sin(x)', xMin: -6.28, xMax: 6.28 },
  'math-formulas-25': { expr: 'cos(x)', xMin: -6.28, xMax: 6.28 },
  'math-formulas-26': { expr: 'tan(x)', xMin: -3.14, xMax: 3.14 },
  // 角度→弧度换算 y=πx/180
  'math-formulas-27': { expr: '(pi/180)*x', xMin: 0, xMax: 360, xLabel: '角度°' },
  // 指数函数 y=2^x
  'math-formulas-28': { expr: '2^x', xMin: -5, xMax: 5 },
  // 对数函数 y=ln x
  'math-formulas-29': { expr: 'ln(x)', xMin: 0, xMax: 10 },
  // 二次函数最值/对称轴（y=x² 两种量程）
  'math-formulas-30': { expr: 'x^2', xMin: -4, xMax: 4 },
  'math-formulas-31': { expr: 'x^2', xMin: -3, xMax: 3 },
  // 不等式与一次/直线交点
  'math-formulas-32': { expr: '3*x-6', xMin: -4, xMax: 6 },
  'math-formulas-33': { expr: '2*x+1', xMin: -4, xMax: 6 },
  // 特征方程 λ²-4λ+3
  'math-linalg-13': { expr: 'x^2-4*x+3', xMin: -1, xMax: 5, xLabel: 'λ' },
  // 匀变速直线 v=2t / 重力 G=9.8m / 液体压强 p=ρgh / 欧姆定律 I=6/R
  'physics-formulas-1': { expr: '2*x', xMin: 0, xMax: 10, xLabel: 't(s)' },
  'physics-formulas-3': { expr: '9.8*x', xMin: 0, xMax: 10, xLabel: 'm(kg)' },
  'physics-formulas-5': { expr: '9800*x', xMin: 0, xMax: 10, xLabel: 'h(m)' },
  'physics-formulas-11': { expr: '6/x', xMin: 0.5, xMax: 12, xLabel: 'R(Ω)' },
  // 焦耳热 Q=50I² / 透镜成像 v=10u/(u-10) / 自由落体 h=4.9t²
  'physics-formulas-14': { expr: '50*x^2', xMin: 0, xMax: 5, xLabel: 'I(A)' },
  'physics-formulas-18': { expr: '10*x/(x-10)', xMin: 10.5, xMax: 40, xLabel: 'u(cm)' },
  'physics-formulas-21': { expr: '4.9*x^2', xMin: 0, xMax: 5, xLabel: 't(s)' },
  // 气体压强 p=2/V / 溶液浓度 m/(100+m)*100
  'chemistry-formulas-21': { expr: '2/x', xMin: 0.2, xMax: 10, xLabel: 'V(L)' },
  'chemistry-formulas-22': { expr: 'x/(100+x)*100', xMin: 0, xMax: 300, xLabel: 'm质(g)' },
  // 跳过：math-probability-2/12（二项分布为离散函数，编译器无 comb，不迁移）、
  // 桌面端 fn2 双函数与 geometry 几何联动（移动端 spec 无对应字段）
}

/** 查询条目的函数图像描述（无映射返回 null） */
export function getMobilePlot(itemId: string): MobilePlotSpec | null {
  return MOBILE_PLOT_MAP[itemId] ?? null
}
