/**
 * 词根词缀解析工具
 * 用于解析单词的词根、前缀、后缀和子单词
 */

import type { AffixData } from './affix-data';
import { PREFIXES_DATA, SUFFIXES_DATA, ROOTS_DATA } from './affix-data';

/** 单词成分类型 */
export interface WordComponent {
  text: string;
  type: 'root' | 'prefix' | 'suffix' | 'subword' | 'whole';
  /** 释义数据 */
  data?: AffixData;
}

/**
 * 解析单词成分
 * 将单词分解为前缀、词根、后缀和子单词
 * @param word 要解析的单词
 * @returns 单词成分数组
 */
export function analyzeWord(word: string): WordComponent[] {
  if (!word || word.length < 2) {
    return [{ text: word, type: 'whole' }];
  }

  // 清理单词中的空白字符（换行、回车、空格等），防止脏数据影响解析和显示
  const cleanedWord = word.replace(/\s+/g, '');
  const lowerWord = cleanedWord.toLowerCase();
  const components: WordComponent[] = [];

  let remaining = lowerWord;
  let originalIndex = 0;

  // 1. 检测前缀（按长度降序匹配，优先匹配长的）
  const sortedPrefixes = [...PREFIXES_DATA].sort((a, b) => b.text.length - a.text.length);
  for (const prefixData of sortedPrefixes) {
    const prefix = prefixData.text;
    if (remaining.startsWith(prefix) && remaining.length > prefix.length + 1) {
      components.push({
        text: cleanedWord.slice(originalIndex, originalIndex + prefix.length),
        type: 'prefix',
        data: prefixData
      });
      remaining = remaining.slice(prefix.length);
      originalIndex += prefix.length;
      break;
    }
  }

  // 2. 检测后缀
  let suffixText = '';
  let suffixData: AffixData | undefined;
  let suffixStartInRemaining = remaining.length;
  const sortedSuffixes = [...SUFFIXES_DATA].sort((a, b) => b.text.length - a.text.length);

  for (const suffixItem of sortedSuffixes) {
    const suffix = suffixItem.text;
    if (remaining.endsWith(suffix) && remaining.length > suffix.length + 1) {
      suffixText = suffix;
      suffixData = suffixItem;
      suffixStartInRemaining = remaining.length - suffix.length;
      break;
    }
  }

  // 3. 提取中间部分（可能是词根+子单词的组合）
  const middlePart = remaining.slice(0, suffixStartInRemaining);

  if (middlePart.length > 0) {
    // 尝试在中间部分找到词根
    let rootFound = false;
    const sortedRoots = [...ROOTS_DATA].sort((a, b) => b.text.length - a.text.length);

    for (const rootData of sortedRoots) {
      const root = rootData.text;
      const rootIndex = middlePart.indexOf(root);
      if (rootIndex !== -1 && root.length >= 2) {
        // 词根前的子单词
        if (rootIndex > 0) {
          components.push({
            text: cleanedWord.slice(originalIndex, originalIndex + rootIndex),
            type: 'subword'
          });
        }

        // 词根本身
        components.push({
          text: cleanedWord.slice(originalIndex + rootIndex, originalIndex + rootIndex + root.length),
          type: 'root',
          data: rootData
        });

        // 词根后的子单词
        if (rootIndex + root.length < middlePart.length) {
          components.push({
            text: cleanedWord.slice(originalIndex + rootIndex + root.length, originalIndex + suffixStartInRemaining),
            type: 'subword'
          });
        }

        rootFound = true;
        break;
      }
    }

    // 如果没有找到词根，整个中间部分作为子单词
    if (!rootFound) {
      components.push({
        text: cleanedWord.slice(originalIndex, originalIndex + suffixStartInRemaining),
        type: 'subword'
      });
    }
  }

  // 4. 添加后缀
  if (suffixText && suffixData) {
    components.push({
      text: cleanedWord.slice(originalIndex + suffixStartInRemaining),
      type: 'suffix',
      data: suffixData
    });
  }

  // 如果没有任何成分被识别，返回整个单词
  if (components.length === 0) {
    return [{ text: cleanedWord, type: 'whole' }];
  }

  return components;
}

/**
 * 获取单词组件的 CSS 类名
 * @param type 组件类型
 * @returns CSS 类名
 */
export function getComponentClass(type: WordComponent['type']): string {
  const classMap: Record<WordComponent['type'], string> = {
    root: 'word-root',
    prefix: 'word-prefix',
    suffix: 'word-suffix',
    subword: 'word-subword',
    whole: 'word-whole'
  };
  return classMap[type];
}

/**
 * 获取单词组件的中文描述
 * @param type 组件类型
 * @returns 中文描述
 */
export function getComponentLabel(type: WordComponent['type']): string {
  const labelMap: Record<WordComponent['type'], string> = {
    root: '词根',
    prefix: '前缀',
    suffix: '后缀',
    subword: '子单词',
    whole: '完整单词'
  };
  return labelMap[type];
}

/**
 * 生成详细的词根词缀提示信息
 * @param components 单词成分数组
 * @returns 格式化的提示文本
 */
export function generateDetailedTooltip(components: WordComponent[]): string {
  if (components.length <= 1) return '';

  const lines: string[] = [];

  for (const comp of components) {
    if (comp.type === 'whole' || comp.type === 'subword') continue;

    const label = getComponentLabel(comp.type);
    const text = comp.text.toLowerCase();

    if (comp.data) {
      // 有详细数据
      const meaning = comp.data.meaning;
      const desc = comp.data.description ? `(${comp.data.description})` : '';
      const examples = comp.data.examples ? `例: ${comp.data.examples.slice(0, 3).join(', ')}` : '';

      lines.push(`${label}「${text}」: ${meaning} ${desc}`);
      if (examples) {
        lines.push(`  ${examples}`);
      }
    } else {
      // 无详细数据，只显示类型
      lines.push(`${label}「${text}」`);
    }
  }

  return lines.join('\n');
}

/**
 * 生成简洁的词根词缀提示信息
 * @param components 单词成分数组
 * @returns 格式化的提示文本
 */
export function generateSimpleTooltip(components: WordComponent[]): string {
  if (components.length <= 1) return '';

  const parts = components
      .filter(c => c.type !== 'whole' && c.type !== 'subword' && c.data)
      .map(c => `${c.text}: ${c.data?.meaning}`);

  return parts.join(' | ');
}
