import {getDbAdapter, getDbAdapterAsync, type DbReturn} from '@/adapters/db';
import {WORD_BOOK_DB_PREFIX} from './word-book';
import type {WordBookChapter} from '../types/word-book';

function docId(chapterId: string): string {
  return WORD_BOOK_DB_PREFIX + chapterId;
}

export async function getAllWordBookChapters(): Promise<WordBookChapter[]> {
  await getDbAdapterAsync();
  return getDbAdapter()
    .allDocs<WordBookChapter>(WORD_BOOK_DB_PREFIX)
    .filter(doc => doc.type === 'word_book_chapter')
    .map(doc => ({...doc, _id: doc._id.slice(WORD_BOOK_DB_PREFIX.length)}))
    .sort((a, b) => a.ctime - b.ctime);
}

export async function saveWordBookChapter(chapter: WordBookChapter): Promise<DbReturn> {
  await getDbAdapterAsync();
  const id = docId(chapter._id);
  const existing = getDbAdapter().get(id);
  const doc = JSON.parse(JSON.stringify({...chapter, _id: id, _rev: existing?._rev}));
  const result = await getDbAdapter().promises.put(doc);
  if (result.ok && result.rev) chapter._rev = result.rev;
  return result;
}

export async function removeWordBookChapter(chapterId: string): Promise<DbReturn> {
  await getDbAdapterAsync();
  const id = docId(chapterId);
  const existing = getDbAdapter().get(id);
  if (!existing) return {ok: true, id};
  return getDbAdapter().promises.remove(existing);
}
