/**
 * 移动端示例词集：首次只播种一本入门示例，其余从词集页按需导入。
 * 用 storage 标记「已播种」：用户删掉后不再自动生成。
 */
import { useWordBook } from '@/stores/useWordBook'
import { WORDBOOK_SAMPLES } from './wordbook-samples'
import { WORD_BOOK_PAGE_SIZE, getDefaultPageName, splitWordsIntoPages, toWordBookWord } from './word-book'
import type { WordBookSampleBook } from './wordbook-samples'
import type { WordBookBook, WordBookKey } from '../types/word-book'

const SEED_KEY = 'sr_wordbook_samples_v2'
const INITIAL_SAMPLE = WORDBOOK_SAMPLES[0]

type WordBookStore = ReturnType<typeof useWordBook>

/** 创建示例词集；任一步失败抛错，由调用方决定整体回滚 */
function createSampleBook(
  store: WordBookStore,
  sample: WordBookSampleBook,
  onCreated?: (bookId: string) => void,
): WordBookBook {
  const book = store.createBook(sample.name, { desc: sample.desc, isSample: true, sampleVersion: 8 })
  if (!book) throw new Error(`创建示例词集失败：${sample.name}`)
  onCreated?.(book._id)
  for (const chapter of sample.chapters) {
    const chapterDoc = store.createChapter(book._id, chapter.name)
    if (!chapterDoc) throw new Error(`创建示例章节失败：${chapter.name}`)
    for (const samplePage of chapter.pages) {
      const key: WordBookKey = {
        type: samplePage.keyType,
        value: samplePage.keyValue,
        description: samplePage.keyDescription,
      }
      const chunks = splitWordsIntoPages(samplePage.words.map(toWordBookWord), WORD_BOOK_PAGE_SIZE, 'freq')
      for (let i = 0; i < chunks.length; i++) {
        const page = store.createPage({
          bookId: book._id,
          chapterId: chapterDoc._id,
          name: getDefaultPageName(key, i + 1, chunks.length),
          key,
          words: chunks[i],
          note: samplePage.note,
          source: { bankName: '内置词库', filter: { sample: true } },
        })
        if (!page) throw new Error(`创建示例学习页失败：${chapter.name}`)
      }
    }
  }
  return book
}

/** 词集页按需导入内置示例；同名时直接返回已有词集 */
export function addWordBookSample(sample: WordBookSampleBook): WordBookBook | null {
  const store = useWordBook()
  store.load(true)
  const existing = store.sortedBooks.find(book => book.name === sample.name)
  if (existing) return existing
  try {
    return createSampleBook(store, sample)
  } catch (e) {
    console.warn('[词集] 导入示例词集失败', e)
    return null
  }
}

const CLEANUP_KEY = 'sr_wordbook_samples_single_v1'

/** 一次性清理未学习过的多余内置示例，只保留首本；已开始学习或改名的示例保留 */
function pruneRedundantSamples(store: WordBookStore): void {
  try {
    if (uni.getStorageSync(CLEANUP_KEY) === '1') return
    const knownNames = new Set(WORDBOOK_SAMPLES.map(sample => sample.name))
    for (const book of store.sortedBooks) {
      if (!book.isSample || !knownNames.has(book.name) || book.name === INITIAL_SAMPLE.name) continue
      const pages = store.pages.filter(page => page.bookId === book._id)
      const started = pages.some(page => page.readAt || page.lastRound || page.completedAt || page.lastReviewedAt)
      if (!started) store.deleteBook(book._id)
    }
    uni.setStorageSync(CLEANUP_KEY, '1')
  } catch (e) {
    console.warn('[词集] 清理多余示例失败', e)
  }
}

export function seedWordBookSamples(): void {
  const store = useWordBook()
  const createdBookIds: string[] = []
  try {
    store.load(true)
    pruneRedundantSamples(store)
    if (uni.getStorageSync(SEED_KEY) === '1') return
    if (!store.sortedBooks.some(book => book.name === INITIAL_SAMPLE.name)) {
      createSampleBook(store, INITIAL_SAMPLE, id => createdBookIds.push(id))
    }
    uni.setStorageSync(SEED_KEY, '1')
  } catch (e) {
    createdBookIds.forEach(id => store.deleteBook(id))
    console.warn('[词集] 示例词集播种失败', e)
  }
}
