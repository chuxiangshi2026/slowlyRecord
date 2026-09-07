/**
 * public/lang-core.js 的 TS 侧访问层
 *
 * lang-core.js 是纯 JS 单一实现（Vue 主应用经 index.html <script> 加载，
 * focus.html 直接引用），本模块只负责类型化访问，不复制任何逻辑。
 */
import type { LanguageCode, LanguageProfile } from './types'

/** lang-core.js 暴露的全局 API（与 public/lang-core.js 保持一致） */
export interface LangCoreApi {
  DEFAULT_LANG: LanguageCode
  LANG_CODES: LanguageCode[]
  PROFILES: Record<LanguageCode, LanguageProfile>
  getProfile(lang: string): LanguageProfile
  isValidLang(lang: string): boolean
  isWordText(text: string, profile: LanguageProfile): boolean
  tokenize(text: string, profile: LanguageProfile): string[]
  wordCount(text: string, profile: LanguageProfile): number
  isPhraseText(text: string, profile: LanguageProfile): boolean
  normalizeForCompare(text: string, profile: LanguageProfile): string
  compareWords(a: string, b: string, profile: LanguageProfile): number
  splitSpellUnits(text: string, profile: LanguageProfile): string[]
  isSpellChar(ch: string, profile: LanguageProfile): boolean
  supportsSpelling(profile: LanguageProfile): boolean
}

/**
 * 获取 LangCore 全局对象；未加载时抛出带指引的错误
 */
export function getLangCore(): LangCoreApi {
  const core = (globalThis as { LangCore?: LangCoreApi }).LangCore
  if (!core) {
    throw new Error('[language] public/lang-core.js 未加载，请确认 index.html 已引入 <script src="lang-core.js">')
  }
  return core
}

/** LangCore 是否已就绪（用于需要静默降级的场景） */
export function hasLangCore(): boolean {
  return !!(globalThis as { LangCore?: LangCoreApi }).LangCore
}
