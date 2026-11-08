import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { getDbAdapter, type DbReturn } from '@/adapters/index'
import { useSignin } from './useSignin'
import {
  WORD_BOOK_BOOK_PREFIX,
  WORD_BOOK_CHAPTER_PREFIX,
  WORD_BOOK_PAGE_PREFIX,
  buildWordBookPage,
  createWordBookBook,
  createWordBookChapter,
  isPageDue,
  schedulePageReview,
  syncChapterLevels,
} from '@/utils/word-book'
import type {
  WordBookBook,
  WordBookChapter,
  WordBookKey,
  WordBookPage,
  WordBookSource,
  WordBookWord,
} from '../types/word-book'

export const useWordBook = defineStore('mobileWordBook', () => {
  const books = ref<WordBookBook[]>([])
  const chapters = ref<WordBookChapter[]>([])
  const pages = ref<WordBookPage[]>([])
  const loaded = ref(false)

  /** 从单词页带过来的待生成内容 */
  const draft = ref<{ words: WordBookWord[]; name: string; key: WordBookKey; source: WordBookSource } | null>(null)
  /** 从章节页「添加页」过来的目标书/章 */
  const pendingTarget = ref<{ bookId: string; chapterId: string } | null>(null)

  function put<T extends { _id: string; _rev?: string }>(doc: T): DbReturn {
    const existing = getDbAdapter().get(doc._id)
    const payload = JSON.parse(JSON.stringify({ ...doc, _rev: existing?._rev }))
    const result = getDbAdapter().put(payload)
    if (result.ok && result.rev) doc._rev = result.rev
    return result
  }

  function removeDoc(id: string): DbReturn {
    const existing = getDbAdapter().get(id)
    if (!existing) return { ok: true, id } as DbReturn
    return getDbAdapter().remove(existing)
  }

  function load(force = false) {
    if (loaded.value && !force) return
    const db = getDbAdapter()
    books.value = db.allDocs<WordBookBook>(WORD_BOOK_BOOK_PREFIX)
      .filter(doc => doc.type === 'wb_book')
      .sort((a, b) => a.order - b.order || a.ctime - b.ctime)
    chapters.value = db.allDocs<WordBookChapter>(WORD_BOOK_CHAPTER_PREFIX)
      .filter(doc => doc.type === 'wb_chapter')
      .sort((a, b) => a.order - b.order || a.ctime - b.ctime)
    pages.value = db.allDocs<WordBookPage>(WORD_BOOK_PAGE_PREFIX)
      .filter(doc => doc.type === 'wb_page')
      .sort((a, b) => a.order - b.order || a.ctime - b.ctime)
    loaded.value = true
  }

  const sortedBooks = computed(() => [...books.value].sort((a, b) => a.order - b.order || a.ctime - b.ctime))
  const duePages = computed(() => pages.value.filter(page => isPageDue(page)).sort((a, b) => a.nextReviewAt - b.nextReviewAt))
  const dueCount = computed(() => duePages.value.length)

  function chaptersOf(bookId: string): WordBookChapter[] {
    return chapters.value.filter(chapter => chapter.bookId === bookId).sort((a, b) => a.order - b.order)
  }

  function pagesOf(chapterId: string): WordBookPage[] {
    return pages.value.filter(page => page.chapterId === chapterId).sort((a, b) => a.order - b.order)
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

  function findPageByKey(chapterId: string, key: WordBookKey): WordBookPage | undefined {
    return pagesOf(chapterId).find(page => page.key?.value === key.value && page.key?.type === key.type)
  }

  function replaceLocal<T extends { _id: string }>(list: T[], next: T): T[] {
    const index = list.findIndex(item => item._id === next._id)
    if (index >= 0) list[index] = next
    else list.push(next)
    return [...list]
  }

  // ===== 书 =====

  function createBook(name: string, extra: { desc?: string; isSample?: boolean; sampleVersion?: number } = {}): WordBookBook {
    const book = createWordBookBook(name, books.value.length, Date.now(), extra)
    const result = put(book)
    if (result.ok) books.value = [...books.value, book]
    return book
  }

  function renameBook(bookId: string, name: string): DbReturn {
    const book = getBook(bookId)
    if (!book) return { ok: false, id: bookId, error: true, message: '书不存在' } as DbReturn
    const next: WordBookBook = { ...book, name: name.trim(), utime: Date.now() }
    const result = put(next)
    if (result.ok) books.value = replaceLocal(books.value, next)
    return result
  }

  function deleteBook(bookId: string): DbReturn {
    const chapterIds = chaptersOf(bookId).map(chapter => chapter._id)
    pages.value.filter(page => page.bookId === bookId).forEach(page => removeDoc(page._id))
    chapterIds.forEach(id => removeDoc(id))
    const result = removeDoc(bookId)
    if (result.ok) {
      books.value = books.value.filter(book => book._id !== bookId)
      chapters.value = chapters.value.filter(chapter => chapter.bookId !== bookId)
      pages.value = pages.value.filter(page => page.bookId !== bookId)
    }
    return result
  }

  // ===== 章 =====

  function createChapter(bookId: string, name: string): WordBookChapter {
    const chapter = createWordBookChapter(bookId, name, chaptersOf(bookId).length)
    const result = put(chapter)
    if (result.ok) chapters.value = [...chapters.value, chapter]
    return chapter
  }

  function renameChapter(chapterId: string, name: string): DbReturn {
    const chapter = getChapter(chapterId)
    if (!chapter) return { ok: false, id: chapterId, error: true, message: '章不存在' } as DbReturn
    const next: WordBookChapter = { ...chapter, name: name.trim(), utime: Date.now() }
    const result = put(next)
    if (result.ok) chapters.value = replaceLocal(chapters.value, next)
    return result
  }

  function setChapterLevelSize(chapterId: string, levelSize: number): DbReturn {
    const chapter = getChapter(chapterId)
    if (!chapter) return { ok: false, id: chapterId, error: true, message: '章不存在' } as DbReturn
    const next: WordBookChapter = { ...chapter, levelSize: Math.max(1, Math.floor(levelSize) || 5), utime: Date.now() }
    const result = put(next)
    if (result.ok) chapters.value = replaceLocal(chapters.value, next)
    return result
  }

  function deleteChapter(chapterId: string): DbReturn {
    pagesOf(chapterId).forEach(page => removeDoc(page._id))
    const result = removeDoc(chapterId)
    if (result.ok) {
      chapters.value = chapters.value.filter(chapter => chapter._id !== chapterId)
      pages.value = pages.value.filter(page => page.chapterId !== chapterId)
    }
    return result
  }

  // ===== 页 =====

  function createPage(input: {
    bookId: string
    chapterId: string
    name: string
    key: WordBookKey
    words: WordBookWord[]
    source: WordBookSource
    note?: string
  }): WordBookPage {
    const page = buildWordBookPage({ ...input, order: pagesOf(input.chapterId).length + 1 })
    const result = put(page)
    if (result.ok) pages.value = [...pages.value, page]
    return page
  }

  function renamePage(pageId: string, name: string): DbReturn {
    const page = getPage(pageId)
    if (!page) return { ok: false, id: pageId, error: true, message: '页不存在' } as DbReturn
    const next: WordBookPage = { ...page, name: name.trim(), utime: Date.now() }
    const result = put(next)
    if (result.ok) pages.value = replaceLocal(pages.value, next)
    return result
  }

  function deletePage(pageId: string): DbReturn {
    const result = removeDoc(pageId)
    if (result.ok) pages.value = pages.value.filter(page => page._id !== pageId)
    return result
  }

  function completePage(pageId: string, wrongAttempts: number): { ok: boolean; message?: string } {
    const page = getPage(pageId)
    if (!page) return { ok: false, message: '页不存在' }
    const now = Date.now()
    const next: WordBookPage = { ...page, ...schedulePageReview(page, wrongAttempts, now), utime: now }
    const result = put(next)
    if (!result.ok) return { ok: false, message: result.message || '成绩保存失败' }
    pages.value = replaceLocal(pages.value, next)

    try {
      useSignin().signToday()
    } catch { /* 打卡失败不影响页进度 */ }

    const chapter = getChapter(next.chapterId)
    if (chapter) {
      const levels = syncChapterLevels(chapter, pagesOf(chapter._id), now)
      if (levels.length !== chapter.levels.length) {
        const nextChapter: WordBookChapter = { ...chapter, levels, utime: now }
        const chapterResult = put(nextChapter)
        if (chapterResult.ok) chapters.value = replaceLocal(chapters.value, nextChapter)
      }
    }
    return { ok: true }
  }

  // ===== 草稿与目标 =====

  function setDraft(words: WordBookWord[], name: string, key: WordBookKey, source: WordBookSource) {
    draft.value = { words, name, key, source }
  }

  function clearDraft() {
    draft.value = null
  }

  function setPendingTarget(target: { bookId: string; chapterId: string } | null) {
    pendingTarget.value = target
  }

  return {
    books,
    chapters,
    pages,
    loaded,
    draft,
    pendingTarget,
    sortedBooks,
    duePages,
    dueCount,
    load,
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
    deleteChapter,
    setChapterLevelSize,
    createPage,
    renamePage,
    deletePage,
    completePage,
    setDraft,
    clearDraft,
    setPendingTarget,
  }
})
