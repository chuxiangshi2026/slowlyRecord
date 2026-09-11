/**
 * 词库远程下载（GitHub + jsDelivr CDN 双通道）
 *
 * 数据存放在 GitHub 仓库 mobile/wordbank-json/，通过 raw.githubusercontent.com 拉取。
 * 首次下载后缓存到本地 storage，之后离线可用。
 *
 * 域名白名单：小程序后台需把 https://raw.githubusercontent.com 加入 downloadFile 合法域名。
 */

const GITHUB_BASE = 'https://raw.githubusercontent.com/chuxiangshi2026/slowlyRecord/master/mobile/wordbank-json'
const CACHE_KEY_PREFIX = 'slowlyrecord_remote_wordbank_'
const CACHE_INDEX_KEY = 'slowlyrecord_remote_wordbank_index'

/** 词库清单条目（与 index.json 一致） */
export interface RemoteWordBankInfo {
  id: string
  name: string
  wordCount: number
  sizeKB: number
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

/** 从本地缓存读取词库（未缓存返回 null） */
export function loadCachedWordBank(id: string): any[] | null {
  try {
    const raw = uni.getStorageSync(CACHE_KEY_PREFIX + id)
    if (!raw) return null
    const data = typeof raw === 'string' ? JSON.parse(raw) : raw
    return Array.isArray(data) ? data : null
  } catch {
    return null
  }
}

/** 下载词库 JSON（带进度回调），成功后写入缓存 */
export function downloadWordBank(
  id: string,
  onProgress?: (percent: number) => void,
): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const url = `${GITHUB_BASE}/${id}.json`
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
              // 写缓存
              try {
                uni.setStorageSync(CACHE_KEY_PREFIX + id, readRes.data)
                markCached(id)
              } catch {
                // 缓存写失败不阻塞（可能是超分块上限，下次重新下）
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
          reject(new Error('请先在小程序后台把 https://raw.githubusercontent.com 加入 downloadFile 合法域名'))
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

/** 拉取远程词库清单（index.json），失败时返回 null 走本地清单 */
export function fetchRemoteIndex(): Promise<RemoteWordBankInfo[] | null> {
  return new Promise((resolve) => {
    uni.request({
      url: `${GITHUB_BASE}/index.json`,
      success: (res) => {
        if (res.statusCode === 200 && Array.isArray(res.data)) {
          resolve(res.data)
        } else {
          resolve(null)
        }
      },
      fail: () => resolve(null),
    })
  })
}
