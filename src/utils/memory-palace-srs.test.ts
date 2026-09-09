import {describe, expect, it} from 'vitest';
import {DEFAULT_INTERVALS} from '@/constants';
import {
  DEFAULT_LEVEL,
  MASTERED_LEVEL,
  clampLevel,
  getPegLevel,
  isDue,
  isMastered,
  markForgotten,
  markRemembered,
} from './memory-palace-srs';
import type {PegItem} from '@/types/memory-palace';

function makePeg(level?: number, learnDate?: number): PegItem {
  return {_id: 'peg_1', palaceId: 'p1', locusOrder: 1, level, learnDate};
}

describe('memory-palace-srs', () => {
  it('clampLevel 限制在 0-12', () => {
    expect(clampLevel(-1)).toBe(0);
    expect(clampLevel(13)).toBe(MASTERED_LEVEL);
    expect(clampLevel(5)).toBe(5);
  });

  it('无 level 时按默认等级处理', () => {
    expect(getPegLevel(makePeg())).toBe(DEFAULT_LEVEL);
    expect(getPegLevel(makePeg(3))).toBe(3);
  });

  it('level 12 视为已掌握', () => {
    expect(isMastered(makePeg(12))).toBe(true);
    expect(isMastered(makePeg(11))).toBe(false);
  });

  it('未自评过的挂载立即到期', () => {
    expect(isDue(makePeg(), Date.now())).toBe(true);
  });

  it('未过复习间隔不到期', () => {
    const now = Date.now();
    // level 0 间隔 1 分钟
    const peg = makePeg(0, now);
    expect(isDue(peg, now + 30 * 1000)).toBe(false);
    expect(isDue(peg, now + DEFAULT_INTERVALS[0] * 60 * 1000)).toBe(true);
  });

  it('到期自评记住后升级', () => {
    const now = Date.now();
    const peg = makePeg(1, now - DEFAULT_INTERVALS[1] * 60 * 1000 - 1);
    const updated = markRemembered(peg, now);
    expect(updated.level).toBe(2);
    expect(updated.learnDate).toBe(now);
  });

  it('未到期自评记住刷新 learnDate 但不升级', () => {
    const now = Date.now();
    const peg = makePeg(5, now);
    const updated = markRemembered(peg, now);
    expect(updated.level).toBe(5);
    expect(updated.learnDate).toBe(now);
  });

  it('到期但超过窗口时刷新 learnDate 但不升级', () => {
    const now = Date.now();
    const endWindowMs = DEFAULT_INTERVALS[4] * 60 * 1000 + 1;
    const peg = makePeg(1, now - endWindowMs);
    const updated = markRemembered(peg, now);
    expect(updated.level).toBe(1);
    expect(updated.learnDate).toBe(now);
  });

  it('满级后不再升级', () => {
    const now = Date.now();
    const peg = makePeg(12, now - DEFAULT_INTERVALS[12] * 60 * 1000);
    expect(markRemembered(peg, now).level).toBe(12);
  });

  it('自评忘记降级', () => {
    const now = Date.now();
    const updated = markForgotten(makePeg(9, now - 1000), now);
    expect(updated.level).toBe(5);
    expect(updated.learnDate).toBe(now);
  });

  it('12 级忘记降为 8 级（降级幅度封顶 -4）', () => {
    const updated = markForgotten(makePeg(12, Date.now() - 1000));
    expect(updated.level).toBe(8);
  });

  it('0 级忘记按统一下限升为 1 级', () => {
    const updated = markForgotten(makePeg(0));
    expect(updated.level).toBe(1);
  });

  it('记忆牢固度 "较强" 时 +2 级', () => {
    const now = Date.now();
    const peg = makePeg(1, now - DEFAULT_INTERVALS[1] * 60 * 1000 - 1);
    const updated = markRemembered(peg, now, '较强');
    expect(updated.level).toBe(3);
  });

  it('记忆牢固度 "极强" 时 +3 级', () => {
    const now = Date.now();
    const peg = makePeg(1, now - DEFAULT_INTERVALS[1] * 60 * 1000 - 1);
    const updated = markRemembered(peg, now, '极强');
    expect(updated.level).toBe(4);
  });
});
