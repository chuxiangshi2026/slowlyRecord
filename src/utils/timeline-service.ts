/**
 * 历史时间线本地库服务
 * 仿 poetry-service.ts 模式：从 public/datafile/timeline/index.json 加载本地事件库，
 * 提供筛选、映射到 TextArticle 等能力。具体事件内容后期在 index.json 中补充。
 */
import type {
  TimelineCategory,
  TimelineRegion,
  TimelineFigure,
  TimelineRelation,
} from '@/types/text-memory';
import { parseLocation, type LocationCoord } from './poetry-location';

/** 本地库单条事件（与 index.json 一致） */
export interface LibraryTimelineEvent {
  title: string;
  content: string;
  category?: TimelineCategory;
  region?: TimelineRegion;
  year?: number;
  reign?: string;
  era?: string;
  location?: string;
  figures?: TimelineFigure[];
  relations?: TimelineRelation[];
  background?: string;
  tags?: string[];
}

/** index.json 文档结构 */
interface TimelineLibraryDoc {
  version: number;
  updatedAt: number;
  description?: string;
  events: LibraryTimelineEvent[];
}

// ==================== 分类/区域常量 ====================

export interface TimelineCategoryMeta {
  code: TimelineCategory;
  label: string;
  color: string;
}

/** 时间线事件分类元信息（label + 主题色，供视图上色） */
export const TIMELINE_CATEGORIES: TimelineCategoryMeta[] = [
  { code: 'politics', label: '政治', color: '#f56c6c' },
  { code: 'literature', label: '文学', color: '#409eff' },
  { code: 'science', label: '科学', color: '#67c23a' },
  { code: 'thought', label: '思想', color: '#9b59b6' },
  { code: 'society', label: '社会', color: '#e6a23c' },
];

export interface TimelineRegionMeta {
  code: TimelineRegion;
  label: string;
}

export const TIMELINE_REGIONS: TimelineRegionMeta[] = [
  { code: 'china', label: '中国' },
  { code: 'west', label: '西方' },
];

export function getTimelineCategoryMeta(code?: TimelineCategory): TimelineCategoryMeta | undefined {
  return TIMELINE_CATEGORIES.find(c => c.code === code);
}

export function getTimelineRegionMeta(code?: TimelineRegion): TimelineRegionMeta | undefined {
  return TIMELINE_REGIONS.find(r => r.code === code);
}

// ==================== 加载与缓存 ====================

const TIMELINE_BASE_PATH = import.meta.env.BASE_URL + 'datafile/timeline/';

/**
 * 历史地名坐标扩展表（中外，补充 poetry-location 未覆盖的近代/西方地名）
 * 先查此表，再 fallback 到 parseLocation（诗词古地名库）。
 */
const TIMELINE_LOCATION_COORDS: Record<string, LocationCoord> = {
  // 西方
  '伦敦': { lng: -0.13, lat: 51.51, name: '伦敦' },
  '巴黎': { lng: 2.35, lat: 48.86, name: '巴黎' },
  '罗马': { lng: 12.50, lat: 41.90, name: '罗马' },
  '柏林': { lng: 13.40, lat: 52.52, name: '柏林' },
  '华盛顿': { lng: -77.04, lat: 38.90, name: '华盛顿' },
  '纽约': { lng: -74.01, lat: 40.71, name: '纽约' },
  '莫斯科': { lng: 37.62, lat: 55.75, name: '莫斯科' },
  '东京': { lng: 139.69, lat: 35.69, name: '东京' },
  '雅典': { lng: 23.73, lat: 37.98, name: '雅典' },
  '维也纳': { lng: 16.37, lat: 48.21, name: '维也纳' },
  '佛罗伦萨': { lng: 11.26, lat: 43.77, name: '佛罗伦萨' },
  // 中国近代/补充
  '北京': { lng: 116.40, lat: 39.90, name: '北京', aliases: ['北平', '顺天', '燕京'] },
  '南京': { lng: 118.80, lat: 32.06, name: '南京', aliases: ['金陵', '建康', '江宁'] },
  '广州': { lng: 113.26, lat: 23.13, name: '广州', aliases: ['羊城', '穗'] },
  '武汉': { lng: 114.31, lat: 30.59, name: '武汉' },
  '长沙': { lng: 112.94, lat: 28.23, name: '长沙' },
  '曲阜': { lng: 116.98, lat: 35.58, name: '曲阜' },
  '南昌': { lng: 115.86, lat: 28.68, name: '南昌' },
  '遵义': { lng: 106.93, lat: 27.73, name: '遵义' },
  '沈阳': { lng: 123.43, lat: 41.81, name: '沈阳' },
  '威海': { lng: 122.12, lat: 37.51, name: '威海' },
  '延安': { lng: 109.49, lat: 36.59, name: '延安' },
  '重庆': { lng: 106.55, lat: 29.56, name: '重庆' },
  '香港': { lng: 114.17, lat: 22.28, name: '香港' },
  '上海': { lng: 121.47, lat: 31.23, name: '上海' },
  '西安': { lng: 108.94, lat: 34.26, name: '西安', aliases: ['长安'] },
  '华沙': { lng: 21.01, lat: 52.23, name: '华沙' },
  '费城': { lng: -75.16, lat: 39.95, name: '费城' },
  '萨拉热窝': { lng: 18.41, lat: 43.85, name: '萨拉热窝' },
};

