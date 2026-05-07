import type {NumberImageAssociation, NumberMemoryTraining, TrainingResult, TrainingProgress} from "@/types/number-memory";
import {log} from "@/utils/logger";
import cloneDeep from "lodash.clonedeep";
import {DB_KEY_NUMBER_MEMORY} from "@/constants";
import {getDbAdapter} from "@/adapters/db";

const DB_KEY_PREFIX = DB_KEY_NUMBER_MEMORY;
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

/**
 * 获取用户的数字记忆训练数据
 * @returns 数字记忆训练记录
 */
export function getNumberMemoryTraining(): NumberMemoryTraining | null {
  const allDocs = getDb().allDocs(DB_KEY_PREFIX) as BaseCouchDoc[];
  const training = allDocs.find((doc) => doc.type === 'number_memory_training');
  return training as NumberMemoryTraining || null;
}

/**
 * 获取所有数字-图片关联
 * @returns 数字图片关联数组
 */
export function getAllAssociations(): NumberImageAssociation[] {
  const training = getNumberMemoryTraining();
  return training?.associations || [];
}

/**
 * 获取单个数字的图片关联
 * @param number 数字
 * @returns 数字图片关联
 */
export function getAssociationByNumber(number: string): NumberImageAssociation | undefined {
  const associations = getAllAssociations();
  return associations.find(a => a.number === number);
}

/**
 * 保存或更新数字-图片关联
 * @param association 数字图片关联
 * @returns 保存结果
 */
export async function saveAssociation(association: NumberImageAssociation): Promise<DbReturn> {
  log.i('保存数字图片关联', association);

  let training = getNumberMemoryTraining();
  const now = Date.now();

  if (!training) {
    // 创建新的训练记录
    training = {
      _id: TRAINING_KEY + Date.now(),
      type: 'number_memory_training',
      associations: [association],
      createdAt: now,
      updatedAt: now
    };
  } else {
    // 更新现有记录
    const existingIndex = training.associations.findIndex(a => a.number === association.number);
    if (existingIndex >= 0) {
      training.associations[existingIndex] = association;
    } else {
      training.associations.push(association);
    }
    training.updatedAt = now;
  }

  // 必须带上 _rev 才能正确更新已有文档
  const cleanedData = cloneDeep(training);
  if (training._rev) {
    cleanedData._rev = training._rev;
  }

  const result = await getDb().promises.put(cleanedData);

  if (result.ok) {
    log.d('保存数字图片关联成功');
    training._rev = result.rev;
  } else if (result.error) {
    log.e('保存数字图片关联失败', result.message);
  }

  return result;
}

/**
 * 删除数字-图片关联
 * @param number 要删除的数字
 * @returns 删除结果
 */
export async function removeAssociation(number: string): Promise<DbReturn> {
  log.i('删除数字图片关联', number);

  const training = getNumberMemoryTraining();
  if (!training) {
    return {ok: true, id: '', rev: ''};
  }

  training.associations = training.associations.filter(a => a.number !== number);
  training.updatedAt = Date.now();

  const cleanedData = cloneDeep(training);
  if (training._rev) {
    cleanedData._rev = training._rev;
  }

  const result = await getDb().promises.put(cleanedData);

  if (result.ok) {
    log.d('删除数字图片关联成功');
    training._rev = result.rev;
  } else if (result.error) {
    log.e('删除数字图片关联失败', result.message);
  }

  return result;
}

/**
 * 保存训练结果（只保留最近三条）
 * @param result 训练结果
 * @returns 保存结果
 */
export async function saveTrainingResult(result: Omit<TrainingResult, '_id'>): Promise<DbReturn> {
  log.i('保存训练结果', result);

  const resultDoc: TrainingResult = {
    ...result,
    _id: RESULT_KEY_PREFIX + Date.now()
  };

  const cleanedData = cloneDeep(resultDoc);
  const dbResult = await getDb().promises.put(cleanedData);

  if (dbResult.ok) {
    log.d('保存训练结果成功');
    // 清理旧记录，只保留最近 3 条
    cleanupOldTrainingResults(3);
  } else if (dbResult.error) {
    log.e('保存训练结果失败', dbResult.message);
  }

  return dbResult;
}

