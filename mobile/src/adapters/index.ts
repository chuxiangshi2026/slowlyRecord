/**
 * 移动端适配器统一入口
 * 合并所有适配器到单文件，避免微信小程序模块加载顺序问题
 */

// ==================== 类型定义 ====================

export type DbDoc<T extends {} = Record<string, any>> = {
  _id: string
  _rev?: string
} & T

export interface DbReturn {
  id: string
  rev?: string
  ok?: boolean
  error?: boolean
  name?: string
  message?: string
}

export interface DbAdapter {
  get<T extends {} = Record<string, any>>(id: string): DbDoc<T> | null
  /** 异步读单条文档（可选实现）：分片文档异步重组，避免大词库同步 JSON.parse 阻塞 JS 线程 */
  getAsync?<T extends {} = Record<string, any>>(id: string): Promise<DbDoc<T> | null>
  put(doc: DbDoc): DbReturn
  allDocs<T extends {} = Record<string, any>>(prefix?: string): DbDoc<T>[]
  remove(doc: string | DbDoc): DbReturn
  bulkDocs(docs: DbDoc[]): DbReturn[]
  promises: {
    get<T extends {} = Record<string, any>>(id: string): Promise<DbDoc<T> | null>
    put(doc: DbDoc): Promise<DbReturn>
    asyncPut(doc: DbDoc): Promise<DbReturn>
    remove(doc: string | DbDoc): Promise<DbReturn>
    bulkDocs(docs: DbDoc[]): Promise<DbReturn[]>
    asyncBulkDocs(docs: DbDoc[]): Promise<DbReturn[]>
  }
}

export interface DbStorageAdapter {
  setItem(key: string, value: any): void
  getItem(key: string): any
  removeItem(key: string): void
}

// ==================== DbAdapter 注册 ====================

let _dbAdapter: DbAdapter | null = null

export function getDbAdapter(): DbAdapter {
  if (!_dbAdapter) {
    throw new Error('DbAdapter not initialized. Call setDbAdapter() first.')
  }
  return _dbAdapter
}

export function setDbAdapter(adapter: DbAdapter): void {
  _dbAdapter = adapter
}

export function resetDbAdapter(): void {
  _dbAdapter = null
}

// ==================== MiniProgramDbAdapter ====================

const STORAGE_PREFIX = 'slowlyrecord_'
const CHUNK_SIZE = 900 * 1024

/** uni.getStorage 的 Promise 封装：读不到时 resolve null，与同步读取的容错语义对齐 */
function getStorageAsync(key: string): Promise<any> {
  return new Promise((resolve) => {
    uni.getStorage({
      key,
      success: (res: any) => resolve(res?.data ?? null),
      fail: () => resolve(null),
    })
  })
}

export class MiniProgramDbAdapter implements DbAdapter {
  private prefix: string

  promises = {
    get: <T extends {} = Record<string, any>>(id: string): Promise<DbDoc<T> | null> => {
      return Promise.resolve(this.get<T>(id))
    },
    put: (doc: DbDoc): Promise<DbReturn> => {
      return Promise.resolve(this.put(doc))
    },
    asyncPut: (doc: DbDoc): Promise<DbReturn> => {
      return this.asyncPut(doc)
    },
    remove: (doc: string | DbDoc): Promise<DbReturn> => {
      return Promise.resolve(this.remove(doc))
    },
    bulkDocs: (docs: DbDoc[]): Promise<DbReturn[]> => {
      return Promise.resolve(this.bulkDocs(docs))
    },
    asyncBulkDocs: (docs: DbDoc[]): Promise<DbReturn[]> => {
      return this.asyncBulkDocs(docs)
    },
  }

  constructor(prefix: string = STORAGE_PREFIX) {
    this.prefix = prefix
  }

  private getKey(id: string): string {
    return `${this.prefix}${id}`
  }

  private cleanupChunks(chunkKeys?: string[]): void {
    if (!Array.isArray(chunkKeys)) return
    for (const chunkKey of chunkKeys) {
      try { uni.removeStorageSync(chunkKey) } catch { /* ignore */ }
    }
  }

