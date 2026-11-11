/**
 * 词库远程下载（jsDelivr CDN 缓存 GitHub 仓库）
 *
 * 英语词库读取 mobile/wordbank-json/，多语言词库复用 public/wordbanks/。
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
import type { LanguageCode } from '@/utils/language'

export interface RemoteWordBankInfo {
  id: string
  name: string
  wordCount: number
  sizeKB: number
  language?: LanguageCode
}

/** 远程旧版 index.json 未包含的多语言词库，数据复用桌面端 public/wordbanks。 */
export const NON_ENGLISH_BANKS: RemoteWordBankInfo[] = [
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
]

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
    const base = NON_ENGLISH_BANKS.some(bank => bank.id === id) ? PUBLIC_WORDBANK_BASE : JSDELIVR_BASE
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

/** 拉取远程词库清单，并补齐旧版清单缺少的多语言词库 */
export function fetchRemoteIndex(): Promise<RemoteWordBankInfo[] | null> {
  return new Promise((resolve) => {
    uni.request({
      url: `${JSDELIVR_BASE}/index.json`,
      success: (res) => {
        if (res.statusCode === 200 && Array.isArray(res.data)) {
          const remoteIds = new Set(res.data.map((bank: RemoteWordBankInfo) => bank.id))
          resolve([
            ...res.data.map((bank: RemoteWordBankInfo) => ({ ...bank, language: bank.language || 'en' })),
            ...NON_ENGLISH_BANKS.filter(bank => !remoteIds.has(bank.id)),
          ])
        } else {
          resolve(null)
        }
      },
      fail: () => resolve(null),
    })
  })
}
