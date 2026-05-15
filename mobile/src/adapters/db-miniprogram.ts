import type { DbAdapter, DbDoc, DbReturn } from './db'

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

  private saveWithChunks<T>(doc: DbDoc<T>): DbReturn {
    const key = this.getKey(doc._id)
    const dataStr = JSON.stringify(doc)

    if (dataStr.length <= CHUNK_SIZE) {
      try {
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
      uni.setStorageSync(key, chunkInfo)
      chunks.forEach((chunk, index) => {
        uni.setStorageSync(`${key}__chunk__${index}`, chunk)
      })
      return { id: doc._id, rev: chunkInfo._rev, ok: true }
    } catch (e) {
      return { id: doc._id, rev: doc._rev || '1', ok: false, error: true, message: String(e) }
    }
  }

  private readWithChunksSync<T>(key: string): DbDoc<T> | null {
    try {
      const data = uni.getStorageSync(key)
      if (!data) return null

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
      console.error('读取数据失败:', e)
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
          if (doc && (!key || doc._id.startsWith(key))) {
            items.push(doc)
          }
        }
      }
    } catch (e) {
      console.error('获取所有文档失败:', e)
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

  /** 异步写入单条文档 */
  private async asyncPut(doc: DbDoc): Promise<DbReturn> {
    const key = this.getKey(doc._id)

    // 先尝试直接写入（大部分单词数据很小，不需要分块）
    try {
      return await new Promise<DbReturn>((resolve, reject) => {
        uni.setStorage({
          key,
          data: doc,
          success: () => resolve({ id: doc._id, rev: doc._rev || '1', ok: true }),
          fail: (e: any) => {
            const dataStr = JSON.stringify(doc)
            if (dataStr.length > CHUNK_SIZE) {
              this.asyncPutWithChunks(doc, key, dataStr).then(resolve, resolve)
            } else {
              reject(e)
            }
          },
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
      await new Promise<void>((resolve, reject) => {
        uni.setStorage({ key, data: chunkInfo, success: resolve, fail: reject })
      })
      for (let index = 0; index < chunks.length; index++) {
        await new Promise<void>((resolve, reject) => {
          uni.setStorage({ key: `${key}__chunk__${index}`, data: chunks[index], success: resolve, fail: reject })
        })
      }
      return { id: doc._id, rev: chunkInfo._rev, ok: true }
    } catch (e) {
      return { id: doc._id, rev: doc._rev || '1', ok: false, error: true, message: String(e) }
    }
  }
}
