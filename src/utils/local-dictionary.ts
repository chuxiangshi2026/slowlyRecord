/**
 * 本地词典工具 - 轻量级离线翻译
 * 包含约 3000 个常用英语单词及释义
 * 支持外部词典扩展（uTools DB）
 * 支持延迟加载（适合 50000+ 词的大词典）
 */

import {loadDictionaryFromDB, queryWordFromDB, hasDictionaryInDB} from './dictionary-db';

export interface DictionaryEntry {
  word: string;
  phonetic?: string;
  explains: string[];
}

// 支持两种格式的词典数据
// 格式1: 完整对象 { word: "xxx", phonetic: "xxx", explains: ["xxx"] }
// 格式2: 精简数组 ["音标", "释义1", "释义2", ...]

// 延迟加载缓存
let dictionaryCache: Record<string, DictionaryEntry> | null = null;
let phrasesCache: Record<string, string> | null = null;
let dictionaryLoading: Promise<Record<string, DictionaryEntry>> | null = null;
let phrasesLoading: Promise<Record<string, string>> | null = null;

/**
 * 延迟加载词典数据（只在需要时加载）
 * 支持 50000+ 词的大词典，避免启动时阻塞
 */
async function loadDictionaryLazy(): Promise<Record<string, DictionaryEntry>> {
  if (dictionaryCache) {
    return dictionaryCache;
  }
  if (dictionaryLoading) {
    return dictionaryLoading;
  }
  // 从 words 目录加载所有字母分片文件
  dictionaryLoading = Promise.all(
    'abcdefghijklmnopqrstuvwxyz'.split('').map(char =>
      import(`../../words/${char}.json`).catch(() => ({}))
    )
  )
    .then(modules => {
      // 合并所有分片文件的数据
      const rawData = modules.reduce((acc, mod) => ({
        ...acc, ...(mod.default || mod)
      }), {});
      // 转换精简格式为完整格式
      dictionaryCache = convertDictionaryFormat(rawData);
      console.log('[词典] 加载完成，词条数:', Object.keys(dictionaryCache!).length);
      return dictionaryCache!;
    })
    .catch(err => {
      console.error('[词典] 加载失败:', err);
      dictionaryLoading = null;
      return {};
    });
  return dictionaryLoading;
}

/**
 * 转换词典格式
 * 支持从精简数组格式 [音标, 释义1, 释义2] 转换为完整对象格式
 */
function convertDictionaryFormat(rawData: Record<string, any>): Record<string, DictionaryEntry> {
  const result: Record<string, DictionaryEntry> = {};

  for (const [key, value] of Object.entries(rawData)) {
    const word = key.toLowerCase().trim();

    if (Array.isArray(value)) {
      // 精简格式: [音标, 释义1, 释义2, ...]
      const [phonetic, ...explains] = value;
      result[word] = {
        word,
        phonetic: phonetic || '',
        explains: explains.filter(e => e && typeof e === 'string')
      };
    } else if (typeof value === 'object' && value !== null) {
      // 完整对象格式
      result[word] = {
        word: value.word || word,
        phonetic: value.phonetic || '',
        explains: Array.isArray(value.explains) ? value.explains : [String(value.explains || '')]
      };
    }
  }

  return result;
}

/**
 * 延迟加载短语数据
 */
async function loadPhrasesLazy(): Promise<Record<string, string>> {
  if (phrasesCache) {
    return phrasesCache;
  }
  if (phrasesLoading) {
    return phrasesLoading;
  }
  phrasesLoading = import('./phrases-data.json')
    .then(module => {
      phrasesCache = module.default || module;
      return phrasesCache!;
    })
    .catch(err => {
      console.error('[短语] 加载失败:', err);
      phrasesLoading = null;
      return {};
    });
  return phrasesLoading;
}

/**
 * 获取已加载的词典（同步，仅内部使用）
 * 如果未加载，返回空对象
 */
function getDictionarySync(): Record<string, DictionaryEntry> {
  return dictionaryCache || {};
}

/**
 * 从本地词典查询单词（异步版本，支持延迟加载）
 * @param word 要查询的单词
 * @returns 查询结果，未找到返回 null
 */
