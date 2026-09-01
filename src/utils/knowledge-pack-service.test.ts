import {describe, it, expect, vi, beforeEach} from 'vitest'
import {
  KNOWLEDGE_PACK_LIST,
  DEFAULT_STRATEGY,
  fetchKnowledgePack,
  fetchKnowledgePackLegacy,
  getKnowledgePackInfo,
  listKnowledgePacks,
  isKnowledgePackCached,
  clearKnowledgePackCache,
  validateKnowledgePack,
} from './knowledge-pack-service'
import type {KnowledgePack} from '@/types/knowledge-memory'

const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { store = {} },
    get length() { return Object.keys(store).length },
    key: (index: number) => Object.keys(store)[index] ?? null,
  }
})()

vi.stubGlobal('localStorage', localStorageMock)

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

function makePack(id: string, itemCount = 3): KnowledgePack {
  return {
    id,
    name: `测试-${id}`,
    description: '测试描述',
    ordered: false,
    usableAsPeg: false,
    items: Array.from({length: itemCount}, (_, i) => ({
      id: `${id}-item-${i}`,
      question: `Q${i}`,
      answer: `A${i}`,
    })),
  }
}

describe('knowledge-pack-service', () => {
  beforeEach(() => {
    localStorageMock.clear()
    vi.resetAllMocks()
  })

  describe('常量与元数据', () => {
    it('应包含 11 个内置知识包', () => {
      expect(KNOWLEDGE_PACK_LIST).toHaveLength(11)
      expect(KNOWLEDGE_PACK_LIST.some(p => p.id === 'multiplication-9x9')).toBe(true)
      expect(KNOWLEDGE_PACK_LIST.some(p => p.id === 'solar-terms-24')).toBe(true)
    })

    it('listKnowledgePacks 应返回副本', () => {
      const list = listKnowledgePacks()
      expect(list).toEqual(KNOWLEDGE_PACK_LIST)
      list[0].name = 'modified'
      expect(KNOWLEDGE_PACK_LIST[0].name).not.toBe('modified')
    })

    it('getKnowledgePackInfo 应返回存在的包信息', () => {
      const info = getKnowledgePackInfo('elements')
      expect(info).toBeDefined()
      expect(info?.id).toBe('elements')
      expect(info?.itemCount).toBe(36)
    })

    it('getKnowledgePackInfo 对不存在的包返回 undefined', () => {
      expect(getKnowledgePackInfo('not-exist')).toBeUndefined()
    })

    it('默认策略配置正确', () => {
      expect(DEFAULT_STRATEGY).toEqual({priority: 'local', useCache: true, timeout: 5000})
    })
  })

  describe('缓存', () => {
    it('isKnowledgePackCached 无缓存时返回 false', () => {
      expect(isKnowledgePackCached('elements')).toBe(false)
    })

    it('isKnowledgePackCached 有有效缓存时返回 true', () => {
      const pack = makePack('elements')
      localStorageMock.setItem('slowlyrecord-knowledgebank-elements', JSON.stringify({pack, timestamp: Date.now()}))
      expect(isKnowledgePackCached('elements')).toBe(true)
    })

    it('clearKnowledgePackCache 应清除指定缓存', () => {
      localStorageMock.setItem('slowlyrecord-knowledgebank-elements', JSON.stringify({pack: makePack('elements'), timestamp: Date.now()}))
      clearKnowledgePackCache('elements')
      expect(localStorageMock.getItem('slowlyrecord-knowledgebank-elements')).toBeNull()
    })

    it('clearKnowledgePackCache 应清除所有知识包缓存', () => {
      localStorageMock.setItem('slowlyrecord-knowledgebank-elements', 'x')
      localStorageMock.setItem('slowlyrecord-knowledgebank-zodiac-12', 'y')
      localStorageMock.setItem('other_key', 'z')
      clearKnowledgePackCache()
      expect(localStorageMock.getItem('slowlyrecord-knowledgebank-elements')).toBeNull()
      expect(localStorageMock.getItem('slowlyrecord-knowledgebank-zodiac-12')).toBeNull()
      expect(localStorageMock.getItem('other_key')).toBe('z')
    })
  })

  describe('fetchKnowledgePack', () => {
    it('应使用有效缓存', async () => {
      const pack = makePack('elements', 36)
      localStorageMock.setItem('slowlyrecord-knowledgebank-elements', JSON.stringify({pack, timestamp: Date.now()}))
      const result = await fetchKnowledgePack('elements')
      expect(result.id).toBe('elements')
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('useCache 为 false 时跳过缓存', async () => {
      const cached = makePack('elements')
      localStorageMock.setItem('slowlyrecord-knowledgebank-elements', JSON.stringify({pack: cached, timestamp: Date.now()}))
      const fetched = makePack('elements', 10)
      fetchMock.mockResolvedValueOnce({ok: true, json: () => Promise.resolve(fetched)})
      const result = await fetchKnowledgePack('elements', {useCache: false})
      expect(fetchMock).toHaveBeenCalled()
      expect(result.items).toHaveLength(10)
    })

    it('应从本地加载并缓存', async () => {
      const pack = makePack('elements', 36)
      fetchMock.mockResolvedValueOnce({ok: true, json: () => Promise.resolve(pack)})
      const result = await fetchKnowledgePack('elements')
      expect(result.items).toHaveLength(36)
      expect(fetchMock).toHaveBeenCalledWith(
        '/knowledgebanks/elements.json',
        expect.objectContaining({method: 'GET'}),
      )
      const cached = localStorageMock.getItem('slowlyrecord-knowledgebank-elements')
      expect(cached).not.toBeNull()
      expect(JSON.parse(cached!).pack.items).toHaveLength(36)
    })

    it('缓存过期后应重新加载', async () => {
      const oldPack = makePack('elements', 5)
      const expired = Date.now() - 8 * 24 * 60 * 60 * 1000
      localStorageMock.setItem('slowlyrecord-knowledgebank-elements', JSON.stringify({pack: oldPack, timestamp: expired}))
      const newPack = makePack('elements', 36)
      fetchMock.mockResolvedValueOnce({ok: true, json: () => Promise.resolve(newPack)})
      const result = await fetchKnowledgePack('elements')
      expect(result.items).toHaveLength(36)
    })

    it('本地加载失败且无缓存时应抛出错误', async () => {
      fetchMock.mockResolvedValueOnce({ok: false, status: 404})
      await expect(fetchKnowledgePack('elements')).rejects.toThrow('无法加载知识包')
    })

    it('fetch 异常且无缓存时应抛出错误', async () => {
      fetchMock.mockRejectedValueOnce(new Error('network error'))
      await expect(fetchKnowledgePack('elements')).rejects.toThrow('无法加载知识包')
    })
  })

  describe('validateKnowledgePack', () => {
    it('合法包应校验通过', () => {
      const result = validateKnowledgePack(makePack('test'))
      expect(result.valid).toBe(true)
    })

    it('缺少 id 应失败', () => {
      const result = validateKnowledgePack({name: 'x', items: []})
      expect(result.valid).toBe(false)
    })

    it('items 非数组应失败', () => {
      const result = validateKnowledgePack({id: 'x', name: 'x', items: 'bad'})
      expect(result.valid).toBe(false)
    })

    it('item 缺少 answer 应失败', () => {
      const pack = makePack('x')
      pack.items[0].answer = undefined as any
      const result = validateKnowledgePack(pack)
      expect(result.valid).toBe(false)
    })

    it('重复 id 应失败', () => {
      const pack = makePack('x')
      pack.items[1].id = pack.items[0].id
      const result = validateKnowledgePack(pack)
      expect(result.valid).toBe(false)
    })
  })

  describe('fetchKnowledgePackLegacy', () => {
    it('应兼容旧版调用', async () => {
      const pack = makePack('elements')
      fetchMock.mockResolvedValueOnce({ok: true, json: () => Promise.resolve(pack)})
      const result = await fetchKnowledgePackLegacy('elements', true)
      expect(result.id).toBe('elements')
    })
  })
})
