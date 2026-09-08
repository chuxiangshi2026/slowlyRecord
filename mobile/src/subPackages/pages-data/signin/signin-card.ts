/**
 * 打卡成就分享卡：纯逻辑模块（不依赖 uni API / DOM）
 *
 * 坐标计算、文案选择、点阵构建全部抽成纯函数，便于单测；
 * 页面侧拿到 canvas 2d context 后直接调用 drawSigninCard 绘制。
 */

/** 卡片逻辑尺寸（竖版分享图） */
export const CARD_WIDTH = 600
export const CARD_HEIGHT = 900

/** 打卡点状态：empty 未打卡 / signed 已打卡 / today 今天（必定已打卡） */
export type DotState = 'empty' | 'signed' | 'today'

/** 分享卡所需数据（由 buildCardInfo 组装） */
export interface ShareCardInfo {
  /** 顶部日期文案，如 2026年9月9日 星期三 */
  dateText: string
  /** 连续打卡天数 */
  streak: number
  /** 累计打卡天数 */
  total: number
  /** 月份标题，如 2026年9月 */
  monthLabel: string
  /** 本月打卡点阵（周日开头，7 列；null 为月首/月尾填充格） */
  dots: (DotState | null)[][]
  /** 鼓励文案 */
  encourage: string
}

/** 渐变对象（canvas 2d 的 CanvasGradient 最小子集） */
export interface ShareCardGradient {
  addColorStop(offset: number, color: string): void
}

/** 绘制用到的最小 context 接口（与小程序 canvas 2d / 测试 mock 兼容） */
export interface ShareCardCtx {
  fillStyle: string | ShareCardGradient
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
  createLinearGradient(x0: number, y0: number, x1: number, y1: number): ShareCardGradient
}

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

/** 本地时区日期 → YYYY-MM-DD（与 useSignin.formatDate 保持一致） */
function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** 按连续天数挑一句鼓励文案 */
export function getEncourageText(streak: number): string {
  if (streak >= 100) return '百日筑基，你就是坚持本身！'
  if (streak >= 30) return '一个月以上的坚持，习惯正在养成！'
  if (streak >= 14) return '连续两周不间断，自律给你自由！'
  if (streak >= 7) return '坚持一周以上，真的很棒！'
  if (streak >= 3) return '坚持就是胜利，你已经上路了！'
  return '好的开始，继续保持！'
}

/**
 * 组装分享卡数据
 * @param now 当前时间（用参数传入，便于测试固定日期）
 * @param signedDates 打卡日期数组（YYYY-MM-DD）
 * @param streak 连续打卡天数
 * @param total 累计打卡天数
 */
export function buildCardInfo(now: Date, signedDates: string[], streak: number, total: number): ShareCardInfo {
  const signedSet = new Set(signedDates)
  const todayStr = formatDate(now)

  // 本月点阵：周日开头 7 列，月首留空、月尾补齐整行
  const year = now.getFullYear()
  const month = now.getMonth()
  const dayCount = new Date(year, month + 1, 0).getDate()
  const firstWeekday = new Date(year, month, 1).getDay()
  const cells: (DotState | null)[] = []
  for (let i = 0; i < firstWeekday; i++) cells.push(null)
  for (let d = 1; d <= dayCount; d++) {
    const ds = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    if (ds === todayStr) cells.push('today')
    else cells.push(signedSet.has(ds) ? 'signed' : 'empty')
  }
  while (cells.length % 7 !== 0) cells.push(null)
  const dots: (DotState | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) dots.push(cells.slice(i, i + 7))

  return {
    dateText: `${year}年${month + 1}月${now.getDate()}日 星期${WEEKDAYS[now.getDay()]}`,
    streak,
    total,
    monthLabel: `${year}年${month + 1}月`,
    dots,
    encourage: getEncourageText(streak),
  }
}

