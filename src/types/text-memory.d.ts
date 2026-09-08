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
 * 文章类别（含诗词/成语/普通文章 + 时间线分类）
 */
export type TextCategory =
  | 'poetry'
  | 'idiom'
  | 'article'
  | 'politics'
  | 'literature'
  | 'science'
  | 'thought'
  | 'society';

/**
 * 时间线事件分类（按领域维度，互斥）
 * - politics 政治：战争、革命、变法、王朝、条约
 * - literature 文学：诗词、戏剧、史学著作
 * - science 科学：数学、物理、天文、工程、生物
 * - thought 思想：哲学、宗教、学说
 * - society 社会：经济、运动、民生
 */
export type TimelineCategory = 'politics' | 'literature' | 'science' | 'thought' | 'society';

/**
 * 时间线区域（纯地理维度，时间维度由 era 表达）
 */
export type TimelineRegion = 'china' | 'west';

/**
 * 时间线人物
 */
export interface TimelineFigure {
  // 姓名
  name: string;
  // 身份/头衔（如"唐太宗""诗人"）
  title?: string;
  // 简介
  desc?: string;
}

/**
 * 人物关系（结构化，供关系图谱使用）
 */
export interface TimelineRelation {
  // 人物甲
  from: string;
  // 人物乙
  to: string;
  // 关系类型：君臣/父子/师徒/敌对/盟友/同僚/夫妻...
  type: string;
  // 关系说明
  desc?: string;
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
  // 文章类别（用于地图与列表区分诗词/成语/时间线等）
  category?: TextCategory;
  // 文章语言：'zh'（缺省，中文走原有中文逻辑）| 'en' | 'ja' | 'ru' | 'es' | 'fr'
  language?: string;
  // 中文译文/对照译文（中英对照素材用）
  translation?: string;
  // 地理坐标（解析后的）
  geo?: GeoLocation;
  // 创作年份（可选，用于时间线；负数=公元前）
  year?: number;
  // 年号（如"贞观元年""开元"），时间线用
  reign?: string;
  // 时代标签（如"唐""文艺复兴""一战"），时间线用
  era?: string;
  // 区域/时代（中/西/近代），时间线用
  region?: TimelineRegion;
  // 主要人物，时间线用
  figures?: TimelineFigure[];
  // 人物关系，时间线用
  relations?: TimelineRelation[];
  // 事件背景，时间线用
  background?: string;
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
