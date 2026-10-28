/**
 * 今日复习分享卡：纯逻辑模块（不依赖 uni API / DOM）
 *
 * 小程序首页与复习完成页共用；页面只负责拿 canvas 节点、按 dpr 放大后调用绘制。
 */

export const REVIEW_CARD_WIDTH = 600
export const REVIEW_CARD_HEIGHT = 800

export interface ReviewShareInfo {
  dateText: string
  /** 今日已复习词数 */
  reviewed: number
  /** 连续打卡天数 */
  streak: number
  /** 每日目标 */
  goal: number
  /** 词库总词数 */
  totalWords: number
  encourage: string
}

export interface ReviewCardGradient {
  addColorStop(offset: number, color: string): void
}

/** 与小程序 canvas 2d / 测试 mock 兼容的最小 context */
export interface ReviewCardCtx {
  fillStyle: string | ReviewCardGradient
  strokeStyle: string
  font: string
  textAlign: CanvasTextAlign
  textBaseline: CanvasTextBaseline
  lineWidth: number
  globalAlpha: number
  save(): void
  restore(): void
  scale(x: number, y: number): void
  beginPath(): void
  closePath(): void
  moveTo(x: number, y: number): void
  lineTo(x: number, y: number): void
  arc(x: number, y: number, r: number, startAngle: number, endAngle: number): void
  fill(): void
  stroke(): void
  fillRect(x: number, y: number, w: number, h: number): void
  fillText(text: string, x: number, y: number): void
  measureText(text: string): { width: number }
  createLinearGradient(x0: number, y0: number, x1: number, y1: number): ReviewCardGradient
}

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

export function getReviewEncourage(reviewed: number, streak: number, goal = 20): string {
  if (reviewed >= goal && goal > 0) return '今日目标达成，保持这个节奏！'
  if (streak >= 100) return '百日筑基，你就是坚持本身！'
  if (streak >= 30) return '一个月的坚持，习惯正在养成！'
  if (streak >= 7) return '连续一周以上，真的很棒！'
  if (reviewed > 0) return '今天已经迈出一步，继续加油！'
  return '打开慢记，从今天的第一组复习开始。'
}

export function buildReviewShareInfo(
  now: Date,
  reviewed: number,
  streak: number,
  goal: number,
  totalWords: number
): ReviewShareInfo {
  const safeReviewed = Math.max(0, Math.floor(reviewed || 0))
  const safeStreak = Math.max(0, Math.floor(streak || 0))
  const safeGoal = Math.max(0, Math.floor(goal || 0))
  return {
    dateText: `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 星期${WEEKDAYS[now.getDay()]}`,
    reviewed: safeReviewed,
    streak: safeStreak,
    goal: safeGoal,
    totalWords: Math.max(0, Math.floor(totalWords || 0)),
    encourage: getReviewEncourage(safeReviewed, safeStreak, safeGoal),
  }
}

const COLOR = {
  bgTop: '#eef4ee',
  bgBottom: '#dbe7de',
  decor: '#ffffff',
  title: '#354f52',
  sub: '#7a8b84',
  primary: '#52796f',
  accent: '#83c5a8',
  encourage: '#3d5a4c',
  track: '#c8d6cc',
  footer: '#8fa39a',
} as const

/**
 * 绘制 600×800 的今日复习卡（调用前由页面按 dpr scale）
 */
export function drawReviewCard(ctx: ReviewCardCtx, info: ReviewShareInfo, w = REVIEW_CARD_WIDTH, h = REVIEW_CARD_HEIGHT) {
  const cx = w / 2

  const bg = ctx.createLinearGradient(0, 0, 0, h)
  bg.addColorStop(0, COLOR.bgTop)
  bg.addColorStop(1, COLOR.bgBottom)
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, w, h)

  ctx.globalAlpha = 0.45
  ctx.fillStyle = COLOR.decor
  ctx.beginPath()
  ctx.arc(w - 30, 26, 150, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(10, h - 40, 110, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalAlpha = 1

  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'

  ctx.fillStyle = COLOR.title
  ctx.font = 'bold 30px sans-serif'
  ctx.fillText('今日复习 · 战绩卡', cx, 84)

  ctx.fillStyle = COLOR.sub
  ctx.font = '22px sans-serif'
  ctx.fillText(info.dateText, cx, 122)

  ctx.fillStyle = COLOR.accent
  ctx.fillRect(cx - 40, 144, 80, 4)

  ctx.fillStyle = COLOR.primary
  ctx.font = '26px sans-serif'
  ctx.fillText('今天复习了', cx, 226)

  ctx.font = 'bold 150px sans-serif'
  const numText = String(info.reviewed)
  const numWidth = ctx.measureText(numText).width
  ctx.textAlign = 'left'
  ctx.fillText(numText, cx - numWidth / 2, 386)
  ctx.textAlign = 'center'
  ctx.font = '40px sans-serif'
  ctx.fillText('词', cx + numWidth / 2 + 16, 386)

  ctx.fillStyle = COLOR.sub
  ctx.font = '22px sans-serif'
  ctx.fillText(`连续打卡 ${info.streak} 天`, cx, 442)

  // 今日目标进度条
  const barW = 360
  const barH = 18
  const barX = cx - barW / 2
  const barY = 494
  const ratio = info.goal > 0 ? Math.min(1, info.reviewed / info.goal) : 0
  ctx.fillStyle = COLOR.track
  ctx.beginPath()
  ctx.arc(barX + barH / 2, barY + barH / 2, barH / 2, Math.PI / 2, Math.PI * 1.5)
  ctx.fill()
  ctx.fillRect(barX + barH / 2, barY, barW - barH, barH)
  ctx.beginPath()
  ctx.arc(barX + barW - barH / 2, barY + barH / 2, barH / 2, Math.PI * 1.5, Math.PI / 2)
  ctx.fill()
  if (ratio > 0) {
    const fillW = Math.max(barH, barW * ratio)
    ctx.fillStyle = COLOR.primary
    ctx.beginPath()
    ctx.arc(barX + barH / 2, barY + barH / 2, barH / 2, Math.PI / 2, Math.PI * 1.5)
    ctx.fill()
    ctx.fillRect(barX + barH / 2, barY, Math.max(0, fillW - barH), barH)
    ctx.beginPath()
    ctx.arc(barX + fillW - barH / 2, barY + barH / 2, barH / 2, Math.PI * 1.5, Math.PI / 2)
    ctx.fill()
  }
  ctx.fillStyle = COLOR.sub
  ctx.font = '20px sans-serif'
  ctx.fillText(`今日目标 ${info.goal} 词 · 完成 ${Math.round(ratio * 100)}%`, cx, 542)

  ctx.fillStyle = COLOR.encourage
  ctx.font = 'bold 24px sans-serif'
  ctx.fillText(info.encourage, cx, 606)

  ctx.fillStyle = COLOR.sub
  ctx.font = '20px sans-serif'
  ctx.fillText(`词库共 ${info.totalWords} 词`, cx, 646)

  ctx.fillStyle = COLOR.footer
  ctx.font = '18px sans-serif'
  ctx.fillText('慢记 · 基于艾宾浩斯遗忘曲线的记忆工具', cx, h - 28)
}
