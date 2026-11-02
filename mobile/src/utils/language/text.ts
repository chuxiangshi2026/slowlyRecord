import type { LanguageProfile } from './types'

const LETTER_TOKEN_RE = /[\p{L}\p{M}0-9]+(?:[-'][\p{L}\p{M}0-9]+)*/gu
const CJK_RE = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u
const JA_WORD_RE = /^[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}A-Za-z0-9ー・]+$/u
const JA_RUN_RE = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}ー]+[0-9]*/gu
const JA_SMALL_KANA_RE = /^[ぁぃぅぇぉゃゅょゎァィゥェォャュョヮ]$/

const segmenters: Record<string, any> = {}

function getSegmenter(lang: string, granularity: 'word' | 'grapheme'): any {
  if (typeof Intl === 'undefined' || typeof (Intl as any).Segmenter !== 'function') return null
  const key = `${lang}|${granularity}`
  if (!(key in segmenters)) {
    try {
      segmenters[key] = new (Intl as any).Segmenter(lang, { granularity })
    } catch {
      segmenters[key] = null
    }
  }
  return segmenters[key]
}

export function tokenize(text: string, profile: LanguageProfile): string[] {
  if (!text) return []
  if (profile.script === 'japanese') {
    const segmenter = getSegmenter(profile.sortLocale, 'word')
    if (segmenter) {
      const result: string[] = []
      for (const item of segmenter.segment(text)) {
        if (item.isWordLike) result.push(item.segment)
      }
      return result
    }
    return text.match(JA_RUN_RE) || []
  }
  return (text.match(LETTER_TOKEN_RE) || []).filter(token => /[\p{L}]/u.test(token))
}

export function isWordText(text: string, profile: LanguageProfile): boolean {
  if (!text) return false
  const value = text.trim()
  if (!value) return false
  if (profile.script === 'japanese') {
    if (/\s/.test(value) || !CJK_RE.test(value)) return false
    return JA_WORD_RE.test(value)
  }
  if (CJK_RE.test(value) || !/[\p{L}]/u.test(value)) return false
  return /^[\p{L}\p{M}0-9]+(?:[-'\s][\p{L}\p{M}0-9]+)*$/u.test(value)
}

export function wordCount(text: string, profile: LanguageProfile): number {
  if (!text) return 0
  const normalized = text.trim().replace(/\s+/g, ' ')
  if (!normalized) return 0
  if (profile.script === 'japanese') return tokenize(normalized, profile).length
  return normalized.split(/\s+/).length
}

export function isPhraseText(text: string, profile: LanguageProfile): boolean {
  if (!text) return false
  if (profile.script === 'japanese') {
    if (/\s/.test(text.trim())) return true
    return wordCount(text, profile) > 1
  }
  return text.trim().replace(/\s+/g, ' ').includes(' ')
}

export function normalizeForCompare(text: string, profile: LanguageProfile): string {
  if (!text) return ''
  const normalized = (text.normalize ? text.normalize('NFC') : text).trim().replace(/\s+/g, ' ')
  return profile.caseInsensitive ? normalized.toLowerCase() : normalized
}

export function splitSpellUnits(text: string, profile: LanguageProfile): string[] {
  if (!text) return []
  if (profile.spellUnit !== 'grapheme') return Array.from(text)

  const segmenter = getSegmenter(profile.sortLocale, 'grapheme')
  const raw = segmenter
    ? Array.from(segmenter.segment(text), (item: any) => item.segment)
    : Array.from(text)
  const merged: string[] = []
  for (const unit of raw) {
    if (merged.length > 0 && JA_SMALL_KANA_RE.test(unit)) {
      merged[merged.length - 1] += unit
    } else {
      merged.push(unit)
    }
  }
  return merged
}
