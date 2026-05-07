import type {Word} from "@/types/words";
import {log} from "@/utils/logger";
import cloneDeep from 'lodash.clonedeep';
import {DB_KEY_DICTATION} from "@/constants";
import {getDbAdapter} from "@/adapters/db";
import type { WordBankType } from "./wordbank-service";

const DB_KEY_PREFIX = DB_KEY_DICTATION;

/**
 * 听写进度接口
 */
export interface DictationProgress {
  _id: string;
  _rev?: string;
  type: 'dictation_progress';
  wordList: Word[];
  currentIndex: number;
  stats: { correct: number; wrong: number };
  wrongWords: Word[];
  errorCountMap: Record<number, number>;
  wordBank: string;
  wordCount: number;
  displayMode: 'blank' | 'partial';
  options: string[];
  updatedAt: number;
}

/**
 * 错题记录接口
 */
export interface WrongWordsRecord {
  _id: string;
  _rev?: string;
  type: 'wrong_words_record';
  wordBank: string;
  wrongWords: Word[];
  totalCount: number;
  updatedAt: number;
}

/**
 * 获取进度键名（按词库）
 */
function getProgressKey(wordBank: string): string {
  return `${DB_KEY_PREFIX}progress_${wordBank}`;
}

/**
 * 获取保存的听写进度
 * @param wordBank 词库类型（不传则返回所有进度中的第一个）
 * @returns 听写进度或null
 */
export function getDictationProgress(wordBank?: string): DictationProgress | null {
  try {
    const db = getDbAdapter();
    const allDocs = db.allDocs(DB_KEY_PREFIX);

    // 如果指定了词库，查找对应进度
    if (wordBank) {
      const progress = allDocs.find((doc: any) =>
        doc.type === 'dictation_progress' && doc.wordBank === wordBank
      );
      if (!progress) return null;
      if (isProgressExpired(progress)) {
        removeDictationProgress(progress._id);
        return null;
      }
      return progress as DictationProgress;
    }

    // 未指定词库，返回第一个有效进度
    const progress = allDocs.find((doc: any) => doc.type === 'dictation_progress');
    if (!progress) return null;
    if (isProgressExpired(progress)) {
      removeDictationProgress(progress._id);
      return null;
    }
    return progress as DictationProgress;
  } catch (error) {
    log.e('获取听写进度失败', error);
    return null;
  }
}

/**
 * 检查进度是否过期
 */
function isProgressExpired(progress: any): boolean {
  const oneWeek = 7 * 24 * 60 * 60 * 1000;
  return Date.now() - progress.updatedAt > oneWeek;
}

/**
 * 检查指定词库是否有有效的进度
 * @param wordBank 词库类型
 * @returns 是否有进度
 */
export function hasDictationProgress(wordBank?: string): boolean {
  return getDictationProgress(wordBank) !== null;
}

/**
 * 保存听写进度
 * @param progress 进度数据（不包含_id和_rev）
 * @returns 保存结果
 */
export async function saveDictationProgress(
  progress: Omit<DictationProgress, '_id' | '_rev' | 'type' | 'updatedAt'>
): Promise<DbReturn> {
  try {
    // 获取现有进度（如果有）
    const existing = getDictationProgress(progress.wordBank);

    const progressDoc: DictationProgress = {
      ...progress,
      _id: existing?._id || getProgressKey(progress.wordBank),
      _rev: existing?._rev,
      type: 'dictation_progress',
      updatedAt: Date.now()
    };

    log.i('保存听写进度', progressDoc);

    const cleanedData = cloneDeep(progressDoc);
    const db = getDbAdapter();
    const result = await db.promises.put(cleanedData);

    if (result.ok) {
      log.d('保存听写进度成功');
      progressDoc._rev = result.rev;
    } else if (result.error) {
      log.e('保存听写进度失败', result.message);
    }

    return result;
  } catch (error) {
    log.e('保存听写进度异常', error);
    return {ok: false, id: '', rev: '', error: true, message: String(error)};
  }
}

/**
 * 删除听写进度
 * @param idOrWordBank 文档ID或词库名称（可选，默认删除所有进度）
 */
