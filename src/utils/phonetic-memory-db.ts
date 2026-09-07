/**
 * 音标学习进度持久化
 *
 * 数据规模很小(48 音素 + 60-100 对子,每项几十字节),
 * 用单文档存储所有进度,避免 allDocs 扫描开销。
 *
 * 进度按语言隔离：doc id = phonetic_memory_progress:{lang}，
 * 旧数据（无后缀，即英语）自动兼容读取。
 */
import type {PhoneticProgressDoc} from '@/types/phonetic-memory';
import {DB_KEY_PHONETIC_MEMORY} from '@/constants';
import {getDbAdapter} from '@/adapters/db';
import {log} from '@/utils/logger';

/** 旧版（英语无后缀）文档 id，读取兜底用 */
const LEGACY_DOC_ID = DB_KEY_PHONETIC_MEMORY + 'progress';

function docIdOf(lang: string): string {
    return lang === 'en' ? LEGACY_DOC_ID : `${LEGACY_DOC_ID}:${lang}`;
}

function normalize(doc: any, id: string): PhoneticProgressDoc {
    if (doc && typeof doc === 'object') {
        return {
            _id: doc._id || id,
            _rev: doc._rev,
            phonemes: doc.phonemes || {},
            pairs: doc.pairs || {},
        };
    }
    return {_id: id, phonemes: {}, pairs: {}};
}

export function getProgressDoc(lang: string = 'en'): PhoneticProgressDoc {
    const id = docIdOf(lang);
    const doc = getDbAdapter().get(id) as PhoneticProgressDoc | undefined;
    return normalize(doc, id);
}

export async function saveProgressDoc(doc: PhoneticProgressDoc, lang: string = 'en'): Promise<void> {
    const id = docIdOf(lang);
    try {
        const result = await getDbAdapter().promises.put({...doc, _id: id});
        if (result.ok && result.rev) {
            doc._rev = result.rev;
        }
    } catch (e) {
        log.w?.('音标进度持久化失败', e);
    }
}
