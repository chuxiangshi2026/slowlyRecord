import type { MobileItemType, Word, WordBankType } from '@/stores/useUtils/types'
import { inferMobileItemType, normalizeMobileItemText } from '@/stores/useUtils/text'
import bec from './wordbanks/bec'
import cet4 from './wordbanks/cet4'
import cet6 from './wordbanks/cet6'
import ielts from './wordbanks/ielts'
import kaogong from './wordbanks/kaogong'
import zsb from './wordbanks/zsb'
import newConcept from './wordbanks/newConcept'
import phrasalVerbs from './wordbanks/phrasal_verbs'
import collocations from './wordbanks/collocations'
import idioms from './wordbanks/idioms'
import commonPhrases from './wordbanks/common_phrases'
import oralBasic from './wordbanks/oral_basic'
import oralIntermediate from './wordbanks/oral_intermediate'
import oralAdvanced from './wordbanks/oral_advanced'

const data: Partial<Record<WordBankType, any[]>> = {
  bec,
  cet4,
  cet6,
  ielts,
  kaogong,
  zsb,
  newConcept,
  'phrasal-verbs': phrasalVerbs,
  collocations,
  idioms,
  'common-phrases': commonPhrases,
  'oral-basic': oralBasic,
  'oral-intermediate': oralIntermediate,
  'oral-advanced': oralAdvanced,
}

export const WORDBANK_B_IDS: WordBankType[] = ['bec', 'cet4', 'cet6', 'ielts', 'kaogong', 'zsb', 'newConcept', 'phrasal-verbs', 'collocations', 'idioms', 'common-phrases', 'oral-basic', 'oral-intermediate', 'oral-advanced']

function getBuiltinItemType(type: WordBankType, text: string): MobileItemType {
  if (type === 'collocations') return 'collocation'
  if (type === 'phrasal-verbs' || type === 'idioms') return 'phrase'
  if (type === 'common-phrases' || type.startsWith('oral-')) return 'sentence'
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
