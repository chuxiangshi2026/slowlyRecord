/**
 * TTS（语音合成）适配器
 */
import { getPlatform } from './platform'

export interface TtsAdapter {
  /** 播放语音 */
  speak(text: string, options?: { lang?: string; rate?: number; pitch?: number }): void
  /** 停止播放 */
  stop(): void
  /** 播放音频 URL */
  playAudio(url: string): Promise<void>
}

class WebTtsAdapter implements TtsAdapter {
  private currentUtterance: SpeechSynthesisUtterance | null = null
  private currentAudio: HTMLAudioElement | null = null

  speak(text: string, options?: { lang?: string; rate?: number; pitch?: number }): void {
    this.stop()
    const utterance = new SpeechSynthesisUtterance(text)
    if (options?.lang) utterance.lang = options.lang
    if (options?.rate) utterance.rate = options.rate
    if (options?.pitch) utterance.pitch = options.pitch
    this.currentUtterance = utterance
    speechSynthesis.speak(utterance)
  }

  stop(): void {
    speechSynthesis.cancel()
    if (this.currentAudio) {
      this.currentAudio.pause()
      this.currentAudio = null
    }
  }

  async playAudio(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const audio = new Audio(url)
      this.currentAudio = audio
      audio.onended = () => { this.currentAudio = null; resolve() }
      audio.onerror = (e) => { this.currentAudio = null; reject(e) }
      audio.play()
    })
  }
}

class WxTtsAdapter implements TtsAdapter {
  private innerAudio: any = null

  speak(_text: string, _options?: { lang?: string; rate?: number; pitch?: number }): void {
    // 小程序没有原生 SpeechSynthesis，需要使用在线 TTS API
    // 此方法需要配合 TTS API URL 使用 playAudio
    console.warn('WxTtsAdapter.speak: Use playAudio with TTS URL instead')
  }

  stop(): void {
    if (this.innerAudio) {
      this.innerAudio.stop()
      this.innerAudio = null
    }
  }

  async playAudio(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const wx = (window as any).wx
      this.innerAudio = wx.createInnerAudioContext()
      this.innerAudio.src = url
      this.innerAudio.onEnded = () => { this.innerAudio = null; resolve() }
      this.innerAudio.onError = (err: any) => { this.innerAudio = null; reject(err) }
      this.innerAudio.play()
    })
  }
}

let _ttsAdapter: TtsAdapter | null = null

export function getTtsAdapter(): TtsAdapter {
  if (_ttsAdapter) return _ttsAdapter

  const platform = getPlatform()
  switch (platform) {
    case 'mp-weixin':
      _ttsAdapter = new WxTtsAdapter()
      break
    default:
      _ttsAdapter = new WebTtsAdapter()
  }
  return _ttsAdapter
}

export function setTtsAdapter(adapter: TtsAdapter): void {
  _ttsAdapter = adapter
}
