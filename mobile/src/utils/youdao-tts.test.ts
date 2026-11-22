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

import { containsChinese, buildYoudaoTtsUrl, buildChineseAudioUrls, splitChineseSpeechText } from '@/utils/youdao-tts'
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

  it('有密钥：有道智云 TTS 优先，百度免费 TTS 次之，谷歌翻译 TTS（zh-CN）兜底', () => {
    mockKey = { appkey: 'app', key: 'sec' }
    const urls = buildChineseAudioUrls('你好')
    expect(urls).toHaveLength(3)
    expect(urls[0]).toContain('openapi.youdao.com/ttsapi')
    expect(urls[1]).toContain('fanyi.baidu.com/gettts')
    expect(urls[1]).toContain(encodeURIComponent('你好'))
    expect(urls[2]).toContain('translate.google.com')
    expect(urls[2]).toContain('tl=zh-CN')
    expect(urls[2]).toContain(encodeURIComponent('你好'))
  })

  it('无密钥：百度免费 TTS 优先，谷歌兜底', () => {
    mockKey = { appkey: '', key: '' }
    const urls = buildChineseAudioUrls('你好')
    expect(urls).toHaveLength(2)
    expect(urls[0]).toContain('fanyi.baidu.com/gettts')
    expect(urls[1]).toContain('translate.google.com')
  })

  it('音源 URL 与音频缓存键解析兼容（q 参数）', () => {
    mockKey = { appkey: 'app', key: 'sec' }
    for (const url of buildChineseAudioUrls('你好')) {
      expect(parseAudioCacheWord(url)).toBe('你好')
    }
  })
})

describe('splitChineseSpeechText', () => {
  it('空文本与纯空白返回空数组', () => {
    expect(splitChineseSpeechText('')).toEqual([])
    expect(splitChineseSpeechText('  \n ')).toEqual([])
  })

  it('短文本不切分', () => {
    expect(splitChineseSpeechText('床前明月光，疑是地上霜。')).toEqual(['床前明月光，疑是地上霜。'])
  })

  it('按句末标点切分并尽量合并到 maxLen 内', () => {
    const text = '白日依山尽。黄河入海流。欲穷千里目。更上一层楼。'
    const segments = splitChineseSpeechText(text, 20)
    expect(segments).toEqual(['白日依山尽。黄河入海流。欲穷千里目。', '更上一层楼。'])
    for (const seg of segments) expect(seg.length).toBeLessThanOrEqual(20)
  })

  it('按换行切分（诗词逐行）', () => {
    const text = '春眠不觉晓\n处处闻啼鸟\n夜来风雨声\n花落知多少'
    const segments = splitChineseSpeechText(text, 12)
    expect(segments).toEqual(['春眠不觉晓\n处处闻啼鸟', '夜来风雨声\n花落知多少'])
  })

  it('单句超长时按次级停顿切分', () => {
    const text = '天地玄黄，宇宙洪荒，日月盈昃，辰宿列张，寒来暑往，秋收冬藏'
    const segments = splitChineseSpeechText(text, 16)
    expect(segments.length).toBeGreaterThan(1)
    for (const seg of segments) expect(seg.length).toBeLessThanOrEqual(16)
    expect(segments.join('')).toBe(text)
    // 优先在逗号处断开
    expect(segments[0].endsWith('，')).toBe(true)
  })

  it('无停顿的超长句硬切且不丢字', () => {
    const text = '一二三四五六七八九十一二三四五六七八九十一二三四五六七八九十'
    const segments = splitChineseSpeechText(text, 10)
    expect(segments.join('')).toBe(text)
    for (const seg of segments) expect(seg.length).toBeLessThanOrEqual(10)
  })

  it('长文分段覆盖全部内容（不丢字）', () => {
    const text = '静夜思。床前明月光，疑是地上霜。举头望明月，低头思故乡。'
    const segments = splitChineseSpeechText(text, 15)
    expect(segments.join('')).toBe(text)
  })
})
