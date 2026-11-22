/**
 * 词库远程下载（jsDelivr CDN 缓存 GitHub 仓库）
 *
 * 英语词库读取 mobile/wordbank-json/，多语言与口语句库（spoken-*）复用 public/wordbanks/。
 * jsDelivr 自动缓存 GitHub 内容，国内有 CDN 节点，比 raw.githubusercontent.com 稳定。
 * 首次下载后缓存到本地 storage，之后离线可用。
 *
 * 域名白名单：小程序后台需把 https://cdn.jsdelivr.net 加入 downloadFile 合法域名。
 */

const JSDELIVR_BASE = 'https://cdn.jsdelivr.net/gh/chuxiangshi2026/slowlyRecord@master/mobile/wordbank-json'
const PUBLIC_WORDBANK_BASE = 'https://cdn.jsdelivr.net/gh/chuxiangshi2026/slowlyRecord@master/public/wordbanks'
const CACHE_KEY_PREFIX = 'slowlyrecord_remote_wordbank_'
const CACHE_INDEX_KEY = 'slowlyrecord_remote_wordbank_index'
// 微信 storage 单 key 上限 1MB，超出需分块（与 adapters/index.ts 的 CHUNK_SIZE 一致）
const CHUNK_SIZE = 900 * 1024

/** 词库清单条目（与 index.json 一致） */
import { getProfile, type LanguageCode } from '@/utils/language'

export interface RemoteWordBankInfo {
  id: string
  name: string
  wordCount: number
  sizeKB: number
  language?: LanguageCode
  /** 带预合成连读音频（public/speech-audio/<id>/），播放时优先于在线 TTS */
  speechAudio?: boolean
}

/** 词库分类（英语按用途分，非英语按语种分） */
export interface BankCategory {
  id: string
  label: string
}

export const BANK_CATEGORIES: BankCategory[] = [
  { id: 'exam', label: '考试' },
  { id: 'level', label: '分级' },
  { id: 'oral', label: '口语句型' },
  { id: 'media', label: '影视台词' },
  { id: 'dev', label: '程序员' },
  { id: 'life', label: '生活场景' },
  { id: 'other', label: '其他' },
]

/** 英语词库 id → 分类 */
const EN_CATEGORY_BY_ID: Record<string, string> = {
  // 考试（中高考/四六级/考研/出国/公考）
  zhongkao: 'exam', gaokao: 'exam', cet4: 'exam', cet6: 'exam',
  kaoyan: 'exam', zsb: 'exam', kaogong: 'exam', ielts: 'exam',
  'ielts-topics': 'exam', toefl: 'exam', 'toefl-academic': 'exam',
  gre: 'exam', gmat: 'exam', sat: 'exam', bec: 'exam',
  // 分级词库
  level4: 'level', level8: 'level',
  // 口语与句型
  'oral-basic': 'oral', 'oral-intermediate': 'oral', 'oral-advanced': 'oral',
  'common-phrases': 'oral', collocations: 'oral', 'phrasal-verbs': 'oral',
  idioms: 'oral', 'sentence-patterns': 'oral', roots: 'oral', newConcept: 'oral',
  'spoken-reductions-1': 'oral', 'spoken-reactions-1': 'oral',
  'spoken-reductions-2': 'oral', 'spoken-elision-1': 'oral',
  'spoken-liaison-1': 'oral', 'spoken-reactions-2': 'oral',
  // 影视台词与名言
  'girl-meets-world': 'media', 'friends-tv': 'media', 'modern-family': 'media',
  'big-bang-theory': 'media', sherlock: 'media', 'the-crown': 'media',
  'pursuit-of-happyness': 'media', 'forrest-gump': 'media',
  'shawshank-redemption': 'media', 'movie-lines': 'media', 'famous-quotes': 'media',
  // 程序员
  'tech-vocab': 'dev', 'dev-phrases': 'dev', 'dev-status': 'dev',
  'dev-debugging': 'dev', 'dev-reading': 'dev', 'dev-discussion': 'dev',
  // 生活场景
  dining: 'life', shopping: 'life', transport: 'life',
}

