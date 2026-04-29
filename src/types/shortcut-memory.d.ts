/**
 * 快捷键记忆训练类型定义
 */

// 单个快捷键条目
export interface ShortcutItem {
  id: string;               // 唯一标识
  category: string;         // 所属分类（如 VS Code、Chrome、Windows）
  functionName: string;     // 功能名称（如 复制、粘贴）
  description: string;      // 功能描述
  keys: string[];           // 快捷键按键列表，如 ['Ctrl', 'C']
  platform?: 'win' | 'mac' | 'linux' | 'common'; // 平台
}

// 分类信息
export interface ShortcutCategory {
  name: string;             // 分类名称
  icon?: string;            // 图标
  description?: string;     // 分类描述
  count: number;            // 该分类下的快捷键数量
}

// 训练记录
export interface ShortcutTrainingRecord {
  _id: string;
  _rev?: string;
  type: 'shortcut_training_record';
  category: string;         // 训练分类
  mode: 'keyPress' | 'functionSelect'; // 训练模式
  totalQuestions: number;   // 总题数
  correctAnswers: number;   // 答对题数
  duration: number;         // 用时（秒）
  details: {
    itemId: string;
    correct: boolean;
    responseTime: number;   // 响应时间（毫秒）
  }[];
  createdAt: number;
}

// 用户学习进度
export interface ShortcutLearningProgress {
  _id: string;
  _rev?: string;
  type: 'shortcut_learning_progress';
  category: string;
  masteredItemIds: string[]; // 已掌握的快捷键ID
  createdAt: number;
  updatedAt: number;
}

// 自定义分类文档
export interface CustomCategoryDoc {
  _id: string;
  _rev?: string;
  type: 'shortcut_custom_category';
  name: string;
  description: string;
  icon: string;
}

// 训练状态
export type TrainingPhase = 'ready' | 'showing' | 'listening' | 'correct' | 'wrong' | 'timeout';

// 分类配置
export interface CategoryConfig {
  description: string;
  icon: string;
}

// 分类配置映射
export type CategoryConfigMap = Record<string, CategoryConfig>;
