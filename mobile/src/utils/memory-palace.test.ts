/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest'
import {
  clampLevel,
  getPegLevel,
  isPegDue,
  isPegMastered,
  markPegRemembered,
  markPegForgotten,
  mergePalace,
  mergePalaceList,
  mergePegItemList,
  chunkArticleContent,
  resolvePegContent,
} from './memory-palace'
import type { MobilePalace, MobilePegItem, MobileTextArticle } from '@/stores/useUtils/types'

function makePalace(overrides: Partial<MobilePalace> = {}): MobilePalace {
  return {
    _id: 'p1',
    name: '测试宫殿',
    loci: [
      { order: 1, name: '大门' },
      { order: 2, name: '客厅' },
    ],
    ctime: 1,
    utime: 1,
    ...overrides,
  }
}

function makePeg(overrides: Partial<MobilePegItem> = {}): MobilePegItem {
  return {
    _id: 'peg_p1_1',
    palaceId: 'p1',
    locusOrder: 1,
    freeText: '内容',
    ...overrides,
  }
}

describe('记忆宫殿 SRS', () => {
  it('clampLevel / getPegLevel 边界', () => {
    expect(clampLevel(-1)).toBe(0)
    expect(clampLevel(99)).toBe(12)
    expect(getPegLevel(makePeg({ level: 5 }))).toBe(5)
    expect(getPegLevel(makePeg())).toBe(0)
  })

  it('isPegDue：未自评立即到期，过期到期，窗口内不到期', () => {
    // DEFAULT_INTERVALS[0] = 1 分钟
    expect(isPegDue(makePeg(), 1000)).toBe(true)
    expect(isPegDue(makePeg({ level: 0, learnDate: 0 }), 1000)).toBe(true)
    const justLearned = makePeg({ level: 5, learnDate: 10_000 })
    expect(isPegDue(justLearned, 10_000 + 60_000)).toBe(false)
    // level 5 间隔为 1440 分钟
    expect(isPegDue(justLearned, 10_000 + 1440 * 60_000 + 1)).toBe(true)
  })

  it('isPegMastered：满级才算记住', () => {
    expect(isPegMastered(makePeg({ level: 12 }))).toBe(true)
    expect(isPegMastered(makePeg({ level: 11 }))).toBe(false)
  })

  it('markPegRemembered：窗口内按牢固度升级，超窗只刷新 learnDate', () => {
    const now = 1_000_000
    // level 0 窗口 = 1 分钟后 ~ 30 分钟后
    const inWindow = makePeg({ level: 0, learnDate: now - 5 * 60_000 })
    expect(markPegRemembered(inWindow, now).level).toBe(1)
    expect(markPegRemembered(inWindow, now, '较强').level).toBe(2)
    expect(markPegRemembered(inWindow, now, '极强').level).toBe(3)
    // 未学过（无 learnDate）：允许升级
    expect(markPegRemembered(makePeg(), now).level).toBe(1)
    // 超窗（level 0 升级窗口 = 1 分钟后 ~ 360 分钟后）：不升级只刷新
    const outWindow = makePeg({ level: 0, learnDate: now - 400 * 60_000 })
    const refreshed = markPegRemembered(outWindow, now)
    expect(refreshed.level).toBe(0)
    expect(refreshed.learnDate).toBe(now)
    // 封顶 12
    expect(markPegRemembered(makePeg({ level: 12, learnDate: now - 1000 }), now).level).toBe(12)
  })

  it('markPegForgotten：降级；12 级重置为 1', () => {
    const now = 500
    expect(markPegForgotten(makePeg({ level: 5 }), now).level).toBe(4)
    expect(markPegForgotten(makePeg({ level: 1 }), now).level).toBe(1)
    expect(markPegForgotten(makePeg({ level: 12 }), now).level).toBe(1)
  })
})

describe('记忆宫殿同步合并', () => {
  it('mergePalace：utime 较新者覆盖，图片缺失回退', () => {
    const local = makePalace({ utime: 100, loci: [{ order: 1, name: '旧名', imageUrl: 'data:local' }] })
    const remote = makePalace({ name: '新名', utime: 200, loci: [{ order: 1, name: '新名' }] })
    const merged = mergePalace(local, remote)
    expect(merged.name).toBe('新名')
    expect(merged.loci[0].imageUrl).toBe('data:local')
    // 本地较新保留本地
    expect(mergePalace({ ...local, utime: 300 }, remote).loci[0].name).toBe('旧名')
    // 远端有图时用远端
    const remoteWithImg = makePalace({ utime: 200, loci: [{ order: 1, name: '新名', imageUrl: 'data:remote' }] })
    expect(mergePalace(local, remoteWithImg).loci[0].imageUrl).toBe('data:remote')
  })

  it('mergePalaceList：按 _id 并集合并', () => {
    const merged = mergePalaceList([makePalace()], [makePalace({ _id: 'p2', name: 'B' })])
    expect(merged.map(p => p._id).sort()).toEqual(['p1', 'p2'])
  })

  it('mergePegItemList：按 locusOrder 合并，learnDate 较新者保留', () => {
    const local = [makePeg({ level: 5, learnDate: 100 })]
    const remote = [makePeg({ level: 8, learnDate: 200 }), makePeg({ _id: 'peg_p1_2', locusOrder: 2, level: 1, learnDate: 50 })]
    const merged = mergePegItemList(local, remote)
    expect(merged).toHaveLength(2)
    expect(merged[0].locusOrder).toBe(1)
    expect(merged[0].level).toBe(8)
    expect(merged[1].level).toBe(1)
    // 远端较旧保留本地
    expect(mergePegItemList(local, [{ ...makePeg(), level: 2, learnDate: 50 }])[0].level).toBe(5)
  })
})

describe('文章切块与挂载解析', () => {
  it('chunkArticleContent：按句 / 按段；小数点不切分', () => {
    expect(chunkArticleContent('你好。世界！', 'sentence')).toEqual(['你好。', '世界！'])
    expect(chunkArticleContent('a=3.14。b=2', 'sentence')).toEqual(['a=3.14。', 'b=2'])
    expect(chunkArticleContent('段一\n\n段二', 'paragraph')).toEqual(['段一', '段二'])
    expect(chunkArticleContent('  ', 'sentence')).toEqual([])
  })

  it('resolvePegContent：自由文本直接返回', () => {
    expect(resolvePegContent(makePeg({ freeText: '自由文本' }), [])).toEqual({ text: '自由文本', deleted: false })
  })

  it('resolvePegContent：文章引用解析切块；文章缺失或越界标记 deleted', () => {
    const article: MobileTextArticle = {
      _id: 'a1',
      title: '文章',
      content: '第一句。第二句。',
      tags: [],
      ctime: 1,
      utime: 1,
      reviewCount: 0,
    }
    const peg: MobilePegItem = {
      _id: 'peg_p1_1',
      palaceId: 'p1',
      locusOrder: 1,
      contentRef: { type: 'text-article', articleId: 'a1', chunkIndex: 1 },
    }
    expect(resolvePegContent(peg, [article])).toEqual({ text: '第二句。', deleted: false, articleTitle: '文章' })
    expect(resolvePegContent(peg, []).deleted).toBe(true)
    const outOfRange: MobilePegItem = { ...peg, contentRef: { type: 'text-article', articleId: 'a1', chunkIndex: 9 } }
    expect(resolvePegContent(outOfRange, [article])).toEqual({ text: '', deleted: true, articleTitle: '文章' })
  })
})
