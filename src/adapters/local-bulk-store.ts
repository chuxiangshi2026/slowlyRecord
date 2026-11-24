/**
 * 本机大体积存储（仅 uTools 商店版启用）
 *
 * uTools 的 db/documents 会随账号同步。记忆宫殿桩图（二进制图片）与
 * 用户导入的外置词典（可由源文件再生）不适合进入同步库，商店版改存
 * 本地 IndexedDB（不随账号同步），同步库只保留引用/标记。
 *
 * 读取为同步接口：init 时把全部键值载入内存 Map，之后 get 走内存；
 * 写入先更新内存再落 IndexedDB。仅在 isStoreLocalOnly() 为真时使用，
 * 其他端（含 Web/Electron，IndexedDB 适配器本就不参与账号同步）维持原路径。
 */

const DB_NAME = 'slowlyrecord-local-bulk'
const STORE_NAME = 'kv'

/** 测试用开关：vitest 中 __STORE_BUILD__ 恒为 false，用此开关覆盖启用状态 */
let forceForTest: boolean | null = null

/** 是否启用本机大体积存储（仅 uTools 商店版） */
export function isStoreLocalOnly(): boolean {
  if (forceForTest !== null) return forceForTest
  return __PLATFORM__ === 'utools' && __STORE_BUILD__
}

export function _setStoreLocalOnlyForTest(value: boolean | null): void {
  forceForTest = value
}

const memory = new Map<string, any>()
let dbPromise: Promise<IDBDatabase | null> | null = null

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(null)
      const req = indexedDB.open(DB_NAME, 1)
      req.onerror = () => resolve(null)
      req.onsuccess = () => resolve(req.result)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME)
      }
    } catch {
      resolve(null)
    }
  })
  return dbPromise
}

/**
 * 启动时调用一次：建立连接并把全部键值载入内存。
 * 失败（如无 IndexedDB 环境）不抛错，后续 get 一律返回 null（按无数据处理）。
 */
export async function initLocalBulkStore(): Promise<void> {
  const db = await openDb()
  if (!db) return
  try {
    // getAll 与 getAllKeys 同一事务内顺序一致（均按主键升序），合并为键值对；
    // 两个请求必须在同一微任务内发出，否则事务自动提交后无法再加请求
    const store = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME)
    const valuesP = new Promise<any[]>((resolve, reject) => {
      const req = store.getAll()
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
    const keysP = new Promise<IDBValidKey[]>((resolve, reject) => {
      const req = store.getAllKeys()
      req.onsuccess = () => resolve(req.result as IDBValidKey[])
      req.onerror = () => reject(req.error)
    })
    const [values, keys] = await Promise.all([valuesP, keysP])
    keys.forEach((k, i) => memory.set(String(k), values[i]))
  } catch (e) {
    console.warn('[local-bulk-store] 载入失败:', e)
  }
}

/** 同步读取（内存镜像；init 前调用返回 null） */
export function localBulkGet<T = any>(key: string): T | null {
  return memory.has(key) ? (memory.get(key) as T) : null
}

export function localBulkHas(key: string): boolean {
  return memory.has(key)
}

/** 全量键值快照（本地备份导出用；内存镜像的浅拷贝，键序按插入序） */
export function localBulkEntries(): [string, any][] {
  return Array.from(memory.entries())
}

/** 写入：先更新内存（同步可读），再异步落 IndexedDB */
export async function localBulkSet(key: string, value: any): Promise<boolean> {
  memory.set(key, value)
  const db = await openDb()
  if (!db) return false
  try {
    await new Promise<void>((resolve, reject) => {
      const req = db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).put(value, key)
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })
    return true
  } catch (e) {
    console.warn('[local-bulk-store] 写入失败:', e)
    return false
  }
}

export async function localBulkRemove(key: string): Promise<void> {
  memory.delete(key)
  const db = await openDb()
  if (!db) return
  try {
    await new Promise<void>((resolve, reject) => {
      const req = db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).delete(key)
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })
  } catch (e) {
    console.warn('[local-bulk-store] 删除失败:', e)
  }
}
