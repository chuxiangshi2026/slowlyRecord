// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setDbAdapter, resetDbAdapter, type DbAdapter } from '@shared/adapters/db'
import { setPlatform, resetPlatformCache } from '@shared/adapters/platform'
import 'fake-indexeddb/auto'

// Mock 依赖
vi.mock('@shared/utils/logger', () => ({
  log: { i: vi.fn(), d: vi.fn(), e: vi.fn(), w: vi.fn() },
}))

vi.mock('@shared/utils/wordbank-manager', () => ({
  getAllWordBanks: vi.fn(async () => []),
  saveWordBank: vi.fn(async () => ({})),
  getCurrentWordBankId: vi.fn(async () => 'default-bank'),
  setCurrentWordBankId: vi.fn(),
  createWordBank: vi.fn(),
}))

vi.mock('@shared/utils/user-set-db-util', () => ({
  getSetDb: vi.fn(() => null),
  addAndUpdateSetDb: vi.fn(async () => ({})),
}))

// 延迟导入被测试模块
async function loadModule() {
  return await import('./sync-manager')
}

const createMockDb = (): DbAdapter => {
  const storage = new Map<string, any>()

  return {
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
        if (!prefix || id.startsWith(prefix)) {
          docs.push(doc)
        }
      })
      return docs
    }),
    bulkDocs: vi.fn((docs: any[]) => {
      return docs.map(doc => {
        storage.set(doc._id, { ...doc, _rev: '1-rev' })
        return { ok: true, id: doc._id, rev: '1-rev' }
      })
    }),
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
      bulkDocs: vi.fn(async (docs: any[]) => {
        return docs.map(doc => {
          storage.set(doc._id, { ...doc, _rev: '1-rev' })
          return { ok: true, id: doc._id, rev: '1-rev' }
        })
      }),
    },
  }
}

import { getAllWordBanks } from '@shared/utils/wordbank-manager'
import { getSetDb } from '@shared/utils/user-set-db-util'
import type { SyncData } from '@shared/types/sync'

