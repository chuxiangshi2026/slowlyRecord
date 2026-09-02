/**
 * 通用知识包进度持久化
 *
 * 每个知识包一条 CouchDB 文档，存储该包所有条目的 SRS 进度。
 */

import type {KnowledgePackProgressDoc, KnowledgeItemProgress, KnowledgeImportedDoc, KnowledgeCustomItemsDoc, KnowledgeCustomItem} from '@/types/knowledge-memory';
import {DB_KEY_KNOWLEDGE_MEMORY} from '@/constants';
import {getDbAdapter} from '@/adapters/db';
import {log} from '@/utils/logger';
import {createDefaultProgress} from '@/utils/knowledge-memory-srs';

/** 已导入知识包清单文档 ID */
export const IMPORTED_LIST_DOC_ID = 'knowledge_memory_imported';

function progressDocId(packId: string): string {
    return DB_KEY_KNOWLEDGE_MEMORY + packId;
}

/**
 * 读取某知识包的进度文档
 * 旧数据或缺项时自动补全默认进度（不修改原 DB，仅内存兜底）
 */
export function getProgressDoc(packId: string): KnowledgePackProgressDoc {
    const id = progressDocId(packId);
    const doc = getDbAdapter().get(id) as KnowledgePackProgressDoc | undefined;
    if (doc && typeof doc === 'object') {
        return {
            _id: doc._id || id,
            _rev: doc._rev,
            type: 'knowledge_pack_progress',
            packId,
            items: doc.items && typeof doc.items === 'object' ? doc.items : {},
        };
    }
    return {
        _id: id,
        type: 'knowledge_pack_progress',
        packId,
        items: {},
    };
}

/**
 * 保存某知识包的进度文档
 */
export async function saveProgressDoc(doc: KnowledgePackProgressDoc): Promise<void> {
    try {
        const result = await getDbAdapter().promises.put({...doc, _id: progressDocId(doc.packId)});
        if (result.ok && result.rev) {
            doc._rev = result.rev;
        }
    } catch (e) {
        log.w?.('知识包进度持久化失败', e);
    }
}

/**
 * 获取某条目的进度（不存在则返回默认进度）
 */
export function getItemProgress(
    packId: string,
    itemId: string,
): KnowledgeItemProgress {
    const doc = getProgressDoc(packId);
    return doc.items[itemId] || createDefaultProgress(itemId);
}

/**
 * 更新某条目的进度并持久化
 */
export async function updateItemProgress(
    packId: string,
    itemId: string,
    progress: KnowledgeItemProgress,
): Promise<void> {
    const doc = getProgressDoc(packId);
    doc.items[itemId] = progress;
    await saveProgressDoc(doc);
}

/**
 * 清空某知识包的全部进度
 */
export async function clearProgressDoc(packId: string): Promise<void> {
    try {
        const doc = getProgressDoc(packId);
        if (doc._rev) {
            await getDbAdapter().promises.remove(doc._id);
        }
    } catch (e) {
        log.w?.('清空知识包进度失败', e);
    }
}

/**
 * 判断某知识包是否已存在进度文档（用于兼容老用户：有进度即视为已导入）
 */
export function hasProgressDoc(packId: string): boolean {
    const doc = getDbAdapter().get(progressDocId(packId));
    return !!(doc && doc._rev);
}

/**
 * 读取已导入知识包清单（无文档时返回空数组）
 */
export function getImportedIds(): string[] {
    const doc = getDbAdapter().get(IMPORTED_LIST_DOC_ID) as KnowledgeImportedDoc | null;
    if (doc && Array.isArray(doc.ids)) {
        return [...doc.ids];
    }
    return [];
}

/**
 * 保存已导入知识包清单
 */
async function saveImportedIds(ids: string[]): Promise<void> {
    try {
        const existing = getDbAdapter().get(IMPORTED_LIST_DOC_ID) as KnowledgeImportedDoc | null;
        await getDbAdapter().promises.put({
            _id: IMPORTED_LIST_DOC_ID,
            _rev: existing?._rev,
            type: 'knowledge_imported_list',
            ids,
        });
    } catch (e) {
        log.w?.('已导入知识包清单持久化失败', e);
    }
}

/**
 * 将知识包加入已导入清单（幂等）
 */
export async function addImportedId(packId: string): Promise<void> {
    const ids = getImportedIds();
    if (ids.includes(packId)) return;
    ids.push(packId);
    await saveImportedIds(ids);
}

/**
 * 将知识包从已导入清单移除（仅下架，不删进度文档）
 */
export async function removeImportedId(packId: string): Promise<void> {
    const ids = getImportedIds();
    const next = ids.filter(id => id !== packId);
    if (next.length === ids.length) return;
    await saveImportedIds(next);
}

/** 自建知识条目文档 ID */
export const CUSTOM_ITEMS_DOC_ID = 'knowledge_custom_items';

/**
 * 读取全部自建知识条目（无文档时返回空数组）
 */
export function getCustomItems(): KnowledgeCustomItem[] {
    const doc = getDbAdapter().get(CUSTOM_ITEMS_DOC_ID) as KnowledgeCustomItemsDoc | null;
    if (doc && Array.isArray(doc.items)) {
        return [...doc.items];
    }
    return [];
}

/**
 * 删除单条自建知识条目（单文档覆盖写模式沿用 saveCustomItems）
 * @returns 被删除的条目，不存在时返回 undefined
 */
export async function removeCustomItem(itemId: string): Promise<KnowledgeCustomItem | undefined> {
    const items = getCustomItems();
    const target = items.find(i => i.id === itemId);
    if (!target) return undefined;
    await saveCustomItems(items.filter(i => i.id !== itemId));
    return target;
}

/**
 * 保存全部自建知识条目（单文档整体覆盖）
 * 与进度文档不同：写入失败时抛错，让调用方（添加条目流程）能感知并提示
 */
export async function saveCustomItems(items: KnowledgeCustomItem[]): Promise<void> {
    try {
        const existing = getDbAdapter().get(CUSTOM_ITEMS_DOC_ID) as KnowledgeCustomItemsDoc | null;
        await getDbAdapter().promises.put({
            _id: CUSTOM_ITEMS_DOC_ID,
            _rev: existing?._rev,
            type: 'knowledge_custom_items',
            items,
        });
    } catch (e) {
        log.w?.('自建知识条目持久化失败', e);
        throw e;
    }
}
