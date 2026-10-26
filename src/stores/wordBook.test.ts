// @vitest-environment jsdom
import {beforeEach, describe, expect, it} from 'vitest';
import {createPinia, setActivePinia} from 'pinia';
import 'fake-indexeddb/auto';
import {DbAdapterIndexedDB} from '@/adapters/impl/db-indexeddb';
import {resetDbAdapter, setDbAdapter} from '@/adapters/db';
import {useWordBookStore} from './wordBook';
import type {WordBookWord} from '../types/word-book';

function words(count: number, prefix = 'w'): WordBookWord[] {
  return Array.from({length: count}, (_, index) => ({sourceId: `${prefix}-${index}`, text: `${prefix}${index}`, explains: `释义${index}`}));
}

describe('wordBook store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    resetDbAdapter();
    setDbAdapter(new DbAdapterIndexedDB());
  });

  it('创建、追加、逐级解锁和删除均可持久化', async () => {
    const store = useWordBookStore();
    const first = await store.createChapter('第一章', '词根 spect', words(13));
    const second = await store.createChapter('第二章', '词根 port', words(1, 'p'));
    expect(first.result.ok).toBe(true);
    expect(second.result.ok).toBe(true);
    const firstId = first.chapter._id;
    const secondId = second.chapter._id;
    expect(store.chapterUnlocked(firstId)).toBe(true);
    expect(store.chapterUnlocked(secondId)).toBe(false);
    expect(store.pageUnlocked(firstId, first.chapter.pages[1].id)).toBe(false);

    expect((await store.completePage(firstId, first.chapter.pages[0].id, 1)).ok).toBe(true);
    expect(store.pageUnlocked(firstId, first.chapter.pages[1].id)).toBe(true);
    expect(store.chapterUnlocked(secondId)).toBe(false);
    expect((await store.completePage(firstId, first.chapter.pages[1].id, 0)).ok).toBe(true);
    expect(store.chapterUnlocked(secondId)).toBe(true);

    expect((await store.appendChapter(secondId, '追加一组', words(2, 'a'))).ok).toBe(true);
    setActivePinia(createPinia());
    const restored = useWordBookStore();
    await restored.loadChapters();
    expect(restored.chapters.map(chapter => chapter._id)).toEqual([firstId, secondId]);
    expect(restored.getChapter(firstId)?.pages.every(page => !!page.completedAt)).toBe(true);
    expect(restored.getChapter(secondId)?.pages).toHaveLength(2);

    expect((await restored.deleteChapter(secondId)).ok).toBe(true);
    setActivePinia(createPinia());
    const afterDelete = useWordBookStore();
    await afterDelete.loadChapters();
    expect(afterDelete.chapters.map(chapter => chapter._id)).toEqual([firstId]);
  });
});
