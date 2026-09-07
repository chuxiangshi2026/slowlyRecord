import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { getActiveLanguage } from '@/utils/language/profiles';

// 词库难度等级定义
export interface WordBankLevel {
  id: string;
  name: string;
  minWords: number;
  maxWords: number;
  avgDifficulty: number; // 1-10
  description: string;
}

// 测试记录
export interface VocabularyTestRecord {
  id: string;
  date: string;
  testedLevels: string[];
  correctByLevel: Record<string, number>;
  totalByLevel: Record<string, number>;
  estimatedVocabulary: number;
  readingLevel: string;
  readingLevelDesc: string;
}

// 阅读水平定义
export interface ReadingLevel {
  name: string;
  minVocab: number;
  maxVocab: number;
  description: string;
  recommendations: BookRecommendation[];
}

// 书籍推荐
export interface BookRecommendation {
  title: string;
  author: string;
  level: string;
  description: string;
  type: 'fiction' | 'non-fiction' | 'graded';
}

// 词库难度配置
export const WORD_BANK_LEVELS: WordBankLevel[] = [
  { id: 'cet4', name: 'CET-4', minWords: 3500, maxWords: 4500, avgDifficulty: 3, description: '大学英语四级' },
  { id: 'cet6', name: 'CET-6', minWords: 4500, maxWords: 5500, avgDifficulty: 4, description: '大学英语六级' },
  { id: 'kaoyan', name: '考研', minWords: 5500, maxWords: 6500, avgDifficulty: 5, description: '考研英语' },
  { id: 'ielts', name: '雅思', minWords: 6500, maxWords: 8000, avgDifficulty: 6, description: '雅思核心' },
  { id: 'toefl', name: '托福', minWords: 7000, maxWords: 9000, avgDifficulty: 6.5, description: '托福核心' },
  { id: 'gmat', name: 'GMAT', minWords: 7500, maxWords: 10000, avgDifficulty: 7, description: 'GMAT核心' },
  { id: 'gre', name: 'GRE', minWords: 9000, maxWords: 15000, avgDifficulty: 8.5, description: 'GRE核心' },
];

/** CEFR 通用档位（ru/es/fr 首发复用） */
const CEFR_LEVELS: WordBankLevel[] = [
  { id: 'a1', name: 'A1', minWords: 500, maxWords: 800, avgDifficulty: 1, description: '入门' },
  { id: 'a2', name: 'A2', minWords: 1000, maxWords: 1500, avgDifficulty: 2, description: '初级' },
  { id: 'b1', name: 'B1', minWords: 2000, maxWords: 3000, avgDifficulty: 4, description: '中级' },
  { id: 'b2', name: 'B2', minWords: 3500, maxWords: 4500, avgDifficulty: 6, description: '中高级' },
  { id: 'c1', name: 'C1', minWords: 5000, maxWords: 7000, avgDifficulty: 7.5, description: '高级' },
  { id: 'c2', name: 'C2', minWords: 8000, maxWords: 12000, avgDifficulty: 9, description: '精通' },
];

/** 各语言的词库等级（en 保持现有 CET~GRE 阶梯；ja 用 JLPT；ru/es/fr 用 CEFR 档位） */
export const WORD_BANK_LEVELS_BY_LANG: Record<string, WordBankLevel[]> = {
  en: WORD_BANK_LEVELS,
  ja: [
    { id: 'n5', name: 'N5', minWords: 800, maxWords: 1000, avgDifficulty: 1, description: 'JLPT N5 入门' },
    { id: 'n4', name: 'N4', minWords: 1500, maxWords: 2000, avgDifficulty: 2, description: 'JLPT N4 初级' },
    { id: 'n3', name: 'N3', minWords: 3000, maxWords: 3750, avgDifficulty: 4, description: 'JLPT N3 中级' },
    { id: 'n2', name: 'N2', minWords: 6000, maxWords: 7000, avgDifficulty: 6, description: 'JLPT N2 中上级' },
    { id: 'n1', name: 'N1', minWords: 10000, maxWords: 12000, avgDifficulty: 8, description: 'JLPT N1 上级' },
  ],
  ru: CEFR_LEVELS,
  es: CEFR_LEVELS,
  fr: CEFR_LEVELS,
};

