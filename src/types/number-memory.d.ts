/**
 * 数字-图片关联类型
 * 用于数字记忆训练
 */

// 单个数字的图片关联
export interface NumberImageAssociation {
  number: string;           // 数字 (0-99, 00-09)
  imageUrl: string;         // 图片路径/URL
  description?: string;     // 图片描述（可选）
  source: 'upload' | 'preset'; // 图片来源：用户上传或预设
}

// 数字记忆训练记录
export interface NumberMemoryTraining {
  _id: string;
  _rev?: string;
  type: 'number_memory_training';
  associations: NumberImageAssociation[];  // 用户的数字-图片关联列表
  createdAt: number;
  updatedAt: number;
}

// 训练结果记录
export interface TrainingResult {
  _id: string;
  _rev?: string;
  type: 'number_memory_result';
  mode: 'numberToImage' | 'imageToNumber'; // 训练模式
  totalQuestions: number;   // 总题数
  correctAnswers: number;   // 答对题数
  duration: number;         // 用时（秒）
  details: {
    number: string;
    correct: boolean;
    responseTime: number;   // 该题响应时间（毫秒）
  }[];
  createdAt: number;
}

// 训练进度（断点续练）
export interface TrainingProgress {
  _id: string;
  _rev?: string;
  type: 'number_memory_progress';
  mode: 'numberToImage' | 'imageToNumber';
  questions: {
    question: string;
    correctAnswer: string;
    options: string[];
  }[];
  currentQuestionIndex: number;
  answerResults: {
    question: string;
    selectedImage: string | null;
    selectedNumber: string | null;
    correct: boolean;
    responseTime: number;
  }[];
  elapsedTime: number;
  hasAnswered: boolean;
  selectedAnswer: string | null;
  isCorrect: boolean;
  createdAt: number;
  updatedAt: number;
}

// 预设图片映射
export interface PresetImageMap {
  [key: number]: {
    keyword: string;        // 关联关键词（基于发音/外形）
    suggestions: {          // 推荐图片列表
      name: string;
      url: string;
      description: string;
    }[];
  };
}

// 数字记忆条目（用于记忆长串数字）
export interface NumberMemoryEntry {
  _id: string;
  _rev?: string;
  type: 'number_memory_entry';
  title: string;            // 标题
  numbers: string;          // 要记忆的数字串
  tags: string[];           // 标签
  description?: string;     // 描述/备注
  createdAt: number;
  updatedAt: number;
  reviewCount: number;      // 复习次数
  lastReviewTime?: number;  // 最后复习时间
}

// 数字记忆笔记
export interface NumberMemoryNote {
  _id: string;
  _rev?: string;
  type: 'number_memory_note';
  entryId: string;          // 关联的条目ID
  content: string;          // 笔记内容
  createdAt: number;
  updatedAt?: number;
}

// 数字记忆提示词
export interface NumberMemoryPrompt {
  _id: string;
  _rev?: string;
  type: 'number_memory_prompt';
  entryId: string;          // 关联的条目ID
  title: string;            // 提示词标题
  content: string;          // 提示词内容
  order: number;            // 显示顺序
  enabled: boolean;         // 是否启用
  createdAt: number;
}

// 未完成的训练进度信息
export interface UnfinishedProgressInfo {
  mode: string;
  current: number;
  total: number;
}
