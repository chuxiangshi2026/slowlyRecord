  /**
 * 本地离线词库服务
 * 直接从本地 wordbanks 目录加载各类考试核心词汇
 */

import type { Word } from '@/types/words';
import { PREFIXES_DATA, SUFFIXES_DATA, ROOTS_DATA } from './affix-data';
import {inferItemType} from '@/utils/text-utils';

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
  | 'bec'       // 商务英语
  | 'level4'    // 专业四级
  | 'level8'    // 专业八级
  | 'zsb'       // 专升本
  | 'sat'       // SAT
  | 'roots'     // 词根词缀
  | 'phrasal-verbs'  // 短语动词
  | 'collocations'   // 固定搭配
  | 'idioms';        // 习语

// 词库信息配置
export interface WordBankInfo {
  id: WordBankType;
  name: string;
  description: string;
  wordCount: number;
  icon?: string;
}

// 本地词库文件路径（相对于public目录）
// 使用相对路径以适配 base: './' 配置
const LOCAL_WORDBANK_PATH = import.meta.env.BASE_URL + 'wordbanks/';

// 加载策略配置
export interface LoadStrategy {
  priority: 'local' | 'online';   // 加载策略
  useCache: boolean;              // 是否使用缓存
  timeout: number;                // 超时时间(ms)
}

// 默认加载策略：仅使用本地词库
export const DEFAULT_STRATEGY: LoadStrategy = {
  priority: 'local',
  useCache: true,
  timeout: 5000,
};

// 词库信息列表（从本地 wordbanks 目录加载）
export const WORDBANK_LIST: WordBankInfo[] = [
  { id: 'cet4', name: '四级词汇', description: '大学英语四级核心词汇', wordCount: 0 },
  { id: 'cet6', name: '六级词汇', description: '大学英语六级核心词汇', wordCount: 0 },
  { id: 'bec', name: '商务英语', description: '商务英语考试核心词汇', wordCount: 0 },
  { id: 'gmat', name: 'GMAT词汇', description: 'GMAT考试核心词汇', wordCount: 0 },
  { id: 'gre', name: 'GRE词汇', description: 'GRE考试核心词汇', wordCount: 0 },
  { id: 'ielts', name: '雅思词汇', description: '雅思考试核心词汇', wordCount: 0 },
  { id: 'kaogong', name: '考公词汇', description: '公务员考试英语词汇', wordCount: 0 },
  { id: 'kaoyan', name: '考研词汇', description: '研究生入学考试核心词汇', wordCount: 0 },
  { id: 'level4', name: '专业四级', description: '英语专业四级核心词汇', wordCount: 0 },
  { id: 'level8', name: '专业八级', description: '英语专业八级核心词汇', wordCount: 0 },
  { id: 'sat', name: 'SAT词汇', description: 'SAT考试核心词汇', wordCount: 0 },
  { id: 'toefl', name: '托福词汇', description: '托福考试核心词汇', wordCount: 0 },
  { id: 'zsb', name: '专升本词汇', description: '专升本英语考试核心词汇', wordCount: 0 },
  { id: 'roots', name: '词根词缀', description: '英语常见词根、前缀、后缀', wordCount: 452 },
  { id: 'phrasal-verbs', name: '短语动词', description: '英语常用短语动词', wordCount: 135 },
  { id: 'collocations', name: '固定搭配', description: '英语常用固定搭配', wordCount: 199 },
  { id: 'idioms', name: '习语', description: '英语常用习语', wordCount: 133 },
];

