/**
 * 默写对比：原文 vs 默写文本的逐字符差异（LCS 最长公共子序列对齐，
 * 与桌面端 src/views/TextMemory/components/PromptsDialog.vue 的算法一致，
 * 超规模输入退化为线性逐位对比兜底）。
 */

export interface CompareError {
  char: string
  position: number
}

export interface CompareMissing {
  char: string
  position: number
}

export interface CompareResult {
  /** 位置对齐但字符不匹配（写错的字） */
  errors: CompareError[]
  /** 原文有、默写漏掉的字 */
  missing: CompareMissing[]
  /** 默写多出的字 */
  extra: CompareError[]
  /** 正确率（0-100）：(总字数 - 错误 - 遗漏) / 总字数 */
  accuracy: number
  /** 原文总字数 */
  totalWords: number
}

/** LCS DP 单元数上限，超过则退化线性对比（内存保护） */
const LCS_COMPARE_MAX_CELLS = 1_000_000

function compareTextLinear(original: string, written: string): Omit<CompareResult, 'accuracy' | 'totalWords'> {
  const errors: CompareError[] = []
  const missing: CompareMissing[] = []
  const extra: CompareError[] = []
  const commonLength = Math.min(original.length, written.length)

  for (let i = 0; i < commonLength; i++) {
    if (original[i] !== written[i]) {
      errors.push({ char: written[i], position: i })
    }
  }
  for (let i = written.length; i < original.length; i++) {
    missing.push({ char: original[i], position: i })
  }
  for (let i = original.length; i < written.length; i++) {
    extra.push({ char: written[i], position: i })
  }
  return { errors, missing, extra }
}

function compareTextAligned(original: string, written: string): Omit<CompareResult, 'accuracy' | 'totalWords'> {
  const errors: CompareError[] = []
  const missing: CompareMissing[] = []
  const extra: CompareError[] = []

  const m = original.length
  const n = written.length
  if (m * n > LCS_COMPARE_MAX_CELLS) {
    return compareTextLinear(original, written)
  }
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0))

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (original[i - 1] === written[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1])
      }
    }
  }

  // 回溯找出两侧对齐位置
  let i = m
  let j = n
  const matchedOrig = new Set<number>()
  const matchedWrit = new Set<number>()
  while (i > 0 && j > 0) {
    if (original[i - 1] === written[j - 1]) {
      matchedOrig.add(i - 1)
      matchedWrit.add(j - 1)
      i--
      j--
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      i--
    } else {
      j--
    }
  }

  let origIdx = 0
  let writIdx = 0
  while (origIdx < m || writIdx < n) {
    const origMatched = matchedOrig.has(origIdx)
    const writMatched = matchedWrit.has(writIdx)
    if (origIdx < m && writIdx < n && origMatched && writMatched) {
      origIdx++
      writIdx++
    } else if (origIdx < m && !origMatched && writIdx < n && !writMatched) {
      // 都不匹配：错误字符
      errors.push({ char: written[writIdx], position: writIdx })
      origIdx++
      writIdx++
    } else if (origIdx < m && !origMatched) {
      // 原文有，默写没有：遗漏
      missing.push({ char: original[origIdx], position: origIdx })
      origIdx++
    } else if (writIdx < n && !writMatched) {
      // 默写有，原文没有：多余
      extra.push({ char: written[writIdx], position: writIdx })
      writIdx++
    } else {
      origIdx++
      writIdx++
    }
  }

  return { errors, missing, extra }
}

/** 对比原文与默写文本（忽略首尾空白；不做任何字符归一化，逐字严格对齐） */
export function compareText(original: string, written: string): CompareResult {
  const orig = (original || '').trim()
  const writ = (written || '').trim()
  const { errors, missing, extra } = compareTextAligned(orig, writ)
  const totalWords = orig.length
  const accuracy = totalWords > 0
    ? Math.max(0, Math.round(((totalWords - errors.length - missing.length) / totalWords) * 100))
    : 0
  return { errors, missing, extra, accuracy, totalWords }
}
