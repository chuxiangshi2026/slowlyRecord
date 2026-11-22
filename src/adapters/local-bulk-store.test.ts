import 'fake-indexeddb/auto'
import {afterEach, describe, expect, it} from 'vitest'
import {
  _setStoreLocalOnlyForTest,
  initLocalBulkStore,
  isStoreLocalOnly,
  localBulkGet,
  localBulkHas,
  localBulkRemove,
  localBulkSet,
} from './local-bulk-store'

describe('local-bulk-store', () => {
  afterEach(() => {
    _setStoreLocalOnlyForTest(null)
  })

  it('测试环境默认不启用（__STORE_BUILD__ 恒为 false），可用测试开关覆盖', () => {
    expect(isStoreLocalOnly()).toBe(false)
    _setStoreLocalOnlyForTest(true)
    expect(isStoreLocalOnly()).toBe(true)
  })

  it('set/get/remove 走内存镜像并落 IndexedDB', async () => {
    await initLocalBulkStore()
    expect(localBulkGet('k1')).toBeNull()
    expect(await localBulkSet('k1', {a: 1})).toBe(true)
    expect(localBulkGet('k1')).toEqual({a: 1})
    expect(localBulkHas('k1')).toBe(true)
    await localBulkRemove('k1')
    expect(localBulkGet('k1')).toBeNull()
    expect(localBulkHas('k1')).toBe(false)
  })

  it('写入持久化到 IndexedDB（不经内存镜像也能读到）', async () => {
    await initLocalBulkStore()
    await localBulkSet('persist-key', 'v')
    const raw = await new Promise<any>((resolve, reject) => {
      const req = indexedDB.open('slowlyrecord-local-bulk', 1)
      req.onerror = () => reject(req.error)
      req.onsuccess = () => {
        const db = req.result
        const getReq = db.transaction('kv', 'readonly').objectStore('kv').get('persist-key')
        getReq.onsuccess = () => resolve(getReq.result)
        getReq.onerror = () => reject(getReq.error)
      }
    })
    expect(raw).toBe('v')
    await localBulkRemove('persist-key')
  })
})
