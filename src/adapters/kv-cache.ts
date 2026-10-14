/**
 * IndexedDB KV 缓存适配层
 *
 * 统一 ocr-lang-pack（语言包二进制）与 pic-translate（OCR worker 脚本）两处
 * 自建 IndexedDB 的 openDB/get/put 样板。适用于体积大、不适合 localStorage 的缓存；
 * 无 IndexedDB 的环境（小程序）返回 null/空操作，由调用方自行降级。
 *
 * 每次操作独立打开并关闭连接（缓存访问频次低，且保持连接会阻塞 deleteDatabase）。
 * get 失败（含环境不支持）一律 resolve null；put 失败仅告警不抛出——缓存语义，丢了可重建。
 */

export interface KvCacheStore {
  get<T = any>(key: string): Promise<T | null>
  put(key: string, value: any): Promise<void>
}

function openDb(dbName: string, storeName: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(dbName, 1)
    req.onerror = () => reject(req.error)
    req.onsuccess = () => resolve(req.result)
    req.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(storeName)) {
        db.createObjectStore(storeName)
      }
    }
  })
}

export function getKvCache(dbName: string, storeName: string): KvCacheStore {
  return {
    async get<T = any>(key: string): Promise<T | null> {
      let db: IDBDatabase | null = null
      try {
        if (typeof indexedDB === 'undefined') return null
        db = await openDb(dbName, storeName)
        return await new Promise((resolve, reject) => {
          const req = db!.transaction(storeName, 'readonly').objectStore(storeName).get(key)
          req.onsuccess = () => resolve(req.result ?? null)
          req.onerror = () => reject(req.error)
        })
      } catch {
        return null
      } finally {
        db?.close()
      }
    },
    async put(key: string, value: any): Promise<void> {
      let db: IDBDatabase | null = null
      try {
        if (typeof indexedDB === 'undefined') return
        db = await openDb(dbName, storeName)
        await new Promise((resolve, reject) => {
          const req = db!.transaction(storeName, 'readwrite').objectStore(storeName).put(value, key)
          req.onsuccess = () => resolve(undefined)
          req.onerror = () => reject(req.error)
        })
      } catch (e) {
        console.warn(`[kv-cache] ${dbName} 写入失败:`, e)
      } finally {
        db?.close()
      }
    },
  }
}
