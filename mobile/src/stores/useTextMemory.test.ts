/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const storage = new Map<string, any>()
;(global as any).uni = {
  setStorageSync: vi.fn((key: string, data: any) => { storage.set(key, data) }),
  getStorageSync: vi.fn((key: string) => storage.get(key) ?? null),
  removeStorageSync: vi.fn((key: string) => { storage.delete(key) }),
}

import { useTextMemory } from './useTextMemory'

const STORAGE_KEY = 'slowlyrecord-textmemory-data'

describe('useTextMemory 同步恢复统计', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    storage.clear()
  })

  it('分别统计文章、笔记和提示词，不把笔记算成文章', () => {
    storage.set(STORAGE_KEY, {
      articles: [],
      notes: [],
      prompts: [],
      updatedAt: 0,
    })
    const store = useTextMemory()
    store.load()

    const result = store.restore({
      articles: [{
        _id: 'article-1',
        title: '文章',
        content: '正文',
        tags: [],
        ctime: 100,
        utime: 100,
        reviewCount: 0,
      }],
      notes: [{
        _id: 'note-1',
        articleId: 'article-1',
        content: '笔记',
        ctime: 100,
        utime: 100,
      }],
      prompts: [{
        _id: 'prompt-1',
        articleId: 'article-1',
        title: '提示',
        content: '提示内容',
        order: 1,
        enabled: true,
        ctime: 100,
      }],
    })

    expect(result.addedArticles).toBe(1)
    expect(result.addedNotes).toBe(1)
    expect(result.addedPrompts).toBe(1)
    expect(result.added).toBe(1)
    expect(store.articles).toHaveLength(1)
    expect(store.notes).toHaveLength(1)
    expect(store.prompts).toHaveLength(1)
  })

  it('应用墓碑删除本地已有文章', () => {
    storage.set(STORAGE_KEY, {
      articles: [{
        _id: 'article-dead',
        title: '已删文章',
        content: '正文',
        tags: [],
        ctime: 100,
        utime: 100,
        reviewCount: 0,
      }],
      notes: [],
      prompts: [],
      updatedAt: 100,
    })
    const store = useTextMemory()
    store.load()

    store.restore({ articles: [], notes: [], prompts: [] }, 'merge', {
      'article-dead': 200,
    })

    expect(store.articles).toHaveLength(0)
  })
})
