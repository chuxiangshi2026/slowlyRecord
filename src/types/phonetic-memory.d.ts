/**
 * 音标学习进度类型
 */

export interface PhonemeProgress {
    /** IPA 符号 */
    ipa: string;
    /** 等级 0-12,对应 DEFAULT_INTERVALS;>=7 视为已掌握 */
    level: number;
    /** 上次练习时间戳 */
    learnDate: number;
    /** 正确次数 */
    correct: number;
    /** 错误次数 */
    wrong: number;
}

export interface MinimalPairProgress {
    /** 对子唯一键,格式 `a|b`(按字母排序) */
    pairKey: string;
    level: number;
    learnDate: number;
    correct: number;
    wrong: number;
}

export interface PhoneticProgressDoc {
    _id: string;
    _rev?: string;
    /** 按 IPA 索引的音素进度 */
    phonemes: Record<string, PhonemeProgress>;
    /** 按 pairKey 索引的对子进度 */
    pairs: Record<string, MinimalPairProgress>;
}
