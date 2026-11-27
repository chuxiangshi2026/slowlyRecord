/**
 * 音频工具测试（桌面端）。
 *
 * 覆盖：WAV 头部与 PCM 采样（含越界钳制、双声道交错）、音频下载重试与
 * 响应校验（非 2xx / HTML 拦截 / 空文件 / 类型错误）、跳过处理与重采样
 * 两条存储链路、播放发音的 URL 选择、播放失败与 10 秒超时。
 * 浏览器音频 API 全部用 fake 实现，不真实解码或播放。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const translationApiMock = vi.hoisted(() => ({
  getPronunciationUrlSync: vi.fn(),
}))

vi.mock('./translation-api', () => ({
  getPronunciationUrlSync: translationApiMock.getPronunciationUrlSync,
}))

import { bufferToWave, downloadAndStoreAudio, playWordAudio } from './audio-util'

function createLocalStorage() {
  const map = new Map<string, string>()
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, String(value))
    },
    removeItem: (key: string) => map.delete(key),
    clear: () => map.clear(),
    length: () => map.size,
  }
}

class FakeFileReader {
  result: string | null = null
  onload: (() => void) | null = null

  readAsDataURL(blob: Blob) {
    this.result = `data:${blob.type || 'application/octet-stream'};base64,ZmFrZQ==`
    queueMicrotask(() => this.onload?.())
  }
}

class FakeAudio {
  static instances: FakeAudio[] = []

  src = ''
  oncanplaythrough: (() => void) | null = null
  onerror: (() => void) | null = null
  play = vi.fn(() => Promise.resolve())

  constructor() {
    FakeAudio.instances.push(this)
  }
}

const decodedBuffer = {
  numberOfChannels: 2,
  duration: 0.1,
  length: 4,
  getChannelData: (channel: number) =>
    channel === 0 ? new Float32Array([0.25, -0.5]) : new Float32Array([0.75, 0]),
}

const renderedBuffer = {
  numberOfChannels: 1,
  length: 4,
  getChannelData: () => new Float32Array([0, 0.5, -0.5, 1]),
}

class FakeAudioContext {
  decodeAudioData = vi.fn(async () => decodedBuffer)
}

class FakeOfflineAudioContext {
  static instances: FakeOfflineAudioContext[] = []

  destination = { id: 'destination' }
  createBufferSource = vi.fn(() => ({
    buffer: null as any,
    connect: vi.fn(),
    start: vi.fn(),
  }))
  startRendering = vi.fn(async () => renderedBuffer)

  constructor(
    public numberOfChannels: number,
    public length: number,
    public sampleRate: number,
  ) {
    FakeOfflineAudioContext.instances.push(this)
  }
}

let storage: ReturnType<typeof createLocalStorage>
let fetchMock: ReturnType<typeof vi.fn>
let createObjectURL: ReturnType<typeof vi.fn>

beforeEach(() => {
  storage = createLocalStorage()
  fetchMock = vi.fn()
  createObjectURL = vi.fn(() => 'blob:fake-url')
  FakeAudio.instances = []
  FakeOfflineAudioContext.instances = []
  translationApiMock.getPronunciationUrlSync.mockReset()

  vi.stubGlobal('localStorage', storage)
  vi.stubGlobal('fetch', fetchMock)
  vi.stubGlobal('FileReader', FakeFileReader)
  vi.stubGlobal('Audio', FakeAudio)
  vi.stubGlobal('window', { AudioContext: FakeAudioContext })
  vi.stubGlobal('OfflineAudioContext', FakeOfflineAudioContext)
  vi.stubGlobal('URL', { createObjectURL })
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function responseLike(blob: Blob, init: { ok?: boolean; status?: number; contentType?: string } = {}) {
  const contentType = init.contentType ?? blob.type
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    statusText: 'OK',
    headers: {
      get: (name: string) => (name.toLowerCase() === 'content-type' ? contentType : null),
    },
    blob: async () => blob,
  }
}

describe('bufferToWave', () => {
  it('生成标准 WAV 头部与 PCM 采样', async () => {
    const buffer = {
      length: 2,
      numberOfChannels: 2,
      getChannelData: (channel: number) =>
        channel === 0 ? new Float32Array([1, 0.5]) : new Float32Array([-1, 0]),
    } as unknown as AudioBuffer

    const blob = bufferToWave(buffer, 44100)
    const view = new DataView(await blob.arrayBuffer())

    expect(blob.type).toBe('audio/wav')
    expect(blob.size).toBe(44 + 2 * 2 * 2)
    const text = (offset: number, length: number) =>
      Array.from({ length }, (_, i) => String.fromCharCode(view.getUint8(offset + i))).join('')

    expect(text(0, 4)).toBe('RIFF')
    expect(view.getUint32(4, true)).toBe(44)
    expect(text(8, 4)).toBe('WAVE')
    expect(text(12, 4)).toBe('fmt ')
    expect(view.getUint32(16, true)).toBe(16)
    expect(view.getUint16(20, true)).toBe(1)
    expect(view.getUint16(22, true)).toBe(2)
    expect(view.getUint32(24, true)).toBe(44100)
    expect(view.getUint32(28, true)).toBe(44100 * 2 * 2)
    expect(view.getUint16(32, true)).toBe(4)
    expect(view.getUint16(34, true)).toBe(16)
    expect(text(36, 4)).toBe('data')
    expect(view.getUint32(40, true)).toBe(8)

    // 双声道交错：L0 R0 L1 R1
    expect(view.getInt16(44, true)).toBe(0x7fff)
    expect(view.getInt16(46, true)).toBe(-0x8000)
    expect(view.getInt16(48, true)).toBe(16383)
    expect(view.getInt16(50, true)).toBe(0)
  })

  it('采样越界时钳制到 [-1, 1]', async () => {
    const buffer = {
      length: 2,
      numberOfChannels: 1,
      getChannelData: () => new Float32Array([5, -5]),
    } as unknown as AudioBuffer

    const view = new DataView(await bufferToWave(buffer, 8000).arrayBuffer())

    expect(view.getInt16(44, true)).toBe(0x7fff)
    expect(view.getInt16(46, true)).toBe(-0x8000)
  })
})

describe('downloadAndStoreAudio', () => {
  it('skipProcessing 时直接存储原始字节并返回 Data URL 与对象 URL', async () => {
    const bytes = new Uint8Array([1, 2, 3, 255])
    fetchMock.mockResolvedValueOnce(responseLike(new Blob([bytes], { type: 'audio/mpeg' })))

    const result = await downloadAndStoreAudio('https://cdn/a.mp3', 'w1', true)

    expect(fetchMock).toHaveBeenCalledWith('https://cdn/a.mp3', { credentials: 'omit' })
    expect(result).toEqual({
      dataUrl: 'data:audio/mpeg;base64,ZmFrZQ==',
      objectUrl: 'blob:fake-url',
    })
    expect(JSON.parse(storage.getItem('audio_w1')!)).toEqual([1, 2, 3, 255])
    expect(createObjectURL).toHaveBeenCalledOnce()
  })

  it('非 skipProcessing 时重采样到 22050Hz 并输出 WAV', async () => {
    fetchMock.mockResolvedValueOnce(responseLike(new Blob([new Uint8Array([9, 9])], { type: 'audio/mpeg' })))

    const result = await downloadAndStoreAudio('https://cdn/a.mp3', 'w2')

    expect(FakeOfflineAudioContext.instances).toHaveLength(1)
    const offline = FakeOfflineAudioContext.instances[0]
    expect(offline.numberOfChannels).toBe(2)
    expect(offline.length).toBe(Math.floor(0.1 * 22050))
    expect(offline.sampleRate).toBe(22050)
    expect(offline.startRendering).toHaveBeenCalledOnce()

    const source = offline.createBufferSource.mock.results[0].value
    expect(source.buffer).toBe(decodedBuffer)
    expect(source.connect).toHaveBeenCalledWith(offline.destination)
    expect(source.start).toHaveBeenCalledOnce()

    const stored = JSON.parse(storage.getItem('audio_w2')!) as number[]
    expect(stored.length).toBe(44 + 4 * 2)
    expect(String.fromCharCode(...stored.slice(0, 4))).toBe('RIFF')
    expect(result).toEqual({
      dataUrl: 'data:audio/wav;base64,ZmFrZQ==',
      objectUrl: 'blob:fake-url',
    })
  })

  it('HTTP 非 2xx 时按次数重试后返回 null', async () => {
    vi.useFakeTimers()
    fetchMock.mockResolvedValue(responseLike(new Blob([], { type: 'audio/mpeg' }), { ok: false, status: 503 }))

    const promise = downloadAndStoreAudio('https://cdn/a.mp3', 'w3', false, 2)
    await vi.advanceTimersByTimeAsync(5000)
    await expect(promise).resolves.toBeNull()

    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(console.error).toHaveBeenCalledWith('下载失败:', 503, 'OK')
    expect(console.error).toHaveBeenCalledWith('音频下载失败，已重试3次')
    expect(storage.getItem('audio_w3')).toBeNull()
  })

  it('返回 HTML 时视为拦截并重试', async () => {
    vi.useFakeTimers()
    fetchMock.mockResolvedValue(responseLike(new Blob(['<html></html>'], { type: 'text/html' })))

    const promise = downloadAndStoreAudio('https://cdn/a.mp3', 'w4', false, 0)
    await vi.advanceTimersByTimeAsync(10)
    await expect(promise).resolves.toBeNull()

    expect(console.error).toHaveBeenCalledWith('请求被拦截，返回了HTML页面而非音频')
  })

  it('空文件或非音频类型视为无效', async () => {
    fetchMock
      .mockResolvedValueOnce(responseLike(new Blob([], { type: 'audio/mpeg' })))
      .mockResolvedValueOnce(responseLike(new Blob(['abc'], { type: 'text/plain' })))

    await expect(downloadAndStoreAudio('https://cdn/a.mp3', 'w5', false, 0)).resolves.toBeNull()
    await expect(downloadAndStoreAudio('https://cdn/a.mp3', 'w6', false, 0)).resolves.toBeNull()
    expect(console.error).toHaveBeenCalledWith('音频文件无效: 大小为0或类型不正确')
  })

  it('网络异常时返回 null 且不抛出', async () => {
    fetchMock.mockRejectedValueOnce(new Error('offline'))

    await expect(downloadAndStoreAudio('https://cdn/a.mp3', 'w7', false, 0)).resolves.toBeNull()
    expect(console.error).toHaveBeenCalledWith('Failed to download and store audio:', expect.any(Error))
  })

  it('重试后成功则返回结果', async () => {
    vi.useFakeTimers()
    fetchMock
      .mockResolvedValueOnce(responseLike(new Blob([], { type: 'audio/mpeg' }), { ok: false, status: 500 }))
      .mockResolvedValueOnce(responseLike(new Blob([new Uint8Array([7])], { type: 'audio/mpeg' })))

    const promise = downloadAndStoreAudio('https://cdn/a.mp3', 'w8', true, 1)
    await vi.advanceTimersByTimeAsync(1000)
    await expect(promise).resolves.toMatchObject({ objectUrl: 'blob:fake-url' })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(console.log).toHaveBeenCalledWith('第2次重试下载音频...')
    expect(JSON.parse(storage.getItem('audio_w8')!)).toEqual([7])
  })
})

describe('playWordAudio', () => {
  it('传入 http 地址时直接作为音源', async () => {
    const promise = playWordAudio('hello', 'https://cdn/hello.mp3')
    const audio = FakeAudio.instances[0]
    expect(audio.src).toBe('https://cdn/hello.mp3')

    audio.oncanplaythrough!()
    await expect(promise).resolves.toBeUndefined()
    expect(audio.play).toHaveBeenCalledOnce()
  })

  it('传入 data URL 时直接作为音源', async () => {
    const promise = playWordAudio('hello', 'data:audio/wav;base64,AAA')
    const audio = FakeAudio.instances[0]
    expect(audio.src).toBe('data:audio/wav;base64,AAA')

    audio.oncanplaythrough!()
    await expect(promise).resolves.toBeUndefined()
  })

  it('未传发音时使用有道 TTS 地址', async () => {
    translationApiMock.getPronunciationUrlSync.mockReturnValue('https://dict.youdao.com/hello.mp3')

    const promise = playWordAudio('hello')
    expect(translationApiMock.getPronunciationUrlSync).toHaveBeenCalledWith('hello')
    const audio = FakeAudio.instances[0]
    expect(audio.src).toBe('https://dict.youdao.com/hello.mp3')

    audio.oncanplaythrough!()
    await expect(promise).resolves.toBeUndefined()
  })

  it('当前语言无发音地址时拒绝并提示', async () => {
    translationApiMock.getPronunciationUrlSync.mockReturnValue('')

    await expect(playWordAudio('こんにちは')).rejects.toThrow('当前语言不支持有道发音')
  })

  it('play() 失败时以「播放音频失败」拒绝', async () => {
    const promise = playWordAudio('hello', 'https://cdn/a.mp3')
    const audio = FakeAudio.instances[0]
    audio.play.mockRejectedValueOnce(new Error('blocked'))

    const assertion = expect(promise).rejects.toThrow('播放音频失败')
    audio.oncanplaythrough!()
    await assertion
    expect(console.error).toHaveBeenCalledWith('播放音频失败:', expect.any(Error))
  })

  it('音频加载失败时以「音频加载失败」拒绝', async () => {
    const promise = playWordAudio('hello', 'https://cdn/a.mp3')
    const audio = FakeAudio.instances[0]

    const assertion = expect(promise).rejects.toThrow('音频加载失败')
    audio.onerror!()
    await assertion
    expect(console.error).toHaveBeenCalledWith('音频加载失败')
  })

  it('10 秒未就绪时以「音频加载超时」拒绝', async () => {
    vi.useFakeTimers()
    const promise = playWordAudio('hello', 'https://cdn/a.mp3')
    const assertion = expect(promise).rejects.toThrow('音频加载超时')

    await vi.advanceTimersByTimeAsync(10000)
    await assertion
  })
})
