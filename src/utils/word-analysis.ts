/**
 * 词根词缀解析工具
 * 用于解析单词的词根、前缀、后缀和子单词
 */

import type { AffixData } from './affix-data';
import { PREFIXES_DATA, SUFFIXES_DATA, ROOTS_DATA, COMPOUND_PARTS_DATA } from './affix-data';

/** 单词成分类型 */
export interface WordComponent {
  text: string;
  /** compound = 两个常见单词拼成的合成词，如 sea + sick */
  type: 'root' | 'prefix' | 'suffix' | 'subword' | 'compound' | 'whole';
  /** 释义数据 */
  data?: AffixData;
}

const COMPOUND_PART_MAP = new Map(COMPOUND_PARTS_DATA.map(part => [part.text, part]));
const SORTED_PREFIXES = [...PREFIXES_DATA].sort((a, b) => b.text.length - a.text.length);
const SORTED_SUFFIXES = [...SUFFIXES_DATA].sort((a, b) => b.text.length - a.text.length);
const SORTED_ROOTS = [...ROOTS_DATA].sort((a, b) => b.text.length - a.text.length);

function isExcluded(item: AffixData, lowerWord: string): boolean {
  return item.exclude?.includes(lowerWord) ?? false;
}

/** 词干是否以常见词根开头，或有明确示例支撑 */
function hasRootEvidence(stem: string, lowerWord: string): boolean {
  return SORTED_ROOTS.some(root => {
    if (root.text.length < 3 || isExcluded(root, lowerWord)) return false;
    const exampleBacked = root.examples?.some(example => example.toLowerCase() === lowerWord) ?? false;
    if (root.text.length === 3 && !exampleBacked) return false;
    return stem.startsWith(root.text) || (stem.includes(root.text) && exampleBacked);
  });
}

/** 合成词只在两个部件都是常见单词时成立，避免 season 被拆成 sea + son 这类误判 */
function findCompoundComponents(cleanedWord: string, lowerWord: string): WordComponent[] | null {
  if (!/^[a-z]{6,}$/.test(lowerWord)) return null;
  for (let split = 3; split <= lowerWord.length - 3; split++) {
    const left = lowerWord.slice(0, split);
    const right = lowerWord.slice(split);
    const leftData = COMPOUND_PART_MAP.get(left);
    const rightData = COMPOUND_PART_MAP.get(right);
    if (!leftData || !rightData) continue;
    return [
      { text: cleanedWord.slice(0, split), type: 'compound', data: { ...leftData, text: left } },
      { text: cleanedWord.slice(split), type: 'compound', data: { ...rightData, text: right } },
    ];
  }
  return null;
}

