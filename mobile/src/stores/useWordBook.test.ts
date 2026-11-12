import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const docs = new Map<string, any>()
const dbState = vi.hoisted(() => ({ failPut: false, failRemoveId: '' }))

vi.mock('@/adapters/index', () => ({
  getDbAdapter: () => ({
    get: (id: string) => docs.get(id),
    allDocs: (prefix?: string) => [...docs.values()].filter(doc => !prefix || String(doc._id).startsWith(prefix)),
    put: (doc: any) => {
      if (dbState.failPut) return { ok: false, error: true, message: 'disk full' }
      docs.set(doc._id, { ...doc, _rev: 'r1' })
      return { ok: true, rev: 'r1', id: doc._id }
    },
    remove: (doc: any) => {
      const id = typeof doc === 'string' ? doc : doc._id
      if (id === dbState.failRemoveId) return { ok: false, error: true, message: 'remove failed' }
      docs.delete(id)
      return { ok: true }
    },
    promises: {
      put: async (doc: any) => {
        if (dbState.failPut) return { ok: false, error: true, message: 'disk full' }
        docs.set(doc._id, { ...doc, _rev: 'r1' })
        return { ok: true, rev: 'r1', id: doc._id }
      },
    },
  }),
}))

import { useWordBook } from './useWordBook'

const words = [{ sourceId: 's1', text: 'fold', explains: '折叠' }]

