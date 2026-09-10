/**
 * 数字记忆「自测练习」纯逻辑：
 * - 数字桩范围过滤（0-9 / 10-99 / 全部）
 * - 抽题：优先抽已到期的条目（轻量 SRS），到期抽完再抽未到期；一轮内不重复
 * - 复习调度复用共享的轻量 SRS（practice-srs.ts）
 */
import { isPracticeDue } from '../../../utils/practice-srs'
import type { MobileNumberAssociation, MobileNumberEntry } from '@/stores/useUtils/types'

/** 练习模式：数字桩自测 / 条目回忆 */
export type PracticeMode = 'pegs' | 'entries'

/** 数字桩范围 */
export type PegRange = 'single' | 'double' | 'all'

/** 一轮练习题数 */
export const ROUND_SIZE = 10

/** 范围内的候选数字桩编号（0-9 补零为两位数，与主页网格口径一致） */
export function pegNumbersOfRange(range: PegRange): string[] {
  const list: string[] = []
  if (range === 'single') {
    for (let i = 0; i <= 9; i++) list.push(String(i).padStart(2, '0'))
  } else if (range === 'double') {
    for (let i = 10; i <= 99; i++) list.push(String(i))
  } else {
    for (let i = 0; i <= 99; i++) list.push(String(i).padStart(2, '0'))
  }
  return list
}

/** 简单可注入随机源（测试可传确定性 rng） */
export type Rng = () => number

/**
 * 优先从到期条目里随机抽一个；没有到期再从全部里抽
 */
function pickByDue<T extends { nextReview?: number }>(
  pool: T[],
  rng: Rng,
): T | null {
  if (pool.length === 0) return null
  const due = pool.filter((item) => isPracticeDue(item.nextReview))
  const source = due.length > 0 ? due : pool
  return source[Math.floor(rng() * source.length)]
}

/**
 * 抽一道数字桩题：
 * - 先按范围过滤，再排除本轮已抽过的（exclude）
 * - 已抽完则清空 exclude 重新抽（条目数不足一轮时允许重复）
 */
export function pickPegQuestion(
  associations: MobileNumberAssociation[],
  range: PegRange,
  exclude: ReadonlySet<string>,
  rng: Rng = Math.random,
): MobileNumberAssociation | null {
  const inRange = new Set(pegNumbersOfRange(range))
  const inScope = associations.filter((a) => inRange.has(a.number))
  let candidates = inScope.filter((a) => !exclude.has(a.number))
  if (candidates.length === 0) candidates = inScope
  return pickByDue(candidates, rng)
}

/**
 * 抽一道数字条问题：优先未抽过的，抽完允许重复；到期优先
 */
export function pickEntryQuestion(
  entries: MobileNumberEntry[],
  exclude: ReadonlySet<string>,
  rng: Rng = Math.random,
): MobileNumberEntry | null {
  let candidates = entries.filter((e) => !exclude.has(e._id))
  if (candidates.length === 0) candidates = entries
  return pickByDue(candidates, rng)
}

export interface RoundSummary {
  total: number
  remembered: number
  forgotten: number
}

/** 汇总一轮自评结果 */
export function summarizeRound(results: boolean[]): RoundSummary {
  const remembered = results.filter(Boolean).length
  return {
    total: results.length,
    remembered,
    forgotten: results.length - remembered,
  }
}
