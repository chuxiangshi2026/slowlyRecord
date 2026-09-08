/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import {
  hashAudioCacheKey,
  pickLruEvictions,
  parseAudioCacheWord,
  getTtsAdapter,
  setTtsAdapter,
  type AudioCacheEntry,
} from '@/adapters/index'

describe('音频缓存纯函数', () => {
  describe('hashAudioCacheKey', () => {
    it('同一文本哈希结果稳定', () => {
      expect(hashAudioCacheKey('hello')).toBe(hashAudioCacheKey('hello'))
    })

    it('不同文本哈希不同', () => {
      expect(hashAudioCacheKey('hello')).not.toBe(hashAudioCacheKey('world'))
    })

    it('对大小写与特殊字符敏感且输出为短字符串', () => {
      const key = hashAudioCacheKey("don't")
      expect(typeof key).toBe('string')
      expect(key.length).toBeLessThan(16)
      expect(key).not.toBe(hashAudioCacheKey("DON'T"))
    })

    it('空字符串也能得到合法 key', () => {
      expect(hashAudioCacheKey('')).toMatch(/^[0-9a-z]+$/)
    })
  })

  describe('pickLruEvictions', () => {
    const entry = (key: string, lastUsed: number): AudioCacheEntry => ({ key, filePath: `/cache/${key}`, lastUsed })

    it('未超过上限时不淘汰', () => {
      const entries = [entry('a', 1), entry('b', 2), entry('c', 3)]
      expect(pickLruEvictions(entries, 3)).toEqual([])
      expect(pickLruEvictions(entries, 5)).toEqual([])
    })

    it('超过上限时按最久未用淘汰多余条目', () => {
      const entries = [entry('a', 100), entry('b', 300), entry('c', 200), entry('d', 400)]
      const evicted = pickLruEvictions(entries, 2)
      expect(evicted.map(e => e.key)).toEqual(['a', 'c'])
    })

    it('淘汰数量等于超出部分', () => {
      const entries = Array.from({ length: 10 }, (_, i) => entry(`k${i}`, i))
      expect(pickLruEvictions(entries, 8)).toHaveLength(2)
    })

    it('不修改原数组', () => {
      const entries = [entry('a', 2), entry('b', 1)]
      pickLruEvictions(entries, 1)
      expect(entries.map(e => e.key)).toEqual(['a', 'b'])
    })
  })

  describe('parseAudioCacheWord', () => {
    it('解析有道 dictvoice 的 audio 参数', () => {
      expect(parseAudioCacheWord('https://dict.youdao.com/dictvoice?audio=hello&type=2')).toBe('hello')
    })

    it('解析 google tts 的 q 参数', () => {
      expect(
        parseAudioCacheWord('https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=en&q=hello')
      ).toBe('hello')
    })

    it('对编码后的参数解码并统一小写、去除首尾空白', () => {
      expect(parseAudioCacheWord('https://dict.youdao.com/dictvoice?audio=%20Hello%20')).toBe('hello')
      expect(parseAudioCacheWord(`https://dict.youdao.com/dictvoice?audio=${encodeURIComponent("don't")}`)).toBe("don't")
    })

    it('无参数或无法解析时返回 null', () => {
      expect(parseAudioCacheWord('https://example.com/audio.mp3')).toBeNull()
      expect(parseAudioCacheWord('not-a-url')).toBeNull()
    })
  })
})

