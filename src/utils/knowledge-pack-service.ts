/**
 * 通用知识包服务
 * 参考 wordbank-service.ts 结构，从 public/knowledgebanks/ 加载 JSON 并做 localStorage 缓存。
 */

import type {KnowledgePack, KnowledgePackCategory, KnowledgePackInfo} from '@/types/knowledge-memory';

// 本地知识包文件路径（适配 base: './' 配置）
const LOCAL_KNOWLEDGEBANK_PATH = import.meta.env.BASE_URL + 'knowledgebanks/';

// 缓存配置
const CACHE_KEY_PREFIX = 'slowlyrecord-knowledgebank-';
const CACHE_EXPIRY = 7 * 24 * 60 * 60 * 1000; // 7天
const MIN_PACK_SIZE = 1; // 最小有效条目数

// 并发加载同包去重：相同 id 的 in-flight Promise 共享
const inFlight = new Map<string, Promise<KnowledgePack>>();

export interface LoadStrategy {
    priority: 'local';      // 仅支持本地文件
    useCache: boolean;      // 是否使用缓存
    timeout: number;        // 超时时间(ms)
}

export const DEFAULT_STRATEGY: LoadStrategy = {
    priority: 'local',
    useCache: true,
    timeout: 5000,
};

// 内置知识包元数据（与 public/knowledgebanks/*.json 对应）
// category: math 类融入「数字记忆」主页，text 类融入「文本记忆」知识库视图
export const KNOWLEDGE_PACK_LIST: KnowledgePackInfo[] = [
    {id: 'multiplication-9x9', name: '小九九乘法表', description: '1×1 到 9×9 的乘法口诀', itemCount: 81, ordered: false, usableAsPeg: false, category: 'math'},
    {id: 'multiplication-19x19', name: '大九九乘法表', description: '1×1 到 19×19 的乘法口诀', itemCount: 100, ordered: false, usableAsPeg: false, category: 'math'},
    {id: 'elements', name: '元素周期表（前 36 号）', description: '元素符号、中文名、序数与拼音', itemCount: 36, ordered: false, usableAsPeg: false, category: 'math', version: 2},
    {id: 'solar-terms-24', name: '二十四节气', description: '二十四节气及其日期与物候，顺序本身是考点', itemCount: 24, ordered: true, usableAsPeg: true, category: 'text', version: 2},
    {id: 'zodiac-12', name: '十二生肖', description: '十二生肖及其对应地支，顺序本身是考点', itemCount: 12, ordered: true, usableAsPeg: true, category: 'text', version: 2},
    {id: 'number-pegs-12', name: '数字桩（1-12）', description: '经典数字形象桩，1-6 号位提供多个备选桩', itemCount: 12, ordered: true, usableAsPeg: true, category: 'text'},
    {id: 'home-route-12', name: '家居路线桩（12 桩）', description: '按进门后的巡视路线排列的家居地点桩', itemCount: 12, ordered: true, usableAsPeg: true, category: 'text'},
    {id: 'constellations-12', name: '十二星座', description: '十二星座及其日期范围，顺序本身是考点', itemCount: 12, ordered: true, usableAsPeg: false, category: 'text'},
    {id: 'ethnic-groups-56', name: '五十六个民族', description: '中国 56 个民族名称', itemCount: 56, ordered: false, usableAsPeg: false, category: 'text'},
    {id: 'cuisines-8', name: '八大菜系', description: '中国八大菜系及其代表特点', itemCount: 8, ordered: false, usableAsPeg: false, category: 'text'},
    {id: 'provinces-capitals', name: '中国省级行政区及省会', description: '34 个省级行政区及其省会、首府或政府驻地', itemCount: 34, ordered: false, usableAsPeg: false, category: 'text'},
    {id: 'math-formulas', name: '常用数学公式', description: '小学到高中入门常用数学公式与函数', itemCount: 33, ordered: false, usableAsPeg: false, category: 'math', version: 4},
    {id: 'math-calculus', name: '高等数学·微积分基础', description: '极限、导数、微分、积分与级数入门 15 条', itemCount: 15, ordered: false, usableAsPeg: false, category: 'math', version: 1},
    {id: 'chemistry-formulas', name: '常用化学公式', description: '初中化学常见方程式与计算式', itemCount: 20, ordered: false, usableAsPeg: false, category: 'math'},
    {id: 'physics-formulas', name: '初中物理公式', description: '初中物理常用公式 20 条', itemCount: 20, ordered: false, usableAsPeg: false, category: 'math', version: 1},
    {id: 'physics-laws', name: '初中物理定律与原理', description: '初中物理常见定律与原理 15 条', itemCount: 15, ordered: false, usableAsPeg: false, category: 'text', version: 1},
    {id: 'physics-experiments', name: '初中物理实验', description: '初中常见物理实验 15 个', itemCount: 15, ordered: false, usableAsPeg: false, category: 'text', version: 1},
    {id: 'biology-experiments', name: '初中生物实验', description: '初中常见生物实验 15 个', itemCount: 15, ordered: false, usableAsPeg: false, category: 'text', version: 1},
    {id: 'geography-concepts', name: '初中地理核心概念', description: '初中地理核心概念 20 条', itemCount: 20, ordered: false, usableAsPeg: false, category: 'text', version: 1},
];

