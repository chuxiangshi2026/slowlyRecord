/**
 * 单词结构
 */
export interface Word extends DbDoc{
    _id: string,
    _rev?:string,
    // 是否显示，是否需要复习
    isReview:boolean,
    // 单词|文本
    text: string,
    // 是否是单词   isWord : boolean
    // 创建时间 创建生成
    ctime: Date
    // 上次复习时间 第一次创建生成
    learnDate: Date
    // 更新时间
    // updateTime?: String
    // 中文解释
    explains: string
    // 是否隐藏中文   true不显示
    explainedHidden: boolean
    // 等级
    level: 0|1|2|3|4|5|6|7|8|9|10|11|12
    // 图片
    image?: string
    // 发音
    pronunciation?: string,
    // pronunciationblob?: ArrayBuffer,
    // 音标
    phonetic?: string
    /**
     * 是否永久记住(等级>=12,状态是true)
     */
    remember: boolean
}

/**
 * 有道请求参数结构
 */
interface YdParams {
    //待翻译文本
    q: string
    // 应用ID	True	可在应用管理 查看
    appKey: string,
    // 随机字符串，可使用UUID进行生产	True
    salt: number,
    // 源语言
    from: string,
    // 目标语言
    to: string,
    // 签名	True	sha256(应用ID+input+salt+curtime+应用密钥)
    sign: string,
    // 签名类型
    signType: string,
    // 当前UTC时间戳(秒)
    curtime: number,
    ext: string
    // 用户上传的术语表
    // vocabId: vocabId,
}


/**
 * 百度翻译请求参数结构
 */
interface BdParams {
    q: string,
    from: string,
    to: string,
    appid: string,
    salt: number,
    sign: string,
}



/**
 * 谷歌翻译请求参数结构
 */
interface GgParams {
    q: string,
    source: string,
    target: string,
    format: string,
}

/**
 * 翻译平台枚举 | 'google'
 */
export type TranslationPlatform = 'youdao' | 'baidu' | 'ali' | 'utoolsai' | 'ollama' | 'deepseek' | 'qwen' | 'kimi';



/**
 * 翻译结果结构
 */
export interface TranslationResult {
    success: boolean;
    explains?: string;
    phonetic?: string;
    pronunciation?: string;
    errorMsg?: string;
}
