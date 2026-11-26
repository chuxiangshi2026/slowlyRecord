import axios from 'axios';
import { ElMessage } from 'element-plus';
import type { PoetryItem, PoetryDynasty, ContentType } from './poetry-service';

// 重新导出类型
export type { PoetryItem, PoetryDynasty, ContentType };

// 今日诗词 API
const JINRISHICI_API = 'https://v2.jinrishici.com';

// 古诗词 API (使用古诗词网或其他免费API)
const POETRY_DB_API = 'https://poetrydb.org';

// 本地诗词库路径
const LOCAL_POETRY_PATH = import.meta.env.BASE_URL + 'datafile/poetry/';

/**
 * 诗词数据结构（兼容旧版本）
 * @deprecated 使用 PoetryItem 替代
 */
export interface PoetryData {
  _id: string;
  title: string;
  author: string;
  dynasty: string;
  content: string;
  tags: string[];
}

/**
 * 获取今日诗词（随机一首）
 */
export async function getTodayPoetry(): Promise<PoetryData | null> {
  try {
    const response = await axios.get(`${JINRISHICI_API}/one.json`, {
      timeout: 5000
    });
    
    if (response.data && response.data.status === 'success') {
      const data = response.data.data;
      return {
        _id: `poetry_${Date.now()}`,
        title: data.origin.title || '未知标题',
        author: data.origin.author || '佚名',
        dynasty: data.origin.dynasty || '未知',
        content: data.content || data.origin.content?.join('\n') || '',
        tags: data.matchTags || ['诗词']
      };
    }
    return null;
  } catch (error) {
    console.error('获取今日诗词失败:', error);
    return null;
  }
}

/**
 * 根据作者搜索诗词
 */
export async function searchPoetryByAuthor(author: string): Promise<PoetryData[]> {
  try {
    const response = await axios.get(`${POETRY_DB_API}/author/${encodeURIComponent(author)}`, {
      timeout: 5000
    });
    
    if (Array.isArray(response.data)) {
      return response.data.map((item: any, index: number) => ({
        _id: `poetry_${author}_${index}`,
        title: item.title || '未知标题',
        author: item.author || author,
        dynasty: getDynastyFromAuthor(item.author),
        content: Array.isArray(item.lines) ? item.lines.join('\n') : item.lines || '',
        tags: ['诗词', item.author]
      }));
    }
    return [];
  } catch (error) {
    console.error('搜索诗词失败:', error);
    return [];
  }
}

/**
 * 根据标题搜索诗词
 */
export async function searchPoetryByTitle(title: string): Promise<PoetryData[]> {
  try {
    const response = await axios.get(`${POETRY_DB_API}/title/${encodeURIComponent(title)}`, {
      timeout: 5000
    });
    
    if (Array.isArray(response.data)) {
      return response.data.map((item: any, index: number) => ({
        _id: `poetry_${title}_${index}`,
        title: item.title || title,
        author: item.author || '佚名',
        dynasty: getDynastyFromAuthor(item.author),
        content: Array.isArray(item.lines) ? item.lines.join('\n') : item.lines || '',
        tags: ['诗词', item.title]
      }));
    }
    return [];
  } catch (error) {
    console.error('搜索诗词失败:', error);
    return [];
  }
}

/**
 * 综合搜索诗词（根据关键词）
 */
export async function searchPoetry(keyword: string): Promise<PoetryData[]> {
  const results: PoetryData[] = [];
  
  try {
    // 尝试按作者搜索
    const byAuthor = await searchPoetryByAuthor(keyword);
    results.push(...byAuthor);
    
    // 尝试按标题搜索
    const byTitle = await searchPoetryByTitle(keyword);
    // 去重
    byTitle.forEach(poetry => {
      if (!results.find(p => p.title === poetry.title && p.author === poetry.author)) {
        results.push(poetry);
      }
    });
    
    return results;
  } catch (error) {
    console.error('搜索诗词失败:', error);
    ElMessage.error('搜索失败，请检查网络连接');
    return [];
  }
}

