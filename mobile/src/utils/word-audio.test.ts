/**
 * 单词发音统一入口（word-audio）单测
 * 覆盖音频调度核心逻辑：播前停旧音、代际丢弃防抢跑、预取下一词、失败提示降噪
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { speakWord, stopSpeaking, buildWordAudioUrls, speakChineseLongText, prefetchWords, __resetTtsEnginePreferenceForTest, type SpeakWordOptions } from '@/utils/word-audio'
import { setTtsAdapter } from '@/adapters/index'
import { setActiveLanguage } from '@/utils/language'

interface PlayCall {
  url: string
  options?: { silent?: boolean }
  resolve: () => void
  reject: (err?: any) => void
}

/** 可控的 TTS 适配器 mock：记录每次 playAudio 调用，由测试手动触发 resolve/reject */
function createControllableAdapter() {
  const calls: PlayCall[] = []
  const stops: unknown[] = []
  const prefetches: string[] = []
  const adapter = {
    speak: vi.fn(),
    stop: vi.fn(() => { stops.push(null) }),
    playAudio: vi.fn((url: string, options?: { silent?: boolean }) => {
      return new Promise<void>((resolve, reject) => {
        calls.push({ url, options, resolve, reject })
      })
    }),
    prefetchAudio: vi.fn((url: string) => { prefetches.push(url) }),
  }
  return { adapter, calls, stops, prefetches }
}

let env: ReturnType<typeof createControllableAdapter>

/** 刷新微任务队列：playAudio 的 .then 回调在微任务里推进音源回退 */
function flushMicrotasks(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0))
}

beforeEach(() => {
  env = createControllableAdapter()
  setTtsAdapter(env.adapter as any)
  setActiveLanguage('en')
  __resetTtsEnginePreferenceForTest()
})

describe('buildWordAudioUrls', () => {
  it('有道优先、百度 uk 次之（句子可用）、谷歌兜底，且单词被编码', () => {
    const urls = buildWordAudioUrls("what's up")
    expect(urls[0]).toBe(`https://dict.youdao.com/dictvoice?audio=${encodeURIComponent("what's up")}&type=2`)
    expect(urls[1]).toContain('fanyi.baidu.com/gettts')
    expect(urls[1]).toContain('lan=uk')
    expect(urls[1]).toContain(encodeURIComponent("what's up"))
    expect(urls[2]).toContain('translate.google.com')
    expect(urls[2]).toContain(encodeURIComponent("what's up"))
  })

  it('英文长句由百度 uk 首发（dictvoice 对长句易失败），dictvoice 次之、谷歌兜底', () => {
    const sentence = 'That sounds like a great idea, let us do it.'
    const urls = buildWordAudioUrls(sentence)
    expect(urls[0]).toContain('fanyi.baidu.com/gettts')
    expect(urls[0]).toContain('lan=uk')
    expect(urls[1]).toContain('dict.youdao.com/dictvoice')
    expect(urls[2]).toContain('translate.google.com')
  })

  it('短词与短语仍由 dictvoice 首发', () => {
    expect(buildWordAudioUrls('hello')[0]).toContain('dict.youdao.com/dictvoice')
    expect(buildWordAudioUrls("what's up")[0]).toContain('dict.youdao.com/dictvoice')
  })

  it('中文：有道智云 TTS 优先，百度免费 TTS 次之，谷歌 zh-CN 兜底', () => {
    const urls = buildWordAudioUrls('你好')
    expect(urls[0]).toContain('openapi.youdao.com/ttsapi')
    expect(urls[0]).toContain(encodeURIComponent('你好'))
    expect(urls[1]).toContain('fanyi.baidu.com/gettts')
    expect(urls[2]).toContain('translate.google.com')
    expect(urls[2]).toContain('tl=zh-CN')
  })

  it.each([
    ['ja', '学生', 'ja'],
    ['ru', 'привет', 'ru'],
    ['es', 'hola', 'es'],
    ['fr', 'bonjour', 'fr'],
  ] as const)('%s 使用对应语种 TTS，日语汉字不误走中文音源', (language, word, ttsLang) => {
    const urls = buildWordAudioUrls(word, language)
    expect(urls).toHaveLength(1)
    expect(urls[0]).toContain(`tl=${ttsLang}`)
    expect(urls[0]).toContain(encodeURIComponent(word))
  })
})

