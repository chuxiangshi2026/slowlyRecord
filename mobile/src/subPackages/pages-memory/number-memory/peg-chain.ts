/**
 * 数字串 → 桩链（编码视图纯逻辑）
 *
 * 桩法记忆的核心：把长串数字切成两位一对，每对查桩图，串成一条图像链。
 * 例：13912345678 → 1|39|12|34|56|78 → 蜡烛→三角→椅儿→山寺→蜗牛→青蛙
 *
 * 切分约定：从左到右两两一对；奇数位时第一对是单个数字（手机号 11 位正好 1+5×2）。
 */

export interface PegLink {
  /** 这段数字（1-2 位） */
  number: string
  /** 桩描述（查不到桩时为空串） */
  description: string
}

/** 数字串切成两位一对（奇数位首段为单数字）；忽略非数字字符 */
export function splitIntoPairs(digits: string): string[] {
  const clean = digits.replace(/\D/g, '')
  if (!clean) return []
  const pairs: string[] = []
  let i = clean.length % 2 === 1 ? 1 : 0
  if (i === 1) pairs.push(clean[0])
  for (; i < clean.length; i += 2) pairs.push(clean.slice(i, i + 2))
  return pairs
}

/** 数字串 → 桩链。lookup 返回桩描述，查不到返回 undefined */
export function pegChainOf(digits: string, lookup: (num: string) => string | undefined): PegLink[] {
  return splitIntoPairs(digits).map((num) => {
    // 两位数字优先按原样查（'01'），查不到再查去零形式（'1'）
    const description = lookup(num) ?? lookup(num.replace(/^0/, '')) ?? ''
    return { number: num, description }
  })
}

/** 桩描述提取主名词：'雨伞（13 谐音）' → '雨伞' */
export function pegNounOf(description: string): string {
  return description.split('（')[0].split('(')[0].trim()
}

/** 桩链 → 一句话故事（主名词用箭头连接），无桩的段落用数字本身占位 */
export function chainToStory(chain: PegLink[]): string {
  return chain.map((link) => (link.description ? pegNounOf(link.description) : link.number)).join(' → ')
}
