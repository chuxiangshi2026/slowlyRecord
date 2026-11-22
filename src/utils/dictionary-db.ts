/**
 * 外部词典数据库工具 - 使用适配器数据库存储大词库
 *
 * 商店版（uTools + __STORE_BUILD__）：词典由用户导入的文件再生、体积随词典规模增长，
 * 不进随账号同步的 utools.db。词条本体分块写入本机 IndexedDB（adapters/local-bulk-store），
 * 同步库中的 external_dictionary 文档只保留版本号与导入标记（storage: 'local'，不含 words）；
 * 读到旧版含 words 的文档时自动迁移。
 */
import type {DictionaryEntry} from './local-dictionary';
import {getDbAdapter, getDbStorage} from '@/adapters/db';
import {isStoreLocalOnly, localBulkGet, localBulkRemove, localBulkSet} from '@/adapters/local-bulk-store';

const DICTIONARY_KEY = 'external_dictionary';
const DICTIONARY_VERSION_KEY = 'dictionary_version';

// 商店版本机存储键：meta 存版本/总数/分块数，词条按 CHUNK_SIZE 分块存放
const LOCAL_META_KEY = 'external_dictionary_meta';
const LOCAL_CHUNK_PREFIX = 'external_dictionary_chunk_';
const CHUNK_SIZE = 4000;
// 导入词条数超过该值时给出「体积较大、分批写入」提示
const LARGE_IMPORT_HINT_WORDS = 20000;

interface DictionaryDoc {
  _id: string;
  _rev?: string;
  version: string;
  total: number;
  /** 词条本体（非商店版）；商店版同步库文档不含此字段 */
  words?: Record<string, DictionaryEntry>;
  /** 商店版标记：词条本体在本机存储 */
  storage?: 'local';
  updatedAt?: number;
}

interface LocalDictionaryMeta {
  version: string;
  total: number;
  chunks: number;
}

/** 大词典导入提示（商店版）：动态引入 element-plus，失败时仅记日志 */
function hintLargeImport(total: number): void {
  if (total < LARGE_IMPORT_HINT_WORDS || typeof window === 'undefined') return;
  void import('element-plus').then(({ElMessage}) => ElMessage({
    type: 'info',
    message: `词典共 ${total} 词，体积较大：将分批写入本机存储，不随账号同步`,
  })).catch(() => { /* 提示不可用时不影响导入 */ });
}

/** 商店版：同步库只写版本号与导入标记，不含词条本体 */
async function saveSyncedDictionaryMarker(version: string, total: number): Promise<boolean> {
  const db = getDbAdapter();
  const existing = db.get(DICTIONARY_KEY) as DictionaryDoc | null;
  const marker: DictionaryDoc = {
    _id: DICTIONARY_KEY,
    version,
    total,
    storage: 'local',
    updatedAt: Date.now(),
  };
  if (existing?._rev) marker._rev = existing._rev;
  const result = await db.promises.put(marker);
  if (!result.ok) {
    console.error('[词典DB] 同步库标记写入失败:', result.message);
  }
  return !!result.ok;
}

/**
 * 保存词典到数据库（商店版：词条分块写入本机存储，同步库只留标记）
 * @param words 词典数据
 * @param version 版本号
 */
