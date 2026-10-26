import {ref} from 'vue'
import {defineStore} from 'pinia'
import {getDbAdapter, type DbReturn} from '@/adapters/index'
import {
  appendWordBookPages,
  completeWordBookPage,
  createWordBookChapter,
  isWordBookChapterUnlocked,
  isWordBookPageUnlocked,
  WORD_BOOK_DB_PREFIX,
} from '@/utils/word-book'
import type {WordBookChapter, WordBookWord} from '../types/word-book'

export const useWordBook = defineStore('mobileWordBook', () => {
  const chapters = ref<WordBookChapter[]>([])
  const loaded = ref(false)
  const draftWords = ref<WordBookWord[]>([])
  const draftName = ref('')

  function load() {
    if (loaded.value) return
    chapters.value = getDbAdapter()
      .allDocs<WordBookChapter>(WORD_BOOK_DB_PREFIX)
      .filter(doc => doc.type === 'word_book_chapter')
      .map(doc => ({...doc, _id: doc._id.slice(WORD_BOOK_DB_PREFIX.length)}))
      .sort((a, b) => a.ctime - b.ctime)
    loaded.value = true
  }

  function getChapter(chapterId: string): WordBookChapter | undefined {
    return chapters.value.find(chapter => chapter._id === chapterId)
  }

  function replaceLocal(chapter: WordBookChapter) {
    const index = chapters.value.findIndex(item => item._id === chapter._id)
    if (index >= 0) chapters.value[index] = chapter
    else chapters.value.push(chapter)
    chapters.value = [...chapters.value].sort((a, b) => a.ctime - b.ctime)
  }

  function persist(chapter: WordBookChapter): DbReturn {
    const id = WORD_BOOK_DB_PREFIX + chapter._id
    const existing = getDbAdapter().get(id)
    const doc = JSON.parse(JSON.stringify({...chapter, _id: id, _rev: existing?._rev}))
    const result = getDbAdapter().put(doc)
    if (result.ok && result.rev) chapter._rev = result.rev
    return result
  }

  function createChapter(name: string, title: string, words: WordBookWord[]) {
    load()
    const chapter = createWordBookChapter(name, title, words)
    const result = persist(chapter)
    if (result.ok) replaceLocal(chapter)
    return {result, chapter}
  }

  function appendChapter(chapterId: string, title: string, words: WordBookWord[]): DbReturn {
    load()
    const current = getChapter(chapterId)
    if (!current) return {ok: false, id: chapterId, error: true, message: '章节不存在'}
    const updated = appendWordBookPages(current, title, words)
    const result = persist(updated)
    if (result.ok) replaceLocal(updated)
    return result
  }

  function completePage(chapterId: string, pageId: string, wrongAttempts: number): DbReturn {
    load()
    const current = getChapter(chapterId)
    if (!current) return {ok: false, id: chapterId, error: true, message: '章节不存在'}
    const updated = completeWordBookPage(current, pageId, wrongAttempts)
    const result = persist(updated)
    if (result.ok) replaceLocal(updated)
    return result
  }

  function deleteChapter(chapterId: string): DbReturn {
    load()
    const id = WORD_BOOK_DB_PREFIX + chapterId
    const existing = getDbAdapter().get(id)
    const result = existing ? getDbAdapter().remove(existing) : {ok: true, id}
    if (result.ok) chapters.value = chapters.value.filter(chapter => chapter._id !== chapterId)
    return result
  }

  function chapterUnlocked(chapterId: string): boolean {
    return isWordBookChapterUnlocked(chapters.value, chapterId)
  }

  function pageUnlocked(chapterId: string, pageId: string): boolean {
    const chapter = getChapter(chapterId)
    return !!chapter && chapterUnlocked(chapterId) && isWordBookPageUnlocked(chapter, pageId)
  }

  function setDraft(words: WordBookWord[], name: string) {
    draftWords.value = words.map(word => ({...word}))
    draftName.value = name
  }

  function clearDraft() {
    draftWords.value = []
    draftName.value = ''
  }

  return {
    chapters,
    loaded,
    draftWords,
    draftName,
    load,
    getChapter,
    createChapter,
    appendChapter,
    completePage,
    deleteChapter,
    chapterUnlocked,
    pageUnlocked,
    setDraft,
    clearDraft,
  }
})
