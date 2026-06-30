import type {
  ShortcutTrainingRecord,
  ShortcutLearningProgress,
  ShortcutItem,
  CustomCategoryDoc
} from "@/types/shortcut-memory";
import { log } from "@/utils/logger";
import cloneDeep from "lodash.clonedeep";
import { DB_KEY_SHORTCUT_MEMORY } from "@/constants";
import {getDbAdapter} from "@/adapters/db";
import { nextIdTimestamp } from "@/utils/id-util";

const DB_KEY_PREFIX = DB_KEY_SHORTCUT_MEMORY;
const RECORD_KEY_PREFIX = DB_KEY_PREFIX + 'record_';
const PROGRESS_KEY_PREFIX = DB_KEY_PREFIX + 'progress_';
const CUSTOM_KEY_PREFIX = DB_KEY_PREFIX + 'custom_';
const CUSTOM_CATEGORY_PREFIX = DB_KEY_PREFIX + 'category_';
const HIDDEN_CATEGORY_KEY = DB_KEY_PREFIX + 'hidden_categories';

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
 * 获取所有训练记录
 */
export function getAllTrainingRecords(): ShortcutTrainingRecord[] {
  const allDocs = getDb().allDocs(RECORD_KEY_PREFIX) as BaseCouchDoc[];
  return allDocs
    .filter((doc): doc is ShortcutTrainingRecord => doc.type === 'shortcut_training_record')
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
}

/**
 * 保存训练记录
 */
export async function saveTrainingRecord(
  record: Omit<ShortcutTrainingRecord, '_id'>
): Promise<DbReturn> {
  log.i('保存快捷键训练记录', record);

  const resultDoc: ShortcutTrainingRecord = {
    ...record,
    _id: RECORD_KEY_PREFIX + nextIdTimestamp()
  };

  const cleanedData = cloneDeep(resultDoc);
  const dbResult = await getDb().promises.put(cleanedData);

  if (dbResult.ok) {
    log.d('保存快捷键训练记录成功');
  } else if (dbResult.error) {
    log.e('保存快捷键训练记录失败', dbResult.message);
  }

  return dbResult;
}

/**
 * 获取学习进度
 */
export function getLearningProgress(category: string): ShortcutLearningProgress | null {
  const allDocs = getDb().allDocs(PROGRESS_KEY_PREFIX) as BaseCouchDoc[];
  const progress = allDocs.find(
    (doc): doc is ShortcutLearningProgress => doc.type === 'shortcut_learning_progress' && (doc as ShortcutLearningProgress).category === category
  );
  return progress || null;
}

/**
 * 保存或更新学习进度
 */
export async function saveLearningProgress(
  category: string,
  masteredItemIds: string[]
): Promise<DbReturn> {
  log.i('保存快捷键学习进度', category, masteredItemIds.length);

  const existing = getLearningProgress(category);
  const now = Date.now();

  let progress: ShortcutLearningProgress;

  if (!existing) {
    progress = {
      _id: PROGRESS_KEY_PREFIX + category + '_' + Date.now(),
      type: 'shortcut_learning_progress',
      category,
      masteredItemIds: [...new Set(masteredItemIds)],
      createdAt: now,
      updatedAt: now
    };
  } else {
    progress = {
      ...existing,
      masteredItemIds: [...new Set([...existing.masteredItemIds, ...masteredItemIds])],
      updatedAt: now
    };
  }

  const cleanedData = cloneDeep(progress);
  const result = await getDb().promises.put(cleanedData);

  if (result.ok) {
    log.d('保存快捷键学习进度成功');
    progress._rev = result.rev;
  } else if (result.error) {
    log.e('保存快捷键学习进度失败', result.message);
  }

  return result;
}

/**
 * 清除某分类的学习进度
 */
export async function clearLearningProgress(category: string): Promise<DbReturn> {
  const existing = getLearningProgress(category);
  if (!existing) {
    return { ok: true, id: '', rev: '' };
  }

  const result = getDb().remove(existing._id);
  log.i('清除快捷键学习进度', category, result.ok);
  return result;
}

/**
 * 获取所有自定义快捷键
 */
export function getAllCustomShortcuts(): ShortcutItem[] {
  const allDocs = getDb().allDocs(CUSTOM_KEY_PREFIX) as BaseCouchDoc[];
  return allDocs
    .filter((doc): doc is ShortcutItem & BaseCouchDoc => doc.type === 'shortcut_custom_item')
    .map((doc) => ({
      id: doc.id,
      category: doc.category,
      functionName: doc.functionName,
      description: doc.description,
      keys: doc.keys,
      platform: doc.platform || 'common'
    }));
}

/**
 * 保存自定义快捷键
 */
export async function saveCustomShortcut(item: ShortcutItem): Promise<DbReturn> {
  log.i('保存自定义快捷键', item);

  const doc = {
    _id: CUSTOM_KEY_PREFIX + item.id,
    type: 'shortcut_custom_item',
    ...item,
    updatedAt: Date.now()
  };

  const cleanedData = cloneDeep(doc);
  const result = await getDb().promises.put(cleanedData);

  if (result.ok) {
    log.d('保存自定义快捷键成功');
  } else if (result.error) {
    log.e('保存自定义快捷键失败', result.message);
  }

  return result;
}

