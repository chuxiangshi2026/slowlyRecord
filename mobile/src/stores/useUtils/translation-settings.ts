/**
 * 翻译设置管理 - 轻量模块，主包 profile.vue 可安全引用
 * 仅包含平台选择、密钥管理、链接配置，不含翻译引擎和签名算法
 */

import type { TranslationPlatform } from './types'

export type { TranslationPlatform }

import { DefaultApiKeys } from '@/config'

// ==================== 翻译设置管理 ====================

const STORAGE_KEY_TRANSLATION_PLATFORM = 'slowly_translation_platform'
const STORAGE_KEY_TRANSLATION_KEYS = 'slowly_translation_keys'

export const TRANSLATION_PLATFORM_LINKS: { name: string; key: TranslationPlatform; content: string; url: string }[] = [
  { name: '有道', key: 'youdao', content: '申请有道密钥', url: 'https://ai.youdao.com/console/#/service-singleton/text-translation' },
  { name: '阿里', key: 'ali', content: '申请阿里密钥', url: 'https://mt.console.aliyun.com/service' },
  { name: '百度', key: 'baidu', content: '申请百度密钥', url: 'https://fanyi-api.baidu.com/choose' },
  { name: '阿里千问', key: 'qwen', content: '申请千问密钥', url: 'https://bailian.console.aliyun.com/cn-beijing/?tab=model#/efm/model_experience_center/text' },
  { name: 'DeepSeek', key: 'deepseek', content: '申请DeepSeek密钥', url: 'https://platform.deepseek.com/usage' },
  { name: 'Kimi', key: 'kimi', content: '申请Kimi密钥', url: 'https://platform.moonshot.cn/console/account' },
  { name: 'Ollama', key: 'ollama', content: '下载Ollama', url: 'https://ollama.com/download' },
  { name: '智谱GLM', key: 'glm', content: '申请GLM密钥（有免费额度）', url: 'https://open.bigmodel.cn/usercenter/apikeys' },
]

export let currentPlatform: TranslationPlatform = 'glm'

function loadTranslationSettings() {
  try {
    const saved = uni.getStorageSync(STORAGE_KEY_TRANSLATION_PLATFORM)
    if (saved && typeof saved === 'string') {
      currentPlatform = saved as TranslationPlatform
    }
  } catch { /* ignore */ }
}

try { loadTranslationSettings() } catch { /* ignore */ }

const userApiKeys: Record<TranslationPlatform, { appkey: string; key: string }> = (() => {
  try {
    const saved = uni.getStorageSync(STORAGE_KEY_TRANSLATION_KEYS)
    if (saved && typeof saved === 'object') return saved
  } catch { /* ignore */ }
  return {} as Record<TranslationPlatform, { appkey: string; key: string }>
})()

export function setTranslationPlatform(platform: TranslationPlatform) {
  currentPlatform = platform
  try { uni.setStorageSync(STORAGE_KEY_TRANSLATION_PLATFORM, platform) } catch { /* ignore */ }
}

export function getTranslationPlatform(): TranslationPlatform {
  return currentPlatform
}

export function getTranslationApiKey(provider: TranslationPlatform): { appkey: string; key: string } {
  const userKey = userApiKeys[provider]
  const defaultKey = DefaultApiKeys[provider]
  const appkey = (userKey?.appkey?.trim()) ? userKey.appkey.trim() : (defaultKey?.appkey || '')
  const key = (userKey?.key?.trim()) ? userKey.key.trim() : (defaultKey?.key || '')
  return { appkey, key }
}

export function setTranslationApiKey(provider: TranslationPlatform, appkey: string, key: string) {
  if (!userApiKeys[provider]) userApiKeys[provider] = { appkey: '', key: '' }
  userApiKeys[provider].appkey = appkey
  userApiKeys[provider].key = key
  try { uni.setStorageSync(STORAGE_KEY_TRANSLATION_KEYS, userApiKeys) } catch { /* ignore */ }
}

export function hasCustomTranslationApiKey(provider: TranslationPlatform): boolean {
  const uk = userApiKeys[provider]
  return !!(uk?.appkey?.trim())
}

export function getAllTranslationApiKeys(): Record<string, { appkey: string; key: string }> {
  return { ...userApiKeys }
}

export function applyTranslationSettings(settings?: {
  translationPlatform?: TranslationPlatform
  keys?: Record<string, { appkey: string; key: string }>
}) {
  if (!settings) return

  if (settings.translationPlatform) {
    setTranslationPlatform(settings.translationPlatform)
  }

  if (settings.keys && typeof settings.keys === 'object') {
    Object.entries(settings.keys).forEach(([platform, value]) => {
      if (!value || typeof value !== 'object') return
      setTranslationApiKey(platform as TranslationPlatform, value.appkey || '', value.key || '')
    })
  }
}
