/**
 * 移动端数据库适配器接口与注册
 * 
 * 独立于主项目 src/adapters/db.ts，避免引入桌面端代码（platform.ts、IndexedDB 等）
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

// ==================== 适配器注册 ====================

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
