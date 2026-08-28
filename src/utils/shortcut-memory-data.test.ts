import { describe, it, expect, vi } from 'vitest'

// mock db 层，避免测试环境无 utools/IndexedDB 时 getHiddenCategories 等报错
vi.mock('@/utils/shortcut-memory-db', () => ({
  getHiddenCategories: vi.fn(() => []),
  getAllCustomShortcuts: vi.fn(() => []),
  getAllCustomCategories: vi.fn(() => []),
}))

import {
  PRESET_SHORTCUTS,
  CATEGORY_CONFIG,
  GROUP_CONFIG,
  getCategories,
  getGroups,
  getShortcutsByCategory,
  loadAllShortcuts,
  buildShuangpinMap,
  pinyinToShuangpin,
  generateShuangpinPracticeItems,
  filterByTags,
  isZoneTag,
  ZONE_TAGS,
  extractYunmu,
  extractShuangpinKeyHint,
  extractWubiKeyHint,
  getWubiKeyHints,
  getWubiRootHints,
  extractPinyinHint,
} from '@/utils/shortcut-memory-data'
import type { ShortcutItem } from '@/types/shortcut-memory'

describe('shortcut-memory-data 域分组与 tag', () => {
  describe('CATEGORY_CONFIG', () => {
    it('每个内置分类都配置了 group', () => {
      for (const [name, cfg] of Object.entries(CATEGORY_CONFIG)) {
        expect(cfg.group, `${name} 应有 group`).toBeTruthy()
      }
    })

    it('五笔/双拼归输入法，Windows 归系统', () => {
      expect(CATEGORY_CONFIG['五笔86版'].group).toBe('输入法')
      expect(CATEGORY_CONFIG['双拼 · 小鹤'].group).toBe('输入法')
      expect(CATEGORY_CONFIG['Windows'].group).toBe('系统')
      expect(CATEGORY_CONFIG['数字小键盘练习'].group).toBe('财务')
    })
  })

  describe('GROUP_CONFIG', () => {
    it('包含 6 个内置域 + 自定义', () => {
      for (const g of ['系统', '开发', '办公', '设计', '财务', '输入法', '自定义']) {
        expect(GROUP_CONFIG[g]).toBeDefined()
      }
    })

    it('每个域有 icon/description/order', () => {
      for (const [name, cfg] of Object.entries(GROUP_CONFIG)) {
        expect(cfg.icon, `${name} 应有 icon`).toBeTruthy()
        expect(cfg.description, `${name} 应有 description`).toBeTruthy()
        expect(typeof cfg.order).toBe('number')
      }
    })
  })

  describe('PRESET enrichPreset', () => {
    it('五笔86版条目都带 group=输入法 且有 tags', () => {
      const wubi86 = PRESET_SHORTCUTS.filter(s => s.category === '五笔86版')
      expect(wubi86.length).toBeGreaterThan(0)
      for (const item of wubi86) {
        expect(item.group).toBe('输入法')
        expect(item.tags).toBeTruthy()
        expect(item.tags!.length).toBeGreaterThan(0)
      }
    })

    it('五笔 tags 仅含横/竖/撇/捺/折区、万能键、生僻字或易错字', () => {
      const valid = new Set(['横区', '竖区', '撇区', '捺区', '折区', '万能键', '生僻字', '易错字'])
      const wubi = PRESET_SHORTCUTS.filter(s =>
        s.category === '五笔86版' || s.category === '五笔98版'
      )
      expect(wubi.length).toBeGreaterThan(0)
      for (const item of wubi) {
        for (const t of item.tags!) {
          expect(valid.has(t), `非法 tag: ${t}`).toBe(true)
        }
      }
    })

    it('五笔 G 键归横区、H 键归竖区、Z 键归万能键', () => {
      const find = (cat: string, key: string) =>
        PRESET_SHORTCUTS.find(s => s.category === cat && s.keys[0] === key)
      expect(find('五笔86版', 'G')?.tags).toContain('横区')
      expect(find('五笔86版', 'H')?.tags).toContain('竖区')
      expect(find('五笔86版', 'T')?.tags).toContain('撇区')
      expect(find('五笔86版', 'Y')?.tags).toContain('捺区')
      expect(find('五笔86版', 'N')?.tags).toContain('折区')
      expect(find('五笔86版', 'Z')?.tags).toContain('万能键')
    })

    it('双拼条目带 group=输入法', () => {
      const sp = PRESET_SHORTCUTS.filter(s => s.category === '双拼 · 小鹤')
      expect(sp.length).toBeGreaterThan(0)
      for (const item of sp) {
        expect(item.group).toBe('输入法')
      }
    })
  })

  describe('filterByTags / ZONE_TAGS', () => {
    const items: ShortcutItem[] = [
      { id: '1', category: '五笔86版', functionName: 'G键·王', description: '', keys: ['G'], tags: ['横区'] },
      { id: '2', category: '五笔86版', functionName: 'H键·目', description: '', keys: ['H'], tags: ['竖区'] },
      { id: '3', category: '五笔86版', functionName: '的', description: '', keys: ['R'], tags: ['常用字'] },
      { id: '4', category: '五笔86版', functionName: '我们', description: '', keys: ['W', 'F'], tags: ['词组'] },
    ]

    it('ZONE_TAGS 含横/竖/撇/捺/折区', () => {
      expect(ZONE_TAGS).toEqual(['横区', '竖区', '撇区', '捺区', '折区'])
    })

    it('isZoneTag 识别分区标签', () => {
      expect(isZoneTag('横区')).toBe(true)
      expect(isZoneTag('常用字')).toBe(false)
    })

    it('typeTag=字根 只保留仅含分区标签的条目', () => {
      const r = filterByTags(items, '字根')
      expect(r.map(i => i.id).sort()).toEqual(['1', '2'])
    })

    it('typeTag=常用字 保留含该类型标签的条目', () => {
      const r = filterByTags(items, '常用字')
      expect(r.map(i => i.id)).toEqual(['3'])
    })

    it('zoneTag=横区 保留含该分区标签的条目', () => {
      const r = filterByTags(items, undefined, '横区')
      expect(r.map(i => i.id)).toEqual(['1'])
    })

    it('typeTag + zoneTag AND 组合', () => {
      const mixed: ShortcutItem[] = [
        { id: 'a', category: 'x', functionName: '', description: '', keys: ['G'], tags: ['横区'] },
        { id: 'b', category: 'x', functionName: '', description: '', keys: ['H'], tags: ['竖区'] },
      ]
      expect(filterByTags(mixed, '字根', '横区').map(i => i.id)).toEqual(['a'])
    })

    it('不传任何标签时返回全部', () => {
      expect(filterByTags(items).length).toBe(items.length)
    })
  })

  describe('getCategories', () => {
    it('返回的分类都带 group 字段', () => {
      const cats = getCategories()
      expect(cats.length).toBeGreaterThan(0)
      for (const c of cats) {
        expect(c.group, `${c.name} 应有 group`).toBeTruthy()
      }
    })

    it('五笔86版归输入法域、Windows 归系统域', () => {
      const cats = getCategories()
      expect(cats.find(c => c.name === '五笔86版')?.group).toBe('输入法')
      expect(cats.find(c => c.name === 'Windows')?.group).toBe('系统')
    })
  })

  describe('getGroups', () => {
    it('返回 6 个内置域并按 order 排序', () => {
      const groups = getGroups()
      const names = groups.map(g => g.name)
      expect(names).toEqual(['系统', '开发', '办公', '设计', '财务', '输入法'])
    })

    it('聚合 categoryCount 正确', () => {
      const groups = getGroups()
      const byName = Object.fromEntries(groups.map(g => [g.name, g]))
      expect(byName['系统'].categoryCount).toBe(2)   // Windows、键位练习
      expect(byName['开发'].categoryCount).toBe(5)   // VS Code、Chrome、IDEA、Claude Code、Vim
      expect(byName['办公'].categoryCount).toBe(6)   // Word、Excel、PPT、Outlook、Obsidian、思源
      expect(byName['设计'].categoryCount).toBe(3)   // Photoshop、Illustrator、CAD
      expect(byName['财务'].categoryCount).toBe(1)   // 数字小键盘练习
      expect(byName['输入法'].categoryCount).toBe(6) // 五笔86/98 + 双拼4
    })

    it('count 为快捷键总数且大于 0', () => {
      const groups = getGroups()
      for (const g of groups) {
        expect(g.count).toBeGreaterThan(0)
      }
    })

    it('每个域有 icon 和 description', () => {
      const groups = getGroups()
      for (const g of groups) {
        expect(g.icon).toBeTruthy()
        expect(g.description).toBeTruthy()
      }
    })
  })
})

