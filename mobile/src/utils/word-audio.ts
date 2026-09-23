/**
 * 单词发音统一入口（移动端小程序）
 * 收敛复习页/专注模式/听写/错题页的发音调用，解决四类问题：
 * 1. 播新音前强制停旧音：所有发音都走同一个 TTS 适配器单例，playOnce 开始即销毁旧实例；
 * 2. 代际令牌防抢跑：speakSeq 记录当前发言代次，异步音源回退完成时若已切词则丢弃，不播过期音频；
 * 3. 预取下一个：发音当前词时后台把下一个词的音频拉进本地缓存，切词后命中缓存即时发音；
 * 4. 失败提示降噪：自动发音/自动连播失败静默，仅用户主动点发音才弹节流提示（适配器侧 3 秒节流）。
 */

import { getTtsAdapter } from '@/adapters/index'
import { getPronunciationUrl } from '@/stores/useUtils/offline-dict'
import { buildChineseAudioUrls, containsChinese } from '@/utils/youdao-tts'

export interface SpeakWordOptions {
  /** 用户主动点发音：失败时允许弹节流提示；自动发音/自动连播一律静默 */
  userInitiated?: boolean
  /** 发音自然播完后的回调（代际校验通过才触发），用于专注模式自动连播推进 */
  onEnded?: () => void
  /** 顺便预取的下一个单词：提前拉取缓存，降低切词后的发音延迟 */
  prefetchNext?: string | null
}

/** 发言代次：每次 speakWord/stopSpeaking 自增 */
let speakSeq = 0

/**
 * 构建单词发音音源列表。
 * 英文：有道 dictvoice 优先，谷歌翻译 TTS 兜底；
 * 中文：dictvoice 不支持中文（实测返回 500），改走有道智云 TTS（用户已配密钥）→ 谷歌翻译 TTS（tl=zh-CN）兜底。
 */
export function buildWordAudioUrls(word: string): string[] {
  if (containsChinese(word)) return buildChineseAudioUrls(word)
  return [
    getPronunciationUrl(word, 'us'),
    `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=en&q=${encodeURIComponent(word)}`
  ]
}

/**
 * 全局收敛的单词发音入口
 * 调用即接管音频通道：旧发音立刻停止（适配器代次作废），新音频抢占播放
 */
export function speakWord(word: string, options: SpeakWordOptions = {}): void {
  const seq = ++speakSeq
  const tts = getTtsAdapter()

  // 预取下一个词音频（后台写缓存，失败静默，不影响当前播放）
  if (options.prefetchNext) {
    try {
      const next = options.prefetchNext
      tts.prefetchAudio?.(containsChinese(next) ? buildChineseAudioUrls(next)[0] : getPronunciationUrl(next))
    } catch {
      // 预取能力缺失时忽略，播放时仍走在线地址
    }
  }

  const urls = buildWordAudioUrls(word)
  const playAt = (urlIndex: number): void => {
    // 代际丢弃：加载/回退完成前已切词（新的 speakWord 或 stopSpeaking）则不再播
    if (seq !== speakSeq) return
    tts.playAudio(urls[urlIndex], { silent: !options.userInitiated }).then(
      () => {
        if (seq !== speakSeq) return
        options.onEnded?.()
      },
      () => {
        if (seq !== speakSeq) return
        if (urlIndex + 1 < urls.length) {
          // 当前音源失败，换兜底音源重试
          playAt(urlIndex + 1)
        }
      }
    )
  }
  playAt(0)
}

/** 停止当前发音并作废所有待完成的音源回退（切词/退出页面时调用） */
export function stopSpeaking(): void {
  speakSeq++
  try {
    getTtsAdapter().stop()
  } catch {
    // TTS 不可用，静默失败
  }
}