export async function queryLocalDictionaryAsync(word: string): Promise<DictionaryEntry | null> {
  const dictionary = await loadDictionaryLazy();
  return queryDictionaryWithData(word, dictionary);
}

/**
 * 从本地词典查询单词（同步版本，首次调用可能返回空）
 * @param word 要查询的单词
 * @returns 查询结果，未找到返回 null
 */
export function queryLocalDictionary(word: string): DictionaryEntry | null {
  const dictionary = getDictionarySync();

  // 如果词典未加载，触发后台加载（下次查询可用）
  if (!dictionaryCache && !dictionaryLoading) {
    loadDictionaryLazy();
  }

  return queryDictionaryWithData(word, dictionary);
}

/**
 * 使用指定词典数据查询单词
 * @param word 要查询的单词
 * @param dictionary 词典数据
 */
function queryDictionaryWithData(
  word: string,
  dictionary: Record<string, DictionaryEntry>
): DictionaryEntry | null {
  // 标准化输入：转小写，去除首尾空格
  const normalizedWord = word.toLowerCase().trim();

  // 调试日志
  console.log('[本地词典] 查询:', normalizedWord, '词典大小:', Object.keys(dictionary).length);

  // 直接查询
  const entry = dictionary[normalizedWord];
  if (entry) {
    return entry;
  }

  // 尝试去除复数形式 (-s, -es)
  if (normalizedWord.endsWith('es')) {
    const singular = normalizedWord.slice(0, -2);
    if (dictionary[singular]) {
      return dictionary[singular];
    }
  }
  if (normalizedWord.endsWith('s')) {
    const singular = normalizedWord.slice(0, -1);
    if (dictionary[singular]) {
      return dictionary[singular];
    }
  }

  // 尝试去除过去式/过去分词 (-ed)
  if (normalizedWord.endsWith('ed')) {
    const base = normalizedWord.slice(0, -2);
    if (dictionary[base]) {
      return dictionary[base];
    }
    // 尝试双写辅音字母的情况 (stopped -> stop)
    const base2 = normalizedWord.slice(0, -1);
    if (dictionary[base2]) {
      return dictionary[base2];
    }
  }

  // 尝试去除进行时 (-ing)
  if (normalizedWord.endsWith('ing')) {
    const base = normalizedWord.slice(0, -3);
    if (dictionary[base]) {
      return dictionary[base];
    }
    // 尝试去e的情况 (making -> make)
    const base2 = base + 'e';
    if (dictionary[base2]) {
      return dictionary[base2];
    }
  }

  // 内置词库未找到，尝试从外部词典（uTools DB）查询
  if (hasDictionaryInDB()) {
    const externalEntry = queryWordFromDB(normalizedWord);
    if (externalEntry) {
      return externalEntry;
    }

    // 同样尝试词形还原
    if (normalizedWord.endsWith('es')) {
      const singular = normalizedWord.slice(0, -2);
      const extEntry = queryWordFromDB(singular);
      if (extEntry) return extEntry;
    }
    if (normalizedWord.endsWith('s')) {
      const singular = normalizedWord.slice(0, -1);
      const extEntry = queryWordFromDB(singular);
      if (extEntry) return extEntry;
    }
    if (normalizedWord.endsWith('ed')) {
      const base = normalizedWord.slice(0, -2);
      const extEntry = queryWordFromDB(base);
      if (extEntry) return extEntry;
    }
    if (normalizedWord.endsWith('ing')) {
      const base = normalizedWord.slice(0, -3);
      const extEntry = queryWordFromDB(base);
      if (extEntry) return extEntry;
      const base2 = base + 'e';
      const extEntry2 = queryWordFromDB(base2);
      if (extEntry2) return extEntry2;
    }
  }

  return null;
}

/**
 * 检查本地词典是否包含某个单词
 * @param word 要检查的单词
 */
export function hasLocalWord(word: string): boolean {
  return queryLocalDictionary(word) !== null;
}

/**
 * 获取本地词典统计信息（包括外部词典）
 * @param useCache 是否使用已缓存的词典数据（默认 true）
 */