describe('speakWord 音频调度', () => {
  it('自动发音以静默模式播放（失败不弹提示）', () => {
    speakWord('hello')
    expect(env.calls).toHaveLength(1)
    expect(env.calls[0].options).toEqual({ silent: true })
  })

  it('回退全程静默（避免先弹错误提示后正常发音），用户主动发音全链失败才弹一次提示', async () => {
    const toast = vi.fn()
    ;(globalThis as any).uni = { showToast: toast }
    try {
      speakWord('hello', { userInitiated: true })
      expect(env.calls[0].options).toEqual({ silent: true })
      // 整链 3 个音源全部失败
      for (let i = 0; i < 3; i++) {
        env.calls[i].reject(new Error('net error'))
        await flushMicrotasks()
      }
      expect(env.calls).toHaveLength(3)
      expect(toast).toHaveBeenCalledTimes(1)
    } finally {
      delete (globalThis as any).uni
    }
  })

  it('自动发音全链失败静默不弹提示', async () => {
    const toast = vi.fn()
    ;(globalThis as any).uni = { showToast: toast }
    try {
      speakWord('hello')
      for (let i = 0; i < 3; i++) {
        env.calls[i].reject(new Error('net error'))
        await flushMicrotasks()
      }
      expect(toast).not.toHaveBeenCalled()
    } finally {
      delete (globalThis as any).uni
    }
  })

  it('有道失败时依次回退百度 uk → 谷歌音源', async () => {
    speakWord('hello')
    env.calls[0].reject(new Error('net error'))
    await flushMicrotasks()
    expect(env.calls).toHaveLength(2)
    expect(env.calls[1].url).toContain('fanyi.baidu.com/gettts')
    env.calls[1].reject(new Error('net error'))
    await flushMicrotasks()
    expect(env.calls).toHaveLength(3)
    expect(env.calls[2].url).toContain('translate.google.com')
    env.calls[2].resolve()
  })

  it('播新音后旧词的待回退音源被丢弃（代际防抢跑）', async () => {
    speakWord('hello')
    env.calls[0].reject(new Error('net error'))
    await flushMicrotasks()
    // 谷歌兜底加载中（calls[1]），用户已切到下一个词
    speakWord('world')
    expect(env.calls).toHaveLength(3)
    // 旧词的兜底音源姗姗来迟地失败：不得再为它发起任何播放
    env.calls[1].reject(new Error('net error'))
    await flushMicrotasks()
    expect(env.calls).toHaveLength(3)
    // 新词正常推进
    env.calls[2].resolve()
    await flushMicrotasks()
    expect(env.calls).toHaveLength(3)
  })

  it('播新音后旧词未完成的播放 resolve 不触发旧词的 onEnded', async () => {
    const onEndedOld = vi.fn()
    const onEndedNew = vi.fn()
    speakWord('hello', { onEnded: onEndedOld })
    speakWord('world', { onEnded: onEndedNew })
    // 旧词音频姗姗来迟地播完：回调必须被代际校验丢弃
    env.calls[0].resolve()
    await flushMicrotasks()
    expect(onEndedOld).not.toHaveBeenCalled()
    env.calls[1].resolve()
    await flushMicrotasks()
    expect(onEndedNew).toHaveBeenCalledTimes(1)
  })

  it('stopSpeaking 停止音频并作废待完成的回退', async () => {
    speakWord('hello')
    env.calls[0].reject(new Error('net error'))
    await flushMicrotasks()
    stopSpeaking()
    expect(env.adapter.stop).toHaveBeenCalled()
    env.calls[1].reject(new Error('net error'))
    await flushMicrotasks()
    // 兜底已被作废，不得再发起新播放
    expect(env.calls).toHaveLength(2)
  })

  it('预取下一个词：调用适配器 prefetchAudio（有道音源）', () => {
    speakWord('hello', { prefetchNext: 'world' })
    expect(env.prefetches).toEqual([
      `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent('world')}&type=2`
    ])
  })

  it('预取下一个词为中文时走中文音源（有道智云 TTS）', () => {
    speakWord('hello', { prefetchNext: '你好' })
    expect(env.prefetches).toHaveLength(1)
    expect(env.prefetches[0]).toContain('openapi.youdao.com/ttsapi')
    expect(env.prefetches[0]).toContain(encodeURIComponent('你好'))
  })

  it('预取与当前词使用相同的非英语语种', () => {
    speakWord('こんにちは', { language: 'ja', prefetchNext: '学生' })
    expect(env.prefetches).toHaveLength(1)
    expect(env.prefetches[0]).toContain('tl=ja')
    expect(env.prefetches[0]).toContain(encodeURIComponent('学生'))
  })

  it('中文发音失败时按音源链回退（有道智云 → 百度 → 谷歌 zh-CN）', async () => {
    speakWord('你好')
    expect(env.calls[0].url).toContain('openapi.youdao.com/ttsapi')
    env.calls[0].reject(new Error('net error'))
    await flushMicrotasks()
    expect(env.calls[1].url).toContain('fanyi.baidu.com/gettts')
    env.calls[1].reject(new Error('net error'))
    await flushMicrotasks()
    expect(env.calls).toHaveLength(3)
    expect(env.calls[2].url).toContain('translate.google.com')
    expect(env.calls[2].url).toContain('tl=zh-CN')
    env.calls[2].resolve()
  })

  it('未指定下一个词时不发起预取', () => {
    speakWord('hello')
    expect(env.prefetches).toHaveLength(0)
  })

  it('口语句库词条优先播放预合成连读音频，主域失败依次走镜像后回退有道', async () => {
    speakWord('I wanna go home', { speechBankId: 'spoken-reductions-1' })
    expect(env.calls[0].url).toBe(
      'https://cdn.jsdelivr.net/gh/chuxiangshi2026/slowlyRecord@master/public/speech-audio/spoken-reductions-1/fccc2c23599dd82f462335ff36e36e37.mp3',
    )
    env.calls[0].reject(new Error('net error'))
    await flushMicrotasks()
    // jsDelivr 主域失败 → 境内镜像
    expect(env.calls[1].url).toContain('jsd.onmicrosoft.cn')
    env.calls[1].reject(new Error('net error'))
    await flushMicrotasks()
    expect(env.calls[2].url).toContain('fastly.jsdelivr.net')
    env.calls[2].reject(new Error('net error'))
    await flushMicrotasks()
    // 镜像全部失败后回退在线 TTS（句子首发百度 uk，dictvoice 次之）
    expect(env.calls[3].url).toContain('fanyi.baidu.com/gettts')
    env.calls[3].reject(new Error('net error'))
    await flushMicrotasks()
    expect(env.calls[4].url).toContain('dict.youdao.com')
    env.calls[4].resolve()
  })

  it('语速设置透传到底层 playAudio（含回退音源）', async () => {
    speakWord('hello', { rate: 0.75 })
    expect(env.calls[0].options).toEqual({ silent: true, rate: 0.75 })
    env.calls[0].reject(new Error('net error'))
    await flushMicrotasks()
    expect(env.calls[1].options).toEqual({ silent: true, rate: 0.75 })
    env.calls[1].resolve()
  })

  it('不带 speechBankId 的词条不掺入预合成音源', () => {
    speakWord('hello')
    expect(env.calls[0].url).toContain('dict.youdao.com')
  })

  it('预取下一条可用其自身的预合成音源', () => {
    speakWord('hello', { prefetchNext: 'I wanna go home', prefetchNextSpeechBankId: 'spoken-reductions-1' })
    expect(env.prefetches).toEqual([
      'https://cdn.jsdelivr.net/gh/chuxiangshi2026/slowlyRecord@master/public/speech-audio/spoken-reductions-1/fccc2c23599dd82f462335ff36e36e37.mp3',
    ])
  })
})

