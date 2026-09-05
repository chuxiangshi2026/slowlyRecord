/**
 * 内置知识包加载器（移动端）
 *
 * 桌面端用 fetch + localStorage 缓存加载 public/knowledgebanks/*.json；
 * 小程序无 fetch，改为：知识包转 TS 模块放本分包，懒加载 import()。
 * 7 天缓存逻辑从桌面端 knowledge-pack-service.ts 原样移植（localStorage → uni.*StorageSync）。
 */
import type { KnowledgePack, KnowledgePackCategory, KnowledgePackInfo } from '@/stores/useUtils/types'

// 缓存配置（与桌面端一致）
const CACHE_KEY_PREFIX = 'slowlyrecord-knowledgebank-'
const CACHE_EXPIRY = 7 * 24 * 60 * 60 * 1000 // 7天
const MIN_PACK_SIZE = 1 // 最小有效条目数

// 并发加载同包去重：相同 id 的 in-flight Promise 共享
const inFlight = new Map<string, Promise<KnowledgePack>>()

// 内存缓存（本次会话内）
const memoryCache = new Map<string, KnowledgePack>()

/**
 * 内置知识包元数据（与桌面端 KNOWLEDGE_PACK_LIST 一一对应）
 * category: math 类与数字/公式相关，text 类为文本/常识类
 */