/**
 * 解析时间线事件地点为坐标：先查历史地名扩展表，再 fallback 到诗词地名库
 */
export function parseTimelineLocation(locationText?: string): LocationCoord | null {
  if (!locationText) return null;
  const text = locationText.trim();
  // 取第一个 "/" 或 "," 前的主地名
  const main = text.split(/[/,，、]/)[0].trim();
  if (TIMELINE_LOCATION_COORDS[main]) return TIMELINE_LOCATION_COORDS[main];
  // 别名匹配
  for (const key in TIMELINE_LOCATION_COORDS) {
    const c = TIMELINE_LOCATION_COORDS[key];
    if (c.aliases?.includes(main)) return c;
  }
  // fallback 诗词地名库
  return parseLocation(text);
}

let cachedEvents: LibraryTimelineEvent[] | null = null;

/**
 * 加载全部本地时间线事件（带内存缓存）
 */
export async function fetchAllTimelineEvents(): Promise<LibraryTimelineEvent[]> {
  if (cachedEvents) return cachedEvents;

  try {
    const response = await fetch(`${TIMELINE_BASE_PATH}index.json`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const doc = (await response.json()) as TimelineLibraryDoc;
    cachedEvents = Array.isArray(doc?.events) ? doc.events : [];
    return cachedEvents;
  } catch (error) {
    console.error('[Timeline] 加载本地时间线库失败:', error);
    cachedEvents = [];
    return [];
  }
}

/** 清除内存缓存 */
export function clearTimelineCache(): void {
  cachedEvents = null;
}

// ==================== 筛选 ====================

export interface TimelineFilterOptions {
  category?: TimelineCategory | '';
  region?: TimelineRegion | '';
  era?: string;
  reign?: string;
  yearFrom?: number | string;
  yearTo?: number | string;
  keyword?: string;
}

/**
 * 按分类/区域/时代/年号/年份范围/关键词筛选
 */
export function filterTimelineEvents(
  events: LibraryTimelineEvent[],
  options: TimelineFilterOptions = {}
): LibraryTimelineEvent[] {
  const { category, region, era, reign, yearFrom, yearTo, keyword } = options;
  const kw = keyword?.trim().toLowerCase();
  const from = typeof yearFrom === 'number' ? yearFrom : (yearFrom ? Number(yearFrom) : NaN);
  const to = typeof yearTo === 'number' ? yearTo : (yearTo ? Number(yearTo) : NaN);

  return events.filter(ev => {
    if (category && ev.category !== category) return false;
    if (region && ev.region !== region) return false;
    if (era && ev.era !== era) return false;
    // 年号/时期匹配：reign 完全匹配，或 era 匹配（"维多利亚时期"→"维多利亚时代"）
    if (reign) {
      const reignAlt = reign.replace(/时期$/, '时代');
      if (ev.reign !== reign && ev.era !== reign && ev.era !== reignAlt) return false;
    }
    if (!isNaN(from) && ev.year != null && ev.year < from) return false;
    if (!isNaN(to) && ev.year != null && ev.year > to) return false;
    if (kw) {
      const hay = [
        ev.title,
        ev.content,
        ev.era,
        ev.reign,
        ev.location,
        ...(ev.figures?.map(f => f.name) || []),
        ...(ev.tags || []),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!hay.includes(kw)) return false;
    }
    return true;
  });
}

/**
 * 收集库中出现的所有朝代/时代（按出现频次降序）
 * @param events 数据源
 * @param region 可选，按区域过滤（中国/西方）
 */
export function collectEras(events: LibraryTimelineEvent[], region?: TimelineRegion | ''): string[] {
  const count = new Map<string, number>();
  events
    .filter(ev => !region || ev.region === region)
    .forEach(ev => {
      if (ev.era) count.set(ev.era, (count.get(ev.era) || 0) + 1);
    });
  return Array.from(count.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([era]) => era);
}

/**
 * 朝代/时代 → 年号/时期 预设映射（中国朝代用年号，西方时代用时期）
 */
export const ERA_REIGN_MAP: Record<string, string[]> = {
  // 中国朝代
  '西汉': ['建元', '元光', '元朔', '元狩', '元鼎', '元封', '太初', '征和', '始元', '元平', '本始', '地节', '元康', '神爵', '五凤', '甘露', '黄龙', '初元', '永光', '建昭', '竟宁'],
  '东汉': ['建武', '中元', '永平', '建初', '元和', '章和', '永元', '元兴', '延平', '永初', '元初', '永宁', '建光', '延光', '永建', '阳嘉', '永和', '汉安', '建康', '永憙', '本初', '建和', '和平', '元嘉', '永兴', '永寿', '延熹', '永康', '建宁', '熹平', '光和', '中平', '光熹', '昭宁', '永汉', '初平', '兴平', '建安', '延康'],
  '唐': ['武德', '贞观', '永徽', '显庆', '龙朔', '麟德', '乾封', '总章', '咸亨', '上元', '仪凤', '调露', '永隆', '开耀', '永淳', '弘道', '嗣圣', '神龙', '景龙', '唐隆', '景云', '太极', '先天', '开元', '天宝', '至德', '乾元', '宝应', '广德', '永泰', '大历', '建中', '兴元', '贞元', '永贞', '元和', '长庆', '宝历', '大和', '开成', '会昌', '大中', '咸通', '乾符', '广明', '中和', '光启', '文德', '龙纪', '大顺', '景福', '乾宁', '光化', '天复', '天祐'],
  '北宋': ['建隆', '乾德', '开宝', '太平兴国', '雍熙', '端拱', '淳化', '至道', '咸平', '景德', '大中祥符', '天禧', '乾兴', '天圣', '明道', '景祐', '宝元', '康定', '庆历', '皇祐', '至和', '嘉祐', '治平', '熙宁', '元丰', '元祐', '绍圣', '元符', '建中靖国', '崇宁', '大观', '政和', '重和', '宣和'],
  '南宋': ['建炎', '绍兴', '隆兴', '乾道', '淳熙', '绍熙', '庆元', '嘉泰', '开禧', '嘉定', '宝庆', '绍定', '端平', '嘉熙', '淳祐', '宝祐', '开庆', '景定', '咸淳', '德祐', '景炎', '祥兴'],
  '明': ['洪武', '建文', '永乐', '洪熙', '宣德', '正统', '景泰', '天顺', '成化', '弘治', '正德', '嘉靖', '隆庆', '万历', '泰昌', '天启', '崇祯'],
  '清': ['天命', '天聪', '崇德', '顺治', '康熙', '雍正', '乾隆', '嘉庆', '道光', '咸丰', '同治', '光绪', '宣统'],
  '近代': ['北洋时期', '南京十年', '抗战时期', '解放战争时期'],
  '现代': ['建国初期', '改革开放时期', '邓小平时期', '江泽民时期', '胡锦涛时期', '习近平时期'],
  // 西方时代
  '文艺复兴': ['文艺复兴盛期', '文艺复兴晚期'],
  '启蒙运动': ['启蒙运动时期'],
  '工业革命': ['工业革命时期'],
};

/**
 * 收集年号/时期列表
 * @param events 数据源（用于补充数据中实际出现的 reign）
 * @param era 可选，按朝代/时代过滤（级联：选中朝代后只显示该朝代年号）
 */
export function collectReigns(events: LibraryTimelineEvent[], era?: string): string[] {
  const set = new Set<string>();
  // 从数据中收集
  events
    .filter(ev => !era || ev.era === era)
    .forEach(ev => {
      if (ev.reign) set.add(ev.reign);
    });
  // 从预设映射补充
  if (era && ERA_REIGN_MAP[era]) {
    ERA_REIGN_MAP[era].forEach(r => set.add(r));
  }
  // 未指定朝代时，给出全部预设年号
  if (!era) {
    Object.values(ERA_REIGN_MAP).forEach(list => list.forEach(r => set.add(r)));
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, 'zh'));
}

