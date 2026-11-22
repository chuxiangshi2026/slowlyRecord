/**
 * 预合成诗词朗读音频的定位工具（移动端小程序）
 * 与 scripts/generate_poetry_audio.py 同一哈希口径：
 * md5(f"{voice}|{rate}|{归一化朗读文本}")，归一化 = trim + 连续空白折叠为单空格
 * （中文文本不做小写折叠，其余与 speech-audio.ts 一致）。
 * 音频托管在 jsDelivr（与远程词库同仓库的 public/poetry-audio/），文件名即哈希，
 * 播放走 TTS 适配器的 InnerAudioContext，命中后落本地缓存，后续离线可播。
 */
import { md5Hex } from '@/utils/md5'

// 与生成脚本默认参数一致；换音色/语速需重新生成全量音频并同步改这里
export const POETRY_VOICE = 'zh-CN-XiaoxiaoNeural'
export const POETRY_RATE = '-10%'
const POETRY_AUDIO_BASE = 'https://cdn.jsdelivr.net/gh/chuxiangshi2026/slowlyRecord@master/public/poetry-audio'

/** 构造全文朗读文本：标题、作者、正文以「。」衔接（edge-tts 按句号停顿），与生成侧严格一致 */
export function buildPoetrySpeakText(title: string, author: string | undefined, content: string): string {
  return [title, author || '', content]
    .map((s) => (s || '').trim())
    .filter(Boolean)
    .join('。')
}

export const normalizePoetryText = (text: string): string =>
  text.trim().replace(/\s+/g, ' ')

/**
 * 生成诗词全文朗读音频 URL。仅内置诗词库导入的文章（category === 'poetry'）
 * 才有对应预合成音频；用户自建的同类文章会 404，由播放侧 onError 兜底。
 */
export function getPoetryAudioUrl(title: string, author: string | undefined, content: string): string {
  const speakText = buildPoetrySpeakText(title, author, content)
  const hash = md5Hex(`${POETRY_VOICE}|${POETRY_RATE}|${normalizePoetryText(speakText)}`)
  return `${POETRY_AUDIO_BASE}/${hash}.mp3`
}