  private cleanupExistingChunks(key: string): void {
    try {
      const existing = uni.getStorageSync(key)
      if (existing && existing._chunks && existing._chunkKeys) {
        this.cleanupChunks(existing._chunkKeys)
      }
    } catch { /* ignore */ }
  }

  private saveWithChunks<T>(doc: DbDoc<T>): DbReturn {
    const key = this.getKey(doc._id)
    const dataStr = JSON.stringify(doc)

    if (dataStr.length <= CHUNK_SIZE) {
      try {
        this.cleanupExistingChunks(key)
        uni.setStorageSync(key, doc)
        return { id: doc._id, rev: doc._rev || '1', ok: true }
      } catch (e) {
        return { id: doc._id, rev: doc._rev || '1', ok: false, error: true, message: String(e) }
      }
    }

    const chunks: string[] = []
    for (let i = 0; i < dataStr.length; i += CHUNK_SIZE) {
      chunks.push(dataStr.slice(i, i + CHUNK_SIZE))
    }

    const chunkInfo = {
      _id: doc._id,
      _rev: doc._rev || '1',
      _chunks: chunks.length,
      _chunkKeys: chunks.map((_, index) => `${key}__chunk__${index}`)
    }

    try {
      this.cleanupExistingChunks(key)
      chunks.forEach((chunk, index) => {
        uni.setStorageSync(`${key}__chunk__${index}`, chunk)
      })
      uni.setStorageSync(key, chunkInfo)
      return { id: doc._id, rev: chunkInfo._rev, ok: true }
    } catch (e) {
      this.cleanupChunks(chunkInfo._chunkKeys)
      return { id: doc._id, rev: doc._rev || '1', ok: false, error: true, message: String(e) }
    }
  }

  private readWithChunksSync<T>(key: string): DbDoc<T> | null {
    try {
      const data = uni.getStorageSync(key)
      if (!data) {
        return null
      }

      if (data._chunks && data._chunkKeys) {
        let fullData = ''
        for (const chunkKey of data._chunkKeys) {
          const chunk = uni.getStorageSync(chunkKey)
          if (chunk === undefined || chunk === null) return null
          fullData += chunk
        }
        return JSON.parse(fullData) as DbDoc<T>
      }

      return data as DbDoc<T>
    } catch (e) {
      return null
    }
  }

  /** 异步分块读取：与 readWithChunksSync 逻辑一致，但读取走 uni.getStorage 异步接口 */
  private async readWithChunksAsync<T>(key: string): Promise<DbDoc<T> | null> {
    try {
      const data = await getStorageAsync(key)
      if (!data) {
        return null
      }

      if (data._chunks && data._chunkKeys) {
        let fullData = ''
        for (const chunkKey of data._chunkKeys) {
          const chunk = await getStorageAsync(chunkKey)
          if (chunk === undefined || chunk === null) return null
          fullData += chunk
        }
        return JSON.parse(fullData) as DbDoc<T>
      }

      return data as DbDoc<T>
    } catch (e) {
      return null
    }
  }

  get<T extends {} = Record<string, any>>(id: string): DbDoc<T> | null {
    return this.readWithChunksSync<T>(this.getKey(id))
  }

  /** 异步读单条文档：语义与 get 一致，但全程走 uni.getStorage，避免大词库阻塞首屏 JS 线程 */
  async getAsync<T extends {} = Record<string, any>>(id: string): Promise<DbDoc<T> | null> {
    return this.readWithChunksAsync<T>(this.getKey(id))
  }

  put(doc: DbDoc): DbReturn {
    return this.saveWithChunks(doc)
  }

  remove(doc: string | DbDoc): DbReturn {
    const id = typeof doc === 'string' ? doc : doc._id
    const key = this.getKey(id)
    try {
      const existing = uni.getStorageSync(key)
      if (existing && existing._chunks && existing._chunkKeys) {
        for (const chunkKey of existing._chunkKeys) {
          uni.removeStorageSync(chunkKey)
        }
      }
      uni.removeStorageSync(key)
      return { id, rev: '1', ok: true }
    } catch (e) {
      return { id, rev: '1', ok: false, error: true, message: String(e) }
    }
  }

