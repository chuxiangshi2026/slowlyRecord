/**
 * 记忆宫殿 DB 存取层
 *
 * 存储结构：
 * - `memory_palace_palaces`：单文档，palaces 数组存所有宫殿（**不含桩图片 dataURL**）
 * - `memory_palace_images_<palaceId>`：每个宫殿一个文档，单独存桩图片 dataURL
 * - `memory_palace_pegs_<palaceId>`：每个宫殿一个文档，items 存该宫殿的桩挂载
 *
 * 设计原因：uTools db 单文档上限约 1MB，桩图片集中存放易超限，故拆出图片文档。
 * 图片文档仍有上限，超过阈值时拒绝保存并提示用户减少图片或改用文字描述。
 */
import cloneDeep from 'lodash.clonedeep';
import {DB_KEY_MEMORY_PALACE} from '@/constants';
import {getDbAdapter, type DbReturn} from '@/adapters/db';
import {log} from '@/utils/logger';
import type {Palace, PalaceImagesDoc, PalaceListDoc, PegItem, PegListDoc} from '@/types/memory-palace';

// 宫殿列表文档键
const PALACES_KEY = DB_KEY_MEMORY_PALACE + 'palaces';
// 桩图片文档键前缀
const IMAGES_KEY_PREFIX = DB_KEY_MEMORY_PALACE + 'images_';
// 桩挂载文档键前缀
const PEGS_KEY_PREFIX = DB_KEY_MEMORY_PALACE + 'pegs_';

// 图片文档体积阈值（uTools 单文档上限约 1MB，留 200KB 余量）
const MAX_IMAGES_DOC_BYTES = 800 * 1024;

function getDb() {
  return getDbAdapter();
}

/** 生成桩图片文档键 */
export function getImagesKey(palaceId: string): string {
  return IMAGES_KEY_PREFIX + palaceId;
}

/** 生成桩挂载文档键 */
export function getPegsKey(palaceId: string): string {
  return PEGS_KEY_PREFIX + palaceId;
}

/** 判断字符串是否为 dataURL */
function isDataUrl(value: string | undefined): boolean {
  return typeof value === 'string' && value.startsWith('data:');
}