describe('sync-manager', () => {
  let mockDb: DbAdapter

  beforeEach(() => {
    mockDb = createMockDb()
    setDbAdapter(mockDb)
    resetPlatformCache()
    setPlatform('web')
    vi.resetAllMocks()
  })

  afterEach(() => {
    resetDbAdapter()
    resetPlatformCache()
    vi.restoreAllMocks()
  })

  describe('collectSyncData', () => {
    it('应该收集同步数据', async () => {
      const { collectSyncData } = await loadModule()

      const result = await collectSyncData()

      expect(result).toHaveProperty('version')
      expect(result).toHaveProperty('exportedAt')
      expect(result).toHaveProperty('platform', 'web')
      expect(result).toHaveProperty('wordBanks')
      expect(result).toHaveProperty('currentWordBankId')
    })

    it('应该收集词库数据', async () => {
      const mockBanks = [
        { id: 'bank-1', name: 'Test', words: [], createdAt: 1, updatedAt: 1 },
      ]
      vi.mocked(getAllWordBanks).mockResolvedValue(mockBanks as any)

      const { collectSyncData } = await loadModule()
      const result = await collectSyncData()

      expect(result.wordBanks).toHaveLength(1)
      expect(result.wordBanks[0].id).toBe('bank-1')
    })

    it('应该收集用户设置', async () => {
      vi.mocked(getSetDb).mockReturnValue({
        pluginStatus: true,
        shortcutEnabled: false,
        translationPlatform: 'test',
        ocrPlatform: 'local',
        memoryFirmness: '高',
        keys: { test: { appkey: 'key', key: 'secret' } },
        ocrKeys: {},
        focusMode: { alwaysOnTop: true, opacity: 0.5, edgeStickEnabled: false, fontColor: '', fontSize: 20, explainFontSize: 11, backgroundImage: '', backgroundImageOpacity: 0.35 },
      } as any)

      const { collectSyncData } = await loadModule()
      const result = await collectSyncData()

      expect(result.userSettings).not.toBeNull()
      expect(result.userSettings?.pluginStatus).toBe(true)
      expect(result.userSettings?.translationPlatform).toBe('test')
    })

    it('数字记忆为空时应该返回 null', async () => {
      const { collectSyncData } = await loadModule()
      const result = await collectSyncData()

      expect(result.numberMemory).toBeNull()
    })
  })

  describe('restoreSyncData', () => {
    const createMockSyncData = (): SyncData => ({
      version: 1,
      exportedAt: Date.now(),
      platform: 'test',
      wordBanks: [],
      currentWordBankId: '',
      userSettings: null,
      textMemory: null,
      numberMemory: null,
      shortcutMemory: null,
      letterMemory: null,
    })

    it('应该还原同步数据', async () => {
      const { restoreSyncData } = await loadModule()

      const result = await restoreSyncData(createMockSyncData())

      expect(result.success).toBe(true)
    })

    it('版本过高时应该失败', async () => {
      const { restoreSyncData } = await loadModule()
      const data = { ...createMockSyncData(), version: 999 }

      const result = await restoreSyncData(data)

      expect(result.success).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })

    it('应该还原词库', async () => {
      const { restoreSyncData, DEFAULT_RESTORE_OPTIONS } = await loadModule()
      const data: SyncData = {
        ...createMockSyncData(),
        wordBanks: [
          { id: 'bank-1', name: 'Test', words: [], createdAt: 1, updatedAt: 1 },
        ],
      }

      const result = await restoreSyncData(data, DEFAULT_RESTORE_OPTIONS)

      expect(result.wordBanksRestored).toBe(1)
    })

    it('应该还原用户设置', async () => {
      const { restoreSyncData, DEFAULT_RESTORE_OPTIONS } = await loadModule()
      const data: SyncData = {
        ...createMockSyncData(),
        userSettings: {
          pluginStatus: true,
          shortcutEnabled: false,
          translationPlatform: 'test',
          ocrPlatform: 'local',
          memoryFirmness: '正常',
          keys: {},
          ocrKeys: {},
          focusMode: { alwaysOnTop: true, opacity: 1, edgeStickEnabled: true, fontColor: '', fontSize: 20, explainFontSize: 11, backgroundImage: '', backgroundImageOpacity: 0.35 },
        },
      }

      const result = await restoreSyncData(data, DEFAULT_RESTORE_OPTIONS)

      expect(result.userSettingsRestored).toBe(true)
    })

    it('应该还原文本记忆', async () => {
      const { restoreSyncData, DEFAULT_RESTORE_OPTIONS } = await loadModule()
      const data: SyncData = {
        ...createMockSyncData(),
        textMemory: {
          articles: [{ _id: 'article-1', title: 'Test', content: 'Content', createdAt: 1, updatedAt: 1 }],
          notes: [],
          prompts: [],
        },
      }

      const result = await restoreSyncData(data, DEFAULT_RESTORE_OPTIONS)

      expect(result.textMemoryRestored).toBe(true)
    })

    it('应该根据选项选择性还原', async () => {
      const { restoreSyncData } = await loadModule()
      const data: SyncData = {
        ...createMockSyncData(),
        wordBanks: [{ id: 'bank-1', name: 'Test', words: [], createdAt: 1, updatedAt: 1 }],
        userSettings: {
          pluginStatus: true,
          shortcutEnabled: false,
          translationPlatform: 'test',
          ocrPlatform: 'local',
          memoryFirmness: '正常',
          keys: {},
          ocrKeys: {},
          focusMode: { alwaysOnTop: true, opacity: 1, edgeStickEnabled: true, fontColor: '', fontSize: 20, explainFontSize: 11, backgroundImage: '', backgroundImageOpacity: 0.35 },
        },
      }

      const result = await restoreSyncData(data, {
        conflictStrategy: 'merge',
        restoreWordBanks: false,
        restoreUserSettings: true,
        restoreTextMemory: false,
        restoreNumberMemory: false,
        restoreShortcutMemory: false,
        restoreLetterMemory: false,
      })

      expect(result.wordBanksRestored).toBe(0)
      expect(result.userSettingsRestored).toBe(true)
    })
  })

  describe('DEFAULT_RESTORE_OPTIONS', () => {
    it('应该有正确的默认值', async () => {
      const { DEFAULT_RESTORE_OPTIONS } = await loadModule()

      expect(DEFAULT_RESTORE_OPTIONS.conflictStrategy).toBe('merge')
      expect(DEFAULT_RESTORE_OPTIONS.restoreWordBanks).toBe(true)
      expect(DEFAULT_RESTORE_OPTIONS.restoreUserSettings).toBe(true)
      expect(DEFAULT_RESTORE_OPTIONS.restoreTextMemory).toBe(true)
      expect(DEFAULT_RESTORE_OPTIONS.restoreNumberMemory).toBe(true)
      expect(DEFAULT_RESTORE_OPTIONS.restoreShortcutMemory).toBe(true)
      expect(DEFAULT_RESTORE_OPTIONS.restoreLetterMemory).toBe(true)
    })
  })
})
