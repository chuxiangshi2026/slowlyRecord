/**
 * 音素切分
 *
 * 把 phonetic 字符串(如 'ʃɪp' / '/ʃɪp/' / 'tʃeɪn')拆成 Phoneme 数组。
 *
 * 算法:贪心匹配最长 IPA 优先(因为多字符音素如 tʃ/dʒ/iː/eɪ 必须先于 t/d/i/e 匹配),
 * 遇到无法识别的字符(空格、重音符 ˈ、长音符 ː 落单、字母变体等)直接跳过。
 */
import {ALL_PHONEMES, type Phoneme} from './phoneme-data';

// 长度降序 + 同长度按字母序,保证贪心稳定
const PHONEMES_BY_PRIORITY: Phoneme[] = [...ALL_PHONEMES].sort((a, b) => {
    if (b.ipa.length !== a.ipa.length) return b.ipa.length - a.ipa.length;
    return a.ipa.localeCompare(b.ipa);
});

// IPA 中常见的"变体字符"映射到我们数据集里使用的标准字符
// 例如有道返回的音标可能用普通 g 而非 IPA 的 ɡ(latin small letter script g)
const NORMALIZE_MAP: Record<string, string> = {
    g: 'ɡ',
    ɡ: 'ɡ',
    'ː': 'ː',
    ':': 'ː', // 半角冒号当长音
    'ɑ': 'ɑ',
    'ɒ': 'ɒ',
};

function normalize(phonetic: string): string {
    // 去掉 / [ ] 包裹符、重音符 ˈ ˌ、空格、连字符
    const stripped = phonetic.replace(/[\/\[\]\sˈˌ\-‧·]/g, '');
    let out = '';
    for (const ch of stripped) {
        out += NORMALIZE_MAP[ch] ?? ch;
    }
    return out;
}

export interface BreakdownResult {
    /** 切分得到的音素序列 */
    phonemes: Phoneme[];
    /** 是否完整切分(中间有跳过的字符则为 false) */
    complete: boolean;
}

export function breakdownPhonetic(phonetic: string): BreakdownResult {
    const cleaned = normalize(phonetic);
    const phonemes: Phoneme[] = [];
    let i = 0;
    let skipped = 0;
    while (i < cleaned.length) {
        let matched: Phoneme | null = null;
        for (const ph of PHONEMES_BY_PRIORITY) {
            if (cleaned.startsWith(ph.ipa, i)) {
                matched = ph;
                break;
            }
        }
        if (matched) {
            phonemes.push(matched);
            i += matched.ipa.length;
        } else {
            skipped++;
            i++;
        }
    }
    return {phonemes, complete: skipped === 0};
}

// ============================================================================
// 拆解练习的预设单词表
//
// 用户词库里的 word.phonetic 格式不统一(可能缺失、可能有杂质),
// 这里维护一份固定可用的小词表,确保拆解练习总能正常出题。
// 单词均为常见基础词,音素数量 2-5 个,适合循序渐进。
// ============================================================================

export interface BreakdownWord {
    word: string;
    phonetic: string;
    /** 难度:1=2-3 音素 2=3-4 音素 3=4-5 音素 */
    difficulty: 1 | 2 | 3;
}

export const BREAKDOWN_WORDS: BreakdownWord[] = [
    // 难度 1:2-3 音素
    {word: 'see', phonetic: 'siː', difficulty: 1},
    {word: 'no', phonetic: 'nəʊ', difficulty: 1},
    {word: 'my', phonetic: 'maɪ', difficulty: 1},
    {word: 'go', phonetic: 'ɡəʊ', difficulty: 1},
    {word: 'be', phonetic: 'biː', difficulty: 1},
    {word: 'we', phonetic: 'wiː', difficulty: 1},
    {word: 'day', phonetic: 'deɪ', difficulty: 1},
    {word: 'cat', phonetic: 'kæt', difficulty: 1},
    {word: 'dog', phonetic: 'dɒɡ', difficulty: 1},
    {word: 'pen', phonetic: 'pen', difficulty: 1},
    {word: 'big', phonetic: 'bɪɡ', difficulty: 1},
    {word: 'hot', phonetic: 'hɒt', difficulty: 1},
    {word: 'red', phonetic: 'red', difficulty: 1},
    {word: 'sun', phonetic: 'sʌn', difficulty: 1},
    {word: 'cup', phonetic: 'kʌp', difficulty: 1},

    // 难度 2:3-4 音素
    {word: 'ship', phonetic: 'ʃɪp', difficulty: 2},
    {word: 'fish', phonetic: 'fɪʃ', difficulty: 2},
    {word: 'book', phonetic: 'bʊk', difficulty: 2},
    {word: 'food', phonetic: 'fuːd', difficulty: 2},
    {word: 'tree', phonetic: 'triː', difficulty: 2},
    {word: 'sing', phonetic: 'sɪŋ', difficulty: 2},
    {word: 'long', phonetic: 'lɒŋ', difficulty: 2},
    {word: 'good', phonetic: 'ɡʊd', difficulty: 2},
    {word: 'time', phonetic: 'taɪm', difficulty: 2},
    {word: 'home', phonetic: 'həʊm', difficulty: 2},
    {word: 'name', phonetic: 'neɪm', difficulty: 2},
    {word: 'cake', phonetic: 'keɪk', difficulty: 2},
    {word: 'chair', phonetic: 'tʃeə', difficulty: 2},
    {word: 'cheese', phonetic: 'tʃiːz', difficulty: 2},
    {word: 'jump', phonetic: 'dʒʌmp', difficulty: 2},
    {word: 'think', phonetic: 'θɪŋk', difficulty: 2},
    {word: 'this', phonetic: 'ðɪs', difficulty: 2},

    // 难度 3:4-5 音素
    {word: 'school', phonetic: 'skuːl', difficulty: 3},
    {word: 'spring', phonetic: 'sprɪŋ', difficulty: 3},
    {word: 'three', phonetic: 'θriː', difficulty: 3},
    {word: 'bridge', phonetic: 'brɪdʒ', difficulty: 3},
    {word: 'train', phonetic: 'treɪn', difficulty: 3},
    {word: 'dream', phonetic: 'driːm', difficulty: 3},
    {word: 'strong', phonetic: 'strɒŋ', difficulty: 3},
];
