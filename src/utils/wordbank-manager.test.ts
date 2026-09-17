import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock localStorage
global.localStorage = {
  getItem: vi.fn(() => null),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn()
} as unknown as Storage

// 内存数据库模拟（严格对齐 utools.db 语义）
// put：文档已存在时，仅当携带库中当前 _rev 才成功（_rev 不同或缺失返回 conflict）；新文档直接创建
// get：返回最新文档的副本；remove：校验 _rev，不一致返回 conflict
let memoryDb: Record<string, any> = {}
let memCounter = 0

function nextRev() {
  return String(++memCounter) + '-rev'
}

function putImpl(doc: any) {
  if (!doc._id) {
    return { ok: false, message: 'missing _id' }
  }
  const existing = memoryDb[doc._id]
  if (existing && doc._rev !== existing._rev) {
    return { ok: false, message: 'conflict' }
  }
  const rev = nextRev()
  memoryDb[doc._id] = { ...doc, _rev: rev }
  return { ok: true, id: doc._id, rev }
}

function removeImpl(doc: any) {
  const id = typeof doc === 'string' ? doc : doc._id
  const rev = typeof doc === 'string' ? undefined : doc._rev
  const existing = memoryDb[id]
  if (!existing) {
    return { ok: false, message: 'not found' }
  }
  if (rev !== existing._rev) {
    return { ok: false, message: 'conflict' }
  }
  delete memoryDb[id]
  return { ok: true, id }
}

const mockDbAdapter = {
  get: vi.fn((id: string) => {
    const doc = memoryDb[id]
    return doc ? { ...doc } : null
  }),
  put: vi.fn((doc: any) => putImpl(doc)),
  remove: vi.fn((doc: any) => removeImpl(doc)),
  allDocs: vi.fn((prefix?: string) => {
    return Object.values(memoryDb)
      .filter((doc: any) => !prefix || String(doc._id).startsWith(prefix))
      .map(doc => ({ ...doc }))
  }),
  bulkDocs: vi.fn(() => []),
  promises: {
    get: vi.fn(async (id: string) => {
      const doc = memoryDb[id]
      return doc ? { ...doc } : null
    }),
    put: vi.fn(async (doc: any) => putImpl(doc)),
    remove: vi.fn(async (doc: any) => removeImpl(doc)),
    bulkDocs: vi.fn(async () => []),
  },
}

// 辅助：以合法 _rev 将文档直接种入内存库（模拟 utools 中已持久化的文档）
function seedDoc(id: string, doc: any) {
  memoryDb[id] = { ...doc, _id: id, _rev: doc._rev || nextRev() }
}

// 辅助：直接种入完整词库（1 个 meta 文档 + 每库 1 个分片文档）
function seedBanks(entries: { id: string; words: any[]; name?: string; isDefault?: boolean }[]) {
  seedDoc('slowly-record-wordbank-meta-v2', {
    type: 'wordbank-meta',
    banks: entries.map(e => ({
      id: e.id,
      name: e.name || e.id,
      createdAt: 1,
      updatedAt: 2,
      isDefault: !!e.isDefault,
      language: 'en',
    })),
    updatedAt: Date.now()
  })
  for (const e of entries) {
    seedDoc(`slowly-record-wordbank-chunk-v2:${e.id}:0`, {
      type: 'wordbank-chunk',
      bankId: e.id,
      chunkIndex: 0,
      totalChunks: 1,
      words: e.words,
      updatedAt: Date.now()
    })
  }
}

// Mock @/adapters/db
vi.mock('@/adapters/db', () => ({
  getDbAdapter: vi.fn(() => mockDbAdapter),
  setDbAdapter: vi.fn(),
  resetDbAdapter: vi.fn()
}))

// Mock uuid
vi.mock('uuid', () => ({
  v4: vi.fn(() => 'mock-uuid-' + (++memCounter))
}))