// 小鹤双拼 26 键位 fixture（真实 description，用于解析声韵母映射）
const XIAOHE_KEY_ITEMS: ShortcutItem[] = (
  [
    ['Q', '韵母：iu'], ['W', '韵母：ei'], ['E', '零声母：e'], ['R', '韵母：uan / üan'],
    ['T', '韵母：ue / üe'], ['Y', '韵母：un / ün'], ['U', '声母：sh / 韵母：u'], ['I', '声母：ch / 韵母：i'],
    ['O', '韵母：uo / o'], ['P', '韵母：ie'], ['A', '零声母：a'], ['S', '韵母：ong / iong'],
    ['D', '韵母：ai'], ['F', '韵母：en'], ['G', '韵母：eng'], ['H', '韵母：ang'],
    ['J', '韵母：an'], ['K', '韵母：ing / 韵母：uai'], ['L', '韵母：iang / uang'], ['Z', '韵母：ou'],
    ['X', '韵母：ia / ua'], ['C', '韵母：ao'], ['V', '声母：zh / 韵母：ui / 韵母：ü'], ['B', '韵母：in'],
    ['N', '韵母：iao'], ['M', '韵母：ian'],
  ] as Array<[string, string]>
).map(([k, d]) => ({
  id: `sp-xh-${k}`, category: '双拼 · 小鹤', functionName: `${k}键`,
  description: d, keys: [k], platform: 'common' as const,
}))

