/**
 * 内置知识包加载器（knowledge-pack-loader.ts）单元测试
 *
 * 注册表与知识包条目直接用真实内置数据（经 knowledge-pack-data 注册桥接，无网络层），
 * 仅 mock uni.*StorageSync 供缓存读写。
 * 重点验证：isCacheUsable 缓存失效三要素（版本/有效期/结构）与 getPackVersion 版本取值。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  KNOWLEDGE_PACK_LIST,
  clearKnowledgePackCache,
  fetchKnowledgePack,
  getKnowledgePackInfo,
  getPackVersion,
  isCacheUsable,
  listKnowledgePacks,
  validateKnowledgePack,
} from './knowledge-pack-loader'
// 数据模块静态 import 全部内置包并注册到 loader（与真机 detail/practice/table 页一致）
import '../knowledge-pack-data'
import type { KnowledgePack } from '@/stores/useUtils/types'

type CacheData = NonNullable<Parameters<typeof isCacheUsable>[0]>

const NOW = Date.parse('2026-09-16T12:00:00+08:00')
const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000

function makePack(id = 'test-pack'): KnowledgePack {
  return {
    id,
    name: `测试-${id}`,
    description: '测试描述',
    ordered: false,
    usableAsPeg: false,
    items: [{ id: `${id}-1`, question: 'Q', answer: 'A' }],
  }
}

function makeCache(pack: unknown = makePack(), version?: number, timestamp = NOW): CacheData {
  const data: CacheData = { timestamp, pack: pack as KnowledgePack }
  if (version !== undefined) data.version = version
  return data
}

function createMockUni() {
  const store = new Map<string, any>()
  const uniMock = {
    getStorageSync: vi.fn((k: string) => store.get(k) ?? ''),
    setStorageSync: vi.fn((k: string, v: any) => { store.set(k, v) }),
    removeStorageSync: vi.fn((k: string) => { store.delete(k) }),
    getStorageInfoSync: vi.fn(() => ({ keys: Array.from(store.keys()), currentSize: 0, limitSize: 10240 })),
  }
  return { store, uniMock }
}

let env: ReturnType<typeof createMockUni>

beforeEach(() => {
  env = createMockUni()
  ;(globalThis as any).uni = env.uniMock
  clearKnowledgePackCache()
})

describe('getPackVersion', () => {
  it('注册表显式声明 version 的包取声明值', () => {
    expect(getPackVersion('elements')).toBe(5)
    expect(getPackVersion('solar-terms-24')).toBe(3)
    expect(getPackVersion('math-formulas')).toBe(5)
    expect(getPackVersion('multiplication-9x9')).toBe(2)
    expect(getPackVersion('dynasties-china')).toBe(2)
    expect(getPackVersion('world-capitals-40')).toBe(2)
    expect(getPackVersion('geography-concepts')).toBe(2)
    expect(getPackVersion('common-units')).toBe(2)
    // multiplication-19x19 追加大九九口诀 mnemonics → 2
    expect(getPackVersion('multiplication-19x19')).toBe(2)
  })

  it('注册表显式声明 version=1 的新包取声明值', () => {
    expect(getKnowledgePackInfo('geography-china')?.version).toBe(1)
    expect(getPackVersion('geography-china')).toBe(1)
  })

  it('注册表未声明 version 的包为 1', () => {
    expect(getPackVersion('ethnic-groups-56')).toBe(1)
    expect(getPackVersion('colors-12')).toBe(1)
    expect(getKnowledgePackInfo('ethnic-groups-56')?.version).toBeUndefined()
  })

  it('未知包兜底为 1', () => {
    expect(getPackVersion('not-exist')).toBe(1)
  })
})

describe('isCacheUsable', () => {
  it('版本一致且未过期时可用', () => {
    expect(isCacheUsable(makeCache(makePack(), 2), 2, NOW)).toBe(true)
  })

  it('版本不一致时失效', () => {
    expect(isCacheUsable(makeCache(makePack(), 1), 2, NOW)).toBe(false)
  })

  it('老缓存无 version 字段时按版本 1 处理', () => {
    expect(isCacheUsable(makeCache(makePack()), 1, NOW)).toBe(true)
    expect(isCacheUsable(makeCache(makePack()), 2, NOW)).toBe(false)
  })

  it('超过 7 天过期，恰好 7 天边界仍可用', () => {
    expect(isCacheUsable(makeCache(makePack(), 1, NOW - SEVEN_DAYS - 1), 1, NOW)).toBe(false)
    expect(isCacheUsable(makeCache(makePack(), 1, NOW - SEVEN_DAYS), 1, NOW)).toBe(true)
  })

  it('结构不合法时失效（null / pack 缺失 / items 非数组 / items 为空）', () => {
    expect(isCacheUsable(null, 1, NOW)).toBe(false)
    expect(isCacheUsable(makeCache(null, 1), 1, NOW)).toBe(false)
    expect(isCacheUsable(makeCache({ id: 'x', name: 'x' }, 1), 1, NOW)).toBe(false)
    expect(isCacheUsable(makeCache({ ...makePack(), items: 'bad' }, 1), 1, NOW)).toBe(false)
    expect(isCacheUsable(makeCache({ ...makePack(), items: [] }, 1), 1, NOW)).toBe(false)
  })
})

describe('注册表与内置数据（真实数据完整性）', () => {
  it('43 个内置包全部可加载，结构合法且条数与元数据一致', async () => {
    expect(KNOWLEDGE_PACK_LIST).toHaveLength(43)
    for (const info of KNOWLEDGE_PACK_LIST) {
      const pack = await fetchKnowledgePack(info.id)
      expect(validateKnowledgePack(pack).valid).toBe(true)
      expect(pack.items).toHaveLength(info.itemCount)
    }
  })

  it('加载后写入 uni storage 缓存并记录当前数据版本', async () => {
    await fetchKnowledgePack('elements')
    const cached = env.store.get('slowlyrecord-knowledgebank-elements')
    expect(cached).toBeDefined()
    expect(cached.version).toBe(5)
    expect(cached.pack.items).toHaveLength(137)
  })

  it('二次加载优先命中内存缓存，不再读 storage', async () => {
    const first = await fetchKnowledgePack('elements')
    env.store.clear()
    const second = await fetchKnowledgePack('elements')
    expect(second).toBe(first)
  })

  it('未知包 id 抛出异常', async () => {
    await expect(fetchKnowledgePack('not-exist')).rejects.toThrow('未知知识包')
  })

  it('listKnowledgePacks 按 category 过滤并返回副本', () => {
    const math = listKnowledgePacks('math')
    expect(math).toHaveLength(19)
    expect(math.every(p => p.category === 'math')).toBe(true)
    // 移动端注册表仍只存 math/text（展示层的「地理」分类由 pack-category.ts 维护映射）
    const text = listKnowledgePacks('text')
    expect(text).toHaveLength(24)
    expect(text.some(p => p.id === 'geography-china')).toBe(true)

    math[0].name = 'modified'
    expect(getKnowledgePackInfo(math[0].id)?.name).not.toBe('modified')
  })
})
