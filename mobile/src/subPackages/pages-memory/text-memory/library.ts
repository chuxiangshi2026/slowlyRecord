/**
 * 文本记忆 - 内置库加载器（移动端）
 *
 * 用 import() 动态拉取分包内的 JSON，避免主包加载所有诗词数据。
 * 在小程序中静态 import JSON 是支持的（uni 编译期会处理）。
 *
 * 数据格式与桌面端 public/datafile/* 完全一致，便于同步互通。
 */

export interface MobilePoetryItem {
  id: string
  title: string
  author: string
  dynasty: string
  dynastyCode: string
  content: string
  contentType: string
  tags: string[]
  source?: string
  location?: string
  wordCount?: number
  year?: string | number
}

export interface MobileIdiomItem {
  id: string
  title: string
  pinyin?: string
  meaning: string
  source?: string
  story?: string
  example?: string
  location?: string
  category: string
  tags: string[]
}

export interface DynastyMeta {
  code: string
  name: string
  period: string
  count: number
}

// 朝代常量（与桌面端 DYNASTY_LIST 一致；移动端简化）
export const DYNASTIES: DynastyMeta[] = [
  { code: 'xianqin', name: '先秦', period: '前1046-前221', count: 0 },
  { code: 'han', name: '两汉', period: '前206-220', count: 0 },
  { code: 'weijin', name: '魏晋南北朝', period: '220-589', count: 0 },
  { code: 'sui', name: '隋', period: '581-618', count: 0 },
  { code: 'tang', name: '唐', period: '618-907', count: 0 },
  { code: 'song', name: '宋', period: '960-1279', count: 0 },
  { code: 'yuan', name: '元', period: '1271-1368', count: 0 },
  { code: 'ming', name: '明', period: '1368-1644', count: 0 },
  { code: 'qing', name: '清', period: '1644-1912', count: 0 },
  { code: 'xiandai', name: '近现代', period: '1912-至今', count: 0 },
]

// 成语分类
export const IDIOM_CATEGORIES = [
  '寓言故事',
  '历史典故',
  '励志',
  '劝学',
  '品德',
  '智慧',
  '自然',
  '人物',
]

const poetryCache = new Map<string, MobilePoetryItem[]>()
let idiomCache: MobileIdiomItem[] | null = null

function normalizePoetry(raw: any[], dynastyCode: string): MobilePoetryItem[] {
  if (!Array.isArray(raw)) return []
  return raw.map((it: any, idx: number) => ({
    id: it.id || `${dynastyCode}_${idx}`,
    title: it.title || '',
    author: it.author || '佚名',
    dynasty: it.dynasty || '',
    dynastyCode: it.dynastyCode || dynastyCode,
    content: it.content || '',
    contentType: it.contentType || 'poetry',
    tags: Array.isArray(it.tags) ? it.tags : [],
    source: it.source,
    location: it.location,
    wordCount: it.wordCount,
    year: it.year,
  })).filter((p) => p.title && p.content)
}

/**
 * 按朝代加载诗词
 */
export async function loadPoetryByDynasty(code: string): Promise<MobilePoetryItem[]> {
  if (poetryCache.has(code)) return poetryCache.get(code)!
  let raw: any
  switch (code) {
    case 'xianqin': raw = await import('./data/poetry-xianqin.json'); break
    case 'han': raw = await import('./data/poetry-han.json'); break
    case 'weijin': raw = await import('./data/poetry-weijin.json'); break
    case 'sui': raw = await import('./data/poetry-sui.json'); break
    case 'tang': raw = await import('./data/poetry-tang.json'); break
    case 'song': raw = await import('./data/poetry-song.json'); break
    case 'yuan': raw = await import('./data/poetry-yuan.json'); break
    case 'ming': raw = await import('./data/poetry-ming.json'); break
    case 'qing': raw = await import('./data/poetry-qing.json'); break
    case 'xiandai': raw = await import('./data/poetry-xiandai.json'); break
    default: return []
  }
  const data = (raw as any).default ?? raw
  const list = normalizePoetry(data.poems || data, code)
  poetryCache.set(code, list)
  return list
}

/**
 * 加载所有诗词
 */
export async function loadAllPoetry(): Promise<MobilePoetryItem[]> {
  const all: MobilePoetryItem[] = []
  for (const d of DYNASTIES) {
    const list = await loadPoetryByDynasty(d.code)
    all.push(...list)
  }
  return all
}

/**
 * 加载所有成语
 */
export async function loadAllIdioms(): Promise<MobileIdiomItem[]> {
  if (idiomCache) return idiomCache
  const raw: any = await import('./data/idioms.json')
  const data = raw.default ?? raw
  const list = (data.idioms || data || []).map((it: any, idx: number) => ({
    id: it.id || `idiom_${idx}`,
    title: it.title || '',
    pinyin: it.pinyin,
    meaning: it.meaning || '',
    source: it.source,
    story: it.story,
    example: it.example,
    location: it.location,
    category: it.category || '其他',
    tags: Array.isArray(it.tags) ? it.tags : [],
  })).filter((it: any) => it.title && it.meaning)
  idiomCache = list
  return list
}
