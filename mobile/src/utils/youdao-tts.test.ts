/**
 * 中文发音音源（youdao-tts）单测
 * 覆盖：汉字判定、有道 v3 签名正确性、密钥缺失兜底、音源链与缓存键兼容
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// 控制密钥：有密钥 / 无密钥两种场景
let mockKey = { appkey: '', key: '' }
vi.mock('@/stores/useUtils/translation-settings', () => ({
  getTranslationApiKey: () => mockKey,
}))

import { containsChinese, buildYoudaoTtsUrl, buildChineseAudioUrls } from '@/utils/youdao-tts'
import { parseAudioCacheWord } from '@/adapters/index'

describe('containsChinese', () => {
  it('含汉字判定', () => {
    expect(containsChinese('你好')).toBe(true)
    expect(containsChinese('ab汉cd')).toBe(true)
    expect(containsChinese('hello')).toBe(false)
    expect(containsChinese('')).toBe(false)
  })
})

describe('buildYoudaoTtsUrl', () => {
  beforeEach(() => {
    mockKey = { appkey: 'app', key: 'sec' }
    vi.spyOn(Date, 'now').mockReturnValue(1700000000000)
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('按有道 v3 规则签名（短文本 input 取原文）', () => {
    const url = buildYoudaoTtsUrl('你好')!
    expect(url).toContain('https://openapi.youdao.com/ttsapi?')
    const params = new URL(url).searchParams
    expect(params.get('q')).toBe('你好')
    expect(params.get('appKey')).toBe('app')
    expect(params.get('salt')).toBe('1700000000000')
    expect(params.get('curtime')).toBe('1700000000')
    expect(params.get('signType')).toBe('v3')
    expect(params.get('format')).toBe('mp3')
    expect(params.get('voiceName')).toBe('youxiaoxun')
    // sha256('app' + '你好' + salt + curtime + 'sec')
    expect(params.get('sign')).toBe('6423638c9a76785641bdb18a1db39ebf1cf07cfd9fa3fd963559496cb0c4997d')
  })

  it('长文本按 前10+长度+后10 截断签名', () => {
    const q = 'abcdefghijklmnopqrstuvwxyz0123456789'
    const url = buildYoudaoTtsUrl(q)!
    // input = 'abcdefghij' + 36 + '0123456789'
    expect(new URL(url).searchParams.get('sign'))
      .toBe('a58829030a1cbfd106c0fbf2696726c5e1dca496ceaa460ab52d6b7b7c36aea3')
  })

  it('密钥缺失时返回 null', () => {
    mockKey = { appkey: '', key: '' }
    expect(buildYoudaoTtsUrl('你好')).toBeNull()
  })
})

describe('buildChineseAudioUrls', () => {
  beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(1700000000000)
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('有密钥：有道智云 TTS 优先，谷歌翻译 TTS（zh-CN）兜底', () => {
    mockKey = { appkey: 'app', key: 'sec' }
    const urls = buildChineseAudioUrls('你好')
    expect(urls).toHaveLength(2)
    expect(urls[0]).toContain('openapi.youdao.com/ttsapi')
    expect(urls[1]).toContain('translate.google.com')
    expect(urls[1]).toContain('tl=zh-CN')
    expect(urls[1]).toContain(encodeURIComponent('你好'))
  })

  it('无密钥：仅保留谷歌兜底', () => {
    mockKey = { appkey: '', key: '' }
    const urls = buildChineseAudioUrls('你好')
    expect(urls).toHaveLength(1)
    expect(urls[0]).toContain('translate.google.com')
  })

  it('音源 URL 与音频缓存键解析兼容（q 参数）', () => {
    mockKey = { appkey: 'app', key: 'sec' }
    for (const url of buildChineseAudioUrls('你好')) {
      expect(parseAudioCacheWord(url)).toBe('你好')
    }
  })
})
