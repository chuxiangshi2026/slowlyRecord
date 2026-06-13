import type { MobileItemType } from './types'

export function normalizeMobileItemText(text: string): string {
  return text.trim().replace(/\s+/g, ' ')
}

export function inferMobileItemType(text: string): MobileItemType {
  const normalized = normalizeMobileItemText(text)
  if (!normalized) return 'word'

  const wordCount = normalized.split(/\s+/).filter(Boolean).length
  if (wordCount <= 1) return 'word'
  if (/[.!?。！？]$/.test(normalized) || wordCount >= 7) return 'sentence'
  return 'phrase'
}