export const KNOWLEDGE_PACK_LIST: KnowledgePackInfo[] = [
    {id: 'multiplication-9x9', name: '小九九乘法表', description: '1×1 到 9×9 的乘法口诀', itemCount: 81, ordered: false, usableAsPeg: false, category: 'math'},
    {id: 'multiplication-19x19', name: '大九九乘法表', description: '1×1 到 19×19 的乘法口诀', itemCount: 100, ordered: false, usableAsPeg: false, category: 'math'},
    {id: 'elements', name: '元素周期表', description: '元素周期表 118 号元素（氢到鿫）：符号、中文名、序数、拼音与类别', itemCount: 118, ordered: false, usableAsPeg: false, category: 'math', version: 4},
    {id: 'solar-terms-24', name: '二十四节气', description: '二十四节气及其日期与物候，顺序本身是考点', itemCount: 24, ordered: true, usableAsPeg: true, category: 'text', version: 3},
    {id: 'zodiac-12', name: '十二生肖', description: '十二生肖及其对应地支，顺序本身是考点', itemCount: 12, ordered: true, usableAsPeg: true, category: 'text', version: 3},
    {id: 'number-pegs-12', name: '数字桩（1-12）', description: '经典数字形象桩，1-6 号位提供多个备选桩', itemCount: 12, ordered: true, usableAsPeg: true, category: 'text', version: 2},
    {id: 'home-route-12', name: '家居路线桩（12 桩）', description: '按进门后的巡视路线排列的家居地点桩', itemCount: 12, ordered: true, usableAsPeg: true, category: 'text', version: 2},
    {id: 'constellations-12', name: '十二星座', description: '十二星座及其日期范围，顺序本身是考点', itemCount: 12, ordered: true, usableAsPeg: false, category: 'text', version: 2},
    {id: 'ethnic-groups-56', name: '五十六个民族', description: '中国 56 个民族名称', itemCount: 56, ordered: false, usableAsPeg: false, category: 'text'},
    {id: 'cuisines-8', name: '八大菜系', description: '中国八大菜系及其代表特点', itemCount: 8, ordered: false, usableAsPeg: false, category: 'text'},
    {id: 'provinces-capitals', name: '中国省级行政区及省会', description: '34 个省级行政区及其省会、首府或政府驻地', itemCount: 34, ordered: false, usableAsPeg: false, category: 'text'},
    {id: 'math-formulas', name: '常用数学公式', description: '小学到高中入门常用数学公式与函数', itemCount: 33, ordered: false, usableAsPeg: false, category: 'math', version: 4},
    {id: 'math-calculus', name: '高等数学·微积分基础', description: '极限、导数、微分、积分与级数入门 15 条', itemCount: 15, ordered: false, usableAsPeg: false, category: 'math', version: 1},
    {id: 'math-linalg', name: '高等数学·线性代数基础', description: '矩阵、行列式、向量与特征值入门 14 条', itemCount: 14, ordered: false, usableAsPeg: false, category: 'math', version: 1},
    {id: 'math-probability', name: '高等数学·概率统计基础', description: '排列组合、概率公式与常见分布入门 15 条', itemCount: 15, ordered: false, usableAsPeg: false, category: 'math', version: 1},
    {id: 'chemistry-formulas', name: '常用化学公式', description: '初中化学常见方程式与计算式 22 条', itemCount: 22, ordered: false, usableAsPeg: false, category: 'math', version: 2},
    {id: 'physics-formulas', name: '初中物理公式', description: '初中物理常用公式 21 条', itemCount: 21, ordered: false, usableAsPeg: false, category: 'math', version: 2},
    {id: 'physics-laws', name: '初中物理定律与原理', description: '初中物理常见定律与原理 15 条', itemCount: 15, ordered: false, usableAsPeg: false, category: 'text', version: 1},
    {id: 'physics-experiments', name: '初中物理实验', description: '初中常见物理实验 15 个', itemCount: 15, ordered: false, usableAsPeg: false, category: 'text', version: 1},
    {id: 'biology-experiments', name: '初中生物实验', description: '初中常见生物实验 15 个', itemCount: 15, ordered: false, usableAsPeg: false, category: 'text', version: 1},
    {id: 'geography-concepts', name: '初中地理核心概念', description: '初中地理核心概念 20 条', itemCount: 20, ordered: false, usableAsPeg: false, category: 'text', version: 1},
    {id: 'body-pegs-12', name: '身体桩', description: '从头顶到脚底 12 个身体部位，按从上到下的固定顺序用作记忆桩', itemCount: 12, ordered: true, usableAsPeg: true, category: 'text', version: 1},
    {id: 'earthly-branches-12', name: '十二地支', description: '十二地支及其时辰时段、生肖、五行、阴阳与方位', itemCount: 12, ordered: true, usableAsPeg: true, category: 'text', version: 1},
    {id: 'room-pegs-12', name: '房间桩', description: '典型户型 12 个房间，按进出动线排列用作记忆桩', itemCount: 12, ordered: true, usableAsPeg: true, category: 'text', version: 1},
    {id: 'dynasties-china', name: '中国历代王朝', description: '从夏到清 18 个主要朝代，含起止年份、都城与创立者', itemCount: 18, ordered: true, usableAsPeg: true, category: 'text', version: 2},
    {id: 'common-units', name: '常用计量单位', description: '物理量的国际单位与常见单位换算', itemCount: 21, ordered: false, usableAsPeg: false, category: 'math', version: 1},
    {id: 'colors-12', name: '十二种颜色', description: '12 种常见颜色的色值与英文名称', itemCount: 12, ordered: false, usableAsPeg: false, category: 'text', version: 1},
    {id: 'musical-notes', name: '十二平均律', description: 'C 大调 12 个半音的音名、十二律中文名、音阶位置与 A4 基准频率', itemCount: 12, ordered: true, usableAsPeg: true, category: 'text', version: 1},
    {id: 'math-formulas-2', name: '常用数学公式（进阶篇）', description: '高中与竞赛方向的数列、几何、圆锥曲线、微积分与概率公式', itemCount: 28, ordered: false, usableAsPeg: false, category: 'math', version: 1},
    {id: 'squares-cubes-powers', name: '平方立方与幂次', description: '1-25 平方、1-10 立方、2 的 1-16 次幂与 10 的 6-12 次幂（含中文数位）', itemCount: 58, ordered: false, usableAsPeg: false, category: 'math', version: 1},
    {id: 'primes-under-100', name: '100 以内质数表', description: '100 以内 25 个质数及其序位，顺序本身是考点', itemCount: 25, ordered: true, usableAsPeg: false, category: 'math', version: 1},
    {id: 'poker-pegs-52', name: '扑克牌桩（52 张）', description: '一副扑克 52 张牌的花色点数桩（黑桃/红桃/方块/梅花），按花色顺序用作记忆宫殿桩位', itemCount: 52, ordered: true, usableAsPeg: true, category: 'text', version: 1},
    {id: 'alphabet-pegs-26', name: '字母形象桩（A-Z）', description: 'A-Z 26 个字母的英文首词形象桩，按字母序用作记忆宫殿桩位', itemCount: 26, ordered: true, usableAsPeg: true, category: 'text', version: 1},
    {id: 'thirty-six-stratagems', name: '三十六计', description: '三十六计全目，按六套（胜战/敌战/攻战/混战/并战/败战）顺序排列，顺序本身是考点', itemCount: 36, ordered: true, usableAsPeg: false, category: 'text', version: 1},
    {id: 'world-capitals-40', name: '世界国家与首都', description: '六大洲 40 个常见国家及其首都（南非为行政首都比勒陀利亚）', itemCount: 40, ordered: false, usableAsPeg: false, category: 'text', version: 1},
]

interface CacheData {
    timestamp: number
    /** 写入缓存时的包数据版本（旧缓存无此字段，视为 1） */
    version?: number
    pack: KnowledgePack
}

