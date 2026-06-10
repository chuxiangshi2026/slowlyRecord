/**
 * 文本规范化工具
 * 统一处理单词/词组文本的规范化逻辑
 */

import type { Word } from '@/types/words';

/**
 * 词组/固定搭配类型
 */
export type WordItemType = 'word' | 'phrase' | 'collocation';

/**
 * 规范化文本：去掉首尾空格，折叠中间连续空格为一个空格
 * 用于存储和显示，保留词组中的空格分隔
 */
export function normalizeItemText(text: string): string {
  return text.trim().replace(/\s+/g, ' ');
}

/**
 * 获取去重键：规范化 + 小写
 * 用于去重判断
 */
export function getItemKey(text: string): string {
  return normalizeItemText(text).toLowerCase();
}

/**
 * 紧凑文本：去掉所有空白字符
 * 仅用于单词语法分析（词缀/词根等），词组不应使用此函数
 */
export function compactText(text: string): string {
  return text.replace(/\s+/g, '');
}

/**
 * 判断是否是词组/搭配
 */
export function isPhrase(item: Pick<Word, 'itemType' | 'text'>): boolean {
  if (item.itemType === 'phrase' || item.itemType === 'collocation') {
    return true;
  }
  // 如果没有设置 itemType，但文本包含空格，也视为词组
  if (!item.itemType && item.text && item.text.includes(' ')) {
    return true;
  }
  return false;
}

/**
 * 获取词组包含的单词数
 */
export function getWordCount(text: string): number {
  const normalized = normalizeItemText(text);
  if (!normalized) return 0;
  return normalized.split(/\s+/).length;
}

/**
 * 检测文本是否包含多个单词（词组）
 */
export function isMultiWordText(text: string): boolean {
  return normalizeItemText(text).includes(' ');
}

/**
 * 自动推断 itemType：如果文本包含空格且没有显式设置类型，返回 'phrase'
 */
export function inferItemType(text: string, explicitType?: WordItemType): WordItemType {
  if (explicitType) return explicitType;
  if (isMultiWordText(text)) return 'phrase';
  return 'word';
}
