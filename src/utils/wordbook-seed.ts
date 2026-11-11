/**
 * 首次进入词集时播种内置示例，用户删除或编辑后不再自动恢复。
 * 内置示例列表可显式重新添加；同名时优先打开现有词集。
 */
import { useWordBookStore } from '@/stores/wordBook'
import type { WordBookItemResult } from '@/stores/wordBook'
import { WORDBOOK_SAMPLES } from './wordbook-samples'
import type { WordBookSampleBook } from './wordbook-samples'
import { WORD_BOOK_PAGE_SIZE, getDefaultPageName, splitWordsIntoPages, toWordBookWord } from './word-book'
import type { WordBookBook, WordBookKey } from '@/types/word-book'

const SAMPLE_VERSION = 7
const SEED_KEY = `sr_wordbook_samples_v${SAMPLE_VERSION}`
const PREVIOUS_SEED_KEYS = ['sr_wordbook_samples_v6', 'sr_wordbook_samples_v5', 'sr_wordbook_samples_v4', 'sr_wordbook_samples_v3', 'sr_wordbook_samples_v2']
const LEGACY_SEED_KEY = 'sr_wordbook_samples_v1'
/** 旧版示例书的名称：升级时只清理仍是示例（isSample）的书，用户已认领的保留 */
const PREVIOUS_SAMPLE_NAMES = ['示例词集', '常用单词', '名词集']

async function createSampleBook(sample: WordBookSampleBook): Promise<WordBookItemResult<WordBookBook>> {
  const store = useWordBookStore()
  const bookResult = await store.createBook(sample.name, { desc: sample.desc, isSample: true, sampleVersion: SAMPLE_VERSION })
  if (!bookResult.ok || !bookResult.item) return bookResult
  const book = bookResult.item
  try {
    for (const chapter of sample.chapters) {
      const chapterResult = await store.createChapter(book._id, chapter.name)
      if (!chapterResult.ok || !chapterResult.item) throw new Error(chapterResult.message || '创建示例章节失败')
      for (const samplePage of chapter.pages) {
        const key: WordBookKey = {
          type: samplePage.keyType,
          value: samplePage.keyValue,
          description: samplePage.keyDescription,
        }
        const chunks = splitWordsIntoPages(samplePage.words.map(toWordBookWord), WORD_BOOK_PAGE_SIZE, 'freq')
        for (let index = 0; index < chunks.length; index++) {
          const result = await store.createPage({
            bookId: book._id,
            chapterId: chapterResult.item._id,
            name: getDefaultPageName(key, index + 1, chunks.length),
            key,
            words: chunks[index],
            note: samplePage.note,
            source: { bankName: '内置词库', filter: { sample: true } },
          })
          if (!result.ok) throw new Error(result.message || '创建示例学习页失败')
        }
      }
    }
    return { ok: true, item: book }
  } catch (error) {
    await store.deleteBook(book._id)
    return { ok: false, message: error instanceof Error ? error.message : '添加示例词集失败' }
  }
}

export async function addWordBookSample(sample: WordBookSampleBook): Promise<WordBookItemResult<WordBookBook>> {
  const store = useWordBookStore()
  await store.loadAll()
  const existing = store.sortedBooks.find(book => book.name === sample.name)
  if (existing) return { ok: true, item: existing }
  return createSampleBook(sample)
}

function samplesForMigration(oldSamples: WordBookBook[], previousSeeded: boolean): WordBookSampleBook[] {
  // 新安装只播种一本入门示例，其余示例从「添加词集 → 内置示例」按需导入
  if (!previousSeeded) return WORDBOOK_SAMPLES.slice(0, 1)
  const oldNames = new Set(oldSamples.map(book => book.name))
  const needsFullMigration = oldSamples.some(book =>
    !book.sampleVersion
    || PREVIOUS_SAMPLE_NAMES.includes(book.name)
    || !WORDBOOK_SAMPLES.some(sample => sample.name === book.name),
  )
  if (needsFullMigration) return WORDBOOK_SAMPLES
  return WORDBOOK_SAMPLES.filter(sample => oldNames.has(sample.name))
}

async function createSamples(samples: WordBookSampleBook[]): Promise<string[]> {
  const store = useWordBookStore()
  const createdIds: string[] = []
  for (const sample of samples) {
    const existing = store.sortedBooks.find(book =>
      book.name === sample.name && (!book.isSample || book.sampleVersion === SAMPLE_VERSION),
    )
    if (existing) continue
    const result = await createSampleBook(sample)
    if (!result.ok || !result.item) throw new Error(result.message || '创建示例词集失败')
    createdIds.push(result.item._id)
  }
  return createdIds
}

function markSeeded(): void {
  try {
    localStorage.setItem(SEED_KEY, '1')
  } catch { /* 标记写失败时下次按版本续跑，不删除已创建内容 */ }
}

const CLEANUP_KEY = 'sr_wordbook_samples_single_v1'

/** 一次性清理未学习过的多余内置示例，只保留「词根册」；用户已开始学习或已改名的示例保留 */
async function pruneRedundantSamples(): Promise<void> {
  try {
    if (localStorage.getItem(CLEANUP_KEY) === '1') return
    const store = useWordBookStore()
    await store.loadAll(true)
    const knownNames = new Set(WORDBOOK_SAMPLES.map(sample => sample.name))
    for (const book of store.sortedBooks) {
      if (!book.isSample || !knownNames.has(book.name) || book.name === WORDBOOK_SAMPLES[0].name) continue
      const pages = store.pages.filter(page => page.bookId === book._id)
      const started = pages.some(page => page.readAt || page.lastRound || page.completedAt || page.lastReviewedAt)
      if (!started) await store.deleteBook(book._id)
    }
    localStorage.setItem(CLEANUP_KEY, '1')
  } catch (error) {
    console.warn('[词集] 清理多余示例失败', error)
  }
}

export async function seedWordBookSamples(): Promise<void> {
  let previousSeeded = false
  try {
    if (localStorage.getItem(SEED_KEY) === '1') {
      await pruneRedundantSamples()
      return
    }
    previousSeeded = [...PREVIOUS_SEED_KEYS, LEGACY_SEED_KEY].some(key => localStorage.getItem(key) === '1')
  } catch {
    return
  }

  const store = useWordBookStore()
  await store.loadAll(true)
  const oldSamples = store.sortedBooks.filter(book =>
    book.isSample && (
      // 新示例带版本号，改名后也能识别旧版本；老数据没有版本号时按旧名称兜底
      (book.sampleVersion ?? 0) < SAMPLE_VERSION || PREVIOUS_SAMPLE_NAMES.includes(book.name)
    )
  )
  // 老用户已删除示例或把示例认领为「我的词集」时，只迁移标记，不重新塞回示例
  if (previousSeeded && oldSamples.length === 0) {
    markSeeded()
    return
  }

  let createdIds: string[] = []
  try {
    createdIds = await createSamples(samplesForMigration(oldSamples, previousSeeded))
  } catch (error) {
    for (const bookId of createdIds.reverse()) await store.deleteBook(bookId)
    console.warn('[词集] 示例播种失败', error)
    return
  }

  try {
    for (const oldSample of oldSamples) {
      const result = await store.deleteBook(oldSample._id)
      if (!result.ok) throw new Error('旧示例清理失败')
    }
  } catch (error) {
    // 创建成功后才开始清理；清理失败保留新旧数据，下次复用新版并续跑
    console.warn('[词集] 旧示例清理失败', error)
    return
  }
  markSeeded()
}
