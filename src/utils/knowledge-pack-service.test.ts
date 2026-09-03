import {describe, it, expect, vi, beforeEach} from 'vitest'
import {readFileSync} from 'node:fs'
import {fileURLToPath} from 'node:url'
import {
  KNOWLEDGE_PACK_LIST,
  DEFAULT_STRATEGY,
  fetchKnowledgePack,
  fetchKnowledgePackLegacy,
  getKnowledgePackInfo,
  getPackVersion,
  isCacheUsable,
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
    it('应包含 19 个内置知识包', () => {
      expect(KNOWLEDGE_PACK_LIST).toHaveLength(19)
      expect(KNOWLEDGE_PACK_LIST.some(p => p.id === 'multiplication-9x9')).toBe(true)
      expect(KNOWLEDGE_PACK_LIST.some(p => p.id === 'solar-terms-24')).toBe(true)
      expect(KNOWLEDGE_PACK_LIST.some(p => p.id === 'physics-formulas')).toBe(true)
      expect(KNOWLEDGE_PACK_LIST.some(p => p.id === 'geography-concepts')).toBe(true)
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

    it('每个内置知识包都带有 category 分类', () => {
      expect(KNOWLEDGE_PACK_LIST.every(p => p.category === 'math' || p.category === 'text')).toBe(true)
    })

    it('listKnowledgePacks 按 category 过滤', () => {
      const math = listKnowledgePacks('math')
      expect(math.map(p => p.id).sort()).toEqual([
        'chemistry-formulas',
        'elements',
        'math-calculus',
        'math-formulas',
        'multiplication-19x19',
        'multiplication-9x9',
        'physics-formulas',
      ])
      const text = listKnowledgePacks('text')
      expect(text).toHaveLength(12)
      expect(text.every(p => p.category === 'text')).toBe(true)
      expect(text.map(p => p.id).sort()).toEqual([
        'biology-experiments',
        'constellations-12',
        'cuisines-8',
        'ethnic-groups-56',
        'geography-concepts',
        'home-route-12',
        'number-pegs-12',
        'physics-experiments',
        'physics-laws',
        'provinces-capitals',
        'solar-terms-24',
        'zodiac-12',
      ])
    })

    it('新 5 个知识包都能通过结构校验且条数与元数据一致', () => {
      const newPackIds = [
        'physics-formulas',
        'physics-laws',
        'physics-experiments',
        'biology-experiments',
        'geography-concepts',
      ]
      newPackIds.forEach(id => {
        const info = getKnowledgePackInfo(id)
        expect(info).toBeDefined()
        // 新包均归入正确分类：物理公式归 math，其余归 text
        expect(info!.category).toBe(id === 'physics-formulas' ? 'math' : 'text')
        // 相对本文件定位 public/knowledgebanks（src/utils → 项目根目录 → public/knowledgebanks）
        const raw = readFileSync(
          fileURLToPath(new URL('../../public/knowledgebanks/' + id + '.json', import.meta.url)),
          'utf-8',
        )
        const pack = JSON.parse(raw)
        expect(validateKnowledgePack(pack).valid).toBe(true)
        expect(pack.items).toHaveLength(info!.itemCount)
        expect(pack.ordered).toBe(false)
        expect(pack.usableAsPeg).toBe(false)
      })
    })

    it('数字桩/家居路线桩两个新桩库数据合法且可作为宫殿桩库', () => {
      const newPackIds = ['number-pegs-12', 'home-route-12']
      newPackIds.forEach(id => {
        const info = getKnowledgePackInfo(id)
        expect(info).toBeDefined()
        expect(info!.category).toBe('text')
        expect(info!.ordered).toBe(true)
        expect(info!.usableAsPeg).toBe(true)
        const raw = readFileSync(
          fileURLToPath(new URL('../../public/knowledgebanks/' + id + '.json', import.meta.url)),
          'utf-8',
        )
        const pack = JSON.parse(raw)
        expect(validateKnowledgePack(pack).valid).toBe(true)
        expect(pack.items).toHaveLength(info!.itemCount)
      })
      // 数字桩 1-6 号位均提供备选桩
      const numberPegs = JSON.parse(
        readFileSync(
          fileURLToPath(new URL('../../public/knowledgebanks/number-pegs-12.json', import.meta.url)),
          'utf-8',
        ),
      )
      for (let i = 0; i < 6; i++) {
        expect(Array.isArray(numberPegs.items[i].alternates)).toBe(true)
        expect(numberPegs.items[i].alternates.length).toBeGreaterThan(0)
      }
    })

    it('默认策略配置正确', () => {
      expect(DEFAULT_STRATEGY).toEqual({priority: 'local', useCache: true, timeout: 5000})
    })

    it('math-formulas 数据版本为 4，elements / solar-terms-24 / zodiac-12 为 2，其余包默认版本为 1', () => {
      expect(getKnowledgePackInfo('math-formulas')?.version).toBe(4)
      expect(getKnowledgePackInfo('elements')?.version).toBe(2)
      expect(getKnowledgePackInfo('solar-terms-24')?.version).toBe(2)
      expect(getKnowledgePackInfo('zodiac-12')?.version).toBe(2)
      expect(getPackVersion('math-formulas')).toBe(4)
      expect(getPackVersion('elements')).toBe(2)
      expect(getPackVersion('solar-terms-24')).toBe(2)
      expect(getPackVersion('zodiac-12')).toBe(2)
      // 其余包（未加口诀等结构变更）仍为 1
      expect(getPackVersion('multiplication-9x9')).toBe(1)
      expect(getPackVersion('constellations-12')).toBe(1)
      // 未知包兜底为 1
      expect(getPackVersion('not-exist')).toBe(1)
    })
  })

  describe('isCacheUsable 缓存版本校验', () => {
    const pack = makePack('math-formulas', 24)

    it('版本一致且未过期时可用', () => {
      expect(isCacheUsable({pack, timestamp: Date.now(), version: 2}, 2)).toBe(true)
    })

    it('版本不一致时失效', () => {
      expect(isCacheUsable({pack, timestamp: Date.now(), version: 1}, 2)).toBe(false)
    })

    it('老缓存无 version 字段时按版本 1 处理', () => {
      expect(isCacheUsable({pack, timestamp: Date.now()}, 1)).toBe(true)
      expect(isCacheUsable({pack, timestamp: Date.now()}, 2)).toBe(false)
    })

    it('过期或数据不合法时失效', () => {
      const expired = Date.now() - 8 * 24 * 60 * 60 * 1000
      expect(isCacheUsable({pack, timestamp: expired, version: 1}, 1)).toBe(false)
      expect(isCacheUsable({pack: {items: []} as any, timestamp: Date.now(), version: 1}, 1)).toBe(false)
      expect(isCacheUsable(null, 1)).toBe(false)
    })
  })

  describe('缓存', () => {
    it('isKnowledgePackCached 无缓存时返回 false', () => {
      expect(isKnowledgePackCached('elements')).toBe(false)
    })

    it('isKnowledgePackCached 有有效缓存时返回 true', () => {
      const pack = makePack('elements')
      localStorageMock.setItem('slowlyrecord-knowledgebank-elements', JSON.stringify({pack, timestamp: Date.now(), version: 2}))
      expect(isKnowledgePackCached('elements')).toBe(true)
    })

    it('clearKnowledgePackCache 应清除指定缓存', () => {
      localStorageMock.setItem('slowlyrecord-knowledgebank-elements', JSON.stringify({pack: makePack('elements'), timestamp: Date.now(), version: 2}))
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
      localStorageMock.setItem('slowlyrecord-knowledgebank-elements', JSON.stringify({pack, timestamp: Date.now(), version: 2}))
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
      // 缓存应记录当前数据版本（elements 已升级到 2）
      expect(JSON.parse(cached!).version).toBe(2)
    })

    it('缓存版本与包当前版本不一致时视为失效并重新加载', async () => {
      // 模拟老版本缓存（math-formulas 升级到 version 2 之前的 version 1 缓存）
      const oldPack = makePack('math-formulas', 20)
      localStorageMock.setItem(
        'slowlyrecord-knowledgebank-math-formulas',
        JSON.stringify({pack: oldPack, timestamp: Date.now(), version: 1}),
      )
      const newPack = makePack('math-formulas', 24)
      fetchMock.mockResolvedValueOnce({ok: true, json: () => Promise.resolve(newPack)})
      const result = await fetchKnowledgePack('math-formulas')
      expect(fetchMock).toHaveBeenCalled()
      expect(result.items).toHaveLength(24)
      // 新缓存写入 version 4
      const cached = JSON.parse(localStorageMock.getItem('slowlyrecord-knowledgebank-math-formulas')!)
      expect(cached.version).toBe(4)
    })

    it('无 version 字段的老缓存在包升级后同样失效', async () => {
      const oldPack = makePack('math-formulas', 20)
      localStorageMock.setItem(
        'slowlyrecord-knowledgebank-math-formulas',
        JSON.stringify({pack: oldPack, timestamp: Date.now()}),
      )
      const newPack = makePack('math-formulas', 24)
      fetchMock.mockResolvedValueOnce({ok: true, json: () => Promise.resolve(newPack)})
      const result = await fetchKnowledgePack('math-formulas')
      expect(fetchMock).toHaveBeenCalled()
      expect(result.items).toHaveLength(24)
    })

    it('版本不一致的过期缓存不做兜底', async () => {
      fetchMock.mockResolvedValueOnce({ok: false, status: 404})
      const stale = JSON.stringify({pack: makePack('math-formulas', 20), timestamp: 1, version: 1})
      localStorageMock.setItem('slowlyrecord-knowledgebank-math-formulas', stale)
      await expect(fetchKnowledgePack('math-formulas')).rejects.toThrow('无法加载知识包')
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

    it('过期缓存损坏时应抛出错误而不是返回损坏数据', async () => {
      fetchMock.mockResolvedValueOnce({ok: false, status: 404})
      const stale = JSON.stringify({pack: {id: 'elements', name: 'x', items: 'bad'}, timestamp: 1})
      localStorageMock.setItem('slowlyrecord-knowledgebank-elements', stale)
      await expect(fetchKnowledgePack('elements')).rejects.toThrow('无法加载知识包')
    })

    it('并发加载同包应只 fetch 一次', async () => {
      const pack = makePack('elements', 36)
      fetchMock.mockResolvedValueOnce({ok: true, json: () => Promise.resolve(pack)})
      const [a, b] = await Promise.all([fetchKnowledgePack('elements'), fetchKnowledgePack('elements')])
      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(a).toBe(b)
    })

    it('加载后应保留包级 mnemonics 口诀字段', async () => {
      const pack = makePack('elements', 36)
      pack.mnemonics = ['氢氦锂铍硼', '碳氮氧氟氖', '钠镁铝硅磷']
      fetchMock.mockResolvedValueOnce({ok: true, json: () => Promise.resolve(pack)})
      const result = await fetchKnowledgePack('elements')
      expect(result.mnemonics).toEqual(['氢氦锂铍硼', '碳氮氧氟氖', '钠镁铝硅磷'])
      // 写入缓存的数据同样保留 mnemonics
      const cached = JSON.parse(localStorageMock.getItem('slowlyrecord-knowledgebank-elements')!)
      expect(cached.pack.mnemonics).toEqual(['氢氦锂铍硼', '碳氮氧氟氖', '钠镁铝硅磷'])
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

    it('item 带字符串数组 alternates 应通过', () => {
      const pack = makePack('x')
      pack.items[0].alternates = ['备选A', '备选B']
      const result = validateKnowledgePack(pack)
      expect(result.valid).toBe(true)
    })

    it('item 不带 alternates 应通过', () => {
      const result = validateKnowledgePack(makePack('x'))
      expect(result.valid).toBe(true)
    })

    it('item 的 alternates 非字符串数组应失败', () => {
      const pack = makePack('x')
      pack.items[0].alternates = 'not-array' as any
      expect(validateKnowledgePack(pack).valid).toBe(false)

      const pack2 = makePack('x')
      pack2.items[0].alternates = [1, 2] as any
      expect(validateKnowledgePack(pack2).valid).toBe(false)
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
