/**
 * 文本记忆多语言工具
 * 语言检测（启发式）与非中文文章的关键词提取。
 * 中文文章（language 缺省或 'zh'）不走本模块的分词逻辑，仍使用各组件内的中文实现。
 */

import { getProfile, isWordText, tokenize } from '@/utils/language';

/** 文章语言下拉选项（zh 为缺省语言） */
export const TEXT_LANGUAGE_OPTIONS: { code: string; label: string }[] = [
  { code: 'zh', label: '中文' },
  { code: 'en', label: 'English' },
  { code: 'ja', label: '日本語' },
  { code: 'ru', label: 'Русский' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
];

/** 规范化文章语言值：缺省/非法一律回退 'zh' */
export function normalizeArticleLanguage(language?: string | null): string {
  if (isSupportedArticleLanguage(language)) return language!;
  return 'zh';
}

/** 是否为受支持的文章语言值（用于元数据解析等"非法值需另行兜底"的场景） */
export function isSupportedArticleLanguage(language?: string | null): boolean {
  return !!language && TEXT_LANGUAGE_OPTIONS.some(o => o.code === language);
}

/** 取文章语言（缺省视为中文） */
export function getArticleLanguage(article?: { language?: string } | null): string {
  return normalizeArticleLanguage(article?.language);
}

/** 语言短标记（列表展示用，如 EN/JA；中文返回 '中'） */
export function getLanguageTag(language?: string | null): string {
  const lang = normalizeArticleLanguage(language);
  return lang === 'zh' ? '中' : lang.toUpperCase();
}

/**
 * 启发式检测文章语言：
 * 统计 CJK 汉字（\u4e00-\u9fa5）/日语假名/西里尔字母/拉丁字母的占比
 * - 假名占比 ≥15% → 'ja'（日文汉字与中文同码，靠假名区分）
 * - 汉字占比 ≥50% → 'zh'
 * - 西里尔字母占比 ≥30% 且多于拉丁 → 'ru'
 * - 其余含拉丁字母 → 'en'（西/法等拉丁语系不做细分，统一归 'en'）
 * - 无有效字符 → 'zh'
 */
export function detectTextLanguage(content: string): string {
  let han = 0;
  let kana = 0;
  let cyrillic = 0;
  let latin = 0;

  for (const ch of content) {
    const cp = ch.codePointAt(0)!;
    if (cp >= 0x4e00 && cp <= 0x9fa5) {
      han++;
    } else if (cp >= 0x3040 && cp <= 0x30ff) {
      kana++;
    } else if (cp >= 0x0400 && cp <= 0x04ff) {
      cyrillic++;
    } else if ((cp >= 0x41 && cp <= 0x5a) || (cp >= 0x61 && cp <= 0x7a)) {
      latin++;
    }
  }

  const total = han + kana + cyrillic + latin;
  if (total === 0) return 'zh';
  if (kana / total >= 0.15) return 'ja';
  if (han / total >= 0.5) return 'zh';
  if (cyrillic > latin && cyrillic / total >= 0.3) return 'ru';
  if (latin > 0) return 'en';
  return 'zh';
}

/** 带原文位置的关键词（供填空挖空使用） */
export interface ArticleKeyword {
  word: string;
  start: number;
  end: number;
  // 长度 ≥3 的词优先级更高（2）
  priority: number;
}

/**
 * 非中文文章关键词提取：按语言 profile 分词，取长度 ≥2 的实词。
 * 返回按原文顺序、互不重叠且带位置信息的关键词列表。
 */
export function extractForeignKeywords(content: string, language: string): ArticleKeyword[] {
  const profile = getProfile(language);
  const tokens = tokenize(content, profile);
  const keywords: ArticleKeyword[] = [];
  let searchFrom = 0;

  for (const token of tokens) {
    if (!token || token.length < 2) continue;
    // tokenize 只返回子串，按顺序定位即可获得原文位置
    const idx = content.indexOf(token, searchFrom);
    if (idx === -1) continue;
    searchFrom = idx + token.length;
    if (!isWordText(token, profile)) continue;
    keywords.push({
      word: token,
      start: idx,
      end: idx + token.length,
      priority: token.length >= 3 ? 2 : 1,
    });
  }

  return keywords;
}

/**
 * 关键词文本提取（预览/提示用）：中文走原有中文正则，其他语言走分词。
 * 返回去重后的前 maxCount 个词。
 */
export function extractKeywordTexts(content: string, language: string, maxCount = 5): string[] {
  if (normalizeArticleLanguage(language) === 'zh') {
    const words = content.match(/[\u4e00-\u9fa5]{2,4}/g) || [];
    return [...new Set(words)].slice(0, maxCount);
  }
  const seen = new Set<string>();
  const result: string[] = [];
  for (const keyword of extractForeignKeywords(content, language)) {
    const key = keyword.word.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(keyword.word);
    if (result.length >= maxCount) break;
  }
  return result;
}
