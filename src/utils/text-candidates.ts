import { getWordCount, normalizeItemText } from '@/utils/text-utils'

export interface TextCandidate {
  text: string
  itemType: 'word' | 'phrase'
}

interface Token {
  text: string
  lower: string
}

const TOKEN_REGEX = /[a-zA-Z0-9]+(?:[-'][a-zA-Z0-9]+)*/g

function tokenizeEnglish(text: string): Token[] {
  const matches = text.match(TOKEN_REGEX) || []
  return matches
    .filter(token => /[a-zA-Z]/.test(token))
    .map(token => ({ text: token, lower: token.toLowerCase() }))
}

function isShortStandalonePhrase(text: string, maxPhraseWords: number): boolean {
  const normalized = normalizeItemText(text)
  const count = getWordCount(normalized)
  if (count < 2 || count > maxPhraseWords) return false
  return /^[a-zA-Z0-9]+(?:[-'\s][a-zA-Z0-9]+)*$/.test(normalized)
}

function buildPhraseMap(phraseTexts: string[]): Map<string, string> {
  const map = new Map<string, string>()
  phraseTexts.forEach(text => {
    const normalized = normalizeItemText(text)
    if (getWordCount(normalized) < 2) return
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
): TextCandidate[] {
  const normalizedText = normalizeItemText(text)
  if (isShortStandalonePhrase(normalizedText, maxPhraseWords)) {
    return [{ text: normalizedText, itemType: 'phrase' }]
  }

  const tokens = tokenizeEnglish(text)
  const phraseMap = buildPhraseMap(phraseTexts)
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