  allDocs<T extends {} = Record<string, any>>(key?: string): DbDoc<T>[] {
    const items: DbDoc<T>[] = []
    try {
      const res = uni.getStorageInfoSync()
      const keys = res.keys || []

      for (const k of keys) {
        if (k.startsWith(this.prefix) && !k.includes('__chunk__')) {
          const doc = this.readWithChunksSync<T>(k)
          if (doc) {
            // 防御性处理：某些情况下 _id 可能丢失
            if (!doc._id) {
              doc._id = k.replace(this.prefix, '')
            }
            if (!key || doc._id.startsWith(key)) {
              items.push(doc)
            }
          }
        }
      }
    } catch (e) {
      // 静默处理
    }
    return items
  }

  bulkDocs(docs: DbDoc[]): DbReturn[] {
    return docs.map(doc => this.put(doc))
  }

  /** 异步批量写入，使用 uni.setStorage 避免阻塞主线程 */
  async asyncBulkDocs(docs: DbDoc[]): Promise<DbReturn[]> {
    const CONCURRENCY = 5
    const results: DbReturn[] = []
    for (let i = 0; i < docs.length; i += CONCURRENCY) {
      const chunk = docs.slice(i, i + CONCURRENCY)
      const chunkResults = await Promise.all(chunk.map(doc => this.asyncPut(doc)))
      results.push(...chunkResults)
    }
    return results
  }

  /** 异步写入单条文档，预检大小避免无效 setStorage 调用 */
  private async asyncPut(doc: DbDoc): Promise<DbReturn> {
    const key = this.getKey(doc._id)
    const dataStr = JSON.stringify(doc)

    // 大数据直接走分块写入，跳过必然失败的 setStorage
    if (dataStr.length > CHUNK_SIZE) {
      return this.asyncPutWithChunks(doc, key, dataStr)
    }

    try {
      this.cleanupExistingChunks(key)
      return await new Promise<DbReturn>((resolve, reject) => {
        uni.setStorage({
          key,
          data: doc,
          success: () => resolve({ id: doc._id, rev: doc._rev || '1', ok: true }),
          fail: reject,
        })
      })
    } catch (e) {
      return { id: doc._id, rev: doc._rev || '1', ok: false, error: true, message: String(e) }
    }
  }

  /** 大数据分块异步写入 */
  private async asyncPutWithChunks(doc: DbDoc, key: string, dataStr: string): Promise<DbReturn> {
    const chunks: string[] = []
    for (let i = 0; i < dataStr.length; i += CHUNK_SIZE) {
      chunks.push(dataStr.slice(i, i + CHUNK_SIZE))
    }

    const chunkInfo = {
      _id: doc._id,
      _rev: doc._rev || '1',
      _chunks: chunks.length,
      _chunkKeys: chunks.map((_: string, index: number) => `${key}__chunk__${index}`)
    }

    try {
      this.cleanupExistingChunks(key)
      for (let index = 0; index < chunks.length; index++) {
        await new Promise<void>((resolve, reject) => {
          uni.setStorage({ key: `${key}__chunk__${index}`, data: chunks[index], success: resolve, fail: reject })
        })
      }
      await new Promise<void>((resolve, reject) => {
        uni.setStorage({ key, data: chunkInfo, success: resolve, fail: reject })
      })
      return { id: doc._id, rev: chunkInfo._rev, ok: true }
    } catch (e) {
      this.cleanupChunks(chunkInfo._chunkKeys)
      return { id: doc._id, rev: doc._rev || '1', ok: false, error: true, message: String(e) }
    }
  }
}

// ==================== TtsAdapter ====================

export interface PlayAudioOptions {
  /** 静默模式：播放失败时不弹 toast（自动发音/自动连播用）；用户主动发音缺省会弹节流提示 */
  silent?: boolean
}

