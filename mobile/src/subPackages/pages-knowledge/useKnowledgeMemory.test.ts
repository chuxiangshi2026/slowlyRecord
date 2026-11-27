/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { MiniProgramDbAdapter, setDbAdapter, resetDbAdapter, getDbAdapter } from '@/adapters/index'

// 移动端 store 以 `@/utils/*` 引用同目录移动端实现；vitest 的通用别名会兜底到桌面端
// （桌面端没有 answer-tokens 模块），因此这里显式把三个 specifier 指回 mobile/src。
vi.mock('@/utils/knowledge-memory-srs', () => import('../../utils/knowledge-memory-srs'))
vi.mock('@/utils/knowledge-memory-db', () => import('../../utils/knowledge-memory-db'))
vi.mock('@/utils/answer-tokens', () => import('../../utils/answer-tokens'))

const mockStorage = new Map<string, any>()
;(global as any).uni = {
  setStorageSync: vi.fn((key: string, data: any) => { mockStorage.set(key, data) }),
  getStorageSync: vi.fn((key: string) => mockStorage.get(key) ?? null),
  removeStorageSync: vi.fn((key: string) => { mockStorage.delete(key) }),
  getStorageInfoSync: vi.fn(() => ({
    keys: Array.from(mockStorage.keys()),
    currentSize: 0,
    limitSize: 10240,
  })),
}

import { useKnowledgeMemory, normalizeAnswer } from './useKnowledgeMemory'
import { registerKnowledgePackData, clearKnowledgePackCache } from './utils/knowledge-pack-loader'
import type { KnowledgePack, KnowledgePackProgressDoc } from '@/stores/useUtils/types'
import { createDefaultProgress } from '../../utils/knowledge-memory-srs'

const PACK_ID = 'test-pack'
const PROGRESS_DOC_ID = 'knowledge_memory_' + PACK_ID

function makePack(overrides: Partial<KnowledgePack> = {}): KnowledgePack {
  return {
    id: PACK_ID,
    name: '测试知识包',
    description: '',
    ordered: false,
    usableAsPeg: false,
    items: [
      { id: 'i1', question: '1+1', answer: '2' },
      { id: 'i2', question: '1+2', answer: '3' },
      { id: 'i3', question: '1+3', answer: '4' },
      { id: 'i4', question: '1+4', answer: '5' },
      { id: 'i5', question: '1+5', answer: '6' },
    ],
    ...overrides,
  }
}

function putProgressDoc(items: Record<string, any>, packId: string = PACK_ID): void {
  const doc: KnowledgePackProgressDoc = {
    _id: 'knowledge_memory_' + packId,
    _rev: '1-abc',
    type: 'knowledge_pack_progress',
    packId,
    items,
  }
  getDbAdapter().put(doc)
}

/** 重新进入页面：新 pinia 实例 + loadPack 从存储读回 */
async function reopen(packId: string = PACK_ID) {
  setActivePinia(createPinia())
  const store = useKnowledgeMemory()
  await store.loadPack(packId)
  return store
}

describe('useKnowledgeMemory：加载与进度', () => {
  beforeEach(() => {
    mockStorage.clear()
    setActivePinia(createPinia())
    setDbAdapter(new MiniProgramDbAdapter())
    clearKnowledgePackCache()
    registerKnowledgePackData({ [PACK_ID]: () => makePack() })
  })

  afterEach(() => {
    resetDbAdapter()
  })

  it('loadPack 加载包内容与空白进度', async () => {
    const store = useKnowledgeMemory()
    expect(store.loading).toBe(false)
    await store.loadPack(PACK_ID)

    expect(store.loading).toBe(false)
    expect(store.isPackLoaded(PACK_ID)).toBe(true)
    expect(store.getTotalCount(PACK_ID)).toBe(5)
    expect(store.getProgress(PACK_ID)).toMatchObject({ packId: PACK_ID, items: {} })
    expect(store.getItemProgress(PACK_ID, 'i1')).toEqual(createDefaultProgress('i1'))
    expect(store.getMasteredCount(PACK_ID)).toBe(0)
    // 全部未学过 → 全部到期
    expect(store.getDueCount(PACK_ID)).toBe(5)
  })

  it('getTotalCount / getMasteredCount / getDueCount 对未加载包返回 0', () => {
    const store = useKnowledgeMemory()
    expect(store.getTotalCount('nope')).toBe(0)
    expect(store.getMasteredCount('nope')).toBe(0)
    expect(store.getDueCount('nope')).toBe(0)
  })

  it('markItem 答对/答错写入内存并持久化', async () => {
    const store = useKnowledgeMemory()
    await store.loadPack(PACK_ID)

    const now = Date.now()
    const correct = store.markItem(PACK_ID, 'i1', true, now)
    expect(correct).toMatchObject({ itemId: 'i1', level: 1, correct: 1, wrong: 0, learnDate: now })

    const wrong = store.markItem(PACK_ID, 'i2', false, now)
    // 0 级答错降 4 级、下限 1
    expect(wrong).toMatchObject({ itemId: 'i2', level: 1, correct: 0, wrong: 1, learnDate: now })

    // 新实例从存储读回
    const reopened = await reopen()
    expect(reopened.getItemProgress(PACK_ID, 'i1').level).toBe(1)
    expect(reopened.getItemProgress(PACK_ID, 'i2').wrong).toBe(1)
  })

  it('已掌握与到期统计：满级且未到期不计入到期', async () => {
    putProgressDoc({
      i1: { ...createDefaultProgress('i1'), level: 12, learnDate: Date.now() },
    })
    const store = await reopen()
    expect(store.getMasteredCount(PACK_ID)).toBe(1)
    // 其余 4 条无进度 → 到期
    expect(store.getDueCount(PACK_ID)).toBe(4)
  })
})

