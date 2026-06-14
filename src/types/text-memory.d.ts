/**
 * 文本记忆模块类型定义
 */

/**
 * 地理位置坐标
 */
export interface GeoLocation {
  // 经度
  lng: number;
  // 纬度
  lat: number;
  // 地点名称
  name: string;
}

/**
 * 文本文章
 */
export interface TextArticle {
  _id: string;
  _rev?: string;
  // 标题
  title: string;
  // 内容
  content: string;
  // 作者（可选）
  author?: string;
  // 来源（可选）
  source?: string;
  // 创作地点（文本描述，如"扬州/瓜洲"）
  location?: string;
  // 朝代
  dynasty?: string;
  // 文章类别（用于地图与列表区分诗词/成语等）
  category?: 'poetry' | 'idiom' | 'article';
  // 地理坐标（解析后的）
  geo?: GeoLocation;
  // 创作年份（可选，用于时间线）
  year?: number;
  // 分类标签
  tags: string[];
  // 创建时间
  ctime: number;
  // 更新时间
  utime: number;
  // 复习次数
  reviewCount: number;
  // 最后复习时间
  lastReviewTime?: number;
}

/**
 * 文本笔记
 */
export interface TextNote {
  _id: string;
  _rev?: string;
  // 关联的文章ID
  articleId: string;
  // 笔记内容
  content: string;
  // 选中的原文（可选）
  selectedText?: string;
  // 笔记在文章中的位置（可选）
  position?: number;
  // 创建时间
  ctime: number;
  // 更新时间（可选，新建时与ctime相同）
  utime?: number;
}

/**
 * 提示词
 */
export interface TextPrompt {
  _id: string;
  _rev?: string;
  // 关联的文章ID
  articleId: string;
  // 提示词标题
  title: string;
  // 提示词内容
  content: string;
  // 显示顺序
  order: number;
  // 是否启用
  enabled: boolean;
  // 创建时间
  ctime: number;
}

/**
 * 填空练习记录
 */
export interface FillBlankExercise {
  _id: string;
  _rev?: string;
  // 关联的文章ID
  articleId: string;
  // 练习类型: 'random' - 随机填空, 'keyword' - 关键词填空
  type: 'random' | 'keyword';
  // 填空内容（被隐藏的词语）
  blanks: BlankItem[];
  // 完成时间
  completeTime?: number;
  // 正确率
  accuracy?: number;
  // 创建时间
  ctime: number;
}

/**
 * 填空项
 */
export interface BlankItem {
  // 原文
  original: string;
  // 位置
  position: number;
  // 用户答案
  userAnswer?: string;
  // 是否正确
  isCorrect?: boolean;
}

/**
 * 选择题/判断题
 */
export interface ChoiceQuestion {
  _id: string;
  _rev?: string;
  // 关联的文章ID
  articleId: string;
  // 题目类型: 'synonym' - 近义词, 'antonym' - 反义词, 'typo' - 错别字, 'nonsense' - 无厘头
  type: 'synonym' | 'antonym' | 'typo' | 'nonsense' | 'judgment';
  // 原文片段
  originalText: string;
  // 题目内容
  question: string;
  // 选项
  options: QuestionOption[];
  // 正确答案索引
  correctIndex: number;
  // 用户答案索引
  userAnswerIndex?: number;
  // 解析
  explanation?: string;
  // 是否已回答
  answered: boolean;
  // 创建时间
  ctime: number;
}

/**
 * 选项
 */
export interface QuestionOption {
  // 选项标签 A/B/C/D
  label: string;
  // 选项内容
  content: string;
}

/**
 * 练习设置
 */
export interface ExerciseSettings {
  // 填空数量
  blankCount: number;
  // 选择题数量
  choiceCount: number;
  // 是否显示拼音（古诗词适用）
  showPinyin: boolean;
  // 是否高亮关键词
  highlightKeywords: boolean;
}

/**
 * 文本记忆存储状态
 */
export interface TextMemoryState {
  // 文章列表
  articles: TextArticle[];
  // 当前选中的文章
  currentArticle: TextArticle | null;
  // 当前文章的笔记
  currentNotes: TextNote[];
  // 当前文章的提示词
  currentPrompts: TextPrompt[];
  // 练习设置
  exerciseSettings: ExerciseSettings;
  // 加载状态
  loading: boolean;
}
