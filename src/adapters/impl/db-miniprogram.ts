/**
 * 小程序 Storage 数据库适配器
 * 用于微信小程序和抖音小程序环境
 * 
 * 基于 wx.setStorage / wx.getStorage（微信）或 tt.setStorage / tt.getStorage（抖音）实现
 * 小程序单条 Storage 上限 1MB，超过则自动分片
 * 
 * 存储结构：
 * - 每个文档以 _id 为 key 存储到 Storage
 * - 大文档（超过 MAX_CHUNK_SIZE）自动分片
 * - 分片 key 格式: `${_id}::__chunk__${index}`
 * - 元数据 key: `${_id}::__meta` 记录分片信息
 */
import type { DbAdapter, DbDoc, DbReturn } from '../db'

// 单条 Storage 上限（字节），留 10% 安全余量
const MAX_CHUNK_SIZE = 900 * 1024 // 900KB

/**
 * 获取小程序原生 API 对象
 * 支持微信小程序 (wx) 和抖音小程序 (tt)
 */
function getMiniProgramApi(): any {
  const g = (typeof window !== 'undefined' ? window : globalThis) as any
  return g.wx || g.tt
}

/**
 * 估算对象序列化后的大小
 */
function estimateSize(obj: any): number {
  return JSON.stringify(obj).length * 2 // UTF-16 编码
}

/**
 * 同步存储接口（小程序同步 API）
 */
interface MpStorageSync {
  setStorageSync(key: string, data: any): void
  getStorageSync(key: string): any
  removeStorageSync(key: string): void
  getStorageInfoSync(): { keys: string[]; currentSize: number; limitSize: number }
}

function getStorageSync(): MpStorageSync {
  const mp = getMiniProgramApi()
  return {
    setStorageSync: mp?.setStorageSync?.bind(mp) || ((key: string, data: any) => localStorage.setItem(key, JSON.stringify(data))),
    getStorageSync: mp?.getStorageSync?.bind(mp) || ((key: string) => { try { return JSON.parse(localStorage.getItem(key) || 'null') } catch { return null } }),
    removeStorageSync: mp?.removeStorageSync?.bind(mp) || ((key: string) => localStorage.removeItem(key)),
    getStorageInfoSync: mp?.getStorageInfoSync?.bind(mp) || (() => ({ keys: Object.keys(localStorage), currentSize: 0, limitSize: 10240 })),
  }
}

export class DbAdapterMiniprogram implements DbAdapter {
  private revCounter = 0

  private nextRev(): string {
    return `${Date.now()}-${++this.revCounter}`
  }

  private get storage(): MpStorageSync {
    return getStorageSync()
  }

  get<T extends {} = Record<string, any>>(id: string): DbDoc<T> | null {
    const metaKey = `${id}::__meta`
    const meta = this.storage.getStorageSync(metaKey)
    
    if (meta && meta.chunked) {
      // 分片文档：重组
      const chunks: string[] = []
      for (let i = 0; i < meta.totalChunks; i++) {
        const chunkKey = `${id}::__chunk__${i}`
        const chunk = this.storage.getStorageSync(chunkKey)
        if (chunk === null || chunk === undefined) return null
        chunks.push(chunk)
      }
      try {
        const fullJson = chunks.join('')
        return JSON.parse(fullJson) as DbDoc<T>
      } catch {
        return null
      }
    }
    
    // 普通文档
    return this.storage.getStorageSync(id) as DbDoc<T> | null || null
  }

  put(doc: DbDoc): DbReturn {
    const rev = this.nextRev()
    const updatedDoc = { ...doc, _rev: rev }
    this.saveDoc(updatedDoc)
    return { id: doc._id, ok: true, rev }
  }

