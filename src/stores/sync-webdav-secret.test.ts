// @vitest-environment jsdom
/**
 * 同步 Store 的 WebDAV 密码静态加密单元测试
 *
 * 覆盖：Electron safeStorage 加密落盘、非 Electron 明文兼容、加密失败回退、
 * 启动恢复（密文解密/解密不可用/解密抛错）与旧明文自动迁移。
 * 存储用 setDbStorage 注入内存实现，平台判定与日志按模块边界替换。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { setDbStorage, type DbStorageAdapter } from '@/adapters/db'

const env = vi.hoisted(() => ({ electron: false }))
const logger = vi.hoisted(() => ({
  log: { d: vi.fn(), i: vi.fn(), w: vi.fn(), e: vi.fn() },
}))

vi.mock('@/adapters/platform', () => ({
  isElectron: () => env.electron,
}))

vi.mock('@/utils/logger', () => logger)

vi.mock('@/utils/sync-file', () => ({
  downloadSyncFile: vi.fn(),
  pickAndImportSyncFile: vi.fn(),
  importFromFile: vi.fn(),
  getSyncDataSummary: vi.fn(() => ({})),
}))

vi.mock('@/utils/sync-server', () => ({
  uploadToServer: vi.fn(),
  uploadToServerMobileCompat: vi.fn(),
  downloadFromServer: vi.fn(),
  checkServerAvailable: vi.fn(),
  setSyncServerUrl: vi.fn(),
  resetSyncServer: vi.fn(),
}))

vi.mock('@/utils/sync-manager', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils/sync-manager')>()
  return { ...actual, restoreSyncData: vi.fn() }
})

vi.mock('@/utils/sync-webdav', () => ({
  NUTSTORE_WEBDAV_URL: 'https://dav.jianguoyun.com/dav/我的坚果云/',
  normalizeWebDavUrl: (raw: string) => {
    const s = String(raw || '').trim()
    if (!s) return 'https://dav.jianguoyun.com/dav/我的坚果云/'
    return s.endsWith('/') ? s : `${s}/`
  },
  checkDirWritable: vi.fn(),
  diagnoseWebDav: vi.fn(),
  testWebDavConnection: vi.fn(),
  uploadToWebDav: vi.fn(),
  downloadFromWebDav: vi.fn(),
}))

vi.mock('@/utils/sync-dirty', () => ({
  markSynced: vi.fn(),
}))

import { useSyncStore } from './sync'

const LS_PASSWORD = 'sync_webdav_password'
const LS_URL = 'sync_webdav_url'
const LS_USERNAME = 'sync_webdav_username'

let map: Map<string, any>

function createStorage(): DbStorageAdapter {
  return {
    getItem: (key: string) => (map.has(key) ? map.get(key) : null),
    setItem: (key: string, value: any) => { map.set(key, value) },
    removeItem: (key: string) => { map.delete(key) },
  }
}

function installElectronApi(api: Record<string, unknown> | undefined) {
  env.electron = true
  if (api) {
    (window as any).electronAPI = api
  } else {
    delete (window as any).electronAPI
  }
}

function createStore() {
  setActivePinia(createPinia())
  return useSyncStore()
}

describe('WebDAV 密码静态加密', () => {
  beforeEach(() => {
    env.electron = false
    delete (window as any).electronAPI
    map = new Map()
    setDbStorage(createStorage())
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('Electron 下保存配置时密码以 enc:v1: 前缀密文落盘', async () => {
    const encrypt = vi.fn(async (plain: string) => `cipher(${plain})`)
    installElectronApi({ safeStorageEncrypt: encrypt, safeStorageDecrypt: vi.fn() })

    const store = createStore()
    store.webdavUrl = 'https://dav.example.com/dav/'
    store.webdavUsername = 'alice'
    store.webdavPassword = 'p@ss'

    await store.saveWebDavConfig()

    expect(encrypt).toHaveBeenCalledWith('p@ss')
    expect(map.get(LS_PASSWORD)).toBe('enc:v1:cipher(p@ss)')
  })

  it('非 Electron 环境落盘明文，保持历史兼容', async () => {
    const store = createStore()
    store.webdavUrl = 'https://dav.example.com/dav/'
    store.webdavUsername = 'alice'
    store.webdavPassword = 'p@ss'

    await store.saveWebDavConfig()

    expect(map.get(LS_PASSWORD)).toBe('p@ss')
  })

  it('safeStorageEncrypt 抛错时回退明文', async () => {
    const encrypt = vi.fn(async () => { throw new Error('DPAPI unavailable') })
    installElectronApi({ safeStorageEncrypt: encrypt, safeStorageDecrypt: vi.fn() })

    const store = createStore()
    store.webdavUrl = 'https://dav.example.com/dav/'
    store.webdavUsername = 'alice'
    store.webdavPassword = 'p@ss'

    await store.saveWebDavConfig()

    expect(map.get(LS_PASSWORD)).toBe('p@ss')
  })

  /**
   * 回归：encryptStoredPassword 曾自己吞掉加密异常且不留日志，
   * 密文降级为明文时用户与日志都无感知；现在 catch 内记录警告后回退明文。
   */
  it('safeStorageEncrypt 抛错时记录加密失败警告', async () => {
    installElectronApi({
      safeStorageEncrypt: vi.fn(async () => { throw new Error('DPAPI unavailable') }),
      safeStorageDecrypt: vi.fn(),
    })

    const store = createStore()
    store.webdavUrl = 'https://dav.example.com/dav/'
    store.webdavUsername = 'alice'
    store.webdavPassword = 'p@ss'

    await store.saveWebDavConfig()

    expect(logger.log.w).toHaveBeenCalledWith('WebDAV 密码加密落盘失败，回退明文', expect.any(Error))
  })

  it('存储写入抛错时回退明文并记录警告', async () => {
    installElectronApi({
      safeStorageEncrypt: vi.fn(async (plain: string) => `cipher(${plain})`),
      safeStorageDecrypt: vi.fn(),
    })
    // 仅拒绝密文写入，明文重试可成功
    setDbStorage({
      getItem: (key: string) => (map.has(key) ? map.get(key) : null),
      setItem: (key: string, value: any) => {
        if (String(value).startsWith('enc:v1:')) throw new Error('quota exceeded')
        map.set(key, value)
      },
      removeItem: (key: string) => { map.delete(key) },
    })

    const store = createStore()
    store.webdavUrl = 'https://dav.example.com/dav/'
    store.webdavUsername = 'alice'
    store.webdavPassword = 'p@ss'

    await store.saveWebDavConfig()

    expect(map.get(LS_PASSWORD)).toBe('p@ss')
    expect(logger.log.w).toHaveBeenCalledWith('WebDAV 密码加密落盘失败，回退明文', expect.any(Error))
  })

  it('启动时用 safeStorageDecrypt 还原密文并判定已配置', async () => {
    map.set(LS_URL, 'https://dav.example.com/dav/')
    map.set(LS_USERNAME, 'alice')
    map.set(LS_PASSWORD, 'enc:v1:abc')
    const decrypt = vi.fn(async () => 'p@ss')
    installElectronApi({ safeStorageEncrypt: vi.fn(async (p: string) => p), safeStorageDecrypt: decrypt })

    const store = createStore()
    await store.webdavReady

    expect(decrypt).toHaveBeenCalledWith('abc')
    expect(store.webdavPassword).toBe('p@ss')
    expect(store.webdavConfigured).toBe(true)
  })

  it('有密文但解密能力不可用时密码为空且不算已配置', async () => {
    map.set(LS_URL, 'https://dav.example.com/dav/')
    map.set(LS_USERNAME, 'alice')
    map.set(LS_PASSWORD, 'enc:v1:abc')
    installElectronApi({ safeStorageEncrypt: vi.fn() })

    const store = createStore()
    await store.webdavReady

    expect(store.webdavPassword).toBe('')
    expect(store.webdavConfigured).toBe(false)
  })

  it('启动时把旧明文自动迁移为密文', async () => {
    map.set(LS_URL, 'https://dav.example.com/dav/')
    map.set(LS_USERNAME, 'alice')
    map.set(LS_PASSWORD, 'legacy-pass')
    installElectronApi({
      safeStorageEncrypt: vi.fn(async (plain: string) => `cipher(${plain})`),
      safeStorageDecrypt: vi.fn(async (stored: string) => stored),
    })

    const store = createStore()
    await store.webdavReady

    expect(store.webdavPassword).toBe('legacy-pass')
    await vi.waitFor(() => {
      expect(map.get(LS_PASSWORD)).toBe('enc:v1:cipher(legacy-pass)')
    })
  })

  it('解密抛错时密码为空且不抛异常', async () => {
    map.set(LS_URL, 'https://dav.example.com/dav/')
    map.set(LS_USERNAME, 'alice')
    map.set(LS_PASSWORD, 'enc:v1:abc')
    installElectronApi({
      safeStorageEncrypt: vi.fn(async (p: string) => p),
      safeStorageDecrypt: vi.fn(async () => { throw new Error('keychain locked') }),
    })

    const store = createStore()

    await expect(store.webdavReady).resolves.toBeUndefined()
    expect(store.webdavPassword).toBe('')
    expect(store.webdavConfigured).toBe(false)
  })
})
