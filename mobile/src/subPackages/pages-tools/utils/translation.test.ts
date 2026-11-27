/**
 * 移动端分包翻译引擎测试。
 *
 * 覆盖：主入口分派、离线词典优先、各家签名（有道 SHA256 / 百度 MD5 /
 * 阿里 HMAC-SHA1 / 腾讯 TC3-HMAC-SHA256）、AI 引擎 JSON 解析与批量
 * 翻译、MyMemory 免费接口错误分支、翻译缓存（内存 + storage 预载 + TTL + 防抖持久化）。
 *
 * 说明：签名期望值全部用 Node crypto 独立复算，不复用被测实现。
 */
import { createHash, createHmac } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

interface FakeRequest {
  url: string
  method?: string
  data?: any
  header?: Record<string, string>
  success?: (res: { statusCode?: number; data?: any }) => void
  fail?: (err: { errMsg?: string }) => void
}

type HandlerOutcome = { data?: any; statusCode?: number } | 'fail'

const h = vi.hoisted(() => ({
  forcePlatform: null as string | null,
  keys: {} as Record<string, { appkey: string; key: string }>,
  dict: new Map<string, string>(),
  phonetic: new Map<string, string>(),
}))

vi.mock('@/stores/useUtils/translation-settings', () => ({
  currentPlatform: 'youdao',
  getTranslationApiKey: (provider: string) => h.keys[provider] ?? { appkey: '', key: '' },
  resolveEffectiveTranslationPlatform: (provider: string) => {
    const selected = h.forcePlatform ?? provider
    if (selected === 'local' || selected === 'mymemory' || selected === 'bilibili') return selected
    return h.keys[selected]?.appkey ? selected : 'mymemory'
  },
  setTranslationPlatform: vi.fn(),
  getTranslationPlatform: () => 'youdao',
  setTranslationApiKey: vi.fn(),
  hasCustomTranslationApiKey: () => false,
  TRANSLATION_PLATFORM_LINKS: [],
}))

vi.mock('@/stores/useUtils/offline-dict', () => ({
  queryOfflineDict: (word: string) => h.dict.get(word.toLowerCase().trim()) ?? null,
  queryPhoneticFromCache: (word: string) => h.phonetic.get(word) ?? null,
  getPronunciationUrl: (word: string) => `https://dict.example/voice?w=${encodeURIComponent(word)}`,
}))

const CACHE_KEY = 'slowly_translation_cache_v1'
const DAY = 24 * 3600 * 1000

let requests: FakeRequest[] = []
let handler: (req: FakeRequest) => HandlerOutcome = () => ({ data: {} })
const storage = new Map<string, any>()

function installUni(): void {
  ;(globalThis as any).uni = {
    request: (req: FakeRequest) => {
      requests.push(req)
      const outcome = handler(req)
      if (outcome === 'fail') req.fail?.({ errMsg: 'request:fail mock' })
      else req.success?.({ statusCode: outcome.statusCode ?? 200, data: outcome.data })
    },
    getStorageSync: (key: string) => (storage.has(key) ? storage.get(key) : ''),
    setStorageSync: (key: string, value: any) => {
      storage.set(key, value)
    },
    removeStorageSync: (key: string) => {
      storage.delete(key)
    },
  }
}

async function loadModule(): Promise<typeof import('./translation')> {
  vi.resetModules()
  return import('./translation')
}

const sha256Hex = (input: string) => createHash('sha256').update(input).digest('hex')
const md5Hex = (input: string) => createHash('md5').update(input).digest('hex')
const youdaoSignInput = (q: string) => (q.length <= 20 ? q : q.slice(0, 10) + q.length + q.slice(-10))

function aliEncode(value: string): string {
  return encodeURIComponent(value)
    .replace(/!/g, '%21')
    .replace(/\*/g, '%2A')
    .replace(/'/g, '%27')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29')
}

