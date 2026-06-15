/**
 * 诗词文章库服务
 * 管理中华经典诗词和文章的加载、缓存和查询
 */

import { ElMessage } from 'element-plus';

// 朝代类型定义
export type PoetryDynasty =
  | 'xianqin'   // 先秦
  | 'han'       // 两汉
  | 'weijin'    // 魏晋南北朝
  | 'sui'       // 隋
  | 'tang'      // 唐
  | 'song'      // 宋
  | 'yuan'      // 元
  | 'ming'      // 明
  | 'qing'      // 清
  | 'xiandai';  // 近现代

// 内容类型
export type ContentType = 'poetry' | 'article' | 'prose' | 'fu' | 'ci';

// 诗词文章数据结构
export interface PoetryItem {
  id: string;
  title: string;
  author: string;
  dynasty: string;
  dynastyCode: PoetryDynasty;
  content: string;
  contentType: ContentType;
  tags: string[];
  source?: string;
  location?: string;        // 创作地点（城市/景点/村名等）
  wordCount: number;
  isClassic?: boolean;      // 是否经典必背
  difficulty?: 'easy' | 'medium' | 'hard';  // 难度等级
  annotation?: string;      // 注释
  translation?: string;     // 译文
  appreciation?: string;    // 赏析
  year?: string | number;   // 创作时间（如 742、"天宝元年"、"公元742年"）
}

// 朝代信息
export interface DynastyInfo {
  code: PoetryDynasty;
  name: string;
  period: string;
  description: string;
  count: number;
  icon?: string;
}

// 加载策略
export interface LoadStrategy {
  priority: 'local' | 'online';
  useCache: boolean;
  timeout: number;
}

// 默认加载策略
export const DEFAULT_STRATEGY: LoadStrategy = {
  priority: 'local',
  useCache: true,
  timeout: 5000,
};

// 朝代列表
export const DYNASTY_LIST: DynastyInfo[] = [
  { code: 'xianqin', name: '先秦', period: '前1046-前221', description: '诗经、楚辞、诸子百家', count: 0 },
  { code: 'han', name: '两汉', period: '前206-220', description: '汉赋、汉乐府、古诗十九首', count: 0 },
  { code: 'weijin', name: '魏晋南北朝', period: '220-589', description: '建安文学、陶渊明、南北朝民歌', count: 0 },
  { code: 'sui', name: '隋', period: '581-618', description: '隋代诗歌', count: 0 },
  { code: 'tang', name: '唐', period: '618-907', description: '唐诗鼎盛时期', count: 0 },
  { code: 'song', name: '宋', period: '960-1279', description: '宋词、宋诗', count: 0 },
  { code: 'yuan', name: '元', period: '1271-1368', description: '元曲、元杂剧', count: 0 },
  { code: 'ming', name: '明', period: '1368-1644', description: '明代诗词', count: 0 },
  { code: 'qing', name: '清', period: '1644-1912', description: '清代诗词', count: 0 },
  { code: 'xiandai', name: '近现代', period: '1912-至今', description: '现代诗歌、新诗', count: 0 },
];

// 缓存配置
const CACHE_KEY_PREFIX = 'poetry_cache_v2_';
const CACHE_EXPIRY = 30 * 24 * 60 * 60 * 1000; // 30天过期
const POETRY_INDEX_KEY = 'poetry_index_cache';

// 文件路径
const POETRY_BASE_PATH = import.meta.env.BASE_URL + 'datafile/poetry/';

// ==================== 缓存管理 ====================

/**
 * 从缓存获取数据
 */
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
    console.warn(`[Poetry] 读取缓存失败: ${key}`, error);
    return null;
  }
}

/**
 * 保存到缓存
 */
function saveToCache<T>(key: string, value: T): void {
  try {
    const cacheKey = CACHE_KEY_PREFIX + key;
    const data = {
      timestamp: Date.now(),
      value,
    };
    localStorage.setItem(cacheKey, JSON.stringify(data));
  } catch (e) {
    console.warn('[Poetry] 缓存失败:', e);
  }
}

/**
 * 清除缓存
 */