/** 按语言取词库等级，非法语言回退英语 */
export function getWordBankLevels(lang: string): WordBankLevel[] {
  return WORD_BANK_LEVELS_BY_LANG[lang] || WORD_BANK_LEVELS;
}

// 阅读水平定义
export const READING_LEVELS: ReadingLevel[] = [
  {
    name: '初级入门',
    minVocab: 0,
    maxVocab: 2000,
    description: '适合阅读儿童读物和简单分级读物',
    recommendations: [
      { title: 'Oxford Bookworms Starter', author: 'Various', level: 'Starter', description: '牛津书虫入门级，简单有趣的故事', type: 'graded' },
      { title: 'Penguin Readers Level 1', author: 'Various', level: 'Level 1', description: '企鹅分级读物，基础词汇', type: 'graded' },
      { title: 'Charlotte\'s Web', author: 'E.B. White', level: '初级', description: '经典儿童文学作品', type: 'fiction' },
    ]
  },
  {
    name: '初级进阶',
    minVocab: 2000,
    maxVocab: 3500,
    description: '可以阅读简单的青少年小说和基础新闻',
    recommendations: [
      { title: 'The Little Prince', author: 'Antoine de Saint-Exupéry', level: '初级', description: '小王子，语言简洁优美', type: 'fiction' },
      { title: 'Who Moved My Cheese?', author: 'Spencer Johnson', level: '初级', description: '谁动了我的奶酪，简单寓言', type: 'non-fiction' },
      { title: 'The Giver', author: 'Lois Lowry', level: '初级-中级', description: '记忆传授人，青少年经典', type: 'fiction' },
    ]
  },
  {
    name: '中级水平',
    minVocab: 3500,
    maxVocab: 5000,
    description: '能读懂大部分日常英语和简化版名著',
    recommendations: [
      { title: 'Animal Farm', author: 'George Orwell', level: '中级', description: '动物农场，政治寓言经典', type: 'fiction' },
      { title: 'The Old Man and the Sea', author: 'Ernest Hemingway', level: '中级', description: '老人与海，诺贝尔文学奖作品', type: 'fiction' },
      { title: 'Rich Dad Poor Dad', author: 'Robert Kiyosaki', level: '中级', description: '富爸爸穷爸爸，理财入门', type: 'non-fiction' },
    ]
  },
  {
    name: '中高级',
    minVocab: 5000,
    maxVocab: 7000,
    description: '可以阅读原版畅销书和主流报刊',
    recommendations: [
      { title: 'The Catcher in the Rye', author: 'J.D. Salinger', level: '中高级', description: '麦田里的守望者，青少年必读', type: 'fiction' },
      { title: 'To Kill a Mockingbird', author: 'Harper Lee', level: '中高级', description: '杀死一只知更鸟，普利策奖作品', type: 'fiction' },
      { title: 'The 7 Habits of Highly Effective People', author: 'Stephen Covey', level: '中高级', description: '高效能人士的七个习惯', type: 'non-fiction' },
    ]
  },
  {
    name: '高级水平',
    minVocab: 7000,
    maxVocab: 10000,
    description: '可以流畅阅读大部分英文原著和学术文章',
    recommendations: [
      { title: '1984', author: 'George Orwell', level: '高级', description: '1984，反乌托邦经典', type: 'fiction' },
      { title: 'Pride and Prejudice', author: 'Jane Austen', level: '高级', description: '傲慢与偏见，经典爱情小说', type: 'fiction' },
      { title: 'Sapiens', author: 'Yuval Noah Harari', level: '高级', description: '人类简史，畅销历史书', type: 'non-fiction' },
    ]
  },
  {
    name: '精通水平',
    minVocab: 10000,
    maxVocab: 15000,
    description: '能阅读复杂的文学作品和专业文献',
    recommendations: [
      { title: 'The Great Gatsby', author: 'F. Scott Fitzgerald', level: '精通', description: '了不起的盖茨比，美国文学经典', type: 'fiction' },
      { title: 'Moby Dick', author: 'Herman Melville', level: '精通', description: '白鲸记，美国文学巨著', type: 'fiction' },
      { title: 'Thinking, Fast and Slow', author: 'Daniel Kahneman', level: '精通', description: '思考快与慢，诺贝尔奖得主著作', type: 'non-fiction' },
    ]
  },
  {
    name: '专家水平',
    minVocab: 15000,
    maxVocab: 999999,
    description: '词汇量接近母语者水平，可阅读任何英文内容',
    recommendations: [
      { title: 'Ulysses', author: 'James Joyce', level: '专家', description: '尤利西斯，意识流巅峰之作', type: 'fiction' },
      { title: 'The Economist', author: 'Various', level: '专家', description: '经济学人，高端新闻杂志', type: 'non-fiction' },
      { title: 'Nature/Science Journals', author: 'Various', level: '专家', description: '自然/科学期刊，顶级学术文献', type: 'non-fiction' },
    ]
  },
];

