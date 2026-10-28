import { describe, it, expect } from 'vitest'
import {
  buildReviewShareInfo,
  drawReviewCard,
  getReviewEncourage,
  type ReviewCardCtx,
} from './review-share-card'

const NOW = new Date(2026, 9, 29, 12, 0, 0) // 2026-10-29 周四

describe('getReviewEncourage', () => {
  it('达成目标优先于连续天数文案', () => {
    expect(getReviewEncourage(20, 3, 20)).toBe('今日目标达成，保持这个节奏！')
  })

  it('按连续天数分档', () => {
    expect(getReviewEncourage(1, 100, 20)).toBe('百日筑基，你就是坚持本身！')
    expect(getReviewEncourage(1, 30, 20)).toBe('一个月的坚持，习惯正在养成！')
    expect(getReviewEncourage(1, 7, 20)).toBe('连续一周以上，真的很棒！')
    expect(getReviewEncourage(1, 0, 20)).toBe('今天已经迈出一步，继续加油！')
  })

  it('未复习时给出启动文案', () => {
    expect(getReviewEncourage(0, 0, 20)).toBe('打开慢记，从今天的第一组复习开始。')
  })
})

describe('buildReviewShareInfo', () => {
  it('生成日期并透传统计', () => {
    const info = buildReviewShareInfo(NOW, 12, 6, 20, 3739)
    expect(info.dateText).toBe('2026年10月29日 星期四')
    expect(info.reviewed).toBe(12)
    expect(info.streak).toBe(6)
    expect(info.goal).toBe(20)
    expect(info.totalWords).toBe(3739)
    expect(info.encourage).toBe('今天已经迈出一步，继续加油！')
  })

  it('负数与小数被规整', () => {
    const info = buildReviewShareInfo(NOW, -3, 2.8, 0, -1)
    expect(info.reviewed).toBe(0)
    expect(info.streak).toBe(2)
    expect(info.goal).toBe(0)
    expect(info.totalWords).toBe(0)
  })
})

function createMockCtx() {
  const texts: string[] = []
  const ctx: ReviewCardCtx = {
    fillStyle: '',
    strokeStyle: '',
    font: '',
    textAlign: 'left',
    textBaseline: 'alphabetic',
    lineWidth: 1,
    globalAlpha: 1,
    save() {},
    restore() {},
    scale() {},
    beginPath() {},
    closePath() {},
    moveTo() {},
    lineTo() {},
    arc() {},
    fill() {},
    stroke() {},
    fillRect() {},
    fillText(text) { texts.push(text) },
    measureText(text) { return { width: text.length * 20 } },
    createLinearGradient() { return { addColorStop() {} } },
  }
  return { ctx, texts }
}

describe('drawReviewCard', () => {
  it('绘制今日复习、连续打卡、目标与产品名', () => {
    const { ctx, texts } = createMockCtx()
    drawReviewCard(ctx, buildReviewShareInfo(NOW, 12, 6, 20, 3739))
    const all = texts.join('|')
    expect(all).toContain('今日复习 · 战绩卡')
    expect(all).toContain('今天复习了')
    expect(all).toContain('12')
    expect(all).toContain('连续打卡 6 天')
    expect(all).toContain('今日目标 20 词')
    expect(all).toContain('词库共 3739 词')
  })

  it('零目标时不除零，完成率为 0%', () => {
    const { ctx, texts } = createMockCtx()
    drawReviewCard(ctx, buildReviewShareInfo(NOW, 3, 1, 0, 10))
    expect(texts.join('|')).toContain('完成 0%')
  })
})
