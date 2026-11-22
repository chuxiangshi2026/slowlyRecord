/**
 * 字母串 → 图像链（编码视图纯逻辑）
 *
 * 字母映射记忆的核心：把字母串切成字母/组合，每段查映射图，串成一条图像链。
 * 例：KFC → k|f|c → 钥匙🔑 → 花🌸 → 猫🐱；shop → sh|o|p → 鞋子👟 → 橙子🍊 → 桃子🍑
 *
 * 切分约定：从左到右贪婪最长匹配（组合优先于单字母）；忽略非字母字符。
 */
import { COMBO_LIST, type LetterSuggestion } from '@/utils/letter-preset'

export interface LetterLink {
  /** 这段字母（单字母或组合，小写） */
  letters: string
  /** 映射名（查不到映射时为空串） */
  name: string
  /** 映射 emoji（无则空串） */
  emoji: string
}

/** 组合按长度降序，保证贪婪匹配先长后短（igh/tch/dge 3 字母优先） */
const COMBOS_BY_LENGTH = [...COMBO_LIST].sort((a, b) => b.length - a.length)

/** 字母串切成字母/组合段（贪婪最长匹配，组合优先）；忽略非字母字符 */
export function splitLetters(text: string): string[] {
  const clean = text.toLowerCase().replace(/[^a-z]/g, '')
  const segments: string[] = []
  let i = 0
  while (i < clean.length) {
    const combo = COMBOS_BY_LENGTH.find((c) => clean.startsWith(c, i))
    if (combo) {
      segments.push(combo)
      i += combo.length
    } else {
      segments.push(clean[i])
      i += 1
    }
  }
  return segments
}

/** 字母串 → 图像链。lookup 返回映射，查不到返回 undefined */
export function letterChainOf(
  text: string,
  lookup: (letters: string) => LetterSuggestion | undefined,
): LetterLink[] {
  return splitLetters(text).map((letters) => {
    const s = lookup(letters)
    return { letters, name: s?.name ?? '', emoji: s?.emoji ?? '' }
  })
}

/** 图像链 → 一句话故事（映射名用箭头连接），无映射的段落用字母本身占位 */
export function chainToStory(chain: LetterLink[]): string {
  return chain.map((link) => link.name || link.letters).join(' → ')
}