/**
 * 清理旧的训练结果，只保留最近 N 条
 */
function cleanupOldTrainingResults(keepCount: number): void {
  const allDocs = getDb().allDocs(RESULT_KEY_PREFIX) as BaseCouchDoc[];
  const results = allDocs
    .filter((doc): doc is TrainingResult => doc.type === 'number_memory_result')
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));

  if (results.length > keepCount) {
    const toDelete = results.slice(keepCount);
    let successCount = 0;
    let failCount = 0;

    toDelete.forEach((doc) => {
      try {
        const result = getDb().remove(doc._id);
        if (result.ok) {
          successCount++;
        } else {
          failCount++;
          log.w(`删除训练结果失败: ${doc._id}`, result.message);
        }
      } catch (error) {
        failCount++;
        log.e(`删除训练结果异常: ${doc._id}`, error);
      }
    });

    log.i(`清理训练结果: 成功 ${successCount} 条, 失败 ${failCount} 条, 保留最近 ${keepCount} 条`);
  }
}

/**
 * 获取所有训练结果
 * @returns 训练结果列表
 */
export function getAllTrainingResults(): TrainingResult[] {
  const allDocs = getDb().allDocs(RESULT_KEY_PREFIX) as BaseCouchDoc[];
  return allDocs
    .filter((doc): doc is TrainingResult => doc.type === 'number_memory_result')
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
}

/**
 * 清空所有训练结果
 */
export function clearAllTrainingResults(): void {
  const allDocs = getDb().allDocs(RESULT_KEY_PREFIX) as BaseCouchDoc[];
  let failCount = 0;
  allDocs.forEach((doc) => {
    if (doc.type === 'number_memory_result') {
      try {
        const result = getDb().remove(doc._id);
        if (!result.ok) {
          failCount++;
          log.w(`删除训练结果失败: ${doc._id}`, result.message);
        }
      } catch (error) {
        failCount++;
        log.e(`删除训练结果异常: ${doc._id}`, error);
      }
    }
  });
  log.i('已清空所有训练结果' + (failCount > 0 ? `, ${failCount} 条失败` : ''));
}

/**
 * 保存训练进度（断点续练）
 * @param progress 训练进度
 * @returns 保存结果
 */
export async function saveTrainingProgress(progress: TrainingProgress): Promise<DbReturn> {
  log.i('保存训练进度', progress);

  const cleanedData = cloneDeep(progress);
  const result = await getDb().promises.put(cleanedData);

  if (result.ok) {
    log.d('保存训练进度成功');
  } else if (result.error) {
    log.e('保存训练进度失败', result.message);
  }

  return result;
}

/**
 * 获取训练进度
 * @returns 训练进度或 null
 */
export function getTrainingProgress(): TrainingProgress | null {
  try {
    const doc = getDb().get(PROGRESS_KEY);
    if (!doc || typeof doc !== 'object' || doc.type !== 'number_memory_progress') {
      return null;
    }
    return doc as TrainingProgress;
  } catch (error) {
    log.e('获取训练进度失败', error);
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
      const result = getDb().remove(doc._id);
      if (result.ok) {
        log.i('已清除训练进度');
      } else {
        log.w('清除训练进度失败', result.message);
      }
    }
  } catch (error) {
    log.e('清除训练进度异常', error);
  }
}

/**
 * 清空所有数字记忆数据
 */
export function clearAllNumberMemoryData(): void {
  const allDocs = getDb().allDocs(DB_KEY_PREFIX) as BaseCouchDoc[];
  let failCount = 0;
  allDocs.forEach((doc) => {
    try {
      const result = getDb().remove(doc._id);
      if (!result.ok) {
        failCount++;
        log.w(`删除数据失败: ${doc._id}`, result.message);
      }
    } catch (error) {
      failCount++;
      log.e(`删除数据异常: ${doc._id}`, error);
    }
  });
  log.i('已清空所有数字记忆数据' + (failCount > 0 ? `, ${failCount} 条失败` : ''));
}