/** 独立复算阿里云 HMAC-SHA1 签名（密钥口径：accessKeySecret + '&'） */
function aliSignature(url: string, accessKeySecret: string): string {
  const params = new URL(url).searchParams
  const pairs: [string, string][] = []
  params.forEach((value, key) => {
    if (key !== 'Signature') pairs.push([key, value])
  })
  const canonical = pairs
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${aliEncode(key)}=${aliEncode(value)}`)
    .join('&')
  const stringToSign = `GET&${aliEncode('/')}&${encodeURIComponent(canonical)}`
  return createHmac('sha1', `${accessKeySecret}&`).update(stringToSign).digest('base64')
}

/** 独立复算腾讯云 TC3-HMAC-SHA256 签名 */
function tencentSignature(req: FakeRequest, secretKey = 'SECRET'): string {
  const headers = req.header ?? {}
  const timestamp = Number(headers['X-TC-Timestamp'])
  const date = new Date(timestamp * 1000).toISOString().slice(0, 10)
  const action = String(headers['X-TC-Action']).toLowerCase()
  const host = String(headers['Host'])
  const payload = JSON.stringify(req.data)
  const canonicalHeaders = `content-type:application/json; charset=utf-8\nhost:${host}\nx-tc-action:${action}\n`
  const canonicalRequest = `POST\n/\n\n${canonicalHeaders}\ncontent-type;host;x-tc-action\n${sha256Hex(payload)}`
  const credentialScope = `${date}/tmt/tc3_request`
  const stringToSign = `TC3-HMAC-SHA256\n${timestamp}\n${credentialScope}\n${sha256Hex(canonicalRequest)}`
  const kDate = createHmac('sha256', `TC3${secretKey}`).update(date).digest()
  const kService = createHmac('sha256', kDate).update('tmt').digest()
  const kSigning = createHmac('sha256', kService).update('tc3_request').digest()
  return createHmac('sha256', kSigning).update(stringToSign).digest('hex')
}

/** 判断是否为 AI 批量翻译请求（系统提示词是固定指纹） */
function isBatchRequest(req: FakeRequest): boolean {
  return String(req.data?.messages?.[0]?.content ?? '').includes('只返回有效 JSON 数组')
}

function extractBatchWords(req: FakeRequest): string[] {
  const content = String(req.data?.messages?.[1]?.content ?? '')
  return Array.from(content.matchAll(/^\d+\. (.+)$/gm)).map(m => m[1])
}

const aiContent = (content: string): HandlerOutcome => ({
  data: { choices: [{ message: { content } }] },
})

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-03-01T10:00:00+08:00'))
  requests = []
  handler = () => ({ data: {} })
  storage.clear()
  h.forcePlatform = null
  h.keys = {}
  h.dict.clear()
  h.phonetic.clear()
  installUni()
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('translateText 基础分派', () => {
  it('空输入直接返回提示且不发请求', async () => {
    const mod = await loadModule()
    const res = await mod.translateText('   ')
    expect(res.success).toBe(false)
    expect(res.platform).toBe('local')
    expect(res.errorMsg).toBe('请输入要翻译的文本')
    expect(requests).toHaveLength(0)
  })

  it('离线词典优先：单英文词命中时不发请求，并带缓存音标与发音', async () => {
    const mod = await loadModule()
    h.dict.set('apple', '苹果')
    h.phonetic.set('apple', 'ˈæpl')
    const res = await mod.translateText('Apple', 'auto', 'zh')
    expect(res).toMatchObject({ success: true, explains: '苹果', translatedText: '苹果', phonetic: 'ˈæpl', platform: 'local' })
    expect(res.pronunciation).toBe('https://dict.example/voice?w=apple')
    expect(requests).toHaveLength(0)
  })

  it('含空格时跳过离线词典，走在线引擎', async () => {
    const mod = await loadModule()
    handler = () => ({ data: { responseData: { translatedText: '早上好' } } })
    const res = await mod.translateText('good morning', 'auto', 'zh')
    expect(requests[0].url).toContain('api.mymemory.translated.net')
    expect(res.translatedText).toBe('早上好')
  })

  it('非英语源语言跳过离线词典，并清除发音字段', async () => {
    const mod = await loadModule()
    h.keys.youdao = { appkey: 'id', key: 'sec' }
    h.dict.set('你好', 'hello')
    handler = () => ({ data: { errorCode: '0', translation: ['hello'] } })
    const res = await mod.translateText('你好', 'zh', 'en')
    expect(requests[0].url).toBe('https://openapi.youdao.com/api')
    expect(res.success).toBe(true)
    expect(res.pronunciation).toBeUndefined()
  })
})

// 签名口径回归：mobile `sha256Pure` 曾把 64 位消息长度写反半字，导致有道 v3 与腾讯 TC3
// 签名恒失败；以下用例用独立实现的标准签名口径锁定修复结果。
describe('在线引擎签名与错误映射', () => {
  it('有道：SHA256 签名口径与成功结果', async () => {
    const mod = await loadModule()
    h.keys.youdao = { appkey: 'app-id', key: 'secret' }
    handler = () => ({ data: { errorCode: '0', translation: ['你好'], basic: { phonetic: 'həˈləʊ' } } })
    const res = await mod.translateText('hello', 'en', 'zh')
    expect(res).toMatchObject({ success: true, explains: '你好', translatedText: '你好', phonetic: 'həˈləʊ', platform: 'youdao' })
    expect(res.pronunciation).toBe('https://dict.youdao.com/dictvoice?audio=hello&type=1')

    const req = requests[0]
    expect(req.method).toBe('GET')
    expect(req.data).toMatchObject({ q: 'hello', appKey: 'app-id', from: 'en', to: 'zh', signType: 'v3', ext: 'mp3' })
    expect(req.data.sign).toBe(sha256Hex('app-id' + 'hello' + req.data.salt + req.data.curtime + 'secret'))
  })

  it('有道：长文本签名使用「前10 + 长度 + 后10」', async () => {
    const mod = await loadModule()
    h.keys.youdao = { appkey: 'app-id', key: 'secret' }
    handler = () => ({ data: { errorCode: '0', translation: ['ok'] } })
    const text = 'abcdefghijklmnopqrstuvwxyz'
    await mod.translateText(text, 'en', 'zh')
    const req = requests[0]
    const expectedInput = 'abcdefghij' + text.length + 'qrstuvwxyz'
    expect(req.data.sign).toBe(sha256Hex('app-id' + expectedInput + req.data.salt + req.data.curtime + 'secret'))
  })

  it('有道：错误码 202 提示签名/系统时间，其他码提示检查密钥', async () => {
    const mod = await loadModule()
    h.keys.youdao = { appkey: 'app-id', key: 'secret' }
    handler = () => ({ data: { errorCode: '202' } })
    const signErr = await mod.translateText('alpha', 'en', 'zh')
    expect(signErr.success).toBe(false)
    expect(signErr.errorMsg).toContain('签名检验失败')

    handler = () => ({ data: { errorCode: '108' } })
    const other = await mod.translateText('beta', 'en', 'zh')
    expect(other.errorMsg).toContain('请检查密钥配置')
  })

  it('有道：仅配置 appkey 未配置 secret 时直接报错', async () => {
    const mod = await loadModule()
    h.keys.youdao = { appkey: 'app-id', key: '' }
    const res = await mod.translateText('gamma', 'en', 'zh')
    expect(res.success).toBe(false)
    expect(res.errorMsg).toBe('有道翻译：请先配置API密钥')
    expect(requests).toHaveLength(0)
  })

  it('百度：MD5 签名口径与成功结果', async () => {
    const mod = await loadModule()
    h.forcePlatform = 'baidu'
    h.keys.baidu = { appkey: 'appid', key: 'secret' }
    handler = () => ({ data: { trans_result: [{ dst: '橙子' }] } })
    const res = await mod.translateText('orange', 'en', 'zh')
    expect(res).toMatchObject({ success: true, translatedText: '橙子', platform: 'baidu' })
    expect(res.pronunciation).toBe('https://dict.youdao.com/dictvoice?audio=orange&type=1')

    const req = requests[0]
    expect(req.url).toBe('https://fanyi-api.baidu.com/api/trans/vip/translate')
    expect(req.data.sign).toBe(md5Hex('appid' + 'orange' + req.data.salt + 'secret'))
  })

  it('百度：错误码映射到中文提示', async () => {
    const mod = await loadModule()
    h.forcePlatform = 'baidu'
    h.keys.baidu = { appkey: 'appid', key: 'secret' }
    handler = () => ({ data: { error_code: '54001' } })
    const res = await mod.translateText('orange', 'en', 'zh')
    expect(res.success).toBe(false)
    expect(res.errorMsg).toContain('签名错误')
  })

  it('阿里：HMAC-SHA1 签名可被独立复算且成功返回译文', async () => {
    const mod = await loadModule()
    h.forcePlatform = 'ali'
    h.keys.ali = { appkey: 'akid', key: 'aksecret' }
    handler = () => ({ data: { Code: '200', Data: { Translated: '果汁' } } })
    const res = await mod.translateText('juice', 'en', 'zh')
    expect(res).toMatchObject({ success: true, translatedText: '果汁', platform: 'ali' })

    const req = requests[0]
    expect(req.url.startsWith('https://mt.aliyuncs.com/?')).toBe(true)
    const signature = new URL(req.url).searchParams.get('Signature')
    expect(signature).toBe(aliSignature(req.url, 'aksecret'))
  })

  it('阿里：错误码映射到中文提示', async () => {
    const mod = await loadModule()
    h.forcePlatform = 'ali'
    h.keys.ali = { appkey: 'akid', key: 'aksecret' }
    handler = () => ({ data: { Code: 'SignatureDoesNotMatch', Message: 'bad sign' } })
    const res = await mod.translateText('juice', 'en', 'zh')
    expect(res.success).toBe(false)
    expect(res.errorMsg).toContain('签名不匹配')
  })

  it('腾讯：TC3-HMAC-SHA256 签名可被独立复算且成功返回译文', async () => {
    const mod = await loadModule()
    h.forcePlatform = 'tencent'
    h.keys.tencent = { appkey: 'AKID', key: 'SECRET' }
    handler = () => ({ data: { Response: { TargetText: '你好' } } })
    const res = await mod.translateText('hi', 'en', 'zh')
    expect(res).toMatchObject({ success: true, translatedText: '你好', platform: 'tencent' })

    const req = requests[0]
    expect(req.url).toBe('https://tmt.tencentcloudapi.com')
    expect(req.header).toMatchObject({
      'X-TC-Action': 'TextTranslate',
      'X-TC-Version': '2018-03-21',
      'X-TC-Region': 'ap-beijing',
      Host: 'tmt.tencentcloudapi.com',
    })
    expect(req.data).toEqual({ SourceText: 'hi', Source: 'en', Target: 'zh', ProjectId: 0 })
    const auth = String(req.header?.Authorization)
    expect(auth).toContain('TC3-HMAC-SHA256 Credential=AKID/')
    expect(auth).toContain(`Signature=${tencentSignature(req)}`)
  })

  it('腾讯：API 返回错误时透传错误码与信息', async () => {
    const mod = await loadModule()
    h.forcePlatform = 'tencent'
    h.keys.tencent = { appkey: 'AKID', key: 'SECRET' }
    handler = () => ({ data: { Response: { Error: { Code: 'AuthFailure.SignatureFailure', Message: 'sign error' } } } })
    const res = await mod.translateText('hi', 'en', 'zh')
    expect(res.success).toBe(false)
    expect(res.errorMsg).toContain('AuthFailure.SignatureFailure')
    expect(res.errorMsg).toContain('sign error')
  })

  it('腾讯：仅配置 SecretId 未配置 SecretKey 时直接报错', async () => {
    const mod = await loadModule()
    h.forcePlatform = 'tencent'
    h.keys.tencent = { appkey: 'AKID', key: '' }
    const res = await mod.translateText('hi', 'en', 'zh')
    expect(res.success).toBe(false)
    expect(res.errorMsg).toBe('腾讯翻译：请先配置API密钥')
    expect(requests).toHaveLength(0)
  })

  it('tencentCloudRequest：未配置密钥直接 reject', async () => {
    const mod = await loadModule()
    h.keys = {}
    await expect(
      mod.tencentCloudRequest('tmt', 'tmt.tencentcloudapi.com', 'TextTranslate', '2018-03-21', 'ap-beijing', {})
    ).rejects.toThrow('腾讯云API密钥未配置')
    expect(requests).toHaveLength(0)
  })
})

describe('AI 大模型引擎', () => {
  it('DeepSeek：从围栏 JSON 中解析释义/音标/例句/同反义词', async () => {
    const mod = await loadModule()
    h.forcePlatform = 'deepseek'
    h.keys.deepseek = { appkey: 'sk-test', key: '' }
    handler = () =>
      aiContent(
        '```json\n{"meaning":"深邃的","phonetic":"diːp","examples":[{"english":"a deep well","chinese":"一口深井"}],"synonyms":["profound"],"antonyms":["shallow"],"memoryTip":"深"}\n```'
      )
    const res = await mod.translateText('deep', 'en', 'zh')
    expect(res).toMatchObject({
      success: true,
      translatedText: '深邃的',
      phonetic: 'diːp',
      synonyms: ['profound'],
      antonyms: ['shallow'],
      memoryTip: '深',
      platform: 'deepseek',
    })
    expect(res.examples).toEqual([{ english: 'a deep well', chinese: '一口深井' }])

    const req = requests[0]
    expect(req.url).toBe('https://api.deepseek.com/chat/completions')
    expect(req.header?.Authorization).toBe('Bearer sk-test')
    expect(req.data.model).toBe('deepseek-chat')
    expect(req.data.messages[0].content).toContain('中英文翻译助手')
    expect(req.data.messages[1].content).toBe('deep')
  })

  it('DeepSeek：无 JSON 时把整段内容当作译文', async () => {
    const mod = await loadModule()
    h.forcePlatform = 'deepseek'
    h.keys.deepseek = { appkey: 'sk-test', key: '' }
    handler = () => aiContent('纯文本译文')
    const res = await mod.translateText('anything', 'en', 'zh')
    expect(res).toMatchObject({ success: true, translatedText: '纯文本译文' })
    expect(res.phonetic).toBeUndefined()
  })

  it('DeepSeek：网络失败返回可见错误', async () => {
    const mod = await loadModule()
    h.forcePlatform = 'deepseek'
    h.keys.deepseek = { appkey: 'sk-test', key: '' }
    handler = () => 'fail'
    const res = await mod.translateText('anything', 'en', 'zh')
    expect(res.success).toBe(false)
    expect(res.errorMsg).toBe('DeepSeek请求失败: request:fail mock')
  })

  it('DeepSeek：返回非法 JSON 时不崩溃，转为错误结果', async () => {
    const mod = await loadModule()
    h.forcePlatform = 'deepseek'
    h.keys.deepseek = { appkey: 'sk-test', key: '' }
    handler = () => aiContent('{"meaning": }')
    const res = await mod.translateText('anything', 'en', 'zh')
    expect(res.success).toBe(false)
    expect(res.errorMsg).toContain('DeepSeek错误')
  })

  it.each([
    ['qwen', 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', 'qwen-turbo'],
    ['kimi', 'https://api.moonshot.cn/v1/chat/completions', 'moonshot-v1-8k'],
    ['glm', 'https://open.bigmodel.cn/api/paas/v4/chat/completions', 'glm-4-flash'],
  ])('%s：默认模型、鉴权头与 JSON 解析', async (platform, url, model) => {
    const mod = await loadModule()
    h.forcePlatform = platform
    h.keys[platform] = { appkey: 'sk-' + platform, key: '' }
    handler = () => aiContent('{"meaning":"译文"}')
    const res = await mod.translateText('word', 'en', 'zh')
    expect(res).toMatchObject({ success: true, translatedText: '译文', platform })

    const req = requests[0]
    expect(req.url).toBe(url)
    expect(req.data.model).toBe(model)
    expect(req.header?.Authorization).toBe('Bearer sk-' + platform)
  })

  it('B站翻译：剥离 think 标签后解析 JSON，且无需密钥', async () => {
    const mod = await loadModule()
    h.forcePlatform = 'bilibili'
    handler = () => aiContent('<think>内部推理</think>{"meaning":"你好","phonetic":"həˈləʊ"}')
    const res = await mod.translateText('hello', 'en', 'zh')
    expect(res).toMatchObject({ success: true, translatedText: '你好', phonetic: 'həˈləʊ', platform: 'bilibili' })

    const req = requests[0]
    expect(req.url).toBe('https://index-translate.bilibili.com/v1/chat/completions')
    expect(req.header?.Authorization).toBeUndefined()
    expect(req.data.model).toBe('Index-Translate-35B-A3B')
    expect(req.data.messages).toHaveLength(1)
  })

  it('B站翻译：有正文但无 JSON 时整段作为译文', async () => {
    const mod = await loadModule()
    h.forcePlatform = 'bilibili'
    handler = () => aiContent('你好世界')
    const res = await mod.translateText('hello world', 'en', 'zh')
    expect(res).toMatchObject({ success: true, translatedText: '你好世界', platform: 'bilibili' })
  })

  it('B站翻译：空响应提示限流/网络受限', async () => {
    const mod = await loadModule()
    h.forcePlatform = 'bilibili'
    handler = () => aiContent('')
    const res = await mod.translateText('hello', 'en', 'zh')
    expect(res.success).toBe(false)
    expect(res.errorMsg).toContain('未返回译文')
  })

  it('Ollama：使用配置的地址与模型，解析 message.content', async () => {
    const mod = await loadModule()
    h.forcePlatform = 'ollama'
    h.keys.ollama = { appkey: 'http://127.0.0.1:11434', key: 'qwen2.5:3b' }
    handler = () => ({ data: { message: { content: '{"meaning":"猫"}' } } })
    const res = await mod.translateText('cat', 'en', 'zh')
    expect(res).toMatchObject({ success: true, translatedText: '猫', platform: 'ollama' })
    expect(requests[0].url).toBe('http://127.0.0.1:11434/api/chat')
    expect(requests[0].data.model).toBe('qwen2.5:3b')
  })
})

describe('免费引擎与降级', () => {
  it('MyMemory：英文文本使用 en-US|zh-CN 语言对并带发音', async () => {
    const mod = await loadModule()
    h.forcePlatform = 'mymemory'
    handler = () => ({ data: { responseData: { translatedText: '你好世界' }, responseStatus: '200' } })
    const res = await mod.translateText('hello world', 'auto', 'zh')
    expect(res).toMatchObject({ success: true, translatedText: '你好世界', platform: 'mymemory' })
    expect(res.pronunciation).toBe(`https://dict.youdao.com/dictvoice?audio=${encodeURIComponent('hello world')}&type=1`)
    expect(requests[0].data).toEqual({ q: 'hello world', langpair: 'en-US|zh-CN' })
  })

  it('MyMemory：中文文本自动识别为 zh-CN 且无发音', async () => {
    const mod = await loadModule()
    h.forcePlatform = 'mymemory'
    handler = () => ({ data: { responseData: { translatedText: 'hello' } } })
    const res = await mod.translateText('你好世界', 'auto', 'en')
    expect(requests[0].data.langpair).toBe('zh-CN|en-US')
    expect(res.pronunciation).toBeUndefined()
  })

  it('MyMemory：429 限流提示', async () => {
    const mod = await loadModule()
    h.forcePlatform = 'mymemory'
    handler = () => ({ statusCode: 429, data: {} })
    const res = await mod.translateText('hello world', 'auto', 'zh')
    expect(res.success).toBe(false)
    expect(res.errorMsg).toContain('429')
  })

  it('MyMemory：非 2xx 状态码提示', async () => {
    const mod = await loadModule()
    h.forcePlatform = 'mymemory'
    handler = () => ({ statusCode: 503, data: {} })
    const res = await mod.translateText('hello world', 'auto', 'zh')
    expect(res.errorMsg).toBe('MyMemory 请求失败: 503')
  })

  it('MyMemory：quotaFinished 提示每日额度用完', async () => {
    const mod = await loadModule()
    h.forcePlatform = 'mymemory'
    handler = () => ({ data: { quotaFinished: true } })
    const res = await mod.translateText('hello world', 'auto', 'zh')
    expect(res.errorMsg).toBe('MyMemory 每日免费额度已用完')
  })

  it('MyMemory：responseStatus 非 200 时带出 responseDetails', async () => {
    const mod = await loadModule()
    h.forcePlatform = 'mymemory'
    handler = () => ({ data: { responseStatus: '403', responseDetails: 'denied' } })
    const res = await mod.translateText('hello world', 'auto', 'zh')
    expect(res.errorMsg).toBe('MyMemory 翻译失败: denied')
  })

  it('MyMemory：空译文提示未返回', async () => {
    const mod = await loadModule()
    h.forcePlatform = 'mymemory'
    handler = () => ({ data: { responseData: { translatedText: '   ' } } })
    const res = await mod.translateText('hello world', 'auto', 'zh')
    expect(res.errorMsg).toBe('MyMemory 未返回译文')
  })

  it('MyMemory：网络失败提示检查域名白名单', async () => {
    const mod = await loadModule()
    h.forcePlatform = 'mymemory'
    handler = () => 'fail'
    const res = await mod.translateText('hello world', 'auto', 'zh')
    expect(res.success).toBe(false)
    expect(res.errorMsg).toBe('MyMemory 请求失败: request:fail mock')
  })

  it('未配置凭证的在线引擎自动回落到 MyMemory', async () => {
    const mod = await loadModule()
    h.keys = {}
    handler = () => ({ data: { responseData: { translatedText: 'fallback' } } })
    const res = await mod.translateText('engine', 'en', 'zh')
    expect(requests[0].url).toContain('api.mymemory.translated.net')
    expect(res.platform).toBe('mymemory')
  })

  it('未知平台走默认 MyMemory 分支', async () => {
    const mod = await loadModule()
    h.forcePlatform = 'unknown-platform'
    handler = () => ({ data: { responseData: { translatedText: 'ok' } } })
    const res = await mod.translateText('hello world', 'en', 'zh')
    expect(res.success).toBe(true)
    expect(requests[0].url).toContain('api.mymemory.translated.net')
  })

  it('单英文词引擎未返回音标时补缓存音标', async () => {
    const mod = await loadModule()
    h.keys.youdao = { appkey: 'id', key: 'sec' }
    h.phonetic.set('word', 'wɜːd')
    handler = () => ({ data: { errorCode: '0', translation: ['单词'] } })
    const res = await mod.translateText('word', 'en', 'zh')
    expect(res.phonetic).toBe('wɜːd')
  })
})

