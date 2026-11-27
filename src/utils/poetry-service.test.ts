/**
 * 诗词文章库服务测试（桌面端）。
 *
 * 覆盖：朝代数据拉取与字段归一化、localStorage 缓存（命中/过期/损坏/清理）、
 * 全量加载进度回调与聚合、搜索筛选（关键词/类型/标签/地点/经典）、
 * 必背篇目、随机取诗、统计信息与默认导出。网络层全部 mock。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import poetryService, {
  DEFAULT_STRATEGY,
  DYNASTY_LIST,
  clearPoetryCache,
  fetchAllPoetry,
  fetchPoetryByDynasty,
  getClassicPoetry,
  getPoetryStatistics,
  getRandomPoetry,
  isPoetryCached,
  searchPoetry,
} from './poetry-service'

const CACHE_PREFIX = 'poetry_cache_v6_'

function createLocalStorage() {
  const map = new Map<string, string>()
  return {
    get length() {
      return map.size
    },
    key: (index: number) => Array.from(map.keys())[index] ?? null,
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, String(value))
    },
    removeItem: (key: string) => {
      map.delete(key)
    },
    clear: () => map.clear(),
  }
}

function poem(overrides: Record<string, any> = {}) {
  return {
    title: '静夜思',
    author: '李白',
    dynasty: '唐',
    content: '床前明月光，疑是地上霜。',
    ...overrides,
  }
}

function okJson(data: any) {
  return { ok: true, status: 200, json: async () => data }
}

let storage: ReturnType<typeof createLocalStorage>
let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  storage = createLocalStorage()
  fetchMock = vi.fn()
  vi.stubGlobal('localStorage', storage)
  vi.stubGlobal('fetch', fetchMock)
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('常量', () => {
  it('朝代列表含 10 个朝代且 code 唯一', () => {
    expect(DYNASTY_LIST).toHaveLength(10)
    expect(new Set(DYNASTY_LIST.map(d => d.code)).size).toBe(10)
    expect(DYNASTY_LIST.map(d => d.name)).toContain('唐')
    expect(DYNASTY_LIST.every(d => d.description && d.period)).toBe(true)
  })

  it('默认策略为本地优先、启用缓存、超时 5 秒', () => {
    expect(DEFAULT_STRATEGY).toEqual({ priority: 'local', useCache: true, timeout: 5000 })
  })
})

describe('fetchPoetryByDynasty', () => {
  it('拉取对应朝代文件并归一化字段', async () => {
    fetchMock.mockResolvedValueOnce(okJson({
      poems: [
        poem({ pinyin: 'chuang qian', speechContent: '床前明夜光', translation: '英译' }),
        poem({ title: '', author: '', dynasty: '唐', content: 'x', location: '扬州', year: 742 }),
        poem({ content: '' }),
      ],
    }))

    const result = await fetchPoetryByDynasty('tang')

    expect(fetchMock).toHaveBeenCalledOnce()
    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toMatch(/\/datafile\/poetry\/tang\.json$/)
    expect(init).toMatchObject({ method: 'GET', headers: { Accept: 'application/json' } })

    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({
      id: expect.stringMatching(/^poetry_\d+_0$/),
      title: '静夜思',
      author: '李白',
      dynasty: '唐',
      dynastyCode: 'tang',
      contentType: 'poetry',
      tags: [],
      wordCount: '床前明月光，疑是地上霜。'.length,
      pinyin: 'chuang qian',
      speechContent: '床前明夜光',
      translation: '英译',
    })
    expect(result[1]).toMatchObject({
      title: '未知标题',
      author: '佚名',
      dynasty: '唐',
      dynastyCode: 'tang',
      location: '扬州',
      year: 742,
      wordCount: 1,
    })
    // 无 content 的条目被丢弃
    expect(result.map(p => p.content)).not.toContain('')
  })

  it('未知朝代名回退为 xianqin 代码', async () => {
    fetchMock.mockResolvedValueOnce(okJson([poem({ dynasty: '架空' })]))
    const [result] = await fetchPoetryByDynasty('tang')
    expect(result.dynastyCode).toBe('xianqin')
  })

  it('响应体为数组时直接使用', async () => {
    fetchMock.mockResolvedValueOnce(okJson([poem()]))
    await expect(fetchPoetryByDynasty('tang')).resolves.toHaveLength(1)
  })

  it('命中缓存时不再请求网络', async () => {
    fetchMock.mockResolvedValueOnce(okJson([poem()]))
    const first = await fetchPoetryByDynasty('tang')
    const second = await fetchPoetryByDynasty('tang')
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(second).toEqual(first)
    expect(isPoetryCached('tang')).toBe(true)
  })

  it('useCache=false 时跳过读取也不写入缓存', async () => {
    fetchMock.mockResolvedValue(okJson([poem()]))
    await fetchPoetryByDynasty('tang', { useCache: false })
    expect(storage.getItem(CACHE_PREFIX + 'tang')).toBeNull()
    await fetchPoetryByDynasty('tang', { useCache: false })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('空数组不写缓存', async () => {
    fetchMock.mockResolvedValueOnce(okJson({ poems: [] }))
    await expect(fetchPoetryByDynasty('tang')).resolves.toEqual([])
    expect(storage.getItem(CACHE_PREFIX + 'tang')).toBeNull()
  })

  it('响应体不是数组时返回空数组并告警', async () => {
    fetchMock.mockResolvedValueOnce(okJson({ foo: 'bar' }))
    await expect(fetchPoetryByDynasty('tang')).resolves.toEqual([])
    expect(console.warn).toHaveBeenCalledWith('[Poetry] 数据格式错误，期望数组')
  })

  it('HTTP 非 2xx 时回退内置数据', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) })
    const result = await fetchPoetryByDynasty('tang')
    expect(result.map(p => p.id)).toEqual(['tang_001', 'tang_002', 'tang_003'])
    expect(console.warn).toHaveBeenCalledWith('[Poetry] 加载失败: tang', expect.any(Error))
  })

  it('网络异常时回退内置数据', async () => {
    fetchMock.mockRejectedValueOnce(new Error('offline'))
    const result = await fetchPoetryByDynasty('song')
    expect(result.length).toBeGreaterThan(0)
    expect(result.every(p => p.dynastyCode === 'song')).toBe(true)
  })

  it('缓存过期后删除旧值并重新请求', async () => {
    storage.setItem(CACHE_PREFIX + 'tang', JSON.stringify({
      timestamp: Date.now() - 31 * 24 * 60 * 60 * 1000,
      value: [poem({ title: '旧缓存' })],
    }))
    fetchMock.mockResolvedValueOnce(okJson([poem({ title: '新数据' })]))

    const result = await fetchPoetryByDynasty('tang')

    expect(fetchMock).toHaveBeenCalledOnce()
    expect(result[0].title).toBe('新数据')
    expect(JSON.parse(storage.getItem(CACHE_PREFIX + 'tang')!).value[0].title).toBe('新数据')
  })

  it('缓存 JSON 损坏时告警并重新请求', async () => {
    storage.setItem(CACHE_PREFIX + 'tang', '{broken')
    fetchMock.mockResolvedValueOnce(okJson([poem()]))

    await expect(fetchPoetryByDynasty('tang')).resolves.toHaveLength(1)
    expect(console.warn).toHaveBeenCalledWith('[Poetry] 读取缓存失败: tang', expect.any(Error))
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('localStorage 写入失败时不影响返回结果', async () => {
    vi.spyOn(storage, 'setItem').mockImplementation(() => {
      throw new Error('quota')
    })
    fetchMock.mockResolvedValueOnce(okJson([poem()]))

    await expect(fetchPoetryByDynasty('tang')).resolves.toHaveLength(1)
    expect(console.warn).toHaveBeenCalledWith('[Poetry] 缓存失败:', expect.any(Error))
  })
})

describe('clearPoetryCache / isPoetryCached', () => {
  it('指定朝代只删除该朝代缓存', () => {
    storage.setItem(CACHE_PREFIX + 'tang', '1')
    storage.setItem(CACHE_PREFIX + 'song', '2')
    storage.setItem('other', '3')

    clearPoetryCache('tang')

    expect(storage.getItem(CACHE_PREFIX + 'tang')).toBeNull()
    expect(storage.getItem(CACHE_PREFIX + 'song')).toBe('2')
    expect(storage.getItem('other')).toBe('3')
  })

  it('不传朝代时清除全部诗词缓存，保留其他键', () => {
    storage.setItem(CACHE_PREFIX + 'tang', '1')
    storage.setItem(CACHE_PREFIX + 'song', '2')
    storage.setItem('other', '3')

    clearPoetryCache()

    expect(storage.getItem(CACHE_PREFIX + 'tang')).toBeNull()
    expect(storage.getItem(CACHE_PREFIX + 'song')).toBeNull()
    expect(storage.getItem('other')).toBe('3')
  })

  it('未缓存时 isPoetryCached 为 false', () => {
    expect(isPoetryCached('tang' as any)).toBe(false)
  })
})

describe('fetchAllPoetry', () => {
  it('按朝代顺序加载并回调进度', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      const code = String(url).split('/').pop()!.replace('.json', '')
      return okJson([poem({ title: code, dynasty: code })])
    })
    const progress = vi.fn()

    const result = await fetchAllPoetry(progress)

    expect(Object.keys(result)).toHaveLength(10)
    expect(Object.values(result).flat()).toHaveLength(10)
    expect(fetchMock).toHaveBeenCalledTimes(10)
    expect(progress).toHaveBeenNthCalledWith(1, 0, 10, '先秦')
    expect(progress).toHaveBeenCalledWith(10, 10, '完成')
    expect(progress).toHaveBeenCalledTimes(11)
  })

  it('不传进度回调也能完成', async () => {
    fetchMock.mockResolvedValue(okJson([poem()]))
    await expect(fetchAllPoetry()).resolves.toBeTypeOf('object')
  })
})

describe('searchPoetry', () => {
  const poems = [
    poem({ title: '静夜思', author: '李白', content: '床前明月光', tags: ['思乡', '常背篇目'], location: '扬州' }),
    poem({ title: '春晓', author: '孟浩然', content: '春眠不觉晓', tags: ['田园'], contentType: 'poetry' }),
    poem({ title: '岳阳楼记', author: '范仲淹', content: '先天下之忧而忧', tags: ['古文'], contentType: 'article', isClassic: true }),
  ]

  it('指定朝代时只检索该朝代', async () => {
    fetchMock.mockResolvedValueOnce(okJson(poems))
    const result = await searchPoetry('月', { dynasty: 'tang' })
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(result.map(p => p.title)).toEqual(['静夜思'])
  })

  it('关键词可匹配标题、作者、正文与标签', async () => {
    fetchMock.mockResolvedValue(okJson(poems))
    await expect(searchPoetry('春', { dynasty: 'tang' })).resolves.toHaveLength(1)
    await expect(searchPoetry('孟浩然', { dynasty: 'tang' })).resolves.toHaveLength(1)
    await expect(searchPoetry('先天下', { dynasty: 'tang' })).resolves.toHaveLength(1)
    await expect(searchPoetry('田园', { dynasty: 'tang' })).resolves.toHaveLength(1)
    await expect(searchPoetry('不存在', { dynasty: 'tang' })).resolves.toHaveLength(0)
  })

  it('关键词可匹配创作地点，无地点的条目不因地点筛选被排除', async () => {
    fetchMock.mockResolvedValue(okJson(poems))
    await expect(searchPoetry('扬州', { dynasty: 'tang' })).resolves.toHaveLength(1)
    await expect(searchPoetry('', { dynasty: 'tang' })).resolves.toHaveLength(3)
  })

  it('按内容类型筛选', async () => {
    fetchMock.mockResolvedValue(okJson(poems))
    const result = await searchPoetry('', { dynasty: 'tang', contentType: 'article' })
    expect(result.map(p => p.title)).toEqual(['岳阳楼记'])
  })

  it('标签为 OR 匹配', async () => {
    fetchMock.mockResolvedValue(okJson(poems))
    const result = await searchPoetry('', { dynasty: 'tang', tags: ['田园', '古文'] })
    expect(result.map(p => p.title)).toEqual(['春晓', '岳阳楼记'])
  })

  it('地点筛选排除地点不匹配的条目，无地点条目不受影响', async () => {
    fetchMock.mockResolvedValue(okJson([
      ...poems,
      poem({ title: '黄鹤楼', location: '武汉' }),
    ]))
    const result = await searchPoetry('', { dynasty: 'tang', location: '扬州' })
    expect(result.map(p => p.title)).toEqual(['静夜思', '春晓', '岳阳楼记'])
  })

  it('isClassic 命中 isClassic 或「常背篇目/名篇」标签', async () => {
    fetchMock.mockResolvedValue(okJson(poems))
    const result = await searchPoetry('', { dynasty: 'tang', isClassic: true })
    expect(result.map(p => p.title)).toEqual(['静夜思', '岳阳楼记'])
  })

  it('不指定朝代时聚合全部朝代结果', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      const code = String(url).split('/').pop()!.replace('.json', '')
      return okJson([poem({ title: code, content: `内容-${code}` })])
    })

    const all = await searchPoetry('内容')
    expect(all).toHaveLength(10)

    const none = await searchPoetry('无此关键词')
    expect(none).toHaveLength(0)
  })
})

describe('getClassicPoetry', () => {
  it('只返回带常背篇目/名篇标签的诗词', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (String(url).includes('tang.json')) {
        return okJson([
          poem({ title: '静夜思', tags: ['常背篇目'] }),
          poem({ title: '普通诗', tags: ['山水'] }),
          poem({ title: '名篇诗', tags: ['名篇'] }),
        ])
      }
      return okJson([])
    })

    const result = await getClassicPoetry()
    expect(result.map(p => p.title).sort()).toEqual(['名篇诗', '静夜思'])
  })
})

describe('getRandomPoetry', () => {
  it('指定朝代结果为空时返回 null', async () => {
    fetchMock.mockResolvedValueOnce(okJson({ poems: [] }))
    await expect(getRandomPoetry('tang')).resolves.toBeNull()
  })

  it('按随机下标取指定朝代的一首', async () => {
    fetchMock.mockResolvedValueOnce(okJson([poem({ title: 'A' }), poem({ title: 'B' }), poem({ title: 'C' })]))
    vi.spyOn(Math, 'random').mockReturnValue(0.5)

    const result = await getRandomPoetry('tang')
    expect(result?.title).toBe('B')
  })

  it('不指定朝代时从全量中随机取一首', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      const code = String(url).split('/').pop()!.replace('.json', '')
      return okJson([poem({ title: code })])
    })
    vi.spyOn(Math, 'random').mockReturnValue(0)

    const result = await getRandomPoetry()
    expect(result).not.toBeNull()
    expect(['xianqin', 'han', 'weijin', 'sui', 'tang', 'song', 'yuan', 'ming', 'qing', 'xiandai']).toContain(result!.title)
  })
})

describe('getPoetryStatistics', () => {
  it('统计总数、各朝代数量与各类型数量', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (String(url).includes('tang.json')) {
        return okJson([
          poem({ contentType: 'poetry' }),
          poem({ title: '岳阳楼记', contentType: 'article' }),
        ])
      }
      if (String(url).includes('song.json')) {
        return okJson([poem({ title: '水调歌头', contentType: 'ci' })])
      }
      return okJson([])
    })

    const stats = await getPoetryStatistics()

    expect(stats.total).toBe(3)
    expect(stats.byDynasty.tang).toBe(2)
    expect(stats.byDynasty.song).toBe(1)
    expect(stats.byDynasty.ming).toBe(0)
    expect(stats.byType).toMatchObject({ poetry: 1, article: 1, ci: 1 })
  })
})

describe('默认导出', () => {
  it('暴露全部公开方法', () => {
    expect(poetryService).toMatchObject({
      fetchPoetryByDynasty,
      fetchAllPoetry,
      searchPoetry,
      getClassicPoetry,
      getRandomPoetry,
      getPoetryStatistics,
      clearPoetryCache,
      isPoetryCached,
    })
    expect(poetryService.DYNASTY_LIST).toBe(DYNASTY_LIST)
    expect(poetryService.DEFAULT_STRATEGY).toBe(DEFAULT_STRATEGY)
  })
})
