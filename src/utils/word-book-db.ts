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

/** 删书：级联删章与页，返回被删数量 */
export async function removeBookCascade(bookId: string): Promise<{ ok: boolean; chapters: number; pages: number }> {
  await ensureDb()
  const chapters = readAll<WordBookChapter>(WORD_BOOK_CHAPTER_PREFIX, 'wb_chapter').filter(c => c.bookId === bookId)
  const pages = readAll<WordBookPage>(WORD_BOOK_PAGE_PREFIX, 'wb_page').filter(p => p.bookId === bookId)
  for (const page of pages) await removeDoc(page._id)
  for (const chapter of chapters) await removeDoc(chapter._id)
  const result = await removeDoc(bookId)
  return { ok: !!result.ok, chapters: chapters.length, pages: pages.length }
}

// ===== 章 =====

export async function getAllChapters(): Promise<WordBookChapter[]> {
  await ensureDb()
  return readAll<WordBookChapter>(WORD_BOOK_CHAPTER_PREFIX, 'wb_chapter').sort((a, b) => a.order - b.order || a.ctime - b.ctime)
}

export async function saveChapter(chapter: WordBookChapter): Promise<DbReturn> {
  return putDoc(chapter)
}

/** 删章：级联删其下页 */
export async function removeChapterCascade(chapterId: string): Promise<{ ok: boolean; pages: number }> {
  await ensureDb()
  const pages = readAll<WordBookPage>(WORD_BOOK_PAGE_PREFIX, 'wb_page').filter(p => p.chapterId === chapterId)
  for (const page of pages) await removeDoc(page._id)
  const result = await removeDoc(chapterId)
  return { ok: !!result.ok, pages: pages.length }
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
