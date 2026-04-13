import { defineStore } from 'pinia';
import type {
  TextArticle,
  TextNote,
  TextPrompt,
  FillBlankExercise,
  ChoiceQuestion,
  ExerciseSettings,
  TextMemoryState,
  BlankItem
} from '@/types/text-memory';
import cloneDeep from 'lodash.clonedeep';

// 存储键名
const TEXTMEMORY_DOC_ID = 'slowlyrecord-textmemory-data';
const TEXTMEMORY_PROGRESS_KEY = 'slowlyrecord-textmemory-progress';

// 文本记忆数据结构
interface TextMemoryDoc {
  _id: string;
  _rev?: string;
  type: 'textmemory';
  articles: TextArticle[];
  notes: TextNote[];
  prompts: TextPrompt[];
  updatedAt: number;
}

// 学习进度数据结构
interface LearningProgress {
  articleId: string;
  exerciseType: 'fillBlanks' | 'choice' | 'typing';
  progress: any;
  lastAccessTime: number;
}

// 获取 uTools db 实例
function getDb() {
  if (typeof window === 'undefined' || !window.utools?.db) {
    console.warn('uTools db 不可用');
    return null;
  }
  return window.utools.db;
}

// 生成唯一ID
function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// 默认练习设置
const defaultSettings: ExerciseSettings = {
  blankCount: 10,
  choiceCount: 5,
  showPinyin: false,
  highlightKeywords: true
};

