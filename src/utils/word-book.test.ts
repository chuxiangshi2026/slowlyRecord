import { describe, it, expect } from 'vitest'
import {
  MAX_WORD_BOOK_PAGE_SIZE,
  buildWordBookPage,
  formatDueLabel,
  getDefaultBookName,
  getDefaultChapterName,
  getDefaultPageName,
  groupPagesIntoLevels,
  normalizeLevelSize,
  normalizePageSize,
  resolveWordBookKey,
  schedulePageReview,
  splitWordsIntoPages,
  syncChapterLevels,
  toWordBookWord,
} from './word-book'
import type { WordBookPage } from '@/types/word-book'

const page = (order: number, extra: Partial<WordBookPage> = {}): WordBookPage => ({
  _id: `page_${order}`,
  type: 'wb_page',
  bookId: 'book_1',
  chapterId: 'chapter_1',
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

describe('word-book 纯逻辑', () => {
  describe('resolveWordBookKey（中心节点）', () => {
    it('词根 / 前缀 / 后缀按筛选类型取', () => {
      expect(resolveWordBookKey({ affixType: 'root', affixText: 'old' })).toEqual({ type: 'root', value: 'old' })
      expect(resolveWordBookKey({ affixType: 'prefix', affixText: 'pre' })).toEqual({ type: 'prefix', value: 'pre' })
      expect(resolveWordBookKey({ affixType: 'suffix', affixText: 'tion' })).toEqual({ type: 'suffix', value: 'tion' })
    })

    it('只有类型没有文本时用类型占位', () => {
      expect(resolveWordBookKey({ affixType: 'root', affixText: '' })).toEqual({ type: 'root', value: '词根' })
    })

    it('音标筛选生成音标中心', () => {
      expect(resolveWordBookKey({ phonetic: 'əʊld' })).toEqual({ type: 'phonetic', value: 'əʊld' })
    })

    it('没有任何筛选时退化为文本中心（空值）', () => {
      expect(resolveWordBookKey({})).toEqual({ type: 'text', value: '' })
    })
  })

  describe('命名默认值', () => {
    it('书 = 词库 · 维度', () => {
      expect(getDefaultBookName('四级词汇', { type: 'root', value: 'old' })).toBe('四级词汇 · 词根')
    })

    it('章带中心词时用维度 + 词元', () => {
      expect(getDefaultChapterName({ type: 'root', value: 'old' })).toBe('词根 old')
      expect(getDefaultChapterName({ type: 'text', value: '' }, 3)).toBe('第 3 章')
    })

    it('页单页不加序号，多页加序号', () => {
      expect(getDefaultPageName({ type: 'root', value: 'old' }, 1, 1)).toBe('old 篇')
      expect(getDefaultPageName({ type: 'root', value: 'old' }, 2, 3)).toBe('old 篇 2')
      expect(getDefaultPageName({ type: 'text', value: '' }, 2, 3)).toBe('第 2 页')
    })
  })

  describe('splitWordsIntoPages（分页）', () => {
    const words = ['fold', 'bold', 'hold', 'cold', 'gold', 'sold'].map((text, i) => ({ text, freq: 6 - i }))

    it('按页大小切块，页数 = ceil(n / size)', () => {
      expect(splitWordsIntoPages(words, 2).map(chunk => chunk.length)).toEqual([2, 2, 2])
      expect(splitWordsIntoPages(words, 4).map(chunk => chunk.length)).toEqual([4, 2])
    })

    it('原顺序保持输入顺序', () => {
      expect(splitWordsIntoPages(words, 3)[0].map(w => w.text)).toEqual(['fold', 'bold', 'hold'])
    })

    it('按词频排序时排名小的在前，缺词频的排最后', () => {
      const mixed = [{ text: 'rare', freq: 9000 }, { text: 'common', freq: 100 }, { text: 'unknown' }]
      expect(splitWordsIntoPages(mixed, 3, 'freq')[0].map(w => w.text)).toEqual(['common', 'rare', 'unknown'])
    })

    it('按长度 / 字母序排序', () => {
      expect(splitWordsIntoPages(words, 6, 'length')[0].map(w => w.text)).toEqual(['bold', 'cold', 'fold', 'gold', 'hold', 'sold'])
      expect(splitWordsIntoPages([{ text: 'bb' }, { text: 'aa' }], 2, 'alpha')[0].map(w => w.text)).toEqual(['aa', 'bb'])
    })

    it('页大小被限制在 1..MAX', () => {
      expect(normalizePageSize(0)).toBe(1)
      expect(normalizePageSize(999)).toBe(MAX_WORD_BOOK_PAGE_SIZE)
      expect(normalizePageSize(undefined)).toBe(12)
    })

    it('关卡页数被限制为至少 1', () => {
      expect(normalizeLevelSize(0)).toBe(1)
      expect(normalizeLevelSize(-3)).toBe(1)
      expect(normalizeLevelSize(undefined)).toBe(5)
    })
  })

  describe('toWordBookWord（词条快照）', () => {
    it('兼容桌面 text 与移动端 word 两种字段', () => {
      expect(toWordBookWord({ _id: 'x', text: 'fold', explains: '折叠', freq: 520 })).toEqual({
        sourceId: 'x', text: 'fold', explains: '折叠', freq: 520,
      })
      expect(toWordBookWord({ id: 'y', word: 'bold', meaning: '大胆' })).toEqual({
        sourceId: 'y', text: 'bold', explains: '大胆',
      })
    })
  })

  describe('buildWordBookPage', () => {
    it('首轮等级 0，下次复习 = 现在 + 1 分钟', () => {
      const now = 1_700_000_000_000
      const built = buildWordBookPage({
        bookId: 'b', chapterId: 'c', name: 'old 篇', order: 1,
        key: { type: 'root', value: 'old' },
        source: {},
        words: [{ sourceId: 'a', text: 'fold', explains: '折叠' }],
        now,
      })
      expect(built.level).toBe(0)
      expect(built.nextReviewAt).toBe(now + 60_000)
      expect(built._id.startsWith('wb_page_')).toBe(true)
    })
  })

  describe('schedulePageReview（页级调度）', () => {
    it('全记住升一级，下次复习按新等级间隔', () => {
      const result = schedulePageReview({ level: 2, bestScore: 0, words: [1, 2, 3, 4] } as any, 0, 1000)
      expect(result.level).toBe(3)
      expect(result.lastScore).toBe(100)
      expect(result.nextReviewAt).toBeGreaterThan(1000)
      expect(result.completedAt).toBe(1000)
    })

    it('有答错降 4 级（下限 0），不标记完成', () => {
      const result = schedulePageReview({ level: 2, bestScore: 90, words: [1, 2] } as any, 2, 1000)
      expect(result.level).toBe(0)
      expect(result.lastScore).toBe(50)
      expect(result.completedAt).toBeUndefined()
      expect(result.bestScore).toBe(90)
    })

    it('12 级全对仍封顶 12', () => {
      expect(schedulePageReview({ level: 12, words: [1] } as any, 0, 1000).level).toBe(12)
    })
  })

  describe('关卡分组与达成', () => {
    const pages = [page(1, { completedAt: 1 }), page(2, { completedAt: 2 }), page(3), page(4), page(5), page(6)]

    it('每 5 页一关，未全过的组不算达成', () => {
      const groups = groupPagesIntoLevels(pages, 5)
      expect(groups).toHaveLength(2)
      expect(groups[0].pages).toHaveLength(5)
      expect(groups[0].completed).toBe(false)
      expect(groups[1].completed).toBe(false)
    })

    it('整组完成才记录关卡，且只增不减', () => {
      const done = [page(1, { completedAt: 1 }), page(2, { completedAt: 2 })]
      const levels = syncChapterLevels({ levelSize: 2, levels: [] }, done, 999)
      expect(levels).toEqual([{ index: 1, completedAt: 999 }])

      const again = syncChapterLevels({ levelSize: 2, levels }, done, 1000)
      expect(again).toEqual(levels)
    })
  })

  describe('formatDueLabel', () => {
    it('按剩余时间给出人话', () => {
      const now = 1_700_000_000_000
      expect(formatDueLabel(now - 1, now)).toBe('今天到期')
      expect(formatDueLabel(now + 30 * 60_000, now)).toBe('30 分钟后复习')
      expect(formatDueLabel(now + 5 * 3600_000, now)).toBe('5 小时后复习')
      expect(formatDueLabel(now + 3 * 24 * 3600_000, now)).toBe('3 天后复习')
    })
  })
})
