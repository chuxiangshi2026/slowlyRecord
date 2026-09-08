/**
 * signin-card 纯逻辑测试：文案阈值、点阵构建、绘制调用
 */
import { describe, it, expect } from 'vitest'
import {
  buildCardInfo,
  drawSigninCard,
  getEncourageText,
  CARD_WIDTH,
  CARD_HEIGHT,
  type ShareCardCtx,
} from './signin-card'

// 固定日期：2026-09-09 为周三；2026-09-01 为周二（周日开头网格首行留 2 个空）
const NOW = new Date(2026, 8, 9, 12, 0, 0)

describe('getEncourageText 按连续天数分档', () => {
  it.each([
    [1, '好的开始，继续保持！'],
    [2, '好的开始，继续保持！'],
    [3, '坚持就是胜利，你已经上路了！'],
    [6, '坚持就是胜利，你已经上路了！'],
    [7, '坚持一周以上，真的很棒！'],
    [13, '坚持一周以上，真的很棒！'],
    [14, '连续两周不间断，自律给你自由！'],
    [29, '连续两周不间断，自律给你自由！'],
    [30, '一个月以上的坚持，习惯正在养成！'],
    [99, '一个月以上的坚持，习惯正在养成！'],
    [100, '百日筑基，你就是坚持本身！'],
    [365, '百日筑基，你就是坚持本身！'],
  ] as const)('streak=%i → %s', (streak, expected) => {
    expect(getEncourageText(streak)).toBe(expected)
  })
})

describe('buildCardInfo 组装卡片数据', () => {
  const signed = ['2026-09-05', '2026-09-06', '2026-09-07', '2026-09-08', '2026-09-09']
  const info = buildCardInfo(NOW, signed, 5, 12)

  it('生成中文日期与月份标题', () => {
    expect(info.dateText).toBe('2026年9月9日 星期三')
    expect(info.monthLabel).toBe('2026年9月')
  })

  it('透传连续/累计天数与鼓励文案', () => {
    expect(info.streak).toBe(5)
    expect(info.total).toBe(12)
    expect(info.encourage).toBe('坚持就是胜利，你已经上路了！')
  })

  it('点阵周日开头：首行前两格为空，9 号为 today', () => {
    // 9 月 1 日周二 → 首行 [null, null, 1, 2, 3, 4, 5]
    expect(info.dots[0][0]).toBeNull()
    expect(info.dots[0][1]).toBeNull()
    expect(info.dots[0][2]).toBe('empty') // 9-01 未打卡
    expect(info.dots[0][3]).toBe('empty') // 9-02
    // 9-05 周六在首行第 7 列
    expect(info.dots[0][6]).toBe('signed')
    // 9-09 周三：第二行（9-06 起）第 4 列
    expect(info.dots[1][0]).toBe('signed') // 9-06
    expect(info.dots[1][3]).toBe('today') // 9-09
    expect(info.dots[1][4]).toBe('empty') // 9-10
  })

  it('点阵行数补齐整周', () => {
    // 9 月 30 天 + 首行 2 空 = 32 格 → 5 行
    expect(info.dots).toHaveLength(5)
    expect(info.dots[4]).toHaveLength(7)
    expect(info.dots[4][2]).toBe('empty') // 9-29
    expect(info.dots[4][3]).toBe('empty') // 9-30
    // 月尾补空
    expect(info.dots[4][4]).toBeNull()
  })

  it('未来日期未打卡为空点', () => {
    const future = buildCardInfo(NOW, [], 1, 1)
    expect(future.dots.flat().filter(s => s === 'today')).toHaveLength(1)
    expect(future.dots.flat().filter(s => s === 'signed')).toHaveLength(0)
  })
})

/** 记录调用的 mock context */
function createMockCtx() {
  const calls: { method: string; args: unknown[] }[] = []
  const texts: string[] = []
  const ctx: ShareCardCtx = {
    fillStyle: '',
    strokeStyle: '',
    font: '',
    textAlign: 'left',
    textBaseline: 'alphabetic',
    lineWidth: 1,
    globalAlpha: 1,
    save() { calls.push({ method: 'save', args: [] }) },
    restore() { calls.push({ method: 'restore', args: [] }) },
    scale(...args) { calls.push({ method: 'scale', args }) },
    beginPath() { calls.push({ method: 'beginPath', args: [] }) },
    closePath() { calls.push({ method: 'closePath', args: [] }) },
    moveTo(...args) { calls.push({ method: 'moveTo', args }) },
    lineTo(...args) { calls.push({ method: 'lineTo', args }) },
    arc(...args) { calls.push({ method: 'arc', args }) },
    fill() { calls.push({ method: 'fill', args: [] }) },
    stroke() { calls.push({ method: 'stroke', args: [] }) },
    fillRect(...args) { calls.push({ method: 'fillRect', args }) },
    fillText(text, ...rest) { texts.push(text); calls.push({ method: 'fillText', args: [text, ...rest] }) },
    measureText(text) { calls.push({ method: 'measureText', args: [text] }); return { width: text.length * 20 } },
    createLinearGradient(...args) {
      calls.push({ method: 'createLinearGradient', args })
      return { addColorStop: (...a: unknown[]) => calls.push({ method: 'addColorStop', args: a }) }
    },
  }
  return { ctx, calls, texts }
}

describe('drawSigninCard 绘制调用', () => {
  const info = buildCardInfo(NOW, ['2026-09-09'], 1, 1)

  it('写出日期、天数、鼓励文案与产品名', () => {
    const { ctx, texts } = createMockCtx()
    drawSigninCard(ctx, info)
    expect(texts).toContain('2026年9月9日 星期三')
    expect(texts).toContain('1') // 连续天数大字
    expect(texts).toContain('天')
    expect(texts).toContain('累计打卡 1 天')
    expect(texts).toContain('好的开始，继续保持！')
    expect(texts).toContain('2026年9月 · 本月打卡')
    expect(texts).toContain('慢记 · 基于艾宾浩斯遗忘曲线的记忆工具')
  })

  it('每个非空点绘制圆点，今天额外描边高亮', () => {
    const { ctx, calls } = createMockCtx()
    drawSigninCard(ctx, info)
    const dotCount = info.dots.flat().filter(Boolean).length
    const todayCount = info.dots.flat().filter(s => s === 'today').length
    const arcCount = calls.filter(c => c.method === 'arc').length
    // 圆点数 = 装饰圆 2 个 + 点阵圆点数 + 今天的高亮环
    expect(arcCount).toBe(2 + dotCount + todayCount)
    // 今天 1 个高亮环 → 1 次 stroke
    expect(calls.filter(c => c.method === 'stroke')).toHaveLength(1)
  })

  it('使用竖版卡片尺寸范围，底部留有页脚空间', () => {
    const { ctx, calls } = createMockCtx()
    drawSigninCard(ctx, info, CARD_WIDTH, CARD_HEIGHT)
    const bgFill = calls.find(c => c.method === 'fillRect' && c.args[2] === CARD_WIDTH)
    expect(bgFill).toBeTruthy()
    const lastTextY = Math.max(...calls.filter(c => c.method === 'fillText').map(c => c.args[2] as number))
    expect(lastTextY).toBeLessThan(CARD_HEIGHT)
  })
})