interface CacheData {
    timestamp: number;
    /** 写入缓存时的包数据版本（旧缓存无此字段，视为 1） */
    version?: number;
    pack: KnowledgePack;
}

/**
 * 获取包当前数据版本（元数据未显式声明时为 1）
 */
export function getPackVersion(id: string): number {
    return getKnowledgePackInfo(id)?.version ?? 1;
}

/**
 * 缓存是否可用：未过期、版本与当前包一致、数据结构合法。
 * 版本不一致（如 math-formulas 新增函数条目后老缓存缺数据）视为失效。
 */
export function isCacheUsable(data: CacheData | null, expectedVersion: number, now: number = Date.now()): boolean {
    if (!data) return false;
    if (now - data.timestamp > CACHE_EXPIRY) return false;
    if ((data.version ?? 1) !== expectedVersion) return false;
    if (!data.pack || !Array.isArray(data.pack.items) || data.pack.items.length < MIN_PACK_SIZE) return false;
    return true;
}

function buildCacheKey(id: string): string {
    return CACHE_KEY_PREFIX + id;
}

/**
 * 从 localStorage 读取缓存
 */
function getFromCache(id: string): KnowledgePack | null {
    try {
        const cached = localStorage.getItem(buildCacheKey(id));
        if (!cached) return null;

        const data: CacheData = JSON.parse(cached);
        if (!isCacheUsable(data, getPackVersion(id))) {
            localStorage.removeItem(buildCacheKey(id));
            return null;
        }
        return data.pack;
    } catch (error) {
        console.warn(`[KnowledgePack] 读取缓存失败: ${id}`, error);
        return null;
    }
}

/**
 * 写入 localStorage 缓存
 */
function saveToCache(id: string, pack: KnowledgePack): void {
    try {
        const data: CacheData = {
            timestamp: Date.now(),
            version: getPackVersion(id),
            pack,
        };
        localStorage.setItem(buildCacheKey(id), JSON.stringify(data));
    } catch (e) {
        console.warn('[KnowledgePack] 缓存失败:', e);
    }
}

function getFileName(id: string): string {
    return `${id}.json`;
}

/**
 * 从本地目录加载知识包 JSON
 */
async function loadLocalPack(id: string, timeout: number): Promise<KnowledgePack | null> {
    try {
        const fileName = getFileName(id);
        const localUrl = `${LOCAL_KNOWLEDGEBANK_PATH}${fileName}`;
        console.log(`[KnowledgePack] 加载本地知识包: ${id} from ${localUrl}`);

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(localUrl, {
            method: 'GET',
            headers: {Accept: 'application/json'},
            signal: controller.signal,
        });
        clearTimeout(timer);

        if (response.ok) {
            const data = await response.json();
            const validation = validateKnowledgePack(data);
            if (!validation.valid) {
                console.warn(`[KnowledgePack] 数据校验失败: ${id}`, validation.error);
                return null;
            }
            const pack = normalizePack(data as KnowledgePack);
            console.log(`[KnowledgePack] 成功加载 ${id}, 条目数: ${pack.items.length}`);
            return pack;
        }
        console.warn(`[KnowledgePack] 请求失败: ${response.status} ${response.statusText}`);
        return null;
    } catch (error) {
        console.warn(`[KnowledgePack] 本地加载失败: ${id}`, error);
        return null;
    }
}

/**
 * 获取知识包（优先缓存，其次本地 JSON）
 */
export async function fetchKnowledgePack(
    id: string,
    strategy: Partial<LoadStrategy> = {},
): Promise<KnowledgePack> {
    const config = {...DEFAULT_STRATEGY, ...strategy};

    if (config.useCache) {
        const cached = getFromCache(id);
        if (cached) {
            console.log(`[KnowledgePack] 使用缓存: ${id}`);
            return cached;
        }
    }

    // 并发加载同包去重
    if (inFlight.has(id)) {
        return inFlight.get(id)!;
    }

    const promise = (async (): Promise<KnowledgePack> => {
        try {
            const pack = await loadLocalPack(id, config.timeout);
            if (pack) {
                if (config.useCache) {
                    saveToCache(id, pack);
                }
                return pack;
            }

            // 若本地也失败，但有合法缓存（即使过期），仍尝试兜底使用；版本不一致的老缓存不兜底
            const staleCached = localStorage.getItem(buildCacheKey(id));
            if (staleCached) {
                try {
                    const data: CacheData = JSON.parse(staleCached);
                    if ((data.version ?? 1) !== getPackVersion(id)) {
                        console.warn(`[KnowledgePack] 过期缓存版本不一致，放弃兜底: ${id}`);
                    } else if (data.pack && Array.isArray(data.pack.items) && data.pack.items.length >= MIN_PACK_SIZE) {
                        const validation = validateKnowledgePack(data.pack);
                        if (!validation.valid) {
                            console.warn(`[KnowledgePack] 过期缓存校验失败: ${id}`, validation.error);
                            throw new Error(`[KnowledgePack] 无法加载知识包: ${id}`);
                        }
                        console.warn(`[KnowledgePack] 本地不可用，使用过期缓存: ${id}`);
                        return data.pack;
                    }
                } catch {
                    // ignore
                }
            }

            throw new Error(`[KnowledgePack] 无法加载知识包: ${id}`);
        } finally {
            inFlight.delete(id);
        }
    })();

    inFlight.set(id, promise);
    return promise;
}