export interface TtsAdapter {
  speak(text: string, options?: { lang?: string; rate?: number; pitch?: number }): void
  stop(): void
  playAudio(url: string, options?: PlayAudioOptions): Promise<void>
  /** 预取音频到本地缓存（可选实现）：播当前词时提前缓存下一个词，降低切词后的发音延迟 */
  prefetchAudio?(url: string): void
}

// ---------- 音频本地缓存（纯函数部分，便于单测）----------

/** 缓存清单条目：key 为单词文本哈希，filePath 为本地持久文件路径 */
export interface AudioCacheEntry {
  key: string
  filePath: string
  lastUsed: number
  /** 本地文件字节数（有则记录，用于字节上限淘汰） */
  size?: number
}

/** FNV-1a 哈希：把任意单词文本映射为固定长度的缓存 key，规避特殊字符与超长 key */
export function hashAudioCacheKey(text: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash.toString(36)
}

/** LRU 淘汰：清单超过上限时，按最久未用顺序挑出应淘汰的条目 */
export function pickLruEvictions(entries: AudioCacheEntry[], maxFiles: number): AudioCacheEntry[] {
  if (entries.length <= maxFiles) return []
  return [...entries]
    .sort((a, b) => a.lastUsed - b.lastUsed)
    .slice(0, entries.length - maxFiles)
}

/** 按字节上限淘汰：总字节超过 maxBytes 时，按最久未用顺序淘汰，直到不超上限。返回应淘汰的条目 */
export function pickLruEvictionsForBytes(entries: AudioCacheEntry[], maxBytes: number): AudioCacheEntry[] {
  const total = entries.reduce((sum, e) => sum + (e.size || 0), 0)
  if (total <= maxBytes) return []
  const byUsed = [...entries].sort((a, b) => a.lastUsed - b.lastUsed)
  let acc = total
  const evicted: AudioCacheEntry[] = []
  for (const e of byUsed) {
    if (acc <= maxBytes) break
    acc -= e.size || 0
    evicted.push(e)
  }
  return evicted
}

/** 从 TTS URL 提取缓存 key 用的单词文本（支持有道 dictvoice 的 audio 参数与 google tts 的 q 参数），提取不到返回 null */
export function parseAudioCacheWord(url: string): string | null {
  try {
    const qIndex = url.indexOf('?')
    if (qIndex < 0) return null
    const params = new URLSearchParams(url.slice(qIndex + 1))
    const raw = params.get('audio') ?? params.get('q')
    const word = raw?.trim().toLowerCase()
    return word ? word : null
  } catch {
    return null
  }
}

// ---------- 播放器实现 ----------

/** 缓存清单在 Storage 中的 key */
const AUDIO_CACHE_MANIFEST_KEY = 'slowlyrecord_audio_cache_manifest'
/** 本地音频缓存文件数上限，超出按最久未用淘汰 */
const AUDIO_CACHE_MAX_FILES = 200
/** 本地音频缓存总字节上限：小程序用户数据目录同样有 10MB 级配额，防顶满 */
const AUDIO_CACHE_MAX_BYTES = 5 * 1024 * 1024

/** 存储配额告警阈值：currentSize/limitSize 超过此比例时提示清理 */
const STORAGE_QUOTA_RATIO = 0.8
/** 存储配额提示的最小间隔，避免连续弹 toast */
const QUOTA_TOAST_INTERVAL = 5 * 60 * 1000

/**
 * 存储配额检查（纯函数，便于单测）：超出阈值时返回提示文案，否则返回空串。
 * @param currentSize 已用字节
 * @param limitSize   配额上限字节
 */
