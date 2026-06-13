import type { MobileItemType, Word, WordBankType } from '@/stores/useUtils/types'
import { inferMobileItemType, normalizeMobileItemText } from '@/stores/useUtils/text'
import toefl from './wordbanks/toefl'
import roots from './wordbanks/roots'

const data: Partial<Record<WordBankType, any[]>> = {
  toefl,
  roots,
}

export const WORDBANK_D_IDS: WordBankType[] = ['toefl', 'roots']

function getBuiltinItemType(type: WordBankType, text: string): MobileItemType {
  if (type === 'roots') return 'word'
  return inferMobileItemType(text)
}

export function loadWordBankD(type: WordBankType): Word[] {
  const rawData = data[type]
  if (!rawData) throw new Error(`分包D中无词库: ${type}`)
  return (Array.isArray(rawData) ? rawData : []).map((w: any) => {
    const wordText = normalizeMobileItemText(w.word || '')
    return {
      word: wordText,
      meaning: w.meaning || w.explains || '',
      phonetic: w.phonetic,
      example: w.example,
      itemType: w.itemType || getBuiltinItemType(type, wordText),
    }
  })
}
