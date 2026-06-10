/**
 * 词库管理工具
 * 使用适配器数据库存储多词库数据
 * 采用分文档+分片存储策略避免 1MB 限制
 */
import type { Word } from '@/types/words';
import { v4 as uuidv4 } from 'uuid';
import cloneDeep from 'lodash.clonedeep';
import {getDbAdapter} from '@/adapters/db';
import {normalizeItemText} from '@/utils/text-utils';

// 词库数据结构
export interface WordBank {
  id: string;           // 词库唯一标识
  name: string;         // 词库名称
  words: Word[];        // 单词列表
  createdAt: number;    // 创建时间
  updatedAt: number;    // 更新时间
  isDefault?: boolean;  // 是否为默认词库
}

// 词库元数据文档结构（存储词库列表，不包含单词）
interface WordBankMetaDoc {
  _id: string;
  _rev?: string;
  type: 'wordbank-meta';
  banks: Omit<WordBank, 'words'>[];  // 词库列表（不包含单词数据）
  updatedAt: number;
}

// 词库数据分片文档结构
interface WordBankChunkDoc {
  _id: string;
  _rev?: string;
  type: 'wordbank-chunk';
  bankId: string;
  chunkIndex: number;   // 分片索引
  totalChunks: number;  // 总分片数
  words: Word[];        // 该分片的单词数据
  updatedAt: number;
}

// 存储键名前缀
const WORDBANK_META_ID = 'slowly-record-wordbank-meta-v2';
const WORDBANK_CHUNK_PREFIX = 'slowly-record-wordbank-chunk-v2:';
const CURRENT_WORDBANK_KEY = 'slowly-record-current-wordbank';

// 迁移检查缓存标志：一旦检查过就不再重复检查
let _migrationChecked = false;

// 旧版存储键名（用于数据迁移）
const OLD_WORDBANK_DOC_ID = 'wordbank_data';

// 每个分片的最大单词数（估算约 500-800KB）
const MAX_WORDS_PER_CHUNK = 300;

/**
 * 获取词库分片文档ID
 */
function getWordBankChunkId(bankId: string, chunkIndex: number): string {
  return `${WORDBANK_CHUNK_PREFIX}${bankId}:${chunkIndex}`;
}

/**
 * 从数据库获取词库元数据文档
 */
function getWordBankMetaDoc(): WordBankMetaDoc | null {
  try {
    const db = getDbAdapter();
    const doc = db.get(WORDBANK_META_ID) as WordBankMetaDoc | null;
    return doc;
  } catch (e) {
    console.error('获取词库元数据失败:', e);
    return null;
  }
}

/**
 * 保存词库元数据文档到数据库
 */
async function saveWordBankMetaDoc(banks: Omit<WordBank, 'words'>[]): Promise<boolean> {
  try {
    const db = getDbAdapter();
    const existingDoc = getWordBankMetaDoc();
    const doc: WordBankMetaDoc = {
      _id: WORDBANK_META_ID,
      type: 'wordbank-meta',
      banks: cloneDeep(banks),
      updatedAt: Date.now()
    };
    
    if (existingDoc?._rev) {
      doc._rev = existingDoc._rev;
    }
    
    const result = await db.promises.put(doc);
    
    if (result.ok) {
      return true;
    } else {
      console.error('保存词库元数据失败:', result.message);
      return false;
    }
  } catch (e) {
    console.error('保存词库元数据异常:', e);
    return false;
  }
}

/**
 * 获取词库的所有分片文档
 */
function getWordBankChunkDocs(bankId: string): WordBankChunkDoc[] {
  const chunks: WordBankChunkDoc[] = [];
  try {
    const db = getDbAdapter();
    // 尝试读取所有分片
    for (let i = 0; i < 100; i++) { // 最多100个分片
      const docId = getWordBankChunkId(bankId, i);
      const doc = db.get(docId) as WordBankChunkDoc | null;
      if (doc && doc.type === 'wordbank-chunk') {
        chunks.push(doc);
      } else {
        break; // 没有更多分片了
      }
    }
  } catch (e) {
    console.error(`获取词库分片失败 (${bankId}):`, e);
  }
  return chunks.sort((a, b) => a.chunkIndex - b.chunkIndex);
}

