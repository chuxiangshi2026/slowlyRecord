/**
 * 词库服务 - 元数据与加载逻辑
 * 被 useMobileWords（主包）和词库分包页面引用
 */

import type { MobileItemType, WordBankType, WordBankInfo, Word, LoadStrategy } from './types'
import { inferMobileItemType, normalizeMobileItemText } from './text'
import { downloadWordBank as fetchRemoteWordBank } from '@/utils/remote-wordbank'

export type { WordBankType, WordBankInfo, Word, LoadStrategy }

export const DEFAULT_STRATEGY: LoadStrategy = {
  priority: 'local',
  useCache: true,
  timeout: 5000,
}

export const WORDBANK_LIST: WordBankInfo[] = [
  { id: 'cet4', name: '四级词汇', description: '大学英语四级核心词汇', wordCount: 3739 },
  { id: 'cet6', name: '六级词汇', description: '大学英语六级核心词汇', wordCount: 2078 },
  { id: 'bec', name: '商务英语', description: '商务英语考试核心词汇', wordCount: 2825 },
  { id: 'gmat', name: 'GMAT词汇', description: 'GMAT考试核心词汇', wordCount: 3254 },
  { id: 'gre', name: 'GRE词汇', description: 'GRE考试核心词汇', wordCount: 7199 },
  { id: 'ielts', name: '雅思词汇', description: '雅思考试核心词汇', wordCount: 3427 },
  { id: 'kaogong', name: '考公词汇', description: '公务员考试英语词汇', wordCount: 313 },
  { id: 'kaoyan', name: '考研词汇', description: '研究生入学考试核心词汇', wordCount: 4533 },
  { id: 'level4', name: '专业四级', description: '英语专业四级核心词汇', wordCount: 4025 },
  { id: 'level8', name: '专业八级', description: '英语专业八级核心词汇', wordCount: 12197 },
  { id: 'sat', name: 'SAT词汇', description: 'SAT考试核心词汇', wordCount: 4423 },
  { id: 'toefl', name: '托福词汇', description: '托福考试核心词汇', wordCount: 9213 },
  { id: 'zsb', name: '专升本词汇', description: '专升本英语考试核心词汇', wordCount: 297 },
  { id: 'newConcept', name: '新概念词汇', description: '新概念英语核心词汇', wordCount: 600 },
  { id: 'phrasal-verbs', name: '短语动词', description: '英语常用短语动词', wordCount: 317 },
  { id: 'collocations', name: '固定搭配', description: '英语常用固定搭配、句型与表达式', wordCount: 277 },
  { id: 'idioms', name: '习语', description: '英语常用习语', wordCount: 249 },
  { id: 'common-phrases', name: '常用短语短句', description: '日常口语短句、场景实用句与写作表达', wordCount: 307 },
  { id: 'oral-basic', name: '口语入门', description: '零基础也能上口的高频日常口语短句', wordCount: 100 },
  { id: 'oral-intermediate', name: '口语进阶', description: '完整对话与观点表达的日常口语短句', wordCount: 98 },
  { id: 'oral-advanced', name: '口语高阶', description: '地道习语与深度讨论的高阶口语短句', wordCount: 105 },
  { id: 'tech-vocab', name: '程序员常用单词', description: '覆盖编码、调试、测试、部署、协作、线上运维等高频技术词', wordCount: 585 },
  { id: 'dev-phrases', name: '程序员场景短句', description: '站会、PR 评审、沟通协作等真实工作场景常用英文短句', wordCount: 190 },
  { id: 'dev-status', name: '开发状态短句', description: 'CI、测试、构建、发布等开发状态常用英文表述', wordCount: 118 },
  { id: 'dev-debugging', name: '排 bug 与性能', description: '排查 bug、定位性能瓶颈、线上问题复盘的常用英文表达', wordCount: 193 },
  { id: 'dev-reading', name: '看文档与查资料', description: '读 README、看 API 文档、逛 Stack Overflow 与 GitHub 的常用短句', wordCount: 104 },
  { id: 'shopping', name: '日常购物', description: '结账、退换货、优惠券、快递与售后等购物场景常用英文短句', wordCount: 86 },
  { id: 'transport', name: '日常交通出行', description: '地铁公交、打车、坐飞机、读路牌等出行场景常用英文短句', wordCount: 105 },
  { id: 'dining', name: '日常吃饭点餐', description: '堂食点单、打包外带、过敏说明、结账等就餐场景常用英文短句', wordCount: 97 },
  { id: 'roots', name: '词根词缀', description: '英语常见词根、前缀、后缀', wordCount: 568 },
]

const CACHE_KEY_PREFIX = 'wordbank_cache_v2_'
const CACHE_EXPIRY = 7 * 24 * 60 * 60 * 1000

function getBuiltinItemType(type: WordBankType, text: string): MobileItemType {
  if (type === 'collocations') return 'collocation'
  if (type === 'phrasal-verbs' || type === 'idioms') return 'phrase'
  if (type === 'common-phrases' || type.startsWith('oral-') || type === 'dev-phrases' || type === 'dev-status' || type === 'dev-debugging' || type === 'dev-reading' || type === 'shopping' || type === 'transport' || type === 'dining') return 'sentence'
  if (type === 'tech-vocab') return 'word'
  if (type === 'roots') return 'word'
  return inferMobileItemType(text)
}

