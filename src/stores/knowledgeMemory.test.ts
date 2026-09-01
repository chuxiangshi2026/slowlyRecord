import {describe, it, expect, beforeEach, vi} from 'vitest'
import {setActivePinia, createPinia} from 'pinia'
import {useKnowledgeMemoryStore} from './knowledgeMemory'
import type {KnowledgePack, KnowledgePackProgressDoc} from '@/types/knowledge-memory'

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
vi.mock('@/utils/knowledge-memory-db', () => ({
  getProgressDoc: vi.fn((packId: string) => ({
    _id: '',
    type: 'knowledge_pack_progress' as const,
    packId,
    items: {},
  })),
  saveProgressDoc: vi.fn(async (doc: KnowledgePackProgressDoc) => {
    savedProgress = {...doc, _rev: '1-rev'}
  }),
}))

vi.mock('@/utils/logger', () => ({
  log: {i: vi.fn(), w: vi.fn(), e: vi.fn()},
}))

import {fetchKnowledgePack, listKnowledgePacks} from '@/utils/knowledge-pack-service'
import {getProgressDoc, saveProgressDoc} from '@/utils/knowledge-memory-db'

describe('useKnowledgeMemoryStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    savedProgress = null
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
})