/** 获取包当前数据版本（元数据未显式声明时为 1） */
export function getPackVersion(id: string): number {
    return getKnowledgePackInfo(id)?.version ?? 1
}

/**
 * 缓存是否可用：未过期、版本与当前包一致、数据结构合法。
 * 版本不一致（如包内容升级后老缓存缺数据）视为失效。
 */
export function isCacheUsable(data: CacheData | null, expectedVersion: number, now: number = Date.now()): boolean {
    if (!data) return false
    if (now - data.timestamp > CACHE_EXPIRY) return false
    if ((data.version ?? 1) !== expectedVersion) return false
    if (!data.pack || !Array.isArray(data.pack.items) || data.pack.items.length < MIN_PACK_SIZE) return false
    return true
}

function buildCacheKey(id: string): string {
    return CACHE_KEY_PREFIX + id
}

/** 从 uni storage 读取缓存 */
function getFromCache(id: string): KnowledgePack | null {
    try {
        const cached = uni.getStorageSync(buildCacheKey(id))
        if (!cached) return null
        const data: CacheData = cached
        if (!isCacheUsable(data, getPackVersion(id))) {
            uni.removeStorageSync(buildCacheKey(id))
            return null
        }
        return data.pack
    } catch (error) {
        console.warn(`[KnowledgePack] 读取缓存失败: ${id}`, error)
        return null
    }
}

/** 写入 uni storage 缓存 */
function saveToCache(id: string, pack: KnowledgePack): void {
    try {
        const data: CacheData = {
            timestamp: Date.now(),
            version: getPackVersion(id),
            pack,
        }
        uni.setStorageSync(buildCacheKey(id), data)
    } catch (e) {
        console.warn('[KnowledgePack] 缓存失败:', e)
    }
}

// 懒加载注册表：每个包一个动态 import()，全部 chunk 留在本分包
const packLoaders: Record<string, () => Promise<{ default: KnowledgePack }>> = {
    'multiplication-9x9': () => import('../knowledgebanks/multiplication-9x9'),
    'multiplication-19x19': () => import('../knowledgebanks/multiplication-19x19'),
    'elements': () => import('../knowledgebanks/elements'),
    'solar-terms-24': () => import('../knowledgebanks/solar-terms-24'),
    'zodiac-12': () => import('../knowledgebanks/zodiac-12'),
    'number-pegs-12': () => import('../knowledgebanks/number-pegs-12'),
    'home-route-12': () => import('../knowledgebanks/home-route-12'),
    'constellations-12': () => import('../knowledgebanks/constellations-12'),
    'ethnic-groups-56': () => import('../knowledgebanks/ethnic-groups-56'),
    'cuisines-8': () => import('../knowledgebanks/cuisines-8'),
    'provinces-capitals': () => import('../knowledgebanks/provinces-capitals'),
    'math-formulas': () => import('../knowledgebanks/math-formulas'),
    'math-calculus': () => import('../knowledgebanks/math-calculus'),
    'math-linalg': () => import('../knowledgebanks/math-linalg'),
    'math-probability': () => import('../knowledgebanks/math-probability'),
    'chemistry-formulas': () => import('../knowledgebanks/chemistry-formulas'),
    'physics-formulas': () => import('../knowledgebanks/physics-formulas'),
    'physics-laws': () => import('../knowledgebanks/physics-laws'),
    'physics-experiments': () => import('../knowledgebanks/physics-experiments'),
    'biology-experiments': () => import('../knowledgebanks/biology-experiments'),
    'geography-concepts': () => import('../knowledgebanks/geography-concepts'),
    'body-pegs-12': () => import('../knowledgebanks/body-pegs-12'),
    'earthly-branches-12': () => import('../knowledgebanks/earthly-branches-12'),
    'room-pegs-12': () => import('../knowledgebanks/room-pegs-12'),
    'dynasties-china': () => import('../knowledgebanks/dynasties-china'),
    'common-units': () => import('../knowledgebanks/common-units'),
    'colors-12': () => import('../knowledgebanks/colors-12'),
    'musical-notes': () => import('../knowledgebanks/musical-notes'),
    'math-formulas-2': () => import('../knowledgebanks/math-formulas-2'),
    'squares-cubes-powers': () => import('../knowledgebanks/squares-cubes-powers'),
    'primes-under-100': () => import('../knowledgebanks/primes-under-100'),
    'poker-pegs-52': () => import('../knowledgebanks/poker-pegs-52'),
    'alphabet-pegs-26': () => import('../knowledgebanks/alphabet-pegs-26'),
    'thirty-six-stratagems': () => import('../knowledgebanks/thirty-six-stratagems'),
    'world-capitals-40': () => import('../knowledgebanks/world-capitals-40'),
}

