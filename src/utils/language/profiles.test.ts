/**
 * 语言档案与激活语言管理单测
 */
import { beforeEach, describe, expect, it } from 'vitest'
import {
  getActiveLanguage,
  getActiveProfile,
  isValidLanguage,
  listLanguages,
  setActiveLanguage,
} from './profiles'

beforeEach(() => {
  setActiveLanguage(undefined) // 每个用例前重置为 en
})

describe('language/profiles', () => {
  it('listLanguages 返回五语言且档案字段完整', () => {
    const langs = listLanguages()
    expect(langs.map(l => l.code)).toEqual(['en', 'ja', 'ru', 'es', 'fr'])
    for (const p of langs) {
      expect(p.ttsLang).toMatch(/^[a-z]{2}-[A-Z]{2}$/)
      expect(p.edgeVoice.length).toBeGreaterThan(0)
      expect(['latin', 'cyrillic', 'japanese']).toContain(p.script)
      expect(typeof p.caseInsensitive).toBe('boolean')
      expect(p.ocrLang.length).toBeGreaterThan(0)
    }
  })

  it('各语言档案关键值（TTS/OCR/拼写策略）', () => {
    setActiveLanguage('ja')
    const ja = getActiveProfile()
    expect(ja.ttsLang).toBe('ja-JP')
    expect(ja.youdaoVoiceType).toBeNull() // 有道仅英语
    expect(ja.caseInsensitive).toBe(false)
    expect(ja.spellUnit).toBe('grapheme')
    expect(ja.ocrLang).toBe('jpn')
    expect(ja.hasLocalDict).toBe(false)

    setActiveLanguage('ru')
    expect(getActiveProfile().ocrLang).toBe('rus')
    expect(getActiveProfile().sortLocale).toBe('ru')

    setActiveLanguage('es')
    expect(getActiveProfile().ocrLang).toBe('spa')

    setActiveLanguage('fr')
    expect(getActiveProfile().ocrLang).toBe('fra')

    setActiveLanguage('en')
    expect(getActiveProfile().youdaoVoiceType).toBe(1)
    expect(getActiveProfile().hasAffixData).toBe(true)
    expect(getActiveProfile().hasLocalDict).toBe(true)
  })

  it('非法/空值回退 en', () => {
    setActiveLanguage('xx')
    expect(getActiveLanguage()).toBe('en')
    setActiveLanguage(null)
    expect(getActiveLanguage()).toBe('en')
    expect(isValidLanguage('es')).toBe(true)
    expect(isValidLanguage('de')).toBe(false)
  })

  it('大小写规范化：en 小写化、ja 保留原样（由 lang-core 承载，此处验证封装链路）', async () => {
    const { normalizeForCompare } = await import('./text')
    setActiveLanguage('en')
    expect(normalizeForCompare('Hello', getActiveProfile())).toBe('hello')
    setActiveLanguage('ja')
    expect(normalizeForCompare('カタカナ', getActiveProfile())).toBe('カタカナ')
  })
})