describe('双拼编码生成（单元）', () => {
  const map = buildShuangpinMap(XIAOHE_KEY_ITEMS)

  describe('buildShuangpinMap', () => {
    it('解析韵母 -> 键', () => {
      expect(map.yunmu.get('iu')).toBe('Q')
      expect(map.yunmu.get('ai')).toBe('D')
      expect(map.yunmu.get('ong')).toBe('S')
      expect(map.yunmu.get('ou')).toBe('Z')
    })

    it('解析声母 zh/ch/sh -> V/I/U', () => {
      expect(map.shengmu.get('zh')).toBe('V')
      expect(map.shengmu.get('ch')).toBe('I')
      expect(map.shengmu.get('sh')).toBe('U')
    })

    it('默认声母（b/p/m/...）同字母键', () => {
      expect(map.shengmu.get('b')).toBe('B')
      expect(map.shengmu.get('d')).toBe('D')
      expect(map.shengmu.get('w')).toBe('W')
    })

    it('零声母 a/e 同时作韵母（声母+e 如"的"=DE）', () => {
      expect(map.zeros.get('a')).toBe('A')
      expect(map.zeros.get('e')).toBe('E')
      expect(map.yunmu.get('e')).toBe('E')
      expect(map.yunmu.get('a')).toBe('A')
    })
  })

  describe('pinyinToShuangpin', () => {
    it('有声母字：的=DE、我=WO', () => {
      expect(pinyinToShuangpin('de', map)).toEqual(['D', 'E'])
      expect(pinyinToShuangpin('wo', map)).toEqual(['W', 'O'])
    })

    it('zh/ch/sh 声母：是=UI、中=VS、上=UG', () => {
      expect(pinyinToShuangpin('shi', map)).toEqual(['U', 'I'])
      expect(pinyinToShuangpin('zhong', map)).toEqual(['V', 'S'])
      expect(pinyinToShuangpin('sheng', map)).toEqual(['U', 'G'])
    })

    it('零声母单韵母跳过：啊/哦/鹅=null', () => {
      expect(pinyinToShuangpin('a', map)).toBeNull()
      expect(pinyinToShuangpin('o', map)).toBeNull()
      expect(pinyinToShuangpin('e', map)).toBeNull()
    })

    it('零声母有韵母：爱=AD、安=AJ', () => {
      expect(pinyinToShuangpin('ai', map)).toEqual(['A', 'D'])
      expect(pinyinToShuangpin('an', map)).toEqual(['A', 'J'])
    })

    it('韵母映射不到时返回 null', () => {
      expect(pinyinToShuangpin('xxx', map)).toBeNull()
    })
  })

  describe('generateShuangpinPracticeItems', () => {
    const items = generateShuangpinPracticeItems('双拼 · 小鹤', XIAOHE_KEY_ITEMS)

    it('生成常用字/生僻字/易错字/词组/一级简码五类条目', () => {
      const tags = new Set(items.flatMap(i => i.tags || []))
      expect(tags.has('常用字')).toBe(true)
      expect(tags.has('生僻字')).toBe(true)
      expect(tags.has('易错字')).toBe(true)
      expect(tags.has('词组')).toBe(true)
      expect(tags.has('一级简码')).toBe(true)
    })

    it('生僻字"耄"编码 MC 且带生僻字 tag', () => {
      const mao = items.find(i => i.functionName === '耄')
      expect(mao?.keys).toEqual(['M', 'C'])
      expect(mao?.tags).toContain('生僻字')
    })

    it('易错字"己"编码 JI 且带易错字 tag', () => {
      const ji = items.find(i => i.functionName === '己')
      expect(ji?.keys).toEqual(['J', 'I'])
      expect(ji?.tags).toContain('易错字')
    })

    it('一级简码 26 条（每键一个）', () => {
      expect(items.filter(i => i.tags?.includes('一级简码')).length).toBe(26)
    })

    it('常用字"的"编码 DE 且带常用字 tag', () => {
      const de = items.find(i => i.functionName === '的')
      expect(de?.keys).toEqual(['D', 'E'])
      expect(de?.tags).toContain('常用字')
    })

    it('词组"我们"编码 W O M F 且带词组 tag', () => {
      const women = items.find(i => i.functionName === '我们')
      expect(women?.keys).toEqual(['W', 'O', 'M', 'F'])
      expect(women?.tags).toContain('词组')
    })

    it('所有条目 id 唯一', () => {
      const ids = items.map(i => i.id)
      expect(new Set(ids).size).toBe(ids.length)
    })
  })
})

