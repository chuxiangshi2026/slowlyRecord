/**
 * 记忆宫殿纯函数工具（移动端查看版）
 *
 * 移植自桌面端 src/utils/memory-palace-db.ts 的同步合并逻辑、
 * src/utils/memory-palace-srs.ts 的 SRS 与 src/utils/memory-palace-util.ts 的切块/解析，
 * 供 useMemoryPalace store 与页面使用（查看 + 巡视复习，不做编辑）。
 */
import { DEFAULT_INTERVALS } from '@/stores/useUtils/constants'
import type {
  MobilePalace,
  MobilePegItem,
  MobileTextArticle,
} from '@/stores/useUtils/types'

/** level 上限 */
export const MAX_LEVEL = 12

/** 掌握阈值 */
export const MASTERED_LEVEL = 12

/** 新挂载默认等级（未自评过时按 0 处理） */
export const DEFAULT_LEVEL = 0

/** 将等级限制在 [0, MAX_LEVEL] */
export function clampLevel(level: number): number {
  if (level < 0) return 0
  if (level > MAX_LEVEL) return MAX_LEVEL
  return level
}

/** 获取挂载的有效等级 */
export function getPegLevel(peg: MobilePegItem): number {
  return typeof peg.level === 'number' ? clampLevel(peg.level) : DEFAULT_LEVEL
}

/** 判断挂载是否已记住（满级） */
export function isPegMastered(peg: MobilePegItem): boolean {
  return getPegLevel(peg) >= MASTERED_LEVEL
}

/** 判断挂载是否到期需要复习（未自评过立即到期） */
export function isPegDue(peg: MobilePegItem, now: number): boolean {
  if (!peg.learnDate) return true
  const level = getPegLevel(peg)
  const intervalMinutes = DEFAULT_INTERVALS[level] ?? DEFAULT_INTERVALS[0]
  return now - peg.learnDate >= intervalMinutes * 60 * 1000
}

/** 是否在可升级时间窗口内（未学过允许升级） */
function canLevelUp(learnDate: number | undefined, level: number, now: number): boolean {
  if (!learnDate) return true
  const start = learnDate + (DEFAULT_INTERVALS[level] ?? DEFAULT_INTERVALS[0]) * 60 * 1000
  const end = learnDate + DEFAULT_INTERVALS[Math.min(level + 3, DEFAULT_INTERVALS.length - 1)] * 60 * 1000
  return now > start && now < end
}

/**
 * 自评"记住"后更新 SRS 状态
 * 在升级窗口内按记忆牢固度升 1~3 级（'较强' +2、'极强' +3，其余 +1），封顶 12；
 * 未到期或超窗只刷新 learnDate
 */
export function markPegRemembered(peg: MobilePegItem, now: number, firmness?: string): MobilePegItem {
  const level = getPegLevel(peg)
  if (canLevelUp(peg.learnDate, level, now)) {
    let increment = 1
    if (firmness === '较强') increment = 2
    else if (firmness === '极强') increment = 3
    return { ...peg, level: Math.min(level + increment, MAX_LEVEL), learnDate: now }
  }
  return { ...peg, learnDate: now }
}

/** 自评"忘记"后更新 SRS：12 级重置为 1 级，否则降 1 级（下限 1） */
export function markPegForgotten(peg: MobilePegItem, now: number): MobilePegItem {
  const level = getPegLevel(peg)
  return { ...peg, level: level >= MASTERED_LEVEL ? 1 : Math.max(level - 1, 1), learnDate: now }
}

// ==================== 同步合并（与桌面端同语义） ====================

/**
 * 合并两个宫殿（同 _id）：utime 较新者覆盖；
 * 覆盖方缺失的图片字段保留被覆盖方的本地图片（同步剔除大图后不留白）
 */
export function mergePalace(local: MobilePalace, remote: MobilePalace): MobilePalace {
  const remoteWins = (remote.utime || 0) >= (local.utime || 0)
  const winner: MobilePalace = JSON.parse(JSON.stringify(remoteWins ? remote : local))
  const fallback = remoteWins ? local : remote
  for (const locus of winner.loci) {
    if (!locus.imageUrl) {
      const fb = fallback.loci.find(l => l.order === locus.order)
      if (fb?.imageUrl) locus.imageUrl = fb.imageUrl
    }
  }
  if (!winner.overviewImage && fallback.overviewImage) {
    winner.overviewImage = fallback.overviewImage
  }
  return winner
}

/** 合并宫殿列表：按 _id 匹配，utime 较新者覆盖（图片字段双向兜底） */
export function mergePalaceList(local: MobilePalace[], remote: MobilePalace[]): MobilePalace[] {
  const map = new Map<string, MobilePalace>()
  for (const palace of local) map.set(palace._id, palace)
  for (const palace of remote) {
    const existing = map.get(palace._id)
    map.set(palace._id, existing ? mergePalace(existing, palace) : palace)
  }
  return Array.from(map.values())
}

/**
 * 合并单个宫殿的桩挂载：按 locusOrder 匹配（一桩一挂载），
 * learnDate 较新者保留（双端都可能巡视自评，不丢进度）
 */
export function mergePegItemList(local: MobilePegItem[], remote: MobilePegItem[]): MobilePegItem[] {
  const map = new Map<number, MobilePegItem>()
  for (const peg of local) map.set(peg.locusOrder, peg)
  for (const peg of remote) {
    const existing = map.get(peg.locusOrder)
    if (!existing || (peg.learnDate || 0) >= (existing.learnDate || 0)) {
      map.set(peg.locusOrder, peg)
    }
  }
  return Array.from(map.values()).sort((a, b) => a.locusOrder - b.locusOrder)
}

// ==================== 文章切块与挂载解析 ====================

// 句末标点（中英文）；小数点（前后都是数字）不切分
const SENTENCE_ENDINGS = /(?:\d+\.\d+|[^.。！？；!?\n])+[.。！？；!?]*/g

/** 把文章内容切成块（sentence 按句 / paragraph 按段），移植自桌面端 */
export function chunkArticleContent(content: string, mode: 'sentence' | 'paragraph'): string[] {
  if (!content || !content.trim()) return []
  if (mode === 'paragraph') {
    return content.split(/\n+/).map(p => p.trim()).filter(p => p.length > 0)
  }
  const matches = content.match(SENTENCE_ENDINGS)
  if (!matches) return []
  return matches.map(s => s.trim()).filter(s => s.length > 0)
}

export interface ResolvedPegContent {
  /** 展示文本（空串表示无内容） */
  text: string
  /** 引用源是否已删除（文章不存在或切块越界） */
  deleted: boolean
  /** 引用文章标题（自由文本时为空） */
  articleTitle?: string
}

/**
 * 解析桩挂载的展示内容
 * 引用文章不存在或切块越界时返回 deleted=true（不抛错）
 */
export function resolvePegContent(peg: MobilePegItem, articles: MobileTextArticle[]): ResolvedPegContent {
  if (peg.contentRef?.type === 'text-article') {
    const article = articles.find(a => a._id === peg.contentRef!.articleId)
    if (!article) {
      return { text: '', deleted: true }
    }
    const chunks = chunkArticleContent(article.content, peg.contentRef.mode ?? 'sentence')
    const chunk = chunks[peg.contentRef.chunkIndex]
    if (chunk === undefined) {
      return { text: '', deleted: true, articleTitle: article.title }
    }
    return { text: chunk, deleted: false, articleTitle: article.title }
  }
  return { text: peg.freeText ?? '', deleted: false }
}
