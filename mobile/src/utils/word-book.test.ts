import { describe, it, expect } from 'vitest'
import {
  buildWordBookChapterDirectory,
  getDefaultPageName,
  groupPagesIntoLevels,
  isPageDue,
  resolveWordBookKey,
  schedulePageReview,
  splitWordsIntoPages,
} from './word-book'
import type { WordBookPage } from '../types/word-book'

const makePage = (order: number, extra: Partial<WordBookPage> = {}): WordBookPage => ({
  _id: `wb_page_${order}`,
  type: 'wb_page',
  bookId: 'b',
  chapterId: 'c',
  name: `P${order}`,
  order,
  key: { type: 'root', value: 'old' },
  words: [{ sourceId: 'a', text: 'fold', explains: '折叠' }],
  source: {},
  level: 0,
  nextReviewAt: 0,
  ctime: order,
  utime: order,
  ...extra,
})

describe('移动端 word-book 逻辑（与桌面同口径）', () => {
  it('章节目录按章节名排序，章内页按顺序展示并保留同名提示', () => {
    const directory = buildWordBookChapterDirectory([
      { _id: 'c3', name: '字母组合' },
      { _id: 'c2', name: '词根 OLD' },
      { _id: 'c1', name: ' 词根 old ' },
    ], [
      makePage(2, { chapterId: 'c1', words: [{ sourceId: 'b', text: 'bold', explains: '大胆的' }, { sourceId: 'c', text: 'cold', explains: '冷的' }] }),
      makePage(1, { chapterId: 'c1' }),
    ])
    expect(directory.map(item => [item.chapter._id, item.pageCount, item.wordCount, item.hasSameName])).toEqual([
      ['c2', 0, 0, true],
      ['c1', 2, 3, true],
      ['c3', 0, 0, false],
    ])
    expect(directory.find(item => item.chapter._id === 'c1')?.pages.map(itemPage => itemPage._id))
      .toEqual(['wb_page_1', 'wb_page_2'])
  })

  it('中心节点按筛选条件推导', () => {
    expect(resolveWordBookKey({ affixType: 'root', affixText: 'old' })).toEqual({ type: 'root', value: 'old' })
    expect(resolveWordBookKey({ phonetic: 'əʊld' })).toEqual({ type: 'phonetic', value: 'əʊld' })
    expect(resolveWordBookKey({})).toEqual({ type: 'text', value: '' })
  })

  it('页名默认值与分页', () => {
    expect(getDefaultPageName({ type: 'root', value: 'old' }, 1, 1)).toBe('old 篇')
    expect(getDefaultPageName({ type: 'root', value: 'old' }, 2, 3)).toBe('old 篇 2')
    const chunks = splitWordsIntoPages(
      [{ text: 'a', freq: 3 }, { text: 'b', freq: 1 }, { text: 'c', freq: 2 }],
      2,
      'freq',
    )
    expect(chunks.map(chunk => chunk.map(w => w.text))).toEqual([['b', 'c'], ['a']])
  })

  it('页级调度与到期判断', () => {
    const result = schedulePageReview({ level: 3, bestScore: 0, words: [1, 2] } as any, 0, 1000)
    expect(result.level).toBe(4)
    expect(result.completedAt).toBe(1000)
    expect(result.lastScore).toBe(100)

    const failed = schedulePageReview({ level: 1, words: [1] } as any, 1, 1000)
    expect(failed.level).toBe(0)
    expect(failed.completedAt).toBeUndefined()

    expect(isPageDue({ nextReviewAt: 999 }, 1000)).toBe(true)
    expect(isPageDue({ nextReviewAt: 1001 }, 1000)).toBe(false)
  })

  it('关卡按每关页数分组，整组完成才算达成', () => {
    const groups = groupPagesIntoLevels([
      makePage(1, { completedAt: 1 }),
      makePage(2, { completedAt: 1 }),
      makePage(3),
    ], 2)
    expect(groups).toHaveLength(2)
    expect(groups[0].completed).toBe(true)
    expect(groups[1].completed).toBe(false)
  })
})