export async function getDictionaryStats(useCache = true): Promise<{
  total: number;
  localTotal: number;
  externalTotal: number;
  hasExternal: boolean;
  letterCounts: Record<string, number>
}> {
  // 确保词典已加载
  const dictionary = useCache ? getDictionarySync() : await loadDictionaryLazy();
  const words = Object.keys(dictionary);
  const letterCounts: Record<string, number> = {};

  words.forEach(word => {
    const firstLetter = word[0]?.toLowerCase() || 'unknown';
    letterCounts[firstLetter] = (letterCounts[firstLetter] || 0) + 1;
  });

  // 统计外部词典
  let externalTotal = 0;
  const hasExternal = hasDictionaryInDB();
  if (hasExternal) {
    const externalDict = loadDictionaryFromDB();
    if (externalDict) {
      externalTotal = Object.keys(externalDict).length;
      // 合并统计
      Object.keys(externalDict).forEach(word => {
        const firstLetter = word[0]?.toLowerCase() || 'unknown';
        letterCounts[firstLetter] = (letterCounts[firstLetter] || 0) + 1;
      });
    }
  }

  return {
    total: words.length + externalTotal,
    localTotal: words.length,
    externalTotal,
    hasExternal,
    letterCounts
  };
}

/**
 * 本地翻译结果接口
 */
export interface LocalTranslationResult {
  success: boolean;
  explains?: string;
  phonetic?: string;
  pronunciation?: string; // 发音URL
  errorMsg?: string;
  isLocal: true; // 标记这是本地翻译结果
}

// 发音URL缓存（与translation-api.ts独立，避免循环依赖）
const pronunciationCache = new Map<string, string>();

/**
 * 获取单词发音URL（本地词典版本）
 * 使用有道TTS（稳定可靠）
 */
function getPronunciationUrlForLocal(word: string): string {
  const cacheKey = word.toLowerCase().trim();

  // 检查缓存
  if (pronunciationCache.has(cacheKey)) {
    return pronunciationCache.get(cacheKey)!;
  }

  // 使用有道TTS URL（稳定，CORS友好）
  const youdaoTtsUrl = `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(word)}&type=1`;
  pronunciationCache.set(cacheKey, youdaoTtsUrl);
  return youdaoTtsUrl;
}

/**
 * 获取已加载的短语（同步，仅内部使用）
 */
function getPhrasesSync(): Record<string, string> {
  return phrasesCache || {};
}

/**
 * 查找短语翻译（异步版本）
 */
async function findPhraseAsync(text: string): Promise<string | undefined> {
  const phrases = await loadPhrasesLazy();
  return phrases[text];
}

/**
 * 查找短语翻译（同步版本）
 */
function findPhraseSync(text: string): string | undefined {
  const phrases = getPhrasesSync();
  // 如果未加载，触发后台加载
  if (!phrasesCache && !phrasesLoading) {
    loadPhrasesLazy();
  }
  return phrases[text];
}

/**
 * 生成 n-grams（多词组合）
 * 例如：["i", "want", "to", "go"] 生成 ["i want to go", "want to go", "i want to", "to go", "want to", ...]
 */
function generateNGrams(words: string[], maxN: number = 4): Array<{ phrase: string; start: number; end: number }> {
  const ngrams: Array<{ phrase: string; start: number; end: number }> = [];

  for (let n = maxN; n >= 2; n--) {
    for (let i = 0; i <= words.length - n; i++) {
      ngrams.push({
        phrase: words.slice(i, i + n).join(' '),
        start: i,
        end: i + n - 1
      });
    }
  }

  return ngrams;
}

/**
 * 匹配短语（包括 n-gram 匹配）
 * @returns 匹配到的短语及位置信息
 */