/**
 * 保存词库单词数据（分片存储）
 */
async function saveWordBankDataDoc(bankId: string, words: Word[]): Promise<boolean> {
  try {
    const db = getDbAdapter();
    // 先删除旧的分片
    await deleteWordBankDataDoc(bankId);

    // 规范化文本，保留词组空格
    const cleanedWords = words.map(w => ({ ...w, text: normalizeItemText(w.text) }));
    // 按 text 去重：保留列表中后出现的（通常更新），防止历史脏数据重复入库
    const seen = new Set<string>();
    const uniqueWords: Word[] = [];
    for (let i = cleanedWords.length - 1; i >= 0; i--) {
      const w = cleanedWords[i];
      const key = w.text.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        uniqueWords.unshift(w);
      }
    }
    // 将单词分成多个块
    const totalChunks = Math.ceil(uniqueWords.length / MAX_WORDS_PER_CHUNK);

    if (totalChunks === 0) {
      // 空词库，创建一个空分片
      const doc: WordBankChunkDoc = {
        _id: getWordBankChunkId(bankId, 0),
        type: 'wordbank-chunk',
        bankId,
        chunkIndex: 0,
        totalChunks: 1,
        words: [],
        updatedAt: Date.now()
      };
      let result = await db.promises.put(doc);
      if (!result.ok && result.message?.includes('conflict')) {
        const existing = db.get(doc._id);
        if (existing?._rev) {
          doc._rev = existing._rev;
          result = await db.promises.put(doc);
        }
      }
      if (!result.ok) {
        console.error(`保存词库空分片失败 (${bankId}):`, result.message);
        return false;
      }
      return true;
    }

    // 保存每个分片
    for (let i = 0; i < totalChunks; i++) {
      const start = i * MAX_WORDS_PER_CHUNK;
      const end = start + MAX_WORDS_PER_CHUNK;
      const chunkWords = uniqueWords.slice(start, end);

      const doc: WordBankChunkDoc = {
        _id: getWordBankChunkId(bankId, i),
        type: 'wordbank-chunk',
        bankId,
        chunkIndex: i,
        totalChunks,
        words: cloneDeep(chunkWords),
        updatedAt: Date.now()
      };

      let result = await db.promises.put(doc);
      if (!result.ok && result.message?.includes('conflict')) {
        const existing = db.get(doc._id);
        if (existing?._rev) {
          doc._rev = existing._rev;
          result = await db.promises.put(doc);
        }
      }
      if (!result.ok) {
        console.error(`保存词库分片失败 (${bankId}, chunk ${i}):`, result.message);
        return false;
      }
    }

    console.log(`[WordBankManager] 成功保存词库 ${bankId}，共 ${totalChunks} 个分片，${cleanedWords.length} 个单词`);
    return true;
  } catch (e) {
    console.error(`保存词库数据异常 (${bankId}):`, e);
    return false;
  }
}

/**
 * 获取词库的所有单词（合并所有分片）
 */
function getWordBankWords(bankId: string): Word[] {
  const chunks = getWordBankChunkDocs(bankId);
  if (chunks.length === 0) {
    return [];
  }

  // 合并所有分片的单词
  const allWords: Word[] = [];
  for (const chunk of chunks.sort((a, b) => a.chunkIndex - b.chunkIndex)) {
    allWords.push(...chunk.words);
  }
  // 规范化文本，保留词组空格
  const cleanedWords = allWords.map(w => ({ ...w, text: normalizeItemText(w.text) }));

  // 按 text 去重：历史脏数据可能导致同一单词保存了多份（不同 _id）
  // 保留 _rev 版本号更高的记录（更新更频繁/数据更新）
  const wordMap = new Map<string, Word>();
  for (const word of cleanedWords) {
    const existing = wordMap.get(word.text);
    if (!existing) {
      wordMap.set(word.text, word);
      continue;
    }
    const existingRev = parseInt(String(existing._rev).split('-')[0] || '0', 10);
    const currentRev = parseInt(String(word._rev).split('-')[0] || '0', 10);
    if (currentRev > existingRev) {
      wordMap.set(word.text, word);
    }
  }

  return Array.from(wordMap.values());
}