// ==================== 映射到 TextArticle ====================

/**
 * 将本地库事件映射为 TextArticle 的输入（透传给 store.addArticle）
 * 返回 Omit<TextArticle, '_id' | '_rev' | 'ctime' | 'utime' | 'reviewCount'>
 */
const VALID_TIMELINE_CATEGORIES = new Set<TimelineCategory>(['politics', 'literature', 'science', 'thought', 'society']);

export function mapLibraryEventToArticle(ev: LibraryTimelineEvent) {
  const category = VALID_TIMELINE_CATEGORIES.has(ev.category as TimelineCategory)
    ? ev.category
    : 'politics';
  return {
    title: ev.title,
    content: ev.content,
    category,
    region: ev.region,
    year: ev.year,
    reign: ev.reign,
    era: ev.era,
    dynasty: ev.era,
    location: ev.location,
    figures: ev.figures,
    relations: ev.relations,
    background: ev.background,
    tags: ev.tags ?? [],
    source: ev.era ? `时间线·${ev.era}` : '时间线',
  };
}

// ==================== 文本解析工具 ====================

/**
 * 解析"人名|头衔|简介"文本为 TimelineFigure 数组（多行，每行一条）
 */
export function parseFigures(text: string): TimelineFigure[] {
  return text.split('\n').map(l => l.trim()).filter(Boolean).map(line => {
    const [name, title, ...rest] = line.split('|').map(s => s?.trim());
    return { name: name || '', title: title || undefined, desc: rest.join('|') || undefined };
  }).filter(f => f.name);
}

