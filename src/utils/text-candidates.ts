import { getWordCount, normalizeItemText } from '@/utils/text-utils'
import { getActiveProfile } from '@/utils/language'
import { tokenize, wordCount } from '@/utils/language/text'
import type { LanguageProfile } from '@/utils/language'

export interface TextCandidate {
  text: string
  itemType: 'word' | 'phrase'
}

interface Token {
  text: string
  lower: string
}

/**
 * 按语言提取 token（拉丁/西里尔走 Unicode 正则，日语走 Intl.Segmenter）
 * 英语行为与原 TOKEN_REGEX 实现保持一致（回归基线见 text-candidates.test.ts）
 */
function tokenizeByProfile(text: string, profile: LanguageProfile): Token[] {
  const matches = tokenize(text, profile)
  return matches.map(token => ({ text: token, lower: token.toLowerCase() }))
}

function isShortStandalonePhrase(text: string, maxPhraseWords: number, profile: LanguageProfile): boolean {
  const normalized = normalizeItemText(text)
  const count = wordCount(normalized, profile)
  if (count < 2 || count > maxPhraseWords) return false
  // 日语无空格，短文本若为多词且在字符集内即视为词组；拉丁/西里尔沿用字符校验
  if (profile.script === 'japanese') {
    return count >= 2
  }
  return /^[\p{L}\p{M}0-9]+(?:[-'\s][\p{L}\p{M}0-9]+)*$/u.test(normalized)
}

function buildPhraseMap(phraseTexts: string[], profile: LanguageProfile): Map<string, string> {
  const map = new Map<string, string>()
  phraseTexts.forEach(text => {
    const normalized = normalizeItemText(text)
    if (wordCount(normalized, profile) < 2) return
    const key = normalized.toLowerCase()
    if (!map.has(key)) {
      map.set(key, normalized)
    }
  })
  return map
}

export function extractWordAndPhraseCandidates(
  text: string,
  phraseTexts: string[],
  maxPhraseWords = 6,
  profile: LanguageProfile = getActiveProfile(),
): TextCandidate[] {
  const normalizedText = normalizeItemText(text)
  if (isShortStandalonePhrase(normalizedText, maxPhraseWords, profile)) {
    return [{ text: normalizedText, itemType: 'phrase' }]
  }

  const tokens = tokenizeByProfile(text, profile)
  const phraseMap = buildPhraseMap(phraseTexts, profile)
  const result: TextCandidate[] = []
  const seen = new Set<string>()

  for (let i = 0; i < tokens.length;) {
    let matched: { text: string; length: number } | null = null
    const maxLen = Math.min(maxPhraseWords, tokens.length - i)

    for (let len = maxLen; len >= 2; len--) {
      const key = tokens.slice(i, i + len).map(token => token.lower).join(' ')
      if (phraseMap.has(key)) {
        matched = {
          text: tokens.slice(i, i + len).map(token => token.text).join(' '),
          length: len,
        }
        break
      }
    }

    if (matched) {
      const key = normalizeItemText(matched.text).toLowerCase()
      if (!seen.has(key)) {
        seen.add(key)
        result.push({ text: normalizeItemText(matched.text), itemType: 'phrase' })
      }
      i += matched.length
      continue
    }

    const token = tokens[i]
    if (!seen.has(token.lower)) {
      seen.add(token.lower)
      result.push({ text: token.text, itemType: 'word' })
    }
    i++
  }

  return result
}
