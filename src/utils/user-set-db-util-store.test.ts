/**
 * 商店版（uTools + __STORE_BUILD__）user-set 密钥加密行为：
 * 写入同步库前 keys/ocrKeys 加密为 enc:v1: 密文；读取侧 decryptSyncedSecrets 还原；
 * 旧版明文文档读取时自动迁移为密文；非商店版保持明文原样。
 */
import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetDbAdapter, setDbAdapter, type DbAdapter } from '@/adapters/db'
import { _setStoreLocalOnlyForTest, initLocalBulkStore } from '@/adapters/local-bulk-store'
import { isEncryptedSecret } from '@/utils/secret-crypto'

vi.mock('@/utils/logger', () => ({
  log: { i: vi.fn(), d: vi.fn(), e: vi.fn(), w: vi.fn() },
}))

import { addAndUpdateSetDb, decryptSyncedSecrets, getSetDb } from './user-set-db-util'

const createMockDb = (): { db: DbAdapter; storage: Map<string, any> } => {
  const storage = new Map<string, any>()
  const db: DbAdapter = {
    get: vi.fn((id: string) => storage.get(id) || null),
    put: vi.fn((doc: any) => {
      storage.set(doc._id, { ...doc, _rev: '1-rev' })
      return { ok: true, id: doc._id, rev: '1-rev' }
    }),
    remove: vi.fn((id: string) => {
      storage.delete(id)
      return { ok: true, id }
    }),
    allDocs: vi.fn((prefix?: string) => {
      const docs: any[] = []
      storage.forEach((doc, id) => {
        if (!prefix || id.startsWith(prefix)) docs.push(doc)
      })
      return docs
    }),
    bulkDocs: vi.fn(),
    promises: {
      get: vi.fn(async (id: string) => storage.get(id) || null),
      put: vi.fn(async (doc: any) => {
        storage.set(doc._id, { ...doc, _rev: '1-rev' })
        return { ok: true, id: doc._id, rev: '1-rev' }
      }),
      remove: vi.fn(async (id: string) => {
        storage.delete(id)
        return { ok: true, id }
      }),
      bulkDocs: vi.fn(),
    },
  }
  return { db, storage }
}

const flushAsync = () => new Promise((resolve) => setTimeout(resolve, 0))

let storage: Map<string, any>

beforeEach(async () => {
  const mock = createMockDb()
  storage = mock.storage
  setDbAdapter(mock.db)
  _setStoreLocalOnlyForTest(true)
  await initLocalBulkStore()
})

afterEach(() => {
  resetDbAdapter()
  _setStoreLocalOnlyForTest(null)
})

describe('user-set 密钥加密（商店版）', () => {
  it('写入同步库的文档 keys/ocrKeys 为密文，调用方对象保持明文', async () => {
    const userSet: any = {
      _id: 'user-set',
      keys: { glm: { appkey: 'glm-app', key: 'glm-secret' } },
      ocrKeys: { baidu: { appkey: 'bd-app', key: 'bd-secret' } },
    }
    const result = await addAndUpdateSetDb(userSet)
    expect(result.ok).toBe(true)

    const doc = storage.get('user-set')
    expect(isEncryptedSecret(doc.keys.glm.appkey)).toBe(true)
    expect(isEncryptedSecret(doc.keys.glm.key)).toBe(true)
    expect(isEncryptedSecret(doc.ocrKeys.baidu.key)).toBe(true)
    expect(JSON.stringify(doc)).not.toContain('glm-secret')
    expect(JSON.stringify(doc)).not.toContain('bd-secret')
    // 调用方内存中的对象不被改写
    expect(userSet.keys.glm.key).toBe('glm-secret')
  })

  it('decryptSyncedSecrets 把密文文档还原为明文副本', async () => {
    const userSet: any = {
      _id: 'user-set',
      keys: { glm: { appkey: 'glm-app', key: 'glm-secret' } },
      ocrKeys: {},
    }
    await addAndUpdateSetDb(userSet)

    const stored = getSetDb(true)!
    expect(isEncryptedSecret(stored.keys.glm.key)).toBe(true)
    const decrypted = (await decryptSyncedSecrets(stored))!
    expect(decrypted.keys.glm).toEqual({ appkey: 'glm-app', key: 'glm-secret' })
    // 库内文档仍是密文
    expect(isEncryptedSecret(getSetDb(true)!.keys.glm.key)).toBe(true)
  })

  it('读到旧版明文文档时自动迁移为密文', async () => {
    storage.set('user-set', {
      _id: 'user-set',
      keys: { youdao: { appkey: 'yd-app', key: 'yd-secret' } },
      ocrKeys: {},
    })

    const doc = getSetDb(true)!
    // 读取当时仍返回明文（迁移是后台异步进行的）
    expect(doc.keys.youdao.key).toBe('yd-secret')

    await vi.waitFor(() => expect(isEncryptedSecret(storage.get('user-set').keys.youdao.key)).toBe(true))
    const migrated = storage.get('user-set')
    const decrypted = (await decryptSyncedSecrets(migrated))!
    expect(decrypted.keys.youdao.key).toBe('yd-secret')
  })

  it('已是密文的文档不重复迁移', async () => {
    const userSet: any = { _id: 'user-set', keys: { glm: { appkey: '', key: 'glm-secret' } }, ocrKeys: {} }
    await addAndUpdateSetDb(userSet)
    const before = storage.get('user-set')
    getSetDb(true)
    await flushAsync()
    // 没有触发额外写回（文档引用未变）
    expect(storage.get('user-set')).toBe(before)
  })

  it('非商店版写入同样加密，不因平台门控回落明文', async () => {
    _setStoreLocalOnlyForTest(false)
    const userSet: any = { _id: 'user-set', keys: { glm: { appkey: '', key: 'plain-key' } }, ocrKeys: {} }
    await addAndUpdateSetDb(userSet)
    expect(isEncryptedSecret(storage.get('user-set').keys.glm.key)).toBe(true)
    expect(JSON.stringify(storage.get('user-set'))).not.toContain('plain-key')
  })

  it('非商店版读取旧明文文档时同样后台迁移为密文', async () => {
    _setStoreLocalOnlyForTest(false)
    storage.set('user-set', {
      _id: 'user-set',
      keys: { glm: { appkey: 'legacy-app', key: 'legacy-key' } },
      ocrKeys: {},
    })

    getSetDb(true)
    await vi.waitFor(() => expect(isEncryptedSecret(storage.get('user-set').keys.glm.key)).toBe(true))
    const decrypted = (await decryptSyncedSecrets(storage.get('user-set')))!
    expect(decrypted.keys.glm.key).toBe('legacy-key')
  })
})
