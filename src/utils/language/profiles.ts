/**
 * 语言配置档案（profiles）与当前激活语言管理
 *
 * 当前语言由 words store 在切换/初始化词库时通过 setActiveLanguage 同步，
 * 本模块不反向 import store，避免循环依赖。
 */
import { getLangCore, hasLangCore } from './core'
import type { LanguageCode, LanguageProfile } from './types'

const FALLBACK_CODES: LanguageCode[] = ['en', 'ja', 'ru', 'es', 'fr']

/** LangCore 未加载时的英语兜底档案（仅含通用字段） */
const EN_FALLBACK_PROFILE: LanguageProfile = {
  code: 'en', name: 'English', nameZh: '英语',
  ttsLang: 'en-US', edgeVoice: 'en-US-AnaNeural',
  youdaoVoiceType: 1, script: 'latin', sortLocale: 'en',
  caseInsensitive: true, spellUnit: 'letter',
  ocrLang: 'eng', hasAffixData: true, hasLocalDict: true,
}

function isKnownCode(lang: string): lang is LanguageCode {
  if (hasLangCore()) return getLangCore().isValidLang(lang)
  // LangCore 未加载（如纯 store 单测环境）时按已知语言列表兜底
  return (FALLBACK_CODES as string[]).includes(lang)
}

export function getProfile(lang: LanguageCode | string | undefined | null): LanguageProfile {
  if (!hasLangCore()) return EN_FALLBACK_PROFILE
  return getLangCore().getProfile(lang || 'en')
}

/** 全部语言列表（供 UI 下拉框使用） */
export function listLanguages(): LanguageProfile[] {
  return getLangCore().LANG_CODES.map(code => getLangCore().getProfile(code))
}

export function isValidLanguage(lang: string): lang is LanguageCode {
  return isKnownCode(lang)
}

// ---------- 当前激活语言（词库级，由 words store 驱动） ----------

let activeLanguage: LanguageCode = 'en'

/** 由 words store 在初始化/切换词库时调用；非法值一律回退 'en' */
export function setActiveLanguage(lang: string | undefined | null): void {
  activeLanguage = lang && isKnownCode(lang) ? lang : 'en'
}

export function getActiveLanguage(): LanguageCode {
  return activeLanguage
}

export function getActiveProfile(): LanguageProfile {
  return getProfile(activeLanguage)
}
