/**
 * 记忆宫殿（MemoryPalace）类型定义
 *
 * 宫殿 = 一组有序的地点桩（loci）；桩上可挂载内容（PegItem）。
 * 挂载内容为引用（文本记忆文章切块）或自由文本，引用不复制内容。
 */

/** 宫殿中的一个地点桩 */
export interface PalaceLocus {
  /** 顺序号（从 1 开始，巡视按此顺序） */
  order: number;
  /** 桩名称（如"立春"、"大门"） */
  name: string;
  /** 桩图片（压缩后的 dataURL） */
  imageUrl?: string;
  /** 桩描述 */
  description?: string;
}

/** 记忆宫殿 */
export interface Palace {
  _id: string;
  _rev?: string;
  /** 宫殿名称 */
  name: string;
  /** 有序地点桩列表 */
  loci: PalaceLocus[];
  /** 来源知识包 id（内置桩库导入时记录） */
  sourcePackId?: string;
  /** 创建时间 */
  ctime: number;
  /** 更新时间 */
  utime: number;
}

/** 挂载内容引用（只存引用，不复制内容） */
export interface PegContentRef {
  /** 引用类型，目前仅支持文本记忆文章 */
  type: 'text-article';
  /** 文章 _id */
  articleId: string;
  /** 切块索引（按句/段切块后的下标，从 0 开始） */
  chunkIndex: number;
  /** 切块方式（可选，缺省按句切） */
  mode?: ChunkMode;
}

/** 桩上挂载的内容 */
export interface PegItem {
  _id: string;
  _rev?: string;
  /** 所属宫殿 _id */
  palaceId: string;
  /** 挂载到的桩顺序号（对应 PalaceLocus.order） */
  locusOrder: number;
  /** 引用内容（与 freeText 二选一） */
  contentRef?: PegContentRef;
  /** 自由文本内容 */
  freeText?: string;
  /** 助记说明（联想线索） */
  mnemonic?: string;
  /** SRS 等级 0-12（可选，未自评过为空，按 0 处理） */
  level?: number;
  /** 上次自评时间戳 */
  learnDate?: number;
}

/** 宫殿列表数据库文档 */
export interface PalaceListDoc {
  _id: string;
  _rev?: string;
  type: 'memory_palace_palaces';
  palaces: Palace[];
  updatedAt: number;
}

/** 单个宫殿的桩挂载数据库文档 */
export interface PegListDoc {
  _id: string;
  _rev?: string;
  type: 'memory_palace_pegs';
  /** 所属宫殿 _id */
  palaceId: string;
  items: PegItem[];
  updatedAt: number;
}

/** 切块方式 */
export type ChunkMode = 'sentence' | 'paragraph';

/** resolvePegContent 的解析结果 */
export interface ResolvedPegContent {
  /** 展示文本（空串表示无内容） */
  text: string;
  /** 引用源是否已删除（文章不存在或切块越界） */
  deleted: boolean;
  /** 引用文章标题（自由文本时为空） */
  articleTitle?: string;
}
