import type { Word, WordBankType } from '@/stores/useUtils'
import kaoyan from './wordbanks/kaoyan'
import gmat from './wordbanks/gmat'

const data: Partial<Record<WordBankType, any[]>> = { kaoyan, gmat }

export const WORDBANK_A_IDS: WordBankType[] = ['kaoyan', 'gmat']

export function loadWordBankA(type: WordBankType): Word[] {
  const rawData = data[type]
  if (!rawData) throw new Error(`分包A中无词库: ${type}`)
  return (Array.isArray(rawData) ? rawData : []).map((w: any) => ({
    word: w.word || '',
    meaning: w.meaning || w.explains || '',
    phonetic: w.phonetic,
    example: w.example,
  }))
}