export function storageQuotaWarning(currentSize: number, limitSize: number): string {
  if (!(limitSize > 0) || !(currentSize >= 0)) return ''
  if (currentSize / limitSize >= STORAGE_QUOTA_RATIO) {
    return `存储空间已用 ${Math.round((currentSize / limitSize) * 100)}%，建议清理音频缓存或精简词库`
  }
  return ''
}
/** 单次播放超时（弱网兜底，触发即视为失败进入重试） */
const AUDIO_PLAY_TIMEOUT = 15000
/** 播放失败的最大重试次数 */
const AUDIO_MAX_RETRY = 2
/** 重试基础间隔（毫秒），第 N 次重试等待 N 倍间隔 */
const AUDIO_RETRY_BASE_DELAY = 400
/** 播放失败 toast 的最小间隔，避免连续弹窗 */
const AUDIO_FAIL_TOAST_INTERVAL = 3000

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

class MiniProgramTtsAdapter implements TtsAdapter {
  private innerAudio: any = null
  /** 缓存清单（null 表示尚未加载），缓存读写全部容错，绝不影响发音主流程 */
  /** 缓存清单在 Storage 中的 key */
  private cacheManifest: Record<string, AudioCacheEntry> | null = null
  private lastFailToastAt = 0
  private lastQuotaToastAt = 0
  /** 播放代次：每次 playAudio/stop 自增，旧代次的待重试与回调一律作废，防止过期音频抢跑 */
  private generation = 0

  speak(_text: string, _options?: { lang?: string; rate?: number; pitch?: number }): void {
    console.warn('MiniProgramTtsAdapter.speak: Use playAudio with TTS URL instead')
  }

  stop(): void {
    // 自增代次：进行中的播放与待重试的旧请求随之作废（拒绝时静默，不弹提示）
    this.generation++
    if (this.innerAudio) {
      try { this.innerAudio.stop() } catch { /* ignore */ }
      try { this.innerAudio.destroy?.() } catch { /* ignore */ }
      this.innerAudio = null
    }
  }

  async playAudio(url: string, options?: PlayAudioOptions): Promise<void> {
    const generation = ++this.generation
    // 命中本地缓存则直接播本地路径，弱网也能即时发音
    const cacheWord = parseAudioCacheWord(url)
    const cacheKey = cacheWord ? hashAudioCacheKey(cacheWord) : null
    const cachedPath = cacheKey ? this.readCachePath(cacheKey) : null
    const targetUrl = cachedPath || url

    let lastErr: any = null
    for (let attempt = 0; attempt <= AUDIO_MAX_RETRY; attempt++) {
      // 代际校验：已被更新的播放取代（切词/手动停止）时，旧请求直接作废，不再重试
      if (generation !== this.generation) throw lastErr ?? new Error('stale audio play aborted')
      try {
        await this.playOnce(targetUrl)
        // 播放成功后后台补齐本地缓存（仅在线地址命中且本地无缓存时）
        if (!cachedPath && cacheKey) {
          this.downloadAndCache(url, cacheKey).catch(() => { /* 缓存失败静默 */ })
        }
        return
      } catch (e) {
        lastErr = e
        if (attempt < AUDIO_MAX_RETRY) {
          await delay(AUDIO_RETRY_BASE_DELAY * (attempt + 1))
        }
      }
    }

    // 代际作废后的失败一律静默；仅用户主动发音（非静默）才节流提示，
    // 错误继续抛给调用方走备用音源等兜底
    if (generation !== this.generation) throw lastErr
    if (!options?.silent) {
      this.toastFailThrottled()
    }
    throw lastErr
  }

  /** 预取音频：本地缓存缺失时后台下载落盘，下次 playAudio 命中缓存即可即时发音 */
  prefetchAudio(url: string): void {
    const word = parseAudioCacheWord(url)
    if (!word) return
    const key = hashAudioCacheKey(word)
    try {
      if (this.loadManifest()[key]?.filePath) return
    } catch {
      return
    }
    this.downloadAndCache(url, key).catch(() => { /* 预取失败静默，播放时仍走在线地址 */ })
  }

