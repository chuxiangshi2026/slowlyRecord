/**
 * 词库管理工具
 * 使用适配器数据库存储多词库数据
 * 采用分文档+分片存储策略避免 1MB 限制
 */
import type { Word } from '@/types/words';
import type { LanguageCode } from '@/utils/language/types';
import { v4 as uuidv4 } from 'uuid';
import cloneDeep from 'lodash.clonedeep';
import {getDbAdapter} from '@/adapters/db';
import {normalizeItemText} from '@/utils/text-utils';
import {recordTombstone} from '@/utils/sync-tombstone';

// 词库数据结构
export interface WordBank {
  id: string;           // 词库唯一标识
  name: string;         // 词库名称
  words: Word[];        // 单词列表
  createdAt: number;    // 创建时间
  updatedAt: number;    // 更新时间
  isDefault?: boolean;  // 是否为默认词库
  language?: LanguageCode; // 词库语言，缺省视为 'en'（旧数据无需迁移）
}

// 词库元数据文档结构（存储词库列表，不包含单词）
interface WordBankMetaDoc {
  _id: string;
  _rev?: string;
  type: 'wordbank-meta';
  banks: Omit<WordBank, 'words'>[];  // 词库列表（不包含单词数据）
  updatedAt: number;
}

/** 词库 → 元数据（新增字段时只需改这里） */
function toBankMeta(b: WordBank): Omit<WordBank, 'words'> {
  return {
    id: b.id,
    name: b.name,
    createdAt: b.createdAt,
    updatedAt: b.updatedAt,
    isDefault: b.isDefault,
    language: b.language,
  };
}

// 词库数据分片文档结构
interface WordBankChunkDoc {
  _id: string;
  _rev?: string;
  type: 'wordbank-chunk';
  bankId: string;
  chunkIndex: number;   // 分片索引
  /**
   * 总分片数。
   * 注意：此字段非权威——桌面读路径（getWordBankChunkDocs/updateWordInBankChunk）
   * 一律按「顺序扫到首个缺失分片即停」定位分片边界，不读本字段。
   * merge 写（updateWordInBankChunk）按定位时快照填写，可能小于实际分片数，勿据此截断读取。
   */
  totalChunks: number;
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

// 最早期 per-word 文档前缀（每个单词一个文档）
const LEGACY_WORDS_PREFIX = 'words-list';

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
    // 尝试读取所有分片，直到取不到为止（不再限制分片数量，避免大词库被静默截断）
    for (let i = 0; ; i++) {
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
      // 新分片写入成功后再删除多余的旧分片
      await deleteExtraWordBankChunks(bankId, 1);
      return true;
    }

    // 保存每个分片（同 id 覆盖写旧分片）
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

    // 新分片全部写入成功后再删除多余的旧分片，避免中途崩溃导致整库丢词
    await deleteExtraWordBankChunks(bankId, totalChunks);

    console.log(`[WordBankManager] 成功保存词库 ${bankId}，共 ${totalChunks} 个分片，${cleanedWords.length} 个单词`);
    return true;
  } catch (e) {
    console.error(`保存词库数据异常 (${bankId}):`, e);
    return false;
  }
}

/**
 * 删除索引 >= startIndex 的旧分片（用于新分片写入成功后清理多余旧数据）
 */
async function deleteExtraWordBankChunks(bankId: string, startIndex: number): Promise<void> {
  const db = getDbAdapter();
  // 旧分片索引是连续的，遇到第一个不存在的分片即可停止
  for (let i = startIndex; ; i++) {
    const docId = getWordBankChunkId(bankId, i);
    const existingDoc = db.get(docId) as WordBankChunkDoc | null;
    if (!existingDoc?._rev) {
      break;
    }
    await db.promises.remove({ _id: docId, _rev: existingDoc._rev });
  }
}

/**
 * 按分片 merge 写更新单词（复习热路径：一次只写一词，避免整库重写）
 *
 * 双窗口（主窗口 + 专注浮窗）并发写同一词库时，uTools 的 _rev 校验会拒绝陈旧写入；
 * 冲突重试前先重新 db.get 取最新分片，保住对方窗口刚写入的同分片其他单词进度。
 *
 * @param bankId 词库ID
 * @param word 要更新/追加的单词
 * @returns 是否写入成功
 */
