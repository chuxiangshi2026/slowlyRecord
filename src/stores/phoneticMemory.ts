/**
 * 音标学习 Pinia store
 *
 * 复用全局 DEFAULT_INTERVALS(分钟单位)做艾宾浩斯间隔,
 * 每个音素 / 对子独立跟踪 level + learnDate,
 * 答对升级、答错降级,到期可复习。
 */
import {defineStore} from 'pinia';
import {ref, computed} from 'vue';
import {DEFAULT_INTERVALS} from '@/constants';
import {ALL_PHONEMES} from '@/utils/phoneme-data';
import {getProgressDoc, saveProgressDoc} from '@/utils/phonetic-memory-db';
import type {PhonemeProgress, MinimalPairProgress, PhoneticProgressDoc} from '@/types/phonetic-memory';

/** level >= 7 视为已掌握,与单词 store 的约定一致 */
const MASTERED_LEVEL = 7;
/** level 0-12,对应 DEFAULT_INTERVALS 的下标 */
const MAX_LEVEL = Math.min(12, DEFAULT_INTERVALS.length - 1);

function clampLevel(level: number): number {
    if (level < 0) return 0;
    if (level > MAX_LEVEL) return MAX_LEVEL;
    return level;
}

function isDue(item: {level: number; learnDate: number}, now: number): boolean {
    if (!item.learnDate) return true;
    const intervalMs = (DEFAULT_INTERVALS[item.level] ?? DEFAULT_INTERVALS[0]) * 60 * 1000;
    return now - item.learnDate >= intervalMs;
}

export const usePhoneticMemoryStore = defineStore('phoneticMemory', () => {
    const doc = ref<PhoneticProgressDoc>({_id: '', phonemes: {}, pairs: {}});
    const loaded = ref(false);

    /** 加载持久化进度,幂等 */
    async function ensureLoaded(): Promise<void> {
        if (loaded.value) return;
        try {
            doc.value = getProgressDoc();
        } catch {
            doc.value = {_id: '', phonemes: {}, pairs: {}};
        }
        loaded.value = true;
    }

    // ===== 统计 =====
    const masteredCount = computed(() =>
        Object.values(doc.value.phonemes).filter(p => p.level >= MASTERED_LEVEL).length,
    );

    const dueCount = computed(() => {
        const now = Date.now();
        let count = 0;
        for (const ph of ALL_PHONEMES) {
            const prog = doc.value.phonemes[ph.ipa];
            // 没学过 或 到期 都算待练习
            if (!prog || isDue(prog, now)) count++;
        }
        return count;
    });

    // ===== 音素进度 =====
    function getPhonemeProgress(ipa: string): PhonemeProgress | undefined {
        return doc.value.phonemes[ipa];
    }

    /**
     * 按优先级抽 N 个音素出题:
     * 1) 已练过且到期(isReview)
     * 2) 没练过(level=0 且无 learnDate)
     * 3) 都不够再从全部里随机补
     */
    function pickPhonemesForSession(count: number): typeof ALL_PHONEMES {
        const now = Date.now();
        const due: typeof ALL_PHONEMES = [];
        const fresh: typeof ALL_PHONEMES = [];
        const others: typeof ALL_PHONEMES = [];
        for (const ph of ALL_PHONEMES) {
            const prog = doc.value.phonemes[ph.ipa];
            if (!prog) {
                fresh.push(ph);
            } else if (isDue(prog, now)) {
                due.push(ph);
            } else {
                others.push(ph);
            }
        }
        // 在各组内打散,避免同分组扎堆
        shuffle(due);
        shuffle(fresh);
        shuffle(others);
        const result = [...due, ...fresh, ...others].slice(0, count);
        return result;
    }

    async function markPhoneme(ipa: string, isCorrect: boolean): Promise<void> {
        await ensureLoaded();
        const prev = doc.value.phonemes[ipa] || {
            ipa,
            level: 0,
            learnDate: 0,
            correct: 0,
            wrong: 0,
        };
        const next: PhonemeProgress = {
            ipa,
            level: clampLevel(prev.level + (isCorrect ? 1 : -1)),
            learnDate: Date.now(),
            correct: prev.correct + (isCorrect ? 1 : 0),
            wrong: prev.wrong + (isCorrect ? 0 : 1),
        };
        doc.value.phonemes[ipa] = next;
        await saveProgressDoc(doc.value);
    }

    // ===== 对子进度 =====
    function pairKeyOf(a: string, b: string): string {
        return a < b ? `${a}|${b}` : `${b}|${a}`;
    }

    function getPairProgress(a: string, b: string): MinimalPairProgress | undefined {
        return doc.value.pairs[pairKeyOf(a, b)];
    }

    async function markPair(a: string, b: string, isCorrect: boolean): Promise<void> {
        await ensureLoaded();
        const key = pairKeyOf(a, b);
        const prev = doc.value.pairs[key] || {
            pairKey: key,
            level: 0,
            learnDate: 0,
            correct: 0,
            wrong: 0,
        };
        doc.value.pairs[key] = {
            pairKey: key,
            level: clampLevel(prev.level + (isCorrect ? 1 : -1)),
            learnDate: Date.now(),
            correct: prev.correct + (isCorrect ? 1 : 0),
            wrong: prev.wrong + (isCorrect ? 0 : 1),
        };
        await saveProgressDoc(doc.value);
    }

    /** 从对子列表里按优先级抽 count 个出题 */
    function pickPairsForSession<T extends {a: string; b: string}>(pool: T[], count: number): T[] {
        const now = Date.now();
        const due: T[] = [];
        const fresh: T[] = [];
        const others: T[] = [];
        for (const p of pool) {
            const prog = doc.value.pairs[pairKeyOf(p.a, p.b)];
            if (!prog) fresh.push(p);
            else if (isDue(prog, now)) due.push(p);
            else others.push(p);
        }
        shuffle(due);
        shuffle(fresh);
        shuffle(others);
        return [...due, ...fresh, ...others].slice(0, count);
    }

    return {
        // state(只读暴露)
        doc,
        loaded,
        // 统计
        masteredCount,
        dueCount,
        MASTERED_LEVEL,
        MAX_LEVEL,
        // actions
        ensureLoaded,
        getPhonemeProgress,
        pickPhonemesForSession,
        markPhoneme,
        getPairProgress,
        pickPairsForSession,
        markPair,
    };
});

function shuffle<T>(arr: T[]): void {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
}
