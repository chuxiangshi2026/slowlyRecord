/**
 * 文本记忆 - 内置库加载器（移动端）
 *
 * 静态 import 分包内的 ts 数据模块（数据并进 pages-memory 分包 chunk 图，不进主包）。
 * 不能用动态 import()：uni-app alpha 编译 mp-weixin 时会把 import('xx.js') 变成
 * 纯字符串字面量（renderDynamicImport 返回 '(' + ')'），真机运行拿不到模块。
 *
 * 数据模块由 mobile/scripts/convert-poetry.cjs 从 text-memory/data/*.json 生成
 * （ts 模块的 chunk 归属引用方所在分包；.json 动态 import 会被工具链归入主包）。
 *
 * 数据格式与 text-memory/data/*.json 一致（移动端精简版），便于同步互通。
 */
import poetryXianqin from './poetry-data/poetry-xianqin'
import poetryHan from './poetry-data/poetry-han'
import poetryWeijin from './poetry-data/poetry-weijin'
import poetrySui from './poetry-data/poetry-sui'
import poetryTang from './poetry-data/poetry-tang'
import poetrySong from './poetry-data/poetry-song'
import poetryYuan from './poetry-data/poetry-yuan'
import poetryMing from './poetry-data/poetry-ming'
import poetryQing from './poetry-data/poetry-qing'
import poetryXiandai from './poetry-data/poetry-xiandai'
import idiomData from './poetry-data/idioms'

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

// 朝代代码 → 对应的数据模块（静态 import，见文件头说明）
const POETRY_DATA: Record<string, typeof poetryTang> = {
  xianqin: poetryXianqin,
  han: poetryHan,
  weijin: poetryWeijin,
  sui: poetrySui,
  tang: poetryTang,
  song: poetrySong,
  yuan: poetryYuan,
  ming: poetryMing,
  qing: poetryQing,
  xiandai: poetryXiandai,
}

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
  const data = POETRY_DATA[code]
  if (!data) return []
  const list = normalizePoetry((data.poems || []) as any[], code)
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
  const list = ((idiomData.idioms || []) as any[]).map((it: any, idx: number) => ({
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
