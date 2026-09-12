import {DB_KEY} from "@/constants";
import {getDbAdapter} from "@/adapters/db";
import {log} from "@/utils/logger";

const CLEANUP_FLAG_ID = 'slowly-record-legacy-cleanup-done';

// 防止并发清理
let _cleanupPromise: Promise<number> | null = null;

/**
 * 一次性清理：删除所有旧的 per-word 文档（words-list<uuid>）。
 *
 * 这些文档是 chunked wordbank 引入前的遗留存储，
 * 现在词库数据已迁移到 slowly-record-wordbank-chunk-v2:* 分片文档，
 * per-word 文档不再被读取，但会持续膨胀 DB 体积。
 *
 * 安全保证：
 * 1. 仅当 chunk 元数据已存在时才清理（说明迁移已完成或本就是新版用户）
 * 2. 使用持久化标记确保只运行一次
 * 3. 只有全部删除成功才写入标记，否则下次启动重试
 *
 * 幂等：如果没有遗留文档或已清理过，函数什么都不做。
 */
export async function cleanupLegacyPerWordDocs(): Promise<number> {
    // 已在清理中，等待完成
    if (_cleanupPromise) return _cleanupPromise;

    _cleanupPromise = (async () => {
        const db = getDbAdapter();

        // 检查持久化标记：如果已清理过，直接返回
        if (db.get(CLEANUP_FLAG_ID)) {
            return 0;
        }

        // 安全检查：确保 chunk 元数据已存在（说明迁移已完成或本就是新版用户）
        const metaDoc = db.get('slowly-record-wordbank-meta-v2');
        if (!metaDoc) {
            log.i('[清理遗留文档] chunk 元数据不存在，跳过清理（等待迁移完成）');
            return 0;
        }

        const allDocs = db.allDocs(DB_KEY) as Array<{ _id: string; _rev?: string }>;

        if (allDocs.length === 0) {
            // 没有遗留文档，写入标记
            await db.promises.put({ _id: CLEANUP_FLAG_ID, done: true, at: Date.now() } as any);
            return 0;
        }

        log.i(`[清理遗留文档] 发现 ${allDocs.length} 个 words-list_* 文档，开始清理...`);

        let deleted = 0;
        let failed = 0;
        const BATCH_SIZE = 50;

        for (let i = 0; i < allDocs.length; i++) {
            try {
                // 传完整 doc 对象（含 _rev），确保 uTools 能正确删除
                const result = await db.promises.remove(allDocs[i]);
                if (result.ok) {
                    deleted++;
                } else {
                    failed++;
                }
            } catch (e) {
                failed++;
            }

            // 每 1000 个输出一次进度
            if ((i + 1) % 1000 === 0) {
                log.i(`[清理遗留文档] 进度: ${i + 1}/${allDocs.length}, 已删除 ${deleted}`);
            }

            // 每 BATCH_SIZE 个让出主线程一次，避免长时间阻塞 UI
            if ((i + 1) % BATCH_SIZE === 0) {
                await new Promise(resolve => setTimeout(resolve, 0));
            }
        }

        log.i(`[清理遗留文档] 清理完成，共删除 ${deleted} 个文档，失败 ${failed} 个`);

        // 只有全部删除成功才写入标记，否则下次启动重试
        if (failed === 0) {
            await db.promises.put({ _id: CLEANUP_FLAG_ID, done: true, at: Date.now(), deleted } as any);
        } else {
            log.w(`[清理遗留文档] 有 ${failed} 个文档删除失败，未写入完成标记，下次启动将重试`);
        }

        return deleted;
    })();

    try {
        return await _cleanupPromise;
    } finally {
        _cleanupPromise = null;
    }
}