/** 短前缀是否有可靠词干支撑：整词在示例中，或词干以已知词根开头 / 以已知后缀结尾 */
function hasStemEvidence(lowerWord: string, stem: string, prefixData: AffixData): boolean {
  if (!prefixData.requiresStemEvidence) return true;
  if (prefixData.examples?.some(example => example.toLowerCase() === lowerWord)) return true;
  return hasRootEvidence(stem, lowerWord);
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

  // 1. 检测前缀：逐个评分，避免 contra 抢走 con + tract、extra 抢走 ex + tract
  let bestPrefix: { data: AffixData; score: number } | null = null;
  for (const prefixData of SORTED_PREFIXES) {
    const prefix = prefixData.text;
    if (isExcluded(prefixData, lowerWord)) continue;
    if (!remaining.startsWith(prefix) || remaining.length <= prefix.length + 1) continue;
    const stem = remaining.slice(prefix.length);
    if (stem.length < 2) continue;
    // 词首有更长的词根时优先按词根拆（biology 应该是 bio + logy，不是 bi + ology）
    if (SORTED_ROOTS.some(root =>
      root.text.length > prefix.length && !isExcluded(root, lowerWord) && remaining.startsWith(root.text)
    )) continue;
    if (!hasStemEvidence(lowerWord, stem, prefixData)) continue;
    // 两个字母的词干只接受有明确示例支撑的前缀（exit），避免 deep/deal/dear 被拆成 de + ep
    if (stem.length === 2 && !prefixData.examples?.some(example => example.toLowerCase() === lowerWord)) continue;

    let score = stem.length >= 3 ? 1 : 0;
    if (hasRootEvidence(stem, lowerWord)) score += 10;
    else if (SORTED_SUFFIXES.some(suffix => !isExcluded(suffix, lowerWord) && stem.endsWith(suffix.text))) score += 3;
    if (prefixData.examples?.some(example => example.toLowerCase() === lowerWord)) score += 5;
    score += prefix.length * 0.001;
    if (score > 0 && (!bestPrefix || score > bestPrefix.score)) bestPrefix = { data: prefixData, score };
  }

  let prefixFound = false;
  if (bestPrefix) {
    const prefixLength = bestPrefix.data.text.length;
    components.push({
      text: cleanedWord.slice(originalIndex, originalIndex + prefixLength),
      type: 'prefix',
      data: bestPrefix.data
    });
    remaining = remaining.slice(prefixLength);
    originalIndex += prefixLength;
    prefixFound = true;
  }

  // 1.5 没有前缀时，优先识别两个常见单词拼成的合成词（seasick → sea + sick）
  if (!prefixFound) {
    const compound = findCompoundComponents(cleanedWord, lowerWord);
    if (compound) return compound;
  }

  // 2. 检测后缀：把“不拆后缀”也作为一个候选，避免 -sion 吃掉 miss、-tion 吃掉 spect
  const suffixCandidates: (AffixData | null)[] = [null];
  for (const suffixItem of SORTED_SUFFIXES) {
    if (isExcluded(suffixItem, lowerWord)) continue;
    if (!remaining.endsWith(suffixItem.text) || remaining.length <= suffixItem.text.length + 1) continue;
    suffixCandidates.push(suffixItem);
  }
  // 有明确的派生后缀时，不再把词尾 s 当复数（obvious 不是 obviou + s）
  const hasDerivationalSuffix = suffixCandidates.some(item => item && item.text.length >= 3);

  let suffixData: AffixData | undefined;
  let suffixStartInRemaining = remaining.length;
  let bestSuffixScore = -1;
  for (const candidate of suffixCandidates) {
    if (candidate && hasDerivationalSuffix && candidate.text.length === 1) continue;
    const length = candidate ? candidate.text.length : 0;
    const middle = remaining.slice(0, remaining.length - length);
    if (middle.length < 2) continue;
    // 词干不足 3 个字母时，只允许更长的后缀（reliable → li + able，排除 bus → bu + s）
    if (middle.length < 3 && length < 3) continue;
    let score = middle.length >= 3 ? 1 : 0;
    if (hasRootEvidence(middle, lowerWord)) score += 10;
    if (candidate) score += 1.5 + length * 0.001;
    if (score > bestSuffixScore) {
      bestSuffixScore = score;
      suffixData = candidate ?? undefined;
      suffixStartInRemaining = middle.length;
    }
  }

  // 3. 提取中间部分（可能是词根+子单词的组合）
  const middlePart = remaining.slice(0, suffixStartInRemaining);

  if (middlePart.length > 0) {
    // 优先匹配词干开头的词根；没有开头词根时，再考虑有前缀或示例支撑的中间词根
    let chosenRoot: { data: AffixData; index: number } | null = null;
    for (const rootData of SORTED_ROOTS) {
      const root = rootData.text;
      if (root.length < 3 || isExcluded(rootData, lowerWord)) continue;
      if (root.length === 3 && !rootData.examples?.some(example => example.toLowerCase() === lowerWord)) continue;
      if (middlePart.startsWith(root)) {
        chosenRoot = { data: rootData, index: 0 };
        break;
      }
    }
    if (!chosenRoot) {
      for (const rootData of SORTED_ROOTS) {
        const root = rootData.text;
        if (root.length < 3 || isExcluded(rootData, lowerWord)) continue;
        if (root.length === 3 && !rootData.examples?.some(example => example.toLowerCase() === lowerWord)) continue;
        const index = middlePart.indexOf(root);
        if (index < 0) continue;
        const exampleBacked = rootData.examples?.some(example => example.toLowerCase() === lowerWord);
        if (prefixFound || exampleBacked) {
          chosenRoot = { data: rootData, index };
          break;
        }
      }
    }

    if (chosenRoot) {
      const { data: rootData, index: rootIndex } = chosenRoot;
      if (rootIndex > 0) {
        components.push({
          text: cleanedWord.slice(originalIndex, originalIndex + rootIndex),
          type: 'subword'
        });
      }
      components.push({
        text: cleanedWord.slice(originalIndex + rootIndex, originalIndex + rootIndex + rootData.text.length),
        type: 'root',
        data: rootData
      });
      if (rootIndex + rootData.text.length < middlePart.length) {
        components.push({
          text: cleanedWord.slice(originalIndex + rootIndex + rootData.text.length, originalIndex + suffixStartInRemaining),
          type: 'subword'
        });
      }
    } else {
      components.push({
        text: cleanedWord.slice(originalIndex, originalIndex + suffixStartInRemaining),
        type: 'subword'
      });
    }
  }

  // 4. 添加后缀
  if (suffixData) {
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
    compound: 'word-compound',
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
    compound: '合成词',
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
