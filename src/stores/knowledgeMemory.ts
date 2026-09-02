/**
 * 通用知识包 Pinia store
 *
 * 负责知识包加载、练习进度统计、答题判定与 SRS 升降级。
 */

import {defineStore} from 'pinia';
import {ref, computed} from 'vue';
import type {
    KnowledgePack,
    KnowledgeItem,
    KnowledgePackProgressDoc,
    KnowledgeItemProgress,
    KnowledgePracticeMode,
    KnowledgeCustomItem,
} from '@/types/knowledge-memory';
import {fetchKnowledgePack, listKnowledgePacks} from '@/utils/knowledge-pack-service';
import type {KnowledgePackInfo} from '@/types/knowledge-memory';
import {
    getProgressDoc,
    saveProgressDoc,
    getImportedIds,
    addImportedId,
    removeImportedId,
    hasProgressDoc,
    getCustomItems,
    saveCustomItems,
} from '@/utils/knowledge-memory-db';
import {getDbAdapterAsync} from '@/adapters/db';
import {
    createDefaultProgress,
    getItemLevel,
    isDue,
    isRemembered,
    markCorrect,
    markWrong,
} from '@/utils/knowledge-memory-srs';
import {useWordsStore} from '@/stores/words';
import {log} from '@/utils/logger';

function normalizeAnswer(value: string): string {
    return value
        .toLowerCase()
        .split('')
        .map(c => {
            const code = c.charCodeAt(0);
            // 全角数字/字母统一转半角（小学生中文输入法常见场景）
            if (code >= 0xFF10 && code <= 0xFF19) return String.fromCharCode(code - 0xFEE0);
            if (code >= 0xFF21 && code <= 0xFF3A) return String.fromCharCode(code - 0xFEE0);
            if (code >= 0xFF41 && code <= 0xFF5A) return String.fromCharCode(code - 0xFEE0);
            return c;
        })
        .join('')
        .replace(/\s+/g, ' ')
        .trim();
}

function shuffleArray<T>(arr: T[]): T[] {
    const result = [...arr];
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
}

