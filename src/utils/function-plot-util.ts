/**
 * 函数绘图纯函数工具：坐标变换、可视范围计算、断点检测。
 * 与 Canvas 无关，便于单元测试，供 FunctionPlot.vue 使用。
 */

/** 数据坐标下的可视范围 */
export interface ViewRange {
    xMin: number;
    xMax: number;
    yMin: number;
    yMax: number;
}

/** 画布上的像素矩形（y 轴向下） */
export interface PlotRect {
    x: number;
    y: number;
    width: number;
    height: number;
}

/** 断点检测参数 */
export interface DiscontinuityOptions {
    /** 符号相反且较小绝对值超过该阈值 → 断开（处理 tan、1/x 渐近线两侧的大值） */
    minAbs?: number;
    /** 符号相反且较大/较小绝对值比超过该阈值 → 断开（处理突变过大） */
    ratio?: number;
}

/**
 * 数据坐标 → 画布像素坐标（y 轴翻转）。
 */
export function dataToPixel(
    dx: number,
    dy: number,
    range: ViewRange,
    rect: PlotRect,
): {x: number; y: number} {
    const sx = (dx - range.xMin) / (range.xMax - range.xMin);
    const sy = (range.yMax - dy) / (range.yMax - range.yMin);
    return {
        x: rect.x + sx * rect.width,
        y: rect.y + sy * rect.height,
    };
}

/**
 * 画布像素坐标 → 数据坐标（y 轴翻转）。
 */
export function pixelToData(
    px: number,
    py: number,
    range: ViewRange,
    rect: PlotRect,
): {x: number; y: number} {
    const sx = (px - rect.x) / rect.width;
    const sy = (py - rect.y) / rect.height;
    return {
        x: range.xMin + sx * (range.xMax - range.xMin),
        y: range.yMax - sy * (range.yMax - range.yMin),
    };
}

/**
 * 根据函数在 [xMin, xMax] 上的采样值自动计算可视范围（y 方向留出边距）。
 * 非有限值（渐近线附近、溢出）不参与取值；若采样值全部非有限则回退 [-1, 1]。
 */
export function calcViewRange(
    fn: (x: number) => number,
    xMin: number,
    xMax: number,
    sampleCount: number = 200,
    padRatio: number = 0.1,
): ViewRange {
    let yMin = Infinity;
    let yMax = -Infinity;
    const step = sampleCount > 1 ? (xMax - xMin) / (sampleCount - 1) : 0;
    for (let i = 0; i < sampleCount; i++) {
        const y = fn(xMin + step * i);
        if (Number.isFinite(y)) {
            if (y < yMin) yMin = y;
            if (y > yMax) yMax = y;
        }
    }
    if (!Number.isFinite(yMin) || !Number.isFinite(yMax)) {
        return {xMin, xMax, yMin: -1, yMax: 1};
    }
    if (yMax === yMin) {
        // 常值函数（如 y=0）：以该值为中心扩展一个单位，避免零高度视口
        return {xMin, xMax, yMin: yMin - 1, yMax: yMax + 1};
    }
    const pad = (yMax - yMin) * padRatio;
    return {xMin, xMax, yMin: yMin - pad, yMax: yMax + pad};
}

/**
 * 断点检测：相邻两个采样点之间是否需要断开连线。
 * 规则（满足任一条即断开）：
 * 1. 任一 y 值非有限（Infinity/NaN）；
 * 2. 两值符号相反且较小绝对值超过 minAbs —— 渐近线两侧的对称大值（如 tan、1/x）；
 * 3. 两值符号相反且较大/较小比值超过 ratio —— 绝对值突变过大。
 * 相邻 y 值符号相反但都接近 0 属正常过零点（如 sin 过 x 轴），不视为断点。
 */
export function isDiscontinuity(
    y1: number,
    y2: number,
    options: DiscontinuityOptions = {},
): boolean {
    if (!Number.isFinite(y1) || !Number.isFinite(y2)) return true;
    if (y1 === 0 || y2 === 0) return false;
    if (Math.sign(y1) === Math.sign(y2)) return false;

    const minAbs = options.minAbs ?? 10;
    const ratio = options.ratio ?? 1000;
    const a = Math.abs(y1);
    const b = Math.abs(y2);
    const smaller = Math.min(a, b);
    const larger = Math.max(a, b);
    return smaller > minAbs || larger / smaller > ratio;
}
