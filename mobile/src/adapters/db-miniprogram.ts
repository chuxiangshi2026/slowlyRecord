import type { DbAdapter, DbDoc, DbReturn } from '../../../src/adapters/db'

const STORAGE_PREFIX = 'slowlyrecord_'
const CHUNK_SIZE = 900 * 1024

export class MiniProgramDbAdapter implements DbAdapter {
  private prefix: string

  constructor(prefix: string = STORAGE_PREFIX) {
    this.prefix = prefix
  }

  private getKey(id: string): string {
    return `${this.prefix}${id}`
  }

  private async saveWithChunks<T>(doc: DbDoc<T>): Promise<DbReturn> {
    const key = this.getKey(doc._id)
    const dataStr = JSON.stringify(doc)
    
    if (dataStr.length <= CHUNK_SIZE) {
      try {
        uni.setStorageSync(key, doc)
        return { _id: doc._id, _rev: doc._rev || '1', ok: true }
      } catch (e) {
        return { _id: doc._id, _rev: doc._rev || '1', ok: false, error: String(e) }
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
      return { _id: doc._id, _rev: chunkInfo._rev, ok: true }
    } catch (e) {
      return { _id: doc._id, _rev: doc._rev || '1', ok: false, error: String(e) }
    }
  }

  private async readWithChunks<T>(key: string): Promise<DbDoc<T> | null> {
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

  async get<T>(id: string): Promise<DbDoc<T> | null> {
    return this.readWithChunks<T>(this.getKey(id))
  }

  async getAsync<T>(id: string): Promise<DbDoc<T> | null> {
    return this.get<T>(id)
  }

  async put<T>(doc: DbDoc<T>): Promise<DbReturn> {
    return this.saveWithChunks(doc)
  }

  async remove<T>(doc: DbDoc<T>): Promise<DbReturn> {
    const key = this.getKey(doc._id)
    try {
      const existing = uni.getStorageSync(key)
      if (existing && existing._chunks && existing._chunkKeys) {
        for (const chunkKey of existing._chunkKeys) {
          uni.removeStorageSync(chunkKey)
        }
      }
      uni.removeStorageSync(key)
      return { _id: doc._id, _rev: doc._rev || '1', ok: true }
    } catch (e) {
      return { _id: doc._id, _rev: doc._rev || '1', ok: false, error: String(e) }
    }
  }

  async allDocs<T>(key?: string): Promise<{ items: DbDoc<T>[] }> {
    const items: DbDoc<T>[] = []
    try {
      const res = uni.getStorageInfoSync()
      const keys = res.keys || []
      
      for (const k of keys) {
        if (k.startsWith(this.prefix) && !k.includes('__chunk__')) {
          const doc = await this.readWithChunks<T>(k)
          if (doc && (!key || doc._id.startsWith(key))) {
            items.push(doc)
          }
        }
      }
    } catch (e) {
      console.error('获取所有文档失败:', e)
    }
    return { items }
  }

  async post<T>(doc: Omit<DbDoc<T>, '_id' | '_rev'> & { _id?: string }): Promise<DbReturn> {
    const id = doc._id || `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const newDoc: DbDoc<T> = {
      ...doc,
      _id: id,
      _rev: '1'
    } as DbDoc<T>
    return this.put(newDoc)
  }
}
