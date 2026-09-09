/**
 * 记忆宫殿 DB 存取层
 *
 * 存储结构：
 * - `memory_palace_palaces`：单文档，palaces 数组存所有宫殿（**不含桩图片 dataURL**）
 * - `memory_palace_images_<palaceId>`：每个宫殿一个文档，单独存桩图片与总图 dataURL
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
import type {SyncMemoryPalace} from '@/types/sync';

// 宫殿列表文档键
const PALACES_KEY = DB_KEY_MEMORY_PALACE + 'palaces';
// 桩图片文档键前缀
const IMAGES_KEY_PREFIX = DB_KEY_MEMORY_PALACE + 'images_';
// 桩挂载文档键前缀
const PEGS_KEY_PREFIX = DB_KEY_MEMORY_PALACE + 'pegs_';

// 图片文档体积阈值（uTools 单文档上限约 1MB，留 200KB 余量）
const MAX_IMAGES_DOC_BYTES = 800 * 1024;

/**
 * 单张图片的同步体积上限（字符数 ≈ 字节数）
 * 宫殿桩图多为 emoji SVG dataURL（约几百字节），必保留；
 * 大图剔除后移动端查看版退化为纯文字桩，避免同步 payload 膨胀
 */
export const MAX_SYNC_IMAGE_CHARS = 32 * 1024;

/** 宫殿总图在图片文档中的保留键（桩 order 均为数字，不会冲突） */
export const OVERVIEW_IMAGE_KEY = '__overview__';

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
  // 宫殿总图同样剥离到图片文档
  if (isDataUrl(cleaned.overviewImage)) {
    images[OVERVIEW_IMAGE_KEY] = cleaned.overviewImage!;
  }
  delete cleaned.overviewImage;
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

  // 宫殿总图：主文档残留的 dataURL 同样迁移到图片文档
  if (isDataUrl(assembled.overviewImage)) {
    images[OVERVIEW_IMAGE_KEY] = assembled.overviewImage!;
    migrated = true;
  }
  const overviewImage = images[OVERVIEW_IMAGE_KEY];
  if (overviewImage) {
    assembled.overviewImage = overviewImage;
  } else {
    delete assembled.overviewImage;
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
      if (isDataUrl(cleaned.overviewImage)) {
        delete cleaned.overviewImage;
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

// ==================== 多端同步（memoryPalace scope） ====================

/** 剔除超大图片（dataURL 超过 MAX_SYNC_IMAGE_CHARS 的桩图与总图） */
export function stripOversizedImages(palace: Palace): Palace {
  const cleaned = cloneDeep(palace);
  let stripped = 0;
  for (const locus of cleaned.loci) {
    if (locus.imageUrl && locus.imageUrl.length > MAX_SYNC_IMAGE_CHARS) {
      delete locus.imageUrl;
      stripped++;
    }
  }
  if (cleaned.overviewImage && cleaned.overviewImage.length > MAX_SYNC_IMAGE_CHARS) {
    delete cleaned.overviewImage;
    stripped++;
  }
  if (stripped > 0) {
    log.w(`宫殿 ${palace._id} 同步时剔除 ${stripped} 张超大图片（>${MAX_SYNC_IMAGE_CHARS / 1024}KB），移动端将只显示文字`);
  }
  return cleaned;
}

/**
 * 合并两个宫殿（同 _id）：utime 较新者覆盖；
 * 覆盖方缺失的图片字段保留被覆盖方的本地图片（同步剔除大图后不留白）
 */
export function mergePalace(local: Palace, remote: Palace): Palace {
  const remoteWins = (remote.utime || 0) >= (local.utime || 0);
  const winner = cloneDeep(remoteWins ? remote : local);
  const fallback = remoteWins ? local : remote;
  for (const locus of winner.loci) {
    if (!locus.imageUrl) {
      const fb = fallback.loci.find(l => l.order === locus.order);
      if (fb?.imageUrl) locus.imageUrl = fb.imageUrl;
    }
  }
  if (!winner.overviewImage && fallback.overviewImage) {
    winner.overviewImage = fallback.overviewImage;
  }
  return winner;
}

/**
 * 合并宫殿列表：按 _id 匹配，utime 较新者覆盖（图片字段双向兜底）
 */
export function mergePalaceList(local: Palace[], remote: Palace[]): Palace[] {
  const map = new Map<string, Palace>();
  for (const palace of local) map.set(palace._id, cloneDeep(palace));
  for (const palace of remote) {
    const existing = map.get(palace._id);
    map.set(palace._id, existing ? mergePalace(existing, palace) : cloneDeep(palace));
  }
  return Array.from(map.values());
}

/**
 * 合并单个宫殿的桩挂载：按 locusOrder 匹配（一桩一挂载），
 * learnDate 较新者保留（双端都可能巡视自评，不丢进度）
 */
export function mergePegItemList(local: PegItem[], remote: PegItem[]): PegItem[] {
  const map = new Map<number, PegItem>();
  for (const peg of local) map.set(peg.locusOrder, cloneDeep(peg));
  for (const peg of remote) {
    const existing = map.get(peg.locusOrder);
    if (!existing || (peg.learnDate || 0) >= (existing.learnDate || 0)) {
      map.set(peg.locusOrder, cloneDeep(peg));
    }
  }
  return Array.from(map.values()).sort((a, b) => a.locusOrder - b.locusOrder);
}

/**
 * 收集记忆宫殿同步数据（无宫殿返回 null，避免无意义负载）
 * 桩图/总图中的超大 dataURL 会被剔除（见 stripOversizedImages）
 */
export function collectMemoryPalaceSync(): SyncMemoryPalace | null {
  const palaces = getAllPalaces();
  if (palaces.length === 0) return null;
  const pegs: Record<string, PegItem[]> = {};
  for (const palace of palaces) {
    const items = getPegsByPalace(palace._id);
    if (items.length > 0) {
      pegs[palace._id] = items;
    }
  }
  return {
    palaces: palaces.map(stripOversizedImages),
    pegs,
  };
}

/**
 * 还原记忆宫殿同步数据：按 id/utime 合并宫殿、按 learnDate 合并桩挂载后写回 DB
 * @returns 参与合并的宫殿数量
 */
export async function restoreMemoryPalaceSync(data: SyncMemoryPalace): Promise<number> {
  const localPalaces = getAllPalaces();
  const mergedPalaces = mergePalaceList(localPalaces, data.palaces || []);

  for (const palace of mergedPalaces) {
    const result = await savePalace(palace);
    if (!result.ok) {
      log.e('还原宫殿失败', palace._id, result.message);
      continue;
    }
    const localPegs = getPegsByPalace(palace._id);
    const remotePegs = data.pegs?.[palace._id] || [];
    const mergedPegs = mergePegItemList(localPegs, remotePegs);
    if (mergedPegs.length > 0) {
      const pegsResult = await savePegItems(mergedPegs);
      if (!pegsResult.ok) {
        log.e('还原宫殿桩挂载失败', palace._id, pegsResult.message);
      }
    }
  }

  log.i('记忆宫殿数据已还原', mergedPalaces.length);
  return mergedPalaces.length;
}