export function clearPoetryCache(dynasty?: PoetryDynasty): void {
  if (dynasty) {
    localStorage.removeItem(CACHE_KEY_PREFIX + dynasty);
    return;
  }
  // 清除所有诗词缓存
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
 * 加载指定朝代的诗词数据
 */
export async function fetchPoetryByDynasty(
  dynasty: PoetryDynasty,
  strategy: Partial<LoadStrategy> = {}
): Promise<PoetryItem[]> {
  const config = { ...DEFAULT_STRATEGY, ...strategy };

  // 检查缓存
  if (config.useCache) {
    const cached = getFromCache<PoetryItem[]>(dynasty);
    if (cached) {
      console.log(`[Poetry] 使用缓存: ${dynasty}, 数量: ${cached.length}`);
      return cached;
    }
  }

  // 加载本地文件
  try {
    const fileName = `${dynasty}.json`;
    const url = `${POETRY_BASE_PATH}${fileName}`;
    console.log(`[Poetry] 加载: ${url}`);

    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    const poems = normalizePoetryData(data.poems || data);

    // 保存缓存
    if (config.useCache && poems.length > 0) {
      saveToCache(dynasty, poems);
    }

    console.log(`[Poetry] 加载成功: ${dynasty}, 数量: ${poems.length}`);
    return poems;
  } catch (error) {
    console.warn(`[Poetry] 加载失败: ${dynasty}`, error);
    // 返回内置数据作为备用
    return getBuiltinPoetryByDynasty(dynasty);
  }
}

/**
 * 加载所有朝代的诗词（带进度回调）
 */
export async function fetchAllPoetry(
  onProgress?: (loaded: number, total: number, dynasty: string) => void
): Promise<Record<PoetryDynasty, PoetryItem[]>> {
  const result = {} as Record<PoetryDynasty, PoetryItem[]>;
  const total = DYNASTY_LIST.length;

  for (let i = 0; i < total; i++) {
    const dynasty = DYNASTY_LIST[i];
    onProgress?.(i, total, dynasty.name);

    try {
      result[dynasty.code] = await fetchPoetryByDynasty(dynasty.code);
    } catch (error) {
      result[dynasty.code] = [];
    }
  }

  onProgress?.(total, total, '完成');
  return result;
}

/**
 * 标准化诗词数据
 */
function normalizePoetryData(data: any[]): PoetryItem[] {
  if (!Array.isArray(data)) {
    console.warn('[Poetry] 数据格式错误，期望数组');
    return [];
  }

  return data.map((item, index) => ({
    id: item.id || `poetry_${Date.now()}_${index}`,
    title: item.title || '未知标题',
    author: item.author || '佚名',
    dynasty: item.dynasty || '未知',
    dynastyCode: item.dynastyCode || getDynastyCode(item.dynasty),
    content: item.content || '',
    contentType: item.contentType || 'poetry',
    tags: item.tags || [],
    source: item.source,
    location: item.location,
    wordCount: item.wordCount || item.content?.length || 0,
    year: item.year,
  })).filter(p => p.content && p.title);
}

/**
 * 根据朝代名称获取代码
 */
function getDynastyCode(dynastyName?: string): PoetryDynasty {
  if (!dynastyName) return 'xianqin';

  const codeMap: Record<string, PoetryDynasty> = {
    '先秦': 'xianqin', '诗经': 'xianqin', '楚辞': 'xianqin', '战国': 'xianqin',
    '汉': 'han', '两汉': 'han', '西汉': 'han', '东汉': 'han',
    '魏晋': 'weijin', '魏晋南北朝': 'weijin', '南北朝': 'weijin', '三国': 'weijin',
    '隋': 'sui',
    '唐': 'tang', '唐诗': 'tang',
    '宋': 'song', '宋词': 'song', '宋诗': 'song',
    '元': 'yuan', '元曲': 'yuan',
    '明': 'ming', '明朝': 'ming',
    '清': 'qing', '清朝': 'qing',
    '现代': 'xiandai', '近现代': 'xiandai', '当代': 'xiandai',
  };

  return codeMap[dynastyName] || 'xianqin';
}

// ==================== 搜索查询 ====================

/**
 * 搜索诗词
 */
export async function searchPoetry(
  keyword: string,
  options: {
    dynasty?: PoetryDynasty;
    contentType?: ContentType;
    tags?: string[];
    location?: string;
    isClassic?: boolean;
  } = {}
): Promise<PoetryItem[]> {
  const { dynasty, contentType, tags, location, isClassic } = options;

  // 如果指定了朝代，只搜索该朝代
  if (dynasty) {
    const poems = await fetchPoetryByDynasty(dynasty);
    return filterPoems(poems, keyword, { contentType, tags, location, isClassic });
  }

  // 搜索所有朝代（并行）
  const allPoems = await fetchAllPoetry();
  const results: PoetryItem[] = [];

  for (const poems of Object.values(allPoems)) {
    results.push(...filterPoems(poems, keyword, { contentType, tags, location, isClassic }));
  }

  return results;
}

/**
 * 过滤诗词
 */
function filterPoems(
  poems: PoetryItem[],
  keyword: string,
  options: {
    contentType?: ContentType;
    tags?: string[];
    location?: string;
    isClassic?: boolean;
  } = {}
): PoetryItem[] {
  const { contentType, tags, location, isClassic } = options;

  return poems.filter(poem => {
    // 关键词匹配
    if (keyword) {
      const matchKeyword =
        poem.title.includes(keyword) ||
        poem.author.includes(keyword) ||
        poem.content.includes(keyword) ||
        poem.tags.some(t => t.includes(keyword)) ||
        (poem.location && poem.location.includes(keyword));
      if (!matchKeyword) return false;
    }

    // 类型筛选
    if (contentType && poem.contentType !== contentType) return false;

    // 标签筛选
    if (tags && tags.length > 0) {
      const hasTag = tags.some(tag => poem.tags.includes(tag));
      if (!hasTag) return false;
    }

    // 地点筛选
    if (location && poem.location && !poem.location.includes(location)) {
      return false;
    }

    // 经典筛选
    if (isClassic && !poem.isClassic && !poem.tags.some(t => t.includes('必背') || t.includes('名篇'))) {
      return false;
    }

    return true;
  });
}

/**
 * 获取必背诗词（根据标签筛选）
 */
export async function getClassicPoetry(): Promise<PoetryItem[]> {
  const allPoems = await fetchAllPoetry();
  const classics: PoetryItem[] = [];

  for (const poems of Object.values(allPoems)) {
    classics.push(...poems.filter(p =>
      p.tags.some(tag => tag.includes('必背') || tag.includes('名篇'))
    ));
  }

  return classics;
}

/**
 * 随机获取一首诗词
 */
export async function getRandomPoetry(dynasty?: PoetryDynasty): Promise<PoetryItem | null> {
  let poems: PoetryItem[];

  if (dynasty) {
    poems = await fetchPoetryByDynasty(dynasty);
  } else {
    const all = await fetchAllPoetry();
    const allPoems = Object.values(all).flat();
    poems = allPoems;
  }

  if (poems.length === 0) return null;

  const randomIndex = Math.floor(Math.random() * poems.length);
  return poems[randomIndex];
}

// ==================== 内置数据（备用） ====================

/**
 * 获取内置的指定朝代诗词（当文件加载失败时使用）
 */
function getBuiltinPoetryByDynasty(dynasty: PoetryDynasty): PoetryItem[] {
  const builtinData: Record<PoetryDynasty, PoetryItem[]> = {
    xianqin: [
      {
        id: 'xq_001',
        title: '关雎',
        author: '佚名',
        dynasty: '先秦',
        dynastyCode: 'xianqin',
        content: '关关雎鸠，在河之洲。\n窈窕淑女，君子好逑。\n参差荇菜，左右流之。\n窈窕淑女，寤寐求之。',
        contentType: 'poetry',
        tags: ['诗经', '爱情', '经典', '必背'],
        source: '《诗经·周南》',
        location: '黄河流域/中原',
        wordCount: 40,
      },
      {
        id: 'xq_002',
        title: '蒹葭',
        author: '佚名',
        dynasty: '先秦',
        dynastyCode: 'xianqin',
        content: '蒹葭苍苍，白露为霜。\n所谓伊人，在水一方。\n溯洄从之，道阻且长。\n溯游从之，宛在水中央。',
        contentType: 'poetry',
        tags: ['诗经', '爱情', '朦胧', '必背'],
        source: '《诗经·秦风》',
        location: '秦地/陕西',
        wordCount: 48,
      },
      {
        id: 'xq_003',
        title: '离骚（节选）',
        author: '屈原',
        dynasty: '先秦',
        dynastyCode: 'xianqin',
        content: '长太息以掩涕兮，哀民生之多艰。\n余虽好修姱以鞿羁兮，謇朝谇而夕替。\n既替余以蕙纕兮，又申之以揽茝。\n亦余心之所善兮，虽九死其犹未悔。',
        contentType: 'poetry',
        tags: ['楚辞', '爱国', '长篇', '必背'],
        source: '《楚辞》',
        location: '郢都/湖北江陵',
        wordCount: 80,
      },
      {
        id: 'xq_013',
        title: '桃夭',
        author: '佚名',
        dynasty: '先秦',
        dynastyCode: 'xianqin',
        content: '桃之夭夭，灼灼其华。之子于归，宜其室家。\n桃之夭夭，有蕡其实。之子于归，宜其家室。\n桃之夭夭，其叶蓁蓁。之子于归，宜其家人。',
        contentType: 'poetry',
        tags: ['诗经', '婚嫁', '祝福', '周南'],
        source: '《诗经·周南》',
        location: '周地/中原',
        wordCount: 48,
      },
      {
        id: 'xq_014',
        title: '静女',
        author: '佚名',
        dynasty: '先秦',
        dynastyCode: 'xianqin',
        content: '静女其姝，俟我于城隅。爱而不见，搔首踟蹰。\n静女其娈，贻我彤管。彤管有炜，说怿女美。\n自牧归荑，洵美且异。匪女之为美，美人之贻。',
        contentType: 'poetry',
        tags: ['诗经', '爱情', '约会', '邶风'],
        source: '《诗经·邶风》',
        location: '邶地/河南汤阴',
        wordCount: 48,
      },
      {
        id: 'xq_015',
        title: '采薇（节选）',
        author: '佚名',
        dynasty: '先秦',
        dynastyCode: 'xianqin',
        content: '昔我往矣，杨柳依依。\n今我来思，雨雪霏霏。\n行道迟迟，载渴载饥。\n我心伤悲，莫知我哀！',
        contentType: 'poetry',
        tags: ['诗经', '战争', '思乡', '名句'],
        source: '《诗经·小雅》',
        location: '北方边塞',
        wordCount: 32,
      },
      {
        id: 'xq_016',
        title: '无衣',
        author: '佚名',
        dynasty: '先秦',
        dynastyCode: 'xianqin',
        content: '岂曰无衣？与子同袍。王于兴师，修我戈矛，与子同仇！\n岂曰无衣？与子同泽。王于兴师，修我矛戟，与子偕作！\n岂曰无衣？与子同裳。王于兴师，修我甲兵，与子偕行！',
        contentType: 'poetry',
        tags: ['诗经', '战争', '慷慨', '秦风'],
        source: '《诗经·秦风》',
        location: '秦地/陕西',
        wordCount: 60,
      },
      {
        id: 'xq_020',
        title: '逍遥游（节选）',
        author: '庄子',
        dynasty: '先秦',
        dynastyCode: 'xianqin',
        content: '北冥有鱼，其名为鲲。鲲之大，不知其几千里也。化而为鸟，其名为鹏。鹏之背，不知其几千里也。怒而飞，其翼若垂天之云。是鸟也，海运则将徙于南冥。南冥者，天池也。',
        contentType: 'prose',
        tags: ['诸子百家', '道家', '寓言', '哲理'],
        source: '《庄子》',
        location: '宋国/河南商丘',
        wordCount: 100,
      },
      {
        id: 'xq_021',
        title: '劝学（节选）',
        author: '荀子',
        dynasty: '先秦',
        dynastyCode: 'xianqin',
        content: '青，取之于蓝，而青于蓝；冰，水为之，而寒于水。木直中绳，輮以为轮，其曲中规。虽有槁暴，不复挺者，輮使之然也。故木受绳则直，金就砺则利，君子博学而日参省乎己，则知明而行无过矣。',
        contentType: 'prose',
        tags: ['诸子百家', '儒家', '劝学', '哲理'],
        source: '《荀子》',
        location: '齐国/山东临淄',
        wordCount: 110,
      },
      {
        id: 'xq_022',
        title: '大道之行也',
        author: '佚名',
        dynasty: '先秦',
        dynastyCode: 'xianqin',
        content: '大道之行也，天下为公。选贤与能，讲信修睦。故人不独亲其亲，不独子其子，使老有所终，壮有所用，幼有所长，矜寡孤独废疾者皆有所养。是谓大同。',
        contentType: 'prose',
        tags: ['礼记', '儒家', '大同', '理想'],
        source: '《礼记·礼运》',
        location: '鲁国/山东曲阜',
        wordCount: 80,
      },
      {
        id: 'xq_027',
        title: '道可道',
        author: '老子',
        dynasty: '先秦',
        dynastyCode: 'xianqin',
        content: '道可道，非常道；名可名，非常名。无名，天地之始；有名，万物之母。故常无欲，以观其妙；常有欲，以观其徼。此两者同出而异名，同谓之玄，玄之又玄，众妙之门。',
        contentType: 'prose',
        tags: ['老子', '道家', '哲理', '名篇'],
        source: '《道德经》',
        location: '周/中原',
        wordCount: 80,
      },
    ],
    han: [
      {
        id: 'han_001',
        title: '短歌行',
        author: '曹操',
        dynasty: '两汉',
        dynastyCode: 'han',
        content: '对酒当歌，人生几何！\n譬如朝露，去日苦多。\n慨当以慷，忧思难忘。\n何以解忧？唯有杜康。\n青青子衿，悠悠我心。\n但为君故，沉吟至今。',
        contentType: 'poetry',
        tags: ['汉乐府', '壮志', '名篇', '必背'],
        source: '《乐府诗集》',
        location: '邺城/河北临漳',
        wordCount: 72,
      },
      {
        id: 'han_002',
        title: '观沧海',
        author: '曹操',
        dynasty: '两汉',
        dynastyCode: 'han',
        content: '东临碣石，以观沧海。\n水何澹澹，山岛竦峙。\n树木丛生，百草丰茂。\n秋风萧瑟，洪波涌起。\n日月之行，若出其中；\n星汉灿烂，若出其里。',
        contentType: 'poetry',
        tags: ['汉乐府', '山水', '壮志', '必背'],
        source: '《乐府诗集》',
        location: '碣石山/河北昌黎',
        wordCount: 60,
      },
      {
        id: 'han_003',
        title: '木兰诗（节选）',
        author: '佚名',
        dynasty: '两汉',
        dynastyCode: 'han',
        content: '唧唧复唧唧，木兰当户织。\n不闻机杼声，唯闻女叹息。\n问女何所思，问女何所忆。\n女亦无所思，女亦无所忆。\n昨夜见军帖，可汗大点兵，\n军书十二卷，卷卷有爷名。',
        contentType: 'poetry',
        tags: ['北朝民歌', '叙事', '女英雄', '必背'],
        source: '《乐府诗集》',
        location: '北方边塞',
        wordCount: 96,
      },
    ],
    weijin: [
      {
        id: 'wj_001',
        title: '归园田居·其一',
        author: '陶渊明',
        dynasty: '魏晋',
        dynastyCode: 'weijin',
        content: '少无适俗韵，性本爱丘山。\n误落尘网中，一去三十年。\n羁鸟恋旧林，池鱼思故渊。\n开荒南野际，守拙归园田。\n方宅十余亩，草屋八九间。\n榆柳荫后檐，桃李罗堂前。',
        contentType: 'poetry',
        tags: ['田园', '隐逸', '名篇', '必背'],
        source: '《陶渊明集》',
        location: '浔阳柴桑/江西九江',
        wordCount: 120,
      },
      {
        id: 'wj_002',
        title: '饮酒·其五',
        author: '陶渊明',
        dynasty: '魏晋',
        dynastyCode: 'weijin',
        content: '结庐在人境，而无车马喧。\n问君何能尔？心远地自偏。\n采菊东篱下，悠然见南山。\n山气日夕佳，飞鸟相与还。\n此中有真意，欲辨已忘言。',
        contentType: 'poetry',
        tags: ['田园', '哲理', '名篇', '必背'],
        source: '《陶渊明集》',
        location: '南山/庐山',
        wordCount: 100,
      },
      {
        id: 'wj_003',
        title: '出师表（节选）',
        author: '诸葛亮',
        dynasty: '三国',
        dynastyCode: 'weijin',
        content: '臣本布衣，躬耕于南阳，苟全性命于乱世，不求闻达于诸侯。先帝不以臣卑鄙，猥自枉屈，三顾臣于草庐之中，咨臣以当世之事，由是感激，遂许先帝以驱驰。',
        contentType: 'article',
        tags: ['古文', '忠诚', '名篇', '必背'],
        source: '《三国志》',
        location: '南阳/河南',
        wordCount: 150,
      },
    ],
    sui: [
      {
        id: 'sui_001',
        title: '春江花月夜',
        author: '张若虚',
        dynasty: '隋',
        dynastyCode: 'sui',
        content: '春江潮水连海平，海上明月共潮生。\n滟滟随波千万里，何处春江无月明！\n江流宛转绕芳甸，月照花林皆似霰；\n空里流霜不觉飞，汀上白沙看不见。',
        contentType: 'poetry',
        tags: ['唐诗先驱', '孤篇压全唐', '哲理', '必背'],
        source: '《乐府诗集》',
        location: '扬州/瓜洲',
        wordCount: 252,
      },
    ],
    tang: [
      {
        id: 'tang_001',
        title: '静夜思',
        author: '李白',
        dynasty: '唐',
        dynastyCode: 'tang',
        content: '床前明月光，疑是地上霜。\n举头望明月，低头思故乡。',
        contentType: 'poetry',
        tags: ['五言绝句', '思乡', '启蒙', '必背'],
        source: '《李太白集》',
        location: '扬州',
        wordCount: 20,
      },
      {
        id: 'tang_002',
        title: '将进酒（节选）',
        author: '李白',
        dynasty: '唐',
        dynastyCode: 'tang',
        content: '君不见黄河之水天上来，奔流到海不复回。\n君不见高堂明镜悲白发，朝如青丝暮成雪。\n人生得意须尽欢，莫使金樽空对月。\n天生我材必有用，千金散尽还复来。',
        contentType: 'poetry',
        tags: ['乐府', '豪放', '名篇', '必背'],
        source: '《李太白集》',
        location: '梁园/开封',
        wordCount: 120,
      },
      {
        id: 'tang_003',
        title: '登高',
        author: '杜甫',
        dynasty: '唐',
        dynastyCode: 'tang',
        content: '风急天高猿啸哀，渚清沙白鸟飞回。\n无边落木萧萧下，不尽长江滚滚来。\n万里悲秋常作客，百年多病独登台。\n艰难苦恨繁霜鬓，潦倒新停浊酒杯。',
        contentType: 'poetry',
        tags: ['七律', '沉郁', '名篇', '必背'],
        source: '《杜工部集》',
        location: '夔州/白帝城',
        wordCount: 112,
      },
    ],
    song: [
      {
        id: 'song_001',
        title: '水调歌头·明月几时有',
        author: '苏轼',
        dynasty: '宋',
        dynastyCode: 'song',
        content: '明月几时有？把酒问青天。\n不知天上宫阙，今夕是何年。\n我欲乘风归去，又恐琼楼玉宇，高处不胜寒。\n起舞弄清影，何似在人间。\n\n转朱阁，低绮户，照无眠。\n不应有恨，何事长向别时圆？\n人有悲欢离合，月有阴晴圆缺，此事古难全。\n但愿人长久，千里共婵娟。',
        contentType: 'ci',
        tags: ['宋词', '中秋', '豪放派', '必背'],
        source: '《东坡乐府》',
        location: '密州/山东诸城',
        wordCount: 190,
      },
      {
        id: 'song_002',
        title: '念奴娇·赤壁怀古',
        author: '苏轼',
        dynasty: '宋',
        dynastyCode: 'song',
        content: '大江东去，浪淘尽，千古风流人物。\n故垒西边，人道是，三国周郎赤壁。\n乱石穿空，惊涛拍岸，卷起千堆雪。\n江山如画，一时多少豪杰。\n\n遥想公瑾当年，小乔初嫁了，雄姿英发。\n羽扇纶巾，谈笑间，樯橹灰飞烟灭。\n故国神游，多情应笑我，早生华发。\n人生如梦，一尊还酹江月。',
        contentType: 'ci',
        tags: ['宋词', '怀古', '豪放派', '必背'],
        source: '《东坡乐府》',
        location: '黄州/赤壁矶',
        wordCount: 200,
      },
      {
        id: 'song_003',
        title: '岳阳楼记（节选）',
        author: '范仲淹',
        dynasty: '宋',
        dynastyCode: 'song',
        content: '不以物喜，不以己悲；居庙堂之高则忧其民；处江湖之远则忧其君。是进亦忧，退亦忧。然则何时而乐耶？其必曰："先天下之忧而忧，后天下之乐而乐"乎！',
        contentType: 'article',
        tags: ['古文', '哲理', '名篇', '必背'],
        source: '《范文正公集》',
        location: '岳阳楼/湖南岳阳',
        wordCount: 180,
      },
      {
        id: 'song_004',
        title: '赤壁赋（节选）',
        author: '苏轼',
        dynasty: '宋',
        dynastyCode: 'song',
        content: '壬戌之秋，七月既望，苏子与客泛舟游于赤壁之下。清风徐来，水波不兴。举酒属客，诵明月之诗，歌窈窕之章。少焉，月出于东山之上，徘徊于斗牛之间。白露横江，水光接天。纵一苇之所如，凌万顷之茫然。',
        contentType: 'fu',
        tags: ['赋', '哲理', '名篇', '必背'],
        source: '《东坡全集》',
        location: '黄州/赤壁矶',
        wordCount: 220,
      },
    ],
    yuan: [
      {
        id: 'yuan_001',
        title: '天净沙·秋思',
        author: '马致远',
        dynasty: '元',
        dynastyCode: 'yuan',
        content: '枯藤老树昏鸦，\n小桥流水人家，\n古道西风瘦马。\n夕阳西下，\n断肠人在天涯。',
        contentType: 'poetry',
        tags: ['元曲', '小令', '秋思之祖', '必背'],
        source: '《全元散曲》',
        location: '大都/北京',
        wordCount: 56,
      },
    ],
    ming: [
      {
        id: 'ming_001',
        title: '石灰吟',
        author: '于谦',
        dynasty: '明',
        dynastyCode: 'ming',
        content: '千锤万凿出深山，烈火焚烧若等闲。\n粉骨碎身浑不怕，要留清白在人间。',
        contentType: 'poetry',
        tags: ['咏物', '言志', '名篇', '必背'],
        source: '《于忠肃集》',
        location: '北京/石灰窑',
        wordCount: 56,
      },
    ],
    qing: [
      {
        id: 'qing_001',
        title: '己亥杂诗·其五',
        author: '龚自珍',
        dynasty: '清',
        dynastyCode: 'qing',
        content: '浩荡离愁白日斜，吟鞭东指即天涯。\n落红不是无情物，化作春泥更护花。',
        contentType: 'poetry',
        tags: ['爱国', '名篇', '必背'],
        source: '《龚自珍全集》',
        location: '镇江/江苏',
        wordCount: 56,
      },
    ],
    xiandai: [
      {
        id: 'xd_001',
        title: '再别康桥',
        author: '徐志摩',
        dynasty: '近现代',
        dynastyCode: 'xiandai',
        content: '轻轻的我走了，\n正如我轻轻的来；\n我轻轻的招手，\n作别西天的云彩。\n\n那河畔的金柳，\n是夕阳中的新娘；\n波光里的艳影，\n在我的心头荡漾。',
        contentType: 'poetry',
        tags: ['现代诗', '新月派', '名篇', '必背'],
        source: '《猛虎集》',
        location: '剑桥/英国',
        wordCount: 120,
      },
    ],
  };

  return builtinData[dynasty] || [];
}

// ==================== 工具函数 ====================

/**
 * 获取朝代统计信息
 */
export async function getPoetryStatistics(): Promise<{
  total: number;
  byDynasty: Record<PoetryDynasty, number>;
  byType: Record<ContentType, number>;
}> {
  const allPoems = await fetchAllPoetry();

  const byDynasty = {} as Record<PoetryDynasty, number>;
  const byType = {} as Record<ContentType, number>;

  let total = 0;

  for (const [dynasty, poems] of Object.entries(allPoems)) {
    byDynasty[dynasty as PoetryDynasty] = poems.length;
    total += poems.length;

    for (const poem of poems) {
      byType[poem.contentType] = (byType[poem.contentType] || 0) + 1;
    }
  }

  return { total, byDynasty, byType };
}

/**
 * 检查诗词库是否已缓存
 */
export function isPoetryCached(dynasty: PoetryDynasty): boolean {
  return getFromCache<PoetryItem[]>(dynasty) !== null;
}

// 默认导出
export default {
  fetchPoetryByDynasty,
  fetchAllPoetry,
  searchPoetry,
  getClassicPoetry,
  getRandomPoetry,
  getPoetryStatistics,
  clearPoetryCache,
  isPoetryCached,
  DYNASTY_LIST,
  DEFAULT_STRATEGY,
};
