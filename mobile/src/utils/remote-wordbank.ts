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
// 微信 storage 单 key 上限按字节计 1MB，超出需分块；按 UTF-8 字节切分并留余量
//（多字节词库用字符数会严重低估体积，见 bug-list-2026-11-25 D15）
const CHUNK_SIZE = 800 * 1024

/** 词库清单条目（与 index.json 一致） */
import { splitStringByUtf8Bytes } from '@/adapters/index'
import { getProfile, type LanguageCode } from '@/utils/language'
// 随包内置的清单快照（约 5KB）：首屏先展示，远端刷新只负责更新，弱网/慢 CDN 时不再空白
import bundledIndexJson from '../../wordbank-json/index.json'

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
  idioms: 'oral', 'sentence-patterns': 'oral', roots: 'oral',
  'spoken-reductions-1': 'oral', 'spoken-reactions-1': 'oral',
  'spoken-reductions-2': 'oral', 'spoken-elision-1': 'oral',
  'spoken-liaison-1': 'oral', 'spoken-reactions-2': 'oral',
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

function readCachedIds(): string[] {
  try {
    const raw = uni.getStorageSync(CACHE_INDEX_KEY)
    const ids = Array.isArray(raw) ? raw : (typeof raw === 'string' && raw ? JSON.parse(raw) : [])
    return Array.isArray(ids) ? ids.filter((id: unknown): id is string => typeof id === 'string') : []
  } catch {
    return []
  }
}

/**
 * 已缓存的词库 id 列表。
 * 自愈：导入成功后会删除原始 JSON 缓存，若列表没同步就会显示「已下载」但点开重新下载，
 * 这里按缓存是否真的存在过滤一次（并回写），避免界面与实际状态不一致。
 */
export function getCachedBankIds(): string[] {
  const ids = readCachedIds()
  const alive = ids.filter((id) => {
    try { return !!uni.getStorageSync(CACHE_KEY_PREFIX + id) } catch { return false }
  })
  if (alive.length !== ids.length) {
    try { uni.setStorageSync(CACHE_INDEX_KEY, JSON.stringify(alive)) } catch { /* ignore */ }
  }
  return alive
}

