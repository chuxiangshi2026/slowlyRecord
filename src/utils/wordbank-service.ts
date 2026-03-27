/**
 * 在线词库服务
 * 支持从公开API/CDN获取各类考试核心词汇
 */

import type { Word } from '@/types/words';

// 词库类型定义
export type WordBankType =
  | 'cet4'      // 英语四级
  | 'cet6'      // 英语六级
  | 'kaogong'   // 考公英语
  | 'kaoyan'    // 考研英语
  | 'ielts'     // 雅思
  | 'toefl'     // 托福
  | 'gre'       // GRE
  | 'gmat'      // GMAT
  | 'zsb';      // 专升本

// 词库信息配置
export interface WordBankInfo {
  id: WordBankType;
  name: string;
  description: string;
  wordCount: number;
  icon?: string;
}

// 在线词库配置（使用公开CDN或API）
const WORDBANK_URLS: Record<WordBankType, string> = {
  // 使用 GitHub Raw 或其他公开CDN
  cet4: 'https://cdn.jsdelivr.net/gh/openlanguage/wordbanks@main/cet4.json',
  cet6: 'https://cdn.jsdelivr.net/gh/openlanguage/wordbanks@main/cet6.json',
  kaogong: 'https://cdn.jsdelivr.net/gh/openlanguage/wordbanks@main/kaogong.json',
  kaoyan: 'https://cdn.jsdelivr.net/gh/openlanguage/wordbanks@main/kaoyan.json',
  ielts: 'https://cdn.jsdelivr.net/gh/openlanguage/wordbanks@main/ielts.json',
  toefl: 'https://cdn.jsdelivr.net/gh/openlanguage/wordbanks@main/toefl.json',
  gre: 'https://cdn.jsdelivr.net/gh/openlanguage/wordbanks@main/gre.json',
  gmat: 'https://cdn.jsdelivr.net/gh/openlanguage/wordbanks@main/gmat.json',
  zsb: 'https://cdn.jsdelivr.net/gh/openlanguage/wordbanks@main/cet4.json', // 专升本使用四级词汇作为基础
};

// 词库信息列表
export const WORDBANK_LIST: WordBankInfo[] = [
  { id: 'cet4', name: '四级词汇', description: '大学英语四级核心词汇', wordCount: 4500 },
  { id: 'cet6', name: '六级词汇', description: '大学英语六级核心词汇', wordCount: 5500 },
  { id: 'zsb', name: '专升本词汇', description: '专升本英语考试核心词汇', wordCount: 4000 },
  { id: 'kaogong', name: '考公词汇', description: '公务员考试英语词汇', wordCount: 3000 },
  { id: 'kaoyan', name: '考研词汇', description: '研究生入学考试核心词汇', wordCount: 5500 },
  { id: 'ielts', name: '雅思词汇', description: '雅思考试核心词汇', wordCount: 8000 },
  { id: 'toefl', name: '托福词汇', description: '托福考试核心词汇', wordCount: 8000 },
  { id: 'gre', name: 'GRE词汇', description: 'GRE考试核心词汇', wordCount: 10000 },
  { id: 'gmat', name: 'GMAT词汇', description: 'GMAT考试核心词汇', wordCount: 6000 },
];

// 缓存管理
const CACHE_KEY_PREFIX = 'wordbank_cache_';
const CACHE_EXPIRY = 7 * 24 * 60 * 60 * 1000; // 7天过期

interface CacheData {
  timestamp: number;
  words: Word[];
}

/**
 * 从缓存获取词库
 */
function getFromCache(type: WordBankType): Word[] | null {
  try {
    const cacheKey = CACHE_KEY_PREFIX + type;
    const cached = localStorage.getItem(cacheKey);
    if (!cached) return null;

    const data: CacheData = JSON.parse(cached);
    const now = Date.now();

    // 检查是否过期
    if (now - data.timestamp > CACHE_EXPIRY) {
      localStorage.removeItem(cacheKey);
      return null;
    }

    return data.words;
  } catch {
    return null;
  }
}

