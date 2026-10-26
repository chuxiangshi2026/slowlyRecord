import type {WordBookChapter, WordBookNamingFilter, WordBookPage, WordBookWord} from '../types/word-book';

export const WORD_BOOK_PAGE_SIZE = 12;
export const WORD_BOOK_DB_PREFIX = 'word_book_';

function createId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

export function getWordBookDefaultName(filter: WordBookNamingFilter, bankName = '单词学习'): string {
  const affixText = filter.affixText?.trim() || '';
  const typeName = filter.affixType === 'root' ? '词根' : filter.affixType === 'prefix' ? '前缀' : filter.affixType === 'suffix' ? '后缀' : '词根词缀';
  if (affixText) return `${typeName} ${affixText}`;
  if (filter.affixType) return `${typeName}学习`;
  return bankName.trim() || '单词学习';
}

function buildPages(title: string, words: WordBookWord[], startOrder = 0): WordBookPage[] {
  const pages: WordBookPage[] = [];
  for (let offset = 0; offset < words.length; offset += WORD_BOOK_PAGE_SIZE) {
    const order = startOrder + pages.length + 1;
    pages.push({
      id: createId('page'),
      title: `${title} · 第 ${order} 页`,
      order,
      words: words.slice(offset, offset + WORD_BOOK_PAGE_SIZE).map(word => ({
        sourceId: word.sourceId,
        text: word.text,
        explains: word.explains,
        phonetic: word.phonetic,
      })),
      attempts: 0,
    });
  }
  return pages;
}

function validate(title: string, words: WordBookWord[]): void {
  if (!title.trim()) throw new Error('请输入学习页名称');
  if (words.length === 0) throw new Error('至少需要一个单词');
}

export function createWordBookChapter(name: string, title: string, words: WordBookWord[], now = Date.now()): WordBookChapter {
  if (!name.trim()) throw new Error('请输入章节名称');
  validate(title, words);
  return {
    _id: createId('chapter'),
    type: 'word_book_chapter',
    name: name.trim(),
    pages: buildPages(title.trim(), words),
    ctime: now,
    utime: now,
  };
}

export function appendWordBookPages(chapter: WordBookChapter, title: string, words: WordBookWord[], now = Date.now()): WordBookChapter {
  validate(title, words);
  return {
    ...chapter,
    pages: [...chapter.pages, ...buildPages(title.trim(), words, chapter.pages.length)],
    utime: now,
  };
}

export function isWordBookChapterComplete(chapter: WordBookChapter): boolean {
  return chapter.pages.length > 0 && chapter.pages.every(page => !!page.completedAt);
}

export function isWordBookChapterUnlocked(chapters: WordBookChapter[], chapterId: string): boolean {
  const index = chapters.findIndex(chapter => chapter._id === chapterId);
  return index === 0 || (index > 0 && isWordBookChapterComplete(chapters[index - 1]));
}

export function isWordBookPageUnlocked(chapter: WordBookChapter, pageId: string): boolean {
  const index = chapter.pages.findIndex(page => page.id === pageId);
  return index === 0 || (index > 0 && !!chapter.pages[index - 1].completedAt);
}

export function completeWordBookPage(chapter: WordBookChapter, pageId: string, wrongAttempts: number, now = Date.now()): WordBookChapter {
  const page = chapter.pages.find(item => item.id === pageId);
  if (!page) throw new Error('学习页不存在');
  const score = Math.round(page.words.length / (page.words.length + Math.max(0, wrongAttempts)) * 100);
  return {
    ...chapter,
    pages: chapter.pages.map(item => item.id === pageId ? {
      ...item,
      attempts: item.attempts + 1,
      completedAt: item.completedAt ?? now,
      lastPracticedAt: now,
      lastScore: score,
      bestScore: Math.max(item.bestScore ?? 0, score),
    } : item),
    utime: now,
  };
}

export function advanceWordBookPractice<T>(queue: T[], remembered: boolean): T[] {
  if (queue.length === 0) return [];
  const [current, ...rest] = queue;
  return remembered ? rest : [...rest, current];
}