describe('extractYunmu 韵母提取', () => {
  it('提取纯韵母描述', () => {
    expect(extractYunmu('韵母：iu')).toBe('iu')
    expect(extractYunmu('韵母：ue / ve')).toBe('ue\nve')
  })

  it('提取零声母', () => {
    expect(extractYunmu('零声母：e')).toBe('e')
    expect(extractYunmu('零声母：a')).toBe('a')
  })

  it('提取声母+韵母描述中的韵母', () => {
    expect(extractYunmu('声母：sh / 韵母：ui')).toBe('ui')
    expect(extractYunmu('声母：zh / 韵母：ui')).toBe('ui')
  })

  it('多个韵母段（如 K/V 键）只保留拼音并换行', () => {
    expect(extractYunmu('韵母：ing / 韵母：uai')).toBe('ing\nuai')
    expect(extractYunmu('声母：zh / 韵母：ui / 韵母：ü')).toBe('ui\nü')
  })

  it('过滤说明性汉字只保留拼音字母', () => {
    expect(extractYunmu('韵母：ing（后鼻音）')).toBe('ing')
    expect(extractYunmu('韵母： ao')).toBe('ao')
  })

  it('空或不匹配返回空字符串', () => {
    expect(extractYunmu('')).toBe('')
    expect(extractYunmu('复制选中的内容')).toBe('')
  })
})

describe('extractShuangpinKeyHint 双拼键位提示', () => {
  it('U/I/V 优先显示声母 sh/ch/zh', () => {
    expect(extractShuangpinKeyHint('U', '声母：sh / 韵母：u')).toBe('sh')
    expect(extractShuangpinKeyHint('I', '声母：ch / 韵母：i')).toBe('ch')
    expect(extractShuangpinKeyHint('V', '声母：zh / 韵母：ui / 韵母：ü')).toBe('zh')
  })

  it('其他键显示韵母', () => {
    expect(extractShuangpinKeyHint('Q', '韵母：iu')).toBe('iu')
    expect(extractShuangpinKeyHint('S', '韵母：ong / iong')).toBe('ong\niong')
    expect(extractShuangpinKeyHint('A', '零声母：a')).toBe('a')
  })
})