export const useTextMemoryStore = defineStore('textMemory', {
  state: (): TextMemoryState => ({
    articles: [],
    currentArticle: null,
    currentNotes: [],
    currentPrompts: [],
    exerciseSettings: { ...defaultSettings },
    loading: false
  }),

  getters: {
    // 获取文章总数
    totalArticles: (state) => state.articles.length,

    // 按时间排序的文章列表
    sortedArticles: (state) => {
      return [...state.articles].sort((a, b) => b.ctime - a.ctime);
    },

    // 按标签分组的文章
    articlesByTag: (state) => {
      const grouped: Record<string, TextArticle[]> = {};
      state.articles.forEach(article => {
        article.tags.forEach(tag => {
          if (!grouped[tag]) {
            grouped[tag] = [];
          }
          grouped[tag].push(article);
        });
      });
      return grouped;
    },

    // 所有标签
    allTags: (state) => {
      const tagSet = new Set<string>();
      state.articles.forEach(article => {
        article.tags.forEach(tag => tagSet.add(tag));
      });
      return Array.from(tagSet);
    },

    // 当前文章的字数
    currentArticleWordCount: (state) => {
      if (!state.currentArticle) return 0;
      return state.currentArticle.content.length;
    }
  },

  actions: {
    // ============ 数据库操作 ============

    /**
     * 获取文本记忆文档
     */
    async getTextMemoryDoc(): Promise<TextMemoryDoc | null> {
      try {
        const db = getDb();
        if (!db) return null;
        const doc = await db.promises.get(TEXTMEMORY_DOC_ID) as TextMemoryDoc | null;
        return doc;
      } catch (e) {
        console.error('获取文本记忆文档失败:', e);
        return null;
      }
    },

    /**
     * 保存文本记忆文档
     */
    async saveTextMemoryDoc(data: Partial<TextMemoryDoc>): Promise<boolean> {
      try {
        const db = getDb();
        if (!db) {
          console.warn('数据库不可用，数据将保存在内存中');
          return false;
        }

        const existingDoc = await this.getTextMemoryDoc();
        const doc: TextMemoryDoc = {
          _id: TEXTMEMORY_DOC_ID,
          type: 'textmemory',
          articles: data.articles ?? existingDoc?.articles ?? [],
          notes: data.notes ?? existingDoc?.notes ?? [],
          prompts: data.prompts ?? existingDoc?.prompts ?? [],
          updatedAt: Date.now()
        };

        if (existingDoc?._rev) {
          doc._rev = existingDoc._rev;
        }

        const result = await db.promises.put(doc);
        return result.ok ?? false;
      } catch (e) {
        console.error('保存文本记忆文档失败:', e);
        return false;
      }
    },

    // ============ 文章操作 ============

    /**
     * 加载所有文章
     */
    async loadArticles() {
      this.loading = true;
      try {
        const doc = await this.getTextMemoryDoc();
        if (doc?.articles && Array.isArray(doc.articles)) {
          this.articles = cloneDeep(doc.articles);
        } else {
          this.articles = [];
        }
      } catch (error) {
        console.error('加载文章失败:', error);
        this.articles = [];
      } finally {
        this.loading = false;
      }
    },

    /**
     * 添加文章
     */
    async addArticle(article: Omit<TextArticle, '_id' | '_rev' | 'ctime' | 'utime' | 'reviewCount'>) {
      try {
        const now = Date.now();
        const newArticle: TextArticle = {
          ...article,
          _id: `article_${generateId()}`,
          ctime: now,
          utime: now,
          reviewCount: 0
        };

        const doc = await this.getTextMemoryDoc();
        const articles = doc?.articles ? cloneDeep(doc.articles) : [];
        articles.push(newArticle);

        const success = await this.saveTextMemoryDoc({ articles });
        if (success) {
          this.articles.push(newArticle);
          return { success: true, data: newArticle };
        }
        return { success: false, error: '保存失败' };
      } catch (error) {
        console.error('添加文章失败:', error);
        return { success: false, error: String(error) };
      }
    },

    /**
     * 更新文章
     */
    async updateArticle(article: TextArticle) {
      try {
        const updatedArticle = {
          ...article,
          utime: Date.now()
        };

        const doc = await this.getTextMemoryDoc();
        if (!doc?.articles) {
          return { success: false, error: '数据不存在' };
        }

        const articles = cloneDeep(doc.articles);
        const index = articles.findIndex((a: TextArticle) => a._id === updatedArticle._id);
        if (index !== -1) {
          articles[index] = updatedArticle;
        }

        const success = await this.saveTextMemoryDoc({ articles });
        if (success) {
          const localIndex = this.articles.findIndex(a => a._id === updatedArticle._id);
          if (localIndex !== -1) {
            this.articles[localIndex] = updatedArticle;
          }
          if (this.currentArticle?._id === updatedArticle._id) {
            this.currentArticle = updatedArticle;
          }
          return { success: true, data: updatedArticle };
        }
        return { success: false, error: '更新失败' };
      } catch (error) {
        console.error('更新文章失败:', error);
        return { success: false, error: String(error) };
      }
    },

    /**
     * 删除文章
     */
    async deleteArticle(articleId: string) {
      try {
        const doc = await this.getTextMemoryDoc();
        if (!doc) return { success: false, error: '数据不存在' };

        const article = this.articles.find(a => a._id === articleId);
        if (!article) return { success: false, error: '文章不存在' };

        // 删除文章
        const articles = doc.articles.filter((a: TextArticle) => a._id !== articleId);
        
        // 删除关联的笔记
        const notes = doc.notes.filter((n: TextNote) => n.articleId !== articleId);
        
        // 删除关联的提示词
        const prompts = doc.prompts.filter((p: TextPrompt) => p.articleId !== articleId);

        const success = await this.saveTextMemoryDoc({ articles, notes, prompts });
        if (success) {
          this.articles = this.articles.filter(a => a._id !== articleId);
          
          if (this.currentArticle?._id === articleId) {
            this.currentArticle = null;
            this.currentNotes = [];
            this.currentPrompts = [];
          }
          
          // 删除该文章的学习进度
          this.clearLearningProgress(articleId);
          
          return { success: true };
        }
        return { success: false, error: '删除失败' };
      } catch (error) {
        console.error('删除文章失败:', error);
        return { success: false, error: String(error) };
      }
    },

    /**
     * 设置当前文章
     */
    setCurrentArticle(article: TextArticle | null) {
      this.currentArticle = article;
      if (article) {
        this.loadNotes(article._id);
        this.loadPrompts(article._id);
      } else {
        this.currentNotes = [];
        this.currentPrompts = [];
      }
    },

    /**
     * 更新复习次数
     */
    async updateReviewCount(articleId: string) {
      const article = this.articles.find(a => a._id === articleId);
      if (article) {
        article.reviewCount++;
        article.lastReviewTime = Date.now();
        await this.updateArticle(article);
      }
    },

    // ============ 笔记操作 ============

    /**
     * 加载笔记
     */
    async loadNotes(articleId: string) {
      try {
        const doc = await this.getTextMemoryDoc();
        if (doc?.notes && Array.isArray(doc.notes)) {
          this.currentNotes = doc.notes
            .filter((n: TextNote) => n.articleId === articleId)
            .sort((a: TextNote, b: TextNote) => b.ctime - a.ctime);
        } else {
          this.currentNotes = [];
        }
      } catch (error) {
        console.error('加载笔记失败:', error);
        this.currentNotes = [];
      }
    },

    /**
     * 添加笔记
     */
    async addNote(note: Omit<TextNote, '_id' | '_rev' | 'ctime'>) {
      try {
        const newNote: TextNote = {
          ...note,
          _id: `note_${generateId()}`,
          ctime: Date.now()
        };

        const doc = await this.getTextMemoryDoc();
        const notes = doc?.notes ? cloneDeep(doc.notes) : [];
        notes.push(newNote);

        const success = await this.saveTextMemoryDoc({ notes });
        if (success) {
          this.currentNotes.unshift(newNote);
          return { success: true, data: newNote };
        }
        return { success: false, error: '保存失败' };
      } catch (error) {
        console.error('添加笔记失败:', error);
        return { success: false, error: String(error) };
      }
    },

    /**
     * 更新笔记
     */
    async updateNote(note: TextNote) {
      try {
        note.utime = Date.now();

        const doc = await this.getTextMemoryDoc();
        if (!doc?.notes) {
          return { success: false, error: '数据不存在' };
        }

        const notes = cloneDeep(doc.notes);
        const index = notes.findIndex((n: TextNote) => n._id === note._id);
        if (index !== -1) {
          notes[index] = note;
        }

        const success = await this.saveTextMemoryDoc({ notes });
        if (success) {
          const localIndex = this.currentNotes.findIndex(n => n._id === note._id);
          if (localIndex !== -1) {
            this.currentNotes[localIndex] = note;
          }
          return { success: true, data: note };
        }
        return { success: false, error: '更新失败' };
      } catch (error) {
        console.error('更新笔记失败:', error);
        return { success: false, error: String(error) };
      }
    },

    /**
     * 删除笔记
     */
    async deleteNote(noteId: string) {
      try {
        const doc = await this.getTextMemoryDoc();
        if (!doc?.notes) {
          return { success: false, error: '数据不存在' };
        }

        const note = this.currentNotes.find(n => n._id === noteId);
        if (!note) return { success: false, error: '笔记不存在' };

        const notes = doc.notes.filter((n: TextNote) => n._id !== noteId);
        const success = await this.saveTextMemoryDoc({ notes });
        
        if (success) {
          this.currentNotes = this.currentNotes.filter(n => n._id !== noteId);
          return { success: true };
        }
        return { success: false, error: '删除失败' };
      } catch (error) {
        console.error('删除笔记失败:', error);
        return { success: false, error: String(error) };
      }
    },

    // ============ 提示词操作 ============

    /**
     * 加载提示词
     */
    async loadPrompts(articleId: string) {
      try {
        const doc = await this.getTextMemoryDoc();
        if (doc?.prompts && Array.isArray(doc.prompts)) {
          this.currentPrompts = doc.prompts
            .filter((p: TextPrompt) => p.articleId === articleId)
            .sort((a: TextPrompt, b: TextPrompt) => a.order - b.order);
        } else {
          this.currentPrompts = [];
        }
      } catch (error) {
        console.error('加载提示词失败:', error);
        this.currentPrompts = [];
      }
    },

    /**
     * 添加提示词
     */
    async addPrompt(prompt: Omit<TextPrompt, '_id' | '_rev' | 'ctime'>) {
      try {
        const newPrompt: TextPrompt = {
          ...prompt,
          _id: `prompt_${generateId()}`,
          ctime: Date.now()
        };

        const doc = await this.getTextMemoryDoc();
        const prompts = doc?.prompts ? cloneDeep(doc.prompts) : [];
        prompts.push(newPrompt);

        const success = await this.saveTextMemoryDoc({ prompts });
        if (success) {
          this.currentPrompts.push(newPrompt);
          this.currentPrompts.sort((a, b) => a.order - b.order);
          return { success: true, data: newPrompt };
        }
        return { success: false, error: '保存失败' };
      } catch (error) {
        console.error('添加提示词失败:', error);
        return { success: false, error: String(error) };
      }
    },

    /**
     * 更新提示词
     */
    async updatePrompt(prompt: TextPrompt) {
      try {
        const doc = await this.getTextMemoryDoc();
        if (!doc?.prompts) {
          return { success: false, error: '数据不存在' };
        }

        const prompts = cloneDeep(doc.prompts);
        const index = prompts.findIndex((p: TextPrompt) => p._id === prompt._id);
        if (index !== -1) {
          prompts[index] = prompt;
        }

        const success = await this.saveTextMemoryDoc({ prompts });
        if (success) {
          const localIndex = this.currentPrompts.findIndex(p => p._id === prompt._id);
          if (localIndex !== -1) {
            this.currentPrompts[localIndex] = prompt;
          }
          return { success: true, data: prompt };
        }
        return { success: false, error: '更新失败' };
      } catch (error) {
        console.error('更新提示词失败:', error);
        return { success: false, error: String(error) };
      }
    },

    /**
     * 删除提示词
     */
    async deletePrompt(promptId: string) {
      try {
        const doc = await this.getTextMemoryDoc();
        if (!doc?.prompts) {
          return { success: false, error: '数据不存在' };
        }

        const prompt = this.currentPrompts.find(p => p._id === promptId);
        if (!prompt) return { success: false, error: '提示词不存在' };

        const prompts = doc.prompts.filter((p: TextPrompt) => p._id !== promptId);
        const success = await this.saveTextMemoryDoc({ prompts });
        
        if (success) {
          this.currentPrompts = this.currentPrompts.filter(p => p._id !== promptId);
          return { success: true };
        }
        return { success: false, error: '删除失败' };
      } catch (error) {
        console.error('删除提示词失败:', error);
        return { success: false, error: String(error) };
      }
    },

    /**
     * 更新提示词顺序
     */
    async reorderPrompts(prompts: TextPrompt[]) {
      this.currentPrompts = prompts;
      // 批量更新顺序
      for (let i = 0; i < prompts.length; i++) {
        prompts[i].order = i;
      }
      // 保存所有提示词
      const doc = await this.getTextMemoryDoc();
      if (doc) {
        const allPrompts = doc.prompts.filter((p: TextPrompt) => 
          !this.currentPrompts.some(cp => cp._id === p._id)
        );
        allPrompts.push(...cloneDeep(prompts));
        await this.saveTextMemoryDoc({ prompts: allPrompts });
      }
    },

    // ============ 练习相关 ============

    /**
     * 生成填空练习
     */
    generateFillBlanks(articleId: string, content: string, count: number = 10): BlankItem[] {
      const blanks: BlankItem[] = [];
      const sentences = content.split(/[。！？；.!?;]/).filter(s => s.trim().length > 5);

      if (sentences.length === 0) return blanks;

      // 提取关键词（按优先级：4字 > 3字 > 2字，确保不重叠）
      const allWords: { word: string; position: number; priority: number }[] = [];
      
      sentences.forEach((sentence, idx) => {
        const sentenceWords: { word: string; start: number; end: number; priority: number }[] = [];
        
        // 按优先级提取：4字 > 3字 > 2字
        for (let len = 4; len >= 2; len--) {
          for (let i = 0; i <= sentence.length - len; i++) {
            const word = sentence.substring(i, i + len);
            // 过滤掉纯标点、数字、英文
            if (/^[\u4e00-\u9fa5]+$/.test(word)) {
              // 检查是否与已提取的高优先级词重叠
              const overlap = sentenceWords.some(k => 
                k.priority > len && !(i + len <= k.start || i >= k.end)
              );
              if (!overlap) {
                sentenceWords.push({ word, start: i, end: i + len, priority: len });
              }
            }
          }
        }
        
        // 将本句的词加入总列表
        sentenceWords.forEach(w => {
          allWords.push({ word: w.word, position: idx, priority: w.priority });
        });
      });

      if (allWords.length === 0) return blanks;

      // 按优先级排序，同优先级随机
      allWords.sort((a, b) => {
        if (b.priority !== a.priority) return b.priority - a.priority;
        return Math.random() - 0.5;
      });

      // 选择不重复的词语（每句最多选2个）
      const selectedWords: typeof allWords = [];
      const sentenceWordCount = new Map<number, number>();
      
      for (const word of allWords) {
        const currentCount = sentenceWordCount.get(word.position) || 0;
        if (currentCount < 2) { // 每句最多2个
          selectedWords.push(word);
          sentenceWordCount.set(word.position, currentCount + 1);
          
          if (selectedWords.length >= count) break;
        }
      }

      return selectedWords.map(w => ({
        original: w.word,
        position: w.position
      }));
    },

    /**
     * 生成选择题
     */
    generateChoiceQuestions(articleId: string, content: string, count: number = 5): ChoiceQuestion[] {
      const questions: ChoiceQuestion[] = [];
      const sentences = content.split(/[。！？；.!?;]/).filter(s => s.trim().length > 10);

      if (sentences.length === 0) return questions;

      const types: Array<'synonym' | 'antonym' | 'typo' | 'nonsense'> = ['synonym', 'antonym', 'typo', 'nonsense'];

      for (let i = 0; i < Math.min(count, sentences.length); i++) {
        const sentence = sentences[Math.floor(Math.random() * sentences.length)];
        const type = types[Math.floor(Math.random() * types.length)];

        // 提取句子中的关键词（优先4字成语，然后是3字、2字词，确保不重叠）
        const keywords: { word: string; start: number; end: number; priority: number }[] = [];
        
        // 按优先级提取：4字 > 3字 > 2字
        for (let len = 4; len >= 2; len--) {
          for (let j = 0; j <= sentence.length - len; j++) {
            const word = sentence.substring(j, j + len);
            if (/^[\u4e00-\u9fa5]+$/.test(word)) {
              // 检查是否与已提取的高优先级词重叠
              const overlap = keywords.some(k => 
                k.priority > len - 1 && !(j + len <= k.start || j >= k.end)
              );
              if (!overlap) {
                keywords.push({ word, start: j, end: j + len, priority: len });
              }
            }
          }
        }

        if (keywords.length === 0) continue;

        // 优先选择较长的词
        keywords.sort((a, b) => b.priority - a.priority);
        const topKeywords = keywords.slice(0, Math.min(5, keywords.length));
        const selected = topKeywords[Math.floor(Math.random() * topKeywords.length)];
        const keyword = selected.word;

        let question: string;
        let options: string[];
        let correctIndex: number;
        let explanation: string;

        switch (type) {
          case 'synonym':
            question = `下列哪个是"${keyword}"的近义词？`;
            options = this.generateSynonymOptions(keyword);
            correctIndex = 0;
            explanation = `"${keyword}"的近义词是"${options[0]}"`;
            break;
          case 'antonym':
            question = `下列哪个是"${keyword}"的反义词？`;
            options = this.generateAntonymOptions(keyword);
            correctIndex = 0;
            explanation = `"${keyword}"的反义词是"${options[0]}"`;
            break;
          case 'typo':
            question = `找出句子中的错别字（或错误用词）：${sentence}`;
            const typoResult = this.generateTypoOptions(keyword);
            options = typoResult.options;
            correctIndex = typoResult.correctIndex;
            explanation = `正确写法应该是"${keyword}"，而不是"${options[correctIndex === 0 ? 1 : 0]}"`;
            break;
          case 'nonsense':
            question = `下列选项中，哪个替换到"${keyword}"的位置会使句子意思变得荒谬？`;
            options = this.generateNonsenseOptions(keyword);
            correctIndex = options.length - 1;
            explanation = `"${options[correctIndex]}"替换后会使句子意思变得荒谬可笑`;
            break;
          default:
            continue;
        }

        questions.push({
          _id: generateId(),
          articleId,
          type,
          originalText: sentence,
          question,
          options: options.map((opt, idx) => ({ label: String.fromCharCode(65 + idx), content: opt })),
          correctIndex,
          answered: false,
          ctime: Date.now()
        });
      }

      return questions;
    },

    /**
     * 生成近义词选项（简化实现）
     */
    generateSynonymOptions(keyword: string): string[] {
      // 这里可以使用同义词库，简化实现返回模拟数据
      const commonSynonyms: Record<string, string[]> = {
        '美丽': ['漂亮', '丑陋', '普通', '一般'],
        '高兴': ['快乐', '悲伤', '生气', '平静'],
        '快速': ['迅速', '缓慢', '慢慢', '迟疑'],
        '巨大': ['庞大', '微小', '渺小', '细小'],
        '聪明': ['聪慧', '愚蠢', '笨拙', '迟钝']
      };

      const options = commonSynonyms[keyword] || [keyword, '相似词A', '相似词B', '相似词C'];
      return this.shuffleArray([...options]);
    },

    /**
     * 生成反义词选项
     */
    generateAntonymOptions(keyword: string): string[] {
      const commonAntonyms: Record<string, string[]> = {
        '美丽': ['丑陋', '漂亮', '好看', '优美'],
        '高兴': ['悲伤', '快乐', '开心', '愉快'],
        '快速': ['缓慢', '迅速', '飞快', '极速'],
        '巨大': ['微小', '庞大', '宏大', '硕大'],
        '聪明': ['愚蠢', '聪慧', '智慧', '聪颖']
      };

      const options = commonAntonyms[keyword] || ['反义词A', '反义词B', '反义词C', keyword];
      return this.shuffleArray([...options]);
    },

    /**
     * 生成错别字选项
     */
    generateTypoOptions(keyword: string): { options: string[]; correctIndex: number } {
      // 生成形近字或音近字
      const typo = keyword.split('').map(char => {
        // 简单的替换规则
        const similarChars: Record<string, string> = {
          '的': '得', '地': '的', '得': '地',
          '他': '她', '她': '他', '它': '他',
          '已': '己', '己': '已',
          '人': '入', '入': '人'
        };
        return similarChars[char] || char;
      }).join('');

      const options = typo === keyword ? [keyword, keyword + '(误)'] : [keyword, typo];
      const correctIndex = 0;
      return { options: this.shuffleArray(options), correctIndex: options.indexOf(keyword) };
    },

    /**
     * 生成无厘头选项
     */
    generateNonsenseOptions(keyword: string): string[] {
      const nonsenseWords = ['香蕉', '洗衣机', '奥特曼', '汉堡包', '挖掘机'];
      const randomNonsense = nonsenseWords[Math.floor(Math.random() * nonsenseWords.length)];
      return [keyword, keyword, keyword, randomNonsense];
    },

    /**
     * 打乱数组
     */
    shuffleArray<T>(array: T[]): T[] {
      const newArray = [...array];
      for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
      }
      return newArray;
    },

    // ============ 设置操作 ============

    /**
     * 更新练习设置
     */
    updateExerciseSettings(settings: Partial<ExerciseSettings>) {
      this.exerciseSettings = { ...this.exerciseSettings, ...settings };
    },

    /**
     * 重置设置
     */
    resetSettings() {
      this.exerciseSettings = { ...defaultSettings };
    },

    // ============ 学习进度操作 ============

    /**
     * 保存学习进度
     */
    async saveLearningProgress(
      articleId: string,
      exerciseType: 'fillBlanks' | 'choice' | 'typing',
      progress: any
    ): Promise<boolean> {
      try {
        const progressData: LearningProgress = {
          articleId,
          exerciseType,
          progress,
          lastAccessTime: Date.now()
        };

        // 从 localStorage 读取现有进度
        const progressMap = this.getAllLearningProgress();
        const key = `${articleId}_${exerciseType}`;
        progressMap[key] = progressData;

        // 保存到 localStorage
        localStorage.setItem(TEXTMEMORY_PROGRESS_KEY, JSON.stringify(progressMap));
        return true;
      } catch (error) {
        console.error('保存学习进度失败:', error);
        return false;
      }
    },

    /**
     * 获取学习进度
     */
    getLearningProgress(
      articleId: string,
      exerciseType: 'fillBlanks' | 'choice' | 'typing'
    ): LearningProgress | null {
      try {
        const progressMap = this.getAllLearningProgress();
        const key = `${articleId}_${exerciseType}`;
        return progressMap[key] || null;
      } catch (error) {
        console.error('获取学习进度失败:', error);
        return null;
      }
    },

    /**
     * 获取所有学习进度
     */
    getAllLearningProgress(): Record<string, LearningProgress> {
      try {
        const stored = localStorage.getItem(TEXTMEMORY_PROGRESS_KEY);
        if (stored) {
          return JSON.parse(stored);
        }
      } catch (e) {
        console.error('解析学习进度失败:', e);
      }
      return {};
    },

    /**
     * 清除指定文章的学习进度
     */
    clearLearningProgress(articleId: string): void {
      try {
        const progressMap = this.getAllLearningProgress();
        const keysToDelete = Object.keys(progressMap).filter(key => 
          key.startsWith(`${articleId}_`)
        );
        keysToDelete.forEach(key => delete progressMap[key]);
        localStorage.setItem(TEXTMEMORY_PROGRESS_KEY, JSON.stringify(progressMap));
      } catch (error) {
        console.error('清除学习进度失败:', error);
      }
    },

    /**
     * 清除所有学习进度
     */
    clearAllLearningProgress(): void {
      try {
        localStorage.removeItem(TEXTMEMORY_PROGRESS_KEY);
      } catch (error) {
        console.error('清除所有学习进度失败:', error);
      }
    }
  }
});
