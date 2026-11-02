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
  private openPromise: Promise<IDBDatabase> | null = null
  private revCounter = 0
  private writeQueue: Promise<void> = Promise.resolve()
  /** 每个文档最后一次写入调用的版本，删除也记录，防止旧事务回写新缓存 */
  private latestWriteRevisions = new Map<string, string>()

  private async getDB(): Promise<IDBDatabase> {
    if (this.db) return this.db
    if (!this.openPromise) {
      this.openPromise = openDB().then((db) => {
        this.db = db
        this.openPromise = null
        return db
      }).catch((error) => {
        this.openPromise = null
        throw error
      })
    }
    return this.openPromise
  }

  /** 等待所有已排队的写事务完成（测试或退出前使用） */
  whenIdle(): Promise<void> {
    return this.writeQueue
  }

  /** 串行化同一适配器上的写操作，避免旧写晚完成后覆盖新缓存 */
  private enqueueWrite<T>(operation: () => Promise<T>): Promise<T> {
    const task = this.writeQueue.then(operation, operation)
    this.writeQueue = task.then(() => undefined, () => undefined)
    return task
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
    const previous = this.syncCache.get(doc._id)
    this.latestWriteRevisions.set(doc._id, rev)
    this.syncCache.set(doc._id, updatedDoc)
    void this.enqueueWrite(() => this._writePut(updatedDoc)).catch((error) => {
      // 持久化失败时回滚缓存，避免 UI 继续读取并不存在的“新版本”
      if (this.syncCache.get(doc._id)?._rev === rev) {
        if (previous) this.syncCache.set(doc._id, previous)
        else this.syncCache.delete(doc._id)
      }
      console.error('[db-indexeddb] put 持久化失败:', error)
    })
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
      return new Promise((resolve, reject) => {
        // 补 onerror：IndexedDB 事务出错时若不拒绝，应用启动的 await 会永久挂起（白屏且零日志）
        request.onerror = () => {
          console.error('[db-indexeddb] preloadToCache 游标遍历失败:', request.error)
          reject(request.error)
        }
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
      return new Promise((resolve, reject) => {
        request.onerror = () => {
          console.error('[db-indexeddb] preloadToCache 读取失败:', request.error)
          reject(request.error)
        }
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
    const existing = this.syncCache.get(id)
    if (!existing) {
      return { id, ok: false, error: true, message: 'doc not found' }
    }

    const rev = this.nextRev()
    this.latestWriteRevisions.set(id, rev)
    this.syncCache.delete(id)
    void this.enqueueWrite(() => this._writeRemove(id)).catch((error) => {
      if (!this.syncCache.has(id)) {
        this.syncCache.set(id, existing)
      }
      console.error('[db-indexeddb] remove 持久化失败:', error)
    })

    return { id, ok: true, rev }
  }

  private async _writeRemove(id: string): Promise<void> {
    const db = await this.getDB()
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).delete(id)
    await promisifyTransaction(tx)
  }

  private async _writePut(doc: DbDoc): Promise<void> {
    const db = await this.getDB()
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put(doc)
    await promisifyTransaction(tx)
  }

  private async _writeBulkPut(docs: DbDoc[]): Promise<void> {
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
    const previous = new Map<string, DbDoc | null>()
    const results: DbReturn[] = updatedDocs.map(doc => {
      previous.set(doc._id, this.syncCache.get(doc._id) ?? null)
      this.latestWriteRevisions.set(doc._id, rev)
      this.syncCache.set(doc._id, doc)
      return { id: doc._id, ok: true, rev }
    })
    void this.enqueueWrite(() => this._writeBulkPut(updatedDocs)).catch((error) => {
      for (const doc of updatedDocs) {
        if (this.syncCache.get(doc._id)?._rev !== rev) continue
        const old = previous.get(doc._id)
        if (old) this.syncCache.set(doc._id, old)
        else this.syncCache.delete(doc._id)
      }
      console.error('[db-indexeddb] bulkDocs 持久化失败:', error)
    })
    return results
  }

  promises = {
    get: async <T extends {} = Record<string, any>>(id: string): Promise<DbDoc<T> | null> => {
      await this.writeQueue
      if (this.syncCache.has(id)) {
        return this.syncCache.get(id) as DbDoc<T> | null || null
      }
      const revision = this.latestWriteRevisions.get(id)
      const db = await this.getDB()
      const store = getStore(db)
      const result = await promisify(store.get(id)) as DbDoc<T> | null
      if (result && this.latestWriteRevisions.get(id) === revision) {
        this.syncCache.set(id, result)
      }
      return result
    },

    put: async (doc: DbDoc): Promise<DbReturn> => {
      const rev = this.nextRev()
      const updatedDoc = { ...doc, _rev: rev }
      this.latestWriteRevisions.set(doc._id, rev)
      await this.enqueueWrite(async () => {
        await this._writePut(updatedDoc)
        if (this.latestWriteRevisions.get(doc._id) === rev) {
          this.syncCache.set(doc._id, updatedDoc)
        }
      })
      return { id: doc._id, ok: true, rev }
    },

    remove: async (doc: string | DbDoc): Promise<DbReturn> => {
      const id = typeof doc === 'string' ? doc : doc._id
      const rev = this.nextRev()
      this.latestWriteRevisions.set(id, rev)
      await this.enqueueWrite(async () => {
        await this._writeRemove(id)
        if (this.latestWriteRevisions.get(id) === rev) this.syncCache.delete(id)
      })
      return { id, ok: true, rev }
    },

    bulkDocs: async (docs: DbDoc[]): Promise<DbReturn[]> => {
      if (docs.length === 0) return []
      const rev = this.nextRev()
      const updatedDocs = docs.map(doc => ({ ...doc, _rev: rev }))
      for (const doc of updatedDocs) this.latestWriteRevisions.set(doc._id, rev)
      await this.enqueueWrite(async () => {
        await this._writeBulkPut(updatedDocs)
        for (const doc of updatedDocs) {
          if (this.latestWriteRevisions.get(doc._id) === rev) {
            this.syncCache.set(doc._id, doc)
          }
        }
      })
      return updatedDocs.map(doc => ({ id: doc._id, ok: true, rev }))
    },
  }
}
