/**
 * AI 搜索工具测试（桌面端）。
 *
 * mock axios / Element Plus 提示 / words store / AppInfo，覆盖：
 * 配置读取与保存（localStorage + store + 内置兜底）、诗词与文章搜索的
 * JSON 解析和字段归一化、智能路由、时间线生成的数量裁剪与字段兜底、
 * 连接测试。网络层不真实发起请求。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const axiosMock = vi.hoisted(() => ({ post: vi.fn() }))
const messageMock = vi.hoisted(() => ({ warning: vi.fn(), error: vi.fn() }))
const wordsStore = vi.hoisted(() => ({ impl: (() => ({ userApiKeys: {} })) as () => any }))

vi.mock('axios', () => ({ default: axiosMock }))
vi.mock('element-plus', () => ({ ElMessage: messageMock }))
vi.mock('@/stores/words', () => ({ useWordsStore: () => wordsStore.impl() }))
vi.mock('@/config', () => ({
  AppInfo: {
    glm: { appkey: 'builtin-glm' },
    deepseek: { appkey: 'builtin-deepseek' },
  },
}))

import {
  getAISearchConfig,
  saveAISearchConfig,
  searchPoetryWithAI,
  searchArticleWithAI,
  smartSearchWithAI,
  generateTimelineEventsWithAI,
  testAIConnection,
  type AISearchConfig,
} from './ai-search-api'

const storage = new Map<string, string>()
vi.stubGlobal('localStorage', {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, value),
  removeItem: (key: string) => storage.delete(key),
  clear: () => storage.clear(),
})

function config(overrides: Partial<AISearchConfig> = {}): AISearchConfig {
  return {
    enabled: true,
    provider: 'glm',
    apiKey: 'test-key',
    apiUrl: 'https://example.com/custom',
    model: 'custom-model',
    ...overrides,
  }
}

function aiResponse(content: string) {
  return { data: { choices: [{ message: { content } }] } }
}

beforeEach(() => {
  storage.clear()
  axiosMock.post.mockReset()
  messageMock.warning.mockReset()
  messageMock.error.mockReset()
  wordsStore.impl = () => ({ userApiKeys: {} })
})

describe('getAISearchConfig / saveAISearchConfig', () => {
  it('无存储时返回默认配置并用 store 中的 API Key 补充', () => {
    wordsStore.impl = () => ({ userApiKeys: { glm: { appkey: 'user-glm' } } })
    const cfg = getAISearchConfig()
    expect(cfg).toMatchObject({ enabled: true, provider: 'glm', model: 'glm-4.7-flash', apiKey: 'user-glm' })
  })

  it('读取 localStorage 配置并与默认值合并', () => {
    storage.set('ai_search_config', JSON.stringify({ provider: 'deepseek', model: 'my-model', apiKey: 'stored-key' }))
    const cfg = getAISearchConfig()
    expect(cfg).toMatchObject({ provider: 'deepseek', model: 'my-model', apiKey: 'stored-key', enabled: true })
  })

  it('store 中没有对应 Key 时回退到内置 AppInfo', () => {
    const cfg = getAISearchConfig()
    expect(cfg.apiKey).toBe('builtin-glm')
  })

  it('words store 不可用时回退到 AppInfo，不抛出', () => {
    wordsStore.impl = () => {
      throw new Error('pinia not active')
    }
    const cfg = getAISearchConfig()
    expect(cfg.apiKey).toBe('builtin-glm')
  })

  it('localStorage 内容损坏时按默认配置处理', () => {
    storage.set('ai_search_config', '{broken')
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const cfg = getAISearchConfig()
    expect(cfg.provider).toBe('glm')
    expect(cfg.apiKey).toBe('builtin-glm')
    spy.mockRestore()
  })

  it('saveAISearchConfig 写入 localStorage', () => {
    const cfg = config({ provider: 'kimi', apiKey: 'k' })
    saveAISearchConfig(cfg)
    expect(JSON.parse(storage.get('ai_search_config')!)).toEqual(cfg)
  })
})

describe('searchPoetryWithAI', () => {
  it('未启用或缺少 Key 时提示并返回空数组', async () => {
    await expect(searchPoetryWithAI('月', undefined, config({ enabled: false }))).resolves.toEqual([])
    await expect(searchPoetryWithAI('月', undefined, config({ apiKey: '' }))).resolves.toEqual([])
    expect(messageMock.warning).toHaveBeenCalledTimes(2)
    expect(axiosMock.post).not.toHaveBeenCalled()
  })

  it('解析围栏 JSON 并归一化字段与默认值', async () => {
    const content = '```json\n' + JSON.stringify({
      poems: [
        { title: '静夜思', author: '李白', dynasty: '唐', content: '床前明月光\n疑是地上霜' },
        { name: '无题', poet: '李商隐', period: '唐', body: '相见时难别亦难' },
      ],
    }) + '\n```'
    axiosMock.post.mockResolvedValueOnce(aiResponse(content))

    const results = await searchPoetryWithAI('月', '唐', config())

    expect(axiosMock.post).toHaveBeenCalledOnce()
    const [url, body, options] = axiosMock.post.mock.calls[0]
    expect(url).toBe('https://open.bigmodel.cn/api/paas/v4/chat/completions')
    expect(body.model).toBe('glm-4.7-flash')
    expect(body.messages[1].content).toContain('月')
    expect(body.messages[1].content).toContain('唐时期的')
    expect(options).toMatchObject({
      headers: { Authorization: 'Bearer test-key', 'Content-Type': 'application/json' },
      timeout: 30000,
    })

    expect(results).toHaveLength(2)
    expect(results[0]).toMatchObject({
      title: '静夜思',
      author: '李白',
      dynasty: '唐',
      content: '床前明月光\n疑是地上霜',
      tags: ['唐', '李白'],
      source: 'ai',
    })
    expect(results[0]._id).toMatch(/^ai_poetry_\d+_0$/)
    expect(results[1]).toMatchObject({ title: '无题', author: '李商隐', dynasty: '唐', content: '相见时难别亦难' })
    // tags 只取 dynasty/author 原始字段，不跟随 name/poet/period 别名归一化，缺省落到「诗词」
    expect(results[1].tags).toEqual(['诗词'])
  })

  it('支持 data 字段承载诗词数组', async () => {
    axiosMock.post.mockResolvedValueOnce(aiResponse(JSON.stringify({
      data: [{ title: 'A', author: 'B', dynasty: 'C', content: 'D' }],
    })))
    const results = await searchPoetryWithAI('x', undefined, config())
    expect(results).toHaveLength(1)
    expect(results[0]).toMatchObject({ title: 'A', author: 'B', dynasty: 'C', content: 'D' })
  })

  it('内容为空或无法解析 JSON 时提示错误并返回空数组', async () => {
    axiosMock.post.mockResolvedValueOnce(aiResponse(''))
    await expect(searchPoetryWithAI('月', undefined, config())).resolves.toEqual([])

    axiosMock.post.mockResolvedValueOnce(aiResponse('这不是 JSON'))
    await expect(searchPoetryWithAI('月', undefined, config())).resolves.toEqual([])
    expect(messageMock.error).toHaveBeenCalledTimes(2)
  })

  it('请求异常时提示错误并返回空数组', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    axiosMock.post.mockRejectedValueOnce(new Error('network down'))
    await expect(searchPoetryWithAI('月', undefined, config())).resolves.toEqual([])
    expect(messageMock.error).toHaveBeenCalledWith('AI 搜索失败，请检查 API Key 和网络连接')
    spy.mockRestore()
  })

  it('custom provider 使用配置中的 URL 与模型', async () => {
    axiosMock.post.mockResolvedValueOnce(aiResponse(JSON.stringify({ poems: [] })))
    await searchPoetryWithAI('月', undefined, config({ provider: 'custom', apiUrl: 'https://my.ai/v1', model: 'my-model' }))
    const [url, body] = axiosMock.post.mock.calls[0]
    expect(url).toBe('https://my.ai/v1')
    expect(body.model).toBe('my-model')
  })

  it('未知 provider 回退到配置中的 URL 与模型', async () => {
    axiosMock.post.mockResolvedValueOnce(aiResponse(JSON.stringify({ poems: [] })))
    await searchPoetryWithAI('月', undefined, config({ provider: 'not-a-provider' as any, apiUrl: 'https://fallback.ai', model: 'fb-model' }))
    const [url, body] = axiosMock.post.mock.calls[0]
    expect(url).toBe('https://fallback.ai')
    expect(body.model).toBe('fb-model')
  })
})

describe('searchArticleWithAI', () => {
  it('解析文章 JSON 并归一化字段', async () => {
    axiosMock.post.mockResolvedValueOnce(aiResponse(JSON.stringify({
      articles: [
        { title: '春', author: '朱自清', content: '盼望着，盼望着' },
        { body: '无标题正文' },
      ],
    })))
    const results = await searchArticleWithAI('春天', 'essay', config())

    expect(results[0]).toMatchObject({
      title: '春',
      author: '朱自清',
      dynasty: 'modern',
      content: '盼望着，盼望着',
      tags: ['essay', '朱自清'],
      source: 'ai',
    })
    expect(results[1]).toMatchObject({ title: '未知标题', author: '佚名', content: '无标题正文' })
    expect(results[1].tags).toEqual(['essay'])

    const body = axiosMock.post.mock.calls[0][1]
    expect(body.messages[1].content).toContain('散文')
    expect(body.max_tokens).toBe(3000)
  })

  it('classic 类型在提示词中使用「古文」并写入 tags', async () => {
    axiosMock.post.mockResolvedValueOnce(aiResponse(JSON.stringify({ articles: [{ title: 'A', author: 'B' }] })))
    const results = await searchArticleWithAI('x', 'classic', config())
    expect(axiosMock.post.mock.calls[0][1].messages[1].content).toContain('古文')
    expect(results[0].tags).toEqual(['classic', 'B'])
  })
})

describe('smartSearchWithAI', () => {
  it('auto 模式：含诗词关键词时走诗词搜索', async () => {
    axiosMock.post.mockResolvedValueOnce(aiResponse(JSON.stringify({ poems: [] })))
    await smartSearchWithAI('李白', {}, config())
    expect(axiosMock.post.mock.calls[0][1].messages[1].content).toContain('中国古诗词')
  })

  it('auto 模式：普通关键词走文章搜索', async () => {
    axiosMock.post.mockResolvedValueOnce(aiResponse(JSON.stringify({ articles: [] })))
    await smartSearchWithAI('春天', {}, config())
    expect(axiosMock.post.mock.calls[0][1].messages[1].content).toContain('相关文章')
  })

  it('显式 type 优先于关键词判断', async () => {
    axiosMock.post.mockResolvedValueOnce(aiResponse(JSON.stringify({ articles: [] })))
    await smartSearchWithAI('李白', { type: 'article', articleType: 'prose' }, config())
    expect(axiosMock.post.mock.calls[0][1].messages[1].content).toContain('现代散文')
  })

  it('显式 poetry 与 dynasty 透传', async () => {
    axiosMock.post.mockResolvedValueOnce(aiResponse(JSON.stringify({ poems: [] })))
    await smartSearchWithAI('春天', { type: 'poetry', dynasty: '宋' }, config())
    expect(axiosMock.post.mock.calls[0][1].messages[1].content).toContain('宋时期的')
  })
})

describe('generateTimelineEventsWithAI', () => {
  it('数量裁剪到 1-20 并写入提示词', async () => {
    axiosMock.post.mockResolvedValue(aiResponse(JSON.stringify({ events: [] })))
    await generateTimelineEventsWithAI('唐代大事', { count: 0 }, config())
    expect(axiosMock.post.mock.calls[0][1].messages[1].content).toContain('整理 1 条历史时间线事件')

    await generateTimelineEventsWithAI('唐代大事', { count: 100 }, config())
    expect(axiosMock.post.mock.calls[1][1].messages[1].content).toContain('整理 20 条历史时间线事件')
  })

  it('默认生成 8 条并使用 60 秒超时', async () => {
    axiosMock.post.mockResolvedValueOnce(aiResponse(JSON.stringify({ events: [] })))
    await generateTimelineEventsWithAI('x', {}, config())
    expect(axiosMock.post.mock.calls[0][1].messages[1].content).toContain('整理 8 条历史时间线事件')
    expect(axiosMock.post.mock.calls[0][2].timeout).toBe(60000)
  })

  it('归一化事件字段并对缺失值兜底', async () => {
    axiosMock.post.mockResolvedValueOnce(aiResponse(JSON.stringify({
      events: [
        {
          title: '贞观之治',
          content: '唐太宗即位',
          category: 'politics',
          region: 'china',
          year: 627,
          reign: '贞观元年',
          era: '唐',
          location: '长安',
          figures: [{ name: '李世民', title: '唐太宗', desc: '皇帝' }],
          relations: [{ from: '李世民', to: '魏征', type: '君臣', desc: '纳谏' }],
          background: '隋末战乱',
          tags: ['唐朝'],
        },
        { region: 'europe', year: '1990', figures: 'bad', relations: null, tags: 'bad' },
      ],
    })))
    const events = await generateTimelineEventsWithAI('x', {}, config())

    expect(events[0]).toMatchObject({
      title: '贞观之治',
      category: 'politics',
      region: 'china',
      year: 627,
      figures: [{ name: '李世民', title: '唐太宗', desc: '皇帝' }],
      tags: ['唐朝'],
    })
    expect(events[1]).toMatchObject({ title: '未知事件', region: 'west', year: undefined, figures: [], relations: [], tags: [] })
  })

  it('内容为空或异常时提示错误并返回空数组', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    axiosMock.post.mockResolvedValueOnce(aiResponse(''))
    await expect(generateTimelineEventsWithAI('x', {}, config())).resolves.toEqual([])

    axiosMock.post.mockRejectedValueOnce(new Error('boom'))
    await expect(generateTimelineEventsWithAI('x', {}, config())).resolves.toEqual([])
    expect(messageMock.error).toHaveBeenCalledTimes(2)
    expect(messageMock.error).toHaveBeenLastCalledWith('AI 生成失败，请检查 API Key 和网络连接')
    spy.mockRestore()
  })

  it('未配置 Key 时提示并返回空数组', async () => {
    await expect(generateTimelineEventsWithAI('x', {}, config({ apiKey: '' }))).resolves.toEqual([])
    expect(messageMock.warning).toHaveBeenCalledWith('请先配置 AI API Key')
    expect(axiosMock.post).not.toHaveBeenCalled()
  })
})

describe('testAIConnection', () => {
  it('未启用或缺少 Key 时直接返回 false', async () => {
    await expect(testAIConnection(config({ enabled: false }))).resolves.toBe(false)
    await expect(testAIConnection(config({ apiKey: '' }))).resolves.toBe(false)
    expect(axiosMock.post).not.toHaveBeenCalled()
  })

  it('返回内容即视为连接成功', async () => {
    axiosMock.post.mockResolvedValueOnce(aiResponse('你好'))
    await expect(testAIConnection(config())).resolves.toBe(true)
    const [, body, options] = axiosMock.post.mock.calls[0]
    expect(body.max_tokens).toBe(50)
    expect(options.timeout).toBe(10000)
  })

  it('返回空内容视为失败', async () => {
    axiosMock.post.mockResolvedValueOnce(aiResponse(''))
    await expect(testAIConnection(config())).resolves.toBe(false)
  })

  it('请求异常时返回 false 且不抛出', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    axiosMock.post.mockRejectedValueOnce(new Error('network'))
    await expect(testAIConnection(config())).resolves.toBe(false)
    spy.mockRestore()
  })
})
