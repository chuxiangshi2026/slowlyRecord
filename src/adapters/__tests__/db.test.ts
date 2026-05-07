/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getDbAdapter, getDbAdapterAsync, setDbAdapter, resetDbAdapter } from '../db'
import { resetPlatformCache } from '../platform'
import type { DbAdapter } from '../db'
import 'fake-indexeddb/auto'

describe('db adapter registration', () => {
  beforeEach(() => {
    resetDbAdapter()
    resetPlatformCache()
    delete (window as any).utools
    delete (window as any).wx
    delete (window as any).electronAPI
    delete (window as any).uni
  })

  describe('getDbAdapter (sync)', () => {
    it('should throw error when not initialized', () => {
      expect(() => getDbAdapter()).toThrow('DbAdapter not initialized')
    })

    it('should return cached adapter after async init', async () => {
      await getDbAdapterAsync()
      const adapter = getDbAdapter()
      expect(adapter).toBeDefined()
    })

    it('should return same instance as async init', async () => {
      const asyncAdapter = await getDbAdapterAsync()
      const syncAdapter = getDbAdapter()
      expect(syncAdapter).toBe(asyncAdapter)
    })
  })

  describe('getDbAdapterAsync', () => {
    it('should initialize IndexedDB adapter for web platform', async () => {
      const adapter = await getDbAdapterAsync()
      expect(adapter).toBeDefined()
      expect(adapter.promises).toBeDefined()
    })

    it('should cache the adapter', async () => {
      const adapter1 = await getDbAdapterAsync()
      const adapter2 = await getDbAdapterAsync()
      expect(adapter1).toBe(adapter2)
    })

    it('should initialize uTools adapter when utools is available', async () => {
      ;(window as any).utools = {
        getPath: vi.fn(),
        db: {
          get: vi.fn(),
          allDocs: vi.fn(() => []),
          remove: vi.fn(() => ({ ok: true })),
          bulkDocs: vi.fn(() => []),
          promises: {
            put: vi.fn(async () => ({ ok: true })),
            remove: vi.fn(async () => ({ ok: true })),
            bulkDocs: vi.fn(async () => []),
          },
        },
      }
      
      resetPlatformCache()
      const adapter = await getDbAdapterAsync()
      // 验证适配器类型（uTools 适配器代理 utools.db）
      expect(adapter).toBeDefined()
    })
  })

  describe('setDbAdapter', () => {
    it('should allow manually setting an adapter', () => {
      const mockAdapter: DbAdapter = {
        get: vi.fn(),
        allDocs: vi.fn(() => []),
        remove: vi.fn(() => ({ id: '', ok: true })),
        bulkDocs: vi.fn(() => []),
        promises: {
          put: vi.fn(async () => ({ id: '', ok: true })),
          remove: vi.fn(async () => ({ id: '', ok: true })),
          bulkDocs: vi.fn(async () => []),
        },
      }
      
      setDbAdapter(mockAdapter)
      expect(getDbAdapter()).toBe(mockAdapter)
    })
  })

  describe('resetDbAdapter', () => {
    it('should clear the cached adapter', async () => {
      await getDbAdapterAsync()
      resetDbAdapter()
      expect(() => getDbAdapter()).toThrow('DbAdapter not initialized')
    })
  })
})