describe('extractPinyinHint 拼音提示提取', () => {
  it('从常用字描述中提取拼音', () => {
    expect(extractPinyinHint('常用字，zhong -> vs')).toBe('zhong')
    expect(extractPinyinHint('常用字，de -> de')).toBe('de')
  })

  it('从词组描述中提取多字拼音', () => {
    expect(extractPinyinHint('词组，wo men -> womf')).toBe('wo men')
  })

  it('一级简码等无拼音映射返回空字符串', () => {
    expect(extractPinyinHint('一级简码，V键 + 空格')).toBe('')
    expect(extractPinyinHint('')).toBe('')
  })
})

describe('extractWubiKeyHint 五笔字根提示', () => {
  it('从 functionName 中提取字根', () => {
    expect(extractWubiKeyHint('G键 · 王')).toBe('王')
    expect(extractWubiKeyHint('F键 · 土')).toBe('土')
    expect(extractWubiKeyHint('Z键 · 万能键')).toBe('万能键')
  })

  it('非基础键位返回空字符串', () => {
    expect(extractWubiKeyHint('中')).toBe('')
    expect(extractWubiKeyHint('')).toBe('')
  })
})

describe('getWubiKeyHints 五笔键位字根列表', () => {
  it('按数据顺序收集每个键的全部字根', () => {
    const hints = getWubiKeyHints('五笔86版')
    expect(hints['G']).toEqual(['王', '五', '一', '戋'])
    expect(hints['F']).toEqual(['土', '士', '二', '干', '十', '寸', '雨'])
    expect(hints['Z']).toEqual(['万能键'])
  })

  it('过滤常用字/词组等非基础键位条目', () => {
    const hints = getWubiKeyHints('五笔86版')
    // 常用字条目不会被当作基础键位字根
    const allHints = Object.values(hints).flat()
    expect(allHints).not.toContain('中')
    expect(allHints).not.toContain('中国')
  })
})

describe('getWubiRootHints 五笔拆字字根提示', () => {
  it('基础键位条目返回当前字根', () => {
    const item: ShortcutItem = { id: '1', category: '五笔86版', functionName: 'G键 · 王', description: '', keys: ['G'], platform: 'common' }
    expect(getWubiRootHints(item, '五笔86版')).toEqual(['王'])
  })

  it('优先使用条目自身的 rootHints', () => {
    const item: ShortcutItem = { id: '2', category: '五笔86版', functionName: '中', description: '', keys: ['K'], platform: 'common', rootHints: ['口'] }
    expect(getWubiRootHints(item, '五笔86版')).toEqual(['口'])
  })

  it('无 rootHints 时按 keys 顺序回退到每键第一个基础字根', () => {
    const item: ShortcutItem = { id: '3', category: '五笔86版', functionName: '未知', description: '', keys: ['G', 'F'], platform: 'common' }
    expect(getWubiRootHints(item, '五笔86版')).toEqual(['王', '土'])
  })
})