interface CacheData {
  timestamp: number
  words: Word[]
}

function getFromCache(type: WordBankType): Word[] | null {
  try {
    const cacheStr = uni.getStorageSync(CACHE_KEY_PREFIX + type)
    if (!cacheStr) return null
    const cache: CacheData = JSON.parse(cacheStr)
    if (Date.now() - cache.timestamp > CACHE_EXPIRY) {
      uni.removeStorageSync(CACHE_KEY_PREFIX + type)
      return null
    }
    return cache.words
  } catch {
    return null
  }
}

export function saveWordBankCache(type: WordBankType, words: Word[]): void {
  try {
    const cache: CacheData = {
      timestamp: Date.now(),
      words,
    }
    uni.setStorageSync(CACHE_KEY_PREFIX + type, JSON.stringify(cache))
  } catch (e) {
    console.error('缓存词库失败:', e)
  }
}

export async function loadWordBank(
  type: WordBankType,
  strategy: LoadStrategy = DEFAULT_STRATEGY
): Promise<Word[]> {
  if (strategy.useCache) {
    const cached = getFromCache(type)
    if (cached && cached.length > 0) {
      return cached
    }
  }

  try {
    let rawData: any
    // #ifdef MP-WEIXIN || MP-TOUTIAO
    // 小程序：词库数据在分包中，主包只从缓存读取
    const cached = getFromCache(type)
    if (cached && cached.length > 0) {
      return cached
    }
    throw new Error('请先在"词库管理"页面下载词库')
    // #endif
    // #ifndef MP-WEIXIN || MP-TOUTIAO
    // H5/App 端也走远程下载（jsDelivr CDN）
    rawData = await fetchRemoteWordBank(type)
    const words = (Array.isArray(rawData) ? rawData : []).map((w: any) => {
      const wordText = normalizeMobileItemText(w.word || '')
      return {
        word: wordText,
        meaning: w.meaning || w.explains || '',
        phonetic: w.phonetic,
        example: w.example,
        itemType: w.itemType || getBuiltinItemType(type, wordText),
      }
    })
    if (strategy.useCache) saveWordBankCache(type, words)
    return words
    // #endif
  } catch (e: any) {
    const cache = getFromCache(type)
    if (cache) return cache
    throw new Error(`加载词库失败: ${e.message || '模块加载错误'}`)
  }
}

export async function getWordBankInfo(type: WordBankType): Promise<WordBankInfo | null> {
  const info = WORDBANK_LIST.find((w) => w.id === type)
  if (!info) return null
  try {
    const words = await loadWordBank(type, { ...DEFAULT_STRATEGY, useCache: true })
    return { ...info, wordCount: words.length }
  } catch {
    return info
  }
}

export async function getAllWordBankInfo(): Promise<WordBankInfo[]> {
  return WORDBANK_LIST.map(info => info)
}

export function isWordBankCached(type: WordBankType): boolean {
  try {
    const cacheStr = uni.getStorageSync(CACHE_KEY_PREFIX + type)
    if (!cacheStr) return false
    const cache: CacheData = JSON.parse(cacheStr)
    return Date.now() - cache.timestamp < CACHE_EXPIRY && cache.words.length > 0
  } catch {
    return false
  }
}

export async function downloadWordBank(type: WordBankType): Promise<Word[]> {
  return loadWordBank(type, { ...DEFAULT_STRATEGY, useCache: true })
}

export function clearWordBankCache(type?: WordBankType): void {
  if (type) {
    uni.removeStorageSync(CACHE_KEY_PREFIX + type)
  } else {
    const keys = uni.getStorageInfoSync().keys || []
    for (const key of keys) {
      if (key.startsWith(CACHE_KEY_PREFIX)) {
        uni.removeStorageSync(key)
      }
    }
  }
}

export async function importWordsFromBank(
  type: WordBankType,
  count: number = 50
): Promise<Word[]> {
  const words = await loadWordBank(type)
  return words.slice(0, count)
}

/** 从已缓存的词库中查询音标（供离线词典模块使用） */
export function queryPhoneticFromWordBankCache(word: string): string | null {
  const normalized = word.toLowerCase().trim()
  const types: WordBankType[] = ['cet4', 'cet6', 'bec', 'gmat', 'gre', 'ielts', 'kaogong', 'kaoyan', 'level4', 'level8', 'sat', 'toefl', 'zsb', 'newConcept']
  for (const type of types) {
    try {
      const cacheStr = uni.getStorageSync(CACHE_KEY_PREFIX + type)
      if (!cacheStr) continue
      const cache: CacheData = JSON.parse(cacheStr)
      if (Date.now() - cache.timestamp > CACHE_EXPIRY) continue
      const found = cache.words.find(w => w.word.toLowerCase() === normalized)
      if (found?.phonetic) return found.phonetic
    } catch { continue }
  }
  return null
}
