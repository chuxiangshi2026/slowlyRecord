/**
 * IndexedDB 数据库适配器
 * 用于 Electron / Web 环境
 * 
 * 数据结构对齐 utools.db 的 _id / _rev 模式：
 * - 主键使用 _id
 * - _rev 用于版本控制（自增数字）
 * - allDocs 支持前缀查询
 */
import type { DbAdapter, DbDoc, DbReturn } from '../db'

const DB_NAME = 'slowly-record-db'
const STORE_NAME = 'documents'
const DB_VERSION = 1

/**
 * 打开/创建 IndexedDB 数据库
 */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: '_id' })
        // 创建前缀索引用于 allDocs 查询
        store.createIndex('_id', '_id', { unique: true })
      }
    }
    
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

/**
 * 获取读写事务的 object store
 */
function getStore(db: IDBDatabase, mode: IDBTransactionMode = 'readonly'): IDBObjectStore {
  const tx = db.transaction(STORE_NAME, mode)
  return tx.objectStore(STORE_NAME)
}

/**
 * 将 IDBRequest 包装为 Promise
 */
function promisify<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function promisifyTransaction(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
}

export class DbAdapterIndexedDB implements DbAdapter {
  private db: IDBDatabase | null = null
  private revCounter = 0

  private async getDB(): Promise<IDBDatabase> {
    if (!this.db) {
      this.db = await openDB()
    }
    return this.db
  }

  private nextRev(): string {
    return `${Date.now()}-${++this.revCounter}`
  }

  get<T extends {} = Record<string, any>>(id: string): DbDoc<T> | null {
    if (this.syncCache.has(id)) {
      return this.syncCache.get(id) as DbDoc<T> | null || null
    }
    return null
  }

  put(doc: DbDoc): DbReturn {
    const rev = this.nextRev()
    const updatedDoc = { ...doc, _rev: rev }
    this.syncCache.set(doc._id, updatedDoc)
    this._asyncPut(updatedDoc).catch(console.error)
    return { id: doc._id, ok: true, rev }
  }

  // 同步缓存，用于支持 get() 的同步调用
  private syncCache: Map<string, DbDoc | null> = new Map()

  /**
   * 将文档加载到同步缓存中
   * 需要在应用启动时调用
   */
  async preloadToCache(prefix?: string): Promise<void> {
    const db = await this.getDB()
    const store = getStore(db)
    
    if (prefix) {
      // 使用游标遍历，过滤前缀
      const request = store.openCursor()
      return new Promise((resolve) => {
        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest).result
          if (cursor) {
            const doc = cursor.value as DbDoc
            if (doc._id.startsWith(prefix)) {
              this.syncCache.set(doc._id, doc)
            }
            cursor.continue()
          } else {
            resolve()
          }
        }
      })
    } else {
      const request = store.getAll()
      return new Promise((resolve) => {
        request.onsuccess = () => {
          const docs = request.result as DbDoc[]
          docs.forEach(doc => this.syncCache.set(doc._id, doc))
          resolve()
        }
      })
    }
  }

  allDocs<T extends {} = Record<string, any>>(prefix?: string): DbDoc<T>[] {
    const docs: DbDoc<T>[] = []
    for (const [, doc] of this.syncCache) {
      if (doc && (!prefix || doc._id.startsWith(prefix))) {
        docs.push(doc as DbDoc<T>)
      }
    }
    return docs
  }

  remove(doc: string | DbDoc): DbReturn {
    const id = typeof doc === 'string' ? doc : doc._id
    // 同步删除：从缓存中移除，后台异步持久化
    const existing = this.syncCache.get(id)
    if (!existing) {
      return { id, ok: false, error: true, message: 'doc not found' }
    }
    
    this.syncCache.delete(id)
    this._asyncRemove(id).catch(console.error)
    
    return { id, ok: true, rev: this.nextRev() }
  }

  private async _asyncRemove(id: string): Promise<void> {
    const db = await this.getDB()
    const store = getStore(db, 'readwrite')
    await promisify(store.delete(id))
  }

  private async _asyncPut(doc: DbDoc): Promise<void> {
    const db = await this.getDB()
    const store = getStore(db, 'readwrite')
    await promisify(store.put(doc))
  }

  private async _asyncBulkPut(docs: DbDoc[]): Promise<void> {
    if (docs.length === 0) return
    const db = await this.getDB()
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    docs.forEach(doc => store.put(doc))
    await promisifyTransaction(tx)
  }

  bulkDocs(docs: DbDoc[]): DbReturn[] {
    const rev = this.nextRev()
    const updatedDocs = docs.map(doc => ({ ...doc, _rev: rev }))
    const results: DbReturn[] = updatedDocs.map(doc => {
      this.syncCache.set(doc._id, doc)
      return { id: doc._id, ok: true, rev }
    })
    this._asyncBulkPut(updatedDocs).catch(console.error)
    return results
  }

  promises = {
    get: async <T extends {} = Record<string, any>>(id: string): Promise<DbDoc<T> | null> => {
      // 先查缓存
      if (this.syncCache.has(id)) {
        return this.syncCache.get(id) as DbDoc<T> | null || null
      }
      // 再查 IndexedDB
      const db = await this.getDB()
      const store = getStore(db)
      const result = await promisify(store.get(id)) as DbDoc<T> | null
      if (result) {
        this.syncCache.set(id, result)
      }
      return result
    },

    put: async (doc: DbDoc): Promise<DbReturn> => {
      const rev = this.nextRev()
      const updatedDoc = { ...doc, _rev: rev }
      
      const db = await this.getDB()
      const store = getStore(db, 'readwrite')
      await promisify(store.put(updatedDoc))
      
      // 更新同步缓存
      this.syncCache.set(doc._id, updatedDoc)
      
      return { id: doc._id, ok: true, rev }
    },

    remove: async (doc: string | DbDoc): Promise<DbReturn> => {
      const id = typeof doc === 'string' ? doc : doc._id
      
      const db = await this.getDB()
      const store = getStore(db, 'readwrite')
      await promisify(store.delete(id))
      
      this.syncCache.delete(id)
      
      return { id, ok: true, rev: this.nextRev() }
    },

    bulkDocs: async (docs: DbDoc[]): Promise<DbReturn[]> => {
      if (docs.length === 0) return []
      const rev = this.nextRev()
      const updatedDocs = docs.map(doc => ({ ...doc, _rev: rev }))
      const db = await this.getDB()
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)

      updatedDocs.forEach(doc => store.put(doc))
      await promisifyTransaction(tx)

      const results: DbReturn[] = updatedDocs.map(doc => {
        this.syncCache.set(doc._id, doc)
        return { id: doc._id, ok: true, rev }
      })

      return results
    },
  }
}