import {
  createDefaultWordBank,
  getAllWordBanks,
  getAllWordBankMetas,
  getCurrentWordBankId,
  setCurrentWordBankId,
  createWordBank,
  saveWordBank,
  getWordBank,
  deleteWordBank,
  updateWordBankName,
  updateWordBankWords,
  updateWordInBankChunk,
  exportWordBankToJson,
  type WordBank
} from './wordbank-manager'

// 辅助：创建测试用 Word
function makeWord(overrides: Partial<any> = {}): any {
  return {
    _id: overrides._id || 'w1',
    text: overrides.text || 'hello',
    explains: overrides.explains || ['你好'],
    level: overrides.level ?? 1,
    isReview: overrides.isReview ?? true,
    remember: overrides.remember ?? false,
    ctime: overrides.ctime || Date.now(),
    learnDate: overrides.learnDate || new Date(),
    ...overrides,
  }
}

// 辅助：创建测试用 WordBank
function makeBank(overrides: Partial<WordBank> = {}): WordBank {
  return {
    id: overrides.id || 'test-bank-1',
    name: overrides.name || '测试词库',
    words: overrides.words || [makeWord(), makeWord({ _id: 'w2', text: 'world' })],
    createdAt: overrides.createdAt || 1000000,
    updatedAt: overrides.updatedAt || 2000000,
    isDefault: overrides.isDefault ?? false,
  }
}

beforeEach(() => {
  memoryDb = {}
  memCounter = 0
  vi.clearAllMocks()
  ;(global.localStorage.getItem as any).mockImplementation(() => null)
  // 重置迁移缓存（通过重新导入模块实现，这里我们需要另一种方式）
  // 使用 vi.resetModules 重新加载模块
})

// ==================== createDefaultWordBank ====================
describe('createDefaultWordBank', () => {
  it('返回默认词库对象，名称为"默认词库"', () => {
    const bank = createDefaultWordBank()
    expect(bank.id).toBe('default')
    expect(bank.name).toBe('默认词库')
    expect(bank.words).toEqual([])
    expect(bank.isDefault).toBe(true)
    expect(bank.createdAt).toBeGreaterThan(0)
    expect(bank.updatedAt).toBeGreaterThan(0)
  })
})

// ==================== setCurrentWordBankId / getCurrentWordBankId ====================
describe('setCurrentWordBankId / getCurrentWordBankId', () => {
  it('setCurrentWordBankId 设置后，getCurrentWordBankId 能读取', async () => {
    // 先创建词库到内存中
    const bank = makeBank({ id: 'my-bank-1', name: '我的词库' })
    await saveWordBank(bank)
    
    setCurrentWordBankId('my-bank-1')
    expect(localStorage.setItem).toHaveBeenCalledWith('slowly-record-current-wordbank', 'my-bank-1')

    ;(localStorage.getItem as any).mockReturnValue('my-bank-1')

    const id = await getCurrentWordBankId()
    expect(id).toBe('my-bank-1')
  })

  it('当本地无存储时，返回默认词库ID', async () => {
    seedBanks([{ id: 'default', name: '默认词库', isDefault: true, words: [] }])

    const id = await getCurrentWordBankId()
    expect(id).toBe('default')
  })

  it('不触发任何分片读取（只读 meta 文档）', async () => {
    seedBanks([{ id: 'current-bank', isDefault: true, words: [makeWord()] }])
    ;(localStorage.getItem as any).mockReturnValue('current-bank')

    const id = await getCurrentWordBankId()
    expect(id).toBe('current-bank')

    const getIds = mockDbAdapter.get.mock.calls.map(([id]) => String(id))
    expect(getIds.every(i => !i.includes('slowly-record-wordbank-chunk-v2'))).toBe(true)
  })
})