/**
 * 兼容旧版的简化调用
 * @deprecated 使用新的策略对象参数
 */
export async function fetchKnowledgePackLegacy(id: string, useCache: boolean = true): Promise<KnowledgePack> {
    return fetchKnowledgePack(id, {useCache});
}

/**
 * 校验知识包 JSON 结构
 */
export function validateKnowledgePack(data: unknown): { valid: boolean; error?: string } {
    if (!data || typeof data !== 'object') {
        return {valid: false, error: '知识包不是对象'};
    }
    const pack = data as Record<string, unknown>;

    if (typeof pack.id !== 'string' || !pack.id) {
        return {valid: false, error: '缺少 id 或 id 不是字符串'};
    }
    if (typeof pack.name !== 'string' || !pack.name) {
        return {valid: false, error: '缺少 name 或 name 不是字符串'};
    }
    if (typeof pack.description !== 'string') {
        return {valid: false, error: 'description 必须是字符串'};
    }
    if (typeof pack.ordered !== 'boolean') {
        return {valid: false, error: 'ordered 必须是布尔值'};
    }
    if (typeof pack.usableAsPeg !== 'boolean') {
        return {valid: false, error: 'usableAsPeg 必须是布尔值'};
    }
    if (!Array.isArray(pack.items)) {
        return {valid: false, error: 'items 必须是数组'};
    }

    const seenIds = new Set<string>();
    for (let i = 0; i < pack.items.length; i++) {
        const item = pack.items[i];
        if (!item || typeof item !== 'object') {
            return {valid: false, error: `items[${i}] 不是对象`};
        }
        const it = item as Record<string, unknown>;
        if (typeof it.id !== 'string' || !it.id) {
            return {valid: false, error: `items[${i}] 缺少 id`};
        }
        if (typeof it.question !== 'string') {
            return {valid: false, error: `items[${i}] question 不是字符串`};
        }
        if (typeof it.answer !== 'string') {
            return {valid: false, error: `items[${i}] answer 不是字符串`};
        }
        // 备选桩名为可选字段，存在时必须是字符串数组
        if (it.alternates !== undefined) {
            if (!Array.isArray(it.alternates) || it.alternates.some(a => typeof a !== 'string')) {
                return {valid: false, error: `items[${i}] alternates 必须是字符串数组`};
            }
        }
        if (seenIds.has(it.id)) {
            return {valid: false, error: `items 中存在重复 id: ${it.id}`};
        }
        seenIds.add(it.id);
    }

    return {valid: true};
}

/**
 * 标准化知识包数据（给可选字段默认值）
 */
function normalizePack(pack: KnowledgePack): KnowledgePack {
    return {
        id: pack.id,
        name: pack.name,
        description: pack.description || '',
        ordered: !!pack.ordered,
        usableAsPeg: !!pack.usableAsPeg,
        mnemonics: Array.isArray(pack.mnemonics) ? pack.mnemonics : undefined,
        items: pack.items.map(item => ({
            id: item.id,
            question: item.question,
            answer: item.answer,
            extras: item.extras && typeof item.extras === 'object' ? item.extras : undefined,
            alternates: Array.isArray(item.alternates) ? item.alternates : undefined,
            order: typeof item.order === 'number' ? item.order : undefined,
        })),
    };
}

/**
 * 清除知识包缓存
 */
export function clearKnowledgePackCache(id?: string): void {
    if (id) {
        localStorage.removeItem(buildCacheKey(id));
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

/**
 * 获取知识包元数据
 */
export function getKnowledgePackInfo(id: string): KnowledgePackInfo | undefined {
    return KNOWLEDGE_PACK_LIST.find(p => p.id === id);
}

/**
 * 列出内置知识包元数据，可按 category 过滤（math → 数字记忆，text → 文本记忆）
 */
export function listKnowledgePacks(category?: KnowledgePackCategory): KnowledgePackInfo[] {
    return KNOWLEDGE_PACK_LIST
        .filter(p => !category || p.category === category)
        .map(p => ({...p}));
}

/**
 * 检查知识包是否已缓存
 */
export function isKnowledgePackCached(id: string): boolean {
    return getFromCache(id) !== null;
}

export default {
    fetchKnowledgePack,
    fetchKnowledgePackLegacy,
    clearKnowledgePackCache,
    getKnowledgePackInfo,
    listKnowledgePacks,
    isKnowledgePackCached,
    KNOWLEDGE_PACK_LIST,
    DEFAULT_STRATEGY,
    validateKnowledgePack,
};
