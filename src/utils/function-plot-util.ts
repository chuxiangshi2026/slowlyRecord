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

/** 极值点（局部极大/极小） */
export interface Extremum {
    x: number;
    y: number;
    kind: 'max' | 'min';
}

/** 黄金分割搜索：在 [a, b] 内细化极值点位置 */
function refineExtremum(
    fn: (x: number) => number,
    a: number,
    b: number,
    isMax: boolean,
): {x: number; y: number} {
    const GR = (Math.sqrt(5) - 1) / 2;
    // 非有限值视为最差，使搜索避开渐近线
    const val = (x: number) => {
        const y = fn(x);
        return Number.isFinite(y) ? y : isMax ? -Infinity : Infinity;
    };
    let c = b - GR * (b - a);
    let d = a + GR * (b - a);
    let fc = val(c);
    let fd = val(d);
    for (let i = 0; i < 60; i++) {
        if (isMax ? fc < fd : fc > fd) {
            a = c; c = d; fc = fd;
            d = a + GR * (b - a); fd = val(d);
        } else {
            b = d; d = c; fd = fc;
            c = b - GR * (b - a); fc = val(c);
        }
    }
    const x = (a + b) / 2;
    return {x, y: fn(x)};
}

/**
 * 数值检测 [xMin, xMax] 内的局部极值点：采样找符号变化区间，再黄金分割细化。
 * 渐近线/断点附近不判定极值；常值函数无极值。
 */
export function findExtrema(
    fn: (x: number) => number,
    xMin: number,
    xMax: number,
    samples = 400,
): Extremum[] {
    const xs: number[] = [];
    const ys: number[] = [];
    const step = (xMax - xMin) / samples;
    for (let i = 0; i <= samples; i++) {
        xs.push(xMin + step * i);
        ys.push(fn(xs[i]));
    }
    const out: Extremum[] = [];
    for (let i = 1; i < samples; i++) {
        const y0 = ys[i - 1], y1 = ys[i], y2 = ys[i + 1];
        if (!Number.isFinite(y0) || !Number.isFinite(y1) || !Number.isFinite(y2)) continue;
        if (isDiscontinuity(y0, y1) || isDiscontinuity(y1, y2)) continue;
        const isMax = y1 >= y0 && y1 >= y2 && (y1 > y0 || y1 > y2);
        const isMin = y1 <= y0 && y1 <= y2 && (y1 < y0 || y1 < y2);
        if (!isMax && !isMin) continue;
        const r = refineExtremum(fn, xs[i - 1], xs[i + 1], isMax);
        if (!Number.isFinite(r.y)) continue;
        // 去重：细化后落在已有极值点附近的视为同一点
        if (out.some(e => Math.abs(e.x - r.x) < step)) continue;
        out.push({x: r.x, y: r.y, kind: isMax ? 'max' : 'min'});
    }
    return out;
}

/**
 * 数值求解 [xMin, xMax] 内的零点（与 x 轴交点）：符号变化区间二分细化。
 * 渐近线两侧的符号跳变（如 y=1/x 跨过 x=0）不算零点。
 */
export function findZeros(
    fn: (x: number) => number,
    xMin: number,
    xMax: number,
    samples = 400,
): number[] {
    const zeros: number[] = [];
    const step = (xMax - xMin) / samples;
    let prevX = xMin;
    let prevY = fn(prevX);
    for (let i = 1; i <= samples; i++) {
        const x = xMin + step * i;
        const y = fn(x);
        if (Number.isFinite(prevY) && Number.isFinite(y)) {
            if (y === 0) {
                zeros.push(x);
            } else if (prevY === 0) {
                // 从恰为 0 的采样点离开（含曲线与 x 轴相切的情形）
                zeros.push(prevX);
            } else if (Math.sign(y) !== Math.sign(prevY) && !isDiscontinuity(prevY, y, {ratio: Infinity})) {
                // 仅排除渐近线跳变（两侧绝对值都很大）；ratio 规则会把过零点附近
                // 「一侧≈0、一侧很小」的正常情况误判为断点，故置为 Infinity
                let a = prevX, b = x, fa = prevY;
                for (let k = 0; k < 60 && b - a > 1e-12; k++) {
                    const m = (a + b) / 2;
                    const fm = fn(m);
                    if (fm === 0) { a = m; b = m; break; }
                    if (Math.sign(fm) === Math.sign(fa)) { a = m; fa = fm; } else { b = m; }
                }
                zeros.push((a + b) / 2);
            }
        }
        prevX = x;
        prevY = y;
    }
    // 去重：相邻采样点命中同一零点的情况
    return zeros.filter((z, i) => i === 0 || Math.abs(z - zeros[i - 1]) > step);
}

/**
 * 有向面积（定积分近似）：梯形法累加曲线与 x 轴之间 [a, b] 的带符号面积。
 * 含非有限值/断点的小区间跳过（渐近线附近不计入）。
 */
export function integrate(
    fn: (x: number) => number,
    a: number,
    b: number,
    slices = 1000,
): number {
    if (a === b) return 0;
    const sign = a < b ? 1 : -1;
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    const h = (hi - lo) / slices;
    let sum = 0;
    for (let i = 0; i < slices; i++) {
        const y0 = fn(lo + h * i);
        const y1 = fn(lo + h * (i + 1));
        if (!Number.isFinite(y0) || !Number.isFinite(y1)) continue;
        if (isDiscontinuity(y0, y1)) continue;
        sum += ((y0 + y1) / 2) * h;
    }
    return sign * sum;
}
