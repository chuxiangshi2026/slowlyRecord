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
import { buildChineseAudioUrls, containsChinese, splitChineseSpeechText } from '@/utils/youdao-tts'
import { getActiveLanguage, getProfile, type LanguageCode } from '@/utils/language'
import { getSpeechAudioUrl } from '@/utils/speech-audio'
import { cdnUrlVariants } from '@/utils/cdn-mirror'

export interface SpeakWordOptions {
  /** 用户主动点发音：失败时允许弹节流提示；自动发音/自动连播一律静默 */
  userInitiated?: boolean
  /** 发音自然播完后的回调（代际校验通过才触发），用于专注模式自动连播推进 */
  onEnded?: () => void
  /** 顺便预取的下一个单词：提前拉取缓存，降低切词后的发音延迟 */
  prefetchNext?: string | null
  /** prefetchNext 词条的预合成音频词库 id（与当前词可能不同库时分别传入） */
  prefetchNextSpeechBankId?: string
  language?: LanguageCode
  /** 词条来自带预合成连读音频的词库（口语句库）：优先播放录音，失败回退在线 TTS */
  speechBankId?: string
  /** 播放语速（0.5–2.0），专注模式语速设置经此透传到底层播放器 */
  rate?: number
}

/** 发言代次：每次 speakWord/stopSpeaking 自增 */
let speakSeq = 0

function buildGoogleAudioUrl(word: string, ttsLang: string): string {
  return `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${ttsLang}&q=${encodeURIComponent(word)}`
}

/** 英语保留有道音源；其他语种使用对应语言的谷歌 TTS。 */
export function buildWordAudioUrls(word: string, language: LanguageCode = getActiveLanguage()): string[] {
  if (language === 'en' && containsChinese(word)) return buildChineseAudioUrls(word)
  const profile = getProfile(language)
  if (profile.code !== 'en') return [buildGoogleAudioUrl(word, profile.ttsLang.split('-')[0])]
  return [
    getPronunciationUrl(word, 'us'),
    buildGoogleAudioUrl(word, 'en')
  ]
}

/** 完整播放音源链：带预合成连读音频的词库把录音地址放最前（含 jsDelivr 镜像容灾），其后维持原 TTS 兜底链 */
export function buildPlayUrls(word: string, language: LanguageCode, speechBankId?: string): string[] {
  const urls = buildWordAudioUrls(word, language)
  if (!speechBankId) return urls
  const speechUrl = getSpeechAudioUrl(speechBankId, word)
  return speechUrl ? [...cdnUrlVariants(speechUrl), ...urls] : urls
}

/**
 * 全局收敛的单词发音入口
 * 调用即接管音频通道：旧发音立刻停止（适配器代次作废），新音频抢占播放
 */
export function speakWord(word: string, options: SpeakWordOptions = {}): void {
  const seq = ++speakSeq
  const tts = getTtsAdapter()
  const language = options.language || getActiveLanguage()

  // 预取下一个词音频（后台写缓存，失败静默，不影响当前播放）
  if (options.prefetchNext) {
    try {
      tts.prefetchAudio?.(buildPlayUrls(options.prefetchNext, language, options.prefetchNextSpeechBankId)[0])
    } catch {
      // 预取能力缺失时忽略，播放时仍走在线地址
    }
  }

  const urls = buildPlayUrls(word, language, options.speechBankId)
  const playAt = (urlIndex: number): void => {
    // 代际丢弃：加载/回退完成前已切词（新的 speakWord 或 stopSpeaking）则不再播
    if (seq !== speakSeq) return
    tts.playAudio(urls[urlIndex], { silent: !options.userInitiated, rate: options.rate }).then(
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

/**
 * 长中文文本朗读：按句切分后逐段走中文音源链（有道智云/百度/谷歌）顺序播放，
 * 规避免费 TTS 对单次请求长度的截断（长文只读开头一段的问题）。
 * 与 speakWord 共用代次令牌：stopSpeaking 或新发音会立即中断连播。
 * 返回是否完整播完（被中断或某段全部音源失败时返回 false）。
 */
export async function speakChineseLongText(
  text: string,
  options: { rate?: number; userInitiated?: boolean } = {},
): Promise<boolean> {
  const seq = ++speakSeq
  const tts = getTtsAdapter()
  const segments = splitChineseSpeechText(text)
  if (!segments.length) return false
  for (let i = 0; i < segments.length; i++) {
    if (seq !== speakSeq) return false
    const urls = buildChineseAudioUrls(segments[i])
    // 边播边预取下一段首选音源，段间无需等网络加载
    if (i + 1 < segments.length) {
      try {
        tts.prefetchAudio?.(buildChineseAudioUrls(segments[i + 1])[0])
      } catch { /* 预取能力缺失时忽略 */ }
    }
    let ok = false
    for (const url of urls) {
      if (seq !== speakSeq) return false
      try {
        await tts.playAudio(url, { silent: !options.userInitiated, rate: options.rate })
        ok = true
        break
      } catch { /* 当前音源失败，换下一音源 */ }
    }
    if (!ok) return false
  }
  return true
}
