export type { LanguageCode, LanguageProfile, ScriptType } from './types'
export {
  DEFAULT_LANGUAGE,
  getProfile,
  listLanguages,
  isValidLanguage,
  setActiveLanguage,
  getActiveLanguage,
  getActiveProfile,
} from './profiles'
export {
  tokenize,
  isWordText,
  wordCount,
  isPhraseText,
  normalizeForCompare,
  splitSpellUnits,
} from './text'
