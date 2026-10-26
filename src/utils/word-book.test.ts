import {describe, expect, it} from 'vitest';
import {
  advanceWordBookPractice,
  appendWordBookPages,
  completeWordBookPage,
  createWordBookChapter,
  getWordBookDefaultName,
  isWordBookChapterComplete,
  isWordBookChapterUnlocked,
  isWordBookPageUnlocked,
} from './word-book';
import type {WordBookWord} from '../types/word-book';

function words(count: number): WordBookWord[] {
  return Array.from({length: count}, (_, index) => ({
    sourceId: `word-${index}`,
    text: `word${index}`,
    explains: `释义${index}`,
    phonetic: `/w${index}/`,
  }));
}

describe('word-book', () => {
  it('按 12 词分页并只保存学习快照', () => {
    const chapter = createWordBookChapter('词根测试', '词根 spect', words(25), 100);
    expect(chapter.pages.map(page => page.words.length)).toEqual([12, 12, 1]);
    expect(chapter.pages.map(page => page.order)).toEqual([1, 2, 3]);
    expect(chapter.pages[0].title).toBe('词根 spect · 第 1 页');
    expect(chapter.pages[0].words[0]).toEqual({sourceId: 'word-0', text: 'word0', explains: '释义0', phonetic: '/w0/'});
  });

  it('追加学习页时延续章节页码', () => {
    const chapter = createWordBookChapter('章节', '第一组', words(13), 100);
    const appended = appendWordBookPages(chapter, '第二组', words(3), 200);
    expect(appended.pages).toHaveLength(3);
    expect(appended.pages[2].title).toBe('第二组 · 第 3 页');
    expect(appended.pages[2].order).toBe(3);
    expect(chapter.pages).toHaveLength(2);
  });

  it('根据词根词缀筛选生成默认名称', () => {
    expect(getWordBookDefaultName({affixType: 'root', affixText: ' spect '}, '默认词库')).toBe('词根 spect');
    expect(getWordBookDefaultName({affixType: 'prefix', affixText: ''}, '默认词库')).toBe('前缀学习');
    expect(getWordBookDefaultName({}, '默认词库')).toBe('默认词库');
  });

  it('首页解锁，完成一页后解锁下一页', () => {
    const chapter = createWordBookChapter('章节', '学习页', words(13), 100);
    expect(isWordBookPageUnlocked(chapter, chapter.pages[0].id)).toBe(true);
    expect(isWordBookPageUnlocked(chapter, chapter.pages[1].id)).toBe(false);
    const completed = completeWordBookPage(chapter, chapter.pages[0].id, 2, 200);
    expect(isWordBookPageUnlocked(completed, completed.pages[1].id)).toBe(true);
    expect(completed.pages[0].lastScore).toBe(86);
    expect(completed.pages[0].bestScore).toBe(86);
    expect(completed.pages[0].attempts).toBe(1);
  });

  it('整章完成后才解锁下一章，重复练习保留首次完成时间和最佳成绩', () => {
    const first = createWordBookChapter('第一章', '学习页', words(1), 100);
    const second = createWordBookChapter('第二章', '学习页', words(1), 101);
    expect(isWordBookChapterUnlocked([first, second], second._id)).toBe(false);
    const once = completeWordBookPage(first, first.pages[0].id, 1, 200);
    expect(isWordBookChapterComplete(once)).toBe(true);
    expect(isWordBookChapterUnlocked([once, second], second._id)).toBe(true);
    const twice = completeWordBookPage(once, first.pages[0].id, 0, 300);
    expect(twice.pages[0].completedAt).toBe(200);
    expect(twice.pages[0].bestScore).toBe(100);
    expect(twice.pages[0].attempts).toBe(2);
  });

  it('没记住的卡移到队尾，记住的卡移出本轮', () => {
    const queue = ['a', 'b', 'c'];
    expect(advanceWordBookPractice(queue, false)).toEqual(['b', 'c', 'a']);
    expect(advanceWordBookPractice(queue, true)).toEqual(['b', 'c']);
    expect(queue).toEqual(['a', 'b', 'c']);
    expect(advanceWordBookPractice([], true)).toEqual([]);
  });
});