describe('发音统一与缓存优先', () => {
  it('兜底音源播放成功后，后续单词优先使用同一引擎（嗓音一致）', async () => {
    speakWord('hello')
    env.calls[0].reject(new Error('net error'))
    await flushMicrotasks()
    expect(env.calls[1].url).toContain('fanyi.baidu.com')
    env.calls[1].resolve()
    await flushMicrotasks()

    speakWord('world')
    expect(env.calls[2].url).toContain('fanyi.baidu.com')
    env.calls[2].resolve()
  })

  it('首选引擎成功时不改变原有音源顺序', async () => {
    speakWord('hello')
    env.calls[0].resolve()
    await flushMicrotasks()
    speakWord('world')
    expect(env.calls[1].url).toContain('dict.youdao.com')
    env.calls[1].resolve()
  })

  it('链上靠后音源命中本地缓存时优先播放缓存（离线即时发音）', () => {
    ;(env.adapter as any).getCachedPath = vi.fn((url: string) =>
      url.includes('fanyi.baidu.com') ? '/wx-cache/baidu.mp3' : null,
    )
    speakWord('hello')
    expect(env.calls[0].url).toContain('fanyi.baidu.com')
  })

  it('无缓存命中时仍从首选音源开始', () => {
    ;(env.adapter as any).getCachedPath = vi.fn(() => null)
    speakWord('hello')
    expect(env.calls[0].url).toContain('dict.youdao.com')
  })

  it('prefetchWords 批量预取后续单词首选音源，空项跳过', () => {
    prefetchWords([{ word: 'apple' }, null, { word: '  ' }, { word: 'banana' }])
    expect(env.prefetches).toHaveLength(2)
    expect(env.prefetches[0]).toContain('apple')
    expect(env.prefetches[1]).toContain('banana')
  })
})

