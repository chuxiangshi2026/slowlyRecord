/**
 * 连播听词播放控制器（纯逻辑，不依赖 uni API，可单测）
 * 流程：播放单词发音 → 停顿 → 自动推进下一个；发音失败按音源回退，全部失败则跳过该词。
 */

export interface WordAudioPlayer {
  playAudio(url: string): Promise<void>
}

export interface ListenPlayCallbacks {
  /** 当前词下标变化（推进 / 上一个 / 下一个） */
  onIndexChange?: (index: number) => void
  /** 播完最后一个词 */
  onFinished?: () => void
  /** 某词所有音源均播放失败（已自动跳过） */
  onError?: (index: number) => void
}

/** 构建单词发音音源列表：有道优先，谷歌翻译 TTS 兜底 */
export function buildWordAudioUrls(word: string): string[] {
  return [
    `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(word)}&type=2`,
    `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=en&q=${encodeURIComponent(word)}`
  ]
}

export class ListenPlayer {
  private index = 0
  private pauseTimer: ReturnType<typeof setTimeout> | null = null
  private playing = false
  private finished = false
  /** 会话代次：销毁/重建后旧 playAudio 的回调一律作废 */
  private session = 0

  constructor(
    private readonly words: string[],
    private readonly player: WordAudioPlayer,
    private readonly getPauseMs: () => number,
    private readonly callbacks: ListenPlayCallbacks = {}
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
    this.playCurrent(this.session)
  }

  /** 暂停：停止调度；进行中的音频由调用方负责 stop，恢复时从当前词重播 */
  pause(): void {
    this.playing = false
    this.clearPauseTimer()
  }

  resume(): void {
    if (this.playing || this.finished) return
    this.playing = true
    this.playCurrent(this.session)
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
    this.playCurrent(this.session)
  }

  private playCurrent(session: number): void {
    if (session !== this.session || !this.playing || this.finished) return
    const word = this.words[this.index]
    if (!word) {
      this.finish()
      return
    }
    this.playWithFallback(buildWordAudioUrls(word), 0, session)
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
          this.advance(session)
        }
      }
    )
  }

  private scheduleNext(session: number): void {
    this.clearPauseTimer()
    this.pauseTimer = setTimeout(() => {
      this.pauseTimer = null
      if (session !== this.session || !this.playing) return
      this.advance(session)
    }, Math.max(0, this.getPauseMs()))
  }

  private advance(session: number): void {
    if (this.index < this.words.length - 1) {
      this.index++
      this.callbacks.onIndexChange?.(this.index)
      this.playCurrent(session)
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
