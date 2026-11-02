export type LanguageCode = 'en' | 'ja' | 'ru' | 'es' | 'fr'

export type ScriptType = 'latin' | 'cyrillic' | 'japanese'

export interface LanguageProfile {
  code: LanguageCode
  name: string
  nameZh: string
  ttsLang: string
  script: ScriptType
  sortLocale: string
  caseInsensitive: boolean
  spellUnit: 'letter' | 'grapheme'
}
