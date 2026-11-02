import type { MobileItemType } from './types'
import { getProfile, wordCount as getLanguageWordCount, type LanguageCode } from '@/utils/language'

export function normalizeMobileItemText(text: string): string {
  return text.trim().replace(/\s+/g, ' ')
}

export function inferMobileItemType(text: string, language: LanguageCode = 'en'): MobileItemType {
  const normalized = normalizeMobileItemText(text)
  if (!normalized) return 'word'

  const profile = getProfile(language)
  if (profile.script === 'japanese' && /[。！？]$/.test(normalized)) return 'sentence'
  const wordCount = getLanguageWordCount(normalized, profile)
  if (wordCount <= 1) return 'word'
  if (/[.!?。！？]$/.test(normalized) || wordCount >= 7) return 'sentence'
  return 'phrase'
}