describe('移动端 wordBook store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    docs.clear()
    dbState.failPut = false
    dbState.failRemoveId = ''
  })

  it('书 → 章 → 页 的创建与读取', () => {
    const store = useWordBook()
    store.load(true)
    const book = store.createBook('四级词根')!
    const chapter = store.createChapter(book._id, '词根 old')!
    const page = store.createPage({
      bookId: book._id, chapterId: chapter._id, name: 'old 篇',
      key: { type: 'root', value: 'old' }, words, source: {},
    })!

    expect(store.sortedBooks.map(b => b.name)).toEqual(['四级词根'])
    expect(store.chaptersOf(book._id).map(c => c.name)).toEqual(['词根 old'])
    expect(store.pagesOf(chapter._id).map(p => p.name)).toEqual(['old 篇'])
    expect(page.order).toBe(1)
  })

  it('完成页后写入页级调度与关卡达成', () => {
    const store = useWordBook()
    store.load(true)
    const book = store.createBook('书')!
    const chapter = store.createChapter(book._id, '章')!
    store.setChapterLevelSize(chapter._id, 1)
    const page = store.createPage({
      bookId: book._id, chapterId: chapter._id, name: 'old 篇',
      key: { type: 'root', value: 'old' }, words, source: {},
    })!

    expect(store.completePage(page._id, 0).ok).toBe(true)
    expect(store.getPage(page._id)!.level).toBe(1)
    expect(store.getChapter(chapter._id)!.levels).toHaveLength(1)
  })

  it('删除书级联清掉章与页', () => {
    const store = useWordBook()
    store.load(true)
    const book = store.createBook('书')!
    const chapter = store.createChapter(book._id, '章')!
    store.createPage({
      bookId: book._id, chapterId: chapter._id, name: 'old 篇',
      key: { type: 'root', value: 'old' }, words, source: {},
    })

    expect(store.deleteBook(book._id).ok).toBe(true)
    expect(store.sortedBooks).toHaveLength(0)
    expect(store.chapters).toHaveLength(0)
    expect(store.pages).toHaveLength(0)
  })

  it('创建写入失败时返回 null，不污染内存状态', () => {
    const store = useWordBook()
    store.load(true)
    dbState.failPut = true
    expect(store.createBook('失败词集')).toBeNull()
    expect(store.sortedBooks).toHaveLength(0)

    dbState.failPut = false
    const book = store.createBook('正常词集')!
    expect(store.createChapter(book._id, '失败章节')).not.toBeNull()
    dbState.failPut = true
    expect(store.createChapter(book._id, '再失败章节')).toBeNull()
    const chapter = store.chaptersOf(book._id)[0]
    expect(store.createPage({
      bookId: book._id, chapterId: chapter._id, name: '失败页',
      key: { type: 'text', value: '' }, words, source: {},
    })).toBeNull()
    expect(store.pages).toHaveLength(0)
  })

  it('词集可收集为同步包，并按 _id 与 utime 合并恢复', () => {
    const store = useWordBook()
    store.load(true)
    const book = store.createBook('同步书')!
    const chapter = store.createChapter(book._id, '同步章')!
    store.createPage({
      bookId: book._id, chapterId: chapter._id, name: 'old 篇',
      key: { type: 'root', value: 'old' }, words, source: {},
    })

    const sync = store.collectSync()!
    expect(sync.schemaVersion).toBe(1)
    expect(sync.books).toHaveLength(1)
    expect(sync.chapters).toHaveLength(1)
    expect(sync.pages).toHaveLength(1)

    const stale = { ...sync, books: sync.books.map(item => ({ ...item, name: '旧名字', utime: 1 })) }
    expect(store.restoreSync(stale)).toBe(0)
    expect(store.getBook(book._id)!.name).toBe('同步书')

    const fresh = {
      ...sync,
      books: sync.books.map(item => ({ ...item, name: '远端新名字', utime: item.utime + 1 })),
      chapters: sync.chapters.map(item => ({ ...item, name: '远端新章节', utime: item.utime + 1 })),
      pages: sync.pages.map(item => ({ ...item, name: '远端新页', utime: item.utime + 1 })),
    }
    expect(store.restoreSync(fresh)).toBe(3)
    expect(store.getBook(book._id)!.name).toBe('远端新名字')
    expect(store.getChapter(chapter._id)!.name).toBe('远端新章节')
    expect(store.pages[0].name).toBe('远端新页')
    expect(() => store.restoreSync({ ...sync, schemaVersion: 99 })).toThrow('不支持的词集数据版本')
  })

  it('同步恢复拒绝类型不匹配的文档', () => {
    const store = useWordBook()
    store.load(true)
    const sync = store.collectSync() || { schemaVersion: 1, books: [], chapters: [], pages: [] }
    const corrupted = {
      ...sync,
      books: [{
        _id: 'wb_book_evil',
        type: 'wb_page',
        name: '伪装词集',
        order: 0,
        ctime: 1,
        utime: 2,
      }],
    }
    expect(store.restoreSync(corrupted as any)).toBe(0)
    expect(store.getBook('wb_book_evil')).toBeUndefined()
  })

  it('级联删除部分失败时返回错误、刷新内存并给已删页写墓碑', async () => {
    const store = useWordBook()
    store.load(true)
    const book = store.createBook('书')!
    const chapter = store.createChapter(book._id, '章')!
    const first = store.createPage({ bookId: book._id, chapterId: chapter._id, name: '页一', key: { type: 'text', value: '' }, words, source: {} })!
    const second = store.createPage({ bookId: book._id, chapterId: chapter._id, name: '页二', key: { type: 'text', value: '' }, words, source: {} })!
    dbState.failRemoveId = second._id

    expect(store.deleteBook(book._id).ok).toBe(false)
    expect(store.getPage(first._id)).toBeUndefined()
    expect(store.getPage(second._id)).toBeTruthy()
    expect(store.getBook(book._id)).toBeTruthy()
    expect(store.getChapter(chapter._id)).toBeTruthy()
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(docs.get('slowly-record-sync-tombstones')?.tombstones?.[first._id]).toBeTypeOf('number')
    expect(docs.get('slowly-record-sync-tombstones')?.tombstones?.[second._id]).toBeUndefined()
  })

  it('同步写入失败时抛错而不是静默报告成功', () => {
    const store = useWordBook()
    store.load(true)
    const book = store.createBook('书')!
    const chapter = store.createChapter(book._id, '章')!
    store.createPage({ bookId: book._id, chapterId: chapter._id, name: '页', key: { type: 'text', value: '' }, words, source: {} })
    const sync = store.collectSync()!
    const remote = { ...sync, pages: sync.pages.map(item => ({ ...item, utime: item.utime + 1000 })) }
    dbState.failPut = true
    expect(() => store.restoreSync(remote)).toThrow('disk full')
  })

  it('同步恢复按墓碑删除本地旧数据并阻止旧快照回流', () => {
    const store = useWordBook()
    store.load(true)
    const book = store.createBook('书')!
    const chapter = store.createChapter(book._id, '章')!
    const page = store.createPage({ bookId: book._id, chapterId: chapter._id, name: '页', key: { type: 'text', value: '' }, words, source: {} })!
    const sync = store.collectSync()!
    const deletedAt = Date.now() + 1000

    expect(store.restoreSync(sync, { [book._id]: deletedAt, [chapter._id]: deletedAt, [page._id]: deletedAt })).toBe(3)
    expect(store.books).toHaveLength(0)
    expect(store.chapters).toHaveLength(0)
    expect(store.pages).toHaveLength(0)
    expect(docs.has(book._id)).toBe(false)
    expect(docs.has(chapter._id)).toBe(false)
    expect(docs.has(page._id)).toBe(false)
  })

  it('拒绝创建书章不匹配的孤儿数据', () => {
    const store = useWordBook()
    store.load(true)
    expect(store.createChapter('missing', '孤儿章')).toBeNull()
    const book = store.createBook('书')!
    expect(store.createPage({ bookId: book._id, chapterId: 'missing', name: '孤儿页', key: { type: 'text', value: '' }, words, source: {} })).toBeNull()
  })
})
