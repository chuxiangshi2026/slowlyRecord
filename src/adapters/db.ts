/**
 * 数据库适配器接口与自动注册
 * 
 * 对齐 utools.db 的 API 签名，支持多平台实现：
 * - uTools: 直接代理 utools.db
 * - Electron/Web: 基于 IndexedDB (idb)
 * - 小程序: 基于 wx.Storage
 */

// ==================== 类型定义（对齐 utools-api-types） ====================

/**
 * 数据库文档类型（与 utools DbDoc 对齐）
 */
export type DbDoc<T extends {} = Record<string, any>> = {
  _id: string
  _rev?: string
} & T

/**
 * 数据库操作返回类型（与 utools DbReturn 对齐）
 */
export interface DbReturn {
  id: string
  rev?: string
  ok?: boolean
  error?: boolean
  name?: string
  message?: string
}

// ==================== 适配器接口 ====================

/**
 * 数据库适配器接口
 * 
 * 同时覆盖 utools.db 的同步和异步 API：
 * - 同步方法：get / put / remove / allDocs / bulkDocs
 * - 异步方法：promises.get / promises.put / promises.remove / promises.bulkDocs
 */
export interface DbAdapter {
  /**
   * 获取单个文档
   * @param id 文档 ID
   * @returns 文档对象，不存在则返回 null
   */
  get<T extends {} = Record<string, any>>(id: string): DbDoc<T> | null

  /**
   * 同步创建/更新文档
   * @param doc 文档对象（必须包含 _id）
   * @returns 操作结果
   */
  put(doc: DbDoc): DbReturn

  /**
   * 获取前缀匹配的所有文档
   * @param prefix 文档 ID 前缀
   * @returns 匹配的文档数组
   */
  allDocs<T extends {} = Record<string, any>>(prefix?: string): DbDoc<T>[]

  /**
   * 删除文档
   * @param doc 文档 ID 或文档对象
   * @returns 操作结果
   */
  remove(doc: string | DbDoc): DbReturn

  /**
   * 批量创建/更新文档
   * @param docs 文档数组
   * @returns 操作结果数组
   */
  bulkDocs(docs: DbDoc[]): DbReturn[]

  /**
   * 异步 API（对应 utools.db.promises）
   */
  promises: {
    /**
     * 异步获取单个文档
     * @param id 文档 ID
     * @returns 文档对象，不存在则返回 null
     */
    get<T extends {} = Record<string, any>>(id: string): Promise<DbDoc<T> | null>

    /**
     * 创建/更新文档
     * @param doc 文档对象（必须包含 _id）
     * @returns 操作结果
     */
    put(doc: DbDoc): Promise<DbReturn>

    /**
     * 删除文档
     * @param doc 文档 ID 或文档对象
     * @returns 操作结果
     */
    remove(doc: string | DbDoc): Promise<DbReturn>

    /**
     * 批量创建/更新文档
     * @param docs 文档数组
     * @returns 操作结果数组
     */
    bulkDocs(docs: DbDoc[]): Promise<DbReturn[]>
  }
}

// ==================== dbStorage 适配器 ====================

/**
 * 键值存储适配器接口（对齐 utools.dbStorage）
 * 
 * 用于存储简单键值对，如版本号等元数据。
 * 底层在 Web/Electron 使用 localStorage，小程序使用 wx.Storage。
 */
export interface DbStorageAdapter {
  /**
   * 存储数据
   */
  setItem(key: string, value: any): void

  /**
   * 获取数据
   */
  getItem(key: string): any

  /**
   * 删除数据
   */
  removeItem(key: string): void
}

// ==================== 适配器注册 ====================

let _dbAdapter: DbAdapter | null = null
let _dbAdapterInitPromise: Promise<DbAdapter> | null = null

/**
 * 获取数据库适配器实例（异步）
 * 
 * 首次调用会根据平台自动选择实现并初始化。
 * 对于 IndexedDB 适配器，会自动执行 preloadToCache。
 * 
 * @returns 数据库适配器实例
 */
