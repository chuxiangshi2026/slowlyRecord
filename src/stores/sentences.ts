/**
 * 句子库 store
 * 收集唯美句子、喜欢的心得等长文本，仅做收藏展示，不参与间隔重复调度
 */
import { defineStore } from 'pinia';
import type { Sentence } from '@/types/sentences';
import { loadSentencesDoc, saveSentences } from '@/utils/sentence-db';
import { detectTextLanguage } from '@/utils/text-memory-util';
import { normalizeItemText } from '@/utils/text-utils';

// 生成唯一ID
function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

// 写入队列：串行化所有写操作，避免并发读-改-写竞态
let writeQueue: Promise<any> = Promise.resolve();
function enqueueWrite<T>(fn: () => Promise<T>): Promise<T> {
  const run = writeQueue.then(fn, fn);
  writeQueue = run.catch(() => {});
  return run;
}

/** detectTextLanguage 的结果映射到句子库的 lang 字段 */
function toSentenceLang(text: string): Sentence['lang'] {
  const lang = detectTextLanguage(text);
  if (lang === 'zh') return 'zh';
  if (lang === 'en') return 'en';
  return 'other';
}

interface SentencesState {
  sentences: Sentence[];
  loading: boolean;
  loaded: boolean;
}

export const useSentencesStore = defineStore('sentences', {
  state: (): SentencesState => ({
    sentences: [],
    loading: false,
    loaded: false
  }),

  getters: {
    /** 收藏优先，其余按创建时间倒序 */
    sortedSentences: (state): Sentence[] => {
      return [...state.sentences].sort((a, b) => {
        if (a.favorite !== b.favorite) return a.favorite ? -1 : 1;
        return b.createdAt - a.createdAt;
      });
    },

    /** 所有标签（去重） */
    allTags: (state): string[] => {
      const tagSet = new Set<string>();
      state.sentences.forEach(s => s.tags.forEach(t => tagSet.add(t)));
      return Array.from(tagSet);
    },

    /** 按关键词搜索（原句/译文/备注/来源） */
    search: (state) => {
      return (keyword: string): Sentence[] => {
        const kw = keyword.trim().toLowerCase();
        if (!kw) return state.sentences;
        return state.sentences.filter(s =>
          s.text.toLowerCase().includes(kw) ||
          (s.translation || '').toLowerCase().includes(kw) ||
          (s.note || '').toLowerCase().includes(kw) ||
          (s.source || '').toLowerCase().includes(kw)
        );
      };
    }
  },

  actions: {
    /**
     * 加载句子库（幂等，重复调用直接返回）
     */
    async load() {
      if (this.loaded) return;
      this.loading = true;
      try {
        const doc = await loadSentencesDoc();
        this.sentences = doc?.sentences && Array.isArray(doc.sentences) ? doc.sentences : [];
        this.loaded = true;
      } catch (e) {
        console.error('加载句子库失败:', e);
        this.sentences = [];
      } finally {
        this.loading = false;
      }
    },

    /**
     * 添加句子，同文本去重
     */
    async add(text: string, extra: Partial<Omit<Sentence, 'id' | 'text' | 'createdAt'>> = {}): Promise<{ success: boolean; message: string; sentence?: Sentence }> {
      const cleaned = normalizeItemText(text);
      if (!cleaned) {
        return { success: false, message: '不能添加空句子' };
      }
      await this.load();
      const key = cleaned.toLowerCase();
      if (this.sentences.some(s => s.text.toLowerCase() === key)) {
        return { success: false, message: '句子已存在' };
      }
      return enqueueWrite(async () => {
        const sentence: Sentence = {
          id: `sentence_${generateId()}`,
          text: cleaned,
          lang: extra.lang ?? toSentenceLang(cleaned),
          tags: extra.tags ?? [],
          favorite: extra.favorite ?? false,
          createdAt: Date.now(),
          ...(extra.translation ? { translation: extra.translation } : {}),
          ...(extra.note ? { note: extra.note } : {}),
          ...(extra.source ? { source: extra.source } : {})
        };
        this.sentences.push(sentence);
        const res = await saveSentences(this.sentences);
        if (!res.success) {
          this.sentences = this.sentences.filter(s => s.id !== sentence.id);
          return { success: false, message: res.error || '保存失败' };
        }
        return { success: true, message: '已加入句子库', sentence };
      });
    },

    /**
     * 删除句子
     */
    async remove(id: string): Promise<{ success: boolean; message: string }> {
      await this.load();
      return enqueueWrite(async () => {
        const backup = this.sentences;
        this.sentences = this.sentences.filter(s => s.id !== id);
        if (this.sentences.length === backup.length) {
          return { success: false, message: '句子不存在' };
        }
        const res = await saveSentences(this.sentences);
        if (!res.success) {
          this.sentences = backup;
          return { success: false, message: res.error || '保存失败' };
        }
        return { success: true, message: '已删除' };
      });
    },

    /**
     * 更新句子字段（标签/备注/来源/译文/收藏）
     */
    async update(id: string, patch: Partial<Omit<Sentence, 'id' | 'createdAt'>>): Promise<{ success: boolean; message: string }> {
      await this.load();
      return enqueueWrite(async () => {
        const index = this.sentences.findIndex(s => s.id === id);
        if (index < 0) {
          return { success: false, message: '句子不存在' };
        }
        const backup = this.sentences[index];
        this.sentences[index] = { ...backup, ...patch, id: backup.id, createdAt: backup.createdAt };
        const res = await saveSentences(this.sentences);
        if (!res.success) {
          this.sentences[index] = backup;
          return { success: false, message: res.error || '保存失败' };
        }
        return { success: true, message: '已更新' };
      });
    }
  }
});
