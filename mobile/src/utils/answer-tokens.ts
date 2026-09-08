/**
 * 「点选拼答案」碎片工具（纯函数，双端可复用）
 *
 * 把答案字符串拆成 token 碎片并生成可点选的碎片格子：
 * - 连续英文子串按字符拆（每个字母一个 token）
 * - 数字/符号/汉字各为一个 token
 * 例如 `S=πr²` → [`S`, `=`, `π`, `r`, `²`]；
 * `2H₂+O₂=2H₂O` → [`2`, `H`, `₂`, `+`, `O`, `₂`, `=`, `2`, `H`, `₂`, `O`]
 */

/** 碎片格子：id 全局唯一，同一文本可重复出现（如 `₂` 出现两次） */
export interface AnswerTile {
  id: number
  text: string
}

/** 答案 token 化：每个字符即一个 token（英文按字符拆，数字/符号/汉字各一个） */
export function tokenizeAnswer(answer: string): string[] {
  if (!answer) return []
  return Array.from(answer)
}

/** Fisher-Yates 打乱（返回新数组） */
export function shuffleTiles<T>(arr: T[]): T[] {
  const result = [...arr]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

/**
 * 生成点选碎片格子：正确答案 token + 少量干扰碎片，整体打乱后编号
 *
 * @param correctTokens 正确答案 token 序列
 * @param distractorPool 干扰碎片候选池（会被归一化去重后随机抽取）
 * @param normalize 去重用的归一化函数（缺省按原样去重）
 * @param distractorCount 干扰碎片个数（候选不足时取全部）
 */
export function buildFragmentTiles(
  correctTokens: string[],
  distractorPool: string[],
  distractorCount: number,
  normalize: (s: string) => string = (s) => s,
): AnswerTile[] {
  const seen = new Set<string>()
  const pool: string[] = []
  for (const t of distractorPool) {
    if (!t) continue
    const key = normalize(t)
    if (seen.has(key)) continue
    seen.add(key)
    pool.push(t)
  }
  const picked = shuffleTiles(pool).slice(0, Math.max(0, distractorCount))
  const tokens = [...correctTokens, ...picked]
  return shuffleTiles(tokens.map((text, i) => ({ id: i, text })))
}
