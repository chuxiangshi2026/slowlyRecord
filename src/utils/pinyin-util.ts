/**
 * 文本记忆拼音工具
 *
 * 拼音数据约定：与 content 逐行对应，每个汉字一个带声调音节，
 * 标点紧跟在前一音节后；空行保留。与 content 行数不一致时按行号兜底。
 */

export interface AnnotatedLine {
  text: string;
  pinyin: string;
}

/** 把正文与拼音按行配对；没有拼音时返回空串，正文行数保持不变 */
export function splitAnnotatedLines(content: string, pinyin?: string): AnnotatedLine[] {
  const textLines = (content || '').split('\n');
  const pinyinLines = (pinyin || '').split('\n');
  return textLines.map((text, index) => ({
    text,
    pinyin: (pinyinLines[index] || '').trim(),
  }));
}

/** 是否带可用拼音 */
export function hasPinyin(pinyin?: string): boolean {
  return typeof pinyin === 'string' && pinyin.trim().length > 0;
}

/** 按空行分段：每段包含若干「正文 + 拼音」行，供打印/存图排版 */
export function splitAnnotatedParagraphs(content: string, pinyin?: string): AnnotatedLine[][] {
  const lines = splitAnnotatedLines(content, pinyin);
  const paragraphs: AnnotatedLine[][] = [];
  let current: AnnotatedLine[] = [];
  for (const line of lines) {
    if (!line.text.trim()) {
      if (current.length > 0) {
        paragraphs.push(current);
        current = [];
      }
      continue;
    }
    current.push(line);
  }
  if (current.length > 0) paragraphs.push(current);
  return paragraphs.length > 0 ? paragraphs : [[{ text: '', pinyin: '' }]];
}