describe('useKnowledgeMemory：已导入清单', () => {
  beforeEach(() => {
    mockStorage.clear()
    setActivePinia(createPinia())
    setDbAdapter(new MiniProgramDbAdapter())
    clearKnowledgePackCache()
    registerKnowledgePackData({ [PACK_ID]: () => makePack() })
  })

  afterEach(() => {
    resetDbAdapter()
  })

  it('loadImportedIds 读取清单，并兼容「有进度文档但不在清单」的老用户', async () => {
    // 老用户：真实内置包存在进度文档，但清单为空
    putProgressDoc({ i1: createDefaultProgress('i1') }, 'multiplication-9x9')

    const store = useKnowledgeMemory()
    store.loadImportedIds()

    expect(store.importedLoaded).toBe(true)
    expect(store.importedIds).toContain('multiplication-9x9')
    // 自动补写回清单
    expect(getDbAdapter().get('knowledge_memory_imported')?.ids).toContain('multiplication-9x9')
  })

  it('importPack 加入清单并加载包；重复导入幂等', async () => {
    const store = useKnowledgeMemory()
    store.loadImportedIds()
    expect(store.isPackImported(PACK_ID)).toBe(false)

    await store.importPack(PACK_ID)
    expect(store.isPackImported(PACK_ID)).toBe(true)
    expect(store.isPackLoaded(PACK_ID)).toBe(true)
    expect(getDbAdapter().get('knowledge_memory_imported')?.ids).toEqual([PACK_ID])

    await store.importPack(PACK_ID)
    expect(store.importedIds).toEqual([PACK_ID])
  })

  it('removeImportedPack 只下架，不删除进度文档', async () => {
    const store = useKnowledgeMemory()
    await store.importPack(PACK_ID)
    store.markItem(PACK_ID, 'i1', true, 1_000)

    store.removeImportedPack(PACK_ID)
    expect(store.importedIds).toEqual([])
    expect(getDbAdapter().get('knowledge_memory_imported')?.ids).toEqual([])

    // 进度文档仍在，重新导入后进度恢复
    const reopened = await reopen()
    expect(reopened.getItemProgress(PACK_ID, 'i1').level).toBe(1)
  })

  it('resetPackProgress 清空内存与已有文档', async () => {
    putProgressDoc({ i1: { ...createDefaultProgress('i1'), level: 5, learnDate: 1 } })
    const store = await reopen()
    expect(store.getItemProgress(PACK_ID, 'i1').level).toBe(5)

    store.resetPackProgress(PACK_ID)
    expect(store.getProgress(PACK_ID).items).toEqual({})
    expect((getDbAdapter().get(PROGRESS_DOC_ID) as any)?.items).toEqual({})
  })
})

describe('useKnowledgeMemory：抽题优先级', () => {
  beforeEach(() => {
    mockStorage.clear()
    setActivePinia(createPinia())
    setDbAdapter(new MiniProgramDbAdapter())
    clearKnowledgePackCache()
    registerKnowledgePackData({ [PACK_ID]: () => makePack() })
  })

  afterEach(() => {
    resetDbAdapter()
  })

  it('按「已到期 → 未练过 → 其他」分组，组内随机', async () => {
    const now = Date.now()
    putProgressDoc({
      // 已到期：0 级 2 分钟前学过
      i1: { ...createDefaultProgress('i1'), level: 0, learnDate: now - 2 * 60 * 1000 },
      // 未到期：5 级刚学过
      i3: { ...createDefaultProgress('i3'), level: 5, learnDate: now },
      // learnDate 为 0 视为未练过
      i4: createDefaultProgress('i4'),
    })
    const store = await reopen()

    const picked = store.pickItemsForSession(PACK_ID, 5)
    expect(picked).toHaveLength(5)
    expect(picked[0].id).toBe('i1')
    expect(picked[picked.length - 1].id).toBe('i3')
    expect(new Set(picked.slice(1, 4).map(i => i.id))).toEqual(new Set(['i2', 'i4', 'i5']))
  })

  it('数量受 count 控制，最小 1；未加载包返回空', async () => {
    const store = await reopen()
    expect(store.pickItemsForSession(PACK_ID, 2)).toHaveLength(2)
    expect(store.pickItemsForSession(PACK_ID, 0)).toHaveLength(1)
    expect(store.pickItemsForSession('nope', 3)).toEqual([])
  })
})