function findPhrasesInSentence(
  words: string[],
  phrases: Record<string, string>
): Array<{ phrase: string; translation: string; start: number; end: number }> {
  const matches: Array<{ phrase: string; translation: string; start: number; end: number }> = [];
  const usedIndices = new Set<number>();

  // 1. 先尝试完整句子匹配
  const fullSentence = words.join(' ');
  if (phrases[fullSentence]) {
    return [{ phrase: fullSentence, translation: phrases[fullSentence], start: 0, end: words.length - 1 }];
  }

  // 2. N-gram 匹配（优先匹配更长的短语）
  const ngrams = generateNGrams(words, 5);

  for (const ngram of ngrams) {
    // 检查这些位置是否已被使用
    const indices = Array.from({ length: ngram.end - ngram.start + 1 }, (_, i) => ngram.start + i);
    const isOverlapping = indices.some(i => usedIndices.has(i));

    if (!isOverlapping && phrases[ngram.phrase]) {
      matches.push({
        phrase: ngram.phrase,
        translation: phrases[ngram.phrase],
        start: ngram.start,
        end: ngram.end
      });
      indices.forEach(i => usedIndices.add(i));
    }
  }

  // 按位置排序
  return matches.sort((a, b) => a.start - b.start);
}

/**
 * 常见句型模式及其处理
 */
const SENTENCE_PATTERNS = [
  // 疑问句
  {
    pattern: /^(are|is|am|was|were|do|does|did|have|has|had|can|could|will|would|shall|should|may|might)\s+(.+)$/i,
    type: 'yes_no_question',
    transform: (match: RegExpMatchArray, translations: string[]) => {
      // 一般疑问句：助动词 + 主语 + ...
      return '是否' + translations.join('');
    }
  },
  // What/Where/When/Why/How 疑问句
  {
    pattern: /^(what|where|when|why|how|who|whom|whose|which)\s+(.+)$/i,
    type: 'wh_question',
    transform: (match: RegExpMatchArray, translations: string[]) => {
      const whMap: Record<string, string> = {
        'what': '什么', 'where': '哪里', 'when': '何时',
        'why': '为什么', 'how': '如何', 'who': '谁',
        'whom': '谁', 'whose': '谁的', 'which': '哪个'
      };
      const whWord = whMap[match[1].toLowerCase()] || match[1];
      return whWord + translations.slice(1).join('');
    }
  },
  // There be 句型
  {
    pattern: /^there\s+(is|are|was|were)\s+(.+)$/i,
    type: 'there_be',
    transform: (match: RegExpMatchArray, translations: string[]) => {
      // There be -> "有" 或 "存在"
      return '有' + translations.slice(2).join('');
    }
  },
  // I want/need/like to ...
  {
    pattern: /^(i|you|he|she|it|we|they)\s+(want|need|like|love|hate|prefer)\s+to\s+(.+)$/i,
    type: 'want_to',
    transform: (match: RegExpMatchArray, translations: string[]) => {
      const subject = translations[0] || match[1];
      const verb = translations[1] || match[2];
      const rest = translations.slice(3).join('');
      return `${subject}${verb}${rest}`;
    }
  },
  // 进行时态
  {
    pattern: /^(i|you|he|she|it|we|they)\s+(am|is|are|was|were)\s+(\w+ing)\s*(.+)?$/i,
    type: 'continuous',
    transform: (match: RegExpMatchArray, translations: string[]) => {
      const subject = translations[0] || match[1];
      const action = translations[2] || match[3];
      const rest = translations.slice(3).join('') || '';
      return `${subject}正在${action}${rest}`;
    }
  },
  // 完成时态
  {
    pattern: /^(i|you|he|she|it|we|they)\s+(have|has|had)\s+(\w+ed|\w+en)\s*(.+)?$/i,
    type: 'perfect',
    transform: (match: RegExpMatchArray, translations: string[]) => {
      const subject = translations[0] || match[1];
      const action = translations[2] || match[3];
      const rest = translations.slice(3).join('') || '';
      return `${subject}已经${action}${rest}`;
    }
  }
];

/**
 * 检测并应用句型规则
 */
function applySentencePattern(sentence: string, words: string[], translations: string[]): string | null {
  const lowerSentence = sentence.toLowerCase();

  for (const rule of SENTENCE_PATTERNS) {
    const match = lowerSentence.match(rule.pattern);
    if (match) {
      try {
        return rule.transform(match, translations);
      } catch (e) {
        // 规则应用失败，继续尝试其他规则
        continue;
      }
    }
  }

  return null;
}

/**
 * 简单的词序调整：英语 SVO -> 中文也近似 SVO，但需要做微调
 */