// ==================== getAllWordBanks ====================
describe('getAllWordBanks', () => {
  it('无数据时自动创建默认词库', async () => {
    const banks = await getAllWordBanks()
    expect(banks.length).toBe(1)
    expect(banks[0].name).toBe('默认词库')
    expect(banks[0].isDefault).toBe(true)
    expect(banks[0].words).toEqual([])
  })

  it('已有词库时返回列表', async () => {
    seedBanks([{ id: 'custom-1', name: '自定义词库', words: [makeWord(), makeWord({ _id: 'w2', text: 'world' })] }])

    const banks = await getAllWordBanks()
    expect(banks.length).toBe(1)
    expect(banks[0].name).toBe('自定义词库')
    expect(banks[0].words.length).toBe(2)
  })

  it('迁移：将"我的词库"重命名为"默认词库"', async () => {
    seedBanks([{ id: 'old-1', name: '我的词库', isDefault: true, words: [makeWord()] }])

    const banks = await getAllWordBanks()
    expect(banks.length).toBe(1)
    expect(banks[0].name).toBe('默认词库')
  })

  it('迁移：将"基础词库"重命名为"默认词库"', async () => {
    seedBanks([{ id: 'old-2', name: '基础词库', isDefault: true, words: [makeWord()] }])

    const banks = await getAllWordBanks()
    expect(banks.length).toBe(1)
    expect(banks[0].name).toBe('默认词库')
  })
})

// ==================== createWordBank ====================
describe('createWordBank', () => {
  it('创建新词库', async () => {
    const bank = await createWordBank('新词库', [makeWord({ text: 'test' })])
    expect(bank.id).toMatch(/mock-uuid/)
    expect(bank.name).toBe('新词库')
    expect(bank.words.length).toBe(1)
    expect(bank.words[0].text).toBe('test')
  })

  it('空白名称自动设为"未命名词库"', async () => {
    const bank = await createWordBank('   ')
    expect(bank.name).toBe('未命名词库')
  })
})

// ==================== saveWordBank ====================
describe('saveWordBank', () => {
  it('保存新词库', async () => {
    const bank = makeBank({ id: 'new-bank' })
    const success = await saveWordBank(bank)
    expect(success).toBe(true)

    // 验证已保存
    const loaded = await getWordBank('new-bank')
    expect(loaded).not.toBeNull()
    expect(loaded!.name).toBe('测试词库')
  })

  it('更新已有词库', async () => {
    // 先创建
    const bank = makeBank({ id: 'existing', name: '原始名称' })
    await saveWordBank(bank)

    // 再更新
    bank.name = '新名称'
    const success = await saveWordBank(bank)
    expect(success).toBe(true)

    const loaded = await getWordBank('existing')
    expect(loaded!.name).toBe('新名称')
  })

  // === 词组保存测试 ===
  it('保存词组时应保留空格', async () => {
    const phrase = makeWord({ _id: 'p1', text: 'take off' })
    const bank = makeBank({ id: 'phrase-bank', words: [phrase] })
    const success = await saveWordBank(bank)
    expect(success).toBe(true)

    const loaded = await getWordBank('phrase-bank')
    expect(loaded).not.toBeNull()
    expect(loaded!.words[0].text).toBe('take off')
  })

  it('保存词组时应折叠多余空格', async () => {
    const phrase = makeWord({ _id: 'p1', text: 'look   forward   to' })
    const bank = makeBank({ id: 'phrase-bank-2', words: [phrase] })
    const success = await saveWordBank(bank)
    expect(success).toBe(true)

    const loaded = await getWordBank('phrase-bank-2')
    expect(loaded).not.toBeNull()
    expect(loaded!.words[0].text).toBe('look forward to')
  })

  it('词组与单字词不应互相去重', async () => {
    const word = makeWord({ _id: 'w1', text: 'takeoff' })
    const phrase = makeWord({ _id: 'w2', text: 'take off' })
    const bank = makeBank({ id: 'dedup-bank', words: [word, phrase] })
    const success = await saveWordBank(bank)
    expect(success).toBe(true)

    const loaded = await getWordBank('dedup-bank')
    expect(loaded).not.toBeNull()
    // 两个都应该存在
    expect(loaded!.words.length).toBe(2)
    const texts = loaded!.words.map(w => w.text)
    expect(texts).toContain('takeoff')
    expect(texts).toContain('take off')
  })
})