  allDocs<T extends {} = Record<string, any>>(prefix?: string): DbDoc<T>[] {
    const info = this.storage.getStorageInfoSync()
    const docs: DbDoc<T>[] = []
    
    for (const key of info.keys) {
      // 跳过分片 key 和 meta key
      if (key.includes('__chunk__') || key.includes('__meta')) continue
      
      // 前缀过滤
      if (prefix && !key.startsWith(prefix)) continue
      
      const doc = this.get<T>(key)
      if (doc) {
        docs.push(doc)
      }
    }
    
    return docs
  }

  remove(doc: string | DbDoc): DbReturn {
    const id = typeof doc === 'string' ? doc : doc._id
    
    // 检查是否为分片文档
    const metaKey = `${id}::__meta`
    const meta = this.storage.getStorageSync(metaKey)
    
    // 检查文档是否存在（分片或普通）
    const existing = meta || this.storage.getStorageSync(id)
    if (!existing && !meta) {
      return { id, ok: false, error: true, message: 'doc not found' }
    }
    
    if (meta && meta.chunked) {
      // 删除所有分片
      for (let i = 0; i < meta.totalChunks; i++) {
        this.storage.removeStorageSync(`${id}::__chunk__${i}`)
      }
      this.storage.removeStorageSync(metaKey)
    }
    
    // 删除文档本身（普通文档直接存储在 id key 下）
    this.storage.removeStorageSync(id)
    return { id, ok: true, rev: this.nextRev() }
  }

  bulkDocs(docs: DbDoc[]): DbReturn[] {
    return docs.map(doc => {
      const rev = this.nextRev()
      const updatedDoc = { ...doc, _rev: rev }
      this.saveDoc(updatedDoc)
      return { id: doc._id, ok: true, rev }
    })
  }

  promises = {
    get: async <T extends {} = Record<string, any>>(id: string): Promise<DbDoc<T> | null> => {
      return this.get<T>(id)
    },

    put: async (doc: DbDoc): Promise<DbReturn> => {
      const rev = this.nextRev()
      const updatedDoc = { ...doc, _rev: rev }
      this.saveDoc(updatedDoc)
      return { id: doc._id, ok: true, rev }
    },

    remove: async (doc: string | DbDoc): Promise<DbReturn> => {
      return this.remove(doc)
    },

    bulkDocs: async (docs: DbDoc[]): Promise<DbReturn[]> => {
      return this.bulkDocs(docs)
    },
  }

  /**
   * 保存文档（自动处理分片）
   */
  private saveDoc(doc: DbDoc): void {
    const size = estimateSize(doc)

    // 清理旧分片残留：文档由大变小（如词库大量删除）时若不清理，
    // get 会发现旧 __meta 重组分片返回过期数据，而 allDocs 返回新文档——读写视图不一致
    this.cleanupExistingChunks(doc._id)

    if (size > MAX_CHUNK_SIZE) {
      // 需要分片
      const json = JSON.stringify(doc)
      const chunkSize = Math.ceil(json.length / Math.ceil(size / MAX_CHUNK_SIZE))
      const totalChunks = Math.ceil(json.length / chunkSize)

      // 保存分片
      for (let i = 0; i < totalChunks; i++) {
        const chunk = json.slice(i * chunkSize, (i + 1) * chunkSize)
        this.storage.setStorageSync(`${doc._id}::__chunk__${i}`, chunk)
      }

      // 保存元数据
      this.storage.setStorageSync(`${doc._id}::__meta`, {
        chunked: true,
        totalChunks,
        originalSize: size,
      })
    } else {
      // 普通存储
      this.storage.setStorageSync(doc._id, doc)
    }
  }

  /** 删除该文档 id 下的旧分片与 meta（若有），无分片时无副作用 */
  private cleanupExistingChunks(id: string): void {
    const metaKey = `${id}::__meta`
    const meta = this.storage.getStorageSync(metaKey)
    if (!meta || !meta.chunked) return
    for (let i = 0; i < (meta.totalChunks || 0); i++) {
      this.storage.removeStorageSync(`${id}::__chunk__${i}`)
    }
    this.storage.removeStorageSync(metaKey)
  }
}
