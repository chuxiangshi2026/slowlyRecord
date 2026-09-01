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
    const peg = makePeg(1, now - DEFAULT_INTERVALS[1] * 60 * 1000);
    const updated = markRemembered(peg, now);
    expect(updated.level).toBe(2);
    expect(updated.learnDate).toBe(now);
  });

  it('未到期自评记住不升级', () => {
    const now = Date.now();
    const peg = makePeg(5, now);
    expect(markRemembered(peg, now)).toBe(peg);
  });

  it('满级后不再升级', () => {
    const now = Date.now();
    const peg = makePeg(12, now - DEFAULT_INTERVALS[12] * 60 * 1000);
    expect(markRemembered(peg, now).level).toBe(12);
  });

  it('自评忘记降级', () => {
    const now = Date.now();
    const updated = markForgotten(makePeg(5, now - 1000), now);
    expect(updated.level).toBe(4);
    expect(updated.learnDate).toBe(now);
  });

  it('12 级忘记直接重置为 1 级', () => {
    const updated = markForgotten(makePeg(12, Date.now() - 1000));
    expect(updated.level).toBe(1);
  });

  it('0 级忘记保持 0 级', () => {
    const updated = markForgotten(makePeg(0));
    expect(updated.level).toBe(0);
  });
});
