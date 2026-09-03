import {describe, it, expect, beforeEach, vi} from 'vitest'
import {setActivePinia, createPinia} from 'pinia'
import {useKnowledgeMemoryStore} from './knowledgeMemory'
import type {KnowledgePack, KnowledgePackProgressDoc, KnowledgeCustomItem} from '@/types/knowledge-memory'

vi.mock('@/stores/words', () => ({
  useWordsStore: vi.fn(() => ({ memoryFirmness: '正常' }))
}))

const mockPack: KnowledgePack = {
  id: 'test-pack',
  name: '测试知识包',
  description: '用于测试',
  ordered: true,
  usableAsPeg: false,
  items: [
    {id: 'item-a', question: 'A', answer: '1', order: 1},
    {id: 'item-b', question: 'B', answer: '2', order: 2},
    {id: 'item-c', question: 'C', answer: '3', order: 3},
  ],
}

vi.mock('@/utils/knowledge-pack-service', () => ({
  fetchKnowledgePack: vi.fn(async () => mockPack),
  listKnowledgePacks: vi.fn(() => [
    {id: 'test-pack', name: '测试知识包', description: '用于测试', itemCount: 3, ordered: true, usableAsPeg: false},
  ]),
  getKnowledgePackInfo: vi.fn(),
  isKnowledgePackCached: vi.fn(() => false),
  clearKnowledgePackCache: vi.fn(),
}))

let savedProgress: KnowledgePackProgressDoc | null = null
// 已导入清单与"已有进度文档"的可控模拟数据
let importedIdsData: string[] = []
let progressExisting = new Set<string>()
// 自建知识条目的可控模拟数据（单文档整体覆盖写模式）
let customItemsData: KnowledgeCustomItem[] = []
vi.mock('@/utils/knowledge-memory-db', () => ({
  getProgressDoc: vi.fn((packId: string) => ({
    _id: progressExisting.has(packId) ? `knowledge_memory_${packId}` : '',
    _rev: progressExisting.has(packId) ? '1-rev' : undefined,
    type: 'knowledge_pack_progress' as const,
    packId,
    items: {},
  })),
  saveProgressDoc: vi.fn(async (doc: KnowledgePackProgressDoc) => {
    savedProgress = {...doc, _rev: '1-rev'}
  }),
  getImportedIds: vi.fn(() => [...importedIdsData]),
  addImportedId: vi.fn(async (id: string) => {
    if (!importedIdsData.includes(id)) importedIdsData.push(id)
  }),
  removeImportedId: vi.fn(async (id: string) => {
    importedIdsData = importedIdsData.filter(x => x !== id)
  }),
  hasProgressDoc: vi.fn((packId: string) => progressExisting.has(packId)),
  getCustomItems: vi.fn(() => [...customItemsData]),
  saveCustomItems: vi.fn(async (items: KnowledgeCustomItem[]) => {
    customItemsData = [...items]
  }),
  removeCustomItem: vi.fn(async (itemId: string) => {
    const target = customItemsData.find(i => i.id === itemId)
    if (!target) return undefined
    customItemsData = customItemsData.filter(i => i.id !== itemId)
    return target
  }),
  clearProgressDoc: vi.fn(async () => {}),
}))

vi.mock('@/adapters/db', () => ({
  getDbAdapterAsync: vi.fn(async () => ({})),
}))

vi.mock('@/utils/logger', () => ({
  log: {i: vi.fn(), w: vi.fn(), e: vi.fn()},
}))

import {fetchKnowledgePack, listKnowledgePacks} from '@/utils/knowledge-pack-service'
import {getProgressDoc, saveProgressDoc, addImportedId, removeImportedId, clearProgressDoc} from '@/utils/knowledge-memory-db'

function normalizeForTest(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim()
}

