/**
 * 听写练习进度记忆（bug-list R20）
 *
 * 听写列表每次加载都会随机打乱，"进度"必须同时记住乱序后的单词顺序与当前下标，
 * 否则重新进入时只能从第 1 个重来。进度按 词库+列表模式 分键保存；
 * 词库内容变化（增删词）时校验集合一致性，不一致则丢弃进度，避免对不上号。
 *
 * 只依赖 localStorage（会话级临时数据，不需要进 DB 同步到其它端）。
 */

export interface DictationProgress {
  ids: string[];
  index: number;
  updatedAt: number;
}

const STORAGE_KEY = 'sr_dictation_progress';

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function defaultStorage(): StorageLike | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

function readAll(storage: StorageLike | null): Record<string, DictationProgress> {
  if (!storage) return {};
  try {
    const raw = storage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function progressKey(bankId: string, listMode: number): string {
  return `${bankId || 'default'}::${listMode}`;
}

/**
 * 保存进度：ids 为当前乱序后的完整单词 id 列表，index 为当前下标
 */
export function saveDictationProgress(
  bankId: string,
  listMode: number,
  ids: string[],
  index: number,
  storage: StorageLike | null = defaultStorage()
): void {
  if (!storage || ids.length === 0) return;
  try {
    const all = readAll(storage);
    all[progressKey(bankId, listMode)] = { ids: [...ids], index, updatedAt: Date.now() };
    storage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch { /* 存储不可用时静默降级：进度记忆是增强能力，不影响主流程 */ }
}

/**
 * 读取进度。currentIds 传当前筛选出的单词 id（任意顺序）：
 * - 集合一致（保存的 ids 与 currentIds 是同一批词）→ 返回保存的进度，
 *   调用方应按保存的 ids 顺序重排列表后从 index 继续；
 * - 不一致（增删词/换了筛选）→ 返回 null，从头开始。
 */
export function loadDictationProgress(
  bankId: string,
  listMode: number,
  currentIds: string[],
  storage: StorageLike | null = defaultStorage()
): DictationProgress | null {
  const saved = readAll(storage)[progressKey(bankId, listMode)];
  if (!saved || !Array.isArray(saved.ids) || saved.ids.length === 0) return null;
  if (typeof saved.index !== 'number' || saved.index < 0) return null;

  const savedSet = new Set(saved.ids);
  const currentSet = new Set(currentIds);
  if (savedSet.size !== currentSet.size) return null;
  for (const id of savedSet) {
    if (!currentSet.has(id)) return null;
  }
  return saved;
}

/** 清除某词库+模式下的进度（一轮听写完成、或用户重置时调用） */
export function clearDictationProgress(
  bankId: string,
  listMode: number,
  storage: StorageLike | null = defaultStorage()
): void {
  if (!storage) return;
  try {
    const all = readAll(storage);
    delete all[progressKey(bankId, listMode)];
    storage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch { /* 同上，静默降级 */ }
}
