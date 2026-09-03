/**
 * library-map 纯逻辑测试：库条目坐标过滤、按已导入标题去重、字段映射
 */
import { describe, it, expect } from 'vitest';
import { buildLibraryMapItems } from './library-map';
import type { PoetryItem } from '@/utils/poetry-service';
import type { IdiomItem } from '@/utils/idiom-service';
import type { LibraryTimelineEvent } from '@/utils/timeline-service';

function makePoem(overrides: Partial<PoetryItem> = {}): PoetryItem {
  return {
    id: 'tang_001',
    title: '静夜思',
    author: '李白',
    dynasty: '唐',
    dynastyCode: 'tang',
    content: '床前明月光，疑是地上霜。',
    contentType: 'poetry',
    tags: ['必背'],
    location: '扬州',
    wordCount: 20,
    ...overrides,
  };
}

function makeIdiom(overrides: Partial<IdiomItem> = {}): IdiomItem {
  return {
    id: 'idiom_001',
    title: '邯郸学步',
    meaning: '比喻模仿别人不成，反而丧失了原有的技能。',
    source: '《庄子·秋水》',
    location: '邯郸',
    category: '寓言故事',
    tags: [],
    ...overrides,
  };
}

function makeEvent(overrides: Partial<LibraryTimelineEvent> = {}): LibraryTimelineEvent {
  return {
    title: '秦统一六国',
    content: '公元前221年，秦灭齐，统一六国。',
    category: 'politics',
    region: 'china',
    year: -221,
    era: '秦',
    location: '咸阳',
    tags: [],
    ...overrides,
  };
}

describe('buildLibraryMapItems', () => {
  it('只保留 location 能解析出坐标的条目', () => {
    const items = buildLibraryMapItems(
      [makePoem(), makePoem({ id: 'x_002', title: '无地点诗', location: undefined })],
      [makeIdiom(), makeIdiom({ id: 'i_002', title: '无地点成语', location: undefined })],
      [makeEvent(), makeEvent({ title: '无地点事件', location: undefined })],
      new Set()
    );
    expect(items.map(i => i.key)).toEqual(['poetry:tang_001', 'idiom:idiom_001', 'timeline:秦统一六国:-221']);
    // 坐标来自地点库
    expect(items[0].geo.name).toBe('扬州');
  });

  it('按已导入文章标题去重（集合内为 trim 后的标题）', () => {
    const items = buildLibraryMapItems(
      [makePoem()],
      [makeIdiom()],
      [makeEvent()],
      new Set(['静夜思', '秦统一六国'])
    );
    expect(items.map(i => i.title)).toEqual(['邯郸学步']);
  });

  it('字段映射正确：诗词/成语/时间线', () => {
    const items = buildLibraryMapItems([makePoem()], [makeIdiom()], [makeEvent()], new Set());
    const [poem, idiom, event] = items;

    // 诗词：category=poetry，保留作者/朝代/来源/地点
    expect(poem.article).toMatchObject({
      title: '静夜思',
      author: '李白',
      dynasty: '唐',
      category: 'poetry',
      location: '扬州',
      tags: ['必背'],
    });

    // 成语：category=idiom，内容含释义/出处，带「成语」标签
    expect(idiom.article.category).toBe('idiom');
    expect(idiom.article.content).toContain('【释义】');
    expect(idiom.article.content).toContain('【出处】');
    expect(idiom.article.tags).toContain('成语');

    // 时间线：复用 mapLibraryEventToArticle，保留年份/时代/区域
    expect(event.article).toMatchObject({
      title: '秦统一六国',
      category: 'politics',
      year: -221,
      era: '秦',
      region: 'china',
    });
    // 事件概要展示年份（公元前加「前」）
    expect(event.subtitle).toContain('前221');
  });
});