describe('MiniProgramTtsAdapter 重试与缓存', () => {
  let storage: Map<string, any>
  let audioInstances: any[]
  let uniMock: any
  let savedFiles: string[]

  /** 创建可控的 InnerAudioContext mock：外部可通过 trigger 触发回调 */
  function createAudioMock() {
    const handlers: Record<string, Function[]> = {}
    const audio: any = {
      src: '',
      play: vi.fn(),
      stop: vi.fn(),
      destroy: vi.fn(),
      onEnded: (fn: Function) => { (handlers['ended'] ||= []).push(fn) },
      onError: (fn: Function) => { (handlers['error'] ||= []).push(fn) },
      trigger: (event: string, arg?: any) => { (handlers[event] || []).forEach(fn => fn(arg)) },
    }
    return audio
  }

  beforeEach(() => {
    vi.useFakeTimers()
    storage = new Map()
    audioInstances = []
    savedFiles = []
    uniMock = {
      getStorageSync: vi.fn((key: string) => storage.get(key) ?? null),
      setStorageSync: vi.fn((key: string, data: any) => { storage.set(key, data) }),
      removeStorageSync: vi.fn((key: string) => { storage.delete(key) }),
      createInnerAudioContext: vi.fn(() => {
        const audio = createAudioMock()
        audioInstances.push(audio)
        return audio
      }),
      downloadFile: vi.fn(({ success }: any) => {
        success({ statusCode: 200, tempFilePath: 'tmp://audio.mp3' })
      }),
      saveFile: vi.fn(({ tempFilePath, success }: any) => {
        const savedFilePath = `saved://${tempFilePath}`
        savedFiles.push(savedFilePath)
        success({ savedFilePath })
      }),
      removeSavedFile: vi.fn(),
      showToast: vi.fn(),
    }
    ;(global as any).uni = uniMock
    setTtsAdapter(null as any)
  })

  afterEach(() => {
    vi.useRealTimers()
    setTtsAdapter(null as any)
  })

  it('播放成功时直接 resolve 且不走下载', async () => {
    const promise = getTtsAdapter().playAudio('https://dict.youdao.com/dictvoice?audio=hello&type=2')
    // 等 playOnce 内部创建实例并 play
    await vi.advanceTimersByTimeAsync(0)
    expect(audioInstances).toHaveLength(1)
    expect(uniMock.downloadFile).not.toHaveBeenCalled() // 播放完成前不触发后台缓存
    audioInstances[0].trigger('ended')
    await expect(promise).resolves.toBeUndefined()
  })

  it('onError 后自动重试，最终成功则 resolve', async () => {
    const promise = getTtsAdapter().playAudio('https://dict.youdao.com/dictvoice?audio=hello&type=2')
    await vi.advanceTimersByTimeAsync(0)
    audioInstances[0].trigger('error', { errMsg: 'net error' })
    await vi.advanceTimersByTimeAsync(500) // 第 1 次重试间隔 400ms
    expect(audioInstances).toHaveLength(2)
    audioInstances[1].trigger('ended')
    await expect(promise).resolves.toBeUndefined()
  })

  it('重试 2 次仍失败则 reject，且提示 toast', async () => {
    const promise = getTtsAdapter().playAudio('https://dict.youdao.com/dictvoice?audio=hello&type=2')
    // 先挂接 rejection 断言，避免 promise 先拒绝产生 unhandled rejection
    const assertion = expect(promise).rejects.toBeTruthy()
    for (let i = 0; i <= 2; i++) {
      await vi.advanceTimersByTimeAsync(0)
      audioInstances[i].trigger('error', { errMsg: 'net error' })
      await vi.advanceTimersByTimeAsync(1200)
    }
    await assertion
    expect(audioInstances).toHaveLength(3)
    expect(uniMock.showToast).toHaveBeenCalledTimes(1)
  })

  it('超时无回调视为失败并进入重试', async () => {
    const promise = getTtsAdapter().playAudio('https://dict.youdao.com/dictvoice?audio=hello&type=2')
    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(15000) // 触发超时
    await vi.advanceTimersByTimeAsync(500) // 第 1 次重试等待间隔
    expect(audioInstances).toHaveLength(2)
    audioInstances[1].trigger('ended')
    await expect(promise).resolves.toBeUndefined()
  })

  it('播放成功后后台下载并写入缓存清单', async () => {
    const promise = getTtsAdapter().playAudio('https://dict.youdao.com/dictvoice?audio=hello&type=2')
    await vi.advanceTimersByTimeAsync(0)
    audioInstances[0].trigger('ended')
    await promise
    await vi.advanceTimersByTimeAsync(0) // 让后台 downloadAndCache 完成
    expect(uniMock.downloadFile).toHaveBeenCalledTimes(1)
    expect(uniMock.saveFile).toHaveBeenCalledTimes(1)
    const manifest = storage.get('slowlyrecord_audio_cache_manifest')
    const wordKey = hashAudioCacheKey('hello')
    expect(manifest[wordKey]?.filePath).toBe('saved://tmp://audio.mp3')
  })

  it('命中缓存时直接播本地路径，不再下载', async () => {
    const wordKey = hashAudioCacheKey('hello')
    storage.set('slowlyrecord_audio_cache_manifest', {
      [wordKey]: { key: wordKey, filePath: 'saved://cached.mp3', lastUsed: 1 },
    })
    const promise = getTtsAdapter().playAudio('https://dict.youdao.com/dictvoice?audio=hello&type=2')
    await vi.advanceTimersByTimeAsync(0)
    expect(audioInstances[0].src).toBe('saved://cached.mp3')
    audioInstances[0].trigger('ended')
    await promise
    await vi.advanceTimersByTimeAsync(0)
    expect(uniMock.downloadFile).not.toHaveBeenCalled()
    // lastUsed 被刷新
    expect(storage.get('slowlyrecord_audio_cache_manifest')[wordKey].lastUsed).toBeGreaterThan(1)
  })

  it('缓存清单超过上限时按 LRU 淘汰并删除本地文件', async () => {
    // 预置 200 个旧条目 + 本次将写入的新条目，上限 200 → 淘汰最旧的一个
    const manifest: Record<string, any> = {}
    for (let i = 0; i < 200; i++) {
      manifest[`old${i}`] = { key: `old${i}`, filePath: `saved://old${i}`, lastUsed: i + 1 }
    }
    storage.set('slowlyrecord_audio_cache_manifest', manifest)

    const promise = getTtsAdapter().playAudio('https://dict.youdao.com/dictvoice?audio=newword&type=2')
    await vi.advanceTimersByTimeAsync(0)
    audioInstances[0].trigger('ended')
    await promise
    await vi.advanceTimersByTimeAsync(0)

    const next = storage.get('slowlyrecord_audio_cache_manifest')
    expect(Object.keys(next)).toHaveLength(200)
    expect(next['old0']).toBeUndefined()
    expect(uniMock.removeSavedFile).toHaveBeenCalledWith(
      expect.objectContaining({ filePath: 'saved://old0' })
    )
  })

  it('saveFile 能力缺失时降级为纯在线播放，不影响发音', async () => {
    delete uniMock.saveFile
    const promise = getTtsAdapter().playAudio('https://dict.youdao.com/dictvoice?audio=hello&type=2')
    await vi.advanceTimersByTimeAsync(0)
    audioInstances[0].trigger('ended')
    await promise
    await vi.advanceTimersByTimeAsync(0)
    expect(uniMock.downloadFile).toHaveBeenCalledTimes(1)
    // 未写入任何缓存清单
    expect(storage.get('slowlyrecord_audio_cache_manifest') ?? {}).toEqual({})
  })

  it('downloadFile 失败时静默，不 reject 发音流程', async () => {
    uniMock.downloadFile = vi.fn(({ fail }: any) => { fail(new Error('network down')) })
    const promise = getTtsAdapter().playAudio('https://dict.youdao.com/dictvoice?audio=hello&type=2')
    await vi.advanceTimersByTimeAsync(0)
    audioInstances[0].trigger('ended')
    await expect(promise).resolves.toBeUndefined()
    await vi.advanceTimersByTimeAsync(0)
    expect(storage.get('slowlyrecord_audio_cache_manifest') ?? {}).toEqual({})
  })
})
