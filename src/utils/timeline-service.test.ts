import { describe, it, expect } from 'vitest'
import {
  mapLibraryEventToArticle,
  parseBatchTimeline,
  parseFigures,
  parseRelations,
  collectEras,
  collectReigns,
  filterTimelineEvents,
  TIMELINE_CATEGORIES,
  type LibraryTimelineEvent,
} from './timeline-service'

describe('timeline-service', () => {
  describe('mapLibraryEventToArticle', () => {
    it('应把 era 同时映射到 dynasty', () => {
      const ev: LibraryTimelineEvent = {
        title: '贞观之治',
        content: '唐太宗即位……',
        category: 'politics',
        region: 'china',
        year: 627,
        era: '唐',
        reign: '贞观元年',
        tags: ['唐朝'],
      }
      const article = mapLibraryEventToArticle(ev)
      expect(article.era).toBe('唐')
      expect(article.dynasty).toBe('唐')
      expect(article.source).toBe('时间线·唐')
    })

    it('当 era 为空时 dynasty 应为 undefined 且 source 使用默认值', () => {
      const ev: LibraryTimelineEvent = {
        title: '某事件',
        content: '内容',
        category: 'science',
        region: 'west',
      }
      const article = mapLibraryEventToArticle(ev)
      expect(article.dynasty).toBeUndefined()
      expect(article.source).toBe('时间线')
    })

    it('有效 category 应保持不变', () => {
      const categories = ['politics', 'literature', 'science', 'thought', 'society'] as const
      for (const category of categories) {
        const ev: LibraryTimelineEvent = { title: 't', content: 'c', category }
        expect(mapLibraryEventToArticle(ev).category).toBe(category)
      }
    })

    it('无效或空 category 应回退到 politics', () => {
      expect(mapLibraryEventToArticle({ title: 't', content: 'c', category: 'invalid' as any }).category).toBe('politics')
      expect(mapLibraryEventToArticle({ title: 't', content: 'c' }).category).toBe('politics')
    })
  })

  describe('parseBatchTimeline', () => {
    it('应解析所有标准元数据', () => {
      const text = `标题：商鞅变法
分类：politics
区域：china
年份：-356
年号：
时代：战国
地点：咸阳
标签：战国,秦国
背景：战国初期秦国偏弱
人物：秦孝公|秦国君主|任用商鞅
关系：秦孝公|商鞅|君臣|力挺变法
商鞅在秦孝公支持下推行变法。`
      const events = parseBatchTimeline(text)
      expect(events).toHaveLength(1)
      const ev = events[0]
      expect(ev.title).toBe('商鞅变法')
      expect(ev.category).toBe('politics')
      expect(ev.region).toBe('china')
      expect(ev.year).toBe(-356)
      expect(ev.era).toBe('战国')
      expect(ev.location).toBe('咸阳')
      expect(ev.tags).toEqual(['战国', '秦国'])
      expect(ev.background).toBe('战国初期秦国偏弱')
      expect(ev.figures).toEqual([{ name: '秦孝公', title: '秦国君主', desc: '任用商鞅' }])
      expect(ev.relations).toEqual([{ from: '秦孝公', to: '商鞅', type: '君臣', desc: '力挺变法' }])
      expect(ev.content).toContain('商鞅在秦孝公支持下推行变法')
    })

    it('应支持\"朝代\"作为 era 的别名', () => {
      const text = `标题：某事件
朝代：唐
内容`
      const events = parseBatchTimeline(text)
      expect(events[0].era).toBe('唐')
    })

    it('多事件应用 --- 分隔并分别解析', () => {
      const text = `标题：事件一
时代：汉
内容一
---
标题：事件二
朝代：宋
内容二`
      const events = parseBatchTimeline(text)
      expect(events).toHaveLength(2)
      expect(events[0].title).toBe('事件一')
      expect(events[0].era).toBe('汉')
      expect(events[1].title).toBe('事件二')
      expect(events[1].era).toBe('宋')
    })

    it('缺少内容时应跳过该事件', () => {
      const text = `标题：只有标题
朝代：唐`
      const events = parseBatchTimeline(text)
      expect(events).toHaveLength(0)
    })

    it('缺少标题时应跳过该事件', () => {
      const text = `朝代：唐
只有内容`
      const events = parseBatchTimeline(text)
      expect(events).toHaveLength(0)
    })
  })

  describe('parseFigures', () => {
    it('应解析人名|头衔|简介', () => {
      const text = '李世民|唐太宗|唐朝第二位皇帝\n魏征|宰相|以直言敢谏著称'
      expect(parseFigures(text)).toEqual([
        { name: '李世民', title: '唐太宗', desc: '唐朝第二位皇帝' },
        { name: '魏征', title: '宰相', desc: '以直言敢谏著称' },
      ])
    })

    it('空行应被忽略', () => {
      expect(parseFigures('\n  \n')).toEqual([])
    })
  })

  describe('parseRelations', () => {
    it('应解析甲|乙|关系|说明', () => {
      const text = '李世民|魏征|君臣|纳谏如流'
      expect(parseRelations(text)).toEqual([{ from: '李世民', to: '魏征', type: '君臣', desc: '纳谏如流' }])
    })

    it('缺少任一端时应被过滤', () => {
      expect(parseRelations('甲||关系')).toEqual([])
    })
  })

  describe('collectEras', () => {
    it('应按出现频次收集 era', () => {
      const events: LibraryTimelineEvent[] = [
        { title: 'a', content: 'c', era: '唐' },
        { title: 'b', content: 'c', era: '汉' },
        { title: 'd', content: 'c', era: '唐' },
      ]
      expect(collectEras(events)).toEqual(['唐', '汉'])
    })

    it('应按区域过滤', () => {
      const events: LibraryTimelineEvent[] = [
        { title: 'a', content: 'c', era: '唐', region: 'china' },
        { title: 'b', content: 'c', era: '文艺复兴', region: 'west' },
      ]
      expect(collectEras(events, 'west')).toEqual(['文艺复兴'])
    })
  })

  describe('collectReigns', () => {
    it('应从事件中收集 reign', () => {
      const events: LibraryTimelineEvent[] = [
        { title: 'a', content: 'c', era: '唐', reign: '贞观' },
        { title: 'b', content: 'c', era: '唐', reign: '开元' },
      ]
      expect(collectReigns(events, '唐')).toContain('贞观')
      expect(collectReigns(events, '唐')).toContain('开元')
    })

    it('应从 ERA_REIGN_MAP 补充预设年号', () => {
      const events: LibraryTimelineEvent[] = []
      expect(collectReigns(events, '唐')).toContain('贞观')
    })
  })

  describe('filterTimelineEvents', () => {
    const events: LibraryTimelineEvent[] = [
      { title: '贞观之治', content: '唐太宗', category: 'politics', region: 'china', year: 627, era: '唐', reign: '贞观' },
      { title: '文艺复兴', content: '达·芬奇', category: 'literature', region: 'west', year: 1500, era: '文艺复兴' },
    ]

    it('应按 era 过滤', () => {
      expect(filterTimelineEvents(events, { era: '唐' })).toHaveLength(1)
      expect(filterTimelineEvents(events, { era: '唐' })[0].title).toBe('贞观之治')
    })

    it('应按年份范围过滤', () => {
      expect(filterTimelineEvents(events, { yearFrom: 1400, yearTo: 1600 })).toHaveLength(1)
    })

    it('应按关键词过滤', () => {
      expect(filterTimelineEvents(events, { keyword: '达·芬奇' })).toHaveLength(1)
    })
  })
})
