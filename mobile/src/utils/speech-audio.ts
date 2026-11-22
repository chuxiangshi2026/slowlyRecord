/**
 * 预生成口语连读音频的定位工具（移动端小程序）
 * 与桌面端 src/utils/speech-audio.ts 同一哈希口径，文件名与生成侧严格一致：
 * md5(f"{voice}|{rate}|{归一化文本}")，归一化 = trim + 小写 + 连续空白折叠为单空格
 * 音频托管在 jsDelivr（与远程词库 JSON 同仓库的 public/speech-audio/），
 * 播放走 TTS 适配器的 InnerAudioContext，命中后落本地缓存，后续离线可播。
 */
import { md5Hex } from '@/utils/md5'
import { hasSpeechAudio } from '@/utils/remote-wordbank'

// 与生成脚本默认参数一致；换音色/语速需重新生成全量音频并同步改这里
const SPEECH_VOICE = 'en-US-AvaNeural'
const SPEECH_RATE = '+5%'
const SPEECH_AUDIO_BASE = 'https://cdn.jsdelivr.net/gh/chuxiangshi2026/slowlyRecord@master/public/speech-audio'

export const normalizeSpeechText = (text: string): string =>
  text.trim().toLowerCase().replace(/\s+/g, ' ')

/**
 * 词库带预合成连读音频（speechAudio）时返回音频 URL，否则返回 null。
 * 换音色或语速后哈希变化，旧缓存自动失效。
 */
export function getSpeechAudioUrl(bankId: string, text: string): string | null {
  if (!text || !hasSpeechAudio(bankId)) return null
  const hash = md5Hex(`${SPEECH_VOICE}|${SPEECH_RATE}|${normalizeSpeechText(text)}`)
  return `${SPEECH_AUDIO_BASE}/${bankId}/${hash}.mp3`
}