// 阅读计划模板
export interface ReadingPlan {
  duration: string;
  dailyPages: number;
  booksPerMonth: number;
  suggestedTypes: string[];
  tips: string[];
}

export const READING_PLANS: Record<string, ReadingPlan> = {
  '初级入门': {
    duration: '3-6个月',
    dailyPages: 5,
    booksPerMonth: 1,
    suggestedTypes: ['分级读物', '图画书', '简易小说'],
    tips: ['不要查每一个生词，先猜意思', '每天固定时间阅读', '可以配合有声书', '选择感兴趣的主题']
  },
  '初级进阶': {
    duration: '3-6个月',
    dailyPages: 10,
    booksPerMonth: 1,
    suggestedTypes: ['青少年小说', '简化版名著', '生活类书籍'],
    tips: ['开始尝试不查词典理解大意', '记录常用表达', '尝试简单复述内容', '加入读书小组']
  },
  '中级水平': {
    duration: '6-12个月',
    dailyPages: 15,
    booksPerMonth: 2,
    suggestedTypes: ['原版小说', '新闻报刊', '非虚构类'],
    tips: ['扩大阅读范围', '关注复杂句式', '做读书笔记', '尝试写书评']
  },
  '中高级': {
    duration: '持续',
    dailyPages: 20,
    booksPerMonth: 2,
    suggestedTypes: ['文学小说', '专业书籍', '杂志期刊'],
    tips: ['挑战不同风格的作品', '深入分析文本', '扩展专业词汇', '参与深度讨论']
  },
  '高级水平': {
    duration: '持续',
    dailyPages: 30,
    booksPerMonth: 3,
    suggestedTypes: ['经典文学', '学术著作', '专业文献'],
    tips: ['精读与泛读结合', '研究文化背景', '模仿经典写作', '建立个人知识体系']
  },
  '精通水平': {
    duration: '终身学习',
    dailyPages: 30,
    booksPerMonth: 3,
    suggestedTypes: ['任何英文材料'],
    tips: ['持续探索新领域', '保持阅读习惯', '输出与分享', '跨学科阅读']
  },
  '专家水平': {
    duration: '终身学习',
    dailyPages: 30,
    booksPerMonth: 3,
    suggestedTypes: ['任何英文材料'],
    tips: ['保持好奇心', '深入研究专业领域', '关注语言变化', '传授给他人']
  },
};

