import {DB_KEY} from "@/constants";
import {getDbAdapter} from "@/adapters/db";
import {log} from "@/utils/logger";

const CLEANUP_FLAG_ID = 'slowly-record-legacy-cleanup-done';

/**
 * 逐词遗留文档的清理目标：
 * - words-list<uuid>：chunked wordbank 引入前的 per-word 存储
 * - wordbank_<时间戳>_<序号>：旧版导入内置词库时逐词落库的遗留
 *   （wordbank-service.ts 的 normalizeWords 只生成对象 _id，当前版本不落库；
 *   注意保留 wordbank_data 单文档——那是 wordbank-manager 迁移路径 1 的数据源）
 */
const LEGACY_TARGETS: Array<{ prefix: string; match?: RegExp }> = [
    { prefix: DB_KEY },
    { prefix: 'wordbank_', match: /^wordbank_\d+_\d+$/ },
];

// 防止并发清理
let _cleanupPromise: Promise<number> | null = null;

/**
 * 一次性清理：删除所有旧的逐词落库文档（见 LEGACY_TARGETS）。
 *
 * 这些文档是 chunked wordbank 引入前的遗留存储，
 * 现在词库数据已迁移到 slowly-record-wordbank-chunk-v2:* 分片文档，
 * 逐词文档不再被读取，但会持续膨胀 DB 体积、拖慢 allDocs 查询。
 *
 * 安全保证：
 * 1. 仅当 chunk 元数据已存在时才清理（说明迁移已完成或本就是新版用户）
 * 2. 每次都会先取一批遗留文档确认为空才结束（uTools allDocs 单次限 1000 条，
 *    持久化标记仅作记录，不作为跳过依据——避免旧版本只清一批就写标记导致残留）
 * 3. wordbank_data 单文档（迁移路径 1 的数据源）不在清理范围内
 * 4. 只有遗留取空且无失败才写入标记，否则下次启动重试
 *
 * 幂等：如果没有遗留文档或已清理过，函数什么都不做。
 */
export async function cleanupLegacyPerWordDocs(): Promise<number> {
    // 已在清理中，等待完成
    if (_cleanupPromise) return _cleanupPromise;

    _cleanupPromise = (async () => {
        const db = getDbAdapter();

        // 安全检查：确保 chunk 元数据已存在（说明迁移已完成或本就是新版用户）
        const metaDoc = db.get('slowly-record-wordbank-meta-v2');
        if (!metaDoc) {
            log.i('[清理遗留文档] chunk 元数据不存在，跳过清理（等待迁移完成）');
            return 0;
        }

        // uTools 的 allDocs 单次最多返回 1000 条，必须循环取批直到取空，
        // 否则上万条遗留文档只清掉一批就写标记，剩余文档永远清不掉
        let deleted = 0;
        let failed = 0;

        let allDrained = true;
        for (const target of LEGACY_TARGETS) {
            let targetDrained = false;
            for (let batch = 0; batch < 100; batch++) {
                let docs = db.allDocs(target.prefix) as Array<{ _id: string; _rev?: string }>;
                if (target.match) docs = docs.filter(d => target.match!.test(d._id));
                if (docs.length === 0) {
                    targetDrained = true;
                    break;
                }

                if (batch === 0) {
                    log.i(`[清理遗留文档] 发现遗留 ${target.prefix}* 文档，开始分批清理...`);
                }

                let batchDeleted = 0;
                for (const doc of docs) {
                    try {
                        // 传完整 doc 对象（含 _rev），确保 uTools 能正确删除
                        const result = await db.promises.remove(doc);
                        if (result.ok) {
                            deleted++;
                            batchDeleted++;
                        } else {
                            failed++;
                        }
                    } catch (e) {
                        failed++;
                    }

                    // 每 1000 个输出一次进度
                    if ((deleted + failed) % 1000 === 0) {
                        log.i(`[清理遗留文档] 进度: 已删除 ${deleted}，失败 ${failed}`);
                    }

                    // 每 50 个让出主线程一次，避免长时间阻塞 UI
                    if ((deleted + failed) % 50 === 0) {
                        await new Promise(resolve => setTimeout(resolve, 0));
                    }
                }

                // 本批一个都没删掉（如全部权限失败），跳出避免死循环，不写标记下次重试
                if (batchDeleted === 0) break;
            }
            if (!targetDrained) allDrained = false;
        }

        if (deleted > 0 || failed > 0) {
            log.i(`[清理遗留文档] 清理完成，共删除 ${deleted} 个文档，失败 ${failed} 个`);
        }

        // 只有全部遗留取空且无失败才写入标记，否则下次启动重试；
        // 不再以标记作为跳过依据——标记可能被只清了一批的旧版本误写。
        // 取空状态由循环内的空批推断，不再二次 allDocs（避免重复读取文档全文卡主线程）
        if (failed === 0 && allDrained) {
            if (!db.get(CLEANUP_FLAG_ID)) {
                await db.promises.put({ _id: CLEANUP_FLAG_ID, done: true, at: Date.now(), deleted } as any);
            }
        } else if (failed > 0 || !allDrained) {
            log.w(`[清理遗留文档] 未清空（失败 ${failed} 个），未写入完成标记，下次启动将重试`);
        }

        return deleted;
    })();

    try {
        return await _cleanupPromise;
    } finally {
        _cleanupPromise = null;
    }
}
