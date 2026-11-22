/**
 * 文本记忆「填空练习」纯逻辑：
 * - 正文切分为挖空单元：汉字逐字成单元、拉丁字母/数字连续段成词单元，标点/空白/换行为间隔单元
 * - 按难度比例从可挖空单元中随机挑选挖空（Fisher-Yates，注入 rng 便于测试复现）
 */

export type ClozeUnitType = 'char' | 'word' | 'sep'

export interface ClozeUnit {
  text: string
  type: ClozeUnitType
  /** 是否被挖空（间隔单元永不挖空） */
  blanked: boolean
}

/** CJK 统一表意文字（基本区 + 扩展 A） */
const CJK_RE = /[一-鿿㐀-䶿]/
/** 拉丁字母/数字（连续段聚合成一个「词」单元） */
const WORD_CHAR_RE = /[A-Za-z0-9]/

/** 把正文切分为有序单元（不含 blanked 标记） */
export function tokenizeForCloze(content: string): Array<Omit<ClozeUnit, 'blanked'>> {
  const units: Array<Omit<ClozeUnit, 'blanked'>> = []
  let wordBuf = ''
  const flushWord = () => {
    if (wordBuf) {
      units.push({ text: wordBuf, type: 'word' })
      wordBuf = ''
    }
  }
  for (const ch of content) {
    if (CJK_RE.test(ch)) {
      flushWord()
      units.push({ text: ch, type: 'char' })
    } else if (WORD_CHAR_RE.test(ch)) {
      wordBuf += ch
    } else {
      flushWord()
      units.push({ text: ch, type: 'sep' })
    }
  }
  flushWord()
  return units
}

/**
 * 构造挖空单元序列：
 * - rate 为挖空比例（0~1，越界自动钳制），作用于可挖空单元数，至少挖 1 个
 * - 无可挖空单元（纯标点/空内容）时不挖任何单元
 */
export function buildClozeUnits(
  content: string,
  rate: number,
  rng: () => number = Math.random,
): ClozeUnit[] {
  const units: ClozeUnit[] = tokenizeForCloze(content).map((u) => ({ ...u, blanked: false }))
  const candidates: number[] = []
  units.forEach((u, i) => { if (u.type !== 'sep') candidates.push(i) })
  if (!candidates.length) return units
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[candidates[i], candidates[j]] = [candidates[j], candidates[i]]
  }
  const clamped = Math.min(Math.max(rate, 0), 1)
  const count = Math.min(candidates.length, Math.max(1, Math.round(candidates.length * clamped)))
  for (const idx of candidates.slice(0, count)) units[idx].blanked = true
  return units
}