describe('useKnowledgeMemory：选项与碎片生成', () => {
  beforeEach(() => {
    mockStorage.clear()
    setActivePinia(createPinia())
    setDbAdapter(new MiniProgramDbAdapter())
    clearKnowledgePackCache()
  })

  afterEach(() => {
    resetDbAdapter()
  })

  it('generateChoices 返回去重后的正确答案 + 干扰项', async () => {
    registerKnowledgePackData({
      [PACK_ID]: () => makePack({
        items: [
          { id: 'n1', question: 'Q1', answer: '8' },
          { id: 'n2', question: 'Q2', answer: '9' },
          { id: 'n3', question: 'Q3', answer: '88' },
          { id: 'n4', question: 'Q4', answer: '８' }, // 归一化后与正确答案重复
          { id: 'n5', question: 'Q5', answer: 'hello' },
        ],
      }),
    })
    const store = await reopen(PACK_ID)
    const pack = store.getPack(PACK_ID)!

    const options = store.generateChoices(PACK_ID, pack.items[0], 3)
    expect(options).toHaveLength(3)
    expect(new Set(options).size).toBe(3)
    expect(options).toContain('8')
    // 相似度最高的两个：9、88
    expect(new Set(options)).toEqual(new Set(['8', '9', '88']))
  })

  it('generateChoices 对元素包按序数距离挑选', async () => {
    registerKnowledgePackData({
      [PACK_ID]: () => makePack({
        items: [
          { id: 'e8', question: '8 号', answer: '氧', extras: { 序数: '8' } },
          { id: 'e9', question: '9 号', answer: '氟', extras: { 序数: '9' } },
          { id: 'e1', question: '1 号', answer: '氢', extras: { 序数: '1' } },
          { id: 'e2', question: '2 号', answer: '氦', extras: { 序数: '2' } },
        ],
      }),
    })
    const store = await reopen(PACK_ID)
    const pack = store.getPack(PACK_ID)!
    const options = store.generateChoices(PACK_ID, pack.items[0], 2)
    expect(new Set(options)).toEqual(new Set(['氧', '氟']))
  })

  it('generateChoices 包未加载时只返回正确答案', () => {
    const store = useKnowledgeMemory()
    expect(store.generateChoices('nope', { id: 'x', question: 'q', answer: '答案' })).toEqual(['答案'])
  })

  it('generateFragments 包含全部正确 token 与干扰碎片，id 唯一', async () => {
    registerKnowledgePackData({
      [PACK_ID]: () => makePack({
        items: [
          { id: 'f1', question: 'Q1', answer: 'abc' },
          { id: 'f2', question: 'Q2', answer: 'de' },
          { id: 'f3', question: 'Q3', answer: 'fg' },
        ],
      }),
    })
    const store = await reopen(PACK_ID)
    const pack = store.getPack(PACK_ID)!

    const tiles = store.generateFragments(PACK_ID, pack.items[0])
    const texts = tiles.map(t => t.text)
    expect(tiles.length).toBeGreaterThanOrEqual(5) // 3 正确 + 2~3 干扰
    expect(tiles.length).toBeLessThanOrEqual(6)
    expect(new Set(tiles.map(t => t.id)).size).toBe(tiles.length)
    expect([...tiles.map(t => t.id)].sort((a, b) => a - b)).toEqual(tiles.map((_, i) => i))
    for (const token of ['a', 'b', 'c']) {
      expect(texts).toContain(token)
    }
    // 干扰碎片来自同包其他答案
    expect(texts.filter(t => 'defg'.includes(t))).toHaveLength(tiles.length - 3)
  })

  it('generateFragments 包未加载时只返回正确 token', () => {
    const store = useKnowledgeMemory()
    const tiles = store.generateFragments('nope', { id: 'x', question: 'q', answer: 'ab' })
    expect(tiles.map(t => t.text).sort()).toEqual(['a', 'b'])
  })
})

describe('normalizeAnswer', () => {
  it('全角数字/字母转半角、转小写、空白折叠并去除首尾', () => {
    expect(normalizeAnswer('ＡＢＣ１２３')).toBe('abc123')
    expect(normalizeAnswer('  Hello   World  ')).toBe('hello world')
    expect(normalizeAnswer('中文　全角空格')).toBe('中文 全角空格')
  })
})