export function removeDictationProgress(idOrWordBank?: string): void {
  try {
    const db = getDbAdapter();
    if (!idOrWordBank) {
      // 删除所有听写进度
      const allDocs = db.allDocs(DB_KEY_PREFIX);
      allDocs.forEach((doc: any) => {
        if (doc.type === 'dictation_progress') {
          db.remove(doc._id);
        }
      });
      log.d('清除所有听写进度');
      return;
    }

    // 如果是词库名称，查找对应进度
    const progress = getDictationProgress(idOrWordBank);
    if (progress) {
      db.remove(progress._id);
      log.d(`删除词库 ${idOrWordBank} 的听写进度`);
    }
  } catch (error) {
    log.e('删除听写进度失败', error);
  }
}

// ==================== 错题记录功能 ====================

/**
 * 获取错题记录键名
 */
function getWrongWordsKey(wordBank: string): string {
  return `${DB_KEY_PREFIX}wrong_${wordBank}`;
}

/**
 * 获取错题记录
 * @param wordBank 词库类型
 * @returns 错题记录或null
 */
export function getWrongWordsRecord(wordBank: string): WrongWordsRecord | null {
  try {
    const db = getDbAdapter();
    const allDocs = db.allDocs(DB_KEY_PREFIX);
    const record = allDocs.find((doc: any) =>
      doc.type === 'wrong_words_record' && doc.wordBank === wordBank
    );
    return record as WrongWordsRecord || null;
  } catch (error) {
    log.e('获取错题记录失败', error);
    return null;
  }
}

/**
 * 保存错题记录
 * @param wordBank 词库类型
 * @param wrongWords 错题列表
 */
export async function saveWrongWords(wordBank: string, wrongWords: Word[]): Promise<DbReturn> {
  try {
    const existing = getWrongWordsRecord(wordBank);

    // 合并错题，去重
    const mergedWords = existing
      ? [...existing.wrongWords, ...wrongWords].filter((word, index, self) =>
          index === self.findIndex(w => w.text === word.text)
        )
      : wrongWords;

    const record: WrongWordsRecord = {
      _id: existing?._id || getWrongWordsKey(wordBank),
      _rev: existing?._rev,
      type: 'wrong_words_record',
      wordBank,
      wrongWords: mergedWords,
      totalCount: mergedWords.length,
      updatedAt: Date.now()
    };

    log.i('保存错题记录', record);

    const cleanedData = cloneDeep(record);
    const db = getDbAdapter();
    const result = await db.promises.put(cleanedData);

    if (result.ok) {
      log.d('保存错题记录成功');
    } else if (result.error) {
      log.e('保存错题记录失败', result.message);
    }

    return result;
  } catch (error) {
    log.e('保存错题记录异常', error);
    return {ok: false, id: '', rev: '', error: true, message: String(error)};
  }
}

/**
 * 清空指定词库的错题
 * @param wordBank 词库类型
 */
export function clearWrongWords(wordBank: string): void {
  try {
    const record = getWrongWordsRecord(wordBank);
    if (record) {
      const db = getDbAdapter();
      db.remove(record._id);
      log.d(`清空词库 ${wordBank} 的错题记录`);
    }
  } catch (error) {
    log.e('清空错题记录失败', error);
  }
}

/**
 * 获取所有有错题的词库列表
 * @returns 词库名称列表
 */
export function getWrongWordsBanks(): string[] {
  try {
    const db = getDbAdapter();
    const allDocs = db.allDocs(DB_KEY_PREFIX);
    return allDocs
      .filter((doc: any) => doc.type === 'wrong_words_record' && doc.wrongWords?.length > 0)
      .map((doc: any) => doc.wordBank);
  } catch (error) {
    log.e('获取错题词库列表失败', error);
    return [];
  }
}

/**
 * 清除过期的听写进度
 */
export function cleanExpiredProgress(): void {
  try {
    const db = getDbAdapter();
    const allDocs = db.allDocs(DB_KEY_PREFIX);
    const oneWeek = 7 * 24 * 60 * 60 * 1000;
    const now = Date.now();

    allDocs.forEach((doc: any) => {
      if (doc.type === 'dictation_progress' && now - doc.updatedAt > oneWeek) {
        db.remove(doc._id);
        log.i('清除过期听写进度', doc._id);
      }
    });
  } catch (error) {
    log.e('清理过期进度失败', error);
  }
}
