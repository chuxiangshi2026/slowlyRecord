import { describe, it, expect, beforeEach, vi } from 'vitest'

// 内存版 localStorage（usage-counter 依赖）
const storage: Record<string, string> = {}
globalThis.localStorage = {
  getItem: (k: string) => storage[k] ?? null,
  setItem: (k: string, v: string) => { storage[k] = String(v) },
  removeItem: (k: string) => { delete storage[k] },
  clear: () => { for (const k of Object.keys(storage)) delete storage[k] },
  length: 0,
  key: () => null
} as unknown as Storage

// 可编程的密钥桩：getTranslationApiKey / hasCustomApiKey 都经 useWordsStore().getApiKey 读取
const apiKeys: Record<string, { appkey: string, key: string }> = {}
vi.mock('@/stores/words.ts', () => ({
  useWordsStore: () => ({
    getApiKey: (p: string) => apiKeys[p]
  })
}))
vi.mock('@/utils/str-util.ts', () => ({ batchTranslateAndAddWords: vi.fn() }))
vi.mock('@/utils/local-dictionary', () => ({ translateWithLocalDictionaryAsync: vi.fn() }))

import { translateWithPlatform, translateBatchWithPlatform } from '@/utils/translation-api'
import { RETIRED_MODEL_NAMES, AppInfo } from '@/config.ts'

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

function mockChatResponse(content: string) {
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
    choices: [{ message: { content } }]
  }), { status: 200 }))
}

function lastRequest() {
  const [url, init] = fetchMock.mock.lastCall!
  return { url, headers: init.headers as Record<string, string>, body: JSON.parse(init.body as string) }
}

