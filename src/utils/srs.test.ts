import {describe, expect, it} from 'vitest';
import {DEFAULT_INTERVALS} from '@/constants';
import {
  canLevelUp,
  clampLevel,
  computeLevelDown,
  computeLevelUp,
  isDue,
  MASTERED_LEVEL,
  MAX_LEVEL,
  normalizeLearnDate,
} from './srs';

describe('srs', () => {
  describe('normalizeLearnDate', () => {
    it('number 原样返回', () => {
      expect(normalizeLearnDate(123456789)).toBe(123456789);
    });

    it('NaN 返回当前时间附近', () => {
      const result = normalizeLearnDate(NaN);
      expect(result).toBeGreaterThanOrEqual(Date.now() - 1000);
      expect(result).toBeLessThanOrEqual(Date.now() + 1000);
    });

    it('字符串按 ISO 解析', () => {
      const ts = Date.UTC(2024, 0, 1, 12, 0, 0);
      expect(normalizeLearnDate('2024-01-01T12:00:00.000Z')).toBe(ts);
    });

    it('非法字符串返回当前时间附近', () => {
      const result = normalizeLearnDate('not-a-date');
      expect(result).toBeGreaterThanOrEqual(Date.now() - 1000);
      expect(result).toBeLessThanOrEqual(Date.now() + 1000);
    });

    it('Date 对象转时间戳', () => {
      const d = new Date('2024-06-15T00:00:00.000Z');
      expect(normalizeLearnDate(d)).toBe(d.getTime());
    });

    it('无效 Date 返回当前时间附近', () => {
      const result = normalizeLearnDate(new Date('invalid'));
      expect(result).toBeGreaterThanOrEqual(Date.now() - 1000);
      expect(result).toBeLessThanOrEqual(Date.now() + 1000);
    });

    it('undefined / null 返回当前时间附近', () => {
      const r1 = normalizeLearnDate(undefined);
      const r2 = normalizeLearnDate(null);
      expect(r1).toBeGreaterThanOrEqual(Date.now() - 1000);
      expect(r2).toBeGreaterThanOrEqual(Date.now() - 1000);
    });
  });

  describe('clampLevel', () => {
    it('低于 0 返回 0', () => {
      expect(clampLevel(-5)).toBe(0);
    });

    it('高于 max 返回 max', () => {
      expect(clampLevel(100, MAX_LEVEL)).toBe(MAX_LEVEL);
    });

    it('范围内原样返回', () => {
      expect(clampLevel(7, MAX_LEVEL)).toBe(7);
    });
  });

  describe('isDue', () => {
    it('learnDate 为假值时视为到期', () => {
      expect(isDue(0, 1, Date.now())).toBe(true);
      expect(isDue(undefined, 1, Date.now())).toBe(true);
      expect(isDue(null, 1, Date.now())).toBe(true);
    });

    it('未到期返回 false', () => {
      const now = Date.now();
      expect(isDue(now, 1, now)).toBe(false);
    });

    it('正好到间隔返回 true', () => {
      const now = Date.now();
      const intervalMs = DEFAULT_INTERVALS[1] * 60 * 1000;
      expect(isDue(now - intervalMs, 1, now)).toBe(true);
    });
  });

  describe('canLevelUp', () => {
    it('learnDate 为假值时允许升级', () => {
      expect(canLevelUp(0, 1, Date.now())).toBe(true);
      expect(canLevelUp(undefined, 1, Date.now())).toBe(true);
    });

    it('窗口内返回 true', () => {
      const now = Date.now();
      const startMs = DEFAULT_INTERVALS[1] * 60 * 1000 + 1;
      expect(canLevelUp(now - startMs, 1, now)).toBe(true);
    });

    it('太早返回 false', () => {
      const now = Date.now();
      expect(canLevelUp(now, 1, now)).toBe(false);
    });

    it('太晚返回 false', () => {
      const now = Date.now();
      const endMs = DEFAULT_INTERVALS[4] * 60 * 1000 + 1;
      expect(canLevelUp(now - endMs, 1, now)).toBe(false);
    });

    it('level 11 的窗口使用 intervals 最后一个值', () => {
      const now = Date.now();
      const startMs = DEFAULT_INTERVALS[11] * 60 * 1000 + 1;
      expect(canLevelUp(now - startMs, 11, now)).toBe(true);
    });
  });

  describe('computeLevelUp', () => {
    it('默认 +1', () => {
      expect(computeLevelUp(1, undefined)).toBe(2);
      expect(computeLevelUp(1, '正常')).toBe(2);
    });

    it('较强 +2', () => {
      expect(computeLevelUp(1, '较强')).toBe(3);
    });

    it('极强 +3', () => {
      expect(computeLevelUp(1, '极强')).toBe(4);
    });

    it('封顶 MAX_LEVEL', () => {
      expect(computeLevelUp(11, '极强')).toBe(MAX_LEVEL);
      expect(computeLevelUp(MAX_LEVEL, '正常')).toBe(MAX_LEVEL);
    });
  });

  describe('computeLevelDown', () => {
    it('满级重置为 1', () => {
      expect(computeLevelDown(MASTERED_LEVEL)).toBe(1);
    });

    it('普通等级 -1', () => {
      expect(computeLevelDown(5)).toBe(4);
    });

    it('下限 1', () => {
      expect(computeLevelDown(1)).toBe(1);
      expect(computeLevelDown(0)).toBe(1);
    });
  });
});
