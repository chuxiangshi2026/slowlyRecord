/**
 * 首页快速入口注册表单测
 * 覆盖：默认回退、用户选择持久化、失效 id 过滤、空选择被尊重
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { QUICK_ENTRIES, DEFAULT_QUICK_ENTRY_IDS, loadQuickEntryIds, saveQuickEntryIds } from '@/utils/home-quick-entries'

let stored: Record<string, unknown> = {}

beforeEach(() => {
  stored = {}
  ;(globalThis as any).uni = {
    getStorageSync: (key: string) => (key in stored ? stored[key] : ''),
    setStorageSync: (key: string, value: unknown) => { stored[key] = value },
  }
})

afterEach(() => {
  delete (globalThis as any).uni
})

describe('loadQuickEntryIds', () => {
  it('从未设置过时回退默认 8 项', () => {
    expect(loadQuickEntryIds()).toEqual(DEFAULT_QUICK_ENTRY_IDS)
    expect(DEFAULT_QUICK_ENTRY_IDS).toHaveLength(8)
  })

  it('读取用户已保存的选择', () => {
    stored['home-quick-entries'] = ['speak', 'focus']
    expect(loadQuickEntryIds()).toEqual(['speak', 'focus'])
  })

  it('空数组选择被尊重（不回退默认）', () => {
    stored['home-quick-entries'] = []
    expect(loadQuickEntryIds()).toEqual([])
  })

  it('失效 id 自动过滤', () => {
    stored['home-quick-entries'] = ['speak', 'removed-entry', 123, 'focus']
    expect(loadQuickEntryIds()).toEqual(['speak', 'focus'])
  })

  it('存储数据损坏（非数组）回退默认', () => {
    stored['home-quick-entries'] = 'oops'
    expect(loadQuickEntryIds()).toEqual(DEFAULT_QUICK_ENTRY_IDS)
  })
})

describe('saveQuickEntryIds', () => {
  it('保存后可读回', () => {
    saveQuickEntryIds(['speak'])
    expect(loadQuickEntryIds()).toEqual(['speak'])
  })
})

describe('注册表完整性', () => {
  it('id 不重复，默认项都存在于注册表', () => {
    const ids = QUICK_ENTRIES.map((e) => e.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of DEFAULT_QUICK_ENTRY_IDS) {
      expect(ids).toContain(id)
    }
  })
})
