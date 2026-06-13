import type { Word, WordBankType } from '@/stores/useUtils/wordbank'
import { inferMobileItemType, normalizeMobileItemText } from '@/stores/useUtils/text'
import gre from './wordbanks/gre'
import sat from './wordbanks/sat'
import level4 from './wordbanks/level4'

const data: Partial<Record<WordBankType, any[]>> = { gre, sat, level4 }

export const WORDBANK_C_IDS: WordBankType[] = ['gre', 'sat', 'level4']

export function loadWordBankC(type: WordBankType): Word[] {
  const rawData = data[type]
  if (!rawData) throw new Error(`分包C中无词库: ${type}`)
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
