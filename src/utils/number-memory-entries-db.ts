import type { NumberMemoryEntry, NumberMemoryNote, NumberMemoryPrompt } from "@/types/number-memory";
import { log } from "@/utils/logger";
import cloneDeep from "lodash.clonedeep";
import { DB_KEY_NUMBER_MEMORY } from "@/constants";
import {getDbAdapter} from "@/adapters/db";

const DB_KEY_PREFIX = DB_KEY_NUMBER_MEMORY + 'entry_';
const NOTE_KEY_PREFIX = DB_KEY_NUMBER_MEMORY + 'note_';
const PROMPT_KEY_PREFIX = DB_KEY_NUMBER_MEMORY + 'prompt_';

/**
 * 生成单调递增的 ID 后缀，避免同一毫秒内多次创建导致 _id 冲突
 * 同毫秒内多次调用会拿到 ts、ts+1、ts+2 ...
 */
let _lastIdTimestamp = 0;
function nextIdTimestamp(): number {
  const now = Date.now();
  _lastIdTimestamp = now > _lastIdTimestamp ? now : _lastIdTimestamp + 1;
  return _lastIdTimestamp;
}

/**
 * 获取所有数字记忆条目
 */
export function getAllEntries(): NumberMemoryEntry[] {
  const db = getDbAdapter();
  const allDocs = db.allDocs(DB_KEY_PREFIX);
  return allDocs
    .filter((doc: any) => doc.type === 'number_memory_entry')
    .sort((a: any, b: any) => b.createdAt - a.createdAt) as NumberMemoryEntry[];
}

/**
 * 根据ID获取条目
 */
export function getEntryById(id: string): NumberMemoryEntry | null {
  const db = getDbAdapter();
  const doc = db.get(id);
  return doc as NumberMemoryEntry || null;
}

/**
 * 保存数字记忆条目
 */
export async function saveEntry(entry: NumberMemoryEntry): Promise<DbReturn> {
  log.i('保存数字记忆条目', entry);
  
  const cleanedData = cloneDeep(entry);
  const db = getDbAdapter();
  const result = await db.promises.put(cleanedData);
  
  if (result.ok) {
    log.d('保存数字记忆条目成功');
  } else if (result.error) {
    log.e('保存数字记忆条目失败', result.message);
  }
  
  return result;
}

/**
 * 创建新条目
 */
export async function createEntry(
  title: string, 
  numbers: string, 
  tags: string[] = [], 
  description?: string
): Promise<DbReturn & { doc?: NumberMemoryEntry }> {
  const now = Date.now();
  const entry: NumberMemoryEntry = {
    _id: DB_KEY_PREFIX + now,
    type: 'number_memory_entry',
    title: title.trim(),
    numbers: numbers.trim(),
    tags,
    description: description?.trim(),
    createdAt: now,
    updatedAt: now,
    reviewCount: 0
  };
  
  const result = await saveEntry(entry);
  return { ...result, doc: result.ok ? entry : undefined };
}

/**
 * 更新条目
 */
export async function updateEntry(entry: NumberMemoryEntry): Promise<DbReturn> {
  entry.updatedAt = Date.now();
  return await saveEntry(entry);
}

/**
 * 删除条目及其关联的笔记和提示词
 */
export async function deleteEntry(id: string): Promise<DbReturn> {
  log.i('删除数字记忆条目', id);
  
  // 删除条目
  const db = getDbAdapter();
  const entry = db.get(id);
  if (entry) {
    await db.promises.remove(entry);
  }
  
  // 删除关联的笔记
  const notes = getNotesByEntryId(id);
  for (const note of notes) {
    await db.promises.remove(note);
  }
  
  // 删除关联的提示词
  const prompts = getPromptsByEntryId(id);
  for (const prompt of prompts) {
    await db.promises.remove(prompt);
  }
  
  return { ok: true, id, rev: '' };
}

/**
 * 获取条目的所有笔记
 */
export function getNotesByEntryId(entryId: string): NumberMemoryNote[] {
  const db = getDbAdapter();
  const allDocs = db.allDocs(NOTE_KEY_PREFIX);
  return allDocs
    .filter((doc: any) => doc.type === 'number_memory_note' && doc.entryId === entryId)
    .sort((a: any, b: any) => b.createdAt - a.createdAt) as NumberMemoryNote[];
}