/**
 * 保存到缓存
 */
function saveToCache(type: WordBankType, words: Word[]): void {
  try {
    const cacheKey = CACHE_KEY_PREFIX + type;
    const data: CacheData = {
      timestamp: Date.now(),
      words,
    };
    localStorage.setItem(cacheKey, JSON.stringify(data));
  } catch (e) {
    console.warn('缓存词库失败:', e);
  }
}

/**
 * 获取在线词库
 * @param type 词库类型
 * @param useCache 是否使用缓存
 * @returns 单词列表
 */
export async function fetchWordBank(
  type: WordBankType,
  useCache: boolean = true
): Promise<Word[]> {
  // 先检查缓存
  if (useCache) {
    const cached = getFromCache(type);
    if (cached) {
      console.log(`[WordBank] 使用缓存: ${type}`);
      return cached;
    }
  }

  // 尝试从在线获取
  try {
    const url = WORDBANK_URLS[type];
    console.log(`[WordBank] 获取在线词库: ${type} from ${url}`);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    const words = normalizeWords(data.words || data);

    // 保存到缓存
    saveToCache(type, words);

    return words;
  } catch (error) {
    console.warn(`[WordBank] 在线获取失败: ${type}`, error);

    // 如果在线获取失败，使用内置备用词库
    return getFallbackWords(type);
  }
}

/**
 * 标准化单词数据格式
 */
function normalizeWords(data: any[]): Word[] {
  return data.map((item, index) => ({
    _id: `wordbank_${Date.now()}_${index}`,
    text: item.word || item.text || '',
    phonetic: item.phonetic || item.phoneticSymbol || '',
    explains: Array.isArray(item.explains)
      ? item.explains.join('; ')
      : (item.translation || item.meaning || item.explains || ''),
    isReview: false,
    ctime: new Date(),
    learnDate: new Date(),
    level: 1 as Word['level'],
    explainedHidden: false,
    remember: false,
  })).filter(w => w.text && /^[a-zA-Z]+$/.test(w.text));
}

/**
 * 获取备用词库（当在线获取失败时使用）
 * 包含各词库的核心高频词
 */