/**
 * 解析"甲|乙|关系|说明"文本为 TimelineRelation 数组（多行，每行一条）
 */
export function parseRelations(text: string): TimelineRelation[] {
  return text.split('\n').map(l => l.trim()).filter(Boolean).map(line => {
    const [from, to, type, ...rest] = line.split('|').map(s => s?.trim());
    return { from: from || '', to: to || '', type: type || '', desc: rest.join('|') || undefined };
  }).filter(r => r.from && r.to);
}

/**
 * 解析批量时间线事件文本（--- 分隔，每段含元数据 + 正文）
 * 支持元数据键：标题、分类、区域、年份、年号、时代/朝代、地点、标签、背景、人物、关系
 */
export function parseBatchTimeline(content: string): LibraryTimelineEvent[] {
  const sections = content.split(/---+/).map(s => s.trim()).filter(Boolean);
  const events: LibraryTimelineEvent[] = [];
  const metaRe = (key: string) => new RegExp(`^${key}[：:]\\s*`);
  for (const section of sections) {
    const lines = section.split('\n');
    const ev: any = { tags: [] };
    const contentLines: string[] = [];
    const figuresBuf: string[] = [];
    const relationsBuf: string[] = [];
    let inContent = false;
    for (const line of lines) {
      const t = line.trim();
      if (!inContent && !t) continue;
      if (!inContent && metaRe('标题').test(t)) ev.title = t.replace(metaRe('标题'), '');
      else if (!inContent && metaRe('分类').test(t)) ev.category = t.replace(metaRe('分类'), '');
      else if (!inContent && metaRe('区域').test(t)) ev.region = t.replace(metaRe('区域'), '');
      else if (!inContent && metaRe('年份').test(t)) {
        const y = t.replace(metaRe('年份'), '');
        ev.year = y ? Number(y) : undefined;
      }
      else if (!inContent && metaRe('年号').test(t)) ev.reign = t.replace(metaRe('年号'), '');
      else if (!inContent && (metaRe('时代').test(t) || metaRe('朝代').test(t))) {
        const keyRe = metaRe('时代').test(t) ? metaRe('时代') : metaRe('朝代');
        ev.era = t.replace(keyRe, '');
      }
      else if (!inContent && metaRe('地点').test(t)) ev.location = t.replace(metaRe('地点'), '');
      else if (!inContent && metaRe('标签').test(t)) ev.tags = t.replace(metaRe('标签'), '').split(/[,，]/).map((s: string) => s.trim()).filter(Boolean);
      else if (!inContent && metaRe('背景').test(t)) ev.background = t.replace(metaRe('背景'), '');
      else if (!inContent && metaRe('人物').test(t)) figuresBuf.push(t.replace(metaRe('人物'), ''));
      else if (!inContent && metaRe('关系').test(t)) relationsBuf.push(t.replace(metaRe('关系'), ''));
      else { inContent = true; contentLines.push(line); }
    }
    ev.content = contentLines.join('\n').trim();
    ev.figures = parseFigures(figuresBuf.join('\n'));
    ev.relations = parseRelations(relationsBuf.join('\n'));
    if (ev.title && ev.content) events.push(ev);
  }
  return events;
}