export async function saveDictionaryToDB(
  words: Record<string, DictionaryEntry>,
  version: string = '1.0'
): Promise<boolean> {
  try {
    const total = Object.keys(words).length;

    if (isStoreLocalOnly()) {
      hintLargeImport(total);
      // 分批写入本机存储：逐块 await，避免一次性构建/写入超大对象
      const entries = Object.entries(words);
      const chunks = Math.ceil(entries.length / CHUNK_SIZE) || 0;
      for (let i = 0; i < chunks; i++) {
        const slice = Object.fromEntries(entries.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE));
        const ok = await localBulkSet(LOCAL_CHUNK_PREFIX + i, slice);
        if (!ok) {
          console.error(`[词典DB] 本机存储分块 ${i + 1}/${chunks} 写入失败`);
          return false;
        }
        console.log(`[词典DB] 本机存储分块 ${i + 1}/${chunks} 已写入`);
      }
      // 先清掉多于本次分块数的旧分块（换更小词典时不留残块）
      const oldMeta = localBulkGet<LocalDictionaryMeta>(LOCAL_META_KEY);
      if (oldMeta && oldMeta.chunks > chunks) {
        for (let i = chunks; i < oldMeta.chunks; i++) {
          await localBulkRemove(LOCAL_CHUNK_PREFIX + i);
        }
      }
      await localBulkSet(LOCAL_META_KEY, {version, total, chunks} satisfies LocalDictionaryMeta);
      const markerOk = await saveSyncedDictionaryMarker(version, total);
      if (!markerOk) return false;
      const storage = getDbStorage();
      storage.setItem(DICTIONARY_VERSION_KEY, version);
      console.log(`[词典DB] 保存成功（本机存储），共 ${total} 词`);
      return true;
    }

    const db = getDbAdapter();
    const doc: DictionaryDoc = {
      _id: DICTIONARY_KEY,
      version,
      total,
      words
    };

    // 检查是否已存在
    const existing = db.get(DICTIONARY_KEY);
    if (existing) {
      doc._rev = existing._rev;
    }

    const result = await db.promises.put(doc);

    if (result.ok) {
      // 保存版本信息
      const storage = getDbStorage();
      storage.setItem(DICTIONARY_VERSION_KEY, version);
      console.log(`[词典DB] 保存成功，共 ${doc.total} 词`);
      return true;
    }
    return false;
  } catch (error) {
    console.error('[词典DB] 保存失败:', error);
    return false;
  }
}

/** 商店版：把旧版同步库中的词条本体迁到本机存储，成功后把同步库文档收窄为标记 */
function migrateLegacyDictionaryDoc(legacy: DictionaryDoc): void {
  const words = legacy.words;
  if (!words) return;
  void (async () => {
    const ok = await saveDictionaryToDB(words, legacy.version || '1.0');
    if (!ok) {
      console.error('[词典DB] 旧版词典迁移失败');
    } else {
      console.log('[词典DB] 旧版词典已迁移到本机存储，同步库仅保留标记');
    }
  })().catch((e) => console.error('[词典DB] 旧版词典迁移异常:', e));
}

/**
 * 从数据库加载词典
 */
export function loadDictionaryFromDB(): Record<string, DictionaryEntry> | null {
  try {
    if (isStoreLocalOnly()) {
      const meta = localBulkGet<LocalDictionaryMeta>(LOCAL_META_KEY);
      if (meta && meta.chunks > 0) {
        const merged: Record<string, DictionaryEntry> = {};
        for (let i = 0; i < meta.chunks; i++) {
          const chunk = localBulkGet<Record<string, DictionaryEntry>>(LOCAL_CHUNK_PREFIX + i);
          if (chunk) Object.assign(merged, chunk);
        }
        console.log(`[词典DB] 本机存储加载成功，共 ${Object.keys(merged).length} 词`);
        return merged;
      }
      // 旧版数据：词条还在同步库文档里，先用并触发迁移
      const legacy = getDbAdapter().get(DICTIONARY_KEY) as DictionaryDoc | null;
      if (legacy?.words && typeof legacy.words === 'object') {
        migrateLegacyDictionaryDoc(legacy);
        console.log(`[词典DB] 加载成功（旧版同步库数据，迁移中），共 ${legacy.total} 词`);
        return legacy.words;
      }
      return null;
    }
    const db = getDbAdapter();
    const doc = db.get(DICTIONARY_KEY) as DictionaryDoc | null;
    if (doc && doc.words) {
      console.log(`[词典DB] 加载成功，共 ${doc.total} 词`);
      return doc.words;
    }
    return null;
  } catch (error) {
    console.error('[词典DB] 加载失败:', error);
    return null;
  }
}

/**
 * 检查词典是否已安装
 */