/** 标记词库已缓存 */
function markCached(id: string) {
  const ids = readCachedIds()
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
      // 分片数与 key 列表必须一致，防止半截写入被误当完整缓存（bug-list-2026-11-25 14.4）
      if (!Array.isArray(raw._chunkKeys) || raw._chunkKeys.length !== raw._chunks) return null
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

/** 写入缓存，超上限自动按 UTF-8 字节分块（level8 等大词库整存必然写失败） */
function saveCacheWithChunks(id: string, jsonStr: string): void {
  const key = CACHE_KEY_PREFIX + id
  const chunks = splitStringByUtf8Bytes(jsonStr, CHUNK_SIZE)
  if (chunks.length <= 1) {
    uni.setStorageSync(key, chunks[0] ?? jsonStr)
    markCached(id)
    return
  }
  const chunkKeys: string[] = []
  try {
    chunks.forEach((chunk, i) => {
      const chunkKey = `${key}__chunk__${i}`
      chunkKeys.push(chunkKey)
      uni.setStorageSync(chunkKey, chunk)
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
  // 同步从「已下载」列表移除：导入成功后缓存被删，界面若仍显示已下载，再点会重新下载并可能报错
  try {
    const ids = readCachedIds()
    const next = ids.filter((x) => x !== id)
    if (next.length !== ids.length) uni.setStorageSync(CACHE_INDEX_KEY, JSON.stringify(next))
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
          // 403/429 多为 jsDelivr 对同一出口 IP 的限流，提示重试比只报数字有用
          reject(new Error(res.statusCode === 403 || res.statusCode === 429
            ? `下载被限流（${res.statusCode}），请稍后重试`
            : `下载失败（${res.statusCode}）`))
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
              // 空词库（如历史遗留的 newConcept.json = []）不能当成下载成功，否则会被标记已下载并导入 0 词
              if (data.length === 0) throw new Error('词库文件为空')
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
  if (cached && cached.length > 0) return cached
  // 空缓存（旧版本把空文件写进了 storage）视为无效，清掉后重新下载
  if (cached) removeCachedWordBank(id)
  return downloadWordBank(id, onProgress)
}

/**
 * 上次成功拉到的清单（刷新失败时兜底，避免线上弱网/域名异常时列表整块消失）
 */
const INDEX_CACHE_KEY = 'slowlyrecord_remote_wordbank_index_list'

/** 补齐清单外的托管词库（多语言 + 口语句库） */
function mergeIndex(data: RemoteWordBankInfo[]): RemoteWordBankInfo[] {
  const remoteIds = new Set(data.map(bank => bank.id))
  return [
    ...data.map(bank => ({ ...bank, language: bank.language || 'en' })),
    ...PUBLIC_HOSTED_BANKS.filter(bank => !remoteIds.has(bank.id)),
  ]
}

/** downloadFile 通道读 JSON：与词库下载共用 downloadFile 合法域名，不额外依赖 request 域名 */
function fetchJsonByDownload(url: string): Promise<any | null> {
  return new Promise((resolve) => {
    uni.downloadFile({
      url,
      success: (res) => {
        if (res.statusCode !== 200) return resolve(null)
        uni.getFileSystemManager().readFile({
          filePath: res.tempFilePath,
          encoding: 'utf-8',
          success: (readRes) => { try { resolve(JSON.parse(String(readRes.data))) } catch { resolve(null) } },
          fail: () => resolve(null),
        })
      },
      fail: () => resolve(null),
    })
  })
}

/** request 通道读 JSON（备用）；部分环境把 JSON 当字符串返回，这里统一兜住 */
function fetchJsonByRequest(url: string): Promise<any | null> {
  return new Promise((resolve) => {
    uni.request({
      url,
      dataType: 'json',
      success: (res) => {
        if (res.statusCode !== 200) return resolve(null)
        const data: any = res.data
        if (typeof data === 'string') {
          try { resolve(JSON.parse(data)) } catch { resolve(null) }
          return
        }
        resolve(data)
      },
      fail: () => resolve(null),
    })
  })
}

/** 随包内置的清单（已补齐托管词库），首屏与所有网络通道失败时都用它 */
export function getBundledIndex(): RemoteWordBankInfo[] {
  const rows = Array.isArray(bundledIndexJson) ? bundledIndexJson as RemoteWordBankInfo[] : []
  return mergeIndex(rows)
}

function readCachedIndex(): RemoteWordBankInfo[] | null {
  try {
    const raw = uni.getStorageSync(INDEX_CACHE_KEY)
    const parsed = typeof raw === 'string' && raw ? JSON.parse(raw) : raw
    return Array.isArray(parsed) && parsed.length ? parsed : null
  } catch {
    return null
  }
}

/**
 * 拉取远程词库清单，并补齐清单外的托管词库（多语言 + 口语句库）。
 * 线上小程序 request 与 downloadFile 是两套合法域名，词库文件走 downloadFile 已配好，
 * 清单此前只走 request，缺 request 域名时整页刷不出来；现改为 downloadFile 优先、request 兜底，
 * 两者都失败再退回上次成功的清单。
 */
export async function fetchRemoteIndex(): Promise<RemoteWordBankInfo[] | null> {
  const url = `${JSDELIVR_BASE}/index.json`
  let data = await fetchJsonByDownload(url)
  if (!Array.isArray(data)) data = await fetchJsonByRequest(url)
  if (Array.isArray(data)) {
    const list = mergeIndex(data as RemoteWordBankInfo[])
    try { uni.setStorageSync(INDEX_CACHE_KEY, JSON.stringify(list)) } catch { /* 超配额时忽略，不影响本次展示 */ }
    return list
  }
  return readCachedIndex() ?? getBundledIndex()
}