// ==================== getWordBank ====================
describe('getWordBank', () => {
  it('获取存在的词库', async () => {
    const bank = makeBank({ id: 'find-me' })
    await saveWordBank(bank)

    const found = await getWordBank('find-me')
    expect(found).not.toBeNull()
    expect(found!.id).toBe('find-me')
  })

  it('不存在的词库返回 null', async () => {
    const found = await getWordBank('nonexistent')
    expect(found).toBeNull()
  })
})

// ==================== deleteWordBank ====================
describe('deleteWordBank', () => {
  it('不能删除默认词库', async () => {
    const defaultBank = createDefaultWordBank()
    await saveWordBank(defaultBank)

    const result = await deleteWordBank('default')
    expect(result).toBe(false)

    const exists = await getWordBank('default')
    expect(exists).not.toBeNull()
  })

  it('可以删除非默认词库', async () => {
    const bank = makeBank({ id: 'delete-me', isDefault: false })
    await saveWordBank(bank)

    const result = await deleteWordBank('delete-me')
    expect(result).toBe(true)

    const exists = await getWordBank('delete-me')
    expect(exists).toBeNull()
  })
})

// ==================== updateWordBankName ====================
describe('updateWordBankName', () => {
  it('更新词库名称', async () => {
    const bank = makeBank({ id: 'rename-me', name: '原名' })
    await saveWordBank(bank)

    const result = await updateWordBankName('rename-me', '新名称')
    expect(result).toBe(true)

    const updated = await getWordBank('rename-me')
    expect(updated!.name).toBe('新名称')
  })

  it('不存在的词库返回 false', async () => {
    const result = await updateWordBankName('nonexistent', 'whatever')
    expect(result).toBe(false)
  })
})

// ==================== updateWordBankWords ====================
describe('updateWordBankWords', () => {
  it('更新词库单词列表', async () => {
    const bank = makeBank({ id: 'update-words' })
    await saveWordBank(bank)

    const newWords = [makeWord({ text: 'new1' }), makeWord({ text: 'new2' })]
    const result = await updateWordBankWords('update-words', newWords)
    expect(result).toBe(true)

    const updated = await getWordBank('update-words')
    expect(updated!.words.length).toBe(2)
    expect(updated!.words[0].text).toBe('new1')
  })

  it('不存在的词库返回 false', async () => {
    const result = await updateWordBankWords('nonexistent', [])
    expect(result).toBe(false)
  })
})

// ==================== exportWordBankToJson ====================
describe('exportWordBankToJson', () => {
  it('导出词库为 JSON 字符串', async () => {
    const word = makeWord({ text: 'hello' })
    const bank = makeBank({ id: 'export-me', words: [word] })
    await saveWordBank(bank)

    const json = await exportWordBankToJson('export-me')
    const parsed = JSON.parse(json)
    expect(parsed.length).toBe(1)
    expect(parsed[0].text).toBe('hello')
  })

  it('不存在的词库返回空字符串', async () => {
    const json = await exportWordBankToJson('nonexistent')
    expect(json).toBe('')
  })
})

// ==================== getAllWordBankMetas ====================
describe('getAllWordBankMetas', () => {
  it('返回 meta 列表且不包含 words 字段、不读取任何分片', async () => {
    seedBanks([{ id: 'meta-bank', name: '元数据词库', words: [makeWord()] }])

    const metas = await getAllWordBankMetas()
    expect(metas.length).toBe(1)
    expect(metas[0].id).toBe('meta-bank')
    expect(metas[0].name).toBe('元数据词库')
    expect(metas[0]).not.toHaveProperty('words')

    const getIds = mockDbAdapter.get.mock.calls.map(([id]) => String(id))
    expect(getIds.every(i => !i.includes('slowly-record-wordbank-chunk-v2'))).toBe(true)
  })

  it('无数据时创建默认词库并返回其 meta', async () => {
    const metas = await getAllWordBankMetas()
    expect(metas.length).toBe(1)
    expect(metas[0].id).toBe('default')
    expect(metas[0].isDefault).toBe(true)
    // 默认词库的分片也应已创建
    expect(memoryDb['slowly-record-wordbank-chunk-v2:default:0']).toBeDefined()
  })
})