function adjustWordOrder(words: string[], translations: string[]): string[] {
  // 如果只有一个词，直接返回
  if (words.length <= 1) return translations;

  // 时间词前置处理 (yesterday, today, tomorrow, now 等)
  const timeWords = ['yesterday', 'today', 'tomorrow', 'now', 'later', 'soon', 'recently', 'already'];
  const timeIndices = words.map((w, i) => timeWords.includes(w.toLowerCase()) ? i : -1).filter(i => i !== -1);

  if (timeIndices.length > 0) {
    // 将时间词移到最前面
    const timeTranslations = timeIndices.map(i => translations[i]);
    const otherTranslations = translations.filter((_, i) => !timeIndices.includes(i));
    return [...timeTranslations, ...otherTranslations];
  }

  return translations;
}

/**
 * 增强版句子翻译（带短语识别和句型处理）
 */
async function translateSentenceEnhanced(
  sentence: string,
  dictionary: Record<string, DictionaryEntry>,
  phrases: Record<string, string>
): Promise<LocalTranslationResult> {
  // 清理句子（保留更多连接词）
  const cleanedSentence = sentence
    .toLowerCase()
    .replace(/[.,!?;:]/g, ' ')  // 只替换句末标点
    .replace(/\s+/g, ' ')
    .trim();

  const words = cleanedSentence.split(/\s+/).filter(w => w.length > 0);

  if (words.length === 0) {
    return {
      success: false,
      errorMsg: '无法识别的文本',
      isLocal: true
    };
  }

  // 1. 首先尝试完整句子在短语库中的匹配
  const phraseMatches = findPhrasesInSentence(words, phrases);

  if (phraseMatches.length === 1 && phraseMatches[0].start === 0 && phraseMatches[0].end === words.length - 1) {
    // 完整匹配到一个短语/句子
    return {
      success: true,
      explains: phraseMatches[0].translation,
      isLocal: true
    };
  }

  // 2. 混合翻译：短语 + 逐词
  const finalTranslations: string[] = [];
  let currentIndex = 0;

  while (currentIndex < words.length) {
    // 检查当前位置是否有短语匹配
    const match = phraseMatches.find(m => m.start === currentIndex);

    if (match) {
      // 使用短语翻译
      finalTranslations.push(match.translation);
      currentIndex = match.end + 1;
    } else {
      // 逐词翻译
      const word = words[currentIndex];
      const entry = queryDictionaryWithData(word, dictionary);

      if (entry && entry.explains.length > 0) {
        const meaning = entry.explains[0].replace(/^(n\.|v\.|adj\.|adv\.|prep\.|conj\.|pron\.|art\.|num\.|int\.)\s*/, '');
        finalTranslations.push(meaning);
      } else {
        // 词形还原
        const baseForm = tryGetBaseForm(word);
        const baseEntry = baseForm ? queryDictionaryWithData(baseForm, dictionary) : null;
        if (baseEntry && baseEntry.explains.length > 0) {
          const meaning = baseEntry.explains[0].replace(/^(n\.|v\.|adj\.|adv\.|prep\.|conj\.|pron\.|art\.|num\.|int\.)\s*/, '');
          finalTranslations.push(meaning);
        } else {
          finalTranslations.push(word);
        }
      }
      currentIndex++;
    }
  }

  // 3. 尝试应用句型规则
  const patternResult = applySentencePattern(cleanedSentence, words, finalTranslations);

  if (patternResult) {
    return {
      success: true,
      explains: patternResult,
      isLocal: true
    };
  }

  // 4. 词序调整
  const adjustedTranslations = adjustWordOrder(words, finalTranslations);

  // 5. 智能连接（根据词性调整连接符）
  const translatedText = smartJoin(adjustedTranslations);

  return {
    success: true,
    explains: translatedText,
    isLocal: true
  };
}

/**
 * 智能连接翻译结果
 * 根据上下文选择合适的连接方式
 */
function smartJoin(translations: string[]): string {
  if (translations.length === 0) return '';
  if (translations.length === 1) return translations[0];

  // 检查是否是完整的意群（如已包含完整语义）
  const fullSentence = translations.join('');

  // 如果结果本身通顺（不含大量分号），直接返回
  if (!fullSentence.includes('；') && translations.length <= 5) {
    return fullSentence;
  }

  // 否则使用逗号连接更自然
  return translations.join('，');
}

