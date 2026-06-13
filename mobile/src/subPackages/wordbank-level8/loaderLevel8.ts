import type { Word, WordBankType } from '@/stores/useUtils/wordbank'
import { inferMobileItemType, normalizeMobileItemText } from '@/stores/useUtils/text'
import level8 from './wordbanks/level8'

const data: Partial<Record<WordBankType, any[]>> = { level8 }

export const WORDBANK_LEVEL8_IDS: WordBankType[] = ['level8']

export function loadWordBankLevel8(type: WordBankType): Word[] {
  const rawData = data[type]
  if (!rawData) throw new Error(`分包Level8中无词库: ${type}`)
  return (Array.isArray(rawData) ? rawData : []).map((w: any) => {
    const wordText = normalizeMobileItemText(w.word || '')
    return {
      word: wordText,
      meaning: w.meaning || w.explains || '',
      phonetic: w.phonetic,
      example: w.example,
      itemType: w.itemType || inferMobileItemType(wordText),
    }
  })
}