describe('本地词典引擎', () => {
  it('非英语源语言直接报错', async () => {
    const mod = await loadModule()
    h.forcePlatform = 'local'
    const res = await mod.translateText('你好', 'zh', 'en')
    expect(res.success).toBe(false)
    expect(res.errorMsg).toBe('本地词典仅支持英语，请切换在线翻译引擎')
  })

  it('英文源语言命中词典时返回本地结果', async () => {
    const mod = await loadModule()
    h.forcePlatform = 'local'
    h.dict.set('book', '书；预订')
    const res = await mod.translateText('book', 'en', 'zh')
    expect(res).toMatchObject({ success: true, translatedText: '书；预订', platform: 'local' })
    expect(requests).toHaveLength(0)
  })

  it('英文源语言未命中词典时提示切换引擎', async () => {
    const mod = await loadModule()
    h.forcePlatform = 'local'
    const res = await mod.translateText('unknownword', 'en', 'zh')
    expect(res.success).toBe(false)
    expect(res.errorMsg).toBe('离线词典中未找到该词')
  })
})

describe('翻译缓存', () => {
  it('成功结果被缓存：大小写不同的同一词只请求一次', async () => {
    const mod = await loadModule()
    h.keys.youdao = { appkey: 'id', key: 'sec' }
    handler = () => ({ data: { errorCode: '0', translation: ['香蕉'] } })
    const first = await mod.translateText('Banana', 'en', 'zh')
    const second = await mod.translateText('banana', 'en', 'zh')
    expect(first.translatedText).toBe('香蕉')
    expect(second.translatedText).toBe('香蕉')
    expect(requests).toHaveLength(1)
  })

  it('失败结果不写入缓存', async () => {
    const mod = await loadModule()
    h.keys.youdao = { appkey: 'id', key: 'sec' }
    handler = () => ({ data: { errorCode: '202' } })
    await mod.translateText('cherry', 'en', 'zh')
    await mod.translateText('cherry', 'en', 'zh')
    expect(requests).toHaveLength(2)
  })

  it('超过 7 天 TTL 后重新请求', async () => {
    const mod = await loadModule()
    h.keys.youdao = { appkey: 'id', key: 'sec' }
    handler = () => ({ data: { errorCode: '0', translation: ['葡萄'] } })
    await mod.translateText('grape', 'en', 'zh')
    expect(requests).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(7 * DAY + 1000)
    await mod.translateText('grape', 'en', 'zh')
    expect(requests).toHaveLength(2)
  })

  it('从 storage 预载未过期缓存，命中时不发请求', async () => {
    const mod = await loadModule()
    h.keys.youdao = { appkey: 'id', key: 'sec' }
    storage.set(CACHE_KEY, [
      [
        'youdao|en|zh|id:sec|preloaded',
        {
          result: { success: true, explains: '缓存译文', translatedText: '缓存译文', platform: 'youdao' },
          ts: Date.now(),
        },
      ],
    ])
    const res = await mod.translateText('Preloaded', 'en', 'zh')
    expect(res.translatedText).toBe('缓存译文')
    expect(requests).toHaveLength(0)
  })

  it('storage 中过期的缓存条目被忽略', async () => {
    const mod = await loadModule()
    h.keys.youdao = { appkey: 'id', key: 'sec' }
    storage.set(CACHE_KEY, [
      [
        'youdao|en|zh|id:sec|stale',
        {
          result: { success: true, explains: '旧译文', translatedText: '旧译文', platform: 'youdao' },
          ts: Date.now() - 8 * DAY,
        },
      ],
    ])
    handler = () => ({ data: { errorCode: '0', translation: ['新译文'] } })
    const res = await mod.translateText('stale', 'en', 'zh')
    expect(res.translatedText).toBe('新译文')
    expect(requests).toHaveLength(1)
  })

  it('缓存持久化有 5 秒防抖，且只落成功条目', async () => {
    const mod = await loadModule()
    h.keys.youdao = { appkey: 'id', key: 'sec' }
    handler = () => ({ data: { errorCode: '0', translation: ['甲'] } })
    await mod.translateText('word', 'en', 'zh')
    expect(storage.has(CACHE_KEY)).toBe(false)
    await vi.advanceTimersByTimeAsync(5000)
    const persisted = storage.get(CACHE_KEY) as Array<[string, { result: { translatedText: string } }]>
    expect(persisted).toHaveLength(1)
    expect(persisted[0][0]).toBe('youdao|en|zh|id:sec|word')
    expect(persisted[0][1].result.translatedText).toBe('甲')
  })
})

