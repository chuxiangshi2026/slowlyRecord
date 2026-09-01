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
} from '@/types/knowledge-memory';
import {fetchKnowledgePack, listKnowledgePacks} from '@/utils/knowledge-pack-service';
import type {KnowledgePackInfo} from '@/types/knowledge-memory';
import {getProgressDoc, saveProgressDoc} from '@/utils/knowledge-memory-db';
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
        if (!pack) return [mode === 'a2q' ? correctItem.question : correctItem.answer];

        const pool = pack.items
            .filter(i => i.id !== correctItem.id)
            .map(i => (mode === 'a2q' ? i.question : i.answer))
            .filter(v => v && normalizeAnswer(v) !== normalizeAnswer(mode === 'a2q' ? correctItem.question : correctItem.answer));

        const shuffled = shuffleArray(pool);
        const options = [
            mode === 'a2q' ? correctItem.question : correctItem.answer,
            ...shuffled.slice(0, optionCount - 1),
        ];
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
        // getters
        packList,
        loadedPackIds,
        getPack,
        getProgress,
        getItemProgress,
        isPackLoaded,
        getTotalCount,
        getMasteredCount,
        getDueCount,
        // actions
        loadPack,
        reloadPack,
        pickItemsForSession,
        getPreviousOrderedItem,
        judgeAnswer,
        markItem,
        generateChoices,
        resetPackProgress,
    };
});
