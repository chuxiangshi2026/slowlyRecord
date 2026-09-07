/**
 * 多语言核心类型定义
 * 与 public/lang-core.js 中的 PROFILES 结构一一对应（运行时数据以 lang-core.js 为唯一来源）
 */

export type LanguageCode = 'en' | 'ja' | 'ru' | 'es' | 'fr'

export type ScriptType = 'latin' | 'cyrillic' | 'japanese'

export interface LanguageProfile {
  code: LanguageCode
  /** 语言本名，如 '日本語' */
  name: string
  /** 中文名，如 '日语' */
  nameZh: string
  /** TTS 语言标签（Web Speech / Edge TTS / SSML xml:lang） */
  ttsLang: string
  /** Edge TTS 优选语音 */
  edgeVoice: string
  /** 有道 dictvoice 发音 type 参数；null 表示有道不支持该语言发音 */
  youdaoVoiceType: 1 | 2 | null
  /** 书写系统，决定分词与字符判定策略 */
  script: ScriptType
  /** 排序 locale */
  sortLocale: string
  /** 比对时是否忽略大小写（日语无大小写） */
  caseInsensitive: boolean
  /** 听写/拼写的最小切分单位 */
  spellUnit: 'letter' | 'grapheme'
  /** Tesseract OCR 语言数据名 */
  ocrLang: string
  /** 是否有词根词缀数据 */
  hasAffixData: boolean
  /** 是否有本地词典 */
  hasLocalDict: boolean
}
