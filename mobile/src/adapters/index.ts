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

  get<T extends {} = Record<string, any>>(id: string): DbDoc<T> | null {
    return this.readWithChunksSync<T>(this.getKey(id))
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

export interface TtsAdapter {
  speak(text: string, options?: { lang?: string; rate?: number; pitch?: number }): void
  stop(): void
  playAudio(url: string): Promise<void>
}

class MiniProgramTtsAdapter implements TtsAdapter {
  private innerAudio: any = null

  speak(_text: string, _options?: { lang?: string; rate?: number; pitch?: number }): void {
    console.warn('MiniProgramTtsAdapter.speak: Use playAudio with TTS URL instead')
  }

  stop(): void {
    if (this.innerAudio) {
      this.innerAudio.stop()
      this.innerAudio = null
    }
  }

  async playAudio(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.innerAudio = uni.createInnerAudioContext()
      this.innerAudio!.src = url
      this.innerAudio!.onEnded(() => { this.innerAudio = null; resolve() })
      this.innerAudio!.onError((err) => { this.innerAudio = null; reject(err) })
      this.innerAudio!.play()
    })
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