  /** 单次播放：出错或超时视为失败，由上层决定是否重试 */
  private playOnce(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // 先停止并销毁旧实例，避免旧实例的 onEnded 把新引用清掉导致 stop() 失效
      if (this.innerAudio) {
        try { this.innerAudio.stop() } catch { /* ignore */ }
        try { this.innerAudio.destroy?.() } catch { /* ignore */ }
        this.innerAudio = null
      }

      let audio: any
      try {
        audio = uni.createInnerAudioContext()
      } catch (e) {
        reject(e)
        return
      }
      this.innerAudio = audio

      let settled = false
      const timer = setTimeout(() => {
        if (settled) return
        settled = true
        try { audio.stop() } catch { /* ignore */ }
        try { audio.destroy?.() } catch { /* ignore */ }
        if (this.innerAudio === audio) this.innerAudio = null
        reject(new Error('audio play timeout'))
      }, AUDIO_PLAY_TIMEOUT)

      // 仅当回调来源仍是当前实例时才清理引用（防止重叠播放时互相覆盖）
      audio.onEnded(() => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        if (this.innerAudio === audio) this.innerAudio = null
        resolve()
      })
      audio.onError((err: any) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        if (this.innerAudio === audio) this.innerAudio = null
        reject(err)
      })
      audio.src = url
      audio.play()
    })
  }

  /** 读取缓存路径并刷新 lastUsed，任何异常返回 null 走在线播放 */
  private readCachePath(key: string): string | null {
    try {
      const entry = this.loadManifest()[key]
      if (!entry || !entry.filePath) return null
      entry.lastUsed = Date.now()
      this.persistManifest()
      return entry.filePath
    } catch {
      return null
    }
  }

  /** 下载在线音频并保存为本地持久文件，全部容错：失败静默返回，不影响发音 */
  private async downloadAndCache(url: string, key: string): Promise<void> {
    try {
      const tempFilePath = await new Promise<string>((resolve, reject) => {
        uni.downloadFile({
          url,
          success: (res: any) => {
            if (res && res.statusCode >= 200 && res.statusCode < 300 && res.tempFilePath) {
              resolve(res.tempFilePath)
            } else {
              reject(new Error(`downloadFile status ${res?.statusCode}`))
            }
          },
          fail: reject,
        })
      })

      const savedFilePath = await this.saveFileLocal(tempFilePath)
      if (!savedFilePath) return

      this.toastQuotaIfHigh()
      const fileSize = await this.localFileSize(savedFilePath)
      const manifest = this.loadManifest()
      manifest[key] = { key, filePath: savedFilePath, lastUsed: Date.now(), size: fileSize ?? undefined }

      // 容量兜底：文件数或总字节任一超限，按最久未用淘汰并删除本地文件
      const byCount = pickLruEvictions(Object.values(manifest), AUDIO_CACHE_MAX_FILES)
      const byBytes = pickLruEvictionsForBytes(Object.values(manifest), AUDIO_CACHE_MAX_BYTES)
      const evicted = [...byBytes, ...byCount].filter(
        (item, i, arr) => arr.findIndex(x => x.key === item.key) === i,
      )
      for (const item of evicted) {
        delete manifest[item.key]
        this.removeSavedFile(item.filePath)
      }
      this.persistManifest()
    } catch {
      // 缓存失败静默，下次播放仍走在线地址
    }
  }

  /** 保存临时文件为持久文件：优先 FileSystemManager.saveFile，缺失时回退 uni.saveFile（兼容抖音/微信差异），均失败返回 null */
  private async saveFileLocal(tempFilePath: string): Promise<string | null> {
    try {
      const fs = (uni as any).getFileSystemManager?.()
      if (fs && typeof fs.saveFile === 'function') {
        const saved = await new Promise<string | null>((resolve) => {
          fs.saveFile({
            tempFilePath,
            success: (res: any) => resolve(res?.savedFilePath || null),
            fail: () => resolve(null),
          })
        })
        if (saved) return saved
      }
    } catch {
      // 继续尝试 uni.saveFile
    }
    try {
      if (typeof (uni as any).saveFile === 'function') {
        return await new Promise<string | null>((resolve) => {
          uni.saveFile({
            tempFilePath,
            success: (res: any) => resolve(res?.savedFilePath || null),
            fail: () => resolve(null),
          })
        })
      }
    } catch {
      // ignore
    }
    return null
  }

  /** 删除本地持久文件，逐个 API 尝试，全部容错 */
  private removeSavedFile(filePath: string): void {
    try {
      const fs = (uni as any).getFileSystemManager?.()
      if (fs && typeof fs.removeSavedFile === 'function') {
        fs.removeSavedFile({ filePath, fail: () => { /* ignore */ } })
        return
      }
    } catch { /* ignore */ }
    try {
      if (typeof (uni as any).removeSavedFile === 'function') {
        uni.removeSavedFile({ filePath, fail: () => { /* ignore */ } })
      }
    } catch { /* ignore */ }
  }

  /** 查询本地文件字节数：优先 FileSystemManager.stat，缺失时回退 getFileInfo；拿不到返回 null */
  private localFileSize(filePath: string): Promise<number | null> {
    return new Promise((resolve) => {
      const fs = (uni as any).getFileSystemManager?.()
      if (fs && typeof fs.stat === 'function') {
        try {
          fs.stat({
            path: filePath,
            success: (res: any) => resolve(typeof res?.stats?.size === 'number' ? res.stats.size : null),
            fail: () => this.getFileInfoSize(filePath, resolve),
          })
          return
        } catch {
          // fall through
        }
      }
      this.getFileInfoSize(filePath, resolve)
    })
  }

  /** getFileInfo 兜底取文件大小 */
  private getFileInfoSize(filePath: string, resolve: (n: number | null) => void): void {
    try {
      const fs = (uni as any).getFileSystemManager?.()
      if (fs && typeof fs.getFileInfo === 'function') {
        fs.getFileInfo({
          filePath,
          success: (res: any) => resolve(typeof res?.size === 'number' ? res.size : null),
          fail: () => resolve(null),
        })
        return
      }
    } catch { /* ignore */ }
    resolve(null)
  }

  private loadManifest(): Record<string, AudioCacheEntry> {
    if (this.cacheManifest) return this.cacheManifest
    try {
      const data = uni.getStorageSync(AUDIO_CACHE_MANIFEST_KEY)
      this.cacheManifest = data && typeof data === 'object' ? data : {}
    } catch {
      this.cacheManifest = {}
    }
    return this.cacheManifest
  }

  private persistManifest(): void {
    try {
      uni.setStorageSync(AUDIO_CACHE_MANIFEST_KEY, this.cacheManifest || {})
    } catch {
      // 清单写失败不影响发音，下次缓存命中失败会自动回退在线播放
    }
  }

  private toastFailThrottled(): void {
    const now = Date.now()
    if (now - this.lastFailToastAt < AUDIO_FAIL_TOAST_INTERVAL) return
    this.lastFailToastAt = now
    try {
      ;(uni as any).showToast?.({ title: '发音加载失败，请检查网络', icon: 'none', duration: 2000 })
    } catch {
      // ignore
    }
  }

  /** 存储配额过高时节流提示一次（只提示，不影响正常写入） */
  private toastQuotaIfHigh(): void {
    const now = Date.now()
    if (now - this.lastQuotaToastAt < QUOTA_TOAST_INTERVAL) return
    try {
      const info: any = (uni as any).getStorageInfoSync?.()
      const warning = storageQuotaWarning(Number(info?.currentSize), Number(info?.limitSize))
      if (!warning) return
      this.lastQuotaToastAt = now
      ;(uni as any).showToast?.({ title: warning, icon: 'none', duration: 2500 })
    } catch {
      // ignore
    }
  }
}

let _ttsAdapter: TtsAdapter | null = null

export function getTtsAdapter(): TtsAdapter {
  if (!_ttsAdapter) {
    _ttsAdapter = new MiniProgramTtsAdapter()
  }
  return _ttsAdapter
}

export function setTtsAdapter(adapter: TtsAdapter): void {
  _ttsAdapter = adapter
}

// ==================== 适配器注册 ====================

export function registerMobileAdapters() {
  setDbAdapter(new MiniProgramDbAdapter())
}