describe('batchTranslate', () => {
  it('本地词典：结果按原下标回填，重复词复用缓存', async () => {
    const mod = await loadModule()
    h.forcePlatform = 'local'
    h.dict.set('apple', '苹果')
    h.dict.set('book', '书')
    const results = await mod.batchTranslate(['apple', 'book', 'apple'], 'en', 'zh')
    expect(results.map(r => r.translatedText)).toEqual(['苹果', '书', '苹果'])
    expect(requests).toHaveLength(0)
  })

  it('百度：并发为 1，词间串行且保持原顺序', async () => {
    const mod = await loadModule()
    h.forcePlatform = 'baidu'
    h.keys.baidu = { appkey: 'appid', key: 'secret' }
    handler = (req) => ({ data: { trans_result: [{ dst: `${req.data.q}-译` }] } })
    const p = mod.batchTranslate(['one', 'two', 'three'], 'en', 'zh')
    // 第一步只发出第一个请求，证明并发限制为 1
    expect(requests).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(2500)
    const results = await p
    expect(requests.map(r => r.data.q)).toEqual(['one', 'two', 'three'])
    expect(results.map(r => r.translatedText)).toEqual(['one-译', 'two-译', 'three-译'])
  })

  it('AI 平台：一次批量请求解析 JSON 数组并按顺序回填', async () => {
    const mod = await loadModule()
    h.forcePlatform = 'deepseek'
    h.keys.deepseek = { appkey: 'sk-test', key: '' }
    handler = (req) => {
      if (!isBatchRequest(req)) return aiContent('{"meaning":"单"}')
      const words = extractBatchWords(req)
      return aiContent(JSON.stringify(words.map(w => ({ query: w, translation: `译:${w}` }))))
    }
    const results = await mod.batchTranslate(['alpha', 'beta', 'gamma'], 'en', 'zh')
    expect(requests).toHaveLength(1)
    expect(requests[0].url).toBe('https://api.deepseek.com/v1/chat/completions')
    expect(extractBatchWords(requests[0])).toEqual(['alpha', 'beta', 'gamma'])
    expect(results.map(r => r.translatedText)).toEqual(['译:alpha', '译:beta', '译:gamma'])
    expect(results.every(r => r.success)).toBe(true)

    // 批量结果写入缓存：单词再翻译不应发新请求
    const cached = await mod.translateText('alpha', 'en', 'zh')
    expect(cached.translatedText).toBe('译:alpha')
    expect(requests).toHaveLength(1)
  })

  it('AI 平台：超过 20 个词时按 20 个一批拆分', async () => {
    const mod = await loadModule()
    h.forcePlatform = 'deepseek'
    h.keys.deepseek = { appkey: 'sk-test', key: '' }
    handler = (req) => {
      if (!isBatchRequest(req)) return aiContent('{"meaning":"单"}')
      const words = extractBatchWords(req)
      return aiContent(JSON.stringify(words.map(w => ({ query: w, translation: `译:${w}` }))))
    }
    const words = Array.from({ length: 21 }, (_, i) => `w${i}`)
    const results = await mod.batchTranslate(words, 'en', 'zh')
    expect(requests).toHaveLength(2)
    expect(extractBatchWords(requests[0])).toHaveLength(20)
    expect(extractBatchWords(requests[1])).toEqual(['w20'])
    expect(results).toHaveLength(21)
    expect(results[0].translatedText).toBe('译:w0')
    expect(results[20].translatedText).toBe('译:w20')
  })

  it('AI 批量响应非法 JSON 时逐词回退，不丢结果', async () => {
    const mod = await loadModule()
    h.forcePlatform = 'deepseek'
    h.keys.deepseek = { appkey: 'sk-test', key: '' }
    handler = (req) => {
      if (isBatchRequest(req)) return aiContent('这不是 JSON')
      const text = String(req.data?.messages?.[1]?.content ?? '')
      return aiContent(JSON.stringify({ meaning: `单:${text}` }))
    }
    const results = await mod.batchTranslate(['aa', 'bb', 'cc'], 'en', 'zh')
    expect(requests).toHaveLength(4)
    expect(results.map(r => r.translatedText)).toEqual(['单:aa', '单:bb', '单:cc'])
  })

  it('AI 批量缺项时仅对缺失词回退逐词翻译', async () => {
    const mod = await loadModule()
    h.forcePlatform = 'deepseek'
    h.keys.deepseek = { appkey: 'sk-test', key: '' }
    handler = (req) => {
      if (isBatchRequest(req)) {
        return aiContent(JSON.stringify([
          { query: 'aa', translation: '甲' },
          { query: 'bb', translation: '乙' },
        ]))
      }
      const text = String(req.data?.messages?.[1]?.content ?? '')
      return aiContent(JSON.stringify({ meaning: `单:${text}` }))
    }
    const results = await mod.batchTranslate(['aa', 'bb', 'cc'], 'en', 'zh')
    expect(requests).toHaveLength(2)
    expect(results.map(r => r.translatedText)).toEqual(['甲', '乙', '单:cc'])
  })

  it('已缓存的词不进入 AI 批量请求', async () => {
    const mod = await loadModule()
    h.forcePlatform = 'deepseek'
    h.keys.deepseek = { appkey: 'sk-test', key: '' }
    handler = (req) => {
      if (!isBatchRequest(req)) return aiContent('{"meaning":"缓存值"}')
      const words = extractBatchWords(req)
      return aiContent(JSON.stringify(words.map(w => ({ query: w, translation: `译:${w}` }))))
    }
    await mod.translateText('alpha', 'en', 'zh')
    expect(requests).toHaveLength(1)
    const results = await mod.batchTranslate(['alpha', 'beta', 'gamma'], 'en', 'zh')
    expect(requests).toHaveLength(2)
    expect(results[0].translatedText).toBe('缓存值')
    expect(results[1].translatedText).toBe('译:beta')
    expect(results[2].translatedText).toBe('译:gamma')
  })
})