/**
 * 删除自定义快捷键
 */
export function removeCustomShortcut(id: string): DbReturn {
  log.i('删除自定义快捷键', id);
  const result = getDb().remove(CUSTOM_KEY_PREFIX + id);
  if (result.ok) {
    log.d('删除自定义快捷键成功');
  } else if (result.error) {
    log.e('删除自定义快捷键失败', result.message);
  }
  return result;
}

/**
 * 获取所有自定义分类
 */
export function getAllCustomCategories(): CustomCategoryDoc[] {
  const allDocs = getDb().allDocs(CUSTOM_CATEGORY_PREFIX) as BaseCouchDoc[];
  return allDocs
    .filter((doc): doc is CustomCategoryDoc => doc.type === 'shortcut_custom_category')
    .map((doc) => ({
      _id: doc._id,
      _rev: doc._rev,
      type: doc.type,
      name: doc.name,
      description: doc.description,
      icon: doc.icon
    }));
}

/**
 * 保存自定义分类
 */
export async function saveCustomCategory(
  category: Omit<CustomCategoryDoc, '_id' | 'type'> & { _id?: string; type?: string }
): Promise<DbReturn> {
  // 输入验证
  if (!category.name?.trim()) {
    return { ok: false, error: true, message: '分类名称不能为空', id: '', rev: '' };
  }

  if (category.name.length > 50) {
    return { ok: false, error: true, message: '分类名称不能超过50个字符', id: '', rev: '' };
  }

  log.i('保存自定义分类', category.name);

  const doc = {
    _id: category._id || (CUSTOM_CATEGORY_PREFIX + Date.now()),
    type: 'shortcut_custom_category',
    name: category.name,
    description: category.description,
    icon: category.icon,
    updatedAt: Date.now()
  };

  const cleanedData = cloneDeep(doc);
  const result = await getDb().promises.put(cleanedData);

  if (result.ok) {
    log.d('保存自定义分类成功');
  } else if (result.error) {
    log.e('保存自定义分类失败', result.message);
  }

  return result;
}

/**
 * 删除自定义分类及其下的所有快捷键
 */
export function removeCustomCategory(name: string): DbReturn {
  log.i('删除自定义分类', name);

  const allCats = getAllCustomCategories();
  const cat = allCats.find(c => c.name === name);
  if (!cat) {
    return { ok: true, id: '', rev: '' };
  }

  const result = getDb().remove(cat._id);
  if (result.ok) {
    log.d('删除自定义分类成功');
  } else if (result.error) {
    log.e('删除自定义分类失败', result.message);
    return result;
  }

  // 删除该分类下的所有快捷键
  const allShortcuts = getAllCustomShortcuts();
  allShortcuts.filter(s => s.category === name).forEach(s => {
    removeCustomShortcut(s.id);
  });

  return result;
}

/**
 * 更新自定义快捷键
 */
export async function updateCustomShortcut(item: ShortcutItem): Promise<DbReturn> {
  log.i('更新自定义快捷键', item.id);

  const doc = {
    _id: CUSTOM_KEY_PREFIX + item.id,
    type: 'shortcut_custom_item',
    ...item,
    updatedAt: Date.now()
  };

  const cleanedData = cloneDeep(doc);
  const result = await getDb().promises.put(cleanedData);

  if (result.ok) {
    log.d('更新自定义快捷键成功');
  } else if (result.error) {
    log.e('更新自定义快捷键失败', result.message);
  }

  return result;
}

/**
 * 清空所有快捷键记忆数据
 */
export function clearAllShortcutMemoryData(): void {
  const allDocs = getDb().allDocs(DB_KEY_PREFIX) as BaseCouchDoc[];
  allDocs.forEach((doc) => {
    getDb().remove(doc._id);
  });
  log.i('已清空所有快捷键记忆数据');
}

/**
 * 获取隐藏的示例分类列表
 */
export function getHiddenCategories(): string[] {
  const doc = getDb().get(HIDDEN_CATEGORY_KEY);
  return doc?.categories || [];
}

/**
 * 隐藏示例分类
 */
export function hideCategory(name: string): void {
  try {
    const hidden = getHiddenCategories();
    if (!hidden.includes(name)) {
      hidden.push(name);
      const existing = getDb().get(HIDDEN_CATEGORY_KEY);
      const result = getDb().put({
        _id: HIDDEN_CATEGORY_KEY,
        _rev: existing?._rev,
        categories: hidden,
        updatedAt: Date.now()
      });

      if (result.ok) {
        log.i('隐藏分类', name);
      } else {
        log.e('隐藏分类失败', result.message);
      }
    }
  } catch (error) {
    log.e('隐藏分类异常', error);
  }
}

/**
 * 恢复隐藏的示例分类
 */
export function unhideCategory(name: string): void {
  const hidden = getHiddenCategories();
  const index = hidden.indexOf(name);
  if (index > -1) {
    hidden.splice(index, 1);
    const doc = getDb().get(HIDDEN_CATEGORY_KEY);
    if (doc) {
      getDb().put({
        _id: HIDDEN_CATEGORY_KEY,
        _rev: doc._rev,
        categories: hidden,
        updatedAt: Date.now()
      });
    }
    log.i('恢复隐藏分类', name);
  }
}
