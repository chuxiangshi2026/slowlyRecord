import type { Word, WordBankType } from '@/stores/useUtils'
import toefl from './wordbanks/toefl'
import bec from './wordbanks/bec'
import cet4 from './wordbanks/cet4'
import cet6 from './wordbanks/cet6'
import ielts from './wordbanks/ielts'
import kaogong from './wordbanks/kaogong'
import zsb from './wordbanks/zsb'

const data: Partial<Record<WordBankType, any[]>> = { toefl, bec, cet4, cet6, ielts, kaogong, zsb }

export const WORDBANK_B_IDS: WordBankType[] = ['toefl', 'bec', 'cet4', 'cet6', 'ielts', 'kaogong', 'zsb']

export function loadWordBankB(type: WordBankType): Word[] {
  const rawData = data[type]
  if (!rawData) throw new Error(`分包B中无词库: ${type}`)
  return (Array.isArray(rawData) ? rawData : []).map((w: any) => ({
    word: w.word || '',
    meaning: w.meaning || w.explains || '',
    phonetic: w.phonetic,
    example: w.example,
  }))
}
