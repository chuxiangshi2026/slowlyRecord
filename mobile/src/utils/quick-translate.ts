/**
 * 轻量在线翻译（主包版，仅「中文 → 英文」全文翻译）
 *
 * 为什么不在 pages-memory 里直接引用 pages-tools/utils/translation.ts：
 * 小程序禁止分包互引模块（文本记忆在 pages-memory，翻译引擎在 pages-tools），
 * 所以这里按「当前翻译引擎设置」实现一个最小子集（AI 引擎 + 有道 + 百度），
 * 与 pages-tools 版保持同一请求协议；密钥读取复用主包的 translation-settings。
 *
 * 返回纯译文（保留行结构），调用方负责缓存到文章的 translation 字段。
 */
import {
  getTranslationPlatform,
  getTranslationApiKey,
  type TranslationPlatform,
} from '@/stores/useUtils/translation-settings'
import { sha256Hex, youdaoSignInput } from '@/utils/youdao-tts'
import { md5Hex } from '@/utils/md5'

export type QuickTranslateResult = { ok: true; text: string } | { ok: false; error: string }

/** 与翻译设置页一致的 OpenAI 兼容引擎端点（ollama/阿里/腾讯不在主包轻量版内） */
const AI_ENGINES: Partial<Record<TranslationPlatform, { url: string; defaultModel: string }>> = {
  glm: { url: 'https://open.bigmodel.cn/api/paas/v4/chat/completions', defaultModel: 'glm-4-flash' },
  deepseek: { url: 'https://api.deepseek.com/chat/completions', defaultModel: 'deepseek-chat' },
  qwen: { url: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', defaultModel: 'qwen-turbo' },
  kimi: { url: 'https://api.moonshot.cn/v1/chat/completions', defaultModel: 'moonshot-v1-8k' },
}

export type QuickTranslateChannel = 'ai' | 'youdao' | 'baidu' | 'bilibili' | null

/** 当前引擎可用的轻量翻译通道（纯函数，便于测试） */
export function quickTranslateChannel(platform: TranslationPlatform): QuickTranslateChannel {
  if (AI_ENGINES[platform]) return 'ai'
  if (platform === 'youdao') return 'youdao'
  if (platform === 'baidu') return 'baidu'
  if (platform === 'bilibili') return 'bilibili'
  return null
}

const SYSTEM_PROMPT =
  '你是专业翻译。请把用户给出的中文原文完整译成英文，保留原文的换行结构（原文几行译文就几行，一一对应），只输出英文译文本身，不要解释、编号或引号。'

function request(options: any): Promise<any> {
  return new Promise((resolve) => {
    uni.request({ ...options, success: (r: any) => resolve(r), fail: (e: any) => resolve(e) })
  })
}

function isHttpOk(res: any): boolean {
  return typeof res?.statusCode === 'number' && res.statusCode >= 200 && res.statusCode < 300
}

function errMsg(res: any): string {
  return res?.errMsg || `HTTP ${res?.statusCode || '未知'}`
}

async function translateWithAi(platform: TranslationPlatform, text: string): Promise<QuickTranslateResult> {
  const engine = AI_ENGINES[platform]!
  const { appkey, key } = getTranslationApiKey(platform)
  if (!appkey) return { ok: false, error: '请先在「设置 → 翻译」配置当前引擎的 API 密钥' }
  const res = await request({
    url: engine.url,
    method: 'POST',
    header: { 'Content-Type': 'application/json', Authorization: `Bearer ${appkey}` },
    data: {
      model: key || engine.defaultModel,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: text },
      ],
      temperature: 0.2,
    },
    timeout: 60000,
  })
  if (!isHttpOk(res)) return { ok: false, error: `翻译请求失败：${errMsg(res)}` }
  const content: string = (res.data as any)?.choices?.[0]?.message?.content || ''
  const out = content.trim().replace(/^```[a-z]*\n?|```$/g, '').trim()
  return out ? { ok: true, text: out } : { ok: false, error: '翻译结果为空，请检查引擎配置' }
}

