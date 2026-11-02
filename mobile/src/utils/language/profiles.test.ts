import { describe, expect, it } from 'vitest'
import {
  getActiveLanguage,
  getActiveProfile,
  getProfile,
  isValidLanguage,
  listLanguages,
  setActiveLanguage,
} from './profiles'

describe('移动端语言配置', () => {
  it('提供与桌面端一致的五种语言', () => {
    expect(listLanguages().map(profile => profile.code)).toEqual(['en', 'ja', 'ru', 'es', 'fr'])
    expect(getProfile('ja').ttsLang).toBe('ja-JP')
    expect(getProfile('ru').script).toBe('cyrillic')
    expect(getProfile('fr').caseInsensitive).toBe(true)
  })

  it('非法语言回退英语', () => {
    expect(isValidLanguage('ja')).toBe(true)
    expect(isValidLanguage('xx')).toBe(false)
    expect(getProfile('xx').code).toBe('en')
    expect(getProfile().code).toBe('en')
  })

  it('当前语言可切换并回退', () => {
    setActiveLanguage('ja')
    expect(getActiveLanguage()).toBe('ja')
    expect(getActiveProfile().nameZh).toBe('日语')
    setActiveLanguage('invalid')
    expect(getActiveLanguage()).toBe('en')
  })
})
