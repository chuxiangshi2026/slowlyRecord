export type { LanguageCode, LanguageProfile, ScriptType } from './types'
export { getLangCore, hasLangCore } from './core'
export type { LangCoreApi } from './core'
export {
  getProfile,
  listLanguages,
  isValidLanguage,
  setActiveLanguage,
  getActiveLanguage,
  getActiveProfile,
} from './profiles'
export {
  isWordText,
  tokenize,
  wordCount,
  isPhraseText,
  normalizeForCompare,
  compareWords,
  splitSpellUnits,
  isSpellChar,
  supportsSpelling,
} from './text'
