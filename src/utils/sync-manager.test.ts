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

  // put/bulkDocs 保留调用方显式传入的 _rev（未传时分配 '1-rev'），
  // 便于断言「覆盖写时使用本地 _rev、剥离远端 _rev」
  const putImpl = (doc: any) => {
    storage.set(doc._id, { ...doc, _rev: doc._rev || '1-rev' })
    return { ok: true, id: doc._id, rev: doc._rev || '1-rev' }
  }

  return {
    get: vi.fn((id: string) => storage.get(id) || null),
    put: vi.fn(putImpl),
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
      return docs.map(putImpl)
    }),
    promises: {
      get: vi.fn(async (id: string) => storage.get(id) || null),
      put: vi.fn(async (doc: any) => putImpl(doc)),
      remove: vi.fn(async (id: string) => {
        storage.delete(id)
        return { ok: true, id }
      }),
      bulkDocs: vi.fn(async (docs: any[]) => {
        return docs.map(putImpl)
      }),
    },
  }
}

import { getAllWordBanks, saveWordBank } from '@shared/utils/wordbank-manager'
import { getSetDb } from '@shared/utils/user-set-db-util'
import { TOMBSTONES_DOC_ID } from '@shared/utils/sync-tombstone'
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

    it('词库级墓碑：本地已删除该词库（删除不早于远端更新）时跳过恢复，不让空壳复活', async () => {
      const { restoreSyncData, DEFAULT_RESTORE_OPTIONS } = await loadModule()
      vi.mocked(getAllWordBanks).mockResolvedValue([] as any)
      const now = Date.now()
      // 本地埋了 bank-deleted 的词库墓碑
      mockDb.put!({
        _id: TOMBSTONES_DOC_ID,
        type: 'sync-tombstones',
        tombstones: { 'bank-deleted': now },
        updatedAt: now,
      } as any)
      const data: SyncData = {
        ...createMockSyncData(),
        wordBanks: [
          { id: 'bank-deleted', name: '已删词库', words: [{ _id: 'w1', text: 'hello' } as any], createdAt: 1, updatedAt: now - 1000 },
          { id: 'bank-alive', name: '正常词库', words: [], createdAt: 1, updatedAt: now - 1000 },
        ],
      }

      const result = await restoreSyncData(data, DEFAULT_RESTORE_OPTIONS)

      expect(result.wordBanksRestored).toBe(2)
      const savedIds = vi.mocked(saveWordBank).mock.calls.map(c => (c[0] as any).id)
      // 被删词库不复活，正常词库照常恢复
      expect(savedIds).not.toContain('bank-deleted')
      expect(savedIds).toContain('bank-alive')
    })

    it('词库墓碑早于远端 updatedAt（远端在删除后又更新过）时仍恢复', async () => {
      const { restoreSyncData, DEFAULT_RESTORE_OPTIONS } = await loadModule()
      vi.mocked(getAllWordBanks).mockResolvedValue([] as any)
      const now = Date.now()
      mockDb.put!({
        _id: TOMBSTONES_DOC_ID,
        type: 'sync-tombstones',
        tombstones: { 'bank-1': now - 1000 },
        updatedAt: now - 1000,
      } as any)
      const data: SyncData = {
        ...createMockSyncData(),
        wordBanks: [
          { id: 'bank-1', name: '删除后又有更新的词库', words: [], createdAt: 1, updatedAt: now },
        ],
      }

      await restoreSyncData(data, DEFAULT_RESTORE_OPTIONS)

      const savedIds = vi.mocked(saveWordBank).mock.calls.map(c => (c[0] as any).id)
      expect(savedIds).toContain('bank-1')
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

    it('还原文本记忆应按 _id 合并而非覆盖', async () => {
      const { restoreSyncData, DEFAULT_RESTORE_OPTIONS } = await loadModule()
      // 本地已有 article-local
      mockDb.put!({
        _id: 'slowlyrecord-textmemory-data',
        type: 'textmemory',
        articles: [{ _id: 'article-same', title: '本地版本' }],
        notes: [],
        prompts: [],
        updatedAt: 1,
      } as any)

      const data: SyncData = {
        ...createMockSyncData(),
        textMemory: {
          articles: [
            { _id: 'article-same', title: '远端版本', content: '', createdAt: 1, updatedAt: 1 },
            { _id: 'article-new', title: '远端新增', content: '', createdAt: 1, updatedAt: 1 },
          ],
          notes: [],
          prompts: [],
        },
      }

      const result = await restoreSyncData(data, DEFAULT_RESTORE_OPTIONS)

      expect(result.textMemoryRestored).toBe(true)
      const doc = mockDb.get!('slowlyrecord-textmemory-data') as any
      expect(doc.articles).toHaveLength(2)
      // 同 _id 保留本地版本，不背远端覆盖
      expect(doc.articles.find((a: any) => a._id === 'article-same').title).toBe('本地版本')
      expect(doc.articles.find((a: any) => a._id === 'article-new').title).toBe('远端新增')
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

  it('restoreSyncData 应跳过本地已埋墓碑的宫殿（不复活、pegs 也不回来）', async () => {
    const now = Date.now()
    // 本地删除 p1 宫殿的墓碑（晚于远端 utime）
    mockDb.put!({
      _id: TOMBSTONES_DOC_ID,
      type: 'sync-tombstones',
      tombstones: { p1: now },
      updatedAt: now,
    } as any)

    const { restoreSyncData } = await loadModule()
    const result = await restoreSyncData({
      ...createMockSyncData(),
      memoryPalace: {
        palaces: [{ _id: 'p1', name: '已删宫殿', loci: [{ order: 1, name: '大门' }], ctime: 1, utime: now - 1000 }],
        pegs: { p1: [{ _id: 'peg_p1_1', palaceId: 'p1', locusOrder: 1, freeText: '内容' }] },
      },
    })

    expect(result.memoryPalaceRestored).toBe(true)
    // 宫殿与其桩挂载都不复活
    expect(mockDb.get!(PALACES_DOC_ID)).toBeNull()
    expect(mockDb.get!('memory_palace_pegs_p1')).toBeNull()
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

describe('sync-manager 句子库（sentences scope）', () => {
  const DOC_ID = 'slowlyrecord-sentences-data'
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

  const makeSentence = (id: string, text: string): any => ({
    id,
    text,
    lang: 'zh',
    tags: [],
    favorite: false,
    createdAt: 1,
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

  it('collectSyncData 应收集句子库', async () => {
    mockDb.put!({ _id: DOC_ID, type: 'sentences', sentences: [makeSentence('s1', '句子一')], updatedAt: 1 })

    const { collectSyncData } = await loadModule()
    const result = await collectSyncData()

    expect(result.sentences).not.toBeNull()
    expect(result.sentences!.sentences).toHaveLength(1)
  })

  it('collectSyncData 空库时应为 null', async () => {
    const { collectSyncData } = await loadModule()
    const result = await collectSyncData()
    expect(result.sentences).toBeNull()
  })

  it('restoreSyncData 应按 id 合并去重', async () => {
    mockDb.put!({ _id: DOC_ID, type: 'sentences', sentences: [makeSentence('s1', '本地版本')], updatedAt: 1 })

    const { restoreSyncData } = await loadModule()
    const result = await restoreSyncData({
      ...createMockSyncData(),
      sentences: { sentences: [makeSentence('s1', '远端版本'), makeSentence('s2', '新句子')] },
    })

    expect(result.sentencesRestored).toBe(true)
    const doc = mockDb.get!(DOC_ID) as any
    expect(doc?.sentences).toHaveLength(2)
    // 已有 id 保留本地版本
    expect(doc?.sentences.find((s: any) => s.id === 's1').text).toBe('本地版本')
    expect(doc?.sentences.find((s: any) => s.id === 's2').text).toBe('新句子')
  })

  it('restoreSyncData 可通过 restoreSentences 选项跳过', async () => {
    const { restoreSyncData } = await loadModule()
    const result = await restoreSyncData(
      { ...createMockSyncData(), sentences: { sentences: [makeSentence('s1', 'x')] } },
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
        restoreSentences: false,
      },
    )

    expect(result.sentencesRestored).toBe(false)
    expect(mockDb.get!(DOC_ID)).toBeNull()
  })
})

describe('sync-manager 墓碑过滤（tombstone scope）', () => {
  const TOMBSTONES_DOC_ID = 'slowly-record-sync-tombstones'
  const SENTENCES_DOC_ID = 'slowlyrecord-sentences-data'
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

  const seedTombstones = (tombstones: Record<string, number>) => {
    mockDb.put!({ _id: TOMBSTONES_DOC_ID, type: 'sync-tombstones', tombstones, updatedAt: Date.now() } as any)
  }

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

  it('restoreWordBanks 时远端已被本机删除的单词不复活', async () => {
    const now = Date.now()
    seedTombstones({ 'word-deleted': now })
    vi.mocked(getAllWordBanks).mockResolvedValue([])

    const { restoreSyncData } = await loadModule()
    const result = await restoreSyncData({
      ...createMockSyncData(),
      wordBanks: [
        {
          id: 'bank-1',
          name: 'Test',
          createdAt: 1,
          updatedAt: 1,
          words: [
            { _id: 'word-deleted', text: 'deleted', ctime: new Date(now - 1000) } as any,
            { _id: 'word-alive', text: 'alive', ctime: new Date(now - 1000) } as any,
          ],
        },
      ],
    })

    expect(result.wordBanksRestored).toBe(1)
    // 新词库创建路径：saveWordBank 收到的 words 应已过滤掉墓碑词
    const savedBank = vi.mocked(saveWordBank).mock.calls[0][0] as any
    expect(savedBank.words.map((w: any) => w._id)).toEqual(['word-alive'])
  })

  it('restoreTextMemory 时远端已删除的文章不复活', async () => {
    const now = Date.now()
    seedTombstones({ 'article-deleted': now })

    const { restoreSyncData } = await loadModule()
    const result = await restoreSyncData({
      ...createMockSyncData(),
      textMemory: {
        articles: [
          { _id: 'article-deleted', title: '已删文章', content: '', createdAt: 1, updatedAt: 1 },
          { _id: 'article-new', title: '远端新增', content: '', createdAt: 1, updatedAt: 1 },
        ],
        notes: [],
        prompts: [],
      },
    })

    expect(result.textMemoryRestored).toBe(true)
    const doc = mockDb.get!('slowlyrecord-textmemory-data') as any
    expect(doc.articles.map((a: any) => a._id)).toEqual(['article-new'])
  })

  it('restoreSentences 时远端已删除的句子不复活', async () => {
    const now = Date.now()
    seedTombstones({ 's-deleted': now })

    const { restoreSyncData } = await loadModule()
    const result = await restoreSyncData({
      ...createMockSyncData(),
      sentences: {
        sentences: [
          { id: 's-deleted', text: '已删句子', lang: 'zh', tags: [], favorite: false, createdAt: 1 },
          { id: 's-new', text: '新句子', lang: 'zh', tags: [], favorite: false, createdAt: 1 },
        ],
      },
    })

    expect(result.sentencesRestored).toBe(true)
    const doc = mockDb.get!(SENTENCES_DOC_ID) as any
    expect(doc.sentences.map((s: any) => s.id)).toEqual(['s-new'])
  })

  it('payload 携带的远端墓碑合并进本地墓碑表（取较大 deletedAt）', async () => {
    const now = Date.now()
    seedTombstones({ shared: now - 1000 })

    const { restoreSyncData } = await loadModule()
    await restoreSyncData({
      ...createMockSyncData(),
      tombstones: { shared: now - 500, 'remote-only': now - 100 },
    })

    const doc = mockDb.get!(TOMBSTONES_DOC_ID) as any
    // 远端较新的 shared 采纳远端值；remote-only 并入本地
    expect(doc.tombstones['shared']).toBe(now - 500)
    expect(doc.tombstones['remote-only']).toBe(now - 100)
  })

  it('collectSyncData 应附带本地墓碑表', async () => {
    const now = Date.now()
    seedTombstones({ 'word-x': now })
    vi.mocked(getAllWordBanks).mockResolvedValue([])

    const { collectSyncData } = await loadModule()
    const result = await collectSyncData()

    expect(result.tombstones).toEqual({ 'word-x': now })
  })
})

describe('sync-manager 数字记忆还原（numberMemory scope）', () => {
  const PREFIX = 'number_memory_'
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

  const makeEntry = (_id: string, title: string, updatedAt: number, extra: any = {}): any => ({
    _id,
    type: 'number_memory_entry',
    title,
    numbers: '1234',
    tags: [],
    createdAt: updatedAt,
    updatedAt,
    reviewCount: 0,
    ...extra,
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

  it('本地条目较新时不被远端旧数据覆盖', async () => {
    mockDb.put!(makeEntry(PREFIX + 'entry_local', '本地新版本', 300))

    const { restoreSyncData } = await loadModule()
    const result = await restoreSyncData({
      ...createMockSyncData(),
      exportedAt: 400,
      numberMemory: {
        entries: [makeEntry(PREFIX + 'entry_local', '远端旧版本', 100, { _rev: '9-remote' })],
        notes: [],
        prompts: [],
        associations: [],
        trainingResults: [],
      },
    })

    expect(result.numberMemoryRestored).toBe(true)
    const doc = mockDb.get!(PREFIX + 'entry_local') as any
    expect(doc.title).toBe('本地新版本')
  })

  it('远端条目较新时覆盖且 _rev 用本地的（剥离远端 _rev）', async () => {
    mockDb.put!({ ...makeEntry(PREFIX + 'entry_local', '本地旧版本', 100), _rev: '5-local' })

    const { restoreSyncData } = await loadModule()
    await restoreSyncData({
      ...createMockSyncData(),
      exportedAt: 400,
      numberMemory: {
        entries: [makeEntry(PREFIX + 'entry_local', '远端新版本', 300, { _rev: '9-remote' })],
        notes: [],
        prompts: [],
        associations: [],
        trainingResults: [],
      },
    })

    const doc = mockDb.get!(PREFIX + 'entry_local') as any
    expect(doc.title).toBe('远端新版本')
    expect(doc._rev).toBe('5-local')
  })

  it('远端新增条目写入时剥离远端 _rev（由适配器分配新 rev）', async () => {
    const { restoreSyncData } = await loadModule()
    await restoreSyncData({
      ...createMockSyncData(),
      exportedAt: 400,
      numberMemory: {
        entries: [makeEntry(PREFIX + 'entry_new9', '远端新增', 100, { _rev: '9-remote' })],
        notes: [],
        prompts: [],
        associations: [],
        trainingResults: [],
      },
    })

    const doc = mockDb.get!(PREFIX + 'entry_new9') as any
    expect(doc.title).toBe('远端新增')
    expect(doc._rev).not.toBe('9-remote')
  })

  it('墓碑中的条目 id 不从远端复活', async () => {
    const now = Date.now()
    mockDb.put!({ _id: 'slowly-record-sync-tombstones', type: 'sync-tombstones', tombstones: { [PREFIX + 'entry_dead']: now }, updatedAt: now })

    const { restoreSyncData } = await loadModule()
    await restoreSyncData({
      ...createMockSyncData(),
      exportedAt: now + 100,
      numberMemory: {
        entries: [makeEntry(PREFIX + 'entry_dead', '已删条目', now - 1000)],
        notes: [],
        prompts: [],
        associations: [],
        trainingResults: [],
      },
    })

    expect(mockDb.get!(PREFIX + 'entry_dead')).toBeNull()
  })

  it('associations 按 number 键合并：远端导出较新时覆盖，否则保留本地', async () => {
    // 场景一：远端导出时间(200) >= 本地训练文档 updatedAt(100) → 远端覆盖 number 0，新增 number 1
    mockDb.put!({
      _id: PREFIX + 'training_1',
      type: 'number_memory_training',
      associations: [{ number: '0', imageUrl: 'local-0', source: 'upload' }],
      createdAt: 100,
      updatedAt: 100,
    })

    const { restoreSyncData } = await loadModule()
    await restoreSyncData({
      ...createMockSyncData(),
      exportedAt: 200,
      numberMemory: {
        entries: [],
        notes: [],
        prompts: [],
        associations: [
          { number: '0', imageUrl: 'remote-0', source: 'upload' },
          { number: '1', imageUrl: 'remote-1', source: 'upload' },
        ],
        trainingResults: [],
      },
    })

    let training = mockDb.get!(PREFIX + 'training_1') as any
    expect(training.associations).toHaveLength(2)
    expect(training.associations.find((a: any) => a.number === '0').imageUrl).toBe('remote-0')
    expect(training.associations.find((a: any) => a.number === '1').imageUrl).toBe('remote-1')

    // 场景二：远端导出时间(150) < 本地 updatedAt(200) → 保留本地
    mockDb.put!({
      _id: PREFIX + 'training_1',
      type: 'number_memory_training',
      associations: [
        { number: '0', imageUrl: 'local-0', source: 'upload' },
        { number: '1', imageUrl: 'remote-1', source: 'upload' },
      ],
      createdAt: 100,
      updatedAt: 200,
    })

    await restoreSyncData({
      ...createMockSyncData(),
      exportedAt: 150,
      numberMemory: {
        entries: [],
        notes: [],
        prompts: [],
        associations: [{ number: '0', imageUrl: 'remote-0-v2', source: 'upload' }],
        trainingResults: [],
      },
    })

    training = mockDb.get!(PREFIX + 'training_1') as any
    expect(training.associations.find((a: any) => a.number === '0').imageUrl).toBe('local-0')
  })

  it('墓碑中的 number 关联不从远端复活', async () => {
    const now = Date.now()
    mockDb.put!({ _id: 'slowly-record-sync-tombstones', type: 'sync-tombstones', tombstones: { '7': now }, updatedAt: now })
    mockDb.put!({
      _id: PREFIX + 'training_1',
      type: 'number_memory_training',
      associations: [],
      createdAt: 1,
      updatedAt: 1,
    })

    const { restoreSyncData } = await loadModule()
    await restoreSyncData({
      ...createMockSyncData(),
      exportedAt: now + 100,
      numberMemory: {
        entries: [],
        notes: [],
        prompts: [],
        associations: [{ number: '7', imageUrl: 'remote-7', source: 'upload' }],
        trainingResults: [],
      },
    })

    const training = mockDb.get!(PREFIX + 'training_1') as any
    expect(training.associations).toHaveLength(0)
  })

  it('prompts/trainingResults 无时间字段：本地优先不覆盖，远端新增才追加', async () => {
    mockDb.put!({
      _id: PREFIX + 'prompt_1',
      type: 'number_memory_prompt',
      entryId: 'entry-1',
      title: '本地提示词',
      content: 'local',
      order: 1,
      enabled: true,
      createdAt: 100,
      _rev: '3-local',
    })
    mockDb.put!({
      _id: PREFIX + 'result_1',
      type: 'number_memory_result',
      mode: 'numberToImage',
      totalQuestions: 1,
      correctAnswers: 1,
      duration: 10,
      details: [],
      createdAt: 100,
      _rev: '3-local',
    })

    const { restoreSyncData } = await loadModule()
    await restoreSyncData({
      ...createMockSyncData(),
      exportedAt: 999,
      numberMemory: {
        entries: [],
        notes: [],
        prompts: [
          { _id: PREFIX + 'prompt_1', type: 'number_memory_prompt', entryId: 'entry-1', title: '远端提示词', content: 'remote', order: 1, enabled: true, createdAt: 100, _rev: '9-remote' },
          { _id: PREFIX + 'prompt_new', type: 'number_memory_prompt', entryId: 'entry-1', title: '远端新增提示词', content: 'new', order: 2, enabled: true, createdAt: 100, _rev: '9-remote' },
        ],
        associations: [],
        trainingResults: [
          { _id: PREFIX + 'result_1', type: 'number_memory_result', mode: 'numberToImage', totalQuestions: 2, correctAnswers: 2, duration: 20, details: [], createdAt: 100, _rev: '9-remote' },
          { _id: PREFIX + 'result_new', type: 'number_memory_result', mode: 'imageToNumber', totalQuestions: 1, correctAnswers: 1, duration: 5, details: [], createdAt: 100, _rev: '9-remote' },
        ],
      },
    })

    // 同 _id 保留本地版本（含本地 _rev）
    const prompt = mockDb.get!(PREFIX + 'prompt_1') as any
    expect(prompt.title).toBe('本地提示词')
    expect(prompt._rev).toBe('3-local')
    const result = mockDb.get!(PREFIX + 'result_1') as any
    expect(result.totalQuestions).toBe(1)

    // 远端新增追加且剥离远端 _rev
    const newPrompt = mockDb.get!(PREFIX + 'prompt_new') as any
    expect(newPrompt.title).toBe('远端新增提示词')
    expect(newPrompt._rev).not.toBe('9-remote')
    expect(mockDb.get!(PREFIX + 'result_new')).toBeTruthy()
  })
})
