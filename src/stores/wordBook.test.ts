import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const db = vi.hoisted(() => ({
  books: [] as any[],
  chapters: [] as any[],
  pages: [] as any[],
  okay: { ok: true } as any,
}))

vi.mock('@/utils/word-book-db', () => ({
  getAllBooks: vi.fn(async () => db.books),
  getAllChapters: vi.fn(async () => db.chapters),
  getAllPages: vi.fn(async () => db.pages),
  saveBook: vi.fn(async (doc: any) => { db.books = [...db.books.filter(b => b._id !== doc._id), doc]; return db.okay }),
  saveChapter: vi.fn(async (doc: any) => { db.chapters = [...db.chapters.filter(c => c._id !== doc._id), doc]; return db.okay }),
  savePage: vi.fn(async (doc: any) => { db.pages = [...db.pages.filter(p => p._id !== doc._id), doc]; return db.okay }),
  removeBookCascade: vi.fn(async (id: string) => {
    db.books = db.books.filter(b => b._id !== id)
    db.chapters = db.chapters.filter(c => c.bookId !== id)
    db.pages = db.pages.filter(p => p.bookId !== id)
    return { ok: true, chapters: 1, pages: 1 }
  }),
  removeChapterCascade: vi.fn(async (id: string) => {
    db.chapters = db.chapters.filter(c => c._id !== id)
    db.pages = db.pages.filter(p => p.chapterId !== id)
    return { ok: true, pages: 1 }
  }),
  removePage: vi.fn(async (id: string) => {
    db.pages = db.pages.filter(p => p._id !== id)
    return { ok: true }
  }),
}))

import { useWordBookStore } from './wordBook'

const words = ['fold', 'bold', 'hold'].map((text, i) => ({
  entryId: `e${i + 1}`, sourceId: `s${i}`, text, explains: text,
}))

async function createBook(store: ReturnType<typeof useWordBookStore>, name = '书') {
  const result = await store.createBook(name)
  expect(result.ok).toBe(true)
  return result.item!
}

async function createChapter(store: ReturnType<typeof useWordBookStore>, bookId: string, name = '章') {
  const result = await store.createChapter(bookId, name)
  expect(result.ok).toBe(true)
  return result.item!
}

async function createPage(store: ReturnType<typeof useWordBookStore>, bookId: string, chapterId: string, name = '页') {
  const result = await store.createPage({
    bookId, chapterId, name,
    key: { type: 'root', value: 'old' }, words, source: {},
  })
  expect(result.ok).toBe(true)
  return result.item!
}

