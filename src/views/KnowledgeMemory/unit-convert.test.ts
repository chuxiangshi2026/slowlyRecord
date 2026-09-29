import {describe, expect, it} from 'vitest';
import {convertUnit, UNIT_CATEGORIES} from './unit-convert';

describe('convertUnit', () => {
  it('1 千米 = 1000 米', () => {
    expect(convertUnit('length', '千米', '米', 1)).toBe(1000);
  });

  it('1 英里 = 1.609344 千米', () => {
    expect(convertUnit('length', '英里', '千米', 1)).toBeCloseTo(1.609344, 10);
  });

  it('1 斤 = 0.5 千克', () => {
    expect(convertUnit('mass', '斤', '千克', 1)).toBeCloseTo(0.5, 10);
  });

  it('1 公顷 = 10000 平方米', () => {
    expect(convertUnit('area', '公顷', '平方米', 1)).toBe(10000);
  });

  it('1 米每秒 = 3.6 千米每小时', () => {
    expect(convertUnit('speed', '米每秒', '千米每小时', 1)).toBeCloseTo(3.6, 10);
  });

  it('0°C = 32°F', () => {
    expect(convertUnit('temperature', '摄氏度', '华氏度', 0)).toBeCloseTo(32, 10);
  });

  it('100°C = 373.15K', () => {
    expect(convertUnit('temperature', '摄氏度', '开尔文', 100)).toBeCloseTo(373.15, 10);
  });

  it('未知类别 / 单位返回 null', () => {
    expect(convertUnit('nope', '米', '千米', 1)).toBeNull();
    expect(convertUnit('length', '光年', '米', 1)).toBeNull();
    expect(convertUnit('temperature', '列氏度', '摄氏度', 1)).toBeNull();
  });
});

describe('UNIT_CATEGORIES', () => {
  it('温度类别存在且含三个温标', () => {
    const t = UNIT_CATEGORIES.find(c => c.key === 'temperature');
    expect(t).toBeDefined();
    expect(t!.units.map(u => u.name)).toEqual(['摄氏度', '华氏度', '开尔文']);
  });
});
