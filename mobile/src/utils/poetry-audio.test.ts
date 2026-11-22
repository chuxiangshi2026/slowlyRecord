/**
 * 诗词朗读音频 URL 与哈希口径测试
 * 固定 fixture 的期望哈希由 python 端同算法预先算出（见各用例注释中的命令），
 * 锁住 mobile/src/utils/poetry-audio.ts 与 scripts/generate_poetry_audio.py 的一致性。
 */
import { describe, it, expect } from 'vitest'
import {
  buildPoetrySpeakText,
  getPoetryAudioUrl,
  normalizePoetryText,
  POETRY_VOICE,
  POETRY_RATE,
} from './poetry-audio'

describe('buildPoetrySpeakText', () => {
  it('标题、作者、正文以「。」衔接', () => {
    expect(buildPoetrySpeakText('静夜思', '李白', '床前明月光')).toBe('静夜思。李白。床前明月光')
  })

  it('作者缺省时跳过，不产生空段', () => {
    expect(buildPoetrySpeakText('诗经·关雎', undefined, '关关雎鸠')).toBe('诗经·关雎。关关雎鸠')
    expect(buildPoetrySpeakText('诗经·关雎', '', '关关雎鸠')).toBe('诗经·关雎。关关雎鸠')
  })

  it('各段先去空白再连接', () => {
    expect(buildPoetrySpeakText(' 静夜思 ', ' 李白 ', '床前明月光 ')).toBe('静夜思。李白。床前明月光')
  })
})

describe('normalizePoetryText', () => {
  it('trim 并折叠连续空白（含换行）为单空格', () => {
    expect(normalizePoetryText(' 静夜思。李白。\n床前明月光，  疑是地上霜。 ')).toBe(
      '静夜思。李白。 床前明月光， 疑是地上霜。',
    )
  })
})

describe('getPoetryAudioUrl', () => {
  it('与生成脚本（python md5）哈希口径一致', () => {
    // python3 复现：
    //   speak = "静夜思。李白。床前明月光，疑是地上霜。\n举头望明月，低头思故乡。"
    //   norm  = re.sub(r"\s+"," ",speak.strip())
    //   hashlib.md5(f"zh-CN-XiaoxiaoNeural|-10%|{norm}".encode()).hexdigest()
    // => 74d98727a6f8731084a23f0beee28d13
    const url = getPoetryAudioUrl(
      '静夜思',
      '李白',
      '床前明月光，疑是地上霜。\n举头望明月，低头思故乡。',
    )
    expect(url).toBe(
      'https://cdn.jsdelivr.net/gh/chuxiangshi2026/slowlyRecord@master/public/poetry-audio/74d98727a6f8731084a23f0beee28d13.mp3',
    )
  })

  it('常量与生成脚本默认参数一致', () => {
    expect(POETRY_VOICE).toBe('zh-CN-XiaoxiaoNeural')
    expect(POETRY_RATE).toBe('-10%')
  })
})