/**
 * 逐词翻译句子（异步版本）- 保留作为后备方案
 * @param sentence 要翻译的句子
 * @param dictionary 词典数据
 * @returns 翻译结果
 */
async function translateSentenceByWordsAsync(
  sentence: string,
  dictionary: Record<string, DictionaryEntry>
): Promise<LocalTranslationResult> {
  // 清理并分割句子
  const words = sentence
    .toLowerCase()
    .replace(/[.,!?;:"'()]/g, ' ')  // 替换标点为空格
    .split(/\s+/)                    // 按空格分割
    .filter(w => w.length > 0);      // 过滤空字符串

  if (words.length === 0) {
    return {
      success: false,
      errorMsg: '无法识别的文本',
      isLocal: true
    };
  }

  // 逐个单词翻译
  const translations: string[] = [];

  for (const word of words) {
    const entry = queryDictionaryWithData(word, dictionary);
    if (entry && entry.explains.length > 0) {
      // 取第一个释义，去掉词性标记
      const meaning = entry.explains[0].replace(/^(n\.|v\.|adj\.|adv\.|prep\.|conj\.|pron\.|art\.|num\.|int\.)\s*/, '');
      translations.push(meaning);
    } else {
      // 尝试简单的词形还原（去掉常见的后缀）
      const baseForm = tryGetBaseForm(word);
      const baseEntry = baseForm ? queryDictionaryWithData(baseForm, dictionary) : null;
      if (baseEntry && baseEntry.explains.length > 0) {
        const meaning = baseEntry.explains[0].replace(/^(n\.|v\.|adj\.|adv\.|prep\.|conj\.|pron\.|art\.|num\.|int\.)\s*/, '');
        translations.push(meaning);
      } else {
        // 词库中没有，显示原单词
        translations.push(word);
      }
    }
  }

  // 拼接翻译结果
  const translatedText = translations.join('；');

  return {
    success: true,
    explains: translatedText,
    isLocal: true
  };
}

/**
 * 同步版增强句子翻译
 */
function translateSentenceEnhancedSync(
  sentence: string,
  dictionary: Record<string, DictionaryEntry>,
  phrases: Record<string, string>
): LocalTranslationResult {
  const cleanedSentence = sentence
    .toLowerCase()
    .replace(/[.,!?;:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const words = cleanedSentence.split(/\s+/).filter(w => w.length > 0);

  if (words.length === 0) {
    return {
      success: false,
      errorMsg: '无法识别的文本',
      isLocal: true
    };
  }

  // 1. N-gram 短语匹配
  const phraseMatches = findPhrasesInSentence(words, phrases);

  if (phraseMatches.length === 1 && phraseMatches[0].start === 0 && phraseMatches[0].end === words.length - 1) {
    return {
      success: true,
      explains: phraseMatches[0].translation,
      isLocal: true
    };
  }

  // 2. 混合翻译
  const finalTranslations: string[] = [];
  let currentIndex = 0;

  while (currentIndex < words.length) {
    const match = phraseMatches.find(m => m.start === currentIndex);

    if (match) {
      finalTranslations.push(match.translation);
      currentIndex = match.end + 1;
    } else {
      const word = words[currentIndex];
      const entry = queryDictionaryWithData(word, dictionary);

      if (entry && entry.explains.length > 0) {
        const meaning = entry.explains[0].replace(/^(n\.|v\.|adj\.|adv\.|prep\.|conj\.|pron\.|art\.|num\.|int\.)\s*/, '');
        finalTranslations.push(meaning);
      } else {
        const baseForm = tryGetBaseForm(word);
        const baseEntry = baseForm ? queryDictionaryWithData(baseForm, dictionary) : null;
        if (baseEntry && baseEntry.explains.length > 0) {
          const meaning = baseEntry.explains[0].replace(/^(n\.|v\.|adj\.|adv\.|prep\.|conj\.|pron\.|art\.|num\.|int\.)\s*/, '');
          finalTranslations.push(meaning);
        } else {
          finalTranslations.push(word);
        }
      }
      currentIndex++;
    }
  }

  // 3. 尝试句型规则
  const patternResult = applySentencePattern(cleanedSentence, words, finalTranslations);
  if (patternResult) {
    return {
      success: true,
      explains: patternResult,
      isLocal: true
    };
  }

  // 4. 词序调整和智能连接
  const adjustedTranslations = adjustWordOrder(words, finalTranslations);
  const translatedText = smartJoin(adjustedTranslations);

  return {
    success: true,
    explains: translatedText,
    isLocal: true
  };
}

/**
 * 逐词翻译句子（同步版本）- 保留作为后备
 * @param sentence 要翻译的句子
 * @returns 翻译结果
 */
function translateSentenceByWords(sentence: string): LocalTranslationResult {
  return translateSentenceByWordsSync(sentence, getDictionarySync());
}

/**
 * 逐词翻译句子（同步实现）- 保留作为后备
 */
function translateSentenceByWordsSync(
  sentence: string,
  dictionary: Record<string, DictionaryEntry>
): LocalTranslationResult {
  // 清理并分割句子
  const words = sentence
    .toLowerCase()
    .replace(/[.,!?;:"'()]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 0);

  if (words.length === 0) {
    return {
      success: false,
      errorMsg: '无法识别的文本',
      isLocal: true
    };
  }

  const translations: string[] = [];

  for (const word of words) {
    const entry = queryDictionaryWithData(word, dictionary);
    if (entry && entry.explains.length > 0) {
      const meaning = entry.explains[0].replace(/^(n\.|v\.|adj\.|adv\.|prep\.|conj\.|pron\.|art\.|num\.|int\.)\s*/, '');
      translations.push(meaning);
    } else {
      const baseForm = tryGetBaseForm(word);
      const baseEntry = baseForm ? queryDictionaryWithData(baseForm, dictionary) : null;
      if (baseEntry && baseEntry.explains.length > 0) {
        const meaning = baseEntry.explains[0].replace(/^(n\.|v\.|adj\.|adv\.|prep\.|conj\.|pron\.|art\.|num\.|int\.)\s*/, '');
        translations.push(meaning);
      } else {
        translations.push(word);
      }
    }
  }

  const translatedText = translations.join('；');

  return {
    success: true,
    explains: translatedText,
    isLocal: true
  };
}

/**
 * 尝试获取单词的基本形式（简单词形还原）
 */
function tryGetBaseForm(word: string): string | null {
  // 简单的复数/时态还原规则
  if (word.endsWith('ies') && word.length > 4) {
    return word.slice(0, -3) + 'y';  // families -> family
  }
  if (word.endsWith('es') && word.length > 3) {
    return word.slice(0, -2);  // boxes -> box
  }
  if (word.endsWith('s') && word.length > 3 && !word.endsWith('ss')) {
    return word.slice(0, -1);  // books -> book
  }
  if (word.endsWith('ing') && word.length > 5) {
    const base = word.slice(0, -3);
    return base;  // running -> run
  }
  if (word.endsWith('ed') && word.length > 4) {
    return word.slice(0, -2);  // walked -> walk
  }
  return null;
}

/**
 * 使用本地词典翻译（异步版本，推荐用于大词典）
 * @param text 要翻译的文本
 * @returns 翻译结果
 */
export async function translateWithLocalDictionaryAsync(text: string): Promise<LocalTranslationResult> {
  const trimmedText = text.trim().toLowerCase();

  // 空文本检查
  if (!trimmedText) {
    return {
      success: false,
      errorMsg: '请输入要翻译的文本',
      isLocal: true
    };
  }

  // 确保词典和短语都已加载
  const [dictionary, phrases] = await Promise.all([
    loadDictionaryLazy(),
    loadPhrasesLazy()
  ]);

  // 1. 首先检查是否是常用短语/句子（直接映射）
  const phraseTranslation = phrases[trimmedText];
  if (phraseTranslation) {
    // 如果是单个单词的短语，添加发音
    const pronunciation = !trimmedText.includes(' ') ? getPronunciationUrlForLocal(trimmedText) : undefined;
    return {
      success: true,
      explains: phraseTranslation,
      pronunciation,
      isLocal: true
    };
  }

  // 2. 如果是单个单词，直接查词典
  if (!trimmedText.includes(' ')) {
    const entry = queryDictionaryWithData(trimmedText, dictionary);
    if (entry) {
      return {
        success: true,
        explains: entry.explains.join('；'),
        phonetic: entry.phonetic,
        pronunciation: getPronunciationUrlForLocal(trimmedText),
        isLocal: true
      };
    }

    // 尝试词形还原
    const baseForm = tryGetBaseForm(trimmedText);
    if (baseForm) {
      const baseEntry = queryDictionaryWithData(baseForm, dictionary);
      if (baseEntry) {
        return {
          success: true,
          explains: baseEntry.explains.join('；'),
          phonetic: baseEntry.phonetic,
          pronunciation: getPronunciationUrlForLocal(trimmedText),
          isLocal: true
        };
      }
    }

    return {
      success: false,
      errorMsg: `词库暂未收录 "${trimmedText}"，建议切换至网络翻译`,
      isLocal: true
    };
  }

  // 3. 句子/短语：使用增强版翻译（带短语识别和句型处理）
  return translateSentenceEnhanced(trimmedText, dictionary, phrases);
}

/**
 * 使用本地词典翻译（同步版本，首次调用可能返回未找到）
 * @param text 要翻译的文本
 * @returns 翻译结果
 */
export function translateWithLocalDictionary(text: string): LocalTranslationResult {
  const trimmedText = text.trim().toLowerCase();

  // 空文本检查
  if (!trimmedText) {
    return {
      success: false,
      errorMsg: '请输入要翻译的文本',
      isLocal: true
    };
  }

  const dictionary = getDictionarySync();
  const phrases = getPhrasesSync();

  // 如果数据未加载，触发后台加载
  if (!dictionaryCache && !dictionaryLoading) {
    loadDictionaryLazy();
  }
  if (!phrasesCache && !phrasesLoading) {
    loadPhrasesLazy();
  }

  // 1. 首先检查是否是常用短语/句子（直接映射）
  const phraseTranslation = phrases[trimmedText];
  if (phraseTranslation) {
    // 如果是单个单词的短语，添加发音
    const pronunciation = !trimmedText.includes(' ') ? getPronunciationUrlForLocal(trimmedText) : undefined;
    return {
      success: true,
      explains: phraseTranslation,
      pronunciation,
      isLocal: true
    };
  }

  // 2. 如果是单个单词，直接查词典
  if (!trimmedText.includes(' ')) {
    const entry = queryDictionaryWithData(trimmedText, dictionary);
    if (entry) {
      return {
        success: true,
        explains: entry.explains.join('；'),
        phonetic: entry.phonetic,
        pronunciation: getPronunciationUrlForLocal(trimmedText),
        isLocal: true
      };
    }

    // 尝试词形还原
    const baseForm = tryGetBaseForm(trimmedText);
    if (baseForm) {
      const baseEntry = queryDictionaryWithData(baseForm, dictionary);
      if (baseEntry) {
        return {
          success: true,
          explains: baseEntry.explains.join('；'),
          phonetic: baseEntry.phonetic,
          pronunciation: getPronunciationUrlForLocal(trimmedText),
          isLocal: true
        };
      }
    }

    return {
      success: false,
      errorMsg: `词库暂未收录 "${trimmedText}"，建议切换至网络翻译`,
      isLocal: true
    };
  }

  // 3. 句子/短语：使用增强版翻译（带短语识别和句型处理）
  return translateSentenceEnhancedSync(trimmedText, dictionary, phrases);
}

export default {
  queryLocalDictionary,
  queryLocalDictionaryAsync,
  hasLocalWord,
  getDictionaryStats,
  translateWithLocalDictionary,
  translateWithLocalDictionaryAsync,
  // 延迟加载相关
  loadDictionaryLazy,
  loadPhrasesLazy
};

// 外部词典相关函数导出（从 dictionary-db.ts 重新导出）
export {
  saveDictionaryToDB,
  loadDictionaryFromDB,
  hasDictionaryInDB,
  getDictionaryVersion,
  removeDictionaryFromDB,
  queryWordFromDB,
  importDictionaryFromJSON,
  importDictionaryFromFile,
  getExternalDictionaryCount
} from './dictionary-db';