describe('wordBook store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    db.books = []
    db.chapters = []
    db.pages = []
    db.okay = { ok: true }
  })

  it('loadAll 会为旧页面确定性回填 entryId 并保存', async () => {
    db.pages = [{
      _id: 'p1', type: 'wb_page', bookId: 'b1', chapterId: 'c1', name: '旧页', order: 1,
      key: { type: 'letters', value: 'old' },
      words: [{ sourceId: 's1', text: 'fold', explains: '折叠' }],
      source: {}, level: 0, nextReviewAt: 0, ctime: 1, utime: 1,
    }]
    const store = useWordBookStore()
    await store.loadAll(true)
    const migrated = store.getPage('p1')!
    expect(migrated.words[0].entryId).toBeTruthy()
    expect(db.pages[0].words[0].entryId).toBe(migrated.words[0].entryId)
  })

  it('新建词集 → 章节 → 学习页，页序号自增，保存失败返回错误', async () => {
    const store = useWordBookStore()
    const book = await createBook(store, '四级构词')
    expect(book.name).toBe('四级构词')

    const chapter = await createChapter(store, book._id, '字母组合 old')
    expect(store.chaptersOf(book._id)).toHaveLength(1)

    const first = await createPage(store, book._id, chapter._id, 'old 篇')
    const second = await createPage(store, book._id, chapter._id, 'old 篇 2')

    expect(first.order).toBe(1)
    expect(second.order).toBe(2)
    expect(store.pagesOf(chapter._id)).toHaveLength(2)

    db.okay = { ok: false, message: '磁盘已满' }
    const failed = await store.createPage({
      bookId: book._id, chapterId: chapter._id, name: '失败页',
      key: { type: 'root', value: 'x' }, words, source: {},
    })
    expect(failed.ok).toBe(false)
    expect(failed.message).toBe('磁盘已满')
    expect(store.pagesOf(chapter._id)).toHaveLength(2)
  })

  it('同一章内可检出相同中心的页（用于生成时提示）', async () => {
    const store = useWordBookStore()
    const book = await createBook(store)
    const chapter = await createChapter(store, book._id)
    await createPage(store, book._id, chapter._id)

    expect(store.findPageByKey(chapter._id, { type: 'root', value: 'old' })).toBeTruthy()
    expect(store.findPageByKey(chapter._id, { type: 'root', value: 'spect' })).toBeUndefined()
  })

  it('无错完成一轮会升级并记录本轮摘要', async () => {
    const store = useWordBookStore()
    const book = await createBook(store)
    const chapter = await createChapter(store, book._id)
    const page = await createPage(store, book._id, chapter._id)
    const now = Date.now()

    const result = await store.completeRound(page._id, {
      total: words.length,
      firstTryKnown: words.length,
      retriedCount: 0,
      firstTryWrongEntryIds: [],
      finishedAt: now,
    })
    expect(result.ok).toBe(true)

    const saved = store.getPage(page._id)!
    expect(saved.level).toBe(1)
    expect(saved.completedAt).toBe(now)
    expect(saved.nextReviewAt).toBeGreaterThan(now)
    expect(saved.lastRound?.firstTryKnown).toBe(words.length)
  })

  it('有错完成一轮不升级、不降 4 级，并保留首轮错词 ID', async () => {
    const store = useWordBookStore()
    const book = await createBook(store)
    const chapter = await createChapter(store, book._id)
    const page = await createPage(store, book._id, chapter._id)
    const now = Date.now()

    const result = await store.completeRound(page._id, {
      total: words.length,
      firstTryKnown: words.length - 2,
      retriedCount: 2,
      firstTryWrongEntryIds: ['e1', 'e2'],
      finishedAt: now,
    })
    expect(result.ok).toBe(true)

    const saved = store.getPage(page._id)!
    expect(saved.level).toBe(0)
    expect(saved.completedAt).toBe(now)
    expect(saved.nextReviewAt - now).toBeLessThanOrEqual(24 * 60 * 60_000)
    expect(saved.lastRound?.firstTryWrongEntryIds).toEqual(['e1', 'e2'])
  })

  it('额外练习只更新本轮摘要，不改变正式复习时间', async () => {
    const store = useWordBookStore()
    const book = await createBook(store)
    const chapter = await createChapter(store, book._id)
    const page = await createPage(store, book._id, chapter._id)
    await store.completeRound(page._id, {
      total: words.length, firstTryKnown: words.length, retriedCount: 0,
      firstTryWrongEntryIds: [], finishedAt: Date.now(),
    })
    const before = store.getPage(page._id)!
    const practiceAt = Date.now()

    const result = await store.completeRound(page._id, {
      total: words.length, firstTryKnown: words.length - 1, retriedCount: 1,
      firstTryWrongEntryIds: ['e1'], finishedAt: practiceAt,
    }, { practice: true })

    expect(result.ok).toBe(true)
    const after = store.getPage(page._id)!
    expect(after.level).toBe(before.level)
    expect(after.nextReviewAt).toBe(before.nextReviewAt)
    expect(after.lastRound?.finishedAt).toBe(practiceAt)
  })

  it('标记已读不触发复习调度', async () => {
    const store = useWordBookStore()
    const book = await createBook(store)
    const chapter = await createChapter(store, book._id)
    const page = await createPage(store, book._id, chapter._id)

    const result = await store.markPageRead(page._id)
    expect(result.ok).toBe(true)
    const saved = store.getPage(page._id)!
    expect(saved.readAt).toBeGreaterThan(0)
    expect(saved.nextReviewAt).toBe(0)
    expect(store.dueCount).toBe(0)
  })

  it('编辑内容保留学习记录，移动与拆页不串 entryId', async () => {
    const store = useWordBookStore()
    const book = await createBook(store)
    const chapter = await createChapter(store, book._id)
    const page = await createPage(store, book._id, chapter._id)
    await store.completeRound(page._id, {
      total: words.length, firstTryKnown: words.length, retriedCount: 0,
      firstTryWrongEntryIds: [], finishedAt: Date.now(),
    })

    const updatedWords = [page.words[2], page.words[0], { ...page.words[1], explains: '新的释义' }]
    const updateResult = await store.updatePageContent(page._id, {
      name: '编辑后的页',
      key: { type: 'letters', value: 'old', description: '拼写联想' },
      words: updatedWords,
      note: '页面备注',
    })
    expect(updateResult.ok).toBe(true)
    const updated = store.getPage(page._id)!
    expect(updated.name).toBe('编辑后的页')
    expect(updated.words.map(word => word.entryId)).toEqual([page.words[2].entryId, page.words[0].entryId, page.words[1].entryId])
    expect(updated.level).toBe(1)
    expect(updated.completedAt).toBeTruthy()
    expect(updated.lastRound?.total).toBe(words.length)
    expect(updated.contentUpdatedAt).toBeGreaterThan(0)

    const targetResult = await store.createPage({
      bookId: book._id, chapterId: chapter._id, name: '目标页',
      key: { type: 'text', value: '' }, words: [page.words[1]], source: {},
    })
    expect(targetResult.ok).toBe(true)
    const movedEntryId = updated.words[0].entryId!
    const moveResult = await store.moveEntryToPage(page._id, movedEntryId, targetResult.item!._id)
    expect(moveResult.ok).toBe(true)
    expect(store.getPage(page._id)!.words.some(word => word.entryId === movedEntryId)).toBe(false)
    expect(store.getPage(targetResult.item!._id)!.words.some(word => word.entryId === movedEntryId)).toBe(true)

    const splitSource = store.getPage(page._id)!
    const splitResult = await store.splitPageAtIndex(splitSource._id, 1, '拆出的页')
    expect(splitResult.ok).toBe(true)
    expect(store.getPage(splitSource._id)!.words).toHaveLength(1)
    expect(splitResult.item!.words).toHaveLength(1)
    expect(splitResult.item!.completedAt).toBeUndefined()
    expect(splitResult.item!.lastRound).toBeUndefined()
  })

  it('支持创建空页、加词和删除到空页，并保留学习记录', async () => {
    const store = useWordBookStore()
    const book = await createBook(store)
    const chapter = await createChapter(store, book._id)
    const created = await store.createPage({
      bookId: book._id, chapterId: chapter._id, name: '空白页',
      key: { type: 'letters', value: 'old' }, words: [], source: {},
    })
    expect(created.ok).toBe(true)
    const pageId = created.item!._id
    await store.markPageRead(pageId)

    const added = await store.updatePageContent(pageId, {
      name: 'old 篇', key: { type: 'letters', value: 'old' }, words: [words[0]],
    })
    expect(added.ok).toBe(true)
    expect(store.getPage(pageId)!.words).toHaveLength(1)
    expect(store.getPage(pageId)!.readAt).toBeTruthy()

    const emptied = await store.updatePageContent(pageId, {
      name: 'old 篇', key: { type: 'letters', value: 'old' }, words: [],
    })
    expect(emptied.ok).toBe(true)
    expect(store.getPage(pageId)!.words).toHaveLength(0)
    expect(store.getPage(pageId)!.readAt).toBeTruthy()
  })

  it('示例编辑前可转换所有权，保存失败时仍是示例', async () => {
    const store = useWordBookStore()
    const created = await store.createBook('示例', { isSample: true })
    const book = created.item!
    expect((await store.claimSampleBook(book._id)).item!.isSample).toBe(false)
    expect(store.getBook(book._id)!.isSample).toBe(false)

    const other = await store.createBook('转换失败', { isSample: true })
    db.okay = { ok: false, message: '保存失败' }
    const result = await store.claimSampleBook(other.item!._id)
    expect(result.ok).toBe(false)
    expect(store.getBook(other.item!._id)!.isSample).toBe(true)
  })

  it('阅读、复习和删除示例不会自动转换所有权', async () => {
    const store = useWordBookStore()
    const created = await store.createBook('示例', { isSample: true })
    const book = created.item!
    const chapter = await createChapter(store, book._id)
    const page = await createPage(store, book._id, chapter._id)
    await store.markPageRead(page._id)
    await store.completeRound(page._id, {
      total: words.length, firstTryKnown: words.length, retriedCount: 0,
      firstTryWrongEntryIds: [], finishedAt: Date.now(),
    })
    expect(store.getBook(book._id)!.isSample).toBe(true)
    await store.deleteBook(book._id)
    expect(store.getBook(book._id)).toBeUndefined()
  })

  it('复制词集会复制内容但不复制学习进度', async () => {
    const store = useWordBookStore()
    const book = await createBook(store, '原词集')
    const chapter = await createChapter(store, book._id, '章')
    const page = await createPage(store, book._id, chapter._id, '页')
    await store.completeRound(page._id, {
      total: words.length, firstTryKnown: words.length, retriedCount: 0,
      firstTryWrongEntryIds: [], finishedAt: Date.now(),
    })

    const [result, concurrentResult] = await Promise.all([
      store.duplicateBook(book._id, '我的副本'),
      store.duplicateBook(book._id, '我的副本'),
    ])
    expect(result.ok).toBe(true)
    expect(concurrentResult.item?._id).toBe(result.item?._id)
    const copy = result.item!
    expect(copy._id).not.toBe(book._id)
    expect(copy.name).toBe('我的副本')
    expect(copy.copiedFromBookId).toBe(book._id)
    expect(store.books.filter(item => item.copiedFromBookId === book._id)).toHaveLength(1)
    const copiedPages = store.pages.filter(item => item.bookId === copy._id)
    expect(copiedPages).toHaveLength(1)
    expect(copiedPages[0].completedAt).toBeUndefined()
    expect(copiedPages[0].lastRound).toBeUndefined()
    expect(copiedPages[0].words[0].entryId).toBe(page.words[0].entryId)
  })

  it('导入分享词集保留全部内容字段并生成全新 ID', async () => {
    const store = useWordBookStore()
    const result = await store.importSharedBook({
      name: '导入词集',
      desc: '分享副本',
      chapters: [{
        name: '章节',
        order: 1,
        pages: [{
          name: '页面',
          order: 1,
          key: { type: 'letters', value: 'old', description: '拼写联想' },
          note: '页面备注',
          words: [{
            text: 'fold', explains: '折叠', phonetic: '/fəʊld/', note: '词条备注', freq: 100,
            examples: [{ english: 'Please fold the paper.', chinese: '请把纸折起来。' }], memoryTip: 'f + old',
          }],
        }, {
          name: '空白页', order: 2, key: { type: 'text', value: '' }, words: [],
        }],
      }],
    })
    expect(result.ok).toBe(true)
    const imported = result.item!
    expect(imported._id).toBeTruthy()
    const importedChapters = store.chaptersOf(imported._id)
    expect(importedChapters).toHaveLength(1)
    const importedPages = store.pagesOf(importedChapters[0]._id)
    expect(importedPages).toHaveLength(2)
    expect(importedPages[0].completedAt).toBeUndefined()
    expect(importedPages[0].lastRound).toBeUndefined()
    expect(importedPages[0].nextReviewAt).toBe(0)
    expect(importedPages[0].words[0].entryId).toBeTruthy()
    expect(importedPages[0].words[0].sourceId).toBe('')
    expect(importedPages[0].words[0].examples).toEqual([{ english: 'Please fold the paper.', chinese: '请把纸折起来。' }])
    expect(importedPages[0].words[0].memoryTip).toBe('f + old')
    expect(importedPages[0].source.bankName).toBe('导入词集')
    expect(importedPages[1].words).toEqual([])
  })

  it('旧 completePage 接口按错误次数调度，不错误升级', async () => {
    const store = useWordBookStore()
    const book = await createBook(store)
    const chapter = await createChapter(store, book._id)
    const page = await createPage(store, book._id, chapter._id)

    const result = await store.completePage(page._id, 2)
    expect(result.ok).toBe(true)
    expect(result.item!.level).toBe(0)
    expect(result.item!.lastScore).toBe(33)
    expect(result.item!.lastRound?.firstTryWrongEntryIds).toEqual([])
  })

  it('删除词集会级联清掉章节与页', async () => {
    const store = useWordBookStore()
    const book = await createBook(store)
    const chapter = await createChapter(store, book._id)
    await createPage(store, book._id, chapter._id)

    const result = await store.deleteBook(book._id)
    expect(result.ok).toBe(true)
    expect(store.sortedBooks).toHaveLength(0)
    expect(store.chaptersOf(book._id)).toHaveLength(0)
    expect(store.pages).toHaveLength(0)
  })

  it('到期页按时间升序汇总，未学习页不计入', async () => {
    const store = useWordBookStore()
    const book = await createBook(store)
    const chapter = await createChapter(store, book._id)
    const a = await createPage(store, book._id, chapter._id, 'A')
    const b = await createPage(store, book._id, chapter._id, 'B')

    store.pages = store.pages.map(p => p._id === a._id
      ? { ...p, completedAt: Date.now() - 2000, nextReviewAt: Date.now() + 5 * 24 * 3600_000 }
      : { ...p, completedAt: Date.now() - 1000, nextReviewAt: Date.now() - 1000 })

    expect(store.dueCount).toBe(1)
    expect(store.duePages[0]._id).toBe(b._id)
  })
})
