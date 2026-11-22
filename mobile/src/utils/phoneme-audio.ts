/**
 * 音素发音（移动端）
 *
 * 48 个音素的预合成音频（edge-tts 神经音色 + 慢速，由 scripts/generate_phoneme_audio.py
 * 生成）放 public/phoneme-audio/，经 jsDelivr 分发，文件名 = encodeURIComponent(ipa)。
 * CDN 失败（未发布/离线）时回退到有道 dictvoice 读 articulation 代理串。
 */
import { getTtsAdapter } from '@/adapters/index'
import { cdnUrlVariants } from '@/utils/cdn-mirror'

const PHONEME_AUDIO_BASE =
  'https://cdn.jsdelivr.net/gh/chuxiangshi2026/slowlyRecord@master/public/phoneme-audio'

/**
 * CDN 连续失败计数：音频未发布到 GitHub 时每次点击都先吃一轮 CDN 超时+重试才回退，
 * 体感像"点了没发音"。连败 2 次后本次会话直接走回退，重启后自动重试 CDN。
 */
let cdnFailCount = 0
const CDN_FAIL_THRESHOLD = 2

/** 音素音频 CDN 地址（文件名规则与生成脚本一致，改任一端需同步另一端） */
export function phonemeAudioUrl(ipa: string): string {
  return `${PHONEME_AUDIO_BASE}/${encodeURIComponent(ipa)}.mp3`
}

/**
 * 播放音素：优先 CDN 预合成音频，失败回退 dictvoice 读代理串（如 /p/ → 'puh'）
 * @param fallbackText articulation 代理串，缺省时回退读 IPA 原文（效果差，仅兜底）
 */
export async function playPhoneme(ipa: string, fallbackText?: string): Promise<void> {
  if (cdnFailCount < CDN_FAIL_THRESHOLD) {
    // CDN 主域 + 镜像域依次尝试：境内 jsDelivr 主域时常不稳，镜像能明显降低发音失败率
    for (const url of cdnUrlVariants(phonemeAudioUrl(ipa))) {
      try {
        // CDN 未发布时 404 属预期：静默失败走回退，不弹「网络异常」惊吓用户
        await getTtsAdapter().playAudio(url, { silent: true })
        cdnFailCount = 0
        return
      } catch {
        /* 尝试下一镜像 */
      }
    }
    cdnFailCount++
  }
  try {
    const url = `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(fallbackText || ipa)}&type=2`
    await getTtsAdapter().playAudio(url)
  } catch {
    /* 两次都失败静默（playAudio 内部已提示） */
  }
}