/** 词库所属分类：非英语按语种（lang:ja 等），英语按用途，未收录 id 归「其他」 */
export function categoryIdOf(bank: RemoteWordBankInfo): string {
  const lang = bank.language || 'en'
  if (lang !== 'en') return `lang:${lang}`
  return EN_CATEGORY_BY_ID[bank.id] ?? 'other'
}

/** 从清单构建出现的分类 tab（固定顺序：英语汇总 → 英语用途分类 → 语种分类） */
export function buildCategoryTabs(list: RemoteWordBankInfo[]): BankCategory[] {
  const present = new Set(list.map(categoryIdOf))
  const tabs = BANK_CATEGORIES.filter((c) => present.delete(c.id))
  // 剩余的是语种分类，按清单中首次出现顺序补齐
  for (const bank of list) {
    const id = categoryIdOf(bank)
    if (present.has(id)) {
      present.delete(id)
      tabs.push({ id, label: getProfile(bank.language || 'en').nameZh })
    }
  }
  // 有英语词库时在最前面补「英语」汇总 tab（与非英语语种 tab 对齐，英语用途分类是其细分）
  if (list.some((bank) => (bank.language || 'en') === 'en')) {
    tabs.unshift({ id: 'lang:en', label: '英语' })
  }
  return tabs
}

/** 不在 mobile/wordbank-json 清单、数据复用桌面端 public/wordbanks 的词库（多语言词库 + 口语连读/反应句库） */
export const PUBLIC_HOSTED_BANKS: RemoteWordBankInfo[] = [
  { id: 'jlpt-n5', name: 'JLPT N5', wordCount: 700, sizeKB: 61, language: 'ja' },
  { id: 'jlpt-n4', name: 'JLPT N4', wordCount: 1169, sizeKB: 114, language: 'ja' },
  { id: 'jlpt-n3', name: 'JLPT N3', wordCount: 1441, sizeKB: 143, language: 'ja' },
  { id: 'ru-a1', name: '俄语 A1', wordCount: 471, sizeKB: 56, language: 'ru' },
  { id: 'ru-a2', name: '俄语 A2', wordCount: 303, sizeKB: 38, language: 'ru' },
  { id: 'es-a1', name: '西语 A1', wordCount: 391, sizeKB: 38, language: 'es' },
  { id: 'es-a2', name: '西语 A2', wordCount: 749, sizeKB: 76, language: 'es' },
  { id: 'fr-a1', name: '法语 A1', wordCount: 514, sizeKB: 51, language: 'fr' },
  { id: 'fr-a2', name: '法语 A2', wordCount: 799, sizeKB: 81, language: 'fr' },
  { id: 'ja-common-phrases', name: '日语常用短语', wordCount: 157, sizeKB: 12, language: 'ja' },
  { id: 'ja-collocations', name: '日语固定搭配', wordCount: 142, sizeKB: 11, language: 'ja' },
  { id: 'ja-sentences', name: '日语常用句子', wordCount: 167, sizeKB: 17, language: 'ja' },
  { id: 'ru-common-phrases', name: '俄语常用短语', wordCount: 204, sizeKB: 21, language: 'ru' },
  { id: 'ru-collocations', name: '俄语固定搭配', wordCount: 179, sizeKB: 17, language: 'ru' },
  { id: 'ru-sentences', name: '俄语常用句子', wordCount: 135, sizeKB: 18, language: 'ru' },
  { id: 'es-common-phrases', name: '西语常用短语', wordCount: 220, sizeKB: 20, language: 'es' },
  { id: 'es-collocations', name: '西语固定搭配', wordCount: 149, sizeKB: 13, language: 'es' },
  { id: 'es-sentences', name: '西语常用句子', wordCount: 136, sizeKB: 16, language: 'es' },
  { id: 'fr-common-phrases', name: '法语常用短语', wordCount: 213, sizeKB: 19, language: 'fr' },
  { id: 'fr-collocations', name: '法语固定搭配', wordCount: 166, sizeKB: 14, language: 'fr' },
  { id: 'fr-sentences', name: '法语常用句子', wordCount: 135, sizeKB: 16, language: 'fr' },
  // 英语口语（连读弱读 / 略读省音 / 连读规则 / 高频反应句），桌面端同文件，配套预合成自然连读音频（speechAudio）
  { id: 'spoken-reductions-1', name: '连读弱读 500 句', wordCount: 500, sizeKB: 54, language: 'en', speechAudio: true },
  { id: 'spoken-reactions-1', name: '口语反应 500 句', wordCount: 500, sizeKB: 43, language: 'en', speechAudio: true },
  { id: 'spoken-reductions-2', name: '连读弱读 500 句 II', wordCount: 500, sizeKB: 70, language: 'en', speechAudio: true },
  { id: 'spoken-elision-1', name: '略读省音 500 句', wordCount: 500, sizeKB: 79, language: 'en', speechAudio: true },
  { id: 'spoken-liaison-1', name: '连读规则 500 句', wordCount: 500, sizeKB: 53, language: 'en', speechAudio: true },
  { id: 'spoken-reactions-2', name: '口语反应 500 句 II', wordCount: 500, sizeKB: 45, language: 'en', speechAudio: true },
]