// 缓存管理
const CACHE_KEY_PREFIX = 'wordbank_cache_v2_';  // 更新版本号使旧缓存失效
const CACHE_EXPIRY = 7 * 24 * 60 * 60 * 1000; // 7天过期
const MIN_WORDBANK_SIZE = 20; // 最小有效词库大小，小于此值认为缓存无效

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
      console.log(`[WordBank] 缓存已过期: ${type}`);
      localStorage.removeItem(cacheKey);
      return null;
    }

    // 检查缓存数据是否有效（避免使用备用词库的缓存）
    if (!data.words || data.words.length < MIN_WORDBANK_SIZE) {
      console.log(`[WordBank] 缓存数据无效（单词数: ${data.words?.length || 0}），重新加载: ${type}`);
      localStorage.removeItem(cacheKey);
      return null;
    }

    return data.words;
  } catch (error) {
    console.warn(`[WordBank] 读取缓存失败: ${type}`, error);
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
 * 获取词库文件名
 */
function getWordBankFileName(type: WordBankType): string {
  return `${type}.json`;
}

/**
 * 加载本地词库
 */
async function loadLocalWordBank(type: WordBankType): Promise<Word[] | null> {
  try {
    const fileName = getWordBankFileName(type);
    const localUrl = `${LOCAL_WORDBANK_PATH}${fileName}`;
    console.log(`[WordBank] 加载本地词库: ${type} from ${localUrl}`);

    const response = await fetch(localUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (response.ok) {
      const data = await response.json();
      console.log(`[WordBank] 获取到原始数据，条目数:`, Array.isArray(data) ? data.length : (data.words?.length || '未知'));
      const words = normalizeWords(data.words || data);
      console.log(`[WordBank] 成功加载 ${words.length} 个单词`);
      return words;
    } else {
      console.warn(`[WordBank] 请求失败: ${response.status} ${response.statusText}`);
    }
    return null;
  } catch (error) {
    console.warn(`[WordBank] 本地词库加载失败: ${type}`, error);
    return null;
  }
}

/**
 * 从 affix-data.ts 加载词根词缀数据并转换为 Word 格式
 * 不依赖 JSON 文件，直接从 TS 数据源读取（单一数据源原则）
 */
function loadRootsFromAffixData(): Word[] {
  const allAffixes = [
    ...PREFIXES_DATA.map(a => ({ ...a, category: '前缀' })),
    ...SUFFIXES_DATA.map(a => ({ ...a, category: '后缀' })),
    ...ROOTS_DATA.map(a => ({ ...a, category: '词根' })),
  ];

  const now = new Date();
  return allAffixes.map((item, index) => {
    // 构建释义：类别 + 中文释义 + 英文描述
    const parts: string[] = [];
    parts.push(`[${item.category}] ${item.meaning}`);
    if (item.description) {
      parts.push(`(${item.description})`);
    }
    if (item.examples && item.examples.length > 0) {
      parts.push(`例: ${item.examples.slice(0, 4).join(', ')}`);
    }

    return {
      _id: `affix_${index}`,
      text: item.text,
      phonetic: '',
      explains: parts.join(' '),
      isReview: true,
      ctime: now,
      learnDate: now,
      level: 1 as Word['level'],
      explainedHidden: false,
      remember: false,
    };
  });
}

/**
 * 获取词库（仅使用本地词库）
 * @param type 词库类型
 * @param strategy 加载策略配置
 * @returns 单词列表
 */
export async function fetchWordBank(
  type: WordBankType,
  strategy: Partial<LoadStrategy> = {}
): Promise<Word[]> {
  const config = { ...DEFAULT_STRATEGY, ...strategy };
  console.log(`[WordBank] fetchWordBank 开始: type=${type}, strategy=`, config);

  // 先检查缓存
  if (config.useCache) {
    const cached = getFromCache(type);
    if (cached) {
      console.log(`[WordBank] 使用缓存: ${type}, 单词数: ${cached.length}`);
      return cached;
    }
  }

  // 词根词缀类型：直接从 TypeScript 数据源加载（不依赖 JSON 文件）
  if (type === 'roots') {
    const words = loadRootsFromAffixData();
    console.log(`[WordBank] 从 affix-data 加载词根词缀: ${words.length} 条`);
    if (config.useCache) {
      saveToCache(type, words);
    }
    return words;
  }

  // 仅加载本地词库
  const words = await loadLocalWordBank(type);

  if (words && words.length > 0) {
    // 保存到缓存
    if (config.useCache) {
      saveToCache(type, words);
    }
    console.log(`[WordBank] 返回本地词库: ${type}, 单词数: ${words.length}`);
    return words;
  }

  // 如果本地词库不存在，使用备用词库
  console.warn(`[WordBank] 本地词库不可用，使用备用词库: ${type}`);
  return getFallbackWords(type);
}

/**
 * 标准化单词数据格式
 */
function normalizeWords(data: any[]): Word[] {
  if (!Array.isArray(data)) {
    console.warn('[WordBank] 数据格式错误，期望数组但得到:', typeof data);
    return [];
  }

  console.log(`[WordBank] 开始标准化 ${data.length} 个单词数据`);

  const result = data.map((item, index) => ({
    _id: `wordbank_${Date.now()}_${index}`,
    text: item.word || item.text || '',
    phonetic: item.phonetic || item.phoneticSymbol || '',
    explains: Array.isArray(item.explains)
      ? item.explains.join('; ')
      : (item.translation || item.meaning || item.explains || ''),
    itemType: item.itemType || inferItemType(item.word || item.text || ''),
    isReview: true,  // 新导入的词默认为待复习状态
    ctime: new Date(),
    learnDate: new Date(),
    level: 1 as Word['level'],
    explainedHidden: false,
    remember: false,
  })).filter(w => {
    // 只要有文本内容就保留，不过滤特殊字符
    const hasText = w.text && w.text.trim().length > 0;
    if (!hasText) {
      console.warn('[WordBank] 过滤掉无文本的单词:', w);
    }
    return hasText;
  });

  console.log(`[WordBank] 标准化完成，有效单词数: ${result.length}`);
  return result;
}

/**
 * 获取备用词库（当本地词库获取失败时使用）
 * 包含各词库的核心高频词
 */
function getFallbackWords(type: WordBankType): Word[] {
  // 扩展备用词库，避免文件加载失败时只有10个单词
  const fallbackData: Record<string, Array<{word: string; phonetic?: string; explains: string}>> = {
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
      { word: 'accent', phonetic: '/ˈæksent/', explains: 'n. 口音；重音' },
      { word: 'accept', phonetic: '/əkˈsept/', explains: 'v. 接受；认可' },
      { word: 'access', phonetic: '/ˈækses/', explains: 'n. 进入；使用权' },
      { word: 'accident', phonetic: '/ˈæksɪdənt/', explains: 'n. 事故；意外' },
      { word: 'accompany', phonetic: '/əˈkʌmpəni/', explains: 'v. 陪伴；伴奏' },
      { word: 'accomplish', phonetic: '/əˈkʌmplɪʃ/', explains: 'v. 完成；实现' },
      { word: 'accord', phonetic: '/əˈkɔːrd/', explains: 'v. 一致；符合' },
      { word: 'account', phonetic: '/əˈkaʊnt/', explains: 'n. 账户；解释' },
      { word: 'accumulate', phonetic: '/əˈkjuːmjəleɪt/', explains: 'v. 积累；积聚' },
      { word: 'accurate', phonetic: '/ˈækjərət/', explains: 'adj. 精确的；准确的' },
      { word: 'accuse', phonetic: '/əˈkjuːz/', explains: 'v. 控告；指责' },
      { word: 'accustomed', phonetic: '/əˈkʌstəmd/', explains: 'adj. 习惯的；通常的' },
      { word: 'ache', phonetic: '/eɪk/', explains: 'v. 疼痛；渴望' },
      { word: 'achieve', phonetic: '/əˈtʃiːv/', explains: 'v. 达到；完成' },
      { word: 'achievement', phonetic: '/əˈtʃiːvmənt/', explains: 'n. 成就；完成' },
      { word: 'acid', phonetic: '/ˈæsɪd/', explains: 'n. 酸；酸性物质' },
      { word: 'acknowledge', phonetic: '/əkˈnɒlɪdʒ/', explains: 'v. 承认；致谢' },
      { word: 'acquaint', phonetic: '/əˈkweɪnt/', explains: 'v. 使熟悉；使了解' },
      { word: 'acquaintance', phonetic: '/əˈkweɪntəns/', explains: 'n. 熟人；了解' },
      { word: 'acquire', phonetic: '/əˈkwaɪər/', explains: 'v. 获得；学到' },
      { word: 'acquisition', phonetic: '/ˌækwɪˈzɪʃn/', explains: 'n. 获得；习得' },
      { word: 'acre', phonetic: '/ˈeɪkər/', explains: 'n. 英亩' },
      { word: 'across', phonetic: '/əˈkrɒs/', explains: 'prep. 横过；在...对面' },
      { word: 'act', phonetic: '/ækt/', explains: 'v. 行动；表演' },
      { word: 'action', phonetic: '/ˈækʃn/', explains: 'n. 行动；行为' },
      { word: 'active', phonetic: '/ˈæktɪv/', explains: 'adj. 积极的；活跃的' },
      { word: 'activity', phonetic: '/ækˈtɪvəti/', explains: 'n. 活动；活跃' },
      { word: 'actor', phonetic: '/ˈæktər/', explains: 'n. 演员' },
      { word: 'actress', phonetic: '/ˈæktrəs/', explains: 'n. 女演员' },
      { word: 'actual', phonetic: '/ˈæktʃuəl/', explains: 'adj. 实际的；真实的' },
      { word: 'actually', phonetic: '/ˈæktʃuəli/', explains: 'adv. 实际上；事实上' },
      { word: 'acute', phonetic: '/əˈkjuːt/', explains: 'adj. 敏锐的；急性的' },
      { word: 'adapt', phonetic: '/əˈdæpt/', explains: 'v. 使适应；改编' },
      { word: 'add', phonetic: '/æd/', explains: 'v. 添加；增加' },
      { word: 'addition', phonetic: '/əˈdɪʃn/', explains: 'n. 添加；加法' },
      { word: 'additional', phonetic: '/əˈdɪʃənl/', explains: 'adj. 额外的；附加的' },
      { word: 'address', phonetic: '/əˈdres/', explains: 'n. 地址；演讲' },
      { word: 'adequate', phonetic: '/ˈædɪkwət/', explains: 'adj. 足够的；适当的' },
      { word: 'adjust', phonetic: '/əˈdʒʌst/', explains: 'v. 调整；调节' },
      { word: 'administration', phonetic: '/ədˌmɪnɪˈstreɪʃn/', explains: 'n. 管理；行政' },
    ],
    cet6: [],
    zsb: [],
    kaogong: [],
    kaoyan: [],
    ielts: [],
    toefl: [],
    gre: [],
    gmat: [],
    bec: [],
    level4: [],
    level8: [],
    sat: [],
    roots: [],
    'phrasal-verbs': [
      { word: 'break down', explains: 'v. 分解；发生故障；崩溃' },
      { word: 'break up', explains: 'v. 分手；解散；打破' },
      { word: 'break out', explains: 'v. 爆发；逃脱' },
      { word: 'bring up', explains: 'v. 抚养；提出' },
      { word: 'call off', explains: 'v. 取消' },
      { word: 'carry out', explains: 'v. 执行；实施；完成' },
      { word: 'come across', explains: 'v. 偶然遇到' },
      { word: 'come up with', explains: 'v. 想出；提出' },
      { word: 'cut down', explains: 'v. 砍倒；削减' },
      { word: 'figure out', explains: 'v. 弄清楚；理解' },
      { word: 'fill in', explains: 'v. 填写；填充' },
      { word: 'get along', explains: 'v. 相处；进展' },
      { word: 'give up', explains: 'v. 放弃；停止' },
      { word: 'go on', explains: 'v. 继续；发生' },
      { word: 'look after', explains: 'v. 照顾；照看' },
      { word: 'look forward to', explains: 'v. 期待；盼望' },
      { word: 'make up', explains: 'v. 编造；组成；化妆' },
      { word: 'pick up', explains: 'v. 捡起；接人；学会' },
      { word: 'put off', explains: 'v. 推迟；使反感' },
      { word: 'put on', explains: 'v. 穿上；上演' },
      { word: 'run out of', explains: 'v. 用完；耗尽' },
      { word: 'set up', explains: 'v. 建立；设置' },
      { word: 'take off', explains: 'v. 起飞；脱下；请假' },
      { word: 'take over', explains: 'v. 接管；接手' },
      { word: 'turn on', explains: 'v. 打开；开启' },
      { word: 'turn off', explains: 'v. 关闭' },
      { word: 'turn up', explains: 'v. 出现；调大音量' },
      { word: 'work out', explains: 'v. 解决；锻炼' },
    ],
    collocations: [
      { word: 'according to', explains: '根据；按照' },
      { word: 'as a result', explains: '因此；结果' },
      { word: 'as long as', explains: '只要；长达' },
      { word: 'as soon as', explains: '一…就…' },
      { word: 'as well as', explains: '和…一样；也' },
      { word: 'because of', explains: '因为；由于' },
      { word: 'by the way', explains: '顺便说一下' },
      { word: 'due to', explains: '由于；因为' },
      { word: 'in addition', explains: '此外' },
      { word: 'in case', explains: '以防；万一' },
      { word: 'in fact', explains: '事实上' },
      { word: 'in front of', explains: '在…前面' },
      { word: 'in order to', explains: '为了' },
      { word: 'in spite of', explains: '尽管；虽然' },
      { word: 'in terms of', explains: '就…而言' },
      { word: 'instead of', explains: '代替；而不是' },
      { word: 'lead to', explains: '导致；通向' },
      { word: 'rather than', explains: '而不是' },
      { word: 'refer to', explains: '指的是；参考' },
      { word: 'regardless of', explains: '不管；不顾' },
      { word: 'result in', explains: '导致；造成' },
      { word: 'such as', explains: '例如；比如' },
      { word: 'thanks to', explains: '多亏；由于' },
      { word: 'account for', explains: '解释；占（比例）' },
      { word: 'apply for', explains: '申请' },
      { word: 'belong to', explains: '属于' },
      { word: 'contribute to', explains: '为…做贡献；导致' },
      { word: 'cope with', explains: '应对；处理' },
      { word: 'deal with', explains: '处理；应对' },
      { word: 'focus on', explains: '集中注意力于' },
    ],
    idioms: [
      { word: 'a piece of cake', explains: '小菜一碟；轻而易举' },
      { word: 'beat around the bush', explains: '拐弯抹角' },
      { word: 'bite the bullet', explains: '咬紧牙关面对困难' },
      { word: 'break a leg', explains: '祝你好运' },
      { word: 'break the ice', explains: '打破沉默；打破僵局' },
      { word: 'cost an arm and a leg', explains: '价格昂贵' },
      { word: 'face the music', explains: '面对现实；承担后果' },
      { word: 'feel under the weather', explains: '身体不舒服' },
      { word: 'hit the nail on the head', explains: '说到点子上' },
      { word: 'kill two birds with one stone', explains: '一举两得' },
      { word: 'let the cat out of the bag', explains: '泄密；露馅' },
      { word: 'once in a blue moon', explains: '千载难逢' },
      { word: 'rain cats and dogs', explains: '倾盆大雨' },
      { word: 'see eye to eye', explains: '看法一致' },
      { word: 'spill the beans', explains: '泄密；说漏嘴' },
      { word: 'take it easy', explains: '放轻松；别紧张' },
      { word: 'the early bird catches the worm', explains: '早起的鸟儿有虫吃' },
      { word: 'under the weather', explains: '身体不适' },
      { word: 'when pigs fly', explains: '绝无可能' },
      { word: 'you cannot judge a book by its cover', explains: '不要以貌取人' },
    ],
  };

  // 为其他词库复制基础数据
  const baseWords = fallbackData.cet4;
  Object.keys(fallbackData).forEach(key => {
    if (key !== 'cet4' && fallbackData[key].length === 0) {
      fallbackData[key] = [...baseWords];
    }
  });

  return normalizeWords(fallbackData[type] || baseWords);
}

/**
 * 清除词库缓存
 */
export function clearWordBankCache(type?: WordBankType): void {
  if (type) {
    localStorage.removeItem(CACHE_KEY_PREFIX + type);
    return;
  }
  // 清除所有词库缓存
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(CACHE_KEY_PREFIX)) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach(key => localStorage.removeItem(key));
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

/**
 * 获取词库（兼容旧版调用方式）
 * @deprecated 使用新的策略对象参数
 */
export async function fetchWordBankLegacy(
  type: WordBankType,
  useCache: boolean = true
): Promise<Word[]> {
  return fetchWordBank(type, { useCache });
}

export default {
  fetchWordBank,
  fetchWordBankLegacy,
  clearWordBankCache,
  getWordBankInfo,
  isWordBankCached,
  WORDBANK_LIST,
  DEFAULT_STRATEGY,
};
