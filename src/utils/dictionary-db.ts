/**
 * 外部词典数据库工具 - 使用适配器数据库存储大词库
 */
import type {DictionaryEntry} from './local-dictionary';
import {getDbAdapter, getDbStorage} from '@/adapters/db';

const DICTIONARY_KEY = 'external_dictionary';
const DICTIONARY_VERSION_KEY = 'dictionary_version';

interface DictionaryDoc {
  _id: string;
  _rev?: string;
  version: string;
  total: number;
  words: Record<string, DictionaryEntry>;
}

/**
 * 保存词典到数据库
 * @param words 词典数据
 * @param version 版本号
 */
export async function saveDictionaryToDB(
  words: Record<string, DictionaryEntry>,
  version: string = '1.0'
): Promise<boolean> {
  try {
    const db = getDbAdapter();
    const doc: DictionaryDoc = {
      _id: DICTIONARY_KEY,
      version,
      total: Object.keys(words).length,
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

/**
 * 从数据库加载词典
 */
export function loadDictionaryFromDB(): Record<string, DictionaryEntry> | null {
  try {
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
    const db = getDbAdapter();
    const result = db.remove(DICTIONARY_KEY);
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
