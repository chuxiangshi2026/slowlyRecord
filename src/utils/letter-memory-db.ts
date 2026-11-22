import type { LetterImageAssociation, LetterMemoryTraining, LetterTrainingResult, LetterTrainingProgress } from "@/types/letter-memory";
import { log } from "@/utils/logger";
import cloneDeep from "lodash.clonedeep";
import { DB_KEY_LETTER_MEMORY } from "@/constants";
import { getDbAdapter } from "@/adapters/db";
import { externalizeMappingImages, hasInlineMappingImages, removeMappingImageRef, resolveMappingImages } from "@/utils/mapping-image-store";
import { isStoreLocalOnly } from "@/adapters/local-bulk-store";

const DB_KEY_PREFIX = DB_KEY_LETTER_MEMORY;
const TRAINING_KEY = DB_KEY_PREFIX + 'training';
const RESULT_KEY_PREFIX = DB_KEY_PREFIX + 'result_';
const PROGRESS_KEY = DB_KEY_PREFIX + 'progress';

// 获取数据库适配器
function getDb() {
  return getDbAdapter();
}

// 基础 CouchDB 文档类型
interface BaseCouchDoc {
  _id: string;
  _rev?: string;
  type: string;
  createdAt?: number;
}

/** 商店版旧数据迁移：内联 dataURL 图片落本机大体积存储，文档改写为 bulk: 引用 */
function migrateInlineImagesAsync(doc: LetterMemoryTraining): void {
  if (!isStoreLocalOnly() || !hasInlineMappingImages(doc.associations)) return;
  void (async () => {
    const cleaned = cloneDeep(doc);
    cleaned.associations = await externalizeMappingImages(cleaned.associations || [], 'letter', (a) => a.letter);
    const result = await getDb().promises.put(cleaned);
    if (result?.ok) log.i('[字母记忆] 已将同步库中的映射图片迁移到本机存储');
  })().catch(() => { /* 下次读取时重试 */ });
}

/**
 * 获取用户的字母映射训练数据
 * 商店版：associations 中的 bulk: 图片引用在此还原为 dataURL，业务层无感
 */
export function getLetterMemoryTraining(): LetterMemoryTraining | null {
  const allDocs = getDb().allDocs(DB_KEY_PREFIX) as BaseCouchDoc[];
  const training = allDocs.find((doc) => doc.type === 'letter_memory_training') as LetterMemoryTraining | undefined;
  if (!training) return null;
  migrateInlineImagesAsync(training);
  if (!isStoreLocalOnly()) return training;
  return {...training, associations: resolveMappingImages(cloneDeep(training.associations || []))};
}

/**
 * 获取所有字母-图片关联
 */
export function getAllAssociations(): LetterImageAssociation[] {
  const training = getLetterMemoryTraining();
  return training?.associations || [];
}

/**
 * 获取单个字母的图片关联
 */
export function getAssociationByLetter(letter: string): LetterImageAssociation | undefined {
  const associations = getAllAssociations();
  return associations.find(a => a.letter === letter);
}

/**
 * 保存或更新字母-图片关联
 */
export async function saveAssociation(association: LetterImageAssociation): Promise<DbReturn> {
  log.i('保存字母图片关联', association);

  let training = getLetterMemoryTraining();
  const now = Date.now();

  if (!training) {
    training = {
      _id: TRAINING_KEY + Date.now(),
      type: 'letter_memory_training',
      associations: [association],
      createdAt: now,
      updatedAt: now
    };
  } else {
    const existingIndex = training.associations.findIndex(a => a.letter === association.letter);
    if (existingIndex >= 0) {
      training.associations[existingIndex] = association;
    } else {
      training.associations.push(association);
    }
    training.updatedAt = now;
  }

  const cleanedData = cloneDeep(training);
  if (training._rev) {
    cleanedData._rev = training._rev;
  }
  // 商店版：图片本体落本机存储，文档只留 bulk: 引用（不进随账号同步的数据）
  cleanedData.associations = await externalizeMappingImages(cleanedData.associations || [], 'letter', (a) => a.letter);

  const result = await getDb().promises.put(cleanedData);

  if (result.ok) {
    log.d('保存字母图片关联成功');
    training._rev = result.rev;
  } else if (result.error) {
    log.e('保存字母图片关联失败', result.message);
  }

  return result;
}

