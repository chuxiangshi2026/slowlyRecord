export interface WordBookWord {
  sourceId: string;
  text: string;
  explains: string;
  phonetic?: string;
}

export interface WordBookPage {
  id: string;
  title: string;
  order: number;
  words: WordBookWord[];
  attempts: number;
  completedAt?: number;
  lastPracticedAt?: number;
  lastScore?: number;
  bestScore?: number;
}

export interface WordBookChapter {
  _id: string;
  _rev?: string;
  type: 'word_book_chapter';
  name: string;
  pages: WordBookPage[];
  ctime: number;
  utime: number;
}

export interface WordBookNamingFilter {
  affixType?: string;
  affixText?: string;
}