function getFallbackWords(type: WordBankType): Word[] {
  const fallbackData: Record<WordBankType, Array<{word: string; phonetic?: string; explains: string}>> = {
    cet4: [
      { word: 'abandon', phonetic: '/əˈbændən/', explains: 'v. 放弃；抛弃' },
      { word: 'ability', phonetic: '/əˈbɪləti/', explains: 'n. 能力；才能' },
      { word: 'absence', phonetic: '/ˈæbsəns/', explains: 'n. 缺席；缺乏' },
      { word: 'absolute', phonetic: '/ˈæbsəluːt/', explains: 'adj. 绝对的；完全的' },
      { word: 'absorb', phonetic: '/əbˈzɔːb/', explains: 'v. 吸收；吸引' },
      { word: 'abstract', phonetic: '/ˈæbstrækt/', explains: 'adj. 抽象的；n. 摘要' },
      { word: 'abundant', phonetic: '/əˈbʌndənt/', explains: 'adj. 丰富的；充裕的' },
      { word: 'academic', phonetic: '/ˌækəˈdemɪk/', explains: 'adj. 学术的；学院的' },
      { word: 'academy', phonetic: '/əˈkædəmi/', explains: 'n. 学院；研究院' },
      { word: 'accelerate', phonetic: '/əkˈseləreɪt/', explains: 'v. 加速；促进' },
      { word: 'access', phonetic: '/ˈækses/', explains: 'n. 进入；使用权' },
      { word: 'accident', phonetic: '/ˈæksɪdənt/', explains: 'n. 事故；意外' },
      { word: 'accompany', phonetic: '/əˈkʌmpəni/', explains: 'v. 陪伴；伴随' },
      { word: 'accomplish', phonetic: '/əˈkʌmplɪʃ/', explains: 'v. 完成；实现' },
      { word: 'account', phonetic: '/əˈkaʊnt/', explains: 'n. 账户；描述' },
      { word: 'accumulate', phonetic: '/əˈkjuːmjəleɪt/', explains: 'v. 积累；积聚' },
      { word: 'accurate', phonetic: '/ˈækjərət/', explains: 'adj. 准确的；精确的' },
      { word: 'accuse', phonetic: '/əˈkjuːz/', explains: 'v. 指控；指责' },
      { word: 'achievement', phonetic: '/əˈtʃiːvmənt/', explains: 'n. 成就；完成' },
      { word: 'acquire', phonetic: '/əˈkwaɪər/', explains: 'v. 获得；学到' },
      { word: 'adapt', phonetic: '/əˈdæpt/', explains: 'v. 适应；改编' },
      { word: 'adequate', phonetic: '/ˈædɪkwət/', explains: 'adj. 足够的；适当的' },
      { word: 'adjust', phonetic: '/əˈdʒʌst/', explains: 'v. 调整；适应' },
      { word: 'administration', phonetic: '/ədˌmɪnɪˈstreɪʃn/', explains: 'n. 管理；行政部门' },
      { word: 'admire', phonetic: '/ədˈmaɪər/', explains: 'v. 钦佩；羡慕' },
      { word: 'admit', phonetic: '/ədˈmɪt/', explains: 'v. 承认；准许进入' },
      { word: 'adopt', phonetic: '/əˈdɒpt/', explains: 'v. 采用；收养' },
      { word: 'advance', phonetic: '/ədˈvɑːns/', explains: 'v. 前进；提前' },
      { word: 'advanced', phonetic: '/ədˈvɑːnst/', explains: 'adj. 高级的；先进的' },
      { word: 'advantage', phonetic: '/ədˈvɑːntɪdʒ/', explains: 'n. 优势；有利条件' },
      { word: 'adventure', phonetic: '/ədˈventʃər/', explains: 'n. 冒险；奇遇' },
      { word: 'advertise', phonetic: '/ˈædvətaɪz/', explains: 'v. 做广告；宣传' },
      { word: 'advice', phonetic: '/ədˈvaɪs/', explains: 'n. 建议；忠告' },
      { word: 'advocate', phonetic: '/ˈædvəkeɪt/', explains: 'v. 提倡；n. 拥护者' },
      { word: 'affect', phonetic: '/əˈfekt/', explains: 'v. 影响；感动' },
      { word: 'agency', phonetic: '/ˈeɪdʒənsi/', explains: 'n. 代理；代理处' },
      { word: 'agenda', phonetic: '/əˈdʒendə/', explains: 'n. 议程；议题' },
      { word: 'agriculture', phonetic: '/ˈæɡrɪkʌltʃər/', explains: 'n. 农业；农学' },
      { word: 'aircraft', phonetic: '/ˈeəkrɑːft/', explains: 'n. 飞机；航空器' },
      { word: 'alarm', phonetic: '/əˈlɑːm/', explains: 'n. 警报；惊慌' },
      { word: 'alcohol', phonetic: '/ˈælkəhɒl/', explains: 'n. 酒精；含酒精饮料' },
      { word: 'alert', phonetic: '/əˈlɜːt/', explains: 'adj. 警觉的；n. 警报' },
      { word: 'alliance', phonetic: '/əˈlaɪəns/', explains: 'n. 联盟；联合' },
      { word: 'allowance', phonetic: '/əˈlaʊəns/', explains: 'n. 津贴；允许' },
      { word: 'alter', phonetic: '/ˈɔːltər/', explains: 'v. 改变；变更' },
      { word: 'alternative', phonetic: '/ɔːlˈtɜːnətɪv/', explains: 'adj. 两者选一的；n. 选择' },
      { word: 'amateur', phonetic: '/ˈæmətər/', explains: 'n. 业余爱好者；adj. 业余的' },
      { word: 'ambassador', phonetic: '/æmˈbæsədə/', explains: 'n. 大使；代表' },
      { word: 'ambition', phonetic: '/æmˈbɪʃn/', explains: 'n. 雄心；抱负' },
      { word: 'ambulance', phonetic: '/ˈæmbjələns/', explains: 'n. 救护车' },
      { word: 'amuse', phonetic: '/əˈmjuːz/', explains: 'v. 逗乐；娱乐' },
      { word: 'analysis', phonetic: '/əˈnæləsɪs/', explains: 'n. 分析；分解' },
      { word: 'analyze', phonetic: '/ˈænəlaɪz/', explains: 'v. 分析；分解' },
      { word: 'ancestor', phonetic: '/ˈænsestər/', explains: 'n. 祖先；原型' },
      { word: 'anchor', phonetic: '/ˈæŋkər/', explains: 'n. 锚；v. 抛锚' },
      { word: 'ancient', phonetic: '/ˈeɪnʃənt/', explains: 'adj. 古代的；古老的' },
      { word: 'angle', phonetic: '/ˈæŋɡl/', explains: 'n. 角；角度' },
      { word: 'anniversary', phonetic: '/ˌænɪˈvɜːsəri/', explains: 'n. 周年纪念' },
      { word: 'announce', phonetic: '/əˈnaʊns/', explains: 'v. 宣布；宣告' },
      { word: 'annoy', phonetic: '/əˈnɔɪ/', explains: 'v. 使恼怒；打扰' },
      { word: 'annual', phonetic: '/ˈænjuəl/', explains: 'adj. 每年的；n. 年刊' },
      { word: 'anticipate', phonetic: '/ænˈtɪsɪpeɪt/', explains: 'v. 预期；预料' },
      { word: 'anxiety', phonetic: '/æŋˈzaɪəti/', explains: 'n. 焦虑；渴望' },
      { word: 'apart', phonetic: '/əˈpɑːt/', explains: 'adv. 分开；分离' },
      { word: 'apology', phonetic: '/əˈpɒlədʒi/', explains: 'n. 道歉；辩护' },
      { word: 'apparent', phonetic: '/əˈpærənt/', explains: 'adj. 明显的；表面上的' },
      { word: 'appeal', phonetic: '/əˈpiːl/', explains: 'v. 呼吁；吸引；n. 吸引力' },
      { word: 'appetite', phonetic: '/ˈæpɪtaɪt/', explains: 'n. 食欲；欲望' },
      { word: 'applaud', phonetic: '/əˈplɔːd/', explains: 'v. 鼓掌；称赞' },
      { word: 'applicant', phonetic: '/ˈæplɪkənt/', explains: 'n. 申请人' },
      { word: 'application', phonetic: '/ˌæplɪˈkeɪʃn/', explains: 'n. 申请；应用' },
      { word: 'appoint', phonetic: '/əˈpɔɪnt/', explains: 'v. 任命；约定' },
      { word: 'appreciate', phonetic: '/əˈpriːʃieɪt/', explains: 'v. 欣赏；感激' },
      { word: 'approach', phonetic: '/əˈprəʊtʃ/', explains: 'v. 接近；n. 方法' },
      { word: 'appropriate', phonetic: '/əˈprəʊpriət/', explains: 'adj. 适当的' },
      { word: 'approve', phonetic: '/əˈpruːv/', explains: 'v. 批准；赞成' },
      { word: 'approximate', phonetic: '/əˈprɒksɪmət/', explains: 'adj. 近似的；v. 近似' },
      { word: 'arbitrary', phonetic: '/ˈɑːbɪtrəri/', explains: 'adj. 任意的；专断的' },
      { word: 'architect', phonetic: '/ˈɑːkɪtekt/', explains: 'n. 建筑师' },
      { word: 'argue', phonetic: '/ˈɑːɡjuː/', explains: 'v. 争论；辩论' },
      { word: 'arise', phonetic: '/əˈraɪz/', explains: 'v. 出现；升起' },
      { word: 'arrange', phonetic: '/əˈreɪndʒ/', explains: 'v. 安排；整理' },
      { word: 'arrest', phonetic: '/əˈrest/', explains: 'v. 逮捕；阻止' },
      { word: 'arrow', phonetic: '/ˈærəʊ/', explains: 'n. 箭；箭头' },
      { word: 'article', phonetic: '/ˈɑːtɪkl/', explains: 'n. 文章；物品；冠词' },
      { word: 'artificial', phonetic: '/ˌɑːtɪˈfɪʃl/', explains: 'adj. 人造的；矫揉造作的' },
      { word: 'ashamed', phonetic: '/əˈʃeɪmd/', explains: 'adj. 惭愧的；羞耻的' },
      { word: 'aspect', phonetic: '/ˈæspekt/', explains: 'n. 方面；朝向' },
      { word: 'assemble', phonetic: '/əˈsembl/', explains: 'v. 集合；装配' },
      { word: 'assess', phonetic: '/əˈses/', explains: 'v. 评估；评价' },
      { word: 'assign', phonetic: '/əˈsaɪn/', explains: 'v. 分配；指派' },
      { word: 'assist', phonetic: '/əˈsɪst/', explains: 'v. 协助；帮助' },
      { word: 'associate', phonetic: '/əˈsəʊʃieɪt/', explains: 'v. 联想；交往' },
      { word: 'assume', phonetic: '/əˈsjuːm/', explains: 'v. 假定；承担' },
      { word: 'assure', phonetic: '/əˈʃʊər/', explains: 'v. 保证；使确信' },
      { word: 'astonish', phonetic: '/əˈstɒnɪʃ/', explains: 'v. 使惊讶' },
      { word: 'athlete', phonetic: '/ˈæθliːt/', explains: 'n. 运动员' },
      { word: 'atmosphere', phonetic: '/ˈætməsfɪər/', explains: 'n. 大气；气氛' },
      { word: 'attach', phonetic: '/əˈtætʃ/', explains: 'v. 附上；使依恋' },
      { word: 'attain', phonetic: '/əˈteɪn/', explains: 'v. 达到；获得' },
      { word: 'attempt', phonetic: '/əˈtempt/', explains: 'v. 尝试；n. 企图' },
      { word: 'attend', phonetic: '/əˈtend/', explains: 'v. 出席；照料' },
      { word: 'attention', phonetic: '/əˈtenʃn/', explains: 'n. 注意；关心' },
      { word: 'attitude', phonetic: '/ˈætɪtjuːd/', explains: 'n. 态度；看法' },
      { word: 'attract', phonetic: '/əˈtrækt/', explains: 'v. 吸引；引起' },
      { word: 'attraction', phonetic: '/əˈtrækʃn/', explains: 'n. 吸引；吸引力' },
      { word: 'authority', phonetic: '/ɔːˈθɒrəti/', explains: 'n. 权威；当局' },
      { word: 'automatic', phonetic: '/ˌɔːtəˈmætɪk/', explains: 'adj. 自动的' },
      { word: 'available', phonetic: '/əˈveɪləbl/', explains: 'adj. 可用的；可得到的' },
      { word: 'avenue', phonetic: '/ˈævənjuː/', explains: 'n. 大街；途径' },
      { word: 'average', phonetic: '/ˈævərɪdʒ/', explains: 'n. 平均数；adj. 平均的' },
      { word: 'avoid', phonetic: '/əˈvɔɪd/', explains: 'v. 避免；躲开' },
      { word: 'awake', phonetic: '/əˈweɪk/', explains: 'adj. 醒着的；v. 唤醒' },
      { word: 'award', phonetic: '/əˈwɔːd/', explains: 'n. 奖；v. 授予' },
      { word: 'aware', phonetic: '/əˈweər/', explains: 'adj. 意识到的' },
      { word: 'awful', phonetic: '/ˈɔːfl/', explains: 'adj. 可怕的；糟糕的' },
      { word: 'awkward', phonetic: '/ˈɔːkwəd/', explains: 'adj. 笨拙的；尴尬的' },
    ],
    // 其他词库的备用数据简化处理，使用cet4数据作为基础
    cet6: [],
    zsb: [],
    kaogong: [],
    kaoyan: [],
    ielts: [],
    toefl: [],
    gre: [],
    gmat: [],
  };

  // 为其他词库复制基础数据并添加一些特定词汇
  const baseWords = fallbackData.cet4;

  // 六级添加更多学术词汇
  fallbackData.cet6 = [
    ...baseWords,
    { word: 'abstract', phonetic: '/ˈæbstrækt/', explains: 'adj. 抽象的；n. 摘要' },
    { word: 'academy', phonetic: '/əˈkædəmi/', explains: 'n. 学院；研究院' },
    { word: 'accumulate', phonetic: '/əˈkjuːmjəleɪt/', explains: 'v. 积累；积聚' },
    { word: 'accurate', phonetic: '/ˈækjərət/', explains: 'adj. 准确的；精确的' },
    { word: 'accustomed', phonetic: '/əˈkʌstəmd/', explains: 'adj. 习惯的；通常的' },
  ];

  // 考研词汇
  fallbackData.kaoyan = [
    ...baseWords,
    { word: 'abnormal', phonetic: '/æbˈnɔːml/', explains: 'adj. 反常的；不规则的' },
    { word: 'abolish', phonetic: '/əˈbɒlɪʃ/', explains: 'v. 废除；废止' },
    { word: 'abrupt', phonetic: '/əˈbrʌpt/', explains: 'adj. 突然的；唐突的' },
    { word: 'absence', phonetic: '/ˈæbsəns/', explains: 'n. 缺席；缺乏' },
    { word: 'absolute', phonetic: '/ˈæbsəluːt/', explains: 'adj. 绝对的；完全的' },
  ];

  // 专升本词汇（介于四级和六级之间）
  fallbackData.zsb = [
    ...baseWords,
    { word: 'abnormal', phonetic: '/æbˈnɔːml/', explains: 'adj. 反常的；不规则的' },
    { word: 'abolish', phonetic: '/əˈbɒlɪʃ/', explains: 'v. 废除；废止' },
    { word: 'abrupt', phonetic: '/əˈbrʌpt/', explains: 'adj. 突然的；唐突的' },
    { word: 'absolute', phonetic: '/ˈæbsəluːt/', explains: 'adj. 绝对的；完全的' },
    { word: 'absorb', phonetic: '/əbˈzɔːb/', explains: 'v. 吸收；吸引' },
  ];

  // 其他词库使用基础数据
  fallbackData.kaogong = baseWords;
  fallbackData.ielts = baseWords;
  fallbackData.toefl = baseWords;
  fallbackData.gre = baseWords;
  fallbackData.gmat = baseWords;

  return normalizeWords(fallbackData[type] || baseWords);
}

/**
 * 清除词库缓存
 */
export function clearWordBankCache(type?: WordBankType): void {
  if (type) {
    localStorage.removeItem(CACHE_KEY_PREFIX + type);
  } else {
    // 清除所有词库缓存
    Object.keys(localStorage)
      .filter(key => key.startsWith(CACHE_KEY_PREFIX))
      .forEach(key => localStorage.removeItem(key));
  }
}

/**
 * 获取词库信息
 */
export function getWordBankInfo(type: WordBankType): WordBankInfo | undefined {
  return WORDBANK_LIST.find(wb => wb.id === type);
}

/**
 * 检查词库是否已缓存
 */
export function isWordBankCached(type: WordBankType): boolean {
  return getFromCache(type) !== null;
}

export default {
  fetchWordBank,
  clearWordBankCache,
  getWordBankInfo,
  isWordBankCached,
  WORDBANK_LIST,
};
