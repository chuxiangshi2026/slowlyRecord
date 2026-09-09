/**
 * 拼写练习的等级口径：与主复习体系（useMobileWords 的 updateWordLevel，12 级标准）保持一致。
 * 拼写判对/判错只做 level 升降，remembered 判定（>= 12）沿用主体系，拼写模块不单独"毕业"单词。
 */

/** 主体系掌握阈值：达到 12 级才算永久记住 */
export const REMEMBER_LEVEL = 12

/** 判对后的新等级：每次 +1，封顶 12 级 */
export function nextLevelOnCorrect(level: number): number {
  return Math.min(REMEMBER_LEVEL, (level || 1) + 1)
}

/** 判错后的新等级：每次 -1，封底 0 级（与 store 的 0-12 钳制一致） */
export function nextLevelOnWrong(level: number): number {
  return Math.max(0, (level || 1) - 1)
}

/** 是否永久记住：与主体系一致，仅 12 级及以上 */
export function isRemembered(level: number): boolean {
  return level >= REMEMBER_LEVEL
}

export interface DictationEmptyInfo {
  /** 主文案 */
  text: string
  /** 词组/句子被正则过滤掉的条数（> 0 时应展示解释文案） */
  filteredOutCount: number
}

/**
 * 拼写练习空态文案：
 * - 范围内本来就没词 → "当前词库没有可练习的单词"
 * - 范围内的词全部被 ^[a-zA-Z]+$ 过滤（词组/句子）→ 明确告知原因与条数
 */
export function getEmptyState(rangeTotal: number, filteredOutCount: number): DictationEmptyInfo {
  if (rangeTotal === 0) {
    return { text: '当前词库没有可练习的单词', filteredOutCount: 0 }
  }
  return {
    text: '当前词库没有可练习的单词',
    filteredOutCount
  }
}

/** 词组/句子被过滤时的解释文案 */
export function getFilteredHint(filteredOutCount: number): string {
  return `当前词库的 ${filteredOutCount} 条内容为词组/句子，拼写练习仅支持英文单词`
}
