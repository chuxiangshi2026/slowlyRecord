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
  ensureWordBookEntryIds,
  isPageDue,
  normalizeLevelSize,
  schedulePageReview,
  syncChapterLevels,
} from '@/utils/word-book'
import type {
  WordBookBook,
  WordBookChapter,
  WordBookKey,
  WordBookPage,
  WordBookRoundSummary,
  WordBookSource,
  WordBookWord,
} from '../types/word-book'
import type { MobileSyncWordBook } from './useUtils/types'
import { filterByTombstones, recordTombstones } from './useUtils/sync-tombstone'

export const useWordBook = defineStore('mobileWordBook', () => {
  const books = ref<WordBookBook[]>([])
  const chapters = ref<WordBookChapter[]>([])
  const pages = ref<WordBookPage[]>([])
  const loaded = ref(false)

  /** 从单词页带过来的待生成内容 */
  const draft = ref<{ words: WordBookWord[]; name: string; key: WordBookKey; source: WordBookSource } | null>(null)
  /** 从章节页「添加学习页」过来的目标词集/章节 */
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
      .map(page => {
        // 旧页面回填条目 ID（与桌面端同算法），学习状态按 entryId 记录的前提
        const migrated = ensureWordBookEntryIds(page)
        if (!migrated.changed) return page
        const result = put(migrated.page)
        if (!result.ok) console.warn('[词集] 条目 ID 回填失败', page._id, result.message)
        return result.ok ? migrated.page : page
      })
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

  function createBook(name: string, extra: { desc?: string; isSample?: boolean; sampleVersion?: number } = {}): WordBookBook | null {
    const book = createWordBookBook(name, books.value.length, Date.now(), extra)
    const result = put(book)
    if (!result.ok) {
      console.warn('[词集] 创建词集失败', result.message)
      return null
    }
    books.value = [...books.value, book]
    return book
  }

  function renameBook(bookId: string, name: string): DbReturn {
    const book = getBook(bookId)
    if (!book) return { ok: false, id: bookId, error: true, message: '词集不存在' } as DbReturn
    const next: WordBookBook = { ...book, name: name.trim(), utime: Date.now() }
    const result = put(next)
    if (result.ok) books.value = replaceLocal(books.value, next)
    return result
  }

  function deleteBook(bookId: string): DbReturn {
    const deletedIds: string[] = []
    const fail = (result: DbReturn): DbReturn => {
      void recordTombstones(deletedIds)
      load(true)
      return { ...result, ok: false, id: bookId, error: true } as DbReturn
    }
    for (const page of pages.value.filter(item => item.bookId === bookId)) {
      const result = removeDoc(page._id)
      if (!result.ok) return fail(result)
      deletedIds.push(page._id)
    }
    for (const chapter of chaptersOf(bookId)) {
      const result = removeDoc(chapter._id)
      if (!result.ok) return fail(result)
      deletedIds.push(chapter._id)
    }
    const result = removeDoc(bookId)
    if (!result.ok) return fail(result)
    deletedIds.push(bookId)
    void recordTombstones(deletedIds)
    books.value = books.value.filter(book => book._id !== bookId)
    chapters.value = chapters.value.filter(chapter => chapter.bookId !== bookId)
    pages.value = pages.value.filter(page => page.bookId !== bookId)
    return result
  }

  // ===== 章 =====

  function createChapter(bookId: string, name: string): WordBookChapter | null {
    if (!getBook(bookId)) {
      console.warn('[词集] 所属词集不存在', bookId)
      return null
    }
    const chapter = createWordBookChapter(bookId, name, chaptersOf(bookId).length)
    const result = put(chapter)
    if (!result.ok) {
      console.warn('[词集] 创建章节失败', result.message)
      return null
    }
    chapters.value = [...chapters.value, chapter]
    return chapter
  }

  function renameChapter(chapterId: string, name: string): DbReturn {
    const chapter = getChapter(chapterId)
    if (!chapter) return { ok: false, id: chapterId, error: true, message: '章节不存在' } as DbReturn
    const next: WordBookChapter = { ...chapter, name: name.trim(), utime: Date.now() }
    const result = put(next)
    if (result.ok) chapters.value = replaceLocal(chapters.value, next)
    return result
  }

  function setChapterLevelSize(chapterId: string, levelSize: number): DbReturn {
    const chapter = getChapter(chapterId)
    if (!chapter) return { ok: false, id: chapterId, error: true, message: '章节不存在' } as DbReturn
    const next: WordBookChapter = { ...chapter, levelSize: normalizeLevelSize(levelSize), utime: Date.now() }
    const result = put(next)
    if (result.ok) chapters.value = replaceLocal(chapters.value, next)
    return result
  }

  function deleteChapter(chapterId: string): DbReturn {
    const deletedIds: string[] = []
    for (const page of pagesOf(chapterId)) {
      const result = removeDoc(page._id)
      if (!result.ok) {
        void recordTombstones(deletedIds)
        load(true)
        return { ...result, ok: false, id: chapterId, error: true } as DbReturn
      }
      deletedIds.push(page._id)
    }
    const result = removeDoc(chapterId)
    if (!result.ok) {
      void recordTombstones(deletedIds)
      load(true)
      return { ...result, ok: false, id: chapterId, error: true } as DbReturn
    }
    deletedIds.push(chapterId)
    void recordTombstones(deletedIds)
    chapters.value = chapters.value.filter(chapter => chapter._id !== chapterId)
    pages.value = pages.value.filter(page => page.chapterId !== chapterId)
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
  }): WordBookPage | null {
    const chapter = getChapter(input.chapterId)
    if (!getBook(input.bookId) || !chapter || chapter.bookId !== input.bookId) {
      console.warn('[词集] 所属词集或章节不匹配', input.bookId, input.chapterId)
      return null
    }
    const page = buildWordBookPage({ ...input, order: pagesOf(input.chapterId).length + 1 })
    const result = put(page)
    if (!result.ok) {
      console.warn('[词集] 创建学习页失败', result.message)
      return null
    }
    pages.value = [...pages.value, page]
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
    if (result.ok) {
      void recordTombstones([pageId])
      pages.value = pages.value.filter(page => page._id !== pageId)
    }
    return result
  }

  /**
   * 编辑页内词条（文本 / 释义 / 音标 / 笔记），按 entryId 定位，与桌面端同字段。
   */
  function updatePageEntry(
    pageId: string,
    entryId: string,
    patch: Partial<Pick<WordBookWord, 'text' | 'explains' | 'phonetic' | 'note'>>,
  ): DbReturn {
    const page = getPage(pageId)
    if (!page) return { ok: false, id: pageId, error: true, message: '页不存在' } as DbReturn
    const entry = page.words.find(w => w.entryId === entryId)
    if (!entry) return { ok: false, id: pageId, error: true, message: '词条不存在' } as DbReturn
    const clean = (v?: string) => (typeof v === 'string' ? v.trim() : v)
    const nextEntry: WordBookWord = {
      ...entry,
      text: clean(patch.text) || entry.text,
      explains: patch.explains === undefined ? entry.explains : (clean(patch.explains) || ''),
      phonetic: patch.phonetic === undefined ? entry.phonetic : clean(patch.phonetic),
      note: patch.note === undefined ? entry.note : clean(patch.note),
    }
    const nextPage: WordBookPage = {
      ...page,
      words: page.words.map(w => (w.entryId === entryId ? nextEntry : w)),
      contentUpdatedAt: Date.now(),
      utime: Date.now(),
    }
    const result = put(nextPage)
    if (result.ok) pages.value = replaceLocal(pages.value, nextPage)
    return result
  }

  /**
   * 移动词条到同章另一学习页：源页移除、目标页追加；目标页已有同 entryId 时拒绝。
   */
  function moveEntryToPage(sourcePageId: string, entryId: string, targetPageId: string): DbReturn {
    if (sourcePageId === targetPageId) return { ok: true, id: sourcePageId } as DbReturn
    const source = getPage(sourcePageId)
    const target = getPage(targetPageId)
    if (!source || !target) return { ok: false, id: sourcePageId, error: true, message: '学习页不存在' } as DbReturn
    const entry = source.words.find(w => w.entryId === entryId)
    if (!entry) return { ok: false, id: sourcePageId, error: true, message: '词条不存在' } as DbReturn
    if (target.words.some(w => w.entryId === entryId)) {
      return { ok: false, id: sourcePageId, error: true, message: '目标页已有该词条' } as DbReturn
    }
    const nextSource: WordBookPage = {
      ...source,
      words: source.words.filter(w => w.entryId !== entryId),
      contentUpdatedAt: Date.now(),
      utime: Date.now(),
    }
    const nextTarget: WordBookPage = {
      ...target,
      words: [...target.words, entry],
      contentUpdatedAt: Date.now(),
      utime: Date.now(),
    }
    const r1 = put(nextSource)
    if (!r1.ok) return r1
    const r2 = put(nextTarget)
    if (!r2.ok) {
      // 目标页写失败时回滚源页，避免词条丢失
      put({ ...source })
      return r2
    }
    pages.value = replaceLocal(replaceLocal(pages.value, nextSource), nextTarget)
    return r2
  }

  /**
   * 拆页：把选中词条拆到同章新页（新页排在章末）。全选或空选时拒绝。
   */
  function splitPage(pageId: string, entryIds: string[], name?: string): WordBookPage | null {
    const page = getPage(pageId)
    if (!page) return null
    const idSet = new Set(entryIds)
    const splitWords = page.words.filter(w => w.entryId && idSet.has(w.entryId))
    if (splitWords.length === 0 || splitWords.length >= page.words.length) return null
    const nextPage = createPage({
      bookId: page.bookId,
      chapterId: page.chapterId,
      name: (name || '').trim() || `${page.name} · 拆分`,
      key: page.key,
      words: splitWords,
      source: page.source,
      note: page.note,
    })
    if (!nextPage) return null
    const nextSource: WordBookPage = {
      ...page,
      words: page.words.filter(w => !w.entryId || !idSet.has(w.entryId)),
      contentUpdatedAt: Date.now(),
      utime: Date.now(),
    }
    const result = put(nextSource)
    if (!result.ok) {
      // 源页写失败时回滚新页，保持两页数据一致
      removeDoc(nextPage._id)
      pages.value = pages.value.filter(p => p._id !== nextPage._id)
      return null
    }
    pages.value = replaceLocal(pages.value, nextSource)
    return nextPage
  }

  /**
   * 记录一轮复习结果（与桌面端 completeRound 同语义）：
   * 练习轮只记录成绩不调整正式复习时间，也不打卡、不推进关卡
   */
  function completeRound(
    pageId: string,
    round: WordBookRoundSummary,
    options: { practice?: boolean } = {},
  ): { ok: boolean; message?: string } {
    const page = getPage(pageId)
    if (!page) return { ok: false, message: '页不存在' }
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
    const result = put(next)
    if (!result.ok) return { ok: false, message: result.message || '本轮结果保存失败' }
    pages.value = replaceLocal(pages.value, next)

    if (!options.practice) {
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
    }
    return { ok: true }
  }

  /** 旧接口兼容：只传错误数量时不记录具体错词 */
  function completePage(pageId: string, wrongAttempts: number): { ok: boolean; message?: string } {
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

  // ===== 同步 =====

  /** 收集书/章/页；全空返回 null，旧端忽略该字段 */
  function collectSync(): MobileSyncWordBook | null {
    load(true)
    if (!books.value.length && !chapters.value.length && !pages.value.length) return null
    return {
      schemaVersion: 1,
      books: [...books.value],
      chapters: [...chapters.value],
      pages: [...pages.value],
    }
  }

  /** 按 _id、utime 与墓碑合并远端词集；版本或写入失败必须显式报错 */
  function restoreSync(data: MobileSyncWordBook | null | undefined, tombstones: Record<string, number> = {}): number {
    if (!data) return 0
    const version = data.schemaVersion ?? 1
    if (version !== 1) throw new Error(`不支持的词集数据版本：${version}`)
    load()
    let count = 0
    const mergeInto = <T extends { _id: string; type?: string; utime?: number }>(
      local: T[],
      remote: T[] = [],
      expectedType: string,
    ): T[] => {
      const keptLocal = filterByTombstones(local, 'remote', tombstones)
      const keptIds = new Set(keptLocal.map(doc => doc._id))
      for (const doc of local) {
        if (keptIds.has(doc._id)) continue
        const result = removeDoc(doc._id)
        if (!result.ok) throw new Error(result.message || `清理词集条目失败：${doc._id}`)
        count++
      }
      const map = new Map(keptLocal.map(doc => [doc._id, doc]))
      for (const doc of filterByTombstones(remote, 'remote', tombstones)) {
        if (!doc?._id || doc.type !== expectedType) continue
        const current = map.get(doc._id)
        if (current && (doc.utime || 0) <= (current.utime || 0)) continue
        const result = put({ ...doc })
        if (!result.ok) throw new Error(result.message || `保存词集条目失败：${doc._id}`)
        map.set(doc._id, { ...doc })
        count++
      }
      return [...map.values()]
    }
    books.value = mergeInto(books.value, data.books, 'wb_book')
    chapters.value = mergeInto(chapters.value, data.chapters, 'wb_chapter')
    pages.value = mergeInto(pages.value, data.pages, 'wb_page')
    return count
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
    updatePageEntry,
    moveEntryToPage,
    splitPage,
    completeRound,
    completePage,
    collectSync,
    restoreSync,
    setDraft,
    clearDraft,
    setPendingTarget,
  }
})
