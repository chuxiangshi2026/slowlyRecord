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
  isPageDue,
  schedulePageReview,
  syncChapterLevels,
} from '@/utils/word-book'
import { useSigninStore } from './signin'
import { trackEvent } from '@/utils/stats'
import type {
  WordBookBook,
  WordBookChapter,
  WordBookKey,
  WordBookPage,
  WordBookSource,
  WordBookWord,
} from '@/types/word-book'

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
      pages.value = nextPages
      loaded.value = true
    } finally {
      loading.value = false
    }
  }

  const sortedBooks = computed(() => [...books.value].sort((a, b) => a.order - b.order || a.ctime - b.ctime))

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

  /** 同一个章里已有相同中心的页（生成时提示追加/新建） */
  function findPageByKey(chapterId: string, key: WordBookKey): WordBookPage | undefined {
    return pagesOf(chapterId).find(page => page.key?.value === key.value && page.key?.type === key.type)
  }

  function replaceLocal<T extends { _id: string }>(list: T[], next: T): T[] {
    const index = list.findIndex(item => item._id === next._id)
    if (index >= 0) list[index] = next
    else list.push(next)
    return [...list]
  }

  /** 到期页（按到期时间升序） */
  const duePages = computed(() =>
    pages.value.filter(page => isPageDue(page)).sort((a, b) => a.nextReviewAt - b.nextReviewAt),
  )

  const dueCount = computed(() => duePages.value.length)

  // ===== 书 =====

  async function createBook(name: string, extra: { desc?: string; isSample?: boolean } = {}): Promise<WordBookBook> {
    const book = createWordBookBook(name, books.value.length, Date.now(), extra)
    const result = await saveBook(book)
    if (result.ok) books.value = [...books.value, book]
    return book
  }

  async function renameBook(bookId: string, name: string): Promise<DbReturn> {
    const book = getBook(bookId)
    if (!book) return { ok: false, id: bookId, error: true, message: '书不存在' } as DbReturn
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

  async function createChapter(bookId: string, name: string): Promise<WordBookChapter> {
    const chapter = createWordBookChapter(bookId, name, chaptersOf(bookId).length)
    const result = await saveChapter(chapter)
    if (result.ok) chapters.value = [...chapters.value, chapter]
    return chapter
  }

  async function renameChapter(chapterId: string, name: string): Promise<DbReturn> {
    const chapter = getChapter(chapterId)
    if (!chapter) return { ok: false, id: chapterId, error: true, message: '章不存在' } as DbReturn
    const next: WordBookChapter = { ...chapter, name: name.trim(), utime: Date.now() }
    const result = await saveChapter(next)
    if (result.ok) chapters.value = replaceLocal(chapters.value, next)
    return result
  }

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
  }): Promise<WordBookPage> {
    const page = buildWordBookPage({
      ...input,
      order: pagesOf(input.chapterId).length + 1,
    })
    const result = await savePage(page)
    if (result.ok) pages.value = [...pages.value, page]
    return page
  }

  async function renamePage(pageId: string, name: string): Promise<DbReturn> {
    const page = getPage(pageId)
    if (!page) return { ok: false, id: pageId, error: true, message: '页不存在' } as DbReturn
    const next: WordBookPage = { ...page, name: name.trim(), utime: Date.now() }
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

  /** 保存一轮成绩：更新页级调度，并把达成的关卡记到章上 */
  async function completePage(pageId: string, wrongAttempts: number): Promise<{ ok: boolean; page?: WordBookPage; message?: string }> {
    const page = getPage(pageId)
    if (!page) return { ok: false, message: '页不存在' }
    const now = Date.now()
    const schedule = schedulePageReview(page, wrongAttempts, now)
    const next: WordBookPage = { ...page, ...schedule, utime: now }
    const result = await savePage(next)
    if (!result.ok) return { ok: false, message: result.message || '成绩保存失败' }
    pages.value = replaceLocal(pages.value, next)

    // 完成一页即视为今天练过：计入连续打卡（与复习页共用同一份记录）
    try {
      useSigninStore().signToday()
    } catch { /* 打卡失败不影响页进度 */ }
    trackEvent('feature', 'word_book_page_done', next.key.type, next.level)

    const chapter = getChapter(next.chapterId)
    if (chapter) {
      const levels = syncChapterLevels(chapter, pagesOf(chapter._id), now)
      if (levels.length !== chapter.levels.length) {
        const nextChapter: WordBookChapter = { ...chapter, levels, utime: now }
        const chapterResult = await saveChapter(nextChapter)
        if (chapterResult.ok) chapters.value = replaceLocal(chapters.value, nextChapter)
      }
    }
    return { ok: true, page: next }
  }

  return {
    books,
    chapters,
    pages,
    loading,
    loaded,
    sortedBooks,
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
    renameBook,
    deleteBook,
    createChapter,
    renameChapter,
    setChapterLevelSize,
    deleteChapter,
    createPage,
    renamePage,
    deletePage,
    completePage,
  }
})
