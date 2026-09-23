/**
 * 单词发音统一入口（word-audio）单测
 * 覆盖音频调度核心逻辑：播前停旧音、代际丢弃防抢跑、预取下一词、失败提示降噪
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { speakWord, stopSpeaking, buildWordAudioUrls, type SpeakWordOptions } from '@/utils/word-audio'
import { setTtsAdapter } from '@/adapters/index'

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
})

describe('buildWordAudioUrls', () => {
  it('有道优先、谷歌兜底，且单词被编码', () => {
    const urls = buildWordAudioUrls("what's up")
    expect(urls[0]).toBe(`https://dict.youdao.com/dictvoice?audio=${encodeURIComponent("what's up")}&type=2`)
    expect(urls[1]).toContain('translate.google.com')
    expect(urls[1]).toContain(encodeURIComponent("what's up"))
  })

  it('中文：有道 dictvoice 不支持，改走有道智云 TTS（含 q 参数），谷歌 zh-CN 兜底', () => {
    const urls = buildWordAudioUrls('你好')
    expect(urls[0]).toContain('openapi.youdao.com/ttsapi')
    expect(urls[0]).toContain(encodeURIComponent('你好'))
    expect(urls[1]).toContain('translate.google.com')
    expect(urls[1]).toContain('tl=zh-CN')
  })
})

describe('speakWord 音频调度', () => {
  it('自动发音以静默模式播放（失败不弹提示）', () => {
    speakWord('hello')
    expect(env.calls).toHaveLength(1)
    expect(env.calls[0].options).toEqual({ silent: true })
  })

  it('用户主动发音以非静默模式播放（失败允许节流提示）', () => {
    speakWord('hello', { userInitiated: true })
    expect(env.calls[0].options).toEqual({ silent: false })
  })

  it('有道失败时回退谷歌音源', async () => {
    speakWord('hello')
    env.calls[0].reject(new Error('net error'))
    await flushMicrotasks()
    expect(env.calls).toHaveLength(2)
    expect(env.calls[1].url).toContain('translate.google.com')
    env.calls[1].resolve()
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

  it('中文发音失败时按音源链回退（有道智云 → 谷歌 zh-CN）', async () => {
    speakWord('你好')
    expect(env.calls[0].url).toContain('openapi.youdao.com/ttsapi')
    env.calls[0].reject(new Error('net error'))
    await flushMicrotasks()
    expect(env.calls).toHaveLength(2)
    expect(env.calls[1].url).toContain('translate.google.com')
    expect(env.calls[1].url).toContain('tl=zh-CN')
    env.calls[1].resolve()
  })

  it('未指定下一个词时不发起预取', () => {
    speakWord('hello')
    expect(env.prefetches).toHaveLength(0)
  })
})