describe('loadAllShortcuts 集成（黑箱）', () => {
  const wubiFixture: ShortcutItem[] = [
    { id: 'wubi86-G-1', category: '五笔86版', tags: ['横区'], functionName: 'G键 · 王', description: '字根：王', keys: ['G'], platform: 'common' },
    { id: 'wubi86-char-G', category: '五笔86版', tags: ['常用字'], functionName: '一', description: '一级简码 G + 空格', keys: ['G'], platform: 'common' },
    { id: 'wubi86-word-1', category: '五笔86版', tags: ['词组'], functionName: '中国', description: '二字词', keys: ['K', 'H', 'L', 'G'], platform: 'common' },
    { id: 'wubi86-word-2', category: '五笔86版', tags: ['词组'], functionName: '人民', description: '二字词', keys: ['W', 'W', 'N', 'A'], platform: 'common' },
    { id: 'wubi86-word-3', category: '五笔86版', tags: ['词组'], functionName: '学习', description: '二字词', keys: ['I', 'P', 'N', 'U'], platform: 'common' },
    { id: 'wubi86-word-4', category: '五笔86版', tags: ['词组'], functionName: '工作', description: '二字词', keys: ['A', 'A', 'W', 'T'], platform: 'common' },
  ]
  const files: Record<string, unknown> = {
    '/shortcuts/index.json': [
      { name: '双拼 · 小鹤', file: 'shuangpin-xiaohe.json', group: '输入法' },
      { name: '五笔86版', file: 'wubi86.json', group: '输入法' },
    ],
    '/shortcuts/shuangpin-xiaohe.json': XIAOHE_KEY_ITEMS,
    '/shortcuts/wubi86.json': wubiFixture,
  }

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => ({
      ok: true,
      json: async () => files[url] ?? [],
    })))
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('五笔常用字按编码首字母补分区 tag（"一"=G->横区），原 tag 保留', async () => {
    await loadAllShortcuts(true)
    const yi = getShortcutsByCategory('五笔86版').find(s => s.functionName === '一')
    expect(yi?.tags).toContain('横区')
    expect(yi?.tags).toContain('常用字')
  })

  it('五笔字根原有分区 tag 不重复', async () => {
    await loadAllShortcuts(true)
    const wang = getShortcutsByCategory('五笔86版').find(s => s.functionName === 'G键 · 王')
    expect(wang?.tags?.filter(t => t === '横区').length).toBe(1)
  })

  it('五笔 1 键常用字补「一级简码」tag', async () => {
    await loadAllShortcuts(true)
    const yi = getShortcutsByCategory('五笔86版').find(s => s.functionName === '一')
    expect(yi?.tags).toContain('一级简码')
    expect(yi?.tags).toContain('常用字')
  })

  it('五笔词组拆为「一级词组/二级词组」（前一半为一级）', async () => {
    await loadAllShortcuts(true)
    const words = getShortcutsByCategory('五笔86版').filter(s => s.tags?.includes('词组'))
    const l1 = words.filter(s => s.tags?.includes('一级词组'))
    const l2 = words.filter(s => s.tags?.includes('二级词组'))
    // 4 个词组 -> 一级 2 + 二级 2
    expect(l1.length).toBe(2)
    expect(l2.length).toBe(2)
    // 原词组 tag 保留
    expect(words.every(s => s.tags?.includes('词组'))).toBe(true)
    // 顺序：前两个为一级
    expect(l1.map(s => s.functionName)).toEqual(['中国', '人民'])
    expect(l2.map(s => s.functionName)).toEqual(['学习', '工作'])
  })

  it('双拼词组也拆为「一级词组/二级词组」', async () => {
    await loadAllShortcuts(true)
    const words = getShortcutsByCategory('双拼 · 小鹤').filter(s => s.tags?.includes('词组'))
    expect(words.filter(s => s.tags?.includes('一级词组')).length).toBeGreaterThan(0)
    expect(words.filter(s => s.tags?.includes('二级词组')).length).toBeGreaterThan(0)
  })

  it('双拼生成常用字/词组/一级简码条目', async () => {
    await loadAllShortcuts(true)
    const sp = getShortcutsByCategory('双拼 · 小鹤')
    expect(sp.filter(s => s.tags?.includes('常用字')).length).toBeGreaterThan(0)
    expect(sp.filter(s => s.tags?.includes('词组')).length).toBeGreaterThan(0)
    expect(sp.filter(s => s.tags?.includes('一级简码')).length).toBe(26)
  })

  it('双拼常用字"的"端到端编码 DE', async () => {
    await loadAllShortcuts(true)
    const de = getShortcutsByCategory('双拼 · 小鹤').find(s => s.functionName === '的')
    expect(de?.keys).toEqual(['D', 'E'])
  })

  it('双拼生成的条目 group=输入法', async () => {
    await loadAllShortcuts(true)
    const sp = getShortcutsByCategory('双拼 · 小鹤')
    expect(sp.length).toBeGreaterThan(0)
    for (const s of sp) {
      expect(s.group).toBe('输入法')
    }
  })
})
