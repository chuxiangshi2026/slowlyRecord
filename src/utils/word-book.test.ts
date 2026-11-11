import { describe, it, expect } from 'vitest'
import {
  MAX_WORD_BOOK_PAGE_SIZE,
  buildPageNameFromBase,
  buildWordBookChapterDirectory,
  buildWordBookPage,
  ensureWordBookEntryIds,
  formatDueLabel,
  getDefaultBookName,
  getDefaultChapterName,
  getDefaultPageName,
  groupPagesIntoLevels,
  hasPageContentUpdate,
  isPageDue,
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
  words: [{ entryId: `e${order}`, sourceId: 'a', text: 'fold', explains: '折叠' }],
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
      expect(resolveWordBookKey({ affixType: 'root', affixText: 'port' })).toEqual({ type: 'root', value: 'port' })
      expect(resolveWordBookKey({ affixType: 'prefix', affixText: 'pre' })).toEqual({ type: 'prefix', value: 'pre' })
      expect(resolveWordBookKey({ affixType: 'suffix', affixText: 'tion' })).toEqual({ type: 'suffix', value: 'tion' })
    })

    it('只有类型没有文本时用类型占位', () => {
      expect(resolveWordBookKey({ affixType: 'root', affixText: '' })).toEqual({ type: 'root', value: '词根' })
    })

    it('音标筛选生成音标中心', () => {
      expect(resolveWordBookKey({ phonetic: 'əʊ' })).toEqual({ type: 'phonetic', value: 'əʊ' })
    })

    it('纯字母 pattern 归为字母组合，其他筛选退化为文本', () => {
      expect(resolveWordBookKey({ pattern: 'old' })).toEqual({ type: 'letters', value: 'old' })
      expect(resolveWordBookKey({ pattern: 'o*d' })).toEqual({ type: 'text', value: '' })
      expect(resolveWordBookKey({})).toEqual({ type: 'text', value: '' })
    })
  })

  describe('命名默认值', () => {
    it('书 = 词库 · 维度', () => {
      expect(getDefaultBookName('四级词汇', { type: 'root', value: 'port' })).toBe('四级词汇 · 词根')
      expect(getDefaultBookName('四级词汇', { type: 'letters', value: 'old' })).toBe('四级词汇 · 字母组合')
    })

    it('章带中心词时用维度 + 词元', () => {
      expect(getDefaultChapterName({ type: 'root', value: 'port' })).toBe('词根 port')
      expect(getDefaultChapterName({ type: 'letters', value: 'old' })).toBe('字母组合 old')
      expect(getDefaultChapterName({ type: 'text', value: '' }, 3)).toBe('第 3 章')
    })

    it('页单页不加序号，多页加序号', () => {
      expect(getDefaultPageName({ type: 'root', value: 'port' }, 1, 1)).toBe('port 篇')
      expect(getDefaultPageName({ type: 'root', value: 'port' }, 2, 3)).toBe('port 篇 2')
      expect(getDefaultPageName({ type: 'text', value: '' }, 2, 3)).toBe('第 2 页')
    })

    it('自定义页名单页直接使用，多页追加序号', () => {
      expect(buildPageNameFromBase('易混词', 1, 1)).toBe('易混词')
      expect(buildPageNameFromBase('易混词', 2, 3)).toBe('易混词 2')
      expect(buildPageNameFromBase('  ', 2, 3)).toBe('第 2 页')
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

    it('关卡页数被限制为至少 1（旧字段兼容）', () => {
      expect(normalizeLevelSize(0)).toBe(1)
      expect(normalizeLevelSize(-3)).toBe(1)
      expect(normalizeLevelSize(undefined)).toBe(5)
    })
  })

  describe('toWordBookWord（词条快照）', () => {
    it('兼容桌面 text 与移动端 word 两种字段，并生成本页条目 ID', () => {
      expect(toWordBookWord({ _id: 'x', text: 'fold', explains: '折叠', freq: 520 })).toEqual(expect.objectContaining({
        sourceId: 'x', text: 'fold', explains: '折叠', freq: 520,
      }))
      const first = toWordBookWord({ _id: 'x', text: 'fold', explains: '折叠' })
      const second = toWordBookWord({ _id: 'x', text: 'fold', explains: '折叠' })
      expect(first.entryId).toBeTruthy()
      expect(second.entryId).toBeTruthy()
      expect(first.entryId).not.toBe(second.entryId)

      expect(toWordBookWord({ id: 'y', word: 'bold', meaning: '大胆' })).toEqual(expect.objectContaining({
        sourceId: 'y', text: 'bold', explains: '大胆',
      }))
    })

    it('应保留例句和记忆点，并深拷贝例句数组', () => {
      const examples = [{ english: 'She acted quickly.', chinese: '她迅速行动。' }]
      const result = toWordBookWord({
        text: 'act', explains: '行动', examples, memoryTip: 'act = 做',
      })
      expect(result.examples).toEqual(examples)
      expect(result.examples).not.toBe(examples)
      expect(result.memoryTip).toBe('act = 做')
    })
  })

  describe('ensureWordBookEntryIds（旧数据迁移）', () => {
    it('缺失 ID 按页面与顺序确定性回填，重复 ID 重新生成', () => {
      const oldPage = page(1, {
        words: [
          { sourceId: 'a', text: 'fold', explains: '折叠' },
          { entryId: 'same', sourceId: 'b', text: 'hold', explains: '拿住' },
          { entryId: 'same', sourceId: 'c', text: 'cold', explains: '冷的' },
        ],
      })
      const first = ensureWordBookEntryIds(oldPage)
      const second = ensureWordBookEntryIds(oldPage)
      expect(first.changed).toBe(true)
      expect(first.page.words.map(word => word.entryId)).toEqual(second.page.words.map(word => word.entryId))
      expect(new Set(first.page.words.map(word => word.entryId)).size).toBe(3)
    })
  })

  describe('buildWordBookPage', () => {
    it('首轮等级 0，不提前安排复习，内容时间已记录', () => {
      const now = 1_700_000_000_000
      const built = buildWordBookPage({
        bookId: 'b', chapterId: 'c', name: 'old 篇', order: 1,
        key: { type: 'letters', value: 'old' },
        source: {},
        words: [{ sourceId: 'a', text: 'fold', explains: '折叠' }],
        now,
      })
      expect(built.level).toBe(0)
      expect(built.nextReviewAt).toBe(0)
      expect(built.contentUpdatedAt).toBe(now)
      expect(built._id.startsWith('wb_page_')).toBe(true)
      expect(built.words[0].entryId).toBeTruthy()
    })
  })

  describe('schedulePageReview（页级调度）', () => {
    it('无错升一级，按新等级间隔并记录首轮完成', () => {
      const result = schedulePageReview({ level: 2, bestScore: 0, words: [1, 2, 3, 4] } as any, 0, 1000)
      expect(result.level).toBe(3)
      expect(result.lastScore).toBe(100)
      expect(result.nextReviewAt).toBeGreaterThan(1000)
      expect(result.completedAt).toBe(1000)
    })

    it('有错不升级也不降 4 级，但仍记录完成过一轮', () => {
      const result = schedulePageReview({ level: 2, bestScore: 90, words: [1, 2] } as any, 2, 1000)
      expect(result.level).toBe(2)
      expect(result.lastScore).toBe(0)
      expect(result.completedAt).toBe(1000)
      expect(result.bestScore).toBe(90)
    })

    it('高等级有错时复习间隔最多 1 天', () => {
      const now = 1_700_000_000_000
      const result = schedulePageReview({ level: 8, words: [1, 2] } as any, 1, now)
      expect(result.level).toBe(8)
      expect(result.nextReviewAt - now).toBe(24 * 60 * 60_000)
    })

    it('12 级无错仍封顶 12', () => {
      expect(schedulePageReview({ level: 12, words: [1] } as any, 0, 1000).level).toBe(12)
    })
  })

  describe('isPageDue（到期）', () => {
    it('未学习页面不计入到期；完成过一轮后才按 nextReviewAt 判断', () => {
      const now = 1_700_000_000_000
      expect(isPageDue(page(1), now)).toBe(false)
      expect(isPageDue(page(2, { completedAt: now - 1000, nextReviewAt: now - 1 }), now)).toBe(true)
      expect(isPageDue(page(3, { lastRound: { total: 1, firstTryKnown: 1, retriedCount: 0, firstTryWrongEntryIds: [], finishedAt: now - 1000 }, nextReviewAt: now + 1000 }), now)).toBe(false)
    })
  })

  describe('hasPageContentUpdate（内容更新提示）', () => {
    it('只提示学习后发生的内容编辑，新页面不提示', () => {
      expect(hasPageContentUpdate(page(1, { contentUpdatedAt: 200 }))).toBe(false)
      expect(hasPageContentUpdate(page(2, { readAt: 100, contentUpdatedAt: 50 }))).toBe(false)
      expect(hasPageContentUpdate(page(3, { readAt: 100, contentUpdatedAt: 200 }))).toBe(true)
      expect(hasPageContentUpdate(page(4, { lastReviewedAt: 300, contentUpdatedAt: 200 }))).toBe(false)
      expect(hasPageContentUpdate(page(5, { completedAt: 100, contentUpdatedAt: 200 }))).toBe(true)
    })
  })

  describe('章节目录', () => {
    it('章节目录按章节名排序，章内页按顺序展示并保留同名提示', () => {
      const chapters = [
        { _id: 'chapter_3', name: '字母组合' },
        { _id: 'chapter_2', name: '词根 OLD' },
        { _id: 'chapter_1', name: ' 词根 old ' },
      ]
      const pages = [
        page(2, { words: [...page(2).words, ...page(3).words] }),
        page(1),
      ]
      const directory = buildWordBookChapterDirectory(chapters, pages)
      expect(directory.map(item => [item.chapter._id, item.pageCount, item.wordCount, item.hasSameName])).toEqual([
        ['chapter_2', 0, 0, true],
        ['chapter_1', 2, 3, true],
        ['chapter_3', 0, 0, false],
      ])
      expect(directory.find(item => item.chapter._id === 'chapter_1')?.pages.map(itemPage => itemPage._id))
        .toEqual(['page_1', 'page_2'])
      expect(chapters[0]._id).toBe('chapter_3')
    })
  })

  describe('关卡分组与达成（旧字段兼容）', () => {
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
