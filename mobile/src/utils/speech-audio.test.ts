/**
 * speech-audio.ts 预合成口语音频 URL 测试
 * 哈希口径与生成脚本 scripts/generate_speech_audio.py 严格一致（python hashlib.md5 已交叉验证）
 */
import { describe, it, expect } from 'vitest'
import { getSpeechAudioUrl, normalizeSpeechText } from '@/utils/speech-audio'

describe('normalizeSpeechText', () => {
  it('trim + 小写 + 连续空白折叠为单空格', () => {
    expect(normalizeSpeechText('  I  Wanna\nGo\tHome  ')).toBe('i wanna go home')
  })
})

describe('getSpeechAudioUrl', () => {
  it('口语句库返回 jsDelivr 音频地址，哈希与生成侧一致', () => {
    // python3: hashlib.md5(b'en-US-AvaNeural|+5%|i wanna go home').hexdigest()
    expect(getSpeechAudioUrl('spoken-reductions-1', 'I wanna go home')).toBe(
      'https://cdn.jsdelivr.net/gh/chuxiangshi2026/slowlyRecord@master/public/speech-audio/spoken-reductions-1/fccc2c23599dd82f462335ff36e36e37.mp3',
    )
  })

  it('大小写与多余空白不影响哈希（归一化后一致）', () => {
    expect(getSpeechAudioUrl('spoken-reductions-1', '  I   Wanna  Go   Home ')).toBe(
      getSpeechAudioUrl('spoken-reductions-1', 'i wanna go home'),
    )
  })

  it('不带预合成音频的词库 / 空文本返回 null', () => {
    expect(getSpeechAudioUrl('cet4', 'hello')).toBeNull()
    expect(getSpeechAudioUrl('spoken-reductions-1', '')).toBeNull()
  })
})
