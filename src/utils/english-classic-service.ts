/**
 * 英文经典库服务
 * 管理英文经典（演讲/诗歌/散文/电影片段）的加载、缓存和查询
 */

// 英文经典条目结构
export interface EnglishClassicItem {
  id: string;
  title: string;
  author: string;
  content: string;
  tags: string[];
  source?: string;
  year?: string | number;
  language: 'en';
  category: string;   // 类别 code，与 ENGLISH_CATEGORIES 一致
  wordCount: number;
}

// 分类信息
export interface EnglishClassicCategory {
  code: string;
  name: string;
  file: string;
  description: string;
}

// 分类列表（与 public/datafile/english/ 下的文件一一对应）
export const ENGLISH_CATEGORIES: EnglishClassicCategory[] = [
  { code: 'speeches', name: '经典演讲', file: 'speeches.json', description: '影响世界的英文演讲名篇' },
  { code: 'poems', name: '经典诗歌', file: 'poems.json', description: '英美诗歌名篇' },
  { code: 'essays', name: '散文名篇', file: 'essays.json', description: '论学、人生、自然与青春' },
  { code: 'movies', name: '电影片段', file: 'movie-scripts.json', description: '经典电影独白与名段' },
];

// 缓存配置
const CACHE_KEY_PREFIX = 'english_classic_cache_v1_';
const CACHE_EXPIRY = 30 * 24 * 60 * 60 * 1000; // 30 天

// 数据文件路径
const ENGLISH_BASE_PATH = import.meta.env.BASE_URL + 'datafile/english/';

// ==================== 缓存管理 ====================

function getFromCache<T>(key: string): T | null {
  try {
    const cacheKey = CACHE_KEY_PREFIX + key;
    const cached = localStorage.getItem(cacheKey);
    if (!cached) return null;

    const data = JSON.parse(cached);
    if (Date.now() - data.timestamp > CACHE_EXPIRY) {
      localStorage.removeItem(cacheKey);
      return null;
    }
    return data.value;
  } catch (error) {
    console.warn(`[EnglishClassic] 读取缓存失败: ${key}`, error);
    return null;
  }
}

function saveToCache<T>(key: string, value: T): void {
  try {
    localStorage.setItem(CACHE_KEY_PREFIX + key, JSON.stringify({
      timestamp: Date.now(),
      value,
    }));
  } catch (e) {
    console.warn('[EnglishClassic] 缓存失败:', e);
  }
}

/**
 * 清除英文经典缓存（不传 category 则清除全部）
 */
export function clearEnglishCache(category?: string): void {
  if (category) {
    localStorage.removeItem(CACHE_KEY_PREFIX + category);
    return;
  }
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(CACHE_KEY_PREFIX)) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach(key => localStorage.removeItem(key));
}

// ==================== 数据加载 ====================

/**
 * 按分类加载英文经典条目（带缓存）
 */
export async function fetchEnglishClassics(
  category: string,
  useCache = true
): Promise<EnglishClassicItem[]> {
  const cat = ENGLISH_CATEGORIES.find(c => c.code === category);
  if (!cat) {
    console.warn(`[EnglishClassic] 未知分类: ${category}`);
    return [];
  }

  if (useCache) {
    const cached = getFromCache<EnglishClassicItem[]>(category);
    if (cached) {
      console.log(`[EnglishClassic] 使用缓存: ${category}, 数量: ${cached.length}`);
      return cached;
    }
  }

  try {
    const url = `${ENGLISH_BASE_PATH}${cat.file}`;
    console.log(`[EnglishClassic] 加载: ${url}`);

    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    const items = normalizeEnglishData(data.items || data, category);

    if (useCache && items.length > 0) {
      saveToCache(category, items);
    }

    console.log(`[EnglishClassic] 加载成功: ${category}, 数量: ${items.length}`);
    return items;
  } catch (error) {
    console.warn(`[EnglishClassic] 加载失败: ${category}`, error);
    return [];
  }
}

/**
 * 加载所有分类
 */
export async function fetchAllEnglishClassics(): Promise<Record<string, EnglishClassicItem[]>> {
  const result: Record<string, EnglishClassicItem[]> = {};
  await Promise.all(ENGLISH_CATEGORIES.map(async (cat) => {
    result[cat.code] = await fetchEnglishClassics(cat.code);
  }));
  return result;
}

function normalizeEnglishData(data: any[], category: string): EnglishClassicItem[] {
  if (!Array.isArray(data)) {
    console.warn('[EnglishClassic] 数据格式错误，期望数组');
    return [];
  }

  return data.map((item, index) => ({
    id: item.id || `english_${category}_${Date.now()}_${index}`,
    title: item.title || 'Untitled',
    author: item.author || 'Anonymous',
    content: item.content || '',
    tags: Array.isArray(item.tags) ? item.tags : [],
    source: item.source,
    year: item.year,
    language: 'en' as const,
    category,
    wordCount: item.content ? item.content.split(/\s+/).filter(Boolean).length : 0,
  })).filter(it => it.content && it.title);
}

// ==================== 搜索查询 ====================

/**
 * 搜索英文经典条目
 */
export async function searchEnglishClassics(
  keyword: string,
  options: { category?: string } = {}
): Promise<EnglishClassicItem[]> {
  const { category } = options;

  let items: EnglishClassicItem[];
  if (category) {
    items = await fetchEnglishClassics(category);
  } else {
    const all = await fetchAllEnglishClassics();
    items = Object.values(all).flat();
  }

  return filterEnglishClassics(items, keyword);
}

/**
 * 过滤英文经典条目（本地过滤）
 */
export function filterEnglishClassics(
  items: EnglishClassicItem[],
  keyword: string
): EnglishClassicItem[] {
  const kw = keyword?.trim().toLowerCase();
  if (!kw) return items;

  return items.filter(it =>
    it.title.toLowerCase().includes(kw) ||
    it.author.toLowerCase().includes(kw) ||
    it.content.toLowerCase().includes(kw) ||
    it.tags.some(t => t.toLowerCase().includes(kw)) ||
    (it.source || '').toLowerCase().includes(kw)
  );
}

// 默认导出
export default {
  ENGLISH_CATEGORIES,
  fetchEnglishClassics,
  fetchAllEnglishClassics,
  searchEnglishClassics,
  filterEnglishClassics,
  clearEnglishCache,
};