// ==================== saveWordBank 读写隔离 ====================
describe('saveWordBank 读写隔离', () => {
  it('只写目标词库分片，不读/写其他词库分片', async () => {
    seedBanks([
      { id: 'bank-a', words: [makeWord({ _id: 'a1', text: 'apple' })] },
      { id: 'bank-b', words: [makeWord({ _id: 'b1', text: 'banana' })] },
    ])

    const getCallsBefore = mockDbAdapter.get.mock.calls.length
    const putCallsBefore = mockDbAdapter.promises.put.mock.calls.length

    const bankA = makeBank({
      id: 'bank-a',
      words: [makeWord({ _id: 'a1', text: 'apple' }), makeWord({ _id: 'a2', text: 'avocado' })],
    })
    const success = await saveWordBank(bankA)
    expect(success).toBe(true)

    const getIds = mockDbAdapter.get.mock.calls.slice(getCallsBefore).map(([id]) => String(id))
    const putIds = mockDbAdapter.promises.put.mock.calls.slice(putCallsBefore).map(([doc]) => String(doc._id))
    // 不允许出现 bank-b 的分片读取与写入
    expect(getIds.filter(i => i.includes('slowly-record-wordbank-chunk-v2:bank-b'))).toEqual([])
    expect(putIds.filter(i => i.includes('slowly-record-wordbank-chunk-v2:bank-b'))).toEqual([])
    // 目标词库分片有写入
    expect(putIds).toContain('slowly-record-wordbank-chunk-v2:bank-a:0')
    // 其他词库数据完好
    expect(memoryDb['slowly-record-wordbank-chunk-v2:bank-b:0'].words[0].text).toBe('banana')
  })
})

