import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { DbReturn } from '@/adapters/db'
import {
  getAllBooks,
  getAllChapters,
  getAllPages,
  removeBookCascade,
  removeChapterCascade,
  removePage,
  saveBook,
  saveChapter,
  savePage,
} from '@/utils/word-book-db'
import {
  buildWordBookPage,
  createWordBookBook,
  createWordBookChapter,
  ensureWordBookEntryIds,
  getWordBookPageActivityAt,
  isPageDue,
  schedulePageReview,
} from '@/utils/word-book'
import { useSigninStore } from './signin'
import { trackEvent } from '@/utils/stats'
import type { WordBookShareBook } from '@/utils/word-book-share'
import type {
  WordBookBook,
  WordBookChapter,
  WordBookKey,
  WordBookPage,
  WordBookRoundSummary,
  WordBookSource,
  WordBookWord,
} from '@/types/word-book'

export interface WordBookItemResult<T> {
  ok: boolean
  item?: T
  message?: string
}

export interface WordBookRoundOptions {
  practice?: boolean
}

export const useWordBookStore = defineStore('wordBook', () => {
  const books = ref<WordBookBook[]>([])
  const chapters = ref<WordBookChapter[]>([])
  const pages = ref<WordBookPage[]>([])
  const loading = ref(false)
  const loaded = ref(false)

  async function loadAll(force = false): Promise<void> {
    if (loaded.value && !force) return
    loading.value = true
    try {
      const [nextBooks, nextChapters, nextPages] = await Promise.all([getAllBooks(), getAllChapters(), getAllPages()])
      books.value = nextBooks
      chapters.value = nextChapters

      const migratedPages: WordBookPage[] = []
      for (const page of nextPages) {
        const migrated = ensureWordBookEntryIds(page)
        if (!migrated.changed) {
          migratedPages.push(page)
          continue
        }
        const result = await savePage(migrated.page)
        if (result.ok) migratedPages.push(migrated.page)
        else {
          console.warn('[词集] 条目 ID 回填失败', page._id, result.message)
          migratedPages.push(page)
        }
      }
      pages.value = migratedPages
      loaded.value = true
    } finally {
      loading.value = false
    }
  }

  const sortedBooks = computed(() => [...books.value].sort((a, b) => a.order - b.order || a.ctime - b.ctime))

  const recentPages = computed(() =>
    [...pages.value].sort((a, b) => getWordBookPageActivityAt(b) - getWordBookPageActivityAt(a)),
  )

  const continuePage = computed(() =>
    recentPages.value.find(page => page.readAt || page.lastRound || page.completedAt) || recentPages.value[0],
  )

  function chaptersOf(bookId: string): WordBookChapter[] {
    return chapters.value
      .filter(chapter => chapter.bookId === bookId)
      .sort((a, b) => a.order - b.order || a.ctime - b.ctime)
  }

  function pagesOf(chapterId: string): WordBookPage[] {
    return pages.value
      .filter(page => page.chapterId === chapterId)
      .sort((a, b) => a.order - b.order || a.ctime - b.ctime)
  }

  function getBook(id: string): WordBookBook | undefined {
    return books.value.find(book => book._id === id)
  }

  function getChapter(id: string): WordBookChapter | undefined {
    return chapters.value.find(chapter => chapter._id === id)
  }

  function getPage(id: string): WordBookPage | undefined {
    return pages.value.find(page => page._id === id)
  }

  /** 同一个章里已有相同中心的页（生成时提示） */
  function findPageByKey(chapterId: string, key: WordBookKey): WordBookPage | undefined {
    return pagesOf(chapterId).find(page => page.key?.value === key.value && page.key?.type === key.type)
  }

  function replaceLocal<T extends { _id: string }>(list: T[], next: T): T[] {
    const index = list.findIndex(item => item._id === next._id)
    if (index >= 0) list[index] = next
    else list.push(next)
    return [...list]
  }

  /** 到期复习页（已完成过复习的页面，按到期时间升序） */
  const duePages = computed(() =>
    pages.value.filter(page => isPageDue(page)).sort((a, b) => a.nextReviewAt - b.nextReviewAt),
  )

  const dueCount = computed(() => duePages.value.length)

  // ===== 书 =====

  async function createBook(name: string, extra: { desc?: string; isSample?: boolean; sampleVersion?: number; copiedFromBookId?: string } = {}): Promise<WordBookItemResult<WordBookBook>> {
    const book = createWordBookBook(name, books.value.length, Date.now(), extra)
    const result = await saveBook(book)
    if (!result.ok) return { ok: false, message: result.message || '创建词集失败' }
    books.value = [...books.value, book]
    return { ok: true, item: book }
  }

  /** 示例第一次内容编辑成功后归入我的词集；阅读与复习不调用 */
  async function claimSampleBook(bookId: string): Promise<WordBookItemResult<WordBookBook>> {
    const book = getBook(bookId)
    if (!book) return { ok: false, message: '词集不存在' }
    if (!book.isSample) return { ok: true, item: book }
    const next: WordBookBook = { ...book, isSample: false, utime: Date.now() }
    const result = await saveBook(next)
    if (!result.ok) return { ok: false, message: result.message || '示例转换失败' }
    books.value = replaceLocal(books.value, next)
    return { ok: true, item: next }
  }

  async function renameBook(bookId: string, name: string): Promise<DbReturn> {
    const book = getBook(bookId)
    if (!book) return { ok: false, id: bookId, error: true, message: '词集不存在' } as DbReturn
    const next: WordBookBook = { ...book, name: name.trim(), utime: Date.now() }
    const result = await saveBook(next)
    if (result.ok) books.value = replaceLocal(books.value, next)
    return result
  }

  async function deleteBook(bookId: string): Promise<DbReturn> {
    const result = await removeBookCascade(bookId)
    if (result.ok) {
      books.value = books.value.filter(book => book._id !== bookId)
      chapters.value = chapters.value.filter(chapter => chapter.bookId !== bookId)
      pages.value = pages.value.filter(page => page.bookId !== bookId)
    }
    return { ok: result.ok, id: bookId } as DbReturn
  }

  // ===== 章 =====

  async function createChapter(bookId: string, name: string): Promise<WordBookItemResult<WordBookChapter>> {
    const chapter = createWordBookChapter(bookId, name, chaptersOf(bookId).length)
    const result = await saveChapter(chapter)
    if (!result.ok) return { ok: false, message: result.message || '创建章节失败' }
    chapters.value = [...chapters.value, chapter]
    return { ok: true, item: chapter }
  }

  async function renameChapter(chapterId: string, name: string): Promise<DbReturn> {
    const chapter = getChapter(chapterId)
    if (!chapter) return { ok: false, id: chapterId, error: true, message: '章节不存在' } as DbReturn
    const next: WordBookChapter = { ...chapter, name: name.trim(), utime: Date.now() }
    const result = await saveChapter(next)
    if (result.ok) chapters.value = replaceLocal(chapters.value, next)
    return result
  }

  /** 旧关卡字段保留兼容；新界面不再提供入口 */
  async function setChapterLevelSize(chapterId: string, levelSize: number): Promise<void> {
    const chapter = getChapter(chapterId)
    if (!chapter) return
    const next: WordBookChapter = { ...chapter, levelSize, utime: Date.now() }
    const result = await saveChapter(next)
    if (result.ok) chapters.value = replaceLocal(chapters.value, next)
  }

  async function deleteChapter(chapterId: string): Promise<DbReturn> {
    const result = await removeChapterCascade(chapterId)
    if (result.ok) {
      chapters.value = chapters.value.filter(chapter => chapter._id !== chapterId)
      pages.value = pages.value.filter(page => page.chapterId !== chapterId)
    }
    return { ok: result.ok, id: chapterId } as DbReturn
  }

  // ===== 页 =====

  async function createPage(input: {
    bookId: string
    chapterId: string
    name: string
    key: WordBookKey
    words: WordBookWord[]
    source: WordBookSource
    note?: string
  }): Promise<WordBookItemResult<WordBookPage>> {
    const page = buildWordBookPage({
      ...input,
      order: pagesOf(input.chapterId).length + 1,
    })
    const result = await savePage(page)
    if (!result.ok) return { ok: false, message: result.message || '创建学习页失败' }
    pages.value = [...pages.value, page]
    return { ok: true, item: page }
  }

  async function renamePage(pageId: string, name: string): Promise<DbReturn> {
    const page = getPage(pageId)
    if (!page) return { ok: false, id: pageId, error: true, message: '学习页不存在' } as DbReturn
    const now = Date.now()
    const next: WordBookPage = { ...page, name: name.trim(), contentUpdatedAt: now, utime: now }
    const result = await savePage(next)
    if (result.ok) pages.value = replaceLocal(pages.value, next)
    return result
  }

  async function deletePage(pageId: string): Promise<DbReturn> {
    const page = getPage(pageId)
    if (!page) return { ok: true, id: pageId } as DbReturn
    const result = await removePage(pageId)
    if (result.ok) pages.value = pages.value.filter(item => item._id !== pageId)
    return result
  }

  /** 查看模式下手动标记已读；不触发页级复习调度 */
  async function markPageRead(pageId: string): Promise<WordBookItemResult<WordBookPage>> {
    const page = getPage(pageId)
    if (!page) return { ok: false, message: '学习页不存在' }
    const now = Date.now()
    const next: WordBookPage = { ...page, readAt: now, utime: now }
    const result = await savePage(next)
    if (!result.ok) return { ok: false, message: result.message || '已读状态保存失败' }
    pages.value = replaceLocal(pages.value, next)
    return { ok: true, item: next }
  }

  /** 编辑页面内容；保留已读、轮次摘要和复习调度 */
  async function updatePageContent(pageId: string, input: {
    name: string
    key: WordBookKey
    words: WordBookWord[]
    note?: string
  }): Promise<WordBookItemResult<WordBookPage>> {
    const page = getPage(pageId)
    if (!page) return { ok: false, message: '学习页不存在' }
    const now = Date.now()
    const ensured = ensureWordBookEntryIds({
      ...page,
      name: input.name.trim(),
      key: input.key,
      words: input.words.map(word => ({ ...word })),
      ...(input.note !== undefined ? { note: input.note } : {}),
      contentUpdatedAt: now,
      utime: now,
    }).page
    const result = await savePage(ensured)
    if (!result.ok) return { ok: false, message: result.message || '学习页保存失败' }
    pages.value = replaceLocal(pages.value, ensured)
    return { ok: true, item: ensured }
  }

  /** 把词条移动到其他学习页；保存失败时尽力恢复原页 */
  async function moveEntryToPage(pageId: string, entryId: string, targetPageId: string): Promise<WordBookItemResult<WordBookPage>> {
    const page = getPage(pageId)
    const target = getPage(targetPageId)
    if (!page) return { ok: false, message: '学习页不存在' }
    if (!target) return { ok: false, message: '目标学习页不存在' }
    if (page._id === target._id) return { ok: false, message: '不能移动到当前页' }
    const entry = page.words.find(word => word.entryId === entryId)
    if (!entry) return { ok: false, message: '词条不存在' }
    const now = Date.now()
    const nextPage = ensureWordBookEntryIds({
      ...page,
      words: page.words.filter(word => word.entryId !== entryId),
      contentUpdatedAt: now,
      utime: now,
    }).page
    const nextTarget = ensureWordBookEntryIds({
      ...target,
      words: [...target.words, entry],
      contentUpdatedAt: now,
      utime: now,
    }).page

    const sourceResult = await savePage(nextPage)
    if (!sourceResult.ok) return { ok: false, message: sourceResult.message || '移动词条失败' }
    const targetResult = await savePage(nextTarget)
    if (!targetResult.ok) {
      await savePage(page)
      return { ok: false, message: targetResult.message || '移动词条失败' }
    }
    pages.value = replaceLocal(pages.value, nextPage)
    pages.value = replaceLocal(pages.value, nextTarget)
    return { ok: true, item: nextPage }
  }

  /** 从指定下标拆分出新页；原页保留学习记录，新页从未学习开始 */
  async function splitPageAtIndex(pageId: string, index: number, newName?: string): Promise<WordBookItemResult<WordBookPage>> {
    const page = getPage(pageId)
    if (!page) return { ok: false, message: '学习页不存在' }
    if (index <= 0 || index >= page.words.length) return { ok: false, message: '请选择一个可拆分的词条位置' }
    const now = Date.now()
    const sourcePage = ensureWordBookEntryIds({
      ...page,
      words: page.words.slice(0, index),
      contentUpdatedAt: now,
      utime: now,
    }).page
    const newPage = buildWordBookPage({
      bookId: page.bookId,
      chapterId: page.chapterId,
      name: newName?.trim() || `${page.name} ②`,
      order: pagesOf(page.chapterId).length + 1,
      key: { ...page.key },
      source: { ...page.source },
      words: page.words.slice(index),
      note: page.note,
      now,
    })

    const sourceResult = await savePage(sourcePage)
    if (!sourceResult.ok) return { ok: false, message: sourceResult.message || '拆分学习页失败' }
    const newResult = await savePage(newPage)
    if (!newResult.ok) {
      await savePage(page)
      return { ok: false, message: newResult.message || '拆分学习页失败' }
    }
    pages.value = replaceLocal(pages.value, sourcePage)
    pages.value = replaceLocal(pages.value, newPage)
    return { ok: true, item: newPage }
  }

  const pendingDuplicates = new Map<string, Promise<WordBookItemResult<WordBookBook>>>()

  /** 同一词集的并发复制共用一次任务；任一步失败时清理新词集 */
  function duplicateBook(bookId: string, targetName?: string): Promise<WordBookItemResult<WordBookBook>> {
    const pending = pendingDuplicates.get(bookId)
    if (pending) return pending
    const task = performDuplicateBook(bookId, targetName).finally(() => pendingDuplicates.delete(bookId))
    pendingDuplicates.set(bookId, task)
    return task
  }

  async function performDuplicateBook(bookId: string, targetName?: string): Promise<WordBookItemResult<WordBookBook>> {
    const source = getBook(bookId)
    if (!source) return { ok: false, message: '词集不存在' }
    const createResult = await createBook(targetName?.trim() || `${source.name} 副本`, {
      desc: source.desc,
      copiedFromBookId: source.copiedFromBookId || source._id,
    })
    if (!createResult.ok || !createResult.item) return createResult
    const target = createResult.item

    try {
      for (const chapter of chaptersOf(bookId)) {
        const chapterResult = await createChapter(target._id, chapter.name)
        if (!chapterResult.ok || !chapterResult.item) throw new Error(chapterResult.message || '复制章节失败')
        const targetChapter = chapterResult.item
        for (const page of pagesOf(chapter._id)) {
          const pageResult = await createPage({
            bookId: target._id,
            chapterId: targetChapter._id,
            name: page.name,
            key: { ...page.key },
            words: page.words.map(word => ({ ...word })),
            source: { ...page.source },
            note: page.note,
          })
          if (!pageResult.ok) throw new Error(pageResult.message || '复制学习页失败')
        }
      }
      return { ok: true, item: target }
    } catch (e) {
      await deleteBook(target._id)
      return { ok: false, message: e instanceof Error ? e.message : '复制词集失败' }
    }
  }

  /** 导入分享词集：创建全新 ID 的可编辑副本，任一步失败时清理半成品 */
  async function importSharedBook(data: WordBookShareBook): Promise<WordBookItemResult<WordBookBook>> {
    const createResult = await createBook(data.name, { desc: data.desc })
    if (!createResult.ok || !createResult.item) return createResult
    const target = createResult.item

    try {
      for (const chapter of data.chapters) {
        const chapterResult = await createChapter(target._id, chapter.name)
        if (!chapterResult.ok || !chapterResult.item) throw new Error(chapterResult.message || '导入章节失败')
        const targetChapter = chapterResult.item
        for (const page of chapter.pages) {
          const pageResult = await createPage({
            bookId: target._id,
            chapterId: targetChapter._id,
            name: page.name,
            key: { ...page.key },
            words: page.words.map(word => ({
              sourceId: '',
              text: word.text,
              explains: word.explains,
              ...(word.phonetic ? { phonetic: word.phonetic } : {}),
              ...(word.note ? { note: word.note } : {}),
              ...(word.examples?.length ? { examples: word.examples.map(example => ({ ...example })) } : {}),
              ...(word.memoryTip ? { memoryTip: word.memoryTip } : {}),
              ...(typeof word.freq === 'number' ? { freq: word.freq } : {}),
            })),
            source: { bankName: '导入词集' },
            note: page.note,
          })
          if (!pageResult.ok) throw new Error(pageResult.message || '导入学习页失败')
        }
      }
      return { ok: true, item: target }
    } catch (e) {
      await deleteBook(target._id)
      return { ok: false, message: e instanceof Error ? e.message : '导入词集失败' }
    }
  }

  /** 保存一轮复习；练习模式不改变正式复习时间 */
  async function completeRound(
    pageId: string,
    round: WordBookRoundSummary,
    options: WordBookRoundOptions = {},
  ): Promise<WordBookItemResult<WordBookPage>> {
    const page = getPage(pageId)
    if (!page) return { ok: false, message: '学习页不存在' }
    const now = round.finishedAt || Date.now()
    const wrongAttempts = Math.max(
      round.firstTryWrongEntryIds.length,
      Math.max(0, round.total - round.firstTryKnown),
    )
    const scheduled = schedulePageReview(page, wrongAttempts, now)
    const schedule = options.practice
      ? { ...scheduled, level: page.level, nextReviewAt: page.nextReviewAt, completedAt: page.completedAt }
      : scheduled
    const next: WordBookPage = {
      ...page,
      ...schedule,
      lastRound: { ...round, finishedAt: now },
      utime: now,
    }
    const result = await savePage(next)
    if (!result.ok) return { ok: false, message: result.message || '本轮结果保存失败' }
    pages.value = replaceLocal(pages.value, next)

    if (!options.practice) {
      try {
        useSigninStore().signToday()
      } catch { /* 打卡失败不影响页进度 */ }
    }
    trackEvent('feature', 'word_book_page_done', next.key.type, options.practice ? 1 : 0)
    return { ok: true, item: next }
  }

  /** 旧接口兼容：只传错误数量时不记录具体错词 */
  async function completePage(pageId: string, wrongAttempts: number): Promise<WordBookItemResult<WordBookPage>> {
    const page = getPage(pageId)
    const total = page?.words.length || 0
    return completeRound(pageId, {
      total,
      firstTryKnown: Math.max(0, total - Math.max(0, wrongAttempts)),
      retriedCount: 0,
      firstTryWrongEntryIds: [],
      finishedAt: Date.now(),
    })
  }

  return {
    books,
    chapters,
    pages,
    loading,
    loaded,
    sortedBooks,
    recentPages,
    continuePage,
    duePages,
    dueCount,
    loadAll,
    chaptersOf,
    pagesOf,
    getBook,
    getChapter,
    getPage,
    findPageByKey,
    createBook,
    claimSampleBook,
    renameBook,
    deleteBook,
    createChapter,
    renameChapter,
    setChapterLevelSize,
    deleteChapter,
    createPage,
    renamePage,
    deletePage,
    markPageRead,
    updatePageContent,
    moveEntryToPage,
    splitPageAtIndex,
    duplicateBook,
    importSharedBook,
    completeRound,
    completePage,
  }
})
