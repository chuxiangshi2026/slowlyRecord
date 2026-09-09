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
}

/** 查询条目的函数图像描述（无映射返回 null） */
export function getMobilePlot(itemId: string): MobilePlotSpec | null {
  return MOBILE_PLOT_MAP[itemId] ?? null
}