/**
 * 删除词库单词数据文档（删除所有分片）
 */
async function deleteWordBankDataDoc(bankId: string): Promise<boolean> {
  try {
    const db = getDbAdapter();
    // 删除所有分片
    for (let i = 0; i < 100; i++) {
      const docId = getWordBankChunkId(bankId, i);
      const existingDoc = db.get(docId) as WordBankChunkDoc | null;
      
      if (existingDoc?._rev) {
        await db.promises.remove({ _id: docId, _rev: existingDoc._rev });
      } else {
        // 如果没有找到这个分片，可能已经没有更多分片了
        if (i === 0) {
          // 如果连第0个分片都没有，说明没有这个词库的数据
          continue;
        }
        break;
      }
    }
    return true;
  } catch (e) {
    console.error(`删除词库数据失败 (${bankId}):`, e);
    return false;
  }
}

/**
 * 检查并迁移旧版数据
 */
async function migrateOldDataIfNeeded(): Promise<boolean> {
  // 已检查过则跳过
  if (_migrationChecked) return false;
  try {
    const db = getDbAdapter();
    // 检查是否已有新版数据
    const metaDoc = getWordBankMetaDoc();
    if (metaDoc?.banks && metaDoc.banks.length > 0) {
      _migrationChecked = true;
      return false; // 已有新版数据，不需要迁移
    }
    
    // 检查是否有旧版数据
    const oldDoc = db.get(OLD_WORDBANK_DOC_ID) as any;
    if (oldDoc?.data && Array.isArray(oldDoc.data) && oldDoc.data.length > 0) {
      console.log('[WordBankManager] 发现旧版数据，开始迁移...');
      
      // 迁移数据到新格式
      const banks: WordBank[] = oldDoc.data;
      const metaBanks = banks.map(b => ({
        id: b.id,
        name: b.name === '我的词库' ? '默认词库' : (b.name === '基础词库' ? '默认词库' : b.name),
        createdAt: b.createdAt,
        updatedAt: b.updatedAt,
        isDefault: b.isDefault
      }));
      
      // 保存元数据
      await saveWordBankMetaDoc(metaBanks);
      
      // 分别保存每个词库的单词数据（使用分片存储）
      for (const bank of banks) {
        const cleanedWords = bank.words.map(w => ({ ...w, text: normalizeItemText(w.text) }));
        await saveWordBankDataDoc(bank.id, cleanedWords);
      }
      
      console.log('[WordBankManager] 数据迁移完成');
      _migrationChecked = true;
      return true;
    }
    
    _migrationChecked = true;
    return false;
  } catch (e) {
    console.error('[WordBankManager] 数据迁移失败:', e);
    return false;
  }
}

/**
 * 获取所有词库列表
 */
export async function getAllWordBanks(): Promise<WordBank[]> {
  // 尝试迁移旧数据
  await migrateOldDataIfNeeded();
  
  const metaDoc = getWordBankMetaDoc();
  
  if (metaDoc?.banks && Array.isArray(metaDoc.banks) && metaDoc.banks.length > 0) {
    // 迁移：将"我的词库"或"基础词库"重命名为"默认词库"
    let needSave = false;
    for (const bank of metaDoc.banks) {
      if (bank.name === '我的词库' || bank.name === '基础词库') {
        bank.name = '默认词库';
        needSave = true;
      }
    }
    if (needSave) {
      await saveWordBankMetaDoc(metaDoc.banks);
    }
    
    // 从各个分片加载单词并合并
    return metaDoc.banks.map(bankMeta => {
      const words = getWordBankWords(bankMeta.id);
      return {
        ...bankMeta,
        words
      } as WordBank;
    });
  }
  
  // 如果没有数据，创建默认词库
  const defaultBank = createDefaultWordBank();
  const { words: _, ...defaultBankMeta } = defaultBank;
  await saveWordBankMetaDoc([defaultBankMeta]);
  await saveWordBankDataDoc(defaultBank.id, defaultBank.words);
  return [defaultBank];
}

