import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const docs = new Map<string, any>()

vi.mock('@/adapters/index', () => ({
  getDbAdapter: () => ({
    get: (id: string) => docs.get(id),
    allDocs: (prefix?: string) => [...docs.values()].filter(doc => !prefix || String(doc._id).startsWith(prefix)),
    put: (doc: any) => { docs.set(doc._id, { ...doc, _rev: 'r1' }); return { ok: true, rev: 'r1', id: doc._id } },
    remove: (doc: any) => { docs.delete(typeof doc === 'string' ? doc : doc._id); return { ok: true } },
  }),
}))

import { useWordBook } from './useWordBook'

const words = [{ sourceId: 's1', text: 'fold', explains: '折叠' }]

describe('移动端 wordBook store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    docs.clear()
  })

  it('书 → 章 → 页 的创建与读取', () => {
    const store = useWordBook()
    store.load(true)
    const book = store.createBook('四级词根')
    const chapter = store.createChapter(book._id, '词根 old')
    const page = store.createPage({
      bookId: book._id, chapterId: chapter._id, name: 'old 篇',
      key: { type: 'root', value: 'old' }, words, source: {},
    })

    expect(store.sortedBooks.map(b => b.name)).toEqual(['四级词根'])
    expect(store.chaptersOf(book._id).map(c => c.name)).toEqual(['词根 old'])
    expect(store.pagesOf(chapter._id).map(p => p.name)).toEqual(['old 篇'])
    expect(page.order).toBe(1)
  })

  it('完成页后写入页级调度与关卡达成', () => {
    const store = useWordBook()
    store.load(true)
    const book = store.createBook('书')
    const chapter = store.createChapter(book._id, '章')
    store.setChapterLevelSize(chapter._id, 1)
    const page = store.createPage({
      bookId: book._id, chapterId: chapter._id, name: 'old 篇',
      key: { type: 'root', value: 'old' }, words, source: {},
    })

    expect(store.completePage(page._id, 0).ok).toBe(true)
    expect(store.getPage(page._id)!.level).toBe(1)
    expect(store.getChapter(chapter._id)!.levels).toHaveLength(1)
  })

  it('删除书级联清掉章与页', () => {
    const store = useWordBook()
    store.load(true)
    const book = store.createBook('书')
    const chapter = store.createChapter(book._id, '章')
    store.createPage({
      bookId: book._id, chapterId: chapter._id, name: 'old 篇',
      key: { type: 'root', value: 'old' }, words, source: {},
    })

    expect(store.deleteBook(book._id).ok).toBe(true)
    expect(store.sortedBooks).toHaveLength(0)
    expect(store.chapters).toHaveLength(0)
    expect(store.pages).toHaveLength(0)
  })
})