/** 词库是否带预合成连读音频（public/speech-audio/<id>/，见 utils/speech-audio.ts） */
export function hasSpeechAudio(bankId: string): boolean {
  return !!bankId && PUBLIC_HOSTED_BANKS.some((bank) => bank.id === bankId && bank.speechAudio === true)
}

/** 已缓存的词库 id 列表 */
export function getCachedBankIds(): string[] {
  try {
    const raw = uni.getStorageSync(CACHE_INDEX_KEY)
    if (Array.isArray(raw)) return raw
    if (typeof raw === 'string' && raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  return []
}

/** 标记词库已缓存 */
function markCached(id: string) {
  const ids = getCachedBankIds()
  if (!ids.includes(id)) {
    ids.push(id)
    try { uni.setStorageSync(CACHE_INDEX_KEY, JSON.stringify(ids)) } catch { /* ignore */ }
  }
}

/** 从本地缓存读取词库（未缓存返回 null）；兼容分块与旧版整存两种形态 */
export function loadCachedWordBank(id: string): any[] | null {
  try {
    const raw = uni.getStorageSync(CACHE_KEY_PREFIX + id)
    if (!raw) return null
    // 分块形态：主 key 存 {_chunks, _chunkKeys} 元信息
    if (typeof raw === 'object' && raw._chunkKeys) {
      let joined = ''
      for (const chunkKey of raw._chunkKeys) {
        const part = uni.getStorageSync(chunkKey)
        if (typeof part !== 'string' || !part) return null
        joined += part
      }
      const data = JSON.parse(joined)
      return Array.isArray(data) ? data : null
    }
    const data = typeof raw === 'string' ? JSON.parse(raw) : raw
    return Array.isArray(data) ? data : null
  } catch {
    return null
  }
}

/** 写入缓存，超 1MB 自动分块（level8 等大词库整存必然写失败） */
function saveCacheWithChunks(id: string, jsonStr: string): void {
  const key = CACHE_KEY_PREFIX + id
  if (jsonStr.length <= CHUNK_SIZE) {
    uni.setStorageSync(key, jsonStr)
    markCached(id)
    return
  }
  const chunkKeys: string[] = []
  for (let i = 0, n = 0; i < jsonStr.length; i += CHUNK_SIZE, n++) {
    chunkKeys.push(`${key}__chunk__${n}`)
  }
  try {
    chunkKeys.forEach((chunkKey, i) => {
      uni.setStorageSync(chunkKey, jsonStr.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE))
    })
    uni.setStorageSync(key, { _chunks: chunkKeys.length, _chunkKeys: chunkKeys })
    markCached(id)
  } catch (e) {
    // 失败清理残留分块，避免半成品缓存
    chunkKeys.forEach((chunkKey) => { try { uni.removeStorageSync(chunkKey) } catch { /* ignore */ } })
    throw e
  }
}

/** 删除词库缓存（含分块） */
export function removeCachedWordBank(id: string): void {
  const key = CACHE_KEY_PREFIX + id
  try {
    const raw = uni.getStorageSync(key)
    if (raw && typeof raw === 'object' && raw._chunkKeys) {
      for (const chunkKey of raw._chunkKeys) {
        try { uni.removeStorageSync(chunkKey) } catch { /* ignore */ }
      }
    }
    uni.removeStorageSync(key)
  } catch { /* ignore */ }
}

/** 下载词库 JSON（带进度回调），成功后写入缓存 */
export function downloadWordBank(
  id: string,
  onProgress?: (percent: number) => void,
): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const base = PUBLIC_HOSTED_BANKS.some(bank => bank.id === id) ? PUBLIC_WORDBANK_BASE : JSDELIVR_BASE
    const url = `${base}/${id}.json`
    const task = uni.downloadFile({
      url,
      success: (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`下载失败（${res.statusCode}）`))
          return
        }
        // 读取文件内容并解析
        uni.getFileSystemManager().readFile({
          filePath: res.tempFilePath,
          encoding: 'utf-8',
          success: (readRes) => {
            try {
              const data = JSON.parse(readRes.data as string)
              if (!Array.isArray(data)) throw new Error('格式错误')
              // 写缓存（超 1MB 自动分块，level8 等大词库整存必然写失败）
              try {
                saveCacheWithChunks(id, readRes.data as string)
              } catch {
                // 缓存写失败不阻塞，下次重新下
              }
              resolve(data)
            } catch (e: any) {
              reject(new Error(`解析失败：${e.message}`))
            }
          },
          fail: () => reject(new Error('读取下载文件失败')),
        })
      },
      fail: (err) => {
        const msg = err.errMsg || ''
        if (msg.includes('domain') || msg.includes('url not')) {
          reject(new Error('请先在小程序后台把 https://cdn.jsdelivr.net 加入 downloadFile 合法域名'))
        } else {
          reject(new Error(`下载失败：${msg}`))
        }
      },
    })
    if (onProgress && task && typeof task.onProgressUpdate === 'function') {
      task.onProgressUpdate((res) => onProgress(res.progress))
    }
  })
}

/** 获取词库：优先本地缓存，未缓存则下载 */
export async function getWordBank(
  id: string,
  onProgress?: (percent: number) => void,
): Promise<any[]> {
  const cached = loadCachedWordBank(id)
  if (cached) return cached
  return downloadWordBank(id, onProgress)
}

/** 拉取远程词库清单，并补齐清单外的托管词库（多语言 + 口语句库） */
export function fetchRemoteIndex(): Promise<RemoteWordBankInfo[] | null> {
  return new Promise((resolve) => {
    uni.request({
      url: `${JSDELIVR_BASE}/index.json`,
      success: (res) => {
        if (res.statusCode === 200 && Array.isArray(res.data)) {
          const remoteIds = new Set(res.data.map((bank: RemoteWordBankInfo) => bank.id))
          resolve([
            ...res.data.map((bank: RemoteWordBankInfo) => ({ ...bank, language: bank.language || 'en' })),
            ...PUBLIC_HOSTED_BANKS.filter(bank => !remoteIds.has(bank.id)),
          ])
        } else {
          resolve(null)
        }
      },
      fail: () => resolve(null),
    })
  })
}
