/**
 * 句子库数据存取层
 * 沿用单文档模式（同 textMemory），整个句子库存为一个 DB 文档
 */
import { getDbAdapter } from '@/adapters/db';
import type { Sentence } from '@/types/sentences';

export const SENTENCES_DOC_ID = 'slowlyrecord-sentences-data';

export interface SentencesDoc {
  _id: string;
  _rev?: string;
  type: 'sentences';
  sentences: Sentence[];
  updatedAt: number;
}

/**
 * 读取句子库文档
 */
export async function loadSentencesDoc(): Promise<SentencesDoc | null> {
  try {
    const db = getDbAdapter();
    const doc = await db.promises.get(SENTENCES_DOC_ID) as SentencesDoc | null;
    return doc;
  } catch (e) {
    console.error('获取句子库文档失败:', e);
    return null;
  }
}

/**
 * 保存句子列表（整库覆盖写，保留 _rev）
 */
export async function saveSentences(sentences: Sentence[]): Promise<{ success: boolean; error?: string }> {
  try {
    const db = getDbAdapter();
    const existingDoc = await loadSentencesDoc();
    const doc: SentencesDoc = {
      _id: SENTENCES_DOC_ID,
      type: 'sentences',
      sentences,
      updatedAt: Date.now()
    };
    if (existingDoc?._rev) {
      doc._rev = existingDoc._rev;
    }
    const result = await db.promises.put(doc);
    // 兼容不同适配器返回值：uTools 可能直接返回 { id, rev }（无 ok/error）
    if (result.ok === true) return { success: true };
    if (result.error === true) {
      return { success: false, error: result.message || result.name || '保存失败' };
    }
    return { success: result.ok !== false };
  } catch (e) {
    console.error('保存句子库失败:', e);
    return { success: false, error: String(e) };
  }
}