/**
 * 获取内置诗词数据（作为备用）
 * 现在从本地 JSON 文件加载
 */
export async function getBuiltinPoetryData(): Promise<PoetryData[]> {
  try {
    // 尝试加载本地诗词库
    const response = await fetch(`${LOCAL_POETRY_PATH}index.json`);
    if (response.ok) {
      const index = await response.json();
      const allPoems: PoetryData[] = [];

      // 加载所有朝代的诗词
      for (const dynasty of index.dynasties) {
        try {
          const poemResponse = await fetch(`${LOCAL_POETRY_PATH}${dynasty.file}`);
          if (poemResponse.ok) {
            const data = await poemResponse.json();
            const poems = (data.poems || []).map((p: any) => ({
              _id: p.id,
              title: p.title,
              author: p.author,
              dynasty: p.dynastyCode || dynasty.code,
              content: p.content,
              tags: p.tags || []
            }));
            allPoems.push(...poems);
          }
        } catch (e) {
          console.warn(`加载 ${dynasty.name} 失败`, e);
        }
      }

      if (allPoems.length > 0) {
        return allPoems;
      }
    }
  } catch (error) {
    console.warn('加载本地诗词库失败，使用内置数据', error);
  }

  // 返回最小化的备用数据
  return getMinimalFallbackData();
}

/**
 * 最小化备用数据
 */
function getMinimalFallbackData(): PoetryData[] {
  return [
    {
      _id: '1',
      title: '静夜思',
      author: '李白',
      dynasty: 'tang',
      content: '床前明月光，\n疑是地上霜。\n举头望明月，\n低头思故乡。',
      tags: ['唐诗', '李白', '思乡', '常背篇目']
    },
    {
      _id: '2',
      title: '水调歌头·明月几时有',
      author: '苏轼',
      dynasty: 'song',
      content: '明月几时有？把酒问青天。\n不知天上宫阙，今夕是何年。',
      tags: ['宋词', '苏轼', '中秋', '常背篇目']
    },
    {
      _id: '3',
      title: '关雎',
      author: '佚名',
      dynasty: 'xianqin',
      content: '关关雎鸠，在河之洲。\n窈窕淑女，君子好逑。',
      tags: ['诗经', '爱情', '常背篇目']
    }
  ];
}

/**
 * 根据作者推断朝代
 */
function getDynastyFromAuthor(author: string): string {
  const dynastyMap: Record<string, string> = {
    '李白': 'tang',
    '杜甫': 'tang',
    '白居易': 'tang',
    '王维': 'tang',
    '孟浩然': 'tang',
    '王昌龄': 'tang',
    '李商隐': 'tang',
    '杜牧': 'tang',
    '苏轼': 'song',
    '辛弃疾': 'song',
    '李清照': 'song',
    '陆游': 'song',
    '欧阳修': 'song',
    '王安石': 'song',
    '柳宗元': 'tang',
    '韩愈': 'tang',
    '刘禹锡': 'tang',
    '王之涣': 'tang',
    '王勃': 'tang',
    '骆宾王': 'tang',
    '杨炯': 'tang',
    '卢照邻': 'tang'
  };
  
  return dynastyMap[author] || 'unknown';
}

/**
 * 搜索内置诗词（本地数据）
 * @deprecated 使用 poetry-service.ts 中的 searchPoetry 替代
 */
export async function searchBuiltinPoetry(keyword: string, dynasty?: string): Promise<PoetryData[]> {
  const allPoetry = await getBuiltinPoetryData();

  return allPoetry.filter(poetry => {
    // 按朝代筛选
    if (dynasty && poetry.dynasty !== dynasty) {
      return false;
    }

    // 按关键词搜索
    return (
      poetry.title.includes(keyword) ||
      poetry.author.includes(keyword) ||
      poetry.content.includes(keyword) ||
      poetry.tags.some(tag => tag.includes(keyword))
    );
  });
}