describe('useKnowledgeMemoryStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    savedProgress = null
    importedIdsData = []
    progressExisting = new Set()
    customItemsData = []
    vi.resetAllMocks()
  })

  describe('初始状态', () => {
    it('packList 应从服务获取', () => {
      const store = useKnowledgeMemoryStore()
      expect(store.packList).toHaveLength(1)
      expect(listKnowledgePacks).toHaveBeenCalled()
    })

    it('未加载的包不存在', () => {
      const store = useKnowledgeMemoryStore()
      expect(store.isPackLoaded('test-pack')).toBe(false)
      expect(store.getPack('test-pack')).toBeUndefined()
    })
  })

  describe('loadPack', () => {
    it('应加载包内容和进度', async () => {
      const store = useKnowledgeMemoryStore()
      await store.loadPack('test-pack')
      expect(fetchKnowledgePack).toHaveBeenCalledWith('test-pack')
      expect(getProgressDoc).toHaveBeenCalledWith('test-pack')
      expect(store.isPackLoaded('test-pack')).toBe(true)
      expect(store.getPack('test-pack')?.items).toHaveLength(3)
    })
  })

  describe('统计', () => {
    it('应返回总数', async () => {
      const store = useKnowledgeMemoryStore()
      await store.loadPack('test-pack')
      expect(store.getTotalCount('test-pack')).toBe(3)
    })

    it('应统计已掌握条目', async () => {
      const store = useKnowledgeMemoryStore()
      await store.loadPack('test-pack')
      // 人为写入 12 级进度
      store.progress['test-pack'].items['item-a'] = {itemId: 'item-a', level: 12, learnDate: Date.now(), correct: 1, wrong: 0}
      expect(store.getMasteredCount('test-pack')).toBe(1)
    })

    it('应统计到期条目', async () => {
      const store = useKnowledgeMemoryStore()
      await store.loadPack('test-pack')
      store.progress['test-pack'].items['item-a'] = {itemId: 'item-a', level: 1, learnDate: 0, correct: 0, wrong: 0}
      expect(store.getDueCount('test-pack')).toBeGreaterThan(0)
    })
  })

  describe('pickItemsForSession', () => {
    it('未加载时返回空数组', () => {
      const store = useKnowledgeMemoryStore()
      expect(store.pickItemsForSession('test-pack', 5)).toEqual([])
    })

    it('应返回不超过条目总数的列表', async () => {
      const store = useKnowledgeMemoryStore()
      await store.loadPack('test-pack')
      const items = store.pickItemsForSession('test-pack', 10)
      expect(items.length).toBe(3)
    })

    it('应返回不重复的条目', async () => {
      const store = useKnowledgeMemoryStore()
      await store.loadPack('test-pack')
      const items = store.pickItemsForSession('test-pack', 10)
      const ids = items.map(i => i.id)
      expect(new Set(ids).size).toBe(ids.length)
    })
  })

  describe('judgeAnswer', () => {
    it('q2a 模式应比较 answer', async () => {
      const store = useKnowledgeMemoryStore()
      await store.loadPack('test-pack')
      const item = store.getPack('test-pack')!.items[0]
      expect(store.judgeAnswer('test-pack', item, '1', 'q2a')).toBe(true)
      expect(store.judgeAnswer('test-pack', item, '2', 'q2a')).toBe(false)
    })

    it('a2q 模式应比较 question', async () => {
      const store = useKnowledgeMemoryStore()
      await store.loadPack('test-pack')
      const item = store.getPack('test-pack')!.items[0]
      expect(store.judgeAnswer('test-pack', item, 'A', 'a2q')).toBe(true)
      expect(store.judgeAnswer('test-pack', item, '1', 'a2q')).toBe(false)
    })

    it('应忽略大小写与多余空白', async () => {
      const store = useKnowledgeMemoryStore()
      await store.loadPack('test-pack')
      const item = store.getPack('test-pack')!.items[0]
      expect(store.judgeAnswer('test-pack', item, '  1  ', 'q2a')).toBe(true)
    })

    it('应把全角数字/字母当作半角判定', async () => {
      const store = useKnowledgeMemoryStore()
      await store.loadPack('test-pack')
      const item = store.getPack('test-pack')!.items[0]
      expect(store.judgeAnswer('test-pack', item, '１', 'q2a')).toBe(true)
      expect(store.judgeAnswer('test-pack', item, 'Ａ', 'a2q')).toBe(true)
    })
  })

  describe('markItem', () => {
    it('答对应升级并持久化', async () => {
      const store = useKnowledgeMemoryStore()
      await store.loadPack('test-pack')
      const result = await store.markItem('test-pack', 'item-a', true)
      expect(result.ok).toBe(true)
      expect(result.progress.level).toBe(1)
      expect(result.progress.correct).toBe(1)
      expect(saveProgressDoc).toHaveBeenCalled()
      expect(savedProgress?.items['item-a'].level).toBe(1)
    })

    it('答错应降级并持久化', async () => {
      const store = useKnowledgeMemoryStore()
      await store.loadPack('test-pack')
      // 先设置为 5 级
      store.progress['test-pack'].items['item-a'] = {itemId: 'item-a', level: 5, learnDate: 0, correct: 0, wrong: 0}
      const result = await store.markItem('test-pack', 'item-a', false)
      expect(result.progress.level).toBe(4)
      expect(result.progress.wrong).toBe(1)
    })

    it('未加载的包应返回失败', async () => {
      const store = useKnowledgeMemoryStore()
      const result = await store.markItem('unknown', 'item-a', true)
      expect(result.ok).toBe(false)
    })
  })

  describe('generateChoices', () => {
    it('应包含正确答案且不超出请求数量', async () => {
      const store = useKnowledgeMemoryStore()
      await store.loadPack('test-pack')
      const item = store.getPack('test-pack')!.items[0]
      const choices = store.generateChoices('test-pack', item, 'q2a', 4)
      expect(choices.length).toBeLessThanOrEqual(4)
      expect(choices).toContain(item.answer)
    })

    it('a2q 模式选项应基于 question', async () => {
      const store = useKnowledgeMemoryStore()
      await store.loadPack('test-pack')
      const item = store.getPack('test-pack')!.items[0]
      const choices = store.generateChoices('test-pack', item, 'a2q', 4)
      expect(choices).toContain(item.question)
    })

    it('归一化后相同的答案应去重', async () => {
      const dedupPack: KnowledgePack = {
        ...mockPack,
        id: 'dedup-pack',
        items: [
          {id: 'item-1', question: 'Q1', answer: '12'},
          {id: 'item-2', question: 'Q2', answer: '  12  '},
          {id: 'item-3', question: 'Q3', answer: '34'},
          {id: 'item-4', question: 'Q4', answer: '56'},
        ],
      }
      ;(fetchKnowledgePack as any).mockResolvedValueOnce(dedupPack)
      const store = useKnowledgeMemoryStore()
      await store.loadPack('dedup-pack')
      const item = store.getPack('dedup-pack')!.items[0]
      const choices = store.generateChoices('dedup-pack', item, 'q2a', 4)
      // 正确答案 + 2 个不重复干扰项 = 3 个，不会把两个 "12" 都加进来
      expect(choices).toContain('12')
      expect(new Set(choices.map(normalizeForTest)).size).toBe(choices.length)
      expect(choices.length).toBe(3)
    })
  })

  describe('getPreviousOrderedItem', () => {
    it('应返回前一项', async () => {
      const store = useKnowledgeMemoryStore()
      await store.loadPack('test-pack')
      const current = store.getPack('test-pack')!.items[1]
      const prev = store.getPreviousOrderedItem('test-pack', current)
      expect(prev?.id).toBe('item-a')
    })

    it('第一项无前项', async () => {
      const store = useKnowledgeMemoryStore()
      await store.loadPack('test-pack')
      const current = store.getPack('test-pack')!.items[0]
      expect(store.getPreviousOrderedItem('test-pack', current)).toBeUndefined()
    })
  })

  describe('已导入清单', () => {
    it('loadImportedIds 应读取清单并标记已加载', async () => {
      importedIdsData = ['test-pack']
      const store = useKnowledgeMemoryStore()
      expect(store.importedLoaded).toBe(false)
      await store.loadImportedIds()
      expect(store.importedIds).toEqual(['test-pack'])
      expect(store.importedLoaded).toBe(true)
      expect(store.isPackImported('test-pack')).toBe(true)
      expect(store.isPackImported('other')).toBe(false)
    })

    it('已有进度文档的包应自动并入清单', async () => {
      importedIdsData = []
      progressExisting.add('test-pack')
      const store = useKnowledgeMemoryStore()
      await store.loadImportedIds()
      expect(store.importedIds).toContain('test-pack')
      expect(addImportedId).toHaveBeenCalledWith('test-pack')
      expect(importedIdsData).toContain('test-pack')
    })

    it('无清单且无进度文档时清单为空', async () => {
      const store = useKnowledgeMemoryStore()
      await store.loadImportedIds()
      expect(store.importedIds).toEqual([])
      expect(addImportedId).not.toHaveBeenCalled()
    })

    it('importPack 应加入清单并加载包，重复导入幂等', async () => {
      const store = useKnowledgeMemoryStore()
      await store.importPack('test-pack')
      expect(store.importedIds).toContain('test-pack')
      expect(importedIdsData).toContain('test-pack')
      expect(store.isPackLoaded('test-pack')).toBe(true)
      await store.importPack('test-pack')
      expect(store.importedIds.filter(id => id === 'test-pack')).toHaveLength(1)
    })

    it('removeImportedPack 应下架但保留进度文档', async () => {
      importedIdsData = ['test-pack']
      progressExisting.add('test-pack')
      const store = useKnowledgeMemoryStore()
      await store.loadImportedIds()
      await store.loadPack('test-pack')
      await store.removeImportedPack('test-pack')
      expect(store.importedIds).toEqual([])
      expect(removeImportedId).toHaveBeenCalledWith('test-pack')
      expect(importedIdsData).toEqual([])
      // 已加载的包与进度仍在内存中，进度文档未被删除
      expect(store.isPackLoaded('test-pack')).toBe(true)
      expect(store.getProgress('test-pack').packId).toBe('test-pack')
    })
  })

  describe('自建知识集', () => {
    it('customPackList 应按 setName 分组，空 setName 归入「自建条目」', () => {
      const store = useKnowledgeMemoryStore()
      store.customItems = [
        {id: 'c1', setName: '古诗', question: 'Q1', answer: 'A1', ctime: 1},
        {id: 'c2', setName: '古诗', question: 'Q2', answer: 'A2', ctime: 2},
        {id: 'c3', question: 'Q3', answer: 'A3', ctime: 3},
      ]
      const list = store.customPackList
      expect(list).toHaveLength(2)
      expect(list.find(p => p.id === 'custom_古诗')).toMatchObject({
        name: '古诗',
        description: '手动添加的自建条目',
        itemCount: 2,
        ordered: false,
        usableAsPeg: false,
        category: 'text',
      })
      expect(list.find(p => p.id === 'custom_自建条目')?.itemCount).toBe(1)
    })

    it('loadPack 加载 custom_ 包时不走内置包服务，按组内条目合成', async () => {
      customItemsData = [
        {id: 'c1', setName: '古诗', question: '床前明月光', answer: '疑是地上霜', ctime: 1},
        {id: 'c2', setName: '古诗', question: '春眠不觉晓', answer: '处处闻啼鸟', ctime: 2},
        {id: 'c3', setName: '其他', question: 'Q', answer: 'A', ctime: 3},
      ]
      const store = useKnowledgeMemoryStore()
      await store.loadPack('custom_古诗')
      expect(fetchKnowledgePack).not.toHaveBeenCalled()
      const pack = store.getPack('custom_古诗')!
      expect(pack.name).toBe('古诗')
      expect(pack.ordered).toBe(false)
      expect(pack.items).toHaveLength(2)
      expect(pack.items[0]).toMatchObject({id: 'c1', question: '床前明月光', answer: '疑是地上霜', order: 1})
      expect(pack.items[1]).toMatchObject({id: 'c2', order: 2})
      expect(store.isPackLoaded('custom_古诗')).toBe(true)
      expect(getProgressDoc).toHaveBeenCalledWith('custom_古诗')
      // loadPack 会同步刷新内存中的自建条目
      expect(store.customItems).toHaveLength(3)
    })

    it('空 setName 的条目可通过默认分组包加载', async () => {
      customItemsData = [{id: 'c1', question: 'Q', answer: 'A', ctime: 1}]
      const store = useKnowledgeMemoryStore()
      await store.loadPack('custom_自建条目')
      expect(store.getPack('custom_自建条目')?.items).toHaveLength(1)
    })

    it('addCustomItem 追加条目并使对应自建集缓存失效', async () => {
      customItemsData = [{id: 'c1', setName: '古诗', question: 'Q', answer: 'A', ctime: 1}]
      const store = useKnowledgeMemoryStore()
      await store.loadPack('custom_古诗')
      expect(store.isPackLoaded('custom_古诗')).toBe(true)
      await store.addCustomItem({setName: '古诗', question: 'Q2', answer: 'A2'})
      expect(customItemsData).toHaveLength(2)
      expect(store.customItems).toHaveLength(2)
      expect(store.isPackLoaded('custom_古诗')).toBe(false)
      expect(store.getPack('custom_古诗')).toBeUndefined()
    })

    it('removeCustomItem 删除条目并失效自建集缓存，不存在的条目为空操作', async () => {
      customItemsData = [
        {id: 'c1', setName: '古诗', question: 'Q1', answer: 'A1', ctime: 1},
        {id: 'c2', setName: '古诗', question: 'Q2', answer: 'A2', ctime: 2},
      ]
      const store = useKnowledgeMemoryStore()
      await store.loadPack('custom_古诗')
      await store.removeCustomItem('c1')
      expect(customItemsData.map(i => i.id)).toEqual(['c2'])
      expect(store.customItems).toHaveLength(1)
      expect(store.isPackLoaded('custom_古诗')).toBe(false)
      await store.removeCustomItem('not-exist')
      expect(customItemsData).toHaveLength(1)
    })

    it('removeCustomSet 删除整集条目与进度文档，不影响其他集', async () => {
      customItemsData = [
        {id: 'c1', setName: '古诗', question: 'Q1', answer: 'A1', ctime: 1},
        {id: 'c2', setName: '古诗', question: 'Q2', answer: 'A2', ctime: 2},
        {id: 'c3', setName: '其他', question: 'Q3', answer: 'A3', ctime: 3},
      ]
      const store = useKnowledgeMemoryStore()
      await store.loadPack('custom_古诗')
      await store.removeCustomSet('古诗')
      expect(customItemsData.map(i => i.id)).toEqual(['c3'])
      expect(clearProgressDoc).toHaveBeenCalledWith('custom_古诗')
      expect(store.isPackLoaded('custom_古诗')).toBe(false)
      expect(store.customPackList.map(p => p.id)).toEqual(['custom_其他'])
    })
  })
})
