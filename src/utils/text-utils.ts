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

/**
 * 判断文本是否更像「句子」而非单词/词组
 * 用于录入分流：句子进句子库，否则进单词库
 * 命中任一规则即为句子（trim 后判断）：
 * - 以中英文句末标点结尾（。！？!?…）
 * - 内部含中英文句末/分句标点（。！？!?；;）→ 多句或复句
 * - 英文超过 6 个词
 * - 纯中文连续文本超过 20 字
 */
export function isSentenceLike(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  // 句末标点结尾（英文 "." 除外，避免缩写/词组带点误判）
  if (/[。！？!?…]$/.test(t)) return true;
  // 内部含句读标点
  if (/[。！？!?；;]/.test(t.slice(0, -1))) return true;
  const hasCjk = /[一-龥]/.test(t);
  if (hasCjk) {
    // 纯中文连续文本（无空格）超过 20 字
    return !/\s/.test(t) && t.length > 20;
  }
  // 英文：超过 6 个词视为句子
  return t.split(/\s+/).length > 6;
}

/**
 * 中英互译方向判定：按中文字符与拉丁字母数量对比（中文占多数→译英，否则→译中），
 * 避免中英混杂文本「含一个中文即整段译英」的误判（截图 OCR 结果常见中英混杂）
 */
export function resolveZhEnDirection(text: string): { from: 'zh' | 'en'; to: 'zh' | 'en' } {
  const cjk = (text.match(/[一-龥]/g) || []).length;
  const latin = (text.match(/[a-zA-Z]/g) || []).length;
  return cjk > latin ? { from: 'zh', to: 'en' } : { from: 'en', to: 'zh' };
}
