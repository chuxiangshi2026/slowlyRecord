/**
 * 移动端首次进入词图闯关时播种内置示例书（与桌面同一份数据）。
 * 用 storage 标记「已播种」：用户删掉后不再自动生成。
 */
import { useWordBook } from '@/stores/useWordBook'
import { WORDBOOK_SAMPLES } from './wordbook-samples'
import { WORD_BOOK_PAGE_SIZE, getDefaultPageName, splitWordsIntoPages, toWordBookWord } from './word-book'
import type { WordBookKey } from '../types/word-book'

const SEED_KEY = 'sr_wordbook_samples_v1'

export function seedWordBookSamples(): void {
  try {
    if (uni.getStorageSync(SEED_KEY) === '1') return
    const store = useWordBook()
    store.load(true)
    for (const sample of WORDBOOK_SAMPLES) {
      if (store.sortedBooks.some((book: any) => book.name === sample.name)) continue
      const book = store.createBook(sample.name, { desc: sample.desc, isSample: true, sampleVersion: 7 })
      for (const chapter of sample.chapters) {
        const chapterDoc = store.createChapter(book._id, chapter.name)
        for (const samplePage of chapter.pages) {
          const key: WordBookKey = {
            type: samplePage.keyType,
            value: samplePage.keyValue,
            description: samplePage.keyDescription,
          }
          const chunks = splitWordsIntoPages(samplePage.words.map(toWordBookWord), WORD_BOOK_PAGE_SIZE, 'freq')
          for (let i = 0; i < chunks.length; i++) {
            store.createPage({
              bookId: book._id,
              chapterId: chapterDoc._id,
              name: getDefaultPageName(key, i + 1, chunks.length),
              key,
              words: chunks[i],
              note: samplePage.note,
              source: { bankName: '内置词库', filter: { sample: true } },
            })
          }
        }
      }
    }
    uni.setStorageSync(SEED_KEY, '1')
  } catch (e) {
    console.warn('[词图] 示例书播种失败', e)
  }
}
