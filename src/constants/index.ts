import {AppInfo} from "@/config.ts";

// 默认复习间隔（单位：分钟） 0/5 1/30 2/6*60  3/12h    4/1d      5/2           6/4        7/一周        8/半月
const DEFAULT_INTERVALS = [1, 5, 30, 6 * 60, 12 * 60, 24 * 60, 2 * 24 * 60, 4 * 24 * 60, 7 * 24 * 60, 15 * 24 * 60,
    //  9/1个月         10/3个月                11/半年                12/1年
    30 * 24 * 60, 3 * 30 * 24 * 60, 6 * 30 * 24 * 60, 12 * 30 * 24 * 60];

//复习间隔（单位：分钟） 测试用，时间比较短
// const DEFAULT_INTERVALS = [0.1, 0.2, 0.3, 0.5, 1,2,3,4,5,6,7,8];


// 应用ID
const APP_KEY = AppInfo.youdao.appkey;
// 应用密钥
const KEY = AppInfo.youdao.key;//注意：暴露appSecret，有被盗用造成损失的风险


// 多个query可以用\n连接  如 query='apple\norange\nbanana\npear'
const FROM = 'en';
// const TO = 'zh-CHS';
const TO = 'zh';

// 使用限制配置
const USAGE_LIMITS = {
    // 普通翻译和批量翻译共用的每日限制次数
    TRANSLATION_DAILY_LIMIT: 500,
    // OCR翻译（截图翻译）的每日限制次数
    OCR_DAILY_LIMIT: 5,
    // 腾讯 OCR 的每日限制次数（单独统计）
    TENCENT_OCR_DAILY_LIMIT: 10
};

/**
 *数据库中集合名
 */
const DB_KEY = 'words-list';
/**
 *数据库中用户设置集合名
 */
const DB_KEY_USER_SET = 'user-set';

/**
 * 数字记忆训练数据库前缀
 */
const DB_KEY_NUMBER_MEMORY = 'number_memory_';

/**
 * 拼写练习进度数据库前缀
 */
const DB_KEY_DICTATION = 'dictation_';

/**
 * 词库管理数据库键名
 */
const DB_KEY_WORDBANK = 'wordbank_data';

/**
 * 快捷键记忆数据库前缀
 */
const DB_KEY_SHORTCUT_MEMORY = 'shortcut_memory_';

/**
 * 字母映射表数据库前缀
 */
const DB_KEY_LETTER_MEMORY = 'letter_memory_';

/**
 * 音标学习数据库前缀
 */
const DB_KEY_PHONETIC_MEMORY = 'phonetic_memory_';

/**
 * 通用知识包数据库前缀
 */
const DB_KEY_KNOWLEDGE_MEMORY = 'knowledge_memory_';

/**
 * 记忆宫殿数据库前缀
 */
const DB_KEY_MEMORY_PALACE = 'memory_palace_';

export {DEFAULT_INTERVALS, APP_KEY, KEY, FROM, TO, DB_KEY, DB_KEY_USER_SET, USAGE_LIMITS, DB_KEY_NUMBER_MEMORY, DB_KEY_DICTATION, DB_KEY_WORDBANK, DB_KEY_SHORTCUT_MEMORY, DB_KEY_LETTER_MEMORY, DB_KEY_PHONETIC_MEMORY, DB_KEY_KNOWLEDGE_MEMORY, DB_KEY_MEMORY_PALACE};