/**
 * 获取当前选中的词库ID
 */
export async function getCurrentWordBankId(): Promise<string> {
  try {
    const id = localStorage.getItem(CURRENT_WORDBANK_KEY);
    if (id) {
      // 检查词库是否存在
      const banks = await getAllWordBanks();
      if (banks.find(b => b.id === id)) {
        return id;
      }
    }
  } catch (e) {
    console.error('获取当前词库ID失败:', e);
  }
  // 返回默认词库ID
  const banks = await getAllWordBanks();
  const defaultBank = banks.find(b => b.isDefault);
  return defaultBank?.id || banks[0]?.id || '';
}

/**
 * 设置当前选中的词库
 */
export function setCurrentWordBankId(id: string): void {
  try {
    localStorage.setItem(CURRENT_WORDBANK_KEY, id);
  } catch (e) {
    console.error('设置当前词库ID失败:', e);
  }
}

/**
 * 创建默认词库
 */
export function createDefaultWordBank(): WordBank {
  return {
    id: 'default',
    name: '默认词库',
    words: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    isDefault: true
  };
}

/**
 * 创建新词库
 * @param name 词库名称
 * @param words 初始单词列表（可选）
 */
export async function createWordBank(name: string, words: Word[] = []): Promise<WordBank> {
  const bank: WordBank = {
    id: uuidv4(),
    name: name.trim() || '未命名词库',
    words: cloneDeep(words),
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  
  const banks = await getAllWordBanks();
  banks.push(bank);
  
  // 分离元数据和单词数据
  const metaBanks = banks.map(b => ({
    id: b.id,
    name: b.name,
    createdAt: b.createdAt,
    updatedAt: b.updatedAt,
    isDefault: b.isDefault
  }));
  
  // 保存元数据
  await saveWordBankMetaDoc(metaBanks);
  // 保存单词数据（分片存储）
  await saveWordBankDataDoc(bank.id, bank.words);
  
  return bank;
}

/**
 * 保存词库（新增或更新）
 */
export async function saveWordBank(bank: WordBank): Promise<boolean> {
  const banks = await getAllWordBanks();
  const index = banks.findIndex(b => b.id === bank.id);
  
  bank.updatedAt = Date.now();
  
  if (index >= 0) {
    banks[index] = cloneDeep(bank);
  } else {
    banks.push(cloneDeep(bank));
  }
  
  // 分离元数据和单词数据
  const metaBanks = banks.map(b => ({
    id: b.id,
    name: b.name,
    createdAt: b.createdAt,
    updatedAt: b.updatedAt,
    isDefault: b.isDefault
  }));
  
  // 保存元数据
  const metaSuccess = await saveWordBankMetaDoc(metaBanks);
  if (!metaSuccess) {
    return false;
  }
  
  // 保存单词数据到分片文档
  const dataSuccess = await saveWordBankDataDoc(bank.id, bank.words);
  return dataSuccess;
}

/**
 * 获取指定词库
 */
export async function getWordBank(id: string): Promise<WordBank | null> {
  const banks = await getAllWordBanks();
  return banks.find(b => b.id === id) || null;
}

/**
 * 删除词库
 * @returns 是否删除成功（默认词库不能删除）
 */
export async function deleteWordBank(id: string): Promise<boolean> {
  try {
    const bank = await getWordBank(id);
    if (bank?.isDefault) {
      return false; // 默认词库不能删除
    }
    
    const banks = await getAllWordBanks();
    const filtered = banks.filter(b => b.id !== id);
    
    // 保存元数据（不包含被删除的词库）
    const metaBanks = filtered.map(b => ({
      id: b.id,
      name: b.name,
      createdAt: b.createdAt,
      updatedAt: b.updatedAt,
      isDefault: b.isDefault
    }));
    const metaSuccess = await saveWordBankMetaDoc(metaBanks);
    if (!metaSuccess) return false;
    
    // 删除词库单词数据文档（所有分片）
    await deleteWordBankDataDoc(id);
    
    // 如果删除的是当前选中的词库，切换到默认词库
    const currentId = await getCurrentWordBankId();
    if (currentId === id) {
      const defaultBank = filtered.find(b => b.isDefault);
      setCurrentWordBankId(defaultBank?.id || filtered[0]?.id || '');
    }
    
    return true;
  } catch (e) {
    console.error('删除词库失败:', e);
    return false;
  }
}

/**
 * 更新词库名称
 */
export async function updateWordBankName(id: string, name: string): Promise<boolean> {
  const bank = await getWordBank(id);
  if (!bank) return false;
  
  bank.name = name.trim() || bank.name;
  bank.updatedAt = Date.now();
  
  return await saveWordBank(bank);
}

/**
 * 更新词库单词列表
 */
export async function updateWordBankWords(id: string, words: Word[]): Promise<boolean> {
  const bank = await getWordBank(id);
  if (!bank) return false;
  
  bank.words = cloneDeep(words);
  bank.updatedAt = Date.now();
  
  return await saveWordBank(bank);
}

/**
 * 从内置词库导入到指定词库
 */
export async function importFromBuiltinWordBank(
  targetBankId: string, 
  builtinBankType: string
): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    console.log(`[WordBankManager] 开始导入词库: ${builtinBankType} -> ${targetBankId}`);
    
    const { fetchWordBank, WORDBANK_LIST } = await import('./wordbank-service');
    
    // 验证词库类型是否有效
    const validTypes = WORDBANK_LIST.map(wb => wb.id);
    if (!validTypes.includes(builtinBankType as any)) {
      console.error(`[WordBankManager] 无效的词库类型: ${builtinBankType}`);
      return { success: false, count: 0, error: `无效的词库类型: ${builtinBankType}` };
    }
    
    // 使用本地词库策略
    const words = await fetchWordBank(builtinBankType as any, { priority: 'local', useCache: true });
    
    console.log(`[WordBankManager] 获取到 ${words.length} 个单词`);
    
    if (words.length === 0) {
      return { success: false, count: 0, error: '词库为空或加载失败' };
    }
    
    const bank = await getWordBank(targetBankId);
    if (!bank) {
      console.error(`[WordBankManager] 目标词库不存在: ${targetBankId}`);
      return { success: false, count: 0, error: '目标词库不存在' };
    }
    
    // 去重：基于 word.text 属性
    const existingTexts = new Set(bank.words.map(w => w.text.toLowerCase()));
    const uniqueWords = words.filter(w => !existingTexts.has(w.text.toLowerCase()));
    
    console.log(`[WordBankManager] 去重后剩余 ${uniqueWords.length} 个新单词`);
    
    if (uniqueWords.length === 0) {
      return { success: true, count: 0 };
    }
    
    bank.words.push(...cloneDeep(uniqueWords));
    bank.updatedAt = Date.now();
    
    const success = await saveWordBank(bank);
    
    console.log(`[WordBankManager] 保存结果: ${success}`);
    
    return { success, count: uniqueWords.length };
  } catch (e) {
    console.error('[WordBankManager] 从内置词库导入失败:', e);
    return { success: false, count: 0, error: String(e) };
  }
}

/**
 * 导出词库为JSON
 */
export async function exportWordBankToJson(id: string): Promise<string> {
  const bank = await getWordBank(id);
  if (!bank) return '';
  return JSON.stringify(bank.words, null, 2);
}
