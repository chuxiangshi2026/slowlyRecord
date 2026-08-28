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

    it('五笔 tags 仅含横/竖/撇/捺/折区或万能键', () => {
      const valid = new Set(['横区', '竖区', '撇区', '捺区', '折区', '万能键'])
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