export const useKnowledgeMemoryStore = defineStore('knowledgeMemory', () => {
    // ===== State =====
    const packs = ref<Record<string, KnowledgePack>>({});
    const progress = ref<Record<string, KnowledgePackProgressDoc>>({});
    const loading = ref(false);
    const loadedSet = ref<Set<string>>(new Set());
    /** 已导入的知识包 id 列表（知识库默认空，仅展示已导入的包） */
    const importedIds = ref<string[]>([]);
    /** 已导入清单是否已从 DB 加载 */
    const importedLoaded = ref(false);
    /** 用户自建知识条目（手动/批量添加，按知识集分组） */
    const customItems = ref<KnowledgeCustomItem[]>([]);

    // ===== Getters =====
    const packList = computed<KnowledgePackInfo[]>(() => listKnowledgePacks());

    const loadedPackIds = computed(() => Array.from(loadedSet.value));

    function getPack(packId: string): KnowledgePack | undefined {
        return packs.value[packId];
    }

    function getProgress(packId: string): KnowledgePackProgressDoc {
        return (
            progress.value[packId] || {
                _id: '',
                type: 'knowledge_pack_progress',
                packId,
                items: {},
            }
        );
    }

    function getItemProgress(packId: string, itemId: string): KnowledgeItemProgress {
        const doc = getProgress(packId);
        return doc.items[itemId] || createDefaultProgress(itemId);
    }

    function isPackLoaded(packId: string): boolean {
        return loadedSet.value.has(packId);
    }

    function getTotalCount(packId: string): number {
        return getPack(packId)?.items.length ?? 0;
    }

    function getMasteredCount(packId: string): number {
        const pack = getPack(packId);
        if (!pack) return 0;
        const doc = getProgress(packId);
        return pack.items.filter(item => isRemembered(doc.items[item.id])).length;
    }

    function getDueCount(packId: string): number {
        const pack = getPack(packId);
        if (!pack) return 0;
        const doc = getProgress(packId);
        const now = Date.now();
        return pack.items.filter(item => isDue(doc.items[item.id], now)).length;
    }

    // ===== Actions =====
    /**
     * 加载知识包内容 + 进度文档
     */
    async function loadPack(packId: string): Promise<void> {
        loading.value = true;
        try {
            const [pack, doc] = await Promise.all([
                fetchKnowledgePack(packId),
                Promise.resolve(getProgressDoc(packId)),
            ]);
            packs.value[packId] = pack;
            progress.value[packId] = doc;
            loadedSet.value.add(packId);
            log.i('加载知识包', packId, pack.items.length);
        } finally {
            loading.value = false;
        }
    }

    /**
     * 强制重新加载某知识包
     */
    async function reloadPack(packId: string): Promise<void> {
        loadedSet.value.delete(packId);
        await loadPack(packId);
    }

    /**
     * 加载已导入知识包清单
     * 兼容老用户：某包已存在进度文档但不在清单中时，自动并入清单
     */
    async function loadImportedIds(): Promise<void> {
        // 非 uTools 环境需先初始化 DB 适配器
        await getDbAdapterAsync();
        const merged = new Set(getImportedIds());
        for (const info of listKnowledgePacks()) {
            if (!merged.has(info.id) && hasProgressDoc(info.id)) {
                merged.add(info.id);
                await addImportedId(info.id);
            }
        }
        importedIds.value = Array.from(merged);
        importedLoaded.value = true;
    }

    function isPackImported(packId: string): boolean {
        return importedIds.value.includes(packId);
    }

    /**
     * 导入知识包：加入清单并加载包内容
     */
    async function importPack(packId: string): Promise<void> {
        if (importedIds.value.includes(packId)) return;
        await addImportedId(packId);
        importedIds.value = [...importedIds.value, packId];
        if (!isPackLoaded(packId)) {
            try {
                await loadPack(packId);
            } catch (e) {
                log.w('导入后加载知识包失败', e);
            }
        }
    }

    /**
     * 从清单下架知识包（仅移除展示，不删进度文档，重新导入后进度恢复）
     */
    async function removeImportedPack(packId: string): Promise<void> {
        await removeImportedId(packId);
        importedIds.value = importedIds.value.filter(id => id !== packId);
    }

    /**
     * 加载自建知识条目
     */
    async function loadCustomItems(): Promise<void> {
        await getDbAdapterAsync();
        customItems.value = getCustomItems();
    }

    /**
     * 添加单条自建知识条目（文本记忆「添加/导入」对话框用）
     * 直接读 DB 追加，避免内存副本过期导致覆盖丢失
     */
    async function addCustomItem(input: {
        setName?: string;
        question: string;
        answer: string;
        tags?: string[];
    }): Promise<KnowledgeCustomItem> {
        await getDbAdapterAsync();
        const item: KnowledgeCustomItem = {
            id: `custom_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
            setName: input.setName,
            question: input.question,
            answer: input.answer,
            tags: input.tags,
            ctime: Date.now(),
        };
        const next = [...getCustomItems(), item];
        await saveCustomItems(next);
        customItems.value = next;
        return item;
    }

    /**
     * 按优先级抽取本次练习的条目
     * 1) 已到期 2) 未练过 3) 其他，组内随机
     */
    function pickItemsForSession(packId: string, count: number = 10): KnowledgeItem[] {
        const pack = getPack(packId);
        if (!pack) return [];

        const doc = getProgress(packId);
        const now = Date.now();
        const due: KnowledgeItem[] = [];
        const fresh: KnowledgeItem[] = [];
        const others: KnowledgeItem[] = [];

        for (const item of pack.items) {
            const prog = doc.items[item.id];
            if (!prog || prog.learnDate === 0) {
                fresh.push(item);
            } else if (isDue(prog, now)) {
                due.push(item);
            } else {
                others.push(item);
            }
        }

        return [...shuffleArray(due), ...shuffleArray(fresh), ...shuffleArray(others)].slice(0, Math.max(1, count));
    }

    /**
     * 获取有序包中某个条目的前一项（用于顺序回忆模式）
     */
    function getPreviousOrderedItem(packId: string, item: KnowledgeItem): KnowledgeItem | undefined {
        const pack = getPack(packId);
        if (!pack || !pack.ordered) return undefined;
        const ordered = [...pack.items].filter(i => typeof i.order === 'number').sort((a, b) => (a.order! - b.order!));
        const idx = ordered.findIndex(i => i.id === item.id);
        if (idx > 0) return ordered[idx - 1];
        return undefined;
    }

    /**
     * 答题判定
     * @returns 是否答对
     */
    function judgeAnswer(
        packId: string,
        item: KnowledgeItem,
        userAnswer: string,
        mode: KnowledgePracticeMode,
    ): boolean {
        const pack = getPack(packId);
        if (!pack) return false;

        const normalizedUser = normalizeAnswer(userAnswer);
        if (!normalizedUser) return false;

        if (mode === 'a2q') {
            return normalizedUser === normalizeAnswer(item.question);
        }
        // q2a / choice / input / ordered 均比较 answer
        return normalizedUser === normalizeAnswer(item.answer);
    }

    /**
     * 标记条目答对/答错并持久化 SRS 进度
     */
    async function markItem(
        packId: string,
        itemId: string,
        isCorrect: boolean,
        now: number = Date.now(),
    ): Promise<{ok: boolean; progress: KnowledgeItemProgress}> {
        const pack = getPack(packId);
        if (!pack) return {ok: false, progress: createDefaultProgress(itemId)};

        const doc = getProgress(packId);
        const prev = doc.items[itemId] || createDefaultProgress(itemId);
        const wordsStore = useWordsStore();
        const firmness = wordsStore.memoryFirmness ?? '正常';
        const next = isCorrect ? markCorrect(prev, now, firmness) : markWrong(prev, now);

        doc.items[itemId] = next;
        progress.value[packId] = {...doc};

        try {
            await saveProgressDoc(doc);
            return {ok: true, progress: next};
        } catch (e) {
            log.w('知识包进度保存失败', e);
            return {ok: false, progress: next};
        }
    }

    /**
     * 生成四选一干扰项（从同包其他条目的答案中抽取）
     */
    function generateChoices(
        packId: string,
        correctItem: KnowledgeItem,
        mode: KnowledgePracticeMode,
        optionCount: number = 4,
    ): string[] {
        const pack = getPack(packId);
        const correctRaw = mode === 'a2q' ? correctItem.question : correctItem.answer;
        if (!pack) return [correctRaw];

        const correctNormalized = normalizeAnswer(correctRaw);

        const pool = pack.items
            .filter(i => i.id !== correctItem.id)
            .map(i => (mode === 'a2q' ? i.question : i.answer))
            .filter(v => v && normalizeAnswer(v) !== correctNormalized);

        // 按归一化文本去重，保留原始展示文本（如乘法表多个算式归一化后都是 12）
        const seen = new Set<string>([correctNormalized]);
        const deduped: string[] = [];
        for (const v of pool) {
            const n = normalizeAnswer(v);
            if (!seen.has(n)) {
                seen.add(n);
                deduped.push(v);
            }
        }

        const shuffled = shuffleArray(deduped);
        const options = [correctRaw, ...shuffled.slice(0, optionCount - 1)];
        return shuffleArray(options);
    }

    /**
     * 清空某知识包进度（内存 + DB）
     */
    async function resetPackProgress(packId: string): Promise<void> {
        const doc: KnowledgePackProgressDoc = {
            _id: '',
            type: 'knowledge_pack_progress',
            packId,
            items: {},
        };
        progress.value[packId] = {...doc};
        try {
            const existing = getProgressDoc(packId);
            if (existing._rev) {
                await saveProgressDoc({...doc, _id: existing._id, _rev: existing._rev});
            }
        } catch (e) {
            log.w('重置知识包进度失败', e);
        }
    }

    return {
        // state
        packs,
        progress,
        loading,
        loadedSet,
        importedIds,
        importedLoaded,
        customItems,
        // getters
        packList,
        loadedPackIds,
        getPack,
        getProgress,
        getItemProgress,
        isPackLoaded,
        isPackImported,
        getTotalCount,
        getMasteredCount,
        getDueCount,
        // actions
        loadPack,
        reloadPack,
        loadImportedIds,
        importPack,
        removeImportedPack,
        loadCustomItems,
        addCustomItem,
        pickItemsForSession,
        getPreviousOrderedItem,
        judgeAnswer,
        markItem,
        generateChoices,
        resetPackProgress,
    };
});
