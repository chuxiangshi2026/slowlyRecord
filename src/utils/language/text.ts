/**
 * 多语言文本处理（分词/字符判定/比对/排序）
 * 全部委托给 public/lang-core.js 的单一实现，本文件仅提供类型化封装。
 */
import { getLangCore } from './core'
import type { LanguageProfile } from './types'

/** 判断文本是否可作为"单词/词条"收录（按语言字符集） */
export function isWordText(text: string, profile: LanguageProfile): boolean {
  return getLangCore().isWordText(text, profile)
}

/** 从文本提取候选词（保留原大小写） */
export function tokenize(text: string, profile: LanguageProfile): string[] {
  return getLangCore().tokenize(text, profile)
}

/** 词数（拉丁/西里尔按空格，日语按 Intl.Segmenter） */
export function wordCount(text: string, profile: LanguageProfile): number {
  return getLangCore().wordCount(text, profile)
}

/** 是否词组 */
export function isPhraseText(text: string, profile: LanguageProfile): boolean {
  return getLangCore().isPhraseText(text, profile)
}

/** 比对用规范化：NFC + 折叠空格 + 按语言决定是否小写化 */
export function normalizeForCompare(text: string, profile: LanguageProfile): string {
  return getLangCore().normalizeForCompare(text, profile)
}

/** 按语言排序 */
export function compareWords(a: string, b: string, profile: LanguageProfile): number {
  return getLangCore().compareWords(a, b, profile)
}

/** 听写/拼写切分单位（letter / grapheme） */
export function splitSpellUnits(text: string, profile: LanguageProfile): string[] {
  return getLangCore().splitSpellUnits(text, profile)
}

/** 拼写模式单键是否有效（英语保持 a-zA-Z 行为不变） */
export function isSpellChar(ch: string, profile: LanguageProfile): boolean {
  return getLangCore().isSpellChar(ch, profile)
}

/** 该语言是否支持拼写模式（日语不支持，IME 无法逐键拦截） */
export function supportsSpelling(profile: LanguageProfile): boolean {
  return getLangCore().supportsSpelling(profile)
}
