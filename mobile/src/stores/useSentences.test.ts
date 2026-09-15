/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// Mock uni API（句子库走 uni.getStorageSync / uni.setStorageSync）
const mockStorage = new Map<string, any>()
;(global as any).uni = {
  setStorageSync: vi.fn((key: string, data: any) => { mockStorage.set(key, data) }),
  getStorageSync: vi.fn((key: string) => mockStorage.get(key) ?? null),
  removeStorageSync: vi.fn((key: string) => { mockStorage.delete(key) }),
}

import { useSentences } from './useSentences'

const STORAGE_KEY = 'slowlyrecord-sentences-data'

describe('useSentences 句子收藏', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockStorage.clear()
  })

  it('addSentence 自动判定语言并持久化', () => {
    const store = useSentences()
    store.load()

    const zh = store.addSentence('路漫漫其修远兮')!
    const en = store.addSentence('To be or not to be', '生存还是毁灭')!

    expect(zh.lang).toBe('zh')
    expect(en.lang).toBe('en')
    expect(en.translation).toBe('生存还是毁灭')
    expect(store.sentences.length).toBe(2)

    const saved = mockStorage.get(STORAGE_KEY)
    expect(saved.sentences.length).toBe(2)
  })

  it('addSentence 空白文本不入库', () => {
    const store = useSentences()
    store.load()
    expect(store.addSentence('   ')).toBeNull()
    expect(store.sentences.length).toBe(0)
  })

  it('toggleFavorite 切换收藏', () => {
    const store = useSentences()
    store.load()
    const s = store.addSentence('hello')!

    expect(store.toggleFavorite(s.id)).toBe(true)
    expect(store.sentences[0].favorite).toBe(true)
    expect(store.toggleFavorite('不存在')).toBe(false)
  })

  it('sortedSentences 收藏优先，其余按创建时间倒序', async () => {
    const store = useSentences()
    store.load()
    const a = store.addSentence('第一句')!
    await new Promise((r) => setTimeout(r, 5))
    const b = store.addSentence('第二句')!
    await new Promise((r) => setTimeout(r, 5))
    const c = store.addSentence('第三句')!

    // 未收藏时新的在前
    expect(store.sortedSentences[0].id).toBe(c.id)

    store.toggleFavorite(a.id)
    // 收藏后 a 排最前
    expect(store.sortedSentences[0].id).toBe(a.id)
    expect(store.sortedSentences[1].id).toBe(c.id)
    expect(store.sortedSentences[2].id).toBe(b.id)
  })

  it('load 只初始化一次，重复调用不覆盖内存数据', () => {
    const store = useSentences()
    store.load()
    store.addSentence('内存中的句子')
    // 外部改掉 storage，再次 load 不应覆盖
    mockStorage.set(STORAGE_KEY, { sentences: [], updatedAt: 0 })
    store.load()
    expect(store.sentences.length).toBe(1)
  })

  it('collect 空库返回 null，有数据时返回快照', () => {
    const store = useSentences()
    store.load()
    expect(store.collect()).toBeNull()

    store.addSentence('待同步句子')
    const data = store.collect()!
    expect(data.sentences.length).toBe(1)
    expect(data.sentences[0].text).toBe('待同步句子')
  })

  it('restore 按 id 合并去重并持久化', () => {
    const store = useSentences()
    store.load()
    const local = store.addSentence('本地句子')!

    const added = store.restore({
      sentences: [
        { ...local, text: '远端改过的版本' }, // 同 id：保留本地
        { id: 'sent_remote_1', text: '远端新句子', lang: 'zh', tags: [], favorite: true, createdAt: 1 },
      ],
    })

    expect(added).toBe(1)
    expect(store.sentences.length).toBe(2)
    expect(store.sentences.find((s) => s.id === local.id)!.text).toBe('本地句子')
    expect(store.sentences.find((s) => s.id === 'sent_remote_1')!.favorite).toBe(true)
    // 已写回 storage
    expect(mockStorage.get(STORAGE_KEY).sentences.length).toBe(2)
  })
})
