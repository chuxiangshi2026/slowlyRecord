/**
 * TTS（语音合成）适配器
 */
import { getPlatform } from './platform'
import { selectBestVoice } from './speech-voice'

export interface TtsAdapter {
  /** 播放语音 */
  speak(text: string, options?: { lang?: string; rate?: number; pitch?: number }): void
  /** 停止播放 */
  stop(): void
  /** 播放音频 URL */
  playAudio(url: string): Promise<void>
}

/**
 * 默认语速：speak 未显式传 rate 时使用。
 * 设置页目前没有语速项，先留模块级默认值；后续加设置 UI 时用 setDefaultSpeechRate 接入即可。
 */
let defaultSpeechRate = 1

export function setDefaultSpeechRate(rate: number): void {
  if (typeof rate === 'number' && isFinite(rate) && rate > 0 && rate <= 4) {
    defaultSpeechRate = rate
  }
}

export function getDefaultSpeechRate(): number {
  return defaultSpeechRate
}

/** voiceschanged 等待上限：语音列表异步加载，首句选音最多等这么久，超时按当前列表（可能为空）播放 */
const VOICES_READY_TIMEOUT = 300

class WebTtsAdapter implements TtsAdapter {
  private currentUtterance: SpeechSynthesisUtterance | null = null
  private currentAudio: HTMLAudioElement | null = null
  /** 语音列表缓存：voiceschanged 时刷新；曾拿到非空列表即视为就绪 */
  private voices: SpeechSynthesisVoice[] = []
  private voicesReady = false
  /** 发言代次：等待语音列表期间被新 speak/stop 取代则丢弃，防止过期语音抢播 */
  private speakToken = 0

  constructor() {
    this.refreshVoices()
    try {
      if (typeof speechSynthesis !== 'undefined' && typeof speechSynthesis.addEventListener === 'function') {
        speechSynthesis.addEventListener('voiceschanged', () => this.refreshVoices())
      }
    } catch {
      // 无 speechSynthesis 的环境（单测）忽略
    }
  }

  private refreshVoices(): void {
    try {
      if (typeof speechSynthesis === 'undefined') return
      const list = speechSynthesis.getVoices() || []
      this.voices = list
      if (list.length > 0) this.voicesReady = true
    } catch {
      // 忽略，保留旧列表
    }
  }

  /** 等待语音列表加载（voiceschanged 或超时），就绪后回调 */
  private waitVoicesReady(timeoutMs: number): Promise<void> {
    return new Promise(resolve => {
      const synth = typeof speechSynthesis !== 'undefined' ? speechSynthesis : null
      if (!synth || typeof synth.addEventListener !== 'function') {
        resolve()
        return
      }
      let timer: ReturnType<typeof setTimeout> | null = null
      const cleanup = () => {
        if (timer) clearTimeout(timer)
        try {
          synth.removeEventListener('voiceschanged', onChanged)
        } catch {
          // ignore
        }
      }
      function onChanged() {
        cleanup()
        resolve()
      }
      timer = setTimeout(cleanup, timeoutMs)
      synth.addEventListener('voiceschanged', onChanged)
    })
  }

  speak(text: string, options?: { lang?: string; rate?: number; pitch?: number }): void {
    this.stop()
    const token = ++this.speakToken
    // 指定了语言且语音列表尚未就绪时，短暂等待 voiceschanged，避免首句落到系统默认音
    if (options?.lang && !this.voicesReady && typeof speechSynthesis !== 'undefined') {
      void this.waitVoicesReady(VOICES_READY_TIMEOUT).then(() => {
        this.refreshVoices()
        this.speakNow(token, text, options)
      })
    } else {
      this.speakNow(token, text, options)
    }
  }

  private speakNow(token: number, text: string, options?: { lang?: string; rate?: number; pitch?: number }): void {
    // 代际校验：等待期间已被新发言/停止取代则丢弃
    if (token !== this.speakToken) return
    const utterance = new SpeechSynthesisUtterance(text)
    if (options?.lang) {
      utterance.lang = options.lang
      // 按语言选高质量语音（Natural/Google/Microsoft 系），无匹配则保持系统默认音
      const voice = selectBestVoice(this.voices, options.lang)
      if (voice) utterance.voice = voice
    }
    utterance.rate = options?.rate ?? defaultSpeechRate
    if (options?.pitch) utterance.pitch = options.pitch
    this.currentUtterance = utterance
    speechSynthesis.speak(utterance)
  }

  stop(): void {
    this.speakToken++
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

class DouyinTtsAdapter implements TtsAdapter {
  private innerAudio: any = null

  speak(_text: string, _options?: { lang?: string; rate?: number; pitch?: number }): void {
    // 抖音小程序没有原生 SpeechSynthesis，需要使用在线 TTS API
    console.warn('DouyinTtsAdapter.speak: Use playAudio with TTS URL instead')
  }

  stop(): void {
    if (this.innerAudio) {
      this.innerAudio.stop()
      this.innerAudio = null
    }
  }

  async playAudio(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const tt = (window as any).tt
      this.innerAudio = tt.createInnerAudioContext()
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
    case 'mp-douyin':
      _ttsAdapter = new DouyinTtsAdapter()
      break
    default:
      _ttsAdapter = new WebTtsAdapter()
  }
  return _ttsAdapter
}

export function setTtsAdapter(adapter: TtsAdapter): void {
  _ttsAdapter = adapter
}
