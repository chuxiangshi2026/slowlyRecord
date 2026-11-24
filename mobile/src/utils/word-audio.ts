/**
 * 单词发音统一入口（移动端小程序）
 * 收敛复习页/专注模式/听写/错题页的发音调用，解决四类问题：
 * 1. 播新音前强制停旧音：所有发音都走同一个 TTS 适配器单例，playOnce 开始即销毁旧实例；
 * 2. 代际令牌防抢跑：speakSeq 记录当前发言代次，异步音源回退完成时若已切词则丢弃，不播过期音频；
 * 3. 预取下一个：发音当前词时后台把下一个词的音频拉进本地缓存，切词后命中缓存即时发音；
 * 4. 失败提示降噪：音源链回退全程静默（避免「先弹错误提示、后正常发音」），
 *    仅整条链全部失败且为用户主动发音时弹一次节流提示（模块侧 3 秒节流）。
 */

import { getTtsAdapter, type TtsAdapter } from '@/adapters/index'
import { getPronunciationUrl } from '@/stores/useUtils/offline-dict'
import { buildChineseAudioUrls, buildBaiduTtsUrl, containsChinese, splitChineseSpeechText } from '@/utils/youdao-tts'
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

let lastFailToastAt = 0
/** 全音源失败后的节流提示（3 秒）：整条链回退完毕仍失败才弹，避免中途误报 */
function toastFailThrottled(): void {
  const now = Date.now()
  if (now - lastFailToastAt < 3000) return
  lastFailToastAt = now
  try {
    uni.showToast({ title: '发音失败，请检查网络', icon: 'none' })
  } catch { /* 测试环境无 uni */ }
}

function buildGoogleAudioUrl(word: string, ttsLang: string): string {
  return `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${ttsLang}&q=${encodeURIComponent(word)}`
}

/** 长句判定：含空格且较长/多词。dictvoice 对长句易 500 且每次失败都带重试延迟，句子改由百度 uk 首发 */
function isSentenceLike(text: string): boolean {
  const t = text.trim()
  return t.includes(' ') && (t.length > 20 || t.split(/\s+/).length >= 4)
}

/** 英语：单词走 dictvoice 首发（快、音质好），句子走百度 uk 首发（dictvoice 长句易失败、谷歌境内被阻断）；其他语种使用对应语言的谷歌 TTS。 */
export function buildWordAudioUrls(word: string, language: LanguageCode = getActiveLanguage()): string[] {
  if (language === 'en' && containsChinese(word)) return buildChineseAudioUrls(word)
  const profile = getProfile(language)
  if (profile.code !== 'en') return [buildGoogleAudioUrl(word, profile.ttsLang.split('-')[0])]
  const youdao = getPronunciationUrl(word, 'us')
  const baidu = buildBaiduTtsUrl(word, 'uk')
  const google = buildGoogleAudioUrl(word, 'en')
  return isSentenceLike(word) ? [baidu, youdao, google] : [youdao, baidu, google]
}

/** 完整播放音源链：带预合成连读音频的词库把录音地址放最前（含 jsDelivr 镜像容灾），其后维持原 TTS 兜底链 */
export function buildPlayUrls(word: string, language: LanguageCode, speechBankId?: string): string[] {
  const urls = orderUrlsByEnginePref(buildWordAudioUrls(word, language), language)
  if (!speechBankId) return urls
  const speechUrl = getSpeechAudioUrl(speechBankId, word)
  return speechUrl ? [...cdnUrlVariants(speechUrl), ...urls] : urls
}

// ---------- 音源偏好（发音统一）：上次成功的引擎下次优先，避免弱网下不同引擎嗓音来回切换 ----------

/** 各语言最近一次播放成功的引擎 host（持久化到本地，重启后仍生效） */
const ENGINE_PREF_STORAGE_KEY = 'slowlyrecord_tts_engine_pref'
let enginePrefCache: Record<string, string> | null = null

function loadEnginePref(): Record<string, string> {
  if (enginePrefCache) return enginePrefCache
  try {
    const raw = uni.getStorageSync(ENGINE_PREF_STORAGE_KEY)
    enginePrefCache = raw && typeof raw === 'object' ? raw : {}
  } catch {
    enginePrefCache = {}
  }
  return enginePrefCache ?? {}
}

