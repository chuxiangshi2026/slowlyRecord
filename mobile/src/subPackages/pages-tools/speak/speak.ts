/**
 * AI 口语翻译/回复的输出解析（纯函数，可单测）
 * 约定 AI 输出两行：EN: <英文口语> / ZH: <中文意思>，解析对常见偏离做容错。
 */

/** 解析 AI 输出：优先 EN:/ZH: 标记，退化取首个非空行当英文 */
export function parseReply(text: string): { en: string; zh: string } {
  const en = text.match(/EN:\s*(.+)/i)?.[1]?.trim() || ''
  const zh = text.match(/ZH:\s*(.+)/i)?.[1]?.trim() || ''
  if (en) {
    return {
      // 模型把两行并到一行时，截掉 EN 里混入的 ZH: 尾巴；顺手去掉包裹引号
      en: en.replace(/\s*ZH:.*$/i, '').trim().replace(/^["']|["']$/g, ''),
      zh,
    }
  }
  // 无标记退化：取首个非空行当英文，第二行（若有）作中文
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
  return { en: (lines[0] || '').replace(/^["']|["']$/g, ''), zh: lines[1] || '' }
}