// platform / 端点 / 默认模型 / 响应内容形状（单条路径为对象，批量兼容路径为数组）
const PLATFORM_MATRIX = [
  { platform: 'glm', url: 'https://open.bigmodel.cn/api/paas/v4/chat/completions', model: 'glm-4.7-flash', content: JSON.stringify({ translation: '你好' }) },
  { platform: 'deepseek', url: 'https://api.deepseek.com/v1/chat/completions', model: 'deepseek-v4-flash', content: JSON.stringify({ translation: '你好' }) },
  { platform: 'qwen', url: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', model: 'qwen-max', content: JSON.stringify({ translation: '你好' }) },
  { platform: 'kimi', url: 'https://api.moonshot.cn/v1/chat/completions', model: 'kimi-k2.6', content: JSON.stringify({ translation: '你好' }) },
  { platform: 'minimax', url: 'https://api.minimaxi.com/v1/chat/completions', model: 'MiniMax-M2.7', content: JSON.stringify([{ query: 'hello', translation: '你好' }]) },
  { platform: 'hunyuan', url: 'https://api.hunyuan.cloud.tencent.com/v1/chat/completions', model: 'hunyuan-lite', content: JSON.stringify([{ query: 'hello', translation: '你好' }]) },
  { platform: 'qiniu', url: 'https://openai.qiniu.com/v1/chat/completions', model: 'deepseek-v3', content: JSON.stringify([{ query: 'hello', translation: '你好' }]) }
] as const

describe('AI 翻译平台调用', () => {
  beforeEach(() => {
    fetchMock.mockReset()
    for (const k of Object.keys(apiKeys)) delete apiKeys[k]
  })

  it.each(PLATFORM_MATRIX)('$platform 使用正确端点、默认模型和鉴权头', async ({ platform, url, model, content }) => {
    apiKeys[platform] = { appkey: 'test-api-key', key: '' }
    mockChatResponse(content)

    const result = await translateWithPlatform(`hello-${platform}`, platform as any, 'auto', 'zh')

    expect(result.success).toBe(true)
    expect(result.explains).toBe('你好')
    const req = lastRequest()
    expect(req.url).toBe(url)
    expect(req.headers['Authorization']).toBe('Bearer test-api-key')
    expect(req.body.model).toBe(model)
  })

  it('用户自定义模型名优先于默认模型', async () => {
    apiKeys.minimax = { appkey: 'test-api-key', key: 'MiniMax-M3' }
    mockChatResponse(JSON.stringify([{ query: 'custom-model-query', translation: '你好' }]))

    await translateWithPlatform('custom-model-query', 'minimax' as any, 'auto', 'zh')

    expect(lastRequest().body.model).toBe('MiniMax-M3')
  })

  it('minimax/hunyuan 走 OpenAI 兼容批量通道，多条合并一次请求', async () => {
    for (const platform of ['minimax', 'hunyuan'] as const) {
      fetchMock.mockReset()
      apiKeys[platform] = { appkey: 'test-api-key', key: '' }
      mockChatResponse(JSON.stringify([
        { query: `batch-a-${platform}`, translation: '你好A' },
        { query: `batch-b-${platform}`, translation: '你好B' }
      ]))

      const results = await translateBatchWithPlatform([`batch-a-${platform}`, `batch-b-${platform}`], platform as any, 'auto', 'zh')

      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(results.map(r => r?.explains)).toEqual(['你好A', '你好B'])
    }
  })

  it('已下线模型名迁移表与代码中的默认模型保持一致', async () => {
    // 迁移目标必须仍是当前代码里使用的默认模型，否则静默升级会把用户指到另一个不可用模型
    const defaultsUsedInCode = Object.fromEntries(PLATFORM_MATRIX.map(p => [p.platform, p.model]))
    expect(RETIRED_MODEL_NAMES['deepseek-chat']).toBe(defaultsUsedInCode.deepseek)
    expect(RETIRED_MODEL_NAMES['kimi-k2-turbo-preview']).toBe(defaultsUsedInCode.kimi)
    expect(RETIRED_MODEL_NAMES['glm-4-flash']).toBe(defaultsUsedInCode.glm)
  })
})

describe('DeepL / 微软翻译 / Google 免费接口', () => {
  beforeEach(() => {
    fetchMock.mockReset()
    for (const k of Object.keys(apiKeys)) delete apiKeys[k]
  })

  it('deepl 免费版 key（:fx 结尾）走 api-free 端点并带鉴权头', async () => {
    apiKeys.deepl = { appkey: 'test-deepl-key:fx', key: '' }
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
      translations: [{ text: '你好' }]
    }), { status: 200 }))

    const result = await translateWithPlatform('hello-deepl', 'deepl' as any, 'auto', 'zh')

    expect(result.success).toBe(true)
    expect(result.explains).toBe('你好')
    const req = lastRequest()
    expect(req.url).toBe('https://api-free.deepl.com/v2/translate')
    expect(req.headers['Authorization']).toBe('DeepL-Auth-Key test-deepl-key:fx')
    expect(req.body.target_lang).toBe('ZH')
    expect(req.body.source_lang).toBeUndefined()
  })

  it('deepl 未配置 key 时直接返回提示，不发请求', async () => {
    apiKeys.deepl = { appkey: '', key: '' } // 用户与内置均为空
    const result = await translateWithPlatform('hello-deepl-nokey', 'deepl' as any, 'auto', 'zh')
    expect(result.success).toBe(false)
    expect(result.errorMsg).toContain('DeepL')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('deepl 返回 456 后标记额度耗尽，后续请求直接停服不再打 API', async () => {
    // 模拟内置共享 key 生效的场景（用户未自填）
    apiKeys.deepl = { appkey: '', key: '' }
    const originalBuiltin = AppInfo.deepl.appkey
    AppInfo.deepl.appkey = 'builtin-deepl-key:fx'
    try {
      fetchMock.mockResolvedValueOnce(new Response('quota exceeded', { status: 456 }))

      const first = await translateWithPlatform('hello-deepl-quota', 'deepl' as any, 'auto', 'zh')
      expect(first.success).toBe(false)
      expect(first.errorMsg).toContain('456')

      fetchMock.mockClear()
      const second = await translateWithPlatform('hello-deepl-quota-2', 'deepl' as any, 'auto', 'zh')
      expect(second.success).toBe(false)
      expect(second.errorMsg).toContain('内置免费额度已用完')
      expect(fetchMock).not.toHaveBeenCalled()
    } finally {
      AppInfo.deepl.appkey = originalBuiltin
    }
  })

  it('azure 使用正确端点、订阅头和语言代码', async () => {
    apiKeys.azure = { appkey: 'test-azure-key', key: 'eastasia' }
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify([
      { translations: [{ text: '你好', to: 'zh-Hans' }] }
    ]), { status: 200 }))

    const result = await translateWithPlatform('hello-azure', 'azure' as any, 'en', 'zh')

    expect(result.success).toBe(true)
    expect(result.explains).toBe('你好')
    const req = lastRequest()
    expect(req.url).toContain('https://api.cognitive.microsofttranslator.com/translate')
    expect(req.url).toContain('to=zh-Hans')
    expect(req.url).toContain('from=en')
    expect(req.headers['Ocp-Apim-Subscription-Key']).toBe('test-azure-key')
    expect(req.headers['Ocp-Apim-Subscription-Region']).toBe('eastasia')
  })

  it('google 免费接口无需 key，拼接 gtx 参数并解析分段译文', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify([
      [['你好', 'hello', null, null, 10], ['世界', 'world', null, null, 10]],
      null, 'en'
    ]), { status: 200 }))

    const result = await translateWithPlatform('hello-google world', 'google' as any, 'auto', 'zh')

    expect(result.success).toBe(true)
    expect(result.explains).toBe('你好世界')
    const [url] = fetchMock.mock.lastCall!
    expect(url).toContain('client=gtx')
    expect(url).toContain('tl=zh-CN')
  })

  it('google 429 返回限流提示', async () => {
    fetchMock.mockResolvedValueOnce(new Response('rate limited', { status: 429 }))
    const result = await translateWithPlatform('hello-google-429', 'google' as any, 'auto', 'zh')
    expect(result.success).toBe(false)
    expect(result.errorMsg).toContain('429')
  })
})