/** 从音源 URL 提取引擎标识（host）。小程序 JSCore 无 URL 构造器，用正则解析 */
export function engineHostOf(url: string): string {
  const m = /^https?:\/\/([^/?#]+)/i.exec(url)
  return m ? m[1].toLowerCase() : ''
}

/** 记录某语言本次播放成功的引擎，后续发音优先使用同一引擎（保持嗓音一致） */
function recordEngineSuccess(language: LanguageCode, url: string): void {
  const host = engineHostOf(url)
  if (!host) return
  const pref = loadEnginePref()
  if (pref[language] === host) return
  pref[language] = host
  try {
    uni.setStorageSync(ENGINE_PREF_STORAGE_KEY, pref)
  } catch { /* 偏好持久化失败不影响发音 */ }
}

/** 按引擎偏好稳定排序：偏好引擎的音源提前，其余相对顺序不变（无偏好或已居首时原样返回） */
export function orderUrlsByEnginePref(urls: string[], language: LanguageCode): string[] {
  const host = loadEnginePref()[language]
  if (!host || urls.length < 2) return urls
  if (engineHostOf(urls[0]) === host) return urls
  const preferred = urls.filter(u => engineHostOf(u) === host)
  if (!preferred.length) return urls
  return [...preferred, ...urls.filter(u => engineHostOf(u) !== host)]
}

/** 仅供测试：重置引擎偏好（模块内缓存 + 本地存储） */
export function __resetTtsEnginePreferenceForTest(): void {
  enginePrefCache = {}
  try {
    uni.removeStorageSync(ENGINE_PREF_STORAGE_KEY)
  } catch { /* 测试环境无 uni 时忽略 */ }
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

  // 缓存优先：链上任一音源已落本地缓存则提到首发，离线/弱网也能即时发音
  const urls = orderCachedFirst(buildPlayUrls(word, language, options.speechBankId), tts)
  const playAt = (urlIndex: number): void => {
    // 代际丢弃：加载/回退完成前已切词（新的 speakWord 或 stopSpeaking）则不再播
    if (seq !== speakSeq) return
    // 回退全程静默：中途单个音源失败不弹提示，全链失败才由末尾统一节流提示
    tts.playAudio(urls[urlIndex], { silent: true, rate: options.rate }).then(
      () => {
        if (seq !== speakSeq) return
        // 记录本次成功的引擎，让后续发音沿用同一嗓音（见 orderUrlsByEnginePref）
        recordEngineSuccess(language, urls[urlIndex])
        options.onEnded?.()
      },
      () => {
        if (seq !== speakSeq) return
        if (urlIndex + 1 < urls.length) {
          // 当前音源失败，换兜底音源重试
          playAt(urlIndex + 1)
        } else if (options.userInitiated) {
          toastFailThrottled()
        }
      }
    )
  }
  playAt(0)
}

/** 把命中本地缓存的音源提到链首（其余保持原顺序）；无命中或适配器不支持查询时原样返回 */
function orderCachedFirst(urls: string[], tts: TtsAdapter): string[] {
  try {
    if (typeof tts.getCachedPath !== 'function') return urls
    const hitIndex = urls.findIndex(u => {
      try {
        return !!tts.getCachedPath!(u)
      } catch {
        return false
      }
    })
    if (hitIndex <= 0) return urls
    return [urls[hitIndex], ...urls.slice(0, hitIndex), ...urls.slice(hitIndex + 1)]
  } catch {
    return urls
  }
}

/**
 * 批量预取接下来若干单词的首选音源（复习/专注连播提前缓存，切词后即时发音）。
 * 单个词失败静默跳过；适配器不支持预取时整体忽略。
 */
export function prefetchWords(
  words: readonly ({ word?: string | null; speechBankId?: string } | null | undefined)[],
  language: LanguageCode = getActiveLanguage(),
): void {
  try {
    const tts = getTtsAdapter()
    if (typeof tts.prefetchAudio !== 'function') return
    for (const item of words || []) {
      const text = item?.word
      if (!text || typeof text !== 'string' || !text.trim()) continue
      try {
        tts.prefetchAudio(buildPlayUrls(text, language, item?.speechBankId)[0])
      } catch { /* 该词构造音源失败，跳过 */ }
    }
  } catch { /* 预取能力缺失时忽略 */ }
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
 * 段内回退全程静默，整段全失败才返回 false，由调用方统一提示。
 * 返回是否完整播完（被中断或某段全部音源失败时返回 false）。
 */
export async function speakChineseLongText(
  text: string,
  options: { rate?: number } = {},
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
        // 段内回退静默：整段全失败才返回 false，由调用方统一提示
        await tts.playAudio(url, { silent: true, rate: options.rate })
        ok = true
        break
      } catch { /* 当前音源失败，换下一音源 */ }
    }
    if (!ok) return false
  }
  return true
}
