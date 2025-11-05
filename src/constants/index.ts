import {AppInfo} from "@/config.ts";

// 默认复习间隔（单位：分钟） 0/5 1/30 2/6*60  3/12h    4/1d      5/2           6/4        7/一周        8/半月
// export const DEFAULT_INTERVALS = [5, 30, 6 * 60, 12 * 60, 24 * 60, 2 * 24 * 60, 4 * 24 * 60, 7 * 24 * 60, 15 * 24 * 60,
//     //  9/1个月         10/3个月                11/半年                12/1年
//     30 * 24 * 60, 3 * 30 * 24 * 60, 6 * 30 * 24 * 60, 12 * 30 * 24 * 60];

//复习间隔（单位：分钟） 测试用，时间比较短
const DEFAULT_INTERVALS = [0.1, 0.2, 0.3, 0.5, 1];



// 应用ID
const APP_KEY = AppInfo.appkey;
// 应用密钥
const KEY = AppInfo.key;//注意：暴露appSecret，有被盗用造成损失的风险


// 多个query可以用\n连接  如 query='apple\norange\nbanana\npear'
const FROM = 'en';
const TO = 'zh-CHS';
/**
 *数据库中集合名
 */
const DB_KEY = 'words-list';

export {DEFAULT_INTERVALS, APP_KEY, KEY, FROM, TO, DB_KEY};