async function translateWithYoudao(text: string): Promise<QuickTranslateResult> {
  const { appkey, key } = getTranslationApiKey('youdao')
  if (!appkey || !key) return { ok: false, error: '请先在「设置 → 翻译」配置有道 API 密钥' }
  const salt = '' + Date.now()
  const curtime = Math.round(Date.now() / 1000)
  const sign = sha256Hex(appkey + youdaoSignInput(text) + salt + curtime + key)
  const params = new URLSearchParams({
    q: text,
    from: 'zh-CHS',
    to: 'en',
    appKey: appkey,
    salt,
    curtime: '' + curtime,
    sign,
    signType: 'v3',
  })
  const res = await request({ url: `https://openapi.youdao.com/api?${params.toString()}`, method: 'GET', timeout: 60000 })
  if (!isHttpOk(res)) return { ok: false, error: `翻译请求失败：${errMsg(res)}` }
  const data: any = res.data
  const out: string = (data?.translation || []).join('\n').trim()
  if (data?.errorCode !== '0' || !out) return { ok: false, error: `有道翻译错误[${data?.errorCode || '未知'}]，请检查密钥配置` }
  return { ok: true, text: out }
}

async function translateWithBaidu(text: string): Promise<QuickTranslateResult> {
  const { appkey: appid, key } = getTranslationApiKey('baidu')
  if (!appid || !key) return { ok: false, error: '请先在「设置 → 翻译」配置百度翻译 API 密钥' }
  const salt = '' + Date.now()
  const sign = md5Hex(appid + text + salt + key)
  const params = new URLSearchParams({ q: text, from: 'zh', to: 'en', appid, salt, sign })
  const res = await request({ url: `https://fanyi-api.baidu.com/api/trans/vip/translate?${params.toString()}`, method: 'GET', timeout: 60000 })
  if (!isHttpOk(res)) return { ok: false, error: `翻译请求失败：${errMsg(res)}` }
  const data: any = res.data
  const out: string = (data?.trans_result || []).map((t: any) => t.dst).join('\n').trim()
  if (data?.error_code || !out) return { ok: false, error: `百度翻译错误[${data?.error_code || '未知'}]，请检查密钥配置` }
  return { ok: true, text: out }
}

/** B站 Index-Translate：免密钥公网 AI 接口（OpenAI 兼容，可被限流） */
async function translateWithBilibili(text: string): Promise<QuickTranslateResult> {
  const { key: configuredModel } = getTranslationApiKey('bilibili')
  const res = await request({
    url: 'https://index-translate.bilibili.com/v1/chat/completions',
    method: 'POST',
    header: { 'Content-Type': 'application/json' },
    data: {
      model: configuredModel || 'Index-Translate-35B-A3B',
      messages: [{ role: 'user', content: `${SYSTEM_PROMPT}\n\n${text.trim()}` }],
      temperature: 0,
      max_tokens: 1024,
      stream: false,
    },
    timeout: 60000,
  })
  if (!isHttpOk(res)) return { ok: false, error: `B站翻译请求失败：${errMsg(res)}（公共接口可能限流，请稍后再试）` }
  const raw: string = (res.data as any)?.choices?.[0]?.message?.content || ''
  const thEnd = raw.indexOf('</think>')
  const out = (thEnd >= 0 ? raw.slice(thEnd + 8) : raw).replace(/^<think>/, '').trim()
  return out ? { ok: true, text: out } : { ok: false, error: 'B站翻译未返回译文，公共接口可能限流，请稍后再试' }
}

/** 按当前翻译引擎设置把中文全文译成英文（保留行结构） */
export async function quickTranslateToEnglish(text: string): Promise<QuickTranslateResult> {
  const platform = getTranslationPlatform()
  const channel = quickTranslateChannel(platform)
  if (channel === 'ai') return translateWithAi(platform, text)
  if (channel === 'youdao') return translateWithYoudao(text)
  if (channel === 'baidu') return translateWithBaidu(text)
  if (channel === 'bilibili') return translateWithBilibili(text)
  return {
    ok: false,
    error: '当前翻译引擎暂不支持在线译英文，请到「设置 → 翻译」切换为 B站 / GLM / DeepSeek / 千问 / Kimi / 有道 / 百度',
  }
}
