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

// 内存数据库模拟
let memoryDb: Record<string, any> = {}
let memCounter = 0

function nextRev() {
  return String(++memCounter) + '-rev'
}

const mockDbAdapter = {
  get: vi.fn((id: string) => {
    const doc = memoryDb[id]
    return doc ? { ...doc } : null
  }),
  put: vi.fn((doc: any) => {
    if (doc._id) {
      if (!doc._rev) doc._rev = nextRev()
      memoryDb[doc._id] = { ...doc }
    }
    return { ok: true, id: doc._id || '', rev: doc._rev }
  }),
  remove: vi.fn((doc: { _id: string; _rev: string }) => {
    delete memoryDb[doc._id]
    return { ok: true, id: doc._id }
  }),
  allDocs: vi.fn(() => {
    return Object.values(memoryDb).map(doc => ({ ...doc }))
  }),
  bulkDocs: vi.fn(() => []),
  promises: {
    get: vi.fn(async (id: string) => {
      const doc = memoryDb[id]
      return doc ? { ...doc } : null
    }),
    put: vi.fn(async (doc: any) => {
      if (doc._id) {
        if (!doc._rev) doc._rev = nextRev()
        memoryDb[doc._id] = { ...doc }
      }
      return { ok: true, id: doc._id || '', rev: doc._rev }
    }),
    remove: vi.fn(async (doc: { _id: string; _rev: string }) => {
      delete memoryDb[doc._id]
      return { ok: true, id: doc._id }
    }),
    bulkDocs: vi.fn(async () => []),
  },
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
  getCurrentWordBankId,
  setCurrentWordBankId,
  createWordBank,
  saveWordBank,
  getWordBank,
  deleteWordBank,
  updateWordBankName,
  updateWordBankWords,
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
    const defaultBank = createDefaultWordBank()
    const { words: _, ...meta } = defaultBank
    memoryDb['slowly-record-wordbank-meta-v2'] = {
      _id: 'slowly-record-wordbank-meta-v2',
      type: 'wordbank-meta',
      banks: [meta],
      updatedAt: Date.now()
    }
    memoryDb['slowly-record-wordbank-chunk-v2:default:0'] = {
      _id: 'slowly-record-wordbank-chunk-v2:default:0',
      type: 'wordbank-chunk',
      bankId: 'default',
      chunkIndex: 0,
      totalChunks: 1,
      words: [],
      updatedAt: Date.now()
    }

    const id = await getCurrentWordBankId()
    expect(id).toBe('default')
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
    const bank = makeBank({ id: 'custom-1', name: '自定义词库' })
    const { words: _, ...meta } = bank
    memoryDb['slowly-record-wordbank-meta-v2'] = {
      _id: 'slowly-record-wordbank-meta-v2',
      type: 'wordbank-meta',
      banks: [meta],
      updatedAt: Date.now()
    }
    // 词库数据分片
    memoryDb['slowly-record-wordbank-chunk-v2:custom-1:0'] = {
      _id: 'slowly-record-wordbank-chunk-v2:custom-1:0',
      type: 'wordbank-chunk',
      bankId: 'custom-1',
      chunkIndex: 0,
      totalChunks: 1,
      words: bank.words,
      updatedAt: Date.now()
    }

    const banks = await getAllWordBanks()
    expect(banks.length).toBe(1)
    expect(banks[0].name).toBe('自定义词库')
    expect(banks[0].words.length).toBe(2)
  })

  it('迁移：将"我的词库"重命名为"默认词库"', async () => {
    const bank = makeBank({ id: 'old-1', name: '我的词库', isDefault: true })
    const { words: _, ...meta } = bank
    memoryDb['slowly-record-wordbank-meta-v2'] = {
      _id: 'slowly-record-wordbank-meta-v2',
      type: 'wordbank-meta',
      banks: [{ ...meta, name: '我的词库' }],
      updatedAt: Date.now()
    }
    memoryDb['slowly-record-wordbank-chunk-v2:old-1:0'] = {
      _id: 'slowly-record-wordbank-chunk-v2:old-1:0',
      type: 'wordbank-chunk',
      bankId: 'old-1',
      chunkIndex: 0,
      totalChunks: 1,
      words: bank.words,
      updatedAt: Date.now()
    }

    const banks = await getAllWordBanks()
    expect(banks.length).toBe(1)
    expect(banks[0].name).toBe('默认词库')
  })

  it('迁移：将"基础词库"重命名为"默认词库"', async () => {
    const bank = makeBank({ id: 'old-2', name: '基础词库', isDefault: true })
    const { words: _, ...meta } = bank
    memoryDb['slowly-record-wordbank-meta-v2'] = {
      _id: 'slowly-record-wordbank-meta-v2',
      type: 'wordbank-meta',
      banks: [{ ...meta, name: '基础词库' }],
      updatedAt: Date.now()
    }
    memoryDb['slowly-record-wordbank-chunk-v2:old-2:0'] = {
      _id: 'slowly-record-wordbank-chunk-v2:old-2:0',
      type: 'wordbank-chunk',
      bankId: 'old-2',
      chunkIndex: 0,
      totalChunks: 1,
      words: bank.words,
      updatedAt: Date.now()
    }

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