/**
 * 删除字母-图片关联
 */
export async function removeAssociation(letter: string): Promise<DbReturn> {
  log.i('删除字母图片关联', letter);

  const training = getLetterMemoryTraining();
  if (!training) {
    return { ok: true, id: '', rev: '' };
  }

  training.associations = training.associations.filter(a => a.letter !== letter);
  training.updatedAt = Date.now();

  const cleanedData = cloneDeep(training);
  if (training._rev) {
    cleanedData._rev = training._rev;
  }
  // 商店版：保持文档引用形态，并连带清理被删关联的本机图片
  cleanedData.associations = await externalizeMappingImages(cleanedData.associations || [], 'letter', (a) => a.letter);
  await removeMappingImageRef('letter', letter);

  const result = await getDb().promises.put(cleanedData);

  if (result.ok) {
    log.d('删除字母图片关联成功');
    training._rev = result.rev;
  } else if (result.error) {
    log.e('删除字母图片关联失败', result.message);
  }

  return result;
}

/**
 * 保存训练结果（只保留最近三条）
 */
export async function saveTrainingResult(result: Omit<LetterTrainingResult, '_id'>): Promise<DbReturn> {
  log.i('保存字母训练结果', result);

  const resultDoc: LetterTrainingResult = {
    ...result,
    _id: RESULT_KEY_PREFIX + Date.now()
  };

  const cleanedData = cloneDeep(resultDoc);
  const dbResult = await getDb().promises.put(cleanedData);

  if (dbResult.ok) {
    log.d('保存字母训练结果成功');
    cleanupOldTrainingResults(3);
  } else if (dbResult.error) {
    log.e('保存字母训练结果失败', dbResult.message);
  }

  return dbResult;
}

/**
 * 清理旧的训练结果，只保留最近 N 条
 */
function cleanupOldTrainingResults(keepCount: number): void {
  const allDocs = getDb().allDocs(RESULT_KEY_PREFIX) as BaseCouchDoc[];
  const results = allDocs
    .filter((doc): doc is LetterTrainingResult => doc.type === 'letter_memory_result')
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));

  if (results.length > keepCount) {
    const toDelete = results.slice(keepCount);
    toDelete.forEach((doc) => {
      try {
        getDb().remove(doc._id);
      } catch (error) {
        log.e(`删除字母训练结果异常: ${doc._id}`, error);
      }
    });
  }
}

/**
 * 获取所有训练结果
 */
export function getAllTrainingResults(): LetterTrainingResult[] {
  const allDocs = getDb().allDocs(RESULT_KEY_PREFIX) as BaseCouchDoc[];
  return allDocs
    .filter((doc): doc is LetterTrainingResult => doc.type === 'letter_memory_result')
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
}

/**
 * 清空所有训练结果
 */
export function clearAllTrainingResults(): void {
  const allDocs = getDb().allDocs(RESULT_KEY_PREFIX) as BaseCouchDoc[];
  allDocs.forEach((doc) => {
    if (doc.type === 'letter_memory_result') {
      try {
        getDb().remove(doc._id);
      } catch (error) {
        log.e(`删除字母训练结果异常: ${doc._id}`, error);
      }
    }
  });
}

/**
 * 保存训练进度
 */
export async function saveTrainingProgress(progress: LetterTrainingProgress): Promise<DbReturn> {
  const cleanedData = cloneDeep(progress);
  return await getDb().promises.put(cleanedData);
}

/**
 * 获取训练进度
 */
export function getTrainingProgress(): LetterTrainingProgress | null {
  try {
    const doc = getDb().get(PROGRESS_KEY);
    if (!doc || typeof doc !== 'object' || doc.type !== 'letter_memory_progress') {
      return null;
    }
    return doc as LetterTrainingProgress;
  } catch (error) {
    log.e('获取字母训练进度失败', error);
    return null;
  }
}

/**
 * 清除训练进度
 */
export function clearTrainingProgress(): void {
  try {
    const doc = getDb().get(PROGRESS_KEY);
    if (doc?._id) {
      getDb().remove(doc._id);
    }
  } catch (error) {
    log.e('清除字母训练进度异常', error);
  }
}