/** 估算文档字节数（dataURL 长度 ≈ 体积） */
function estimateDocBytes(doc: object): number {
  return JSON.stringify(doc).length;
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
 * 获取宫殿的桩图片文档（不存在时返回默认空文档）
 */
export function getPalaceImagesDoc(palaceId: string): PalaceImagesDoc {
  const key = getImagesKey(palaceId);
  const doc = getDb().get<PalaceImagesDoc>(key);
  if (doc && doc.type === 'memory_palace_images' && doc.images && typeof doc.images === 'object') {
    return doc as PalaceImagesDoc;
  }
  return {
    _id: key,
    type: 'memory_palace_images',
    palaceId,
    images: {},
    updatedAt: Date.now(),
  };
}

/**
 * 从宫殿主文档提取桩图片（保存前调用）
 * 返回清理后的宫殿（loci 中不再含 dataURL）与图片映射
 */
export function extractImagesFromPalace(palace: Palace): {palace: Palace; images: Record<string, string>} {
  const images: Record<string, string> = {};
  const cleaned = cloneDeep(palace);
  for (const locus of cleaned.loci) {
    if (isDataUrl(locus.imageUrl)) {
      images[locus.order.toString()] = locus.imageUrl!;
    }
    delete locus.imageUrl;
  }
  return {palace: cleaned, images};
}

/**
 * 同步保存桩图片文档（读取时惰性迁移用）
 */
function savePalaceImagesSync(palaceId: string, images: Record<string, string>): DbReturn {
  const doc: PalaceImagesDoc = {
    ...getPalaceImagesDoc(palaceId),
    images,
    updatedAt: Date.now(),
  };
  if (estimateDocBytes(doc) > MAX_IMAGES_DOC_BYTES) {
    return {
      ok: false,
      id: doc._id,
      error: true,
      message: '图片过多，请减少桩图片或改用文字描述',
    };
  }
  const result = getDb().put(cloneDeep(doc));
  if (!result.ok && result.error) {
    log.e('同步保存宫殿图片失败', result.message);
  }
  return result;
}

/**
 * 保存宫殿桩图片文档，带体积守卫
 */
export async function savePalaceImages(palaceId: string, images: Record<string, string>): Promise<DbReturn> {
  const doc: PalaceImagesDoc = {
    ...getPalaceImagesDoc(palaceId),
    images,
    updatedAt: Date.now(),
  };
  if (estimateDocBytes(doc) > MAX_IMAGES_DOC_BYTES) {
    return {
      ok: false,
      id: doc._id,
      error: true,
      message: '图片过多，请减少桩图片或改用文字描述',
    };
  }
  const result = await getDb().promises.put(cloneDeep(doc));
  if (!result.ok && result.error) {
    log.e('保存宫殿图片失败', result.message);
  }
  return result;
}

/**
 * 给宫殿装配桩图片（读取后调用），含旧数据惰性迁移
 *
 * 旧数据兼容：若 locus.imageUrl 直接保存了 dataURL，则迁移到图片文档，
 * 并从主文档中移除，避免再次保存时重复占用主文档空间。
 */
export function attachImagesToPalace(palace: Palace): Palace {
  const imagesDoc = getPalaceImagesDoc(palace._id);
  const images = {...imagesDoc.images};
  let migrated = false;

  const assembled = cloneDeep(palace);
  for (const locus of assembled.loci) {
    if (isDataUrl(locus.imageUrl)) {
      images[locus.order.toString()] = locus.imageUrl!;
      migrated = true;
    }
    const image = images[locus.order.toString()];
    if (image) {
      locus.imageUrl = image;
    } else {
      delete locus.imageUrl;
    }
  }

  if (migrated) {
    const imagesResult = savePalaceImagesSync(palace._id, images);
    if (!imagesResult.ok) {
      log.e('迁移宫殿图片失败', imagesResult.message);
    }
    // 写回已去掉 dataURL 的主文档
    const doc = getPalacesDoc();
    const index = doc.palaces.findIndex(p => p._id === palace._id);
    if (index >= 0) {
      const cleaned = cloneDeep(assembled);
      for (const locus of cleaned.loci) {
        if (isDataUrl(locus.imageUrl)) {
          delete locus.imageUrl;
        }
      }
      doc.palaces[index] = cleaned;
      doc.updatedAt = Date.now();
      getDb().put(cloneDeep(doc));
    }
  }

  return assembled;
}

/**
 * 获取所有宫殿（自动装配桩图片）
 */
export function getAllPalaces(): Palace[] {
  return getPalacesDoc().palaces.map(p => attachImagesToPalace(p));
}

/**
 * 按 id 获取宫殿（自动装配桩图片）
 */
export function getPalaceById(palaceId: string): Palace | null {
  return getAllPalaces().find(p => p._id === palaceId) || null;
}

/**
 * 保存（新建或更新）宫殿
 */
export async function savePalace(palace: Palace): Promise<DbReturn> {
  const {palace: cleaned, images} = extractImagesFromPalace(palace);
  const doc = getPalacesDoc();
  const index = doc.palaces.findIndex(p => p._id === cleaned._id);
  if (index >= 0) {
    doc.palaces[index] = cleaned;
  } else {
    doc.palaces.push(cleaned);
  }
  doc.updatedAt = Date.now();

  const result = await getDb().promises.put(cloneDeep(doc));
  if (!result.ok) {
    log.e('保存宫殿失败', result.message);
    return result;
  }

  // 图片单独存一个文档，避免主文档超限
  const imagesResult = await savePalaceImages(cleaned._id, images);
  if (!imagesResult.ok) {
    log.e('保存宫殿图片失败', imagesResult.message);
    // uTools 无事务，主文档已保存；将错误透传调用方处理
    return imagesResult;
  }

  log.d('保存宫殿成功', cleaned._id);
  return result;
}

/**
 * 删除宫殿（同时删除其桩挂载文档与图片文档；不级联删文本记忆文章）
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

  // 删除对应的图片文档
  try {
    const imagesDoc = getDb().get<PalaceImagesDoc>(getImagesKey(palaceId));
    if (imagesDoc) {
      getDb().remove(imagesDoc._id);
    }
  } catch (error) {
    log.e('删除宫殿图片失败', error);
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
