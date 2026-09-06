/**
 * translation-lang-map 单测：各引擎语言代码映射与降级行为
 */
import { describe, expect, it } from 'vitest'
import { toEngineLang } from './translation-lang-map'

describe('translation-lang-map', () => {
  it('翻译引擎映射表', () => {
    expect(toEngineLang('youdao', 'ja')).toBe('ja')
    expect(toEngineLang('baidu', 'ja')).toBe('jp')
    expect(toEngineLang('baidu', 'fr')).toBe('fra')
    expect(toEngineLang('baidu', 'es')).toBe('spa')
    expect(toEngineLang('ali', 'ru')).toBe('ru')
    expect(toEngineLang('tencent', 'es')).toBe('es')
    expect(toEngineLang('youdao', 'en')).toBe('en')
  })

  it('OCR 代码表（百度 OCR 用大写专有代码）', () => {
    expect(toEngineLang('baidu', 'ja', 'ocr')).toBe('JAP')
    expect(toEngineLang('baidu', 'en', 'ocr')).toBe('ENG')
    expect(toEngineLang('youdao', 'fr', 'ocr')).toBe('fr')
    expect(toEngineLang('tencent', 'ja', 'ocr')).toBe('auto')
  })

  it('不支持的组合返回 null（调用方降级）', () => {
    // 注册表外的语言（如未来新增语言未登记）
    expect(toEngineLang('youdao', 'de' as any)).toBeNull()
    expect(toEngineLang('baidu', 'de' as any, 'ocr')).toBeNull()
  })

  it('未注册平台（AI 引擎）原样透传', () => {
    expect(toEngineLang('deepseek', 'ja')).toBe('ja')
    expect(toEngineLang('glm', 'ru')).toBe('ru')
    expect(toEngineLang('unknown-platform', 'fr', 'ocr')).toBe('fr')
  })
})
