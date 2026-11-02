/**
 * 连播听词播放控制器（不直接依赖 uni API，可单测）
 * 流程：播放单词发音 → 停顿 → 自动推进下一个；发音失败按音源回退，全部失败则跳过该词。
 */

import { buildWordAudioUrls } from '@/utils/word-audio'
import { getActiveLanguage, type LanguageCode } from '@/utils/language'

export { buildWordAudioUrls }

export interface WordAudioPlayer {
  playAudio(url: string): Promise<void>
  prefetchAudio?(url: string): void
}

export interface ListenPlayCallbacks {
  /** 当前词下标变化（推进 / 上一个 / 下一个） */
  onIndexChange?: (index: number) => void
  /** 播完最后一个词 */
  onFinished?: () => void
  /** 某词所有音源均播放失败（已自动跳过） */
  onError?: (index: number) => void
}

export class ListenPlayer {
  private index = 0
  private pauseTimer: ReturnType<typeof setTimeout> | null = null
  private playing = false
  private finished = false
  /** 播放代次：每次起播、暂停或销毁后，旧 playAudio 的回调一律作废 */
  private session = 0

  constructor(
    private readonly words: string[],
    private readonly player: WordAudioPlayer,
    private readonly getPauseMs: () => number,
    private readonly callbacks: ListenPlayCallbacks = {},
    private readonly language: LanguageCode = getActiveLanguage()
  ) {}

  get currentIndex(): number {
    return this.index
  }

  get isPlaying(): boolean {
    return this.playing
  }

  start(): void {
    if (this.playing || this.finished) return
    this.playing = true
    this.playCurrent()
  }

  /** 暂停：停止调度；进行中的音频由调用方负责 stop，恢复时从当前词重播 */
  pause(): void {
    this.session++
    this.playing = false
    this.clearPauseTimer()
  }

  resume(): void {
    if (this.playing || this.finished) return
    this.playing = true
    this.playCurrent()
  }

  /** 上一个词（到首个则重播当前词）；暂停状态下仅切换下标 */
  prev(): void {
    if (this.index > 0) {
      this.index--
      this.callbacks.onIndexChange?.(this.index)
    }
    this.replayCurrent()
  }

  /** 下一个词；已是最后一个则结束 */
  next(): void {
    if (this.index < this.words.length - 1) {
      this.index++
      this.callbacks.onIndexChange?.(this.index)
      this.replayCurrent()
    } else {
      this.finish()
    }
  }

  destroy(): void {
    this.session++
    this.playing = false
    this.clearPauseTimer()
  }

  private replayCurrent(): void {
    if (!this.playing || this.finished) return
    this.clearPauseTimer()
    this.playCurrent()
  }

  private playCurrent(): void {
    if (!this.playing || this.finished) return
    const session = ++this.session
    const word = this.words[this.index]
    if (!word) {
      this.finish()
      return
    }
    this.playWithFallback(buildWordAudioUrls(word, this.language), 0, session)
    const nextWord = this.words[this.index + 1]
    if (nextWord) {
      const nextUrl = buildWordAudioUrls(nextWord, this.language)[0]
      if (nextUrl) this.player.prefetchAudio?.(nextUrl)
    }
  }

  private playWithFallback(urls: string[], urlIndex: number, session: number): void {
    if (session !== this.session || !this.playing) return
    this.player.playAudio(urls[urlIndex]).then(
      () => {
        if (session !== this.session || !this.playing) return
        this.scheduleNext(session)
      },
      () => {
        if (session !== this.session || !this.playing) return
        if (urlIndex + 1 < urls.length) {
          // 当前音源失败，换兜底音源重试
          this.playWithFallback(urls, urlIndex + 1, session)
        } else {
          // 全部音源失败：跳过该词，不卡住播放队列
          this.callbacks.onError?.(this.index)
          this.advance()
        }
      }
    )
  }

  private scheduleNext(session: number): void {
    this.clearPauseTimer()
    this.pauseTimer = setTimeout(() => {
      this.pauseTimer = null
      if (session !== this.session || !this.playing) return
      this.advance()
    }, Math.max(0, this.getPauseMs()))
  }

  private advance(): void {
    if (this.index < this.words.length - 1) {
      this.index++
      this.callbacks.onIndexChange?.(this.index)
      this.playCurrent()
    } else {
      this.finish()
    }
  }

  private finish(): void {
    this.finished = true
    this.playing = false
    this.clearPauseTimer()
    this.callbacks.onFinished?.()
  }

  private clearPauseTimer(): void {
    if (this.pauseTimer) {
      clearTimeout(this.pauseTimer)
      this.pauseTimer = null
    }
  }
}
