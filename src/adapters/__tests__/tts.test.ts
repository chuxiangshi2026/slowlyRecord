/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getTtsAdapter, setTtsAdapter, type TtsAdapter } from '../tts'
import { resetPlatformCache, setPlatform } from '../platform'

describe('tts adapter', () => {
  beforeEach(() => {
    setTtsAdapter(null as any)
    resetPlatformCache()
    // Mock SpeechSynthesisUtterance for jsdom
    if (typeof SpeechSynthesisUtterance === 'undefined') {
      ;(globalThis as any).SpeechSynthesisUtterance = class {
        text: string = ''
        lang: string = ''
        rate: number = 1
        pitch: number = 1
        volume: number = 1
        voice: any = null
        constructor(text: string) {
          this.text = text
        }
      }
    }
  })

  describe('setTtsAdapter / getTtsAdapter', () => {
    it('应该允许手动设置适配器', () => {
      const mockAdapter: TtsAdapter = {
        speak: vi.fn(),
        stop: vi.fn(),
        playAudio: vi.fn(async () => {}),
      }
      setTtsAdapter(mockAdapter)
      expect(getTtsAdapter()).toBe(mockAdapter)
    })

    it('手动设置后返回相同实例', () => {
      const mockAdapter: TtsAdapter = {
        speak: vi.fn(),
        stop: vi.fn(),
        playAudio: vi.fn(async () => {}),
      }
      setTtsAdapter(mockAdapter)
      const a1 = getTtsAdapter()
      const a2 = getTtsAdapter()
      expect(a1).toBe(a2)
    })
  })

  describe('WebTtsAdapter (默认平台)', () => {
    beforeEach(() => {
      setPlatform('web')
      setTtsAdapter(null as any)
      // Mock SpeechSynthesis
      Object.defineProperty(window, 'speechSynthesis', {
        value: {
          speak: vi.fn(),
          cancel: vi.fn(),
          getVoices: vi.fn(() => []),
        },
        writable: true,
      })
    })

    it('在 web 平台下返回 WebTtsAdapter 实例', () => {
      const adapter = getTtsAdapter()
      expect(adapter).toBeDefined()
      expect(typeof adapter.speak).toBe('function')
      expect(typeof adapter.stop).toBe('function')
      expect(typeof adapter.playAudio).toBe('function')
    })

    it('speak 应该调用 speechSynthesis.speak', () => {
      const adapter = getTtsAdapter()
      adapter.speak('hello')
      expect(window.speechSynthesis.speak).toHaveBeenCalled()
      const utterance = (window.speechSynthesis.speak as any).mock.calls[0][0]
      expect(utterance.text).toBe('hello')
    })

    it('speak 应该先停止之前的播放', () => {
      const adapter = getTtsAdapter()
      adapter.speak('hello')
      adapter.speak('world')
      expect(window.speechSynthesis.cancel).toHaveBeenCalled()
    })

    it('speak 支持 options 参数', async () => {
      const adapter = getTtsAdapter()
      adapter.speak('bonjour', { lang: 'fr', rate: 0.8, pitch: 1.2 })
      // 指定 lang 时会先等语音列表（mock 无 addEventListener，立即就绪），异步一拍后真正发声
      await new Promise(resolve => setTimeout(resolve, 0))
      const utterance = (window.speechSynthesis.speak as any).mock.calls[0][0]
      expect(utterance.lang).toBe('fr')
      expect(utterance.rate).toBe(0.8)
      expect(utterance.pitch).toBe(1.2)
    })

    it('speak 不带 options 使用默认值', () => {
      const adapter = getTtsAdapter()
      adapter.speak('test')
      const utterance = (window.speechSynthesis.speak as any).mock.calls[0][0]
      expect(utterance.lang).toBe('')
      expect(utterance.rate).toBe(1)
      expect(utterance.pitch).toBe(1)
    })

    it('stop 应该调用 speechSynthesis.cancel', () => {
      const adapter = getTtsAdapter()
      adapter.stop()
      expect(window.speechSynthesis.cancel).toHaveBeenCalled()
    })

    it('多次 speak 不会重复取消', () => {
      const adapter = getTtsAdapter()
      adapter.speak('one')
      expect(window.speechSynthesis.cancel).toHaveBeenCalled()
      vi.clearAllMocks()
      adapter.speak('two')
      // cancel 会被再次调用（因为第一次 speak 也会调 cancel）
      expect(window.speechSynthesis.cancel).toHaveBeenCalled()
    })

    it('指定 lang 时按质量选 voice（Natural > Google > Microsoft）', async () => {
      const zhVoices = [
        { name: 'Microsoft Huihui - Chinese', lang: 'zh-CN', localService: true, default: false },
        { name: 'Google 普通话（中国大陆）', lang: 'zh-CN', localService: false, default: false },
        { name: 'Microsoft Xiaoxiao Online (Natural) - Chinese', lang: 'zh-CN', localService: false, default: false },
      ]
      ;(window.speechSynthesis.getVoices as any).mockReturnValue(zhVoices)
      const adapter = getTtsAdapter()
      adapter.speak('你好', { lang: 'zh-CN' })
      await new Promise(resolve => setTimeout(resolve, 0))
      const utterance = (window.speechSynthesis.speak as any).mock.calls[0][0]
      expect(utterance.voice?.name).toBe('Microsoft Xiaoxiao Online (Natural) - Chinese')
    })

    it('语音列表未就绪时等待 voiceschanged，期间 stop 则丢弃待发语音', async () => {
      let voicesChangedHandler: (() => void) | null = null
      Object.defineProperty(window, 'speechSynthesis', {
        value: {
          speak: vi.fn(),
          cancel: vi.fn(),
          getVoices: vi.fn(() => []),
          addEventListener: vi.fn((_event: string, handler: () => void) => { voicesChangedHandler = handler }),
          removeEventListener: vi.fn(),
        },
        writable: true,
      })
      const adapter = getTtsAdapter()
      adapter.speak('你好', { lang: 'zh-CN' })
      adapter.stop()
      // 模拟语音列表加载完成：待发语音应被代际丢弃，不再 speak
      voicesChangedHandler?.()
      await new Promise(resolve => setTimeout(resolve, 0))
      expect(window.speechSynthesis.speak).not.toHaveBeenCalled()
    })
  })

  describe('WxTtsAdapter', () => {
    beforeEach(() => {
      setPlatform('mp-weixin')
      setTtsAdapter(null as any)
      ;(window as any).wx = {
        createInnerAudioContext: vi.fn(() => ({
          src: '',
          play: vi.fn(),
          stop: vi.fn(),
          onEnded: null as any,
          onError: null as any,
        })),
      }
    })

    afterEach(() => {
      delete (window as any).wx
    })

    it('在 mp-weixin 平台下返回 WxTtsAdapter 实例', () => {
      const adapter = getTtsAdapter()
      expect(adapter).toBeDefined()
    })

    it('speak 在小程序中仅输出警告', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const adapter = getTtsAdapter()
      adapter.speak('hello')
      expect(warnSpy).toHaveBeenCalledWith(
        'WxTtsAdapter.speak: Use playAudio with TTS URL instead'
      )
      warnSpy.mockRestore()
    })

    it('stop 应该停止内部音频', () => {
      const adapter = getTtsAdapter()
      adapter.stop()
      // 初始时 innerAudio 为 null，不应报错
    })

    it('playAudio 应该创建 innerAudioContext', async () => {
      const adapter = getTtsAdapter()
      const playPromise = adapter.playAudio('https://example.com/audio.mp3')
      expect((window as any).wx.createInnerAudioContext).toHaveBeenCalled()
      const audioCtx = (window as any).wx.createInnerAudioContext.mock.results[0].value
      expect(audioCtx.src).toBe('https://example.com/audio.mp3')
      // 模拟播放完成
      audioCtx.onEnded()
      await playPromise
    })

    it('playAudio 错误处理', () => {
      const adapter = getTtsAdapter()
      const playPromise = adapter.playAudio('bad-url')
      const audioCtx = (window as any).wx.createInnerAudioContext.mock.results[0].value
      audioCtx.onError(new Error('Playback error'))
      return expect(playPromise).rejects.toBeDefined()
    })
  })

  describe('DouyinTtsAdapter', () => {
    beforeEach(() => {
      setPlatform('mp-douyin')
      setTtsAdapter(null as any)
      ;(window as any).tt = {
        createInnerAudioContext: vi.fn(() => ({
          src: '',
          play: vi.fn(),
          stop: vi.fn(),
          onEnded: null as any,
          onError: null as any,
        })),
      }
    })

    afterEach(() => {
      delete (window as any).tt
    })

    it('在 mp-douyin 平台下返回 DouyinTtsAdapter 实例', () => {
      const adapter = getTtsAdapter()
      expect(adapter).toBeDefined()
    })

    it('speak 在抖音小程序中仅输出警告', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const adapter = getTtsAdapter()
      adapter.speak('hello')
      expect(warnSpy).toHaveBeenCalledWith(
        'DouyinTtsAdapter.speak: Use playAudio with TTS URL instead'
      )
      warnSpy.mockRestore()
    })

    it('stop 应该停止内部音频', () => {
      const adapter = getTtsAdapter()
      adapter.stop()
      // 初始时 innerAudio 为 null，不应报错
    })

    it('playAudio 应该创建 innerAudioContext', async () => {
      const adapter = getTtsAdapter()
      const playPromise = adapter.playAudio('https://example.com/audio.mp3')
      expect((window as any).tt.createInnerAudioContext).toHaveBeenCalled()
      const audioCtx = (window as any).tt.createInnerAudioContext.mock.results[0].value
      expect(audioCtx.src).toBe('https://example.com/audio.mp3')
      // 模拟播放完成
      audioCtx.onEnded()
      await playPromise
    })

    it('playAudio 错误处理', () => {
      const adapter = getTtsAdapter()
      const playPromise = adapter.playAudio('bad-url')
      const audioCtx = (window as any).tt.createInnerAudioContext.mock.results[0].value
      audioCtx.onError(new Error('Playback error'))
      return expect(playPromise).rejects.toBeDefined()
    })
  })

  describe('工厂方法缓存', () => {
    it('多次调用返回相同实例', () => {
      setPlatform('web')
      setTtsAdapter(null as any)
      const a1 = getTtsAdapter()
      const a2 = getTtsAdapter()
      expect(a1).toBe(a2)
    })
  })
})
