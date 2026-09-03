/**
 * function-plot-util 纯函数测试
 */
import {describe, it, expect} from 'vitest';
import {
    dataToPixel,
    pixelToData,
    calcViewRange,
    isDiscontinuity,
    type ViewRange,
} from './function-plot-util';

/** 一个 100×100 的画布，原点位于左上角 */
const RECT = {x: 0, y: 0, width: 100, height: 100};
const RANGE: ViewRange = {xMin: 0, xMax: 10, yMin: 0, yMax: 10};

describe('dataToPixel / pixelToData 坐标变换', () => {
    it('数据坐标映射到画布像素（y 轴向下翻转）', () => {
        expect(dataToPixel(0, 0, RANGE, RECT)).toEqual({x: 0, y: 100});
        expect(dataToPixel(10, 10, RANGE, RECT)).toEqual({x: 100, y: 0});
        expect(dataToPixel(5, 5, RANGE, RECT)).toEqual({x: 50, y: 50});
    });

    it('支持画布带偏移的矩形', () => {
        const rect = {x: 10, y: 20, width: 100, height: 200};
        expect(dataToPixel(0, 0, RANGE, rect)).toEqual({x: 10, y: 220});
        expect(dataToPixel(10, 10, RANGE, rect)).toEqual({x: 110, y: 20});
    });

    it('像素坐标反变换回数据坐标', () => {
        expect(pixelToData(0, 100, RANGE, RECT)).toEqual({x: 0, y: 0});
        expect(pixelToData(100, 0, RANGE, RECT)).toEqual({x: 10, y: 10});
        expect(pixelToData(50, 50, RANGE, RECT)).toEqual({x: 5, y: 5});
    });

    it('往返变换保持近似相等', () => {
        const px = {x: 33, y: 67};
        const data = pixelToData(px.x, px.y, RANGE, RECT);
        const back = dataToPixel(data.x, data.y, RANGE, RECT);
        expect(back.x).toBeCloseTo(px.x, 6);
        expect(back.y).toBeCloseTo(px.y, 6);
    });
});

describe('calcViewRange 可视范围计算', () => {
    it('二次函数 y=x² 在 [-2,2] 上自动取 y 范围并留边距', () => {
        const r = calcViewRange((x: number) => x * x, -2, 2);
        expect(r.xMin).toBe(-2);
        expect(r.xMax).toBe(2);
        // 值域 [0, 4]，加 10% 边距（采样最小值略大于 0，故跨度略小于 4.8）
        expect(r.yMin).toBeLessThan(0);
        expect(r.yMax).toBeGreaterThan(4);
        expect(r.yMax - r.yMin).toBeCloseTo(4.8, 1);
    });

    it('过滤渐近线附近的非有限采样值（y=1/x）', () => {
        const r = calcViewRange((x: number) => 1 / x, -1, 1);
        expect(Number.isFinite(r.yMin)).toBe(true);
        expect(Number.isFinite(r.yMax)).toBe(true);
        expect(r.yMin).toBeLessThan(0);
        expect(r.yMax).toBeGreaterThan(0);
    });

    it('采样值全部非有限时回退到 [-1, 1]', () => {
        const r = calcViewRange(() => Infinity, -5, 5);
        expect(r).toEqual({xMin: -5, xMax: 5, yMin: -1, yMax: 1});
    });

    it('常值函数扩展为以该值为中心的高度 2 的视口', () => {
        const r = calcViewRange(() => 3, -1, 1);
        expect(r.yMin).toBe(2);
        expect(r.yMax).toBe(4);
    });

    it('padRatio=0 时无外边距', () => {
        const r = calcViewRange((x: number) => x, 0, 2, 100, 0);
        expect(r.yMin).toBe(0);
        expect(r.yMax).toBe(2);
    });
});

describe('isDiscontinuity 断点检测', () => {
    it('非有限值一律视为断点', () => {
        expect(isDiscontinuity(Infinity, 5)).toBe(true);
        expect(isDiscontinuity(5, -Infinity)).toBe(true);
        expect(isDiscontinuity(NaN, 5)).toBe(true);
        expect(isDiscontinuity(5, NaN)).toBe(true);
    });

    it('正常过零点（符号相反但都接近 0）不断开', () => {
        expect(isDiscontinuity(0.5, -0.5)).toBe(false);
        expect(isDiscontinuity(3, -3)).toBe(false);
    });

    it('y 值为 0 时不断开', () => {
        expect(isDiscontinuity(0, -5)).toBe(false);
        expect(isDiscontinuity(5, 0)).toBe(false);
    });

    it('同号不视为断点', () => {
        expect(isDiscontinuity(100, 1000)).toBe(false);
        expect(isDiscontinuity(-1e6, -2)).toBe(false);
    });

    it('渐近线两侧对称大值（如 tan、1/x 在 x=0 附近）断开', () => {
        expect(isDiscontinuity(100, -100)).toBe(true);
        expect(isDiscontinuity(1e6, -1e6)).toBe(true);
    });

    it('符号相反且绝对值突变过大时断开', () => {
        expect(isDiscontinuity(100000, -0.001)).toBe(true);
    });

    it('支持自定义阈值', () => {
        expect(isDiscontinuity(50, -50, {minAbs: 30})).toBe(true);
        expect(isDiscontinuity(50, -50, {minAbs: 100})).toBe(false);
        expect(isDiscontinuity(100, -0.01, {ratio: 10, minAbs: 100})).toBe(true);
        expect(isDiscontinuity(100, -50, {ratio: 10, minAbs: 100})).toBe(false);
    });
});
