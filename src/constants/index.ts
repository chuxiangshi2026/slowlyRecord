import {AppInfo} from "@/config.ts";

// 默认复习间隔（单位：分钟） 0/5 1/30 2/6*60  3/12h    4/1d      5/2           6/4        7/一周        8/半月
const DEFAULT_INTERVALS = [1, 5, 30, 6 * 60, 12 * 60, 24 * 60, 2 * 24 * 60, 4 * 24 * 60, 7 * 24 * 60, 15 * 24 * 60,
    //  9/1个月         10/3个月                11/半年                12/1年
    30 * 24 * 60, 3 * 30 * 24 * 60, 6 * 30 * 24 * 60, 12 * 30 * 24 * 60];

//复习间隔（单位：分钟） 测试用，时间比较短
// const DEFAULT_INTERVALS = [0.1, 0.2, 0.3, 0.5, 1];


// 应用ID
const APP_KEY = AppInfo.youdao.appkey;
// 应用密钥
const KEY = AppInfo.youdao.key;//注意：暴露appSecret，有被盗用造成损失的风险


// 多个query可以用\n连接  如 query='apple\norange\nbanana\npear'
const FROM = 'en';
// const TO = 'zh-CHS';
const TO = 'zh';

// 支持的平台配置模板
const API_PLATFORMS = {
    youdao: {
        name: 'YouDao',
        requireKey: true,
        free: false,
        url: 'https://openapi.youdao.com/api',
        languages: ['ZH', 'EN', 'JA', 'DE', 'FR']
    },
    baidu: {
        name: 'BaiDu',
        requireKey: true,
        free: false,
        url: 'https://fanyi-api.baidu.com/api/trans/vip/translate',
        languages: ['ZH', 'EN', 'JA', 'DE', 'FR']
    }, ali: {
        name: 'AliYun',
        requireKey: true,
        free: false,
        url: 'https://mt.aliyuncs.com/',
        languages: ['ZH', 'EN', 'JA', 'DE', 'FR']
    },
    deepl: {
        name: 'DeepL',
        requireKey: true,
        free: false,
        url: 'https://api.deepl.com/v2/translate',
        languages: ['ZH', 'EN', 'JA', 'DE', 'FR']
    },
    deeplx: {
        name: 'DeepLX',
        requireKey: false,
        free: true,
        url: 'http://localhost:1188/translate',
        languages: ['zh', 'en', 'ja', 'de']
    },
    google: {
        name: 'Google',
        requireKey: false,
        free: true,
        url: 'https://translate.googleapis.com/translate_a/single',
        languages: ['zh-CN', 'en', 'ja', 'ko', 'auto']
    },
    openai: {
        name: 'OpenAI',
        requireKey: true,
        free: false,
        url: 'https://api.openai.com/v1/chat/completions',
        languages: ['zh', 'en', 'ja', 'auto']
    }
};

// 默认配置
const DEFAULT_CONFIG = {
    currentAPI: 'youdao',
    apiKeys: {
        youdao: { key: '', appkey:'',endpoint: 'https://openapi.youdao.com/api' },
        baidu: { key: '', appkey:'',endpoint: 'https://fanyi-api.baidu.com/api/trans/vip/translate' },
        ali: { key: '', appkey:'',endpoint: 'https://mt.aliyuncs.com/' },
        deepl: { key: '', appkey:'',endpoint: '' },
        openai: { key: '', appkey:'',endpoint: 'https://api.openai.com' },
        deeplx: { key: '', appkey:'',endpoint: 'http://localhost:1188' }
    },
    targetLang: 'zh'
};




/**
 *数据库中集合名
 */
const DB_KEY = 'words-list';

export {DEFAULT_INTERVALS, APP_KEY, KEY, FROM, TO, DB_KEY};
