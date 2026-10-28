import {describe, expect, it} from 'vitest'
import {
  getOcrEngine,
  getOcrEngineGroups,
  getTranslationEngine,
  getTranslationEngineGroups,
  OCR_ENGINE_OPTIONS,
  OCR_KEY_PLATFORMS,
  TRANSLATION_ENGINE_OPTIONS,
  TRANSLATION_KEY_PLATFORMS,
  engineRequiresKey,
} from './engine-options'

const translationPlatforms = [
  'spark', 'local', 'youdao', 'baidu', 'ali', 'google', 'bing', 'glm', 'bilibili', 'utoolsai',
  'deepl', 'azure', 'xftrans', 'siliconflow', 'deepseek', 'qwen', 'kimi', 'minimax', 'qiniu', 'ollama',
]
const ocrPlatforms = ['local', 'youdao', 'baidu', 'ali', 'bilibili', 'glm', 'utoolsai', 'siliconflow', 'deepseek']

describe('引擎目录', () => {
  it('保留现有翻译与 OCR 平台值且不重复', () => {
    expect(TRANSLATION_ENGINE_OPTIONS.map(option => option.value).sort()).toEqual([...translationPlatforms].sort())
    expect(OCR_ENGINE_OPTIONS.map(option => option.value).sort()).toEqual([...ocrPlatforms].sort())
    expect(new Set(translationPlatforms).size).toBe(translationPlatforms.length)
    expect(new Set(ocrPlatforms).size).toBe(ocrPlatforms.length)
  })

  it('免配置分组始终位于需 Key 分组之前，并区分传统 API 与大模型', () => {
    for (const groups of [getTranslationEngineGroups(), getOcrEngineGroups()]) {
      const labels = groups.map(group => group.label)
      const lastFree = labels.findLastIndex(label => label.startsWith('免配置'))
      const firstRequired = labels.findIndex(label => label.startsWith('需 Key'))
      if (firstRequired >= 0) expect(lastFree).toBeLessThan(firstRequired)
      expect(labels.some(label => label.includes('传统'))).toBe(true)
      expect(labels.some(label => label.includes('大模型'))).toBe(true)
    }
  })

  it('选项名称不混入价格、Key 状态或推荐后缀', () => {
    for (const option of [...TRANSLATION_ENGINE_OPTIONS, ...OCR_ENGINE_OPTIONS]) {
      expect(option.label).not.toMatch(/免费|免\s*[Kk]ey|免配置|推荐/)
    }
  })

  it('本地服务不作为开箱即用的免配置引擎', () => {
    expect(engineRequiresKey(getTranslationEngine('ollama')!)).toBe(true)
    expect(engineRequiresKey(getTranslationEngine('local')!)).toBe(false)
    expect(engineRequiresKey(getOcrEngine('local')!, true)).toBe(false)
  })

  it('密钥面板平台清单与目录一致', () => {
    expect(TRANSLATION_KEY_PLATFORMS).toContain('siliconflow')
    expect(TRANSLATION_KEY_PLATFORMS).toContain('glm')
    expect(TRANSLATION_KEY_PLATFORMS).not.toContain('google')
    expect(OCR_KEY_PLATFORMS).toEqual(['youdao', 'baidu', 'ali', 'siliconflow'])
  })
})
