/**
 * 地图视图「可导入库内容」图层的纯逻辑
 * 汇总内置题库（诗词/成语/时间线事件）中能解析出地理坐标的条目，
 * 按已导入文章标题去重，生成统一的可渲染/可导入结构。
 */
import type { GeoLocation, TextArticle } from '@/types/text-memory';
import type { PoetryItem } from '@/utils/poetry-service';
import type { IdiomItem } from '@/utils/idiom-service';
import {
  mapLibraryEventToArticle,
  parseTimelineLocation,
  type LibraryTimelineEvent,
} from '@/utils/timeline-service';
import { parseLocation } from '@/utils/poetry-location';

export type LibraryItemKind = 'poetry' | 'idiom' | 'timeline';

/** 传给 textMemoryStore.addArticle 的文章输入 */
export type LibraryArticleInput = Omit<TextArticle, '_id' | '_rev' | 'ctime' | 'utime' | 'reviewCount'>;

/** 地图上可导入的库条目 */
export interface LibraryMapItem {
  // 稳定标识（popup 点击与导入状态跟踪用）
  key: string;
  kind: LibraryItemKind;
  title: string;
  // 概要信息（朝代·作者 / 分类 / 年份·时代）
  subtitle: string;
  location?: string;
  geo: GeoLocation;
  article: LibraryArticleInput;
}

/** 格式化时间线年份（负数表示公元前） */
function formatYear(year?: number): string {
  if (year == null) return '';
  return year < 0 ? `前${Math.abs(year)}` : `${year}`;
}

/** 诗词条目 → 可导入项（字段映射与导入对话框「内置库-诗词库」一致） */
function poemToItem(poem: PoetryItem): LibraryMapItem | null {
  const coord = parseLocation(poem.location);
  if (!coord) return null;
  return {
    key: `poetry:${poem.id}`,
    kind: 'poetry',
    title: poem.title,
    subtitle: [poem.dynasty, poem.author].filter(Boolean).join(' · '),
    location: poem.location,
    geo: { lng: coord.lng, lat: coord.lat, name: coord.name },
    article: {
      title: poem.title,
      content: poem.content,
      author: poem.author,
      source: poem.source || poem.dynasty,
      dynasty: poem.dynasty,
      location: poem.location,
      category: 'poetry',
      tags: [...poem.tags],
    },
  };
}

/** 成语条目 → 可导入项（字段映射与导入对话框「内置库-成语库」一致） */
function idiomToItem(item: IdiomItem): LibraryMapItem | null {
  const coord = parseLocation(item.location);
  if (!coord) return null;
  return {
    key: `idiom:${item.id}`,
    kind: 'idiom',
    title: item.title,
    subtitle: item.category || '成语',
    location: item.location,
    geo: { lng: coord.lng, lat: coord.lat, name: coord.name },
    article: {
      title: item.title,
      content: [
        item.pinyin && `【拼音】${item.pinyin}`,
        `【释义】${item.meaning}`,
        item.source && `【出处】${item.source}`,
        item.story && `【典故】${item.story}`,
        item.example && `【例句】${item.example}`,
      ].filter(Boolean).join('\n'),
      author: '',
      source: item.source || '成语库',
      category: 'idiom',
      location: item.location,
      tags: ['成语', item.category, ...item.tags].filter(Boolean),
    },
  };
}

/** 时间线事件 → 可导入项（复用 timeline-service 的统一映射） */
function eventToItem(ev: LibraryTimelineEvent, index: number): LibraryMapItem | null {
  const coord = parseTimelineLocation(ev.location);
  if (!coord) return null;
  const yearText = formatYear(ev.year);
  return {
    key: `timeline:${ev.title}:${ev.year ?? index}`,
    kind: 'timeline',
    title: ev.title,
    subtitle: [yearText, ev.era].filter(Boolean).join(' · '),
    location: ev.location,
    geo: { lng: coord.lng, lat: coord.lat, name: coord.name },
    article: mapLibraryEventToArticle(ev),
  };
}

/**
 * 构建可导入库条目列表：
 * - 只保留 location 能解析出坐标的条目
 * - 按已导入文章标题（trim 后）去重，已导入的不再返回
 */
export function buildLibraryMapItems(
  poems: PoetryItem[],
  idioms: IdiomItem[],
  events: LibraryTimelineEvent[],
  importedTitles: Set<string>
): LibraryMapItem[] {
  const isImported = (title: string) => importedTitles.has(title.trim());
  const items: LibraryMapItem[] = [];

  for (const poem of poems) {
    if (isImported(poem.title)) continue;
    const item = poemToItem(poem);
    if (item) items.push(item);
  }
  for (const idiom of idioms) {
    if (isImported(idiom.title)) continue;
    const item = idiomToItem(idiom);
    if (item) items.push(item);
  }
  events.forEach((ev, index) => {
    if (isImported(ev.title)) return;
    const item = eventToItem(ev, index);
    if (item) items.push(item);
  });

  return items;
}
