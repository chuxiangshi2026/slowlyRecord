/**
 * 记忆宫殿 DB 存取层
 *
 * 存储结构：
 * - `memory_palace_palaces`：单文档，palaces 数组存所有宫殿
 * - `memory_palace_pegs_<palaceId>`：每个宫殿一个文档，items 存该宫殿的桩挂载
 */
import cloneDeep from 'lodash.clonedeep';
import {DB_KEY_MEMORY_PALACE} from '@/constants';
import {getDbAdapter, type DbReturn} from '@/adapters/db';
import {log} from '@/utils/logger';
import type {Palace, PalaceListDoc, PegItem, PegListDoc} from '@/types/memory-palace';

// 宫殿列表文档键
const PALACES_KEY = DB_KEY_MEMORY_PALACE + 'palaces';
// 桩挂载文档键前缀
const PEGS_KEY_PREFIX = DB_KEY_MEMORY_PALACE + 'pegs_';

function getDb() {
  return getDbAdapter();
}

/** 生成桩挂载文档键 */
export function getPegsKey(palaceId: string): string {
  return PEGS_KEY_PREFIX + palaceId;
}

/**
 * 获取宫殿列表文档（不存在时返回默认空文档）
 */
export function getPalacesDoc(): PalaceListDoc {
  const doc = getDb().get<PalaceListDoc>(PALACES_KEY);
  if (doc && doc.type === 'memory_palace_palaces' && Array.isArray(doc.palaces)) {
    return doc as PalaceListDoc;
  }
  return {
    _id: PALACES_KEY,
    type: 'memory_palace_palaces',
    palaces: [],
    updatedAt: Date.now(),
  };
}

/**
 * 获取所有宫殿
 */
export function getAllPalaces(): Palace[] {
  return getPalacesDoc().palaces;
}

/**
 * 按 id 获取宫殿
 */
export function getPalaceById(palaceId: string): Palace | null {
  return getAllPalaces().find(p => p._id === palaceId) || null;
}

/**
 * 保存（新建或更新）宫殿
 */
export async function savePalace(palace: Palace): Promise<DbReturn> {
  const doc = getPalacesDoc();
  const index = doc.palaces.findIndex(p => p._id === palace._id);
  const cleaned = cloneDeep(palace);
  if (index >= 0) {
    doc.palaces[index] = cleaned;
  } else {
    doc.palaces.push(cleaned);
  }
  doc.updatedAt = Date.now();

  const result = await getDb().promises.put(cloneDeep(doc));
  if (result.ok) {
    log.d('保存宫殿成功', palace._id);
  } else if (result.error) {
    log.e('保存宫殿失败', result.message);
  }
  return result;
}

/**
 * 删除宫殿（同时删除其桩挂载文档；不级联删文本记忆文章）
 */
export async function removePalace(palaceId: string): Promise<DbReturn> {
  const doc = getPalacesDoc();
  doc.palaces = doc.palaces.filter(p => p._id !== palaceId);
  doc.updatedAt = Date.now();

  const result = await getDb().promises.put(cloneDeep(doc));
  if (!result.ok) {
    log.e('删除宫殿失败', result.message);
    return result;
  }

  // 删除对应的桩挂载文档
  try {
    const pegsDoc = getDb().get<PegListDoc>(getPegsKey(palaceId));
    if (pegsDoc) {
      getDb().remove(pegsDoc._id);
    }
  } catch (error) {
    log.e('删除宫殿桩挂载失败', error);
  }
  return result;
}

/**
 * 获取宫殿的桩挂载文档（不存在时返回默认空文档）
 */
export function getPegsDoc(palaceId: string): PegListDoc {
  const doc = getDb().get<PegListDoc>(getPegsKey(palaceId));
  if (doc && doc.type === 'memory_palace_pegs' && Array.isArray(doc.items)) {
    return doc as PegListDoc;
  }
  return {
    _id: getPegsKey(palaceId),
    type: 'memory_palace_pegs',
    palaceId,
    items: [],
    updatedAt: Date.now(),
  };
}

/**
 * 获取宫殿的所有桩挂载（按桩顺序排序）
 */
export function getPegsByPalace(palaceId: string): PegItem[] {
  return [...getPegsDoc(palaceId).items].sort((a, b) => a.locusOrder - b.locusOrder);
}

/**
 * 宫殿已挂载数量
 */
export function getMountedCount(palaceId: string): number {
  return getPegsDoc(palaceId).items.length;
}

/**
 * 保存（新建或更新）单个桩挂载
 * 同一宫殿同一桩（locusOrder）只允许一个挂载，重复保存会覆盖
 */
export async function savePegItem(item: PegItem): Promise<DbReturn> {
  const doc = getPegsDoc(item.palaceId);
  const index = doc.items.findIndex(i => i._id === item._id);
  const cleaned = cloneDeep(item);
  if (index >= 0) {
    doc.items[index] = cleaned;
  } else {
    // 同桩已有挂载时覆盖（一桩一挂载）
    const sameLocus = doc.items.findIndex(i => i.locusOrder === item.locusOrder);
    if (sameLocus >= 0) {
      doc.items[sameLocus] = cleaned;
    } else {
      doc.items.push(cleaned);
    }
  }
  doc.updatedAt = Date.now();

  const result = await getDb().promises.put(cloneDeep(doc));
  if (result.ok) {
    log.d('保存桩挂载成功', item._id);
  } else if (result.error) {
    log.e('保存桩挂载失败', result.message);
  }
  return result;
}

/**
 * 批量保存桩挂载（用于文章切块一次性挂载）
 */
export async function savePegItems(items: PegItem[]): Promise<DbReturn> {
  if (items.length === 0) {
    return {ok: true, id: '', rev: ''};
  }
  const palaceId = items[0].palaceId;
  const doc = getPegsDoc(palaceId);
  for (const item of items) {
    const index = doc.items.findIndex(i => i._id === item._id || i.locusOrder === item.locusOrder);
    if (index >= 0) {
      doc.items[index] = cloneDeep(item);
    } else {
      doc.items.push(cloneDeep(item));
    }
  }
  doc.updatedAt = Date.now();

  const result = await getDb().promises.put(cloneDeep(doc));
  if (!result.ok && result.error) {
    log.e('批量保存桩挂载失败', result.message);
  }
  return result;
}

/**
 * 删除单个桩挂载
 */
export async function removePegItem(palaceId: string, pegId: string): Promise<DbReturn> {
  const doc = getPegsDoc(palaceId);
  doc.items = doc.items.filter(i => i._id !== pegId);
  doc.updatedAt = Date.now();

  const result = await getDb().promises.put(cloneDeep(doc));
  if (!result.ok && result.error) {
    log.e('删除桩挂载失败', result.message);
  }
  return result;
}