export function hasDictionaryInDB(): boolean {
  if (isStoreLocalOnly()) {
    if (localBulkGet<LocalDictionaryMeta>(LOCAL_META_KEY)) return true;
    const doc = getDbAdapter().get(DICTIONARY_KEY) as DictionaryDoc | null;
    // 旧版含 words 的文档视为已安装（读取时迁移）；新版标记按 total 判断
    return !!doc && (!!doc.words || (doc.total ?? 0) > 0);
  }
  const db = getDbAdapter();
  const doc = db.get(DICTIONARY_KEY);
  return doc !== null;
}

/**
 * 获取词典版本
 */
export function getDictionaryVersion(): string | null {
  const storage = getDbStorage();
  return storage.getItem(DICTIONARY_VERSION_KEY);
}

/**
 * 删除词典
 */
export async function removeDictionaryFromDB(): Promise<boolean> {
  try {
    if (isStoreLocalOnly()) {
      const meta = localBulkGet<LocalDictionaryMeta>(LOCAL_META_KEY);
      if (meta) {
        for (let i = 0; i < meta.chunks; i++) {
          await localBulkRemove(LOCAL_CHUNK_PREFIX + i);
        }
      }
      await localBulkRemove(LOCAL_META_KEY);
    }
    const db = getDbAdapter();
    const result = await db.promises.remove(DICTIONARY_KEY);
    if (result.ok) {
      const storage = getDbStorage();
      storage.removeItem(DICTIONARY_VERSION_KEY);
      console.log('[词典DB] 删除成功');
      return true;
    }
    return false;
  } catch (error) {
    console.error('[词典DB] 删除失败:', error);
    return false;
  }
}

/**
 * 查询单个单词
 */
export function queryWordFromDB(word: string): DictionaryEntry | null {
  const dict = loadDictionaryFromDB();
  if (dict) {
    return dict[word.toLowerCase()] || null;
  }
  return null;
}

/**
 * 获取外部词典单词数量
 */
export function getExternalDictionaryCount(): number {
  if (isStoreLocalOnly()) {
    const meta = localBulkGet<LocalDictionaryMeta>(LOCAL_META_KEY);
    if (meta) return meta.total;
    const doc = getDbAdapter().get(DICTIONARY_KEY) as DictionaryDoc | null;
    return doc?.total ?? 0;
  }
  const dict = loadDictionaryFromDB();
  return dict ? Object.keys(dict).length : 0;
}

/**
 * 从 JSON 文件导入词典到数据库
 * @param filePath JSON 文件路径（相对于 public 目录）
 * @returns 是否导入成功
 */
export async function importDictionaryFromJSON(filePath: string): Promise<boolean> {
  try {
    console.log('[词典DB] 开始导入词典:', filePath);

    const response = await fetch(filePath);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (!data.words || typeof data.words !== 'object') {
      throw new Error('词典格式错误: 缺少 words 字段');
    }

    const wordCount = Object.keys(data.words).length;
    console.log(`[词典DB] 读取到 ${wordCount} 个单词`);

    // 保存到数据库
    const success = await saveDictionaryToDB(data.words, data.version || '1.0');

    if (success) {
      console.log(`[词典DB] 词典导入成功，共 ${wordCount} 词`);
    }

    return success;
  } catch (error) {
    console.error('[词典DB] 导入词典失败:', error);
    return false;
  }
}

/**
 * 从 File 对象导入词典（用户选择文件）
 * @param file 用户选择的 JSON 文件
 */
export async function importDictionaryFromFile(file: File): Promise<boolean> {
  try {
    console.log('[词典DB] 开始从文件导入:', file.name);

    const text = await file.text();
    const data = JSON.parse(text);

    if (!data.words || typeof data.words !== 'object') {
      throw new Error('词典格式错误: 缺少 words 字段');
    }

    const wordCount = Object.keys(data.words).length;
    console.log(`[词典DB] 文件包含 ${wordCount} 个单词`);

    // 保存到数据库
    const success = await saveDictionaryToDB(data.words, data.version || '1.0');

    if (success) {
      console.log(`[词典DB] 词典导入成功，共 ${wordCount} 词`);
    }

    return success;
  } catch (error) {
    console.error('[词典DB] 从文件导入失败:', error);
    return false;
  }
}
