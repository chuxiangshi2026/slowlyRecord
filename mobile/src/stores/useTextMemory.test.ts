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

describe('useTextMemory 大文档与写失败', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    storage.clear()
    ;(global as any).uni.showToast = vi.fn()
  })

  it('多字节大文档按 UTF-8 分片存储并可完整重组', () => {
    const store = useTextMemory()
    const content = '诗'.repeat(400_000)

    store.addArticle({ title: '长文', content })

    const main = storage.get(STORAGE_KEY)
    expect(main._chunkKeys.length).toBeGreaterThan(1)
    const restored = JSON.parse(main._chunkKeys.map((key: string) => storage.get(key)).join(''))
    expect(restored.articles[0].content).toBe(content)
  })

  it('分片写入后重新创建 store 加载，文章内容不丢失', () => {
    const content = '词'.repeat(400_000)

    // 第一次会话：写入大文档
    const writer = useTextMemory()
    writer.addArticle({ title: '长文', content })

    // 模拟退出页面：内存状态废弃，只保留 storage
    setActivePinia(createPinia())

    // 第二次会话：重新加载必须通过适配器还原分片
    const reader = useTextMemory()
    reader.load()

    expect(reader.articles).toHaveLength(1)
    expect(reader.articles[0].title).toBe('长文')
    expect(reader.articles[0].content).toBe(content)
  })

  it('分片损坏时 load 不静默当作空数据', () => {
    const content = '字'.repeat(400_000)
    const writer = useTextMemory()
    writer.addArticle({ title: '长文', content })

    // 模拟丢一个分片（如小程序清理 storage）
    const main = storage.get(STORAGE_KEY)
    storage.delete(main._chunkKeys[0])

    setActivePinia(createPinia())
    const reader = useTextMemory()
    reader.load()

    // 适配器读不到完整正文 → 视为无数据，而非返回空 articles 的"假象"
    expect(reader.articles).toHaveLength(0)
    expect(uni.showToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: expect.stringContaining('数据') }),
    )
  })

  it('写失败时不抛出异常并提示数据尚未持久化', () => {
    vi.mocked(uni.setStorageSync).mockImplementation(() => { throw new Error('quota exceeded') })
    const store = useTextMemory()

    expect(() => store.addArticle({ title: '失败', content: '内容' })).not.toThrow()
    expect(uni.showToast).toHaveBeenCalledWith(expect.objectContaining({ title: expect.stringContaining('保存失败') }))
  })
})
