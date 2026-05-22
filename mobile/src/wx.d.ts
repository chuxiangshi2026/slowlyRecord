/**
 * 微信小程序 wx 全局对象类型声明
 * 仅声明项目中实际使用的 API
 */
declare const wx: {
  arrayBufferToBase64(buffer: ArrayBuffer): string
  base64ToArrayBuffer(base64: string): ArrayBuffer
} | undefined

/**
 * WechatMiniprogram 命名空间声明
 * 仅声明项目中实际使用的类型
 */
declare namespace WechatMiniprogram {
  interface InnerAudioContext {
    src: string
    play(): void
    pause(): void
    stop(): void
    destroy(): void
    onPlay(callback: () => void): void
    onPause(callback: () => void): void
    onStop(callback: () => void): void
    onEnded(callback: () => void): void
    onError(callback: (res: { errCode: number; errMsg: string }) => void): void
    onTimeUpdate(callback: () => void): void
    onCanplay(callback: () => void): void
    onWaiting(callback: () => void): void
    onSeeking(callback: () => void): void
    onSeeked(callback: () => void): void
    offCanplay(callback: () => void): void
    offPlay(callback: () => void): void
    offPause(callback: () => void): void
    offStop(callback: () => void): void
    offEnded(callback: () => void): void
    offError(callback: () => void): void
    offTimeUpdate(callback: () => void): void
    offWaiting(callback: () => void): void
    offSeeking(callback: () => void): void
    offSeeked(callback: () => void): void
    volume: number
    startTime: number
    duration: number
    currentTime: number
    paused: boolean
    buffered: number
  }
}
