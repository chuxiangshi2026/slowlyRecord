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
          case 'synonym': {
            question = `下列哪个是"${keyword}"的近义词？`;
            const correctAnswer = this.getCorrectSynonym(keyword);
            const distractors = this.getSynonymDistractors(keyword);
            options = this.shuffleArray([correctAnswer, ...distractors.slice(0, 3)]);
            correctIndex = options.indexOf(correctAnswer);
            explanation = `"${keyword}"的近义词是"${correctAnswer}"`;
            break;
          }
          case 'antonym': {
            question = `下列哪个是"${keyword}"的反义词？`;
            const correctAnswer = this.getCorrectAntonym(keyword);
            const distractors = this.getAntonymDistractors(keyword);
            options = this.shuffleArray([correctAnswer, ...distractors.slice(0, 3)]);
            correctIndex = options.indexOf(correctAnswer);
            explanation = `"${keyword}"的反义词是"${correctAnswer}"`;
            break;
          }
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
     * 语义关联词库 - 扩展版
     */
    getSemanticWordBank(): Record<string, { synonym: string[]; antonym: string[] }> {
      return {
        // ===== 形容词 =====
        '美丽': { synonym: ['漂亮', '秀丽', '优美', '动人'], antonym: ['丑陋', '难看', '丑恶'] },
        '漂亮': { synonym: ['美丽', '秀丽', '好看', '标致'], antonym: ['丑陋', '难看', '寒碜'] },
        '高兴': { synonym: ['快乐', '开心', '愉快', '欢喜'], antonym: ['悲伤', '难过', '伤心', '沮丧'] },
        '快乐': { synonym: ['高兴', '开心', '欢乐', '快活'], antonym: ['痛苦', '悲伤', '难过', '忧愁'] },
        '开心': { synonym: ['高兴', '快乐', '欢喜', '喜悦'], antonym: ['难过', '伤心', '郁闷', '烦恼'] },
        '快速': { synonym: ['迅速', '飞快', '敏捷', '急速'], antonym: ['缓慢', '迟缓', '慢慢', '徐缓'] },
        '迅速': { synonym: ['快速', '飞快', '急速', '迅捷'], antonym: ['缓慢', '迟缓', '迟迟', '慢吞吞'] },
        '巨大': { synonym: ['庞大', '宏大', '硕大', '雄伟'], antonym: ['微小', '渺小', '细小', '娇小'] },
        '庞大': { synonym: ['巨大', '宏大', '硕大', '浩大'], antonym: ['微小', '渺小', '细小'] },
        '聪明': { synonym: ['聪慧', '智慧', '聪颖', '机智'], antonym: ['愚蠢', '笨拙', '愚笨', '迟钝'] },
        '聪慧': { synonym: ['聪明', '聪颖', '伶俐', '慧黠'], antonym: ['愚笨', '愚蠢', '迟钝'] },
        '温暖': { synonym: ['暖和', '温馨', '和煦', '温热'], antonym: ['寒冷', '冰冷', '凉爽', '严寒'] },
        '暖和': { synonym: ['温暖', '和煦', '暖烘烘'], antonym: ['寒冷', '冰冷', '凉快'] },
        '明亮': { synonym: ['光亮', '光明', '灿烂', '辉煌'], antonym: ['黑暗', '昏暗', '阴暗', '暗淡'] },
        '光亮': { synonym: ['明亮', '光明', '亮堂'], antonym: ['黑暗', '昏暗', '暗淡'] },
        '安静': { synonym: ['宁静', '寂静', '静谧', '平静'], antonym: ['喧闹', '吵闹', '嘈杂', '喧嚣'] },
        '宁静': { synonym: ['安静', '寂静', '静谧', '幽静'], antonym: ['喧闹', '嘈杂', '热闹', '喧嚣'] },
        '认真': { synonym: ['仔细', '用心', '专注', '严谨'], antonym: ['马虎', '草率', '敷衍', '粗心'] },
        '仔细': { synonym: ['认真', '细致', '细心', '周密'], antonym: ['马虎', '粗心', '大意', '粗略'] },
        '简单': { synonym: ['容易', '简易', '浅显', '简明'], antonym: ['复杂', '困难', '繁琐', '艰难'] },
        '容易': { synonym: ['简单', '轻易', '易于'], antonym: ['困难', '艰难', '复杂'] },
        '丰富': { synonym: ['丰盛', '充裕', '多彩', '富饶'], antonym: ['贫乏', '单调', '匮乏', '稀缺'] },
        '复杂': { synonym: ['繁杂', '庞杂', '错综'], antonym: ['简单', '单纯', '简易'] },
        '困难': { synonym: ['艰难', '困苦', '困难'], antonym: ['容易', '简单', '轻易'] },
        '危险': { synonym: ['危急', '凶险', '风险'], antonym: ['安全', '平安', '保险'] },
        '安全': { synonym: ['平安', '安稳', '保险'], antonym: ['危险', '危急', '凶险'] },
        '清楚': { synonym: ['清晰', '明白', '明了'], antonym: ['模糊', '含糊', '朦胧'] },
        '模糊': { synonym: ['含糊', '朦胧', '隐约'], antonym: ['清楚', '清晰', '明白'] },
        '熟练': { synonym: ['娴熟', '老练', '精通'], antonym: ['生疏', '生涩', '陌生'] },
        '生疏': { synonym: ['陌生', '生涩', '不熟悉'], antonym: ['熟练', '娴熟', '精通'] },
        '熟悉': { synonym: ['了解', '熟知', '熟稔'], antonym: ['陌生', '生疏', '不熟悉'] },
        '陌生': { synonym: ['生疏', '不熟悉', '生分'], antonym: ['熟悉', '了解', '熟知'] },
        '优秀': { synonym: ['优异', '杰出', '出色', '卓越'], antonym: ['平庸', '平凡', '差劲', '拙劣'] },
        '杰出': { synonym: ['优秀', '卓越', '出众'], antonym: ['平庸', '平凡', '普通'] },
        '普通': { synonym: ['平常', '一般', '平凡'], antonym: ['特别', '特殊', '杰出', '优秀'] },
        '特别': { synonym: ['特殊', '独特', '格外'], antonym: ['普通', '一般', '平常'] },
        '重要': { synonym: ['主要', '关键', '重大'], antonym: ['次要', '轻微', '无足轻重'] },
        '轻微': { synonym: ['略微', '稍微', '少许'], antonym: ['严重', '重大', '剧烈'] },
        '严重': { synonym: ['严峻', '重大', '危急'], antonym: ['轻微', '微小', '不重要'] },
        '完整': { synonym: ['完全', '完好', '齐全'], antonym: ['残缺', '破损', '零碎'] },
        '残缺': { synonym: ['破损', '残缺', '不全'], antonym: ['完整', '完全', '完好'] },
        '整齐': { synonym: ['整洁', '井然', '齐整'], antonym: ['杂乱', '凌乱', '混乱'] },
        '杂乱': { synonym: ['凌乱', '混乱', '庞杂'], antonym: ['整齐', '整洁', '井然'] },
        '干净': { synonym: ['洁净', '清洁', '清爽'], antonym: ['肮脏', '污秽', '脏乱'] },
        '肮脏': { synonym: ['污秽', '脏乱', '不洁'], antonym: ['干净', '洁净', '清洁'] },
        '新鲜': { synonym: ['新颖', '鲜嫩', '清新'], antonym: ['陈旧', '腐烂', '变质', '老套'] },
        '陈旧': { synonym: ['老旧', '过时', '古老'], antonym: ['新鲜', '新颖', '崭新'] },
        '健康': { synonym: ['健壮', '康健', '安康'], antonym: ['疾病', '虚弱', '病态'] },
        '虚弱': { synonym: ['衰弱', '柔弱', '无力'], antonym: ['强壮', '健壮', '强健'] },
        '强壮': { synonym: ['健壮', '强健', '结实'], antonym: ['虚弱', '衰弱', '柔弱'] },
        '灵活': { synonym: ['灵巧', '敏捷', '机灵'], antonym: ['呆板', '僵硬', '死板'] },
        '呆板': { synonym: ['死板', '僵硬', '木讷'], antonym: ['灵活', '灵巧', '活泼'] },
        '活泼': { synonym: ['活跃', '开朗', '生动'], antonym: ['呆板', '沉闷', '死板'] },
        '温柔': { synonym: ['温和', '柔顺', '体贴'], antonym: ['粗暴', '粗鲁', '凶恶'] },
        '粗暴': { synonym: ['粗鲁', '暴躁', '野蛮'], antonym: ['温柔', '温和', '文雅'] },
        '谦虚': { synonym: ['谦逊', '虚心', '谦和'], antonym: ['骄傲', '傲慢', '自负'] },
        '骄傲': { synonym: ['自豪', '傲慢', '自满'], antonym: ['谦虚', '谦逊', '虚心'] },
        '诚实': { synonym: ['真诚', '老实', '诚恳'], antonym: ['虚伪', '虚假', '欺骗'] },
        '虚伪': { synonym: ['虚假', '伪装', '做作'], antonym: ['诚实', '真诚', '真挚'] },
        '善良': { synonym: ['和善', '仁慈', '好心'], antonym: ['凶恶', '狠毒', '恶毒'] },
        '凶恶': { synonym: ['凶狠', '恶毒', '残暴'], antonym: ['善良', '和善', '仁慈'] },
        '勇敢': { synonym: ['英勇', '无畏', '果敢'], antonym: ['胆怯', '懦弱', '胆小'] },
        '胆怯': { synonym: ['胆小', '害怕', '畏惧'], antonym: ['勇敢', '英勇', '无畏'] },
        '坚强': { synonym: ['刚强', '坚毅', '顽强'], antonym: ['软弱', '脆弱', '懦弱'] },
        '软弱': { synonym: ['脆弱', '懦弱', '柔弱'], antonym: ['坚强', '刚强', '坚毅'] },
        '勤劳': { synonym: ['勤奋', '辛勤', '勤快'], antonym: ['懒惰', '懒散', '怠惰'] },
        '懒惰': { synonym: ['懒散', '怠惰', '偷懒'], antonym: ['勤劳', '勤奋', '勤快'] },
        '节俭': { synonym: ['节约', '节省', '俭朴'], antonym: ['浪费', '奢侈', '挥霍'] },
        '浪费': { synonym: ['挥霍', '奢侈', '糟蹋'], antonym: ['节俭', '节约', '节省'] },
        // ===== 动词 =====
        '开始': { synonym: ['开端', '启动', '起始', '着手'], antonym: ['结束', '停止', '终结', '完毕'] },
        '结束': { synonym: ['终结', '完毕', '完成', '终止'], antonym: ['开始', '启动', '开端', '起始'] },
        '增加': { synonym: ['增长', '增添', '增多', '加强'], antonym: ['减少', '降低', '减弱', '削减'] },
        '减少': { synonym: ['削减', '降低', '减弱', '缩小'], antonym: ['增加', '增长', '增添', '加强'] },
        '成功': { synonym: ['胜利', '达成', '成就', '获胜'], antonym: ['失败', '挫折', '落败', '失手'] },
        '失败': { synonym: ['失利', '落败', '挫折'], antonym: ['成功', '胜利', '获胜'] },
        '支持': { synonym: ['赞同', '拥护', '赞成', '支撑'], antonym: ['反对', '抵制', '反驳', '抗拒'] },
        '反对': { synonym: ['抵制', '反驳', '抗议', '抗拒'], antonym: ['支持', '赞同', '拥护', '赞成'] },
        '相信': { synonym: ['信任', '信赖', '信服', '笃信'], antonym: ['怀疑', '猜疑', '质疑', '不信'] },
        '怀疑': { synonym: ['猜疑', '质疑', '疑惑'], antonym: ['相信', '信任', '信赖'] },
        '前进': { synonym: ['前行', '推进', '迈进', '进步'], antonym: ['后退', '退缩', '倒退', '撤退'] },
        '后退': { synonym: ['倒退', '退缩', '撤退', '撤回'], antonym: ['前进', '进步', '推进', '迈进'] },
        '喜欢': { synonym: ['喜爱', '钟爱', '爱好', '倾心'], antonym: ['讨厌', '厌恶', '憎恨', '反感'] },
        '讨厌': { synonym: ['厌恶', '憎恨', '反感', '厌烦'], antonym: ['喜欢', '喜爱', '钟爱', '爱好'] },
        '爱护': { synonym: ['保护', '呵护', '爱惜', '维护'], antonym: ['破坏', '损害', '伤害', '摧残'] },
        '破坏': { synonym: ['损坏', '毁坏', '摧毁', '损害'], antonym: ['保护', '爱护', '维护', '修复'] },
        '建设': { synonym: ['建造', '建立', '创建', '营造'], antonym: ['破坏', '摧毁', '毁坏', '拆除'] },
        '创造': { synonym: ['发明', '创新', '创立', '创建'], antonym: ['模仿', '抄袭', '复制', '照搬'] },
        '接受': { synonym: ['接收', '接纳', '承受', '认可'], antonym: ['拒绝', '推辞', '谢绝', '抗拒'] },
        '拒绝': { synonym: ['推辞', '谢绝', '回绝', '抗拒'], antonym: ['接受', '接纳', '同意', '答应'] },
        '同意': { synonym: ['赞成', '答应', '允许', '批准'], antonym: ['反对', '拒绝', '否定', '否决'] },
        '允许': { synonym: ['准许', '许可', '同意', '批准'], antonym: ['禁止', '阻止', '不准', '不许'] },
        '禁止': { synonym: ['阻止', '制止', '不准', '严禁'], antonym: ['允许', '准许', '许可', '同意'] },
        '出现': { synonym: ['显现', '呈现', '浮现', '显露'], antonym: ['消失', '消逝', '隐匿', '隐藏'] },
        '消失': { synonym: ['消逝', '消散', '隐匿', '灭绝'], antonym: ['出现', '显现', '呈现', '浮现'] },
        '聚集': { synonym: ['集合', '汇集', '聚拢', '集中'], antonym: ['分散', '散开', '离散', '解散'] },
        '分散': { synonym: ['散开', '离散', '分布', '分开'], antonym: ['聚集', '集合', '汇集', '集中'] },
        '提升': { synonym: ['提高', '升高', '上升', '升级'], antonym: ['下降', '降低', '下跌', '减少'] },
        '下降': { synonym: ['降低', '下跌', '减少', '下落'], antonym: ['上升', '提升', '提高', '升高'] },
        '表扬': { synonym: ['赞扬', '夸奖', '称赞', '表彰'], antonym: ['批评', '指责', '责备', '训斥'] },
        '批评': { synonym: ['指责', '责备', '训斥', '批判'], antonym: ['表扬', '赞扬', '夸奖', '称赞'] },
        '赞扬': { synonym: ['表扬', '称赞', '颂扬', '讴歌'], antonym: ['批评', '指责', '贬低', '诋毁'] },
        '帮助': { synonym: ['帮忙', '协助', '援助', '救助'], antonym: ['妨碍', '阻碍', '干扰', '阻挠'] },
        '妨碍': { synonym: ['阻碍', '干扰', '阻挠', '妨害'], antonym: ['帮助', '协助', '促进', '推动'] },
        '获得': { synonym: ['得到', '取得', '赢得', '获取'], antonym: ['失去', '丧失', '丢失', '错失'] },
        '失去': { synonym: ['丧失', '丢失', '错失', '失落'], antonym: ['获得', '得到', '取得', '赢得'] },
        '加入': { synonym: ['参加', '参与', '加入', '加盟'], antonym: ['退出', '离开', '脱离', '退出的'] },
        '退出': { synonym: ['离开', '脱离', '退出的', '退场'], antonym: ['加入', '参加', '参与', '进入'] },
        // ===== 名词 =====
        '朋友': { synonym: ['友人', '伙伴', '知己', '好友'], antonym: ['敌人', '仇人', '对手', '敌手'] },
        '敌人': { synonym: ['仇人', '对手', '敌手', '仇敌'], antonym: ['朋友', '友人', '伙伴', '盟友'] },
        '幸福': { synonym: ['快乐', '美满', '甜蜜', '幸运'], antonym: ['痛苦', '不幸', '悲惨', '苦难'] },
        '痛苦': { synonym: ['苦难', '痛楚', '折磨', '悲痛'], antonym: ['幸福', '快乐', '甜蜜', '喜悦'] },
        '优点': { synonym: ['长处', '优势', '亮点', '特长'], antonym: ['缺点', '短处', '劣势', '缺陷'] },
        '缺点': { synonym: ['短处', '劣势', '缺陷', '毛病'], antonym: ['优点', '长处', '优势', '亮点'] },
        '天堂': { synonym: ['天国', '仙境', '乐园'], antonym: ['地狱', '深渊', '苦海'] },
        '地狱': { synonym: ['深渊', '苦海', '炼狱'], antonym: ['天堂', '天国', '乐园'] },
        '胜利': { synonym: ['成功', '获胜', '得胜'], antonym: ['失败', '失利', '落败'] },
        '白天': { synonym: ['白昼', '日间', '日子'], antonym: ['黑夜', '夜晚', '夜间'] },
        '黑夜': { synonym: ['夜晚', '夜间', '黑暗'], antonym: ['白天', '白昼', '日间'] },
        '生命': { synonym: ['性命', '生灵', '生物'], antonym: ['死亡', '毁灭', '灭亡'] },
        '死亡': { synonym: ['灭亡', '毁灭', '逝世'], antonym: ['生命', '生存', '活着'] },
        '和平': { synonym: ['太平', '安宁', '祥和'], antonym: ['战争', '战乱', '冲突'] },
        '战争': { synonym: ['战乱', '冲突', '战斗'], antonym: ['和平', '太平', '安宁'] },
        '喜悦': { synonym: ['欣喜', '欢乐', '高兴'], antonym: ['悲伤', '忧愁', '痛苦'] },
        '忧愁': { synonym: ['忧虑', '忧伤', '愁苦'], antonym: ['喜悦', '欢乐', '高兴'] },
        '希望': { synonym: ['期望', '愿望', '盼望'], antonym: ['绝望', '失望', '无望'] },
        '绝望': { synonym: ['失望', '无望', '死心'], antonym: ['希望', '期望', '盼望'] },
        '光明': { synonym: ['光亮', '光芒', '光辉'], antonym: ['黑暗', '阴暗', '昏暗'] },
        '黑暗': { synonym: ['阴暗', '昏暗', '漆黑'], antonym: ['光明', '光亮', '光芒'] },
        '知识': { synonym: ['学问', '学识', '见识'], antonym: ['无知', '愚昧', '愚昧无知'] },
        '无知': { synonym: ['愚昧', '愚昧无知', '不明'], antonym: ['知识', '学问', '学识'] },
        '力量': { synonym: ['力气', '能量', '威力'], antonym: ['软弱', '虚弱', '无力'] },
        '智慧': { synonym: ['才智', '聪慧', '智谋'], antonym: ['愚蠢', '愚昧', '愚笨'] },
        '理智': { synonym: ['理性', '冷静', '清醒'], antonym: ['冲动', '感情用事', '失去理智'] },
        '自由': { synonym: ['自在', '自主', '无拘无束'], antonym: ['束缚', '拘束', '限制'] },
        '束缚': { synonym: ['拘束', '限制', '约束'], antonym: ['自由', '自在', '自主'] }
      };
    },

    /**
     * 获取近义词正确答案
     */
    getCorrectSynonym(keyword: string): string {
      const wordBank = this.getSemanticWordBank();
      const wordData = wordBank[keyword];
      
      if (wordData && wordData.synonym.length > 0) {
        return wordData.synonym[0];
      }
      
      // 如果词库中没有，返回原词
      return keyword;
    },

    /**
     * 获取近义词干扰项
     */
    getSynonymDistractors(keyword: string): string[] {
      const wordBank = this.getSemanticWordBank();
      const wordData = wordBank[keyword];
      const distractors: string[] = [];
      
      if (wordData) {
        // 使用词库中的其他近义词作为干扰
        if (wordData.synonym.length > 1) {
          distractors.push(...wordData.synonym.slice(1));
        }
        // 添加反义词作为干扰
        if (wordData.antonym.length > 0) {
          distractors.push(wordData.antonym[0]);
        }
      }
      
      // 确保有足够的干扰项
      while (distractors.length < 3) {
        const fallback = this.generateFallbackDistractor(keyword, distractors);
        if (fallback) distractors.push(fallback);
      }
      
      return distractors;
    },

    /**
     * 获取反义词正确答案
     */
    getCorrectAntonym(keyword: string): string {
      const wordBank = this.getSemanticWordBank();
      const wordData = wordBank[keyword];
      
      if (wordData && wordData.antonym.length > 0) {
        return wordData.antonym[0];
      }
      
      // 如果词库中没有，返回否定形式
      return '不' + keyword;
    },

    /**
     * 获取反义词干扰项
     */
    getAntonymDistractors(keyword: string): string[] {
      const wordBank = this.getSemanticWordBank();
      const wordData = wordBank[keyword];
      const distractors: string[] = [];
      
      if (wordData) {
        // 使用近义词作为干扰（用户可能误选）
        if (wordData.synonym.length > 0) {
          distractors.push(...wordData.synonym.slice(0, 2));
        }
        // 添加其他反义词
        if (wordData.antonym.length > 1) {
          distractors.push(wordData.antonym[1]);
        }
      }
      
      // 确保有足够的干扰项
      while (distractors.length < 3) {
        const fallback = this.generateFallbackDistractor(keyword, distractors, true);
        if (fallback) distractors.push(fallback);
      }
      
      return distractors;
    },

    /**
     * 生成备选干扰项
     */
    generateFallbackDistractor(keyword: string, existing: string[], isAntonym = false): string {
      const wordBank = this.getSemanticWordBank();
      const allWords = Object.keys(wordBank);
      
      // 随机从词库中选一个词
      for (let i = 0; i < 10; i++) {
        const randomWord = allWords[Math.floor(Math.random() * allWords.length)];
        if (randomWord !== keyword && !existing.includes(randomWord)) {
          // 对于近义词题，返回其他词的近义词；对于反义词题，返回其他词的反义词
          const randomData = wordBank[randomWord];
          if (randomData) {
            const candidate = isAntonym 
              ? (randomData.antonym[0] || randomWord)
              : (randomData.synonym[0] || randomWord);
            if (!existing.includes(candidate) && candidate !== keyword) {
              return candidate;
            }
          }
        }
      }
      
      // 如果找不到，返回随机词
      return allWords[Math.floor(Math.random() * allWords.length)] || '相关词';
    },

    /**
     * 备选方案：基于构词法生成语义选项
     */
    generateSemanticOptionsFallback(keyword: string, type: 'synonym' | 'antonym'): string[] {
      const options: string[] = [];
      
      // 常见前缀/后缀用于生成干扰项
      const positivePrefixes = ['大', '高', '新', '真', '美', '好', '优', '良'];
      const negativePrefixes = ['不', '非', '无', '未', '假', '丑', '劣', '坏'];
      
      if (type === 'synonym') {
        // 正确答案就是原词本身
        options.push(keyword);
        
        // 生成相似结构的干扰项
        if (keyword.length === 2) {
          // 替换第二个字
          const similarWords = ['美', '丽', '好', '善', '佳', '妙'];
          for (let i = 0; i < 3; i++) {
            const prefix = keyword[0];
            const suffix = similarWords[i] || '好';
            options.push(prefix + suffix);
          }
        } else {
          // 对于非2字词，添加前缀生成干扰
          options.push('很' + keyword);
          options.push('真' + keyword);
          options.push('太' + keyword);
        }
      } else {
        // 反义词模式
        // 尝试加否定前缀
        options.push('不' + keyword);
        options.push('非' + keyword);
        
        // 添加一些对比词
        const contrastWords = ['相反', '对立', '矛盾', '反面'];
        options.push(contrastWords[Math.floor(Math.random() * contrastWords.length)]);
        
        // 再添加一个词库中可能相关的词
        const allWords = Object.keys(this.getSemanticWordBank());
        const randomWord = allWords[Math.floor(Math.random() * allWords.length)];
        options.push(randomWord);
      }
      
      return this.shuffleArray(options);
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
