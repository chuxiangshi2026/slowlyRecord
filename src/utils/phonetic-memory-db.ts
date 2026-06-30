/**
 * 音标学习进度持久化
 *
 * 数据规模很小(48 音素 + 60-100 对子,每项几十字节),
 * 用单文档存储所有进度,避免 allDocs 扫描开销。
 */
import type {PhoneticProgressDoc} from '@/types/phonetic-memory';
import {DB_KEY_PHONETIC_MEMORY} from '@/constants';
import {getDbAdapter} from '@/adapters/db';
import {log} from '@/utils/logger';

const PROGRESS_DOC_ID = DB_KEY_PHONETIC_MEMORY + 'progress';

export function getProgressDoc(): PhoneticProgressDoc {
    const doc = getDbAdapter().get(PROGRESS_DOC_ID) as PhoneticProgressDoc | undefined;
    if (doc && typeof doc === 'object') {
        return {
            _id: doc._id || PROGRESS_DOC_ID,
            _rev: doc._rev,
            phonemes: doc.phonemes || {},
            pairs: doc.pairs || {},
        };
    }
    return {_id: PROGRESS_DOC_ID, phonemes: {}, pairs: {}};
}

export async function saveProgressDoc(doc: PhoneticProgressDoc): Promise<void> {
    try {
        const result = await getDbAdapter().promises.put({...doc, _id: PROGRESS_DOC_ID});
        if (result.ok && result.rev) {
            doc._rev = result.rev;
        }
    } catch (e) {
        log.w?.('音标进度持久化失败', e);
    }
}
