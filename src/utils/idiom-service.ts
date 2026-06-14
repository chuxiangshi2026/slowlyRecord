/**
 * 成语库服务
 * 管理常用成语的加载、缓存和查询
 */

// 成语数据结构
export interface IdiomItem {
  id: string;
  title: string;        // 成语本身
  pinyin?: string;
  meaning: string;      // 释义
  source?: string;      // 出处
  story?: string;       // 典故
  example?: string;     // 例句
  location?: string;    // 典故发生地（用于地图定位）
  category: string;     // 分类
  tags: string[];
}

// 分类信息
export interface IdiomCategory {
  code: string;
  name: string;
}

// 内置分类列表（与数据文件中的 category 字段保持一致）
export const IDIOM_CATEGORIES: IdiomCategory[] = [
  { code: '寓言故事', name: '寓言故事' },
  { code: '历史典故', name: '历史典故' },
  { code: '励志', name: '励志' },
  { code: '劝学', name: '劝学' },
  { code: '品德', name: '品德' },
  { code: '智慧', name: '智慧' },
  { code: '自然', name: '自然' },
  { code: '人物', name: '人物' },
];

// 缓存配置
const CACHE_KEY = 'idiom_cache_v2_all';
const CACHE_EXPIRY = 30 * 24 * 60 * 60 * 1000; // 30 天

// 数据文件路径
const IDIOM_DATA_URL = import.meta.env.BASE_URL + 'datafile/idioms/idioms.json';

// ==================== 缓存管理 ====================

function getFromCache(): IdiomItem[] | null {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;

    const data = JSON.parse(cached);
    if (Date.now() - data.timestamp > CACHE_EXPIRY) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }
    return data.value;
  } catch (error) {
    console.warn('[Idiom] 读取缓存失败', error);
    return null;
  }
}

function saveToCache(value: IdiomItem[]): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      timestamp: Date.now(),
      value,
    }));
  } catch (e) {
    console.warn('[Idiom] 缓存失败:', e);
  }
}

export function clearIdiomCache(): void {
  localStorage.removeItem(CACHE_KEY);
}

// ==================== 数据加载 ====================

/**
 * 加载所有成语数据（带缓存）
 */
export async function fetchAllIdioms(useCache = true): Promise<IdiomItem[]> {
  if (useCache) {
    const cached = getFromCache();
    if (cached) {
      console.log(`[Idiom] 使用缓存，数量: ${cached.length}`);
      return cached;
    }
  }

  try {
    console.log(`[Idiom] 加载: ${IDIOM_DATA_URL}`);
    const response = await fetch(IDIOM_DATA_URL, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    const idioms = normalizeIdiomData(data.idioms || data);

    if (useCache && idioms.length > 0) {
      saveToCache(idioms);
    }

    console.log(`[Idiom] 加载成功，数量: ${idioms.length}`);
    return idioms;
  } catch (error) {
    console.warn('[Idiom] 加载失败，使用内置兜底数据', error);
    return getBuiltinIdioms();
  }
}

function normalizeIdiomData(data: any[]): IdiomItem[] {
  if (!Array.isArray(data)) {
    console.warn('[Idiom] 数据格式错误，期望数组');
    return [];
  }

  return data.map((item, index) => ({
    id: item.id || `idiom_${Date.now()}_${index}`,
    title: item.title || '未知',
    pinyin: item.pinyin,
    meaning: item.meaning || '',
    source: item.source,
    story: item.story,
    example: item.example,
    location: item.location,
    category: item.category || '其他',
    tags: Array.isArray(item.tags) ? item.tags : [],
  })).filter(it => it.title && it.meaning);
}

// ==================== 搜索查询 ====================

/**
 * 搜索成语
 */
export async function searchIdioms(
  keyword: string,
  options: { category?: string } = {}
): Promise<IdiomItem[]> {
  const all = await fetchAllIdioms();
  return filterIdioms(all, keyword, options);
}

/**
 * 过滤成语
 */
export function filterIdioms(
  idioms: IdiomItem[],
  keyword: string,
  options: { category?: string } = {}
): IdiomItem[] {
  const { category } = options;
  const kw = keyword?.trim().toLowerCase();

  return idioms.filter(item => {
    if (category && item.category !== category) return false;

    if (kw) {
      const matched =
        item.title.toLowerCase().includes(kw) ||
        item.meaning.toLowerCase().includes(kw) ||
        (item.pinyin || '').toLowerCase().includes(kw) ||
        (item.source || '').toLowerCase().includes(kw) ||
        (item.story || '').toLowerCase().includes(kw) ||
        (item.example || '').toLowerCase().includes(kw) ||
        item.tags.some(t => t.toLowerCase().includes(kw));
      if (!matched) return false;
    }

    return true;
  });
}

// ==================== 兜底数据 ====================

/**
 * 加载失败时使用的兜底数据
 */
function getBuiltinIdioms(): IdiomItem[] {
  return [
    {
      id: 'fallback_001',
      title: '守株待兔',
      pinyin: 'shǒu zhū dài tù',
      meaning: '比喻死守狭隘经验，不知变通；也比喻妄想不劳而获。',
      source: '《韩非子·五蠹》',
      example: '成功不是守株待兔，而是积极进取。',
      category: '寓言故事',
      tags: ['寓言', '讽刺', '经典'],
    },
    {
      id: 'fallback_002',
      title: '愚公移山',
      pinyin: 'yú gōng yí shān',
      meaning: '比喻坚持不懈地改造自然和坚定不移地进行斗争。',
      source: '《列子·汤问》',
      example: '我们要发扬愚公移山的精神。',
      category: '励志',
      tags: ['坚持', '经典'],
    },
  ];
}

// 默认导出
export default {
  fetchAllIdioms,
  searchIdioms,
  filterIdioms,
  clearIdiomCache,
  IDIOM_CATEGORIES,
};
