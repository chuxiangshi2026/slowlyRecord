import type { LanguageCode, LanguageProfile } from './types'

export const DEFAULT_LANGUAGE: LanguageCode = 'en'

const PROFILES: Record<LanguageCode, LanguageProfile> = {
  en: {
    code: 'en', name: 'English', nameZh: '英语', ttsLang: 'en-US',
    script: 'latin', sortLocale: 'en', caseInsensitive: true, spellUnit: 'letter',
  },
  ja: {
    code: 'ja', name: '日本語', nameZh: '日语', ttsLang: 'ja-JP',
    script: 'japanese', sortLocale: 'ja', caseInsensitive: false, spellUnit: 'grapheme',
  },
  ru: {
    code: 'ru', name: 'Русский', nameZh: '俄语', ttsLang: 'ru-RU',
    script: 'cyrillic', sortLocale: 'ru', caseInsensitive: true, spellUnit: 'letter',
  },
  es: {
    code: 'es', name: 'Español', nameZh: '西班牙语', ttsLang: 'es-ES',
    script: 'latin', sortLocale: 'es', caseInsensitive: true, spellUnit: 'letter',
  },
  fr: {
    code: 'fr', name: 'Français', nameZh: '法语', ttsLang: 'fr-FR',
    script: 'latin', sortLocale: 'fr', caseInsensitive: true, spellUnit: 'letter',
  },
}

const LANG_CODES: LanguageCode[] = ['en', 'ja', 'ru', 'es', 'fr']

export function isValidLanguage(lang: string | undefined | null): lang is LanguageCode {
  return !!lang && Object.prototype.hasOwnProperty.call(PROFILES, lang)
}

export function getProfile(lang?: string | null): LanguageProfile {
  return isValidLanguage(lang) ? PROFILES[lang] : PROFILES[DEFAULT_LANGUAGE]
}

export function listLanguages(): LanguageProfile[] {
  return LANG_CODES.map(code => PROFILES[code])
}

let activeLanguage: LanguageCode = DEFAULT_LANGUAGE

export function setActiveLanguage(lang?: string | null): void {
  activeLanguage = isValidLanguage(lang) ? lang : DEFAULT_LANGUAGE
}

export function getActiveLanguage(): LanguageCode {
  return activeLanguage
}

export function getActiveProfile(): LanguageProfile {
  return getProfile(activeLanguage)
}
