/**
 * 连播听词播放控制器（不直接依赖 uni API，可单测）
 * 流程：播放单词发音 → 停顿 → 自动推进下一个；发音失败按音源回退，全部失败则跳过该词。
 */

import { buildWordAudioUrls, buildPlayUrls } from '@/utils/word-audio'
import { getActiveLanguage, type LanguageCode } from '@/utils/language'

export { buildWordAudioUrls }

export interface WordAudioPlayer {
  playAudio(url: string, options?: { rate?: number }): Promise<void>
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
  /** 当前词剩余重播遍数（发音遍数 >1 时，播完一遍同词重播再推进） */
  private repeatLeft = 1
  /** 当前词的释义发音队列：单词（含重播）播完后逐段播放，播完再进入词间停顿 */
  private meaningQueue: string[][] = []
  /** 当前播放阶段：释义阶段音源失败只静默跳过，不当成整词失败 */
  private stage: 'word' | 'meaning' = 'word'

  constructor(
    private readonly words: string[],
    private readonly player: WordAudioPlayer,
    private readonly getPauseMs: () => number,
    private readonly callbacks: ListenPlayCallbacks = {},
    private readonly language: LanguageCode = getActiveLanguage(),
    /** 播放语速（0.5–2.0），getter 形式便于设置变更后下次起播即生效 */
    private readonly getRate: () => number = () => 1,
    /** 每词发音遍数，getter 形式同上 */
    private readonly getRepeatCount: () => number = () => 1,
    /** 与 words 对齐的预合成音频词库 id（口语句库词条优先播录音，缺失位置传 undefined） */
    private readonly speechBankIds: (string | undefined)[] = [],
    /** 释义（中文翻译）发音：返回按顺序播放的多个「音源回退链」单元，空数组表示该词不读释义 */
    private readonly getMeaningUnits?: (index: number) => string[][]
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
    this.repeatLeft = Math.max(1, Math.floor(this.getRepeatCount()))
    this.stage = 'word'
    this.meaningQueue = this.getMeaningUnits?.(this.index) ?? []
    this.playWithFallback(buildPlayUrls(word, this.language, this.speechBankIds[this.index]), 0, session)
    // 预取后续 3 个词的发音与释义首选音源（适配器内部按本地缓存去重，重复预取代价极低）
    for (let ahead = 1; ahead <= 3; ahead++) {
      const nextWord = this.words[this.index + ahead]
      if (!nextWord) break
      const nextUrl = buildPlayUrls(nextWord, this.language, this.speechBankIds[this.index + ahead])[0]
      if (nextUrl) this.player.prefetchAudio?.(nextUrl)
      const nextMeaning = this.getMeaningUnits?.(this.index + ahead)?.[0]?.[0]
      if (nextMeaning) this.player.prefetchAudio?.(nextMeaning)
    }
  }

  private playWithFallback(urls: string[], urlIndex: number, session: number): void {
    if (session !== this.session || !this.playing) return
    this.player.playAudio(urls[urlIndex], { rate: this.getRate() }).then(
      () => {
        if (session !== this.session || !this.playing) return
        // 遍数未完：同词重播一遍（音频已命中本地缓存，重播无网络开销）
        if (this.stage === 'word' && this.repeatLeft > 1) {
          this.repeatLeft--
          this.playWithFallback(urls, 0, session)
          return
        }
        // 单词读完轮到释义：逐段连读中文翻译，全部读完再进入词间停顿
        if (this.stage === 'word' && this.meaningQueue.length > 0) {
          this.stage = 'meaning'
          this.playWithFallback(this.meaningQueue.shift()!, 0, session)
          return
        }
        if (this.stage === 'meaning' && this.meaningQueue.length > 0) {
          this.playWithFallback(this.meaningQueue.shift()!, 0, session)
          return
        }
        this.scheduleNext(session)
      },
      () => {
        if (session !== this.session || !this.playing) return
        if (urlIndex + 1 < urls.length) {
          // 当前音源失败，换兜底音源重试
          this.playWithFallback(urls, urlIndex + 1, session)
          return
        }
        if (this.stage === 'meaning') {
          // 释义音源全失败：静默跳过该段，继续后续段落或进入停顿（不惊动整词失败流程）
          if (this.meaningQueue.length > 0) {
            this.playWithFallback(this.meaningQueue.shift()!, 0, session)
            return
          }
          this.scheduleNext(session)
          return
        }
        // 全部音源失败：跳过该词，不卡住播放队列
        this.callbacks.onError?.(this.index)
        this.advance()
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
