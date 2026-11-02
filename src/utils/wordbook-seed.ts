/**
 * 首次进入词图闯关时播种内置示例书。
 * 用 localStorage 标记「已播种」：用户删掉示例后不会再自动生成。
 */
import { useWordBookStore } from '@/stores/wordBook'
import { WORDBOOK_SAMPLES } from './wordbook-samples'
import { WORD_BOOK_PAGE_SIZE, getDefaultPageName, splitWordsIntoPages, toWordBookWord } from './word-book'
import type { WordBookKey } from '@/types/word-book'

const SEED_KEY = 'sr_wordbook_samples_v1'

export async function seedWordBookSamples(): Promise<void> {
  try {
    if (localStorage.getItem(SEED_KEY) === '1') return
  } catch {
    return
  }
  try {
    const store = useWordBookStore()
    await store.loadAll(true)
    for (const sample of WORDBOOK_SAMPLES) {
      if (store.sortedBooks.some(book => book.name === sample.name)) continue
      const book = await store.createBook(sample.name, { desc: sample.desc, isSample: true })
      for (const chapter of sample.chapters) {
        const chapterDoc = await store.createChapter(book._id, chapter.name)
        const key: WordBookKey = { type: chapter.keyType, value: chapter.keyValue }
        const chunks = splitWordsIntoPages(chapter.words.map(toWordBookWord), WORD_BOOK_PAGE_SIZE, 'freq')
        for (let i = 0; i < chunks.length; i++) {
          await store.createPage({
            bookId: book._id,
            chapterId: chapterDoc._id,
            name: getDefaultPageName(key, i + 1, chunks.length),
            key,
            words: chunks[i],
            source: { bankName: '四级词汇', filter: { sample: true } },
          })
        }
      }
    }
    localStorage.setItem(SEED_KEY, '1')
  } catch (e) {
    console.warn('[词图] 示例书播种失败', e)
  }
}