export async function updateWordInBankChunk(bankId: string, word: Word): Promise<boolean> {
  const db = getDbAdapter();
  const cleanedWord: Word = { ...cloneDeep(word), text: normalizeItemText(word.text) };
  const MAX_RETRY = 3; // conflict 时重读重试的最大次数

  for (let attempt = 0; ; attempt++) {
    // 1. 定位单词所在分片（顺序扫，分片索引连续，遇到缺失即停，找到即停）
    let targetChunkIndex = -1;
    let lastChunkIndex = -1;
    let lastChunkWordCount = 0;
    for (let i = 0; ; i++) {
      const doc = db.get(getWordBankChunkId(bankId, i)) as WordBankChunkDoc | null;
      if (!doc || doc.type !== 'wordbank-chunk') break;
      lastChunkIndex = i;
      lastChunkWordCount = doc.words.length;
      const hitById = !!cleanedWord._id && doc.words.some(w => w._id === cleanedWord._id);
      const hitByText = doc.words.some(w => normalizeItemText(w.text) === cleanedWord.text);
      if (hitById || hitByText) {
        targetChunkIndex = i;
        break;
      }
    }

    // 全部分片都没有该词：落到最后一个分片；最后分片已满则新开一片
    if (targetChunkIndex === -1) {
      targetChunkIndex = (lastChunkIndex === -1 || lastChunkWordCount >= MAX_WORDS_PER_CHUNK)
        ? lastChunkIndex + 1
        : lastChunkIndex;
    }

    const chunkId = getWordBankChunkId(bankId, targetChunkIndex);

    // 2. put 前重新取最新分片（拿到对方窗口刚写入的其他单词进度）
    const latestDoc = db.get(chunkId) as WordBankChunkDoc | null;
    const mergedWords: Word[] = (latestDoc && latestDoc.type === 'wordbank-chunk') ? cloneDeep(latestDoc.words) : [];

    // 3. 在最新分片中替换该词（_id 优先、text 兜底，无匹配则 push）
    const indexById = cleanedWord._id ? mergedWords.findIndex(w => w._id === cleanedWord._id) : -1;
    if (indexById !== -1) {
      mergedWords.splice(indexById, 1, cleanedWord);
    } else {
      const indexByText = mergedWords.findIndex(w => normalizeItemText(w.text) === cleanedWord.text);
      if (indexByText !== -1) {
        mergedWords.splice(indexByText, 1, cleanedWord);
      } else {
        mergedWords.push(cleanedWord);
      }
    }

    const doc: WordBankChunkDoc = {
      _id: chunkId,
      type: 'wordbank-chunk',
      bankId,
      chunkIndex: targetChunkIndex,
      totalChunks: Math.max(targetChunkIndex + 1, lastChunkIndex + 1),
      words: mergedWords,
      updatedAt: Date.now()
    };
    if (latestDoc?._rev) {
      doc._rev = latestDoc._rev;
    }

    // 4. 带最新 _rev put；conflict 时重读重试
    const result = await db.promises.put(doc);
    if (result.ok) {
      return true;
    }
    if (!result.message?.includes('conflict') || attempt >= MAX_RETRY) {
      console.error(`[WordBankManager] 分片单词更新失败 (${bankId}, chunk ${targetChunkIndex}):`, result.message);
      return false;
    }
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
export async function deleteWordBankDataDoc(bankId: string): Promise<boolean> {
  try {
    const db = getDbAdapter();
    // 删除所有分片，直到遇到第一个不存在的分片为止（不再限制分片数量）
    for (let i = 0; ; i++) {
      const docId = getWordBankChunkId(bankId, i);
      const existingDoc = db.get(docId) as WordBankChunkDoc | null;

      if (existingDoc?._rev) {
        await db.promises.remove({ _id: docId, _rev: existingDoc._rev });
      } else {
        // 分片索引是连续的，第一个缺失的分片说明后面也没有了
        break;
      }
    }
    return true;
  } catch (e) {
    console.error(`删除词库数据失败 (${bankId}):`, e);
    return false;
  }
}

// 迁移进行中的 Promise，防止并发重复迁移
let _migrationPromise: Promise<boolean> | null = null;

/**
 * 检查并迁移旧版数据
 *
 * 迁移顺序：wordbank_data（单文档）→ words-list_*（per-word 文档）。
 * 三种历史存储格式：
 *   1. words-list_<uuid> — 最早期，每个单词一个文档
 *   2. wordbank_data — 中期，单个文档存所有词库
 *   3. chunked（当前）— 分片存储
 *
 * 安全保证：先写 chunks，再写 meta。只有 chunks 写入成功后才写 meta，
 * 确保清理函数看到 meta 时数据已在 chunks 中。
 */
async function migrateOldDataIfNeeded(): Promise<boolean> {
  // 已检查过则跳过
  if (_migrationChecked) return false;
  // 防止并发：如果迁移正在进行，等待它完成
  if (_migrationPromise) return _migrationPromise;
  _migrationPromise = (async () => {
    try {
      const db = getDbAdapter();
      // 检查是否已有新版数据
      const metaDoc = getWordBankMetaDoc();
      if (metaDoc?.banks && metaDoc.banks.length > 0) {
        _migrationChecked = true;
        return false; // 已有新版数据，不需要迁移
      }

      // ── 迁移路径 1：wordbank_data（中期单文档格式）──
      const oldDoc = db.get(OLD_WORDBANK_DOC_ID) as any;
      if (oldDoc?.data && Array.isArray(oldDoc.data) && oldDoc.data.length > 0) {
        console.log('[WordBankManager] 发现旧版数据，开始迁移...');

        // 迁移数据到新格式
        const banks: WordBank[] = oldDoc.data;
        const metaBanks = banks.map(b => ({
          ...toBankMeta(b),
          name: b.name === '我的词库' ? '默认词库' : (b.name === '基础词库' ? '默认词库' : b.name),
        }));

        // 先写 chunks（单词数据），再写 meta（元数据）
        // 这样清理函数看到 meta 时，chunks 已经写入成功
        for (const bank of banks) {
          const cleanedWords = bank.words.map(w => ({ ...w, text: normalizeItemText(w.text) }));
          const success = await saveWordBankDataDoc(bank.id, cleanedWords);
          if (!success) {
            console.error('[WordBankManager] chunk 写入失败，跳过 meta 写入以保护数据');
            _migrationChecked = true;
            return false;
          }
        }
        await saveWordBankMetaDoc(metaBanks);

        console.log('[WordBankManager] 数据迁移完成');
        _migrationChecked = true;
        return true;
      }

      // ── 迁移路径 2：words-list_*（最早期 per-word 文档格式）──
      const legacyWords = db.allDocs<Word & { _rev?: string }>(LEGACY_WORDS_PREFIX);
      if (legacyWords.length > 0) {
        console.log(`[WordBankManager] 发现 ${legacyWords.length} 个 words-list_* 文档，开始迁移...`);

        const defaultBank = createDefaultWordBank();
        const cleanedWords = legacyWords.map(w => ({ ...w, text: normalizeItemText(w.text) }));

        // 先写 chunks，再写 meta
        const success = await saveWordBankDataDoc(defaultBank.id, cleanedWords);
        if (!success) {
          console.error('[WordBankManager] chunk 写入失败，跳过 meta 写入以保护数据');
          _migrationChecked = true;
          return false;
        }
        await saveWordBankMetaDoc([toBankMeta(defaultBank)]);

        console.log('[WordBankManager] words-list_* 迁移完成');
        _migrationChecked = true;
        return true;
      }

      _migrationChecked = true;
      return false;
    } catch (e) {
      console.error('[WordBankManager] 数据迁移失败:', e);
      _migrationChecked = true;
      return false;
    } finally {
      _migrationPromise = null;
    }
  })();
  return _migrationPromise;
}

/**
 * 获取所有词库的元数据列表（不包含单词，不读取任何分片）
 * 只读 meta 文档，用于词库切换、存在性检查等不需要单词数据的场景
 */
export async function getAllWordBankMetas(): Promise<Omit<WordBank, 'words'>[]> {
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

    return cloneDeep(metaDoc.banks);
  }

  // 如果没有数据，创建默认词库
  const defaultBank = createDefaultWordBank();
  const { words: _, ...defaultBankMeta } = defaultBank;
  await saveWordBankMetaDoc([defaultBankMeta]);
  await saveWordBankDataDoc(defaultBank.id, defaultBank.words);
  return [defaultBankMeta];
}

/**
 * 获取所有词库列表
 */
export async function getAllWordBanks(): Promise<WordBank[]> {
  const metas = await getAllWordBankMetas();

  // 从各个分片加载单词并合并
  return metas.map(bankMeta => {
    const words = getWordBankWords(bankMeta.id);
    return {
      ...bankMeta,
      words
    } as WordBank;
  });
}

/**
 * 获取当前选中的词库ID
 */
export async function getCurrentWordBankId(): Promise<string> {
  try {
    const id = localStorage.getItem(CURRENT_WORDBANK_KEY);
    if (id) {
      // 检查词库是否存在（只读 meta，不加载单词分片）
      const banks = await getAllWordBankMetas();
      if (banks.find(b => b.id === id)) {
        return id;
      }
    }
  } catch (e) {
    console.error('获取当前词库ID失败:', e);
  }
  // 返回默认词库ID
  const banks = await getAllWordBankMetas();
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
 * @param language 词库语言（可选，缺省 'en'）
 */
export async function createWordBank(name: string, words: Word[] = [], language?: LanguageCode): Promise<WordBank> {
  const bank: WordBank = {
    id: uuidv4(),
    name: name.trim() || '未命名词库',
    words: cloneDeep(words),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    language: language || 'en'
  };

  const banks = await getAllWordBankMetas();
  banks.push(toBankMeta(bank));

  // 保存元数据
  await saveWordBankMetaDoc(banks);
  // 保存单词数据（分片存储）
  await saveWordBankDataDoc(bank.id, bank.words);
  
  return bank;
}

/**
 * 保存词库（新增或更新）
 * 只更新 meta 中该词库的元数据 + 重写该词库分片，不再全量加载所有词库
 */
export async function saveWordBank(bank: WordBank): Promise<boolean> {
  // 只读 meta 定位/追加该词库（metaDoc 为空时内部走创建默认词库的兜底逻辑）
  const banks = await getAllWordBankMetas();

  bank.updatedAt = Date.now();

  const index = banks.findIndex(b => b.id === bank.id);
  if (index >= 0) {
    banks[index] = toBankMeta(bank);
  } else {
    banks.push(toBankMeta(bank));
  }

  // 保存元数据
  const metaSuccess = await saveWordBankMetaDoc(banks);
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

    // 同步墓碑：词库 id + 库内每个单词的 _id 都埋点，
    // 防止词库/单词在另一台设备上「删除复活」
    recordTombstone(id);
    for (const w of bank?.words || []) {
      if (w._id) recordTombstone(w._id);
    }

    const banks = await getAllWordBanks();
    const filtered = banks.filter(b => b.id !== id);
    
    // 保存元数据（不包含被删除的词库）
    const metaBanks = filtered.map(toBankMeta);
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
 * 轻量路径：只改 meta，不加载单词分片
 */
export async function updateWordBankName(id: string, name: string): Promise<boolean> {
  await migrateOldDataIfNeeded();

  const metaDoc = getWordBankMetaDoc();
  if (!metaDoc?.banks || !Array.isArray(metaDoc.banks)) return false;

  const metaBanks = cloneDeep(metaDoc.banks);
  const bankMeta = metaBanks.find(b => b.id === id);
  if (!bankMeta) return false;

  bankMeta.name = name.trim() || bankMeta.name;
  bankMeta.updatedAt = Date.now();

  return await saveWordBankMetaDoc(metaBanks);
}

/**
 * 更新词库单词列表
 * 轻量路径：直接重写该词库分片 + 更新 meta 的 updatedAt，不加载任何单词
 */
export async function updateWordBankWords(id: string, words: Word[]): Promise<boolean> {
  await migrateOldDataIfNeeded();

  const metaDoc = getWordBankMetaDoc();
  if (!metaDoc?.banks || !metaDoc.banks.some(b => b.id === id)) return false;

  // diff 前后单词列表，找出被移除的单词并埋墓碑（diff 式整数组传入时捕获词条删除）
  const oldWords = getWordBankWords(id);
  const newIds = new Set(words.map(w => w._id).filter(Boolean));
  for (const oldWord of oldWords) {
    if (oldWord._id && !newIds.has(oldWord._id)) {
      recordTombstone(oldWord._id);
    }
  }

  // 先写分片，成功后再更新 meta
  const dataSuccess = await saveWordBankDataDoc(id, cloneDeep(words));
  if (!dataSuccess) return false;

  const metaBanks = cloneDeep(metaDoc.banks);
  const bankMeta = metaBanks.find(b => b.id === id);
  if (bankMeta) {
    bankMeta.updatedAt = Date.now();
  }

  return await saveWordBankMetaDoc(metaBanks);
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
