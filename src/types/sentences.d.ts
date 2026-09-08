/**
 * 句子库类型定义
 * 用于收集唯美句子、喜欢的心得等长文本，与单词库相互独立
 */

export interface Sentence {
  /** 唯一 ID */
  id: string;
  /** 原句 */
  text: string;
  /** 译文（英文句子入库时自动补，失败留空） */
  translation?: string;
  /** 语言 */
  lang: 'zh' | 'en' | 'other';
  /** 标签 */
  tags: string[];
  /** 心得/备注 */
  note?: string;
  /** 来源（书名/网页等） */
  source?: string;
  /** 是否收藏 */
  favorite: boolean;
  /** 创建时间戳 */
  createdAt: number;
}