/**
 * 保存笔记
 */
export async function saveNote(note: NumberMemoryNote): Promise<DbReturn> {
  log.i('保存数字记忆笔记', note);
  
  const cleanedData = cloneDeep(note);
  const db = getDbAdapter();
  const result = await db.promises.put(cleanedData);
  
  if (result.ok) {
    log.d('保存数字记忆笔记成功');
  } else if (result.error) {
    log.e('保存数字记忆笔记失败', result.message);
  }
  
  return result;
}

/**
 * 创建笔记
 */
export async function createNote(entryId: string, content: string): Promise<DbReturn & { doc?: NumberMemoryNote }> {
  const now = nextIdTimestamp();
  const note: NumberMemoryNote = {
    _id: NOTE_KEY_PREFIX + now,
    type: 'number_memory_note',
    entryId,
    content: content.trim(),
    createdAt: now
  };

  const result = await saveNote(note);
  return { ...result, doc: result.ok ? note : undefined };
}

/**
 * 更新笔记
 */
export async function updateNote(note: NumberMemoryNote): Promise<DbReturn> {
  note.updatedAt = Date.now();
  return await saveNote(note);
}

/**
 * 删除笔记
 */
export async function deleteNote(id: string): Promise<DbReturn> {
  log.i('删除数字记忆笔记', id);
  const db = getDbAdapter();
  const note = db.get(id);
  if (note) {
    return await db.promises.remove(note);
  }
  return { ok: true, id, rev: '' };
}

/**
 * 获取条目的所有提示词
 */
export function getPromptsByEntryId(entryId: string): NumberMemoryPrompt[] {
  const db = getDbAdapter();
  const allDocs = db.allDocs(PROMPT_KEY_PREFIX);
  return allDocs
    .filter((doc: any) => doc.type === 'number_memory_prompt' && doc.entryId === entryId)
    .sort((a: any, b: any) => a.order - b.order) as NumberMemoryPrompt[];
}

/**
 * 保存提示词
 */
export async function savePrompt(prompt: NumberMemoryPrompt): Promise<DbReturn> {
  log.i('保存数字记忆提示词', prompt);
  
  const cleanedData = cloneDeep(prompt);
  const db = getDbAdapter();
  const result = await db.promises.put(cleanedData);
  
  if (result.ok) {
    log.d('保存数字记忆提示词成功');
  } else if (result.error) {
    log.e('保存数字记忆提示词失败', result.message);
  }
  
  return result;
}

/**
 * 创建提示词
 */
export async function createPrompt(
  entryId: string,
  title: string,
  content: string,
  order: number,
  enabled: boolean = true
): Promise<DbReturn & { doc?: NumberMemoryPrompt }> {
  const now = nextIdTimestamp();
  const prompt: NumberMemoryPrompt = {
    _id: PROMPT_KEY_PREFIX + now,
    type: 'number_memory_prompt',
    entryId,
    title: title.trim(),
    content: content.trim(),
    order,
    enabled,
    createdAt: now
  };
  
  const result = await savePrompt(prompt);
  return { ...result, doc: result.ok ? prompt : undefined };
}

/**
 * 更新提示词
 */
export async function updatePrompt(prompt: NumberMemoryPrompt): Promise<DbReturn> {
  return await savePrompt(prompt);
}

/**
 * 删除提示词
 */
export async function deletePrompt(id: string): Promise<DbReturn> {
  log.i('删除数字记忆提示词', id);
  const db = getDbAdapter();
  const prompt = db.get(id);
  if (prompt) {
    return await db.promises.remove(prompt);
  }
  return { ok: true, id, rev: '' };
}

/**
 * 重新排序提示词
 */
export async function reorderPrompts(prompts: NumberMemoryPrompt[]): Promise<boolean> {
  try {
    for (let i = 0; i < prompts.length; i++) {
      prompts[i].order = i;
      await savePrompt(prompts[i]);
    }
    return true;
  } catch (error) {
    log.e('重新排序提示词失败', error);
    return false;
  }
}