/**
 * 获取知识包（内存 → storage 缓存 → 分包 import()）
 */
export async function fetchKnowledgePack(id: string): Promise<KnowledgePack> {
    const mem = memoryCache.get(id)
    if (mem) return mem

    const cached = getFromCache(id)
    if (cached) {
        memoryCache.set(id, cached)
        return cached
    }

    if (inFlight.has(id)) {
        return inFlight.get(id)!
    }

    const promise = (async (): Promise<KnowledgePack> => {
        try {
            const loader = packLoaders[id]
            if (!loader) throw new Error(`[KnowledgePack] 未知知识包: ${id}`)
            const mod = await loader()
            const pack = normalizePack(mod.default)
            const validation = validateKnowledgePack(pack)
            if (!validation.valid) {
                throw new Error(`[KnowledgePack] 数据校验失败: ${id}, ${validation.error}`)
            }
            memoryCache.set(id, pack)
            saveToCache(id, pack)
            return pack
        } finally {
            inFlight.delete(id)
        }
    })()

    inFlight.set(id, promise)
    return promise
}

/** 校验知识包结构 */
export function validateKnowledgePack(data: unknown): { valid: boolean; error?: string } {
    if (!data || typeof data !== 'object') {
        return {valid: false, error: '知识包不是对象'}
    }
    const pack = data as Record<string, unknown>

    if (typeof pack.id !== 'string' || !pack.id) {
        return {valid: false, error: '缺少 id 或 id 不是字符串'}
    }
    if (typeof pack.name !== 'string' || !pack.name) {
        return {valid: false, error: '缺少 name 或 name 不是字符串'}
    }
    if (!Array.isArray(pack.items)) {
        return {valid: false, error: 'items 必须是数组'}
    }
    if (pack.items.length < MIN_PACK_SIZE) {
        return {valid: false, error: 'items 为空'}
    }

    const seenIds = new Set<string>()
    for (let i = 0; i < pack.items.length; i++) {
        const it = pack.items[i] as Record<string, unknown> | null
        if (!it || typeof it !== 'object') {
            return {valid: false, error: `items[${i}] 不是对象`}
        }
        if (typeof it.id !== 'string' || !it.id) {
            return {valid: false, error: `items[${i}] 缺少 id`}
        }
        if (typeof it.question !== 'string') {
            return {valid: false, error: `items[${i}] question 不是字符串`}
        }
        if (typeof it.answer !== 'string') {
            return {valid: false, error: `items[${i}] answer 不是字符串`}
        }
        if (seenIds.has(it.id as string)) {
            return {valid: false, error: `items 中存在重复 id: ${it.id}`}
        }
        seenIds.add(it.id as string)
    }

    return {valid: true}
}

/** 标准化知识包数据（给可选字段默认值） */
function normalizePack(pack: KnowledgePack): KnowledgePack {
    return {
        id: pack.id,
        name: pack.name,
        description: pack.description || '',
        ordered: !!pack.ordered,
        usableAsPeg: !!pack.usableAsPeg,
        mnemonics: Array.isArray(pack.mnemonics) ? pack.mnemonics : undefined,
        items: (pack.items || []).map(item => ({
            id: item.id,
            question: item.question,
            answer: item.answer,
            extras: item.extras && typeof item.extras === 'object' ? item.extras : undefined,
            alternates: Array.isArray(item.alternates) ? item.alternates : undefined,
            order: typeof item.order === 'number' ? item.order : undefined,
            imageUrl: typeof item.imageUrl === 'string' ? item.imageUrl : undefined,
        })),
    }
}

/** 清除知识包缓存 */
export function clearKnowledgePackCache(id?: string): void {
    if (id) {
        memoryCache.delete(id)
        try {
            uni.removeStorageSync(buildCacheKey(id))
        } catch {}
        return
    }
    memoryCache.clear()
    try {
        const res = uni.getStorageInfoSync()
        for (const key of res.keys || []) {
            if (key.startsWith(CACHE_KEY_PREFIX)) {
                uni.removeStorageSync(key)
            }
        }
    } catch {}
}

/** 获取知识包元数据 */
export function getKnowledgePackInfo(id: string): KnowledgePackInfo | undefined {
    return KNOWLEDGE_PACK_LIST.find(p => p.id === id)
}

/** 列出内置知识包元数据，可按 category 过滤 */
export function listKnowledgePacks(category?: KnowledgePackCategory): KnowledgePackInfo[] {
    return KNOWLEDGE_PACK_LIST
        .filter(p => !category || p.category === category)
        .map(p => ({...p}))
}
