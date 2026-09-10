/**
 * 文本记忆「遮挡回忆」纯逻辑：
 * - 正文按行/按句分块（recall.vue 每块默认遮盖，点击揭示）
 * - 复习调度直接复用共享的轻量 SRS（practice-srs.ts），这里只做到期判定封装
 */
import { isPracticeDue } from '../../../utils/practice-srs'

/** 单行超过该长度时按句读再切分，避免一块过长 */
const MAX_BLOCK_LENGTH = 40

/** 句读切分点（中文标点 + 英文句点/分号/问号/感叹号） */
const SENTENCE_END_RE = /(?<=[。！？；，、.?!;])/

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
    const sentences = line.split(SENTENCE_END_RE).map((s) => s.trim()).filter(Boolean)
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
