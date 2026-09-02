/**
 * 通用知识包（KnowledgeMemory）类型定义
 */

/** 知识包中的单个问答对 */
export interface KnowledgeItem {
    /** 条目唯一标识 */
    id: string;
    /** 问题/提示（如乘法 2×3、元素符号 H） */
    question: string;
    /** 答案（如 6、氢） */
    answer: string;
    /** 额外展示字段（如元素序数/拼音） */
    extras?: Record<string, string>;
    /** 备选桩名（usableAsPeg 包的可选字段，如数字桩的多个形象） */
    alternates?: string[];
    /** 有序包中的顺序号（从 1 开始） */
    order?: number;
}

/** 知识包元数据 + 条目 */
export interface KnowledgePack {
    /** 包唯一标识 */
    id: string;
    /** 包名称 */
    name: string;
    /** 包描述 */
    description: string;
    /** 是否是有序列表（顺序本身是考点） */
    ordered: boolean;
    /** 是否可作为记忆宫殿的桩库 */
    usableAsPeg: boolean;
    /** 记忆口诀（可选，每个元素一句/一行，预览视图展示） */
    mnemonics?: string[];
    /** 条目列表 */
    items: KnowledgeItem[];
}

/** 知识包分类：math 融入数字记忆，text 融入文本记忆 */
export type KnowledgePackCategory = 'math' | 'text';

/** 知识包在列表中的轻量信息 */
export interface KnowledgePackInfo {
    id: string;
    name: string;
    description: string;
    itemCount: number;
    ordered: boolean;
    usableAsPeg: boolean;
    /** 宿主分类：数学强相关为 math，文本/常识类为 text */
    category: KnowledgePackCategory;
    /**
     * 数据版本号（缺省视为 1）。包内容发生结构性变更时递增，
     * localStorage 缓存中版本不一致的条目自动失效重新加载。
     */
    version?: number;
}

/** 单个条目的练习进度 */
export interface KnowledgeItemProgress {
    /** 对应 KnowledgeItem.id */
    itemId: string;
    /** SRS 等级 0-12 */
    level: number;
    /** 上次学习/复习时间戳 */
    learnDate: number;
    /** 累计答对次数 */
    correct: number;
    /** 累计答错次数 */
    wrong: number;
}

/** 每个知识包的进度文档 */
export interface KnowledgePackProgressDoc {
    _id: string;
    _rev?: string;
    type: 'knowledge_pack_progress';
    /** 对应 KnowledgePack.id */
    packId: string;
    /** 以 itemId 为键的进度映射 */
    items: Record<string, KnowledgeItemProgress>;
}

/** 用户自建知识条目（手动/批量添加，按知识集分组） */
export interface KnowledgeCustomItem {
    /** 条目唯一标识 */
    id: string;
    /** 所属知识集名称（可选） */
    setName?: string;
    /** 名称/问题 */
    question: string;
    /** 答案/释义 */
    answer: string;
    /** 标签 */
    tags?: string[];
    /** 创建时间 */
    ctime: number;
}

/** 自建知识条目文档（单文档存储全部自建条目） */
export interface KnowledgeCustomItemsDoc {
    _id: string;
    _rev?: string;
    type: 'knowledge_custom_items';
    items: KnowledgeCustomItem[];
}

/** 已导入知识包清单文档（知识库默认空，导入的包才在面板展示） */
export interface KnowledgeImportedDoc {
    _id: string;
    _rev?: string;
    type: 'knowledge_imported_list';
    /** 已导入的知识包 id 列表 */
    ids: string[];
}

/** 练习模式 */
export type KnowledgePracticeMode =
    | 'q2a'        // 看问题想答案（翻卡）
    | 'a2q'        // 看答案想问题（反向）
    | 'choice'     // 四选一
    | 'ordered'    // 顺序回忆（仅 ordered 包）
    | 'input';     // 键盘输入答案
