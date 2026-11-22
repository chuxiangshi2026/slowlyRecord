/**
 * 文本记忆「遮挡回忆」纯逻辑：
 * - 正文按行/按句分块（recall.vue 每块默认遮盖，点击揭示）
 * - 复习调度直接复用共享的轻量 SRS（practice-srs.ts），这里只做到期判定封装
 */
import { isPracticeDue } from '../../../utils/practice-srs'

/** 单行超过该长度时按句读再切分，避免一块过长 */
const MAX_BLOCK_LENGTH = 40

/** 句读切分点字符集（中文标点 + 英文句点/分号/问号/感叹号） */
const SENTENCE_END_CHARS = '。！？；，、.?!;'

/**
 * 按句读切分单行（不用 lookbehind，兼容 iOS<16.4 的 JavaScriptCore）：
 * 遇标点即切出片段，标点保留在片段尾部，余下非空片段也收集
 */
function splitSentences(line: string): string[] {
  const pieces: string[] = []
  let buffer = ''
  for (const ch of line) {
    buffer += ch
    if (SENTENCE_END_CHARS.includes(ch)) {
      pieces.push(buffer)
      buffer = ''
    }
  }
  if (buffer) pieces.push(buffer)
  return pieces
}

/**
 * 将正文切分为遮挡块：
 * 1. 按行拆分，跳过空行
 * 2. 超过 MAX_BLOCK_LENGTH 的行再按句读切分
 * 3. 仍超长的块按硬长度截断（兜底，正常文本极少走到）
 */
export function splitContentToBlocks(content: string): string[] {
  if (!content) return []
  const blocks: string[] = []
  const push = (piece: string) => {
    const text = piece.trim()
    if (text) blocks.push(text)
  }
  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim()
    if (!line) continue
    if (line.length <= MAX_BLOCK_LENGTH) {
      push(line)
      continue
    }
    const sentences = splitSentences(line).map((s) => s.trim()).filter(Boolean)
    let buffer = ''
    for (const sentence of sentences) {
      if (buffer && buffer.length + sentence.length > MAX_BLOCK_LENGTH) {
        push(buffer)
        buffer = ''
      }
      if (sentence.length > MAX_BLOCK_LENGTH) {
        // 单句仍超长：按硬长度截断
        for (let i = 0; i < sentence.length; i += MAX_BLOCK_LENGTH) {
          push(sentence.slice(i, i + MAX_BLOCK_LENGTH))
        }
      } else {
        buffer += sentence
      }
    }
    push(buffer)
  }
  return blocks
}

/** 文章是否到期待复习（nextReview 为空视为到期） */
export function isArticleDue(nextReview: number | undefined, now: number = Date.now()): boolean {
  return isPracticeDue(nextReview, now)
}

/** 带拼音的遮挡块（拼音与正文逐行对应） */
export interface AnnotatedBlock {
  text: string
  pinyin?: string
}

/**
 * 按行切分并逐行配对拼音（内置诗词导入时携带 pinyin 字段）：
 * - 有拼音时按整行成块（诗词行短，不再按句读细分），保证拼音行与正文行一一对应；
 *   空行两侧同步跳过，行数不一致时多余一侧截断、缺失一侧留空
 * - 无拼音时退化为 splitContentToBlocks 的结果（拼音字段留空）
 */
export function splitAnnotatedBlocks(content: string, pinyin?: string): AnnotatedBlock[] {
  if (!content) return []
  if (!pinyin || !pinyin.trim()) {
    return splitContentToBlocks(content).map((text) => ({ text }))
  }
  const contentLines = content.split('\n')
  const pinyinLines = pinyin.split('\n')
  const blocks: AnnotatedBlock[] = []
  const count = Math.max(contentLines.length, pinyinLines.length)
  for (let i = 0; i < count; i++) {
    const text = (contentLines[i] || '').trim()
    const py = (pinyinLines[i] || '').trim()
    // 空行两侧同步跳过（拼音行有内容而正文行为空时也跳过，避免悬空拼音）
    if (!text) continue
    blocks.push({ text, pinyin: py || undefined })
  }
  return blocks
}

/** 用于「首字提示」的标点/空白字符集（块内首字符为这些时顺延） */
const HINT_SKIP_CHARS = new Set(' \t，。！？；：、“”‘’《》〈〉（）【】…—·,.!?;:\'"()[]<>-')

/**
 * 首字提示：取块内第一个非标点非空白字符（如「床前明月光，」→「床」）。
 * 整块都是标点/空白时返回空串（调用方退化为完整遮盖）。
 */
export function firstCharHint(text: string): string {
  for (const ch of text) {
    if (!HINT_SKIP_CHARS.has(ch)) return ch
  }
  return ''
}