/** 护眼绿配色（参 AGENTS.md：亮色主色 #52796f，基底 #eaf1ea 系） */
const COLOR = {
  bgTop: '#eef4ee',
  bgBottom: '#dbe7de',
  decor: '#ffffff',
  title: '#354f52',
  sub: '#7a8b84',
  primary: '#52796f',
  accent: '#83c5a8',
  encourage: '#3d5a4c',
  dotEmpty: '#c8d6cc',
  footer: '#8fa39a',
} as const

/**
 * 在 canvas 2d context 上绘制分享卡（逻辑坐标 600×900，调用前自行处理 dpr scale）
 */
export function drawSigninCard(ctx: ShareCardCtx, info: ShareCardInfo, w = CARD_WIDTH, h = CARD_HEIGHT) {
  const cx = w / 2

  // 背景：护眼绿竖向渐变 + 两个装饰圆
  const bg = ctx.createLinearGradient(0, 0, 0, h)
  bg.addColorStop(0, COLOR.bgTop)
  bg.addColorStop(1, COLOR.bgBottom)
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, w, h)

  ctx.globalAlpha = 0.45
  ctx.fillStyle = COLOR.decor
  ctx.beginPath()
  ctx.arc(w - 40, 40, 150, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(20, h - 60, 120, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalAlpha = 1

  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'

  // 顶部：卡片标题 + 今日日期
  ctx.fillStyle = COLOR.title
  ctx.font = 'bold 30px sans-serif'
  ctx.fillText('每日打卡 · 成就卡', cx, 88)
  ctx.fillStyle = COLOR.sub
  ctx.font = '22px sans-serif'
  ctx.fillText(info.dateText, cx, 126)

  // 标题与主体的分隔短线
  ctx.fillStyle = COLOR.accent
  ctx.fillRect(cx - 40, 148, 80, 4)

  // 连续打卡天数（大字主体）
  ctx.fillStyle = COLOR.primary
  ctx.font = '26px sans-serif'
  ctx.fillText('已连续打卡', cx, 228)
  ctx.font = `bold 150px sans-serif`
  const numText = String(info.streak)
  const numWidth = ctx.measureText(numText).width
  ctx.textAlign = 'left'
  ctx.fillText(numText, cx - numWidth / 2, 388)
  ctx.font = '40px sans-serif'
  ctx.fillText('天', cx + numWidth / 2 + 16, 388)
  ctx.textAlign = 'center'

  // 累计天数 + 鼓励文案
  ctx.fillStyle = COLOR.sub
  ctx.font = '22px sans-serif'
  ctx.fillText(`累计打卡 ${info.total} 天`, cx, 438)
  ctx.fillStyle = COLOR.encourage
  ctx.font = 'bold 24px sans-serif'
  ctx.fillText(info.encourage, cx, 492)

  // 本月打卡点阵
  ctx.fillStyle = COLOR.title
  ctx.font = 'bold 24px sans-serif'
  ctx.fillText(`${info.monthLabel} · 本月打卡`, cx, 550)

  const pitchX = 64
  const pitchY = 50
  const dotR = 11
  const gridW = 7 * pitchX
  const startX = cx - gridW / 2 + pitchX / 2
  const startY = 595
  for (let r = 0; r < info.dots.length; r++) {
    for (let c = 0; c < 7; c++) {
      const state = info.dots[r][c]
      if (!state) continue
      const x = startX + c * pitchX
      const y = startY + r * pitchY
      ctx.beginPath()
      ctx.arc(x, y, dotR, 0, Math.PI * 2)
      ctx.fillStyle = state === 'empty' ? COLOR.dotEmpty : COLOR.primary
      ctx.fill()
      if (state === 'today') {
        // 今天额外描一圈高亮环
        ctx.beginPath()
        ctx.arc(x, y, dotR + 5, 0, Math.PI * 2)
        ctx.strokeStyle = COLOR.accent
        ctx.lineWidth = 4
        ctx.stroke()
      }
    }
  }

  // 底部产品名
  ctx.fillStyle = COLOR.footer
  ctx.font = '18px sans-serif'
  ctx.fillText('慢记 · 基于艾宾浩斯遗忘曲线的记忆工具', cx, h - 26)
}