describe('speakChineseLongText 分段连播', () => {
  it('空文本直接返回 false，不发起播放', async () => {
    expect(await speakChineseLongText('')).toBe(false)
    expect(env.calls).toHaveLength(0)
  })

  it('短文本单段播放，成功返回 true', async () => {
    const p = speakChineseLongText('你好。')
    await flushMicrotasks()
    expect(env.calls).toHaveLength(1)
    expect(env.calls[0].url).toContain(encodeURIComponent('你好。'))
    env.calls[0].resolve()
    expect(await p).toBe(true)
  })

  // 超过 80 字才会切成两段（分段阈值见 splitChineseSpeechText）
  const LONG_TEXT = '白日依山尽，黄河入海流。'.repeat(8)

  it('长文本按句分段顺序播放，并预取下一段', async () => {
    const p = speakChineseLongText(LONG_TEXT, { rate: 0.75 })
    await flushMicrotasks()
    // 第一段起播 + 预取第二段
    expect(env.calls).toHaveLength(1)
    expect(env.prefetches.length).toBeGreaterThan(0)
    env.calls[0].resolve()
    await flushMicrotasks()
    // 第一段播完推进第二段
    expect(env.calls.length).toBeGreaterThanOrEqual(2)
    env.calls[1].resolve()
    const ok = await p
    expect(ok).toBe(true)
    // 语速透传
    expect(env.calls[0].options).toMatchObject({ rate: 0.75 })
  })

  it('段内首个音源失败回退下一音源，不中断连播', async () => {
    const p = speakChineseLongText('你好。')
    await flushMicrotasks()
    env.calls[0].reject(new Error('net error'))
    await flushMicrotasks()
    expect(env.calls).toHaveLength(2)
    env.calls[1].resolve()
    expect(await p).toBe(true)
  })

  it('某段全部音源失败返回 false', async () => {
    const p = speakChineseLongText('你好。')
    // 音源链长度取决于密钥配置（有道智云 → 百度 → 谷歌），逐个拒绝直到 Promise 落定
    for (let i = 0; i < 10; i++) {
      await flushMicrotasks()
      const call = env.calls[i]
      if (!call) break
      call.reject(new Error('net error'))
    }
    expect(await p).toBe(false)
  })

  it('stopSpeaking 中断连播：进行中的段结束后不再推进', async () => {
    const p = speakChineseLongText(LONG_TEXT)
    await flushMicrotasks()
    expect(env.calls).toHaveLength(1)
    stopSpeaking()
    env.calls[0].resolve()
    expect(await p).toBe(false)
    expect(env.calls).toHaveLength(1)
  })
})