export const useVocabularyTestStore = defineStore('vocabularyTest', () => {
  // ========== State ==========
  const testHistory = ref<VocabularyTestRecord[]>([]);
  const currentTest = ref<{
    levelResults: Record<string, { correct: number; total: number }>;
    currentLevelIndex: number;
    testWords: string[];
  } | null>(null);

  // ========== Getters ==========
  const hasTestHistory = computed(() => testHistory.value.length > 0);
  
  const latestTest = computed(() => 
    testHistory.value.length > 0 ? testHistory.value[0] : null
  );

  const averageVocabulary = computed(() => {
    if (testHistory.value.length === 0) return 0;
    const sum = testHistory.value.reduce((acc, record) => acc + record.estimatedVocabulary, 0);
    return Math.round(sum / testHistory.value.length);
  });

  const vocabularyTrend = computed(() => {
    if (testHistory.value.length < 2) return null;
    const latest = testHistory.value[0].estimatedVocabulary;
    const previous = testHistory.value[1].estimatedVocabulary;
    return {
      change: latest - previous,
      percentChange: ((latest - previous) / previous * 100).toFixed(1)
    };
  });

  // ========== Actions ==========
  
  // 计算词汇量估计
  function calculateVocabulary(
    correctByLevel: Record<string, number>,
    totalByLevel: Record<string, number>
  ): number {
    let totalEstimated = 0;
    let totalWeight = 0;

    for (const level of getWordBankLevels(getActiveLanguage())) {
      const correct = correctByLevel[level.id] || 0;
      const total = totalByLevel[level.id] || 0;
      
      if (total > 0) {
        const accuracy = correct / total;
        // 基于正确率估算该等级的掌握程度
        const levelMastery = Math.min(accuracy * 1.2, 1); // 1.2倍容错
        const levelEstimate = level.minWords + (level.maxWords - level.minWords) * levelMastery;
        
        // 根据难度加权
        const weight = level.avgDifficulty;
        totalEstimated += levelEstimate * weight;
        totalWeight += weight;
      }
    }

    if (totalWeight === 0) return 0;
    
    const estimated = Math.round(totalEstimated / totalWeight);
    // 添加基础词汇（日常词汇）
    return Math.max(estimated, 1500);
  }

  // 获取阅读水平
  function getReadingLevel(vocabulary: number): ReadingLevel {
    for (const level of READING_LEVELS) {
      if (vocabulary >= level.minVocab && vocabulary < level.maxVocab) {
        return level;
      }
    }
    return READING_LEVELS[READING_LEVELS.length - 1];
  }

  // 获取阅读计划
  function getReadingPlan(readingLevelName: string): ReadingPlan {
    return READING_PLANS[readingLevelName] || READING_PLANS['中级水平'];
  }

  // 保存测试结果
  function saveTestResult(
    testedLevels: string[],
    correctByLevel: Record<string, number>,
    totalByLevel: Record<string, number>
  ): VocabularyTestRecord {
    const estimatedVocabulary = calculateVocabulary(correctByLevel, totalByLevel);
    const readingLevel = getReadingLevel(estimatedVocabulary);

    const record: VocabularyTestRecord = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      testedLevels,
      correctByLevel,
      totalByLevel,
      estimatedVocabulary,
      readingLevel: readingLevel.name,
      readingLevelDesc: readingLevel.description,
    };

    testHistory.value.unshift(record);
    // 只保留最近20条记录
    if (testHistory.value.length > 20) {
      testHistory.value = testHistory.value.slice(0, 20);
    }
    saveHistory();
    
    return record;
  }

  // 保存到本地存储
  function saveHistory() {
    try {
      localStorage.setItem('vocabularyTest_history', JSON.stringify(testHistory.value));
    } catch (e) {
      console.error('保存词汇量测试历史失败:', e);
    }
  }

  // 加载历史记录
  function loadHistory() {
    try {
      const historyJson = localStorage.getItem('vocabularyTest_history');
      if (historyJson) {
        testHistory.value = JSON.parse(historyJson);
      }
    } catch (e) {
      console.error('加载词汇量测试历史失败:', e);
    }
  }

  // 清除历史
  function clearHistory() {
    testHistory.value = [];
    localStorage.removeItem('vocabularyTest_history');
  }

  // 初始化时加载数据
  loadHistory();

  return {
    // state
    testHistory,
    currentTest,
    // getters
    hasTestHistory,
    latestTest,
    averageVocabulary,
    vocabularyTrend,
    // actions
    calculateVocabulary,
    getReadingLevel,
    getReadingPlan,
    saveTestResult,
    saveHistory,
    loadHistory,
    clearHistory,
  };
});
