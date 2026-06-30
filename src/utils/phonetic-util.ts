/**
 * 音标工具
 *
 * 历史 Word.phonetic 字段存在多种脏数据：
 *   - 空字符串（多数翻译引擎不返回音标）
 *   - URL（早期把发音 URL 误写入了 phonetic）
 *   - 与原文相同（getSimplePhonetic 占位实现的退化结果）
 * 这里集中处理：判断有效性 + 从本地词库懒补全 + 写回 DB。
 *
 * 懒补全策略：使用 ensurePhonetic(word)，仅在展示该单词时调用，
 * 避免一次性扫全表造成长时间阻塞。
 */
import type { Word } from '@/types/words';
import { queryLocalDictionaryAsync, queryLocalDictionary } from './local-dictionary';
import { useWordsStore } from '@/stores/words';
import { log } from './logger';

// 单次会话内查不到的单词不再重复打本地词库（本地词库覆盖率有限，避免反复扫描）
const failedLookup = new Set<string>();
const inflight = new Map<string, Promise<string>>();

/**
 * 判断一个 phonetic 字段是否"有效可展示"
 */
export function isValidPhonetic(phonetic: string | undefined, wordText?: string): boolean {
    if (!phonetic) return false;
    const trimmed = phonetic.trim();
    if (!trimmed) return false;
    if (/^https?:\/\//i.test(trimmed)) return false;
    if (wordText && trimmed.toLowerCase() === wordText.trim().toLowerCase()) return false;
    return true;
}

/**
 * 同步查本地词库的音标，首次词库未加载时可能返回空（不会触发持久化）
 */
export function lookupPhoneticSync(text: string): string {
    const key = (text || '').trim().toLowerCase();
    if (!key || failedLookup.has(key)) return '';
    try {
        const entry = queryLocalDictionary(text);
        return entry?.phonetic?.trim() || '';
    } catch {
        return '';
    }
}

/**
 * 异步查本地词库的音标，带 inflight 去重和失败缓存
 */
export async function lookupPhonetic(text: string): Promise<string> {
    const key = (text || '').trim().toLowerCase();
    if (!key) return '';
    if (failedLookup.has(key)) return '';
    const existing = inflight.get(key);
    if (existing) return existing;
    const task = (async () => {
        try {
            const entry = await queryLocalDictionaryAsync(text);
            const phonetic = entry?.phonetic?.trim() || '';
            if (!phonetic) failedLookup.add(key);
            return phonetic;
        } catch (e) {
            log.w?.('查询本地词库音标失败', text, e);
            failedLookup.add(key);
            return '';
        } finally {
            inflight.delete(key);
        }
    })();
    inflight.set(key, task);
    return task;
}

/**
 * 若 word.phonetic 无效，从本地词库懒补全并持久化。
 * 返回最终可展示的音标字符串（可能为空）。
 */
export async function ensurePhonetic(word: Word | null | undefined): Promise<string> {
    if (!word || !word.text) return '';
    if (isValidPhonetic(word.phonetic, word.text)) return word.phonetic!;
    const phonetic = await lookupPhonetic(word.text);
    if (!phonetic) return '';
    word.phonetic = phonetic;
    try {
        const wordsStore = useWordsStore();
        const inStore = wordsStore.words.find(w => w._id === word._id);
        if (inStore) inStore.phonetic = phonetic;
        await wordsStore.addAndUpdateWord(inStore || word);
    } catch (e) {
        log.w?.('懒补全音标持久化失败', word.text, e);
    }
    return phonetic;
}