// ==================== updateWordInBankChunk（分片 merge 写） ====================
describe('updateWordInBankChunk', () => {
  it('merge 写保留对方窗口刚写入的同分片其他单词进度', async () => {
    const w1 = makeWord({ _id: 'w1', text: 'hello', level: 3 })
    const w2 = makeWord({ _id: 'w2', text: 'world', level: 1 })
    seedBanks([{ id: 'bank-a', words: [w1, w2] }])

    // 模拟子窗口（专注浮窗）先写：读最新分片，更新 w1 的复习进度后带最新 _rev 写入
    const childChunk = mockDbAdapter.get('slowly-record-wordbank-chunk-v2:bank-a:0')
    const childResult = await mockDbAdapter.promises.put({
      ...childChunk,
      words: childChunk.words.map((w: any) => (w._id === 'w1' ? { ...w, level: 9, remember: true } : w)),
      updatedAt: Date.now(),
    })
    expect(childResult.ok).toBe(true)

    // 父窗口基于更旧的内存快照做复习更新（w2 升级），走 merge 写
    const ok = await updateWordInBankChunk('bank-a', { ...w2, level: 5 })
    expect(ok).toBe(true)

    const finalChunk = memoryDb['slowly-record-wordbank-chunk-v2:bank-a:0']
    const finalW1 = finalChunk.words.find((w: any) => w._id === 'w1')
    const finalW2 = finalChunk.words.find((w: any) => w._id === 'w2')
    // 对方窗口的 w1 进度保留，父窗口的 w2 更新生效，且无重复/丢词
    expect(finalW1.level).toBe(9)
    expect(finalW1.remember).toBe(true)
    expect(finalW2.level).toBe(5)
    expect(finalChunk.words.length).toBe(2)
  })

  it('put 冲突时重读重试，二次成功', async () => {
    seedBanks([{ id: 'bank-a', words: [makeWord({ _id: 'w1', text: 'hello', level: 1 })] }])

    // 首次 put 强制返回 conflict（模拟两窗口恰同刻写同一分片）
    mockDbAdapter.promises.put.mockImplementationOnce(async (doc: any) => ({ ok: false, message: 'conflict' }))

    const putCallsBefore = mockDbAdapter.promises.put.mock.calls.length
    const ok = await updateWordInBankChunk('bank-a', makeWord({ _id: 'w1', text: 'hello', level: 4 }))
    expect(ok).toBe(true)
    // 首次 conflict + 重试成功，共 2 次 put
    expect(mockDbAdapter.promises.put.mock.calls.length - putCallsBefore).toBe(2)

    const finalChunk = memoryDb['slowly-record-wordbank-chunk-v2:bank-a:0']
    expect(finalChunk.words.length).toBe(1)
    expect(finalChunk.words[0].level).toBe(4)
  })

  it('连续冲突超过重试上限后返回 false', async () => {
    seedBanks([{ id: 'bank-a', words: [makeWord({ _id: 'w1', text: 'hello' })] }])

    const basePut = async (doc: any) => putImpl(doc)
    mockDbAdapter.promises.put.mockImplementation(async (doc: any) => ({ ok: false, message: 'conflict' }))
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const ok = await updateWordInBankChunk('bank-a', makeWord({ _id: 'w1', text: 'hello', level: 4 }))
    expect(ok).toBe(false)

    mockDbAdapter.promises.put.mockImplementation(basePut)
    errSpy.mockRestore()
  })

  it('新词落入未满的最后一个分片', async () => {
    seedBanks([{ id: 'bank-a', words: [makeWord({ _id: 'w1', text: 'hello' }), makeWord({ _id: 'w2', text: 'world' })] }])

    const ok = await updateWordInBankChunk('bank-a', makeWord({ _id: 'w3', text: 'new word' }))
    expect(ok).toBe(true)

    const chunk0 = memoryDb['slowly-record-wordbank-chunk-v2:bank-a:0']
    expect(chunk0.words.length).toBe(3)
    expect(chunk0.words.map((w: any) => w._id)).toContain('w3')
    // 未新建分片
    expect(memoryDb['slowly-record-wordbank-chunk-v2:bank-a:1']).toBeUndefined()
  })

  it('最后一个分片已满时为新词新建分片', async () => {
    const many = Array.from({ length: 300 }, (_, i) => makeWord({ _id: `w${i}`, text: `word${i}` }))
    seedBanks([{ id: 'bank-full', words: many }])

    const ok = await updateWordInBankChunk('bank-full', makeWord({ _id: 'w300', text: 'extra' }))
    expect(ok).toBe(true)

    const chunk0 = memoryDb['slowly-record-wordbank-chunk-v2:bank-full:0']
    const chunk1 = memoryDb['slowly-record-wordbank-chunk-v2:bank-full:1']
    expect(chunk0.words.length).toBe(300)
    expect(chunk1).toBeDefined()
    expect(chunk1.chunkIndex).toBe(1)
    expect(chunk1.words.length).toBe(1)
    expect(chunk1.words[0]._id).toBe('w300')
  })

  it('无 _id 命中时按规范化文本定位并替换（不重复入库）', async () => {
    seedBanks([{ id: 'bank-a', words: [makeWord({ _id: 'w1', text: 'hello', level: 1 })] }])

    const ok = await updateWordInBankChunk('bank-a', makeWord({ _id: 'w-new', text: '  hello  ', level: 7 }))
    expect(ok).toBe(true)

    const chunk = memoryDb['slowly-record-wordbank-chunk-v2:bank-a:0']
    expect(chunk.words.length).toBe(1)
    expect(chunk.words[0]._id).toBe('w-new')
    expect(chunk.words[0].level).toBe(7)
    expect(chunk.words[0].text).toBe('hello')
  })

  it('词库无任何分片时创建第一个分片写入', async () => {
    seedBanks([{ id: 'empty-bank', words: [] }])
    // 移除空分片，模拟无任何分片文档的词库
    delete memoryDb['slowly-record-wordbank-chunk-v2:empty-bank:0']

    const ok = await updateWordInBankChunk('empty-bank', makeWord({ _id: 'w1', text: 'hello' }))
    expect(ok).toBe(true)

    const chunk0 = memoryDb['slowly-record-wordbank-chunk-v2:empty-bank:0']
    expect(chunk0).toBeDefined()
    expect(chunk0.words.length).toBe(1)
    expect(chunk0.words[0]._id).toBe('w1')
  })
})
