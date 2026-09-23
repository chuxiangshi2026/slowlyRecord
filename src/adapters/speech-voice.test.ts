/**
 * speech-voice 纯函数单测
 */
import { describe, it, expect } from 'vitest'
import { normalizeVoiceLang, scoreVoiceForLang, selectBestVoice, type SpeechVoiceLike } from './speech-voice'

const v = (name: string, lang: string, localService = false, isDefault = false): SpeechVoiceLike => ({
  name, lang, localService, default: isDefault,
})

describe('normalizeVoiceLang', () => {
  it('小写化并把下划线转横线', () => {
    expect(normalizeVoiceLang('zh_CN')).toBe('zh-cn')
    expect(normalizeVoiceLang('EN-us')).toBe('en-us')
    expect(normalizeVoiceLang('')).toBe('')
    expect(normalizeVoiceLang(undefined)).toBe('')
  })
})

describe('scoreVoiceForLang', () => {
  it('语种不符直接淘汰', () => {
    expect(scoreVoiceForLang(v('Google 普通话', 'zh-CN'), 'en-US')).toBe(-1)
    expect(scoreVoiceForLang(v('Google US English', 'en-US'), 'zh-CN')).toBe(-1)
    expect(scoreVoiceForLang(v('Google 普通话', 'zh-CN'), '')).toBe(-1)
  })

  it('Natural/Online 语音优先于 Google 与 Microsoft', () => {
    const zh = 'zh-CN'
    const natural = scoreVoiceForLang(v('Microsoft Xiaoxiao Online (Natural) - Chinese', zh), zh)
    const google = scoreVoiceForLang(v('Google 普通话（中国大陆）', zh), zh)
    const ms = scoreVoiceForLang(v('Microsoft Huihui - Chinese', zh, true), zh)
    const other = scoreVoiceForLang(v('Ting-Ting', 'zh-CN', true), zh)
    expect(natural).toBeGreaterThan(google)
    expect(google).toBeGreaterThan(ms)
    expect(ms).toBeGreaterThan(other)
  })

  it('地区完全匹配优先于仅语种匹配', () => {
    const exact = scoreVoiceForLang(v('Google 普通话', 'zh-CN'), 'zh-CN')
    const tw = scoreVoiceForLang(v('Google 國語（台灣）', 'zh-TW'), 'zh-CN')
    expect(exact).toBeGreaterThan(tw)
  })

  it('lang 下划线写法与横线等价', () => {
    expect(scoreVoiceForLang(v('Google 普通话', 'zh_CN'), 'zh-CN')).toBeGreaterThan(0)
  })
})

describe('selectBestVoice', () => {
  const voices: SpeechVoiceLike[] = [
    v('Microsoft Huihui - Chinese', 'zh-CN', true),
    v('Ting-Ting', 'zh-CN', true),
    v('Google 普通话（中国大陆）', 'zh-CN'),
    v('Microsoft Xiaoxiao Online (Natural) - Chinese', 'zh-CN'),
    v('Google US English', 'en-US'),
  ]

  it('选出目标语言质量最高的语音', () => {
    expect(selectBestVoice(voices, 'zh-CN')?.name).toBe('Microsoft Xiaoxiao Online (Natural) - Chinese')
    expect(selectBestVoice(voices, 'en-US')?.name).toBe('Google US English')
  })

  it('无匹配语种返回 null', () => {
    expect(selectBestVoice(voices, 'ja-JP')).toBeNull()
  })

  it('空列表/空 lang 返回 null', () => {
    expect(selectBestVoice([], 'zh-CN')).toBeNull()
    expect(selectBestVoice(null, 'zh-CN')).toBeNull()
    expect(selectBestVoice(voices, '')).toBeNull()
  })
})
