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
        restoreKnowledgeMemory: false,
        restorePhoneticMemory: false,
        restoreSignin: false,
        restoreMemoryPalace: false,
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
      expect(DEFAULT_RESTORE_OPTIONS.restoreKnowledgeMemory).toBe(true)
      expect(DEFAULT_RESTORE_OPTIONS.restorePhoneticMemory).toBe(true)
      expect(DEFAULT_RESTORE_OPTIONS.restoreSignin).toBe(true)
      expect(DEFAULT_RESTORE_OPTIONS.restoreMemoryPalace).toBe(true)
    })
  })
})

describe('sync-manager 打卡记录（signin scope）', () => {
  const SIGNIN_KEY = 'signin_records'
  let mockDb: DbAdapter

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

  beforeEach(() => {
    mockDb = createMockDb()
    setDbAdapter(mockDb)
    resetPlatformCache()
    setPlatform('web')
    vi.resetAllMocks()
    localStorage.clear()
  })

  afterEach(() => {
    resetDbAdapter()
    resetPlatformCache()
    localStorage.clear()
  })

  it('collectSyncData 应收集打卡记录', async () => {
    localStorage.setItem(SIGNIN_KEY, JSON.stringify(['2026-09-01', '2026-09-02']))

    const { collectSyncData } = await loadModule()
    const result = await collectSyncData()

    expect(result.signin).toEqual({ dates: ['2026-09-01', '2026-09-02'] })
  })

  it('collectSyncData 无打卡记录时应为 null', async () => {
    const { collectSyncData } = await loadModule()
    const result = await collectSyncData()

    expect(result.signin).toBeNull()
  })

  it('restoreSyncData 应按日期并集合并打卡记录', async () => {
    localStorage.setItem(SIGNIN_KEY, JSON.stringify(['2026-09-01']))

    const { restoreSyncData } = await loadModule()
    const result = await restoreSyncData({
      ...createMockSyncData(),
      signin: { dates: ['2026-09-01', '2026-09-03', '2026-09-02'] },
    })

    expect(result.signinRestored).toBe(true)
    // 并集 + 排序写回
    expect(JSON.parse(localStorage.getItem(SIGNIN_KEY)!)).toEqual(['2026-09-01', '2026-09-02', '2026-09-03'])
  })

  it('restoreSyncData 可通过 restoreSignin 选项跳过打卡还原', async () => {
    localStorage.setItem(SIGNIN_KEY, JSON.stringify(['2026-09-01']))

    const { restoreSyncData } = await loadModule()
    const result = await restoreSyncData(
      { ...createMockSyncData(), signin: { dates: ['2026-09-05'] } },
      {
        conflictStrategy: 'merge',
        restoreWordBanks: false,
        restoreUserSettings: false,
        restoreTextMemory: false,
        restoreNumberMemory: false,
        restoreShortcutMemory: false,
        restoreLetterMemory: false,
        restoreKnowledgeMemory: false,
        restorePhoneticMemory: false,
        restoreSignin: false,
      },
    )

    expect(result.signinRestored).toBe(false)
    expect(JSON.parse(localStorage.getItem(SIGNIN_KEY)!)).toEqual(['2026-09-01'])
  })
})

describe('sync-manager 记忆宫殿（memoryPalace scope）', () => {
  const PALACES_DOC_ID = 'memory_palace_palaces'
  let mockDb: DbAdapter

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

  const makePalaceDoc = (palaces: any[] = []) => ({
    _id: PALACES_DOC_ID,
    type: 'memory_palace_palaces',
    palaces,
    updatedAt: Date.now(),
  })

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

  it('collectSyncData 应收集记忆宫殿（含桩挂载）', async () => {
    mockDb.put!(makePalaceDoc([{ _id: 'p1', name: '测试宫殿', loci: [{ order: 1, name: '大门' }], ctime: 1, utime: 1 }]))
    mockDb.put!({
      _id: 'memory_palace_pegs_p1',
      type: 'memory_palace_pegs',
      palaceId: 'p1',
      items: [{ _id: 'peg_p1_1', palaceId: 'p1', locusOrder: 1, freeText: '内容', level: 2, learnDate: 100 }],
      updatedAt: Date.now(),
    })

    const { collectSyncData } = await loadModule()
    const result = await collectSyncData()

    expect(result.memoryPalace).not.toBeNull()
    expect(result.memoryPalace!.palaces).toHaveLength(1)
    expect(result.memoryPalace!.pegs['p1']).toHaveLength(1)
  })

  it('collectSyncData 无宫殿时应为 null', async () => {
    const { collectSyncData } = await loadModule()
    const result = await collectSyncData()
    expect(result.memoryPalace).toBeNull()
  })

  it('restoreSyncData 应合并还原记忆宫殿（新宫殿写入 DB）', async () => {
    const { restoreSyncData } = await loadModule()
    const result = await restoreSyncData({
      ...createMockSyncData(),
      memoryPalace: {
        palaces: [{ _id: 'p1', name: '远端宫殿', loci: [{ order: 1, name: '大门' }], ctime: 1, utime: 1 }],
        pegs: { p1: [{ _id: 'peg_p1_1', palaceId: 'p1', locusOrder: 1, freeText: '内容' }] },
      },
    })

    expect(result.memoryPalaceRestored).toBe(true)
    const palacesDoc = mockDb.get!(PALACES_DOC_ID) as any
    expect(palacesDoc?.palaces).toHaveLength(1)
    expect(palacesDoc?.palaces[0].name).toBe('远端宫殿')
    const pegsDoc = mockDb.get!('memory_palace_pegs_p1') as any
    expect(pegsDoc?.items).toHaveLength(1)
  })

  it('restoreSyncData 可通过 restoreMemoryPalace 选项跳过宫殿还原', async () => {
    const { restoreSyncData } = await loadModule()
    const result = await restoreSyncData(
      { ...createMockSyncData(), memoryPalace: { palaces: [{ _id: 'p1', name: 'x', loci: [], ctime: 1, utime: 1 }], pegs: {} } },
      {
        conflictStrategy: 'merge',
        restoreWordBanks: false,
        restoreUserSettings: false,
        restoreTextMemory: false,
        restoreNumberMemory: false,
        restoreShortcutMemory: false,
        restoreLetterMemory: false,
        restoreKnowledgeMemory: false,
        restorePhoneticMemory: false,
        restoreSignin: false,
        restoreMemoryPalace: false,
      },
    )

    expect(result.memoryPalaceRestored).toBe(false)
    expect(mockDb.get!(PALACES_DOC_ID)).toBeNull()
  })
})