export async function getDbAdapterAsync(): Promise<DbAdapter> {
  if (_dbAdapter) return _dbAdapter
  if (_dbAdapterInitPromise) return _dbAdapterInitPromise

  _dbAdapterInitPromise = (async () => {
    const { getPlatform } = await import('./platform')
    const platform = getPlatform()

    let adapter: DbAdapter

    switch (platform) {
      case 'utools': {
        const { DbAdapterUtools } = await import('./impl/db-utools')
        adapter = new DbAdapterUtools()
        break
      }
      case 'mp-weixin': {
        const { DbAdapterMiniprogram } = await import('./impl/db-miniprogram')
        adapter = new DbAdapterMiniprogram()
        break
      }
      default: {
        // electron / web / app-android / app-ios 都用 IndexedDB
        const { DbAdapterIndexedDB } = await import('./impl/db-indexeddb')
        adapter = new DbAdapterIndexedDB()
        // IndexedDB 适配器需要预加载缓存以支持同步 get/allDocs
        await (adapter as any).preloadToCache()
        break
      }
    }

    _dbAdapter = adapter
    _dbAdapterInitPromise = null
    return adapter
  })()

  return _dbAdapterInitPromise
}

/**
 * 获取数据库适配器实例（同步）
 * 
 * 注意：必须先调用过 getDbAdapterAsync() 完成初始化，
 * 或通过 setDbAdapter() 手动注入。
 * 
 * 在 uTools 环境下可以直接使用，因为应用启动时会自动初始化。
 * 在其他环境下，需要先调用 getDbAdapterAsync()。
 */
export function getDbAdapter(): DbAdapter {
  if (_dbAdapter) return _dbAdapter

  // 尝试 uTools 环境直接创建
  if (typeof window !== 'undefined') {
    const utools = (window as any).utools
    if (utools && utools.getPath && utools.db) {
      // 动态导入可能已被 Vite 打包为同步模块
      // 但在严格 ESM 环境中无法使用 require，走异步路径
      throw new Error(
        'DbAdapter not initialized. Call await getDbAdapterAsync() first.'
      )
    }
  }

  throw new Error(
    'DbAdapter not initialized. Call await getDbAdapterAsync() first.'
  )
}

/**
 * 设置数据库适配器（用于测试或手动注入）
 */
export function setDbAdapter(adapter: DbAdapter): void {
  _dbAdapter = adapter
}

/**
 * 重置适配器缓存（用于测试）
 */
export function resetDbAdapter(): void {
  _dbAdapter = null
  _dbAdapterInitPromise = null
}

// ==================== dbStorage 便捷方法 ====================

let _dbStorage: DbStorageAdapter | null = null

/**
 * 获取键值存储适配器
 * 
 * 优先使用 utools.dbStorage，否则降级为 localStorage。
 * 小程序环境使用 wx.Storage。
 */
export function getDbStorage(): DbStorageAdapter {
  if (_dbStorage) return _dbStorage

  // uTools 环境
  if (typeof window !== 'undefined') {
    const utools = (window as any).utools
    if (utools && utools.dbStorage) {
      _dbStorage = utools.dbStorage as DbStorageAdapter
      return _dbStorage
    }
  }

  // 微信小程序环境
  const wxGlobal = typeof window !== 'undefined' ? (window as any).wx : undefined
  if (wxGlobal && wxGlobal.setStorageSync) {
    _dbStorage = {
      setItem: (key: string, value: any) => wxGlobal.setStorageSync(key, value),
      getItem: (key: string) => wxGlobal.getStorageSync(key) || null,
      removeItem: (key: string) => wxGlobal.removeStorageSync(key),
    }
    return _dbStorage
  }

  // Web/Electron 降级为 localStorage
  if (typeof localStorage !== 'undefined') {
    _dbStorage = {
      setItem: (key: string, value: any) => {
        try {
          localStorage.setItem(key, JSON.stringify(value))
        } catch { /* quota exceeded */ }
      },
      getItem: (key: string) => {
        try {
          const raw = localStorage.getItem(key)
          return raw !== null ? JSON.parse(raw) : null
        } catch { return null }
      },
      removeItem: (key: string) => localStorage.removeItem(key),
    }
    return _dbStorage
  }

  throw new Error('No storage adapter available')
}

/**
 * 设置 dbStorage 适配器（用于测试）
 */
export function setDbStorage(adapter: DbStorageAdapter): void {
  _dbStorage = adapter
}
