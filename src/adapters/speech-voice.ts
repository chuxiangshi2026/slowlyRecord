/**
 * speechSynthesis 语音选择（纯函数）
 * 桌面端 WebTtsAdapter（src/adapters/tts.ts）与专注模式（public/focus.html）共用同一套优先级，
 * 修改打分规则时两端需同步。
 */

/** 语音对象的最小结构（SpeechSynthesisVoice 结构兼容，便于 mock 单测） */
export interface SpeechVoiceLike {
  name: string
  lang: string
  localService?: boolean
  default?: boolean
}

/** 语言码规范化：小写、下划线转横线（voices 列表里常见 zh_CN / zh-CN 混用） */
export function normalizeVoiceLang(lang?: string | null): string {
  return (lang || '').replace(/_/g, '-').toLowerCase()
}

/**
 * 目标语言语音质量打分，分数越高越优先；语种不符返回 -1（淘汰）
 * 优先级：Natural/Online（微软自然语音，多音字最准）> Google > Microsoft > 其他具名语音；
 * 地区完全匹配（zh-CN 命中 zh-CN）优先于仅语种匹配（zh-TW）；
 * localService 仅作延迟 tiebreak（本地音随取随播，网络音音质更好但有首字加载）。
 */
export function scoreVoiceForLang(voice: SpeechVoiceLike, lang: string): number {
  const vLang = normalizeVoiceLang(voice.lang)
  const target = normalizeVoiceLang(lang)
  if (!vLang || !target) return -1
  if (vLang.split('-')[0] !== target.split('-')[0]) return -1
  const name = (voice.name || '').toLowerCase()
  let score = 1
  if (vLang === target) score += 8
  if (name.includes('natural') || name.includes('online')) score += 40
  if (name.includes('google')) score += 30
  if (name.includes('microsoft')) score += 20
  score += voice.localService ? 5 : 2
  if (voice.default) score += 1
  return score
}

/** 从语音列表中为目标语言挑选质量最高的语音；列表为空或语种全不符返回 null（走系统默认音） */
export function selectBestVoice<T extends SpeechVoiceLike>(voices: T[] | null | undefined, lang: string): T | null {
  if (!voices || !voices.length || !lang) return null
  let best: T | null = null
  let bestScore = -1
  for (const voice of voices) {
    const s = scoreVoiceForLang(voice, lang)
    if (s > bestScore) {
      best = voice
      bestScore = s
    }
  }
  return best
}
