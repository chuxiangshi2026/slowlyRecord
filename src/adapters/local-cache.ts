/**
 * 可再生缓存的本地存储适配层
 *
 * uTools 审核合规要求：OCR 语言包、翻译缓存等可重新生成、增长较快的缓存
 * 不得占用随账号同步的 utools.dbStorage，需写到插件本地数据目录。
 *
 * - uTools：经 preload 暴露的受限文件接口，存 userData/slowlyrecord-cache/ 下的文件
 * - 其他平台：沿用 dbStorage（web/electron 为 localStorage，小程序为 wx.Storage，本即本地存储）
 */
import { getDbStorage, type DbStorageAdapter } from './db'

let _cacheStorage: DbStorageAdapter | null = null

/** 缓存键转文件名（preload 仅接受字母数字与 . _ -） */
function toFileName(key: string): string {
    return key.replace(/[^A-Za-z0-9._-]/g, '_')
}

/**
 * 获取缓存存储适配器
 */
export function getCacheStorage(): DbStorageAdapter {
    if (_cacheStorage) return _cacheStorage

    const services = typeof window !== 'undefined' ? (window as any).services : undefined
    if (services && typeof services.readCacheFile === 'function') {
        _cacheStorage = {
            setItem: (key: string, value: any) => {
                services.writeCacheFile(toFileName(key), JSON.stringify(value))
            },
            getItem: (key: string) => {
                try {
                    const raw = services.readCacheFile(toFileName(key))
                    return raw === null || raw === undefined ? null : JSON.parse(raw)
                } catch {
                    return null
                }
            },
            removeItem: (key: string) => services.removeCacheFile(toFileName(key)),
        }
        return _cacheStorage
    }

    _cacheStorage = getDbStorage()
    return _cacheStorage
}

/**
 * 把同步库中的旧缓存键迁移到本地缓存存储并从同步库删除（一次性）。
 * 非 uTools 平台缓存存储与 dbStorage 同源，自动跳过。
 */
export function migrateCacheKeys(keys: string[]): void {
    const cache = getCacheStorage()
    const legacy = getDbStorage()
    if (cache === legacy) return
    for (const key of keys) {
        try {
            const value = legacy.getItem(key)
            if (value !== null && value !== undefined) {
                cache.setItem(key, value)
                legacy.removeItem(key)
            }
        } catch { /* 单个键失败不影响其他键 */ }
    }
}

/** 测试用：重置缓存适配器 */
export function resetCacheStorage(): void {
    _cacheStorage = null
}
