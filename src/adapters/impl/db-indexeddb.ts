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

  /**
   * 跨标签页/跨窗口写入广播（Web 多标签、Electron 多窗口各自持有适配器实例）。
   * 本实例写入后通知其它实例回读刷新对应文档，避免「后写者用旧快照整份覆盖先写者」。
   */
  private channel: BroadcastChannel | null = null
  private channelUnavailable = false

  constructor() {
    // 提前建立广播通道：纯读取的标签页自己不写入，也要能收到其它实例的缓存失效通知
    this.getChannel()
  }

  /** 关闭广播通道（测试 / HMR 场景的资源清理） */
  closeChannel(): void {
    try {
      this.channel?.close()
    } catch {
      // ignore
    }
    this.channel = null
  }

  private getChannel(): BroadcastChannel | null {
    if (this.channel || this.channelUnavailable) return this.channel
    try {
      if (typeof BroadcastChannel === 'undefined') throw new Error('BroadcastChannel unavailable')
      this.channel = new BroadcastChannel('slowlyrecord-db-sync')
      this.channel.onmessage = (event: MessageEvent) => {
        void this.applyRemoteChange(event.data)
      }
    } catch {
      this.channelUnavailable = true
    }
    return this.channel
  }

  private broadcastChanges(ids: string[]): void {
    if (ids.length === 0) return
    try {
      this.getChannel()?.postMessage({ ids })
    } catch {
      // 广播失败不影响本次写入
    }
  }

  /**
   * 收到其它实例的写入通知后的缓存自愈：
   * 仅处理本实例已缓存的文档（保留 preloadToCache(prefix) 的隔离性），
   * 且期间无本地新写入（缓存对象引用未变）时才用库内最新值刷新，
   * 防止旧值覆盖本地并发写入。
   */
  private async applyRemoteChange(data: unknown): Promise<void> {
    const ids = (data as { ids?: string[] } | null)?.ids
    if (!Array.isArray(ids)) return
    for (const id of ids) {
      if (typeof id !== 'string' || !this.syncCache.has(id)) continue
      const cachedBefore = this.syncCache.get(id)
      try {
        const db = await this.getDB()
        const result = await promisify(getStore(db).get(id)) as DbDoc | null
        if (this.syncCache.get(id) !== cachedBefore) continue
        if (result) this.syncCache.set(id, result)
        else this.syncCache.delete(id)
      } catch {
        // 回读失败保留现状，下次读取自愈
      }
    }
  }

  /**
   * 与 utools.db 对齐的乐观锁：显式携带过期 _rev 的写入返回 conflict，
   * 让调用方「重读最新文档合并后重试」的兜底路径在 Web/Electron 下真正生效
   * （wordbank-manager / user-set-db-util / sync-tombstone 均依赖该语义）。
   */
  private checkConflict(doc: DbDoc): DbReturn | null {
    if (doc._rev === undefined) return null
    const existing = this.syncCache.get(doc._id)
    if (existing && doc._rev !== existing._rev) {
      return { id: doc._id, ok: false, error: true, name: 'conflict', message: 'Document update conflict.' }
    }
    return null
  }

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
    const conflict = this.checkConflict(doc)
    if (conflict) return conflict
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
    this.broadcastChanges([doc._id])
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
    this.broadcastChanges([id])

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
    // 逐文档冲突检测：携带过期 _rev 的文档返回 conflict 且不参与本批写入
    const accepted: DbDoc[] = []
    const results: DbReturn[] = docs.map(doc => {
      const conflict = this.checkConflict(doc)
      if (conflict) return conflict
      accepted.push(doc)
      return { id: doc._id, ok: true, rev }
    })
    if (accepted.length === 0) return results
    const updatedDocs = accepted.map(doc => ({ ...doc, _rev: rev }))
    const previous = new Map<string, DbDoc | null>()
    for (const doc of updatedDocs) {
      previous.set(doc._id, this.syncCache.get(doc._id) ?? null)
      this.latestWriteRevisions.set(doc._id, rev)
      this.syncCache.set(doc._id, doc)
    }
    void this.enqueueWrite(() => this._writeBulkPut(updatedDocs)).catch((error) => {
      for (const doc of updatedDocs) {
        if (this.syncCache.get(doc._id)?._rev !== rev) continue
        const old = previous.get(doc._id)
        if (old) this.syncCache.set(doc._id, old)
        else this.syncCache.delete(doc._id)
      }
      console.error('[db-indexeddb] bulkDocs 持久化失败:', error)
    })
    this.broadcastChanges(updatedDocs.map(doc => doc._id))
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
      const conflict = this.checkConflict(doc)
      if (conflict) return conflict
      const rev = this.nextRev()
      const updatedDoc = { ...doc, _rev: rev }
      this.latestWriteRevisions.set(doc._id, rev)
      await this.enqueueWrite(async () => {
        await this._writePut(updatedDoc)
        if (this.latestWriteRevisions.get(doc._id) === rev) {
          this.syncCache.set(doc._id, updatedDoc)
        }
      })
      this.broadcastChanges([doc._id])
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
      this.broadcastChanges([id])
      return { id, ok: true, rev }
    },

    bulkDocs: async (docs: DbDoc[]): Promise<DbReturn[]> => {
      if (docs.length === 0) return []
      const rev = this.nextRev()
      // 逐文档冲突检测：携带过期 _rev 的文档返回 conflict 且不参与本批写入
      const accepted: DbDoc[] = []
      const results: DbReturn[] = docs.map(doc => {
        const conflict = this.checkConflict(doc)
        if (conflict) return conflict
        accepted.push(doc)
        return { id: doc._id, ok: true, rev }
      })
      if (accepted.length === 0) return results
      const updatedDocs = accepted.map(doc => ({ ...doc, _rev: rev }))
      for (const doc of updatedDocs) this.latestWriteRevisions.set(doc._id, rev)
      await this.enqueueWrite(async () => {
        await this._writeBulkPut(updatedDocs)
        for (const doc of updatedDocs) {
          if (this.latestWriteRevisions.get(doc._id) === rev) {
            this.syncCache.set(doc._id, doc)
          }
        }
      })
      this.broadcastChanges(updatedDocs.map(doc => doc._id))
      return results
    },
  }
}
