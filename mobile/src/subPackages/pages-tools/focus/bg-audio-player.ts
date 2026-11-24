/**
 * 后台音频播放器（微信小程序 BackgroundAudioManager）
 * 与 InnerAudioContext 播放器的差异：
 * 1. 锁屏/退后台仍可播放（需在 app.json 声明 requiredBackgroundModes: ["audio"]）；
 * 2. 锁屏界面与耳机媒体按键（播放/暂停/上一首/下一首）会派发事件，由页面映射为复习操作；
 * 3. 事件监听全局只能注册（无 off 方法），全部事件在构造时注册一次，经 pending 派发给当前播放。
 * 实现 ListenPlayer 的 WordAudioPlayer 接口，可与 TtsAdapter 互换。
 */

import { parseAudioCacheWord } from '@/adapters/index'

export interface BgRemoteCallbacks {
  /** 锁屏/耳机「下一首」：页面映射为「记住了并切下一词」 */
  onNext?: () => void
  /** 「上一首」：页面映射为「重听当前词」 */
  onPrev?: () => void
  onPlay?: () => void
  onPause?: () => void
  onStop?: () => void
}

/** 无进展看门狗：加载/卡顿时长上限（与 InnerAudioContext 播放器同策略） */
const BG_PLAY_TIMEOUT = 15000

export class BackgroundWordPlayer {
  private bg: any = null
  /** 播放代次：每次 playAudio/stop 自增，旧代次事件一律丢弃 */
  private generation = 0
  /** 当前待落定的播放（事件全局唯一注册，经此派发给最近一次播放） */
  private pending: { gen: number; resolve: () => void; reject: (e: any) => void; timer: ReturnType<typeof setTimeout> } | null = null
  private rate = 1

  static isSupported(): boolean {
    try {
      return typeof (uni as any).getBackgroundAudioManager === 'function'
    } catch {
      return false
    }
  }

  constructor(
    private readonly remote: BgRemoteCallbacks = {},
    private readonly prefetchFn?: (url: string) => void,
  ) {
    try {
      this.bg = (uni as any).getBackgroundAudioManager()
    } catch {
      this.bg = null
      return
    }
    const bg = this.bg
    bg.onEnded(() => this.settleOk())
    bg.onError((err: any) => this.settleErr(err instanceof Error ? err : new Error(err?.errMsg || 'bg audio error')))
    bg.onCanplay(() => {
      this.applyRate()
      this.rearmWatchdog()
    })
    bg.onTimeUpdate(() => this.rearmWatchdog())
    bg.onWaiting(() => this.rearmWatchdog())
    bg.onPlay(() => this.remote.onPlay?.())
    bg.onPause(() => {
      // 暂停后当前播放永远不会有 onEnded：立即作废旧 Promise（听词链按代次丢弃），不等看门狗
      this.settleErr(new Error('bg audio paused'))
      this.remote.onPause?.()
    })
    bg.onStop(() => {
      // 系统侧停止（来电/锁屏停掉）作废旧播放，避免悬挂 Promise
      this.settleErr(new Error('bg audio stopped'))
      this.remote.onStop?.()
    })
    bg.onNext(() => this.remote.onNext?.())
    bg.onPrev(() => this.remote.onPrev?.())
  }

  get available(): boolean {
    return !!this.bg
  }

  /** 语速 0.5–2.0（BackgroundAudioManager.playbackRate，低版本基础库静默忽略） */
  private applyRate(): void {
    if (this.rate === 1) return
    try {
      this.bg.playbackRate = this.rate
    } catch { /* 低版本基础库不支持，按原速播放 */ }
  }

  private rearmWatchdog(): void {
    const p = this.pending
    if (!p) return
    clearTimeout(p.timer)
    p.timer = setTimeout(() => {
      this.settleErr(new Error('bg audio stall timeout'))
    }, BG_PLAY_TIMEOUT)
  }

  /** 当前播放正常结束：落定 Promise（代次不符的事件直接丢弃） */
  private settleOk(): void {
    const p = this.pending
    if (!p || p.gen !== this.generation) return
    this.pending = null
    clearTimeout(p.timer)
    p.resolve()
  }

  private settleErr(err: any): void {
    const p = this.pending
    if (!p) return
    this.pending = null
    clearTimeout(p.timer)
    p.reject(err)
  }

  /** 预取音频：委托给共享本地缓存（InnerAudioContext 播放器的缓存清单同一份） */
  prefetchAudio(url: string): void {
    try {
      this.prefetchFn?.(url)
    } catch { /* 预取失败静默 */ }
  }

  playAudio(url: string, options?: { rate?: number }): Promise<void> {
    const bg = this.bg
    if (!bg) return Promise.reject(new Error('background audio unavailable'))
    // 被取代的旧播放以失败落定：上游代次校验会丢弃该失败，Promise 不悬挂
    this.settleErr(new Error('bg audio superseded'))
    const gen = ++this.generation
    this.rate = typeof options?.rate === 'number' ? Math.min(2, Math.max(0.5, options.rate)) : 1
    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.settleErr(new Error('bg audio stall timeout'))
      }, BG_PLAY_TIMEOUT)
      this.pending = { gen, resolve, reject, timer }
      try {
        // title 为必填，缺失会直接报错不发声；用单词文本，锁屏界面同时展示
        bg.title = parseAudioCacheWord(url) || '慢记专注'
        bg.epname = '慢记'
        bg.singer = '专注连播'
        bg.src = url
        // 设置 src 后自动加载播放（无需显式 play）
      } catch (e) {
        this.settleErr(e)
      }
    })
  }

  stop(): void {
    this.generation++
    this.settleErr(new Error('bg audio stopped'))
    try {
      this.bg?.stop?.()
    } catch { /* 静默 */ }
  }

  /** 暂停（保留锁屏控制条与当前进度）：作废旧播放 Promise，恢复时由调用方重新起播 */
  pause(): void {
    this.generation++
    this.settleErr(new Error('bg audio paused'))
    try {
      this.bg?.pause?.()
    } catch { /* 静默 */ }
  }
}
