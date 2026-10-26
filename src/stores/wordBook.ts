import {defineStore} from 'pinia';
import {ref} from 'vue';
import type {DbReturn} from '@/adapters/db';
import {getAllWordBookChapters, removeWordBookChapter, saveWordBookChapter} from '@/utils/word-book-db';
import {
  appendWordBookPages,
  completeWordBookPage,
  createWordBookChapter,
  isWordBookChapterUnlocked,
  isWordBookPageUnlocked,
} from '@/utils/word-book';
import type {WordBookChapter, WordBookWord} from '../types/word-book';

export const useWordBookStore = defineStore('wordBook', () => {
  const chapters = ref<WordBookChapter[]>([]);
  const loading = ref(false);

  async function loadChapters(): Promise<void> {
    loading.value = true;
    try {
      chapters.value = await getAllWordBookChapters();
    } finally {
      loading.value = false;
    }
  }

  function getChapter(chapterId: string): WordBookChapter | undefined {
    return chapters.value.find(chapter => chapter._id === chapterId);
  }

  function replaceLocal(chapter: WordBookChapter): void {
    const index = chapters.value.findIndex(item => item._id === chapter._id);
    if (index >= 0) chapters.value[index] = chapter;
    else chapters.value.push(chapter);
    chapters.value = [...chapters.value].sort((a, b) => a.ctime - b.ctime);
  }

  async function createChapter(name: string, title: string, words: WordBookWord[]) {
    const chapter = createWordBookChapter(name, title, words);
    const result = await saveWordBookChapter(chapter);
    if (result.ok) replaceLocal(chapter);
    return {result, chapter};
  }

  async function appendChapter(chapterId: string, title: string, words: WordBookWord[]): Promise<DbReturn> {
    const current = getChapter(chapterId);
    if (!current) return {ok: false, id: chapterId, error: true, message: '章节不存在'};
    const updated = appendWordBookPages(current, title, words);
    const result = await saveWordBookChapter(updated);
    if (result.ok) replaceLocal(updated);
    return result;
  }

  async function completePage(chapterId: string, pageId: string, wrongAttempts: number): Promise<DbReturn> {
    const current = getChapter(chapterId);
    if (!current) return {ok: false, id: chapterId, error: true, message: '章节不存在'};
    const updated = completeWordBookPage(current, pageId, wrongAttempts);
    const result = await saveWordBookChapter(updated);
    if (result.ok) replaceLocal(updated);
    return result;
  }

  async function deleteChapter(chapterId: string): Promise<DbReturn> {
    const result = await removeWordBookChapter(chapterId);
    if (result.ok) chapters.value = chapters.value.filter(chapter => chapter._id !== chapterId);
    return result;
  }

  function chapterUnlocked(chapterId: string): boolean {
    return isWordBookChapterUnlocked(chapters.value, chapterId);
  }

  function pageUnlocked(chapterId: string, pageId: string): boolean {
    const chapter = getChapter(chapterId);
    return !!chapter && chapterUnlocked(chapterId) && isWordBookPageUnlocked(chapter, pageId);
  }

  return {
    chapters,
    loading,
    loadChapters,
    getChapter,
    createChapter,
    appendChapter,
    completePage,
    deleteChapter,
    chapterUnlocked,
    pageUnlocked,
  };
});
