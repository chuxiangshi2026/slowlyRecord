/**
 * 词图闯关持久化：书 / 章 / 页三种文档分开存，增删改只动一条。
 * 文档 _id 已带 `wb_book_` / `wb_chapter_` / `wb_page_` 前缀，allDocs 按前缀取。
 */
import { getDbAdapter, getDbAdapterAsync, type DbReturn } from '@/adapters/db'
import { WORD_BOOK_BOOK_PREFIX, WORD_BOOK_CHAPTER_PREFIX, WORD_BOOK_PAGE_PREFIX } from './word-book'
import type { WordBookBook, WordBookChapter, WordBookPage } from '@/types/word-book'

async function ensureDb(): Promise<void> {
  await getDbAdapterAsync()
}

function readAll<T>(prefix: string, type: string): T[] {
  return getDbAdapter()
    .allDocs<T & { type?: string }>(prefix)
    .filter(doc => (doc as any)?.type === type) as T[]
}

async function putDoc<T extends { _id: string; _rev?: string }>(doc: T): Promise<DbReturn> {
  await ensureDb()
  const existing = getDbAdapter().get(doc._id) as { _rev?: string } | undefined
  const payload = JSON.parse(JSON.stringify({ ...doc, _rev: existing?._rev }))
  const result = await getDbAdapter().promises.put(payload)
  if (result.ok && result.rev) doc._rev = result.rev
  return result
}

async function removeDoc(id: string): Promise<DbReturn> {
  await ensureDb()
  const existing = getDbAdapter().get(id)
  if (!existing) return { ok: true, id } as DbReturn
  return getDbAdapter().promises.remove(existing)
}

// ===== 书 =====

export async function getAllBooks(): Promise<WordBookBook[]> {
  await ensureDb()
  return readAll<WordBookBook>(WORD_BOOK_BOOK_PREFIX, 'wb_book').sort((a, b) => a.order - b.order || a.ctime - b.ctime)
}

export async function saveBook(book: WordBookBook): Promise<DbReturn> {
  return putDoc(book)
}

interface CascadeDeleteResult {
  ok: boolean
  message?: string
  deletedIds: string[]
  chapters: number
  pages: number
}

/** 删书：逐步检查删除结果；部分失败时返回已删 ID，供内存刷新与墓碑记录 */
export async function removeBookCascade(bookId: string): Promise<CascadeDeleteResult> {
  await ensureDb()
  const chapters = readAll<WordBookChapter>(WORD_BOOK_CHAPTER_PREFIX, 'wb_chapter').filter(c => c.bookId === bookId)
  const pages = readAll<WordBookPage>(WORD_BOOK_PAGE_PREFIX, 'wb_page').filter(p => p.bookId === bookId)
  const deletedIds: string[] = []
  const remove = async (id: string) => {
    const result = await removeDoc(id)
    if (!result.ok) return { ok: false, message: result.message || `删除失败：${id}`, deletedIds, chapters: 0, pages: 0 }
    deletedIds.push(id)
    return null
  }
  for (const page of pages) {
    const failure = await remove(page._id)
    if (failure) return failure
  }
  for (const chapter of chapters) {
    const failure = await remove(chapter._id)
    if (failure) return failure
  }
  const failure = await remove(bookId)
  if (failure) return failure
  return { ok: true, deletedIds, chapters: chapters.length, pages: pages.length }
}

// ===== 章 =====

export async function getAllChapters(): Promise<WordBookChapter[]> {
  await ensureDb()
  return readAll<WordBookChapter>(WORD_BOOK_CHAPTER_PREFIX, 'wb_chapter').sort((a, b) => a.order - b.order || a.ctime - b.ctime)
}

export async function saveChapter(chapter: WordBookChapter): Promise<DbReturn> {
  return putDoc(chapter)
}

/** 删章：级联删其下页，任何一步失败都返回错误 */
export async function removeChapterCascade(chapterId: string): Promise<Omit<CascadeDeleteResult, 'chapters'>> {
  await ensureDb()
  const pages = readAll<WordBookPage>(WORD_BOOK_PAGE_PREFIX, 'wb_page').filter(p => p.chapterId === chapterId)
  const deletedIds: string[] = []
  const remove = async (id: string) => {
    const result = await removeDoc(id)
    if (!result.ok) return { ok: false, message: result.message || `删除失败：${id}`, deletedIds, pages: 0 }
    deletedIds.push(id)
    return null
  }
  for (const page of pages) {
    const failure = await remove(page._id)
    if (failure) return failure
  }
  const failure = await remove(chapterId)
  if (failure) return failure
  return { ok: true, deletedIds, pages: pages.length }
}

// ===== 同步恢复时按 ID 删除单条，不触发级联 =====

export async function removeBook(id: string): Promise<DbReturn> {
  return removeDoc(id)
}

export async function removeChapter(id: string): Promise<DbReturn> {
  return removeDoc(id)
}

// ===== 页 =====

export async function getAllPages(): Promise<WordBookPage[]> {
  await ensureDb()
  return readAll<WordBookPage>(WORD_BOOK_PAGE_PREFIX, 'wb_page').sort((a, b) => a.order - b.order || a.ctime - b.ctime)
}

export async function savePage(page: WordBookPage): Promise<DbReturn> {
  return putDoc(page)
}

export async function removePage(pageId: string): Promise<DbReturn> {
  return removeDoc(pageId)
}
