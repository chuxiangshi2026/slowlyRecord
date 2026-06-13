import type { MobileItemType, Word, WordBankType } from '@/stores/useUtils/types'
import { inferMobileItemType, normalizeMobileItemText } from '@/stores/useUtils/text'
import toefl from './wordbanks/toefl'
import bec from './wordbanks/bec'
import cet4 from './wordbanks/cet4'
import cet6 from './wordbanks/cet6'
import ielts from './wordbanks/ielts'
import kaogong from './wordbanks/kaogong'
import zsb from './wordbanks/zsb'
import nul from './wordbanks/nul'
import phrasalVerbs from './wordbanks/phrasal_verbs'
import collocations from './wordbanks/collocations'
import idioms from './wordbanks/idioms'

const data: Partial<Record<WordBankType, any[]>> = {
  toefl,
  bec,
  cet4,
  cet6,
  ielts,
  kaogong,
  zsb,
  nul,
  'phrasal-verbs': phrasalVerbs,
  collocations,
  idioms,
}

export const WORDBANK_B_IDS: WordBankType[] = ['toefl', 'bec', 'cet4', 'cet6', 'ielts', 'kaogong', 'zsb', 'nul', 'phrasal-verbs', 'collocations', 'idioms']

function getBuiltinItemType(type: WordBankType, text: string): MobileItemType {
  if (type === 'collocations') return 'collocation'
  if (type === 'phrasal-verbs' || type === 'idioms') return 'phrase'
  return inferMobileItemType(text)
}

export function loadWordBankB(type: WordBankType): Word[] {
  const rawData = data[type]
  if (!rawData) throw new Error(`分包B中无词库: ${type}`)
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
