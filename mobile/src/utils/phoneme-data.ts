/**
 * 英语国际音标(IPA) 48 音素数据集
 * 按教学约定的标准分类(元音 20 + 辅音 28)
 *
 * 分组依据:
 *   - 元音:短元音 / 长元音 / 双元音
 *   - 辅音:爆破音 / 摩擦音 / 破擦音 / 鼻音 / 边音 / 半元音 (清浊用 voiced 字段区分)
 *
 * 例词原则:常见单词、3-5 字母为主、便于初学者识别
 */

export type PhonemeType = 'vowel' | 'consonant';
export type VowelGroup = 'short' | 'long' | 'diphthong';
export type ConsonantGroup = 'plosive' | 'fricative' | 'affricate' | 'nasal' | 'lateral' | 'semivowel';

export interface Phoneme {
    /** IPA 符号(无斜杠) */
    ipa: string;
    /** 元音 / 辅音 */
    type: PhonemeType;
    /** 子分组 */
    group: VowelGroup | ConsonantGroup;
    /** 中文分组名,用于展示 */
    groupLabel: string;
    /** 辅音清浊:辅音用 true=浊 / false=清;元音留空 */
    voiced?: boolean;
    /** 例词(3-4 个,首词作为发音示范) */
    examples: string[];
    /**
     * 音素本身的发音代理串(phonics 教学法常用写法)。
     * TTS 不能直接读 IPA 字符,这里用最接近原音的英文拼写让 Edge/Web Speech API 拟音,
     * 比如 /æ/ → 'aah'、/p/ → 'puh'、/ʃ/ → 'shh'。
     */
    articulation: string;
    /** 发音要点提示 */
    tip: string;
    /** 助记顺口溜（谐音+例词） */
    mnemonic: string;
    /** 易混淆音素(用于干扰项 / 最小对立对) */
    similar?: string[];
}

// ============================================================================
// 元音 20 个
// ============================================================================

const SHORT_VOWELS: Phoneme[] = [
    {ipa: 'ɪ', type: 'vowel', group: 'short', groupLabel: '短元音', articulation: 'it', mnemonic: '小「衣」ɪ，短又急，sit 里听得清', examples: ['sit', 'ship', 'big', 'fish'], tip: '舌位前高,嘴角微开,短促有力', similar: ['iː', 'e']},
    {ipa: 'e', type: 'vowel', group: 'short', groupLabel: '短元音', articulation: 'eh', mnemonic: '小嘴「哎」e，bed 中间听', examples: ['bed', 'ten', 'red', 'pen'], tip: '舌位前半高,嘴半开', similar: ['æ', 'ɪ']},
    {ipa: 'æ', type: 'vowel', group: 'short', groupLabel: '短元音', articulation: 'at', mnemonic: '大嘴「哎」æ，cat 张嘴巴', examples: ['cat', 'apple', 'hand', 'bag'], tip: '舌位前低,嘴大开,像"哎"', similar: ['e', 'ʌ']},
    {ipa: 'ʌ', type: 'vowel', group: 'short', groupLabel: '短元音', articulation: 'uh', mnemonic: '短「阿」ʌ，cup 里藏', examples: ['cup', 'sun', 'bus', 'love'], tip: '舌位中央,嘴半开,短促', similar: ['ɑː', 'æ']},
    {ipa: 'ɒ', type: 'vowel', group: 'short', groupLabel: '短元音', articulation: 'on', mnemonic: '圆唇短「哦」ɒ，hot 热得慌', examples: ['hot', 'dog', 'box', 'top'], tip: '舌位后低,嘴大开圆唇', similar: ['ɔː', 'ʌ']},
    {ipa: 'ʊ', type: 'vowel', group: 'short', groupLabel: '短元音', articulation: 'good', mnemonic: '短「乌」ʊ，book 收圆唇', examples: ['book', 'good', 'put', 'look'], tip: '舌位后高,圆唇,短促', similar: ['uː']},
    {ipa: 'ə', type: 'vowel', group: 'short', groupLabel: '短元音', articulation: 'uh', mnemonic: '懒「饿」ə，about 轻轻带过', examples: ['about', 'sofa', 'ago', 'banana'], tip: '中性元音(弱读),嘴自然半开'},
];

const LONG_VOWELS: Phoneme[] = [
    {ipa: 'iː', type: 'vowel', group: 'long', groupLabel: '长元音', articulation: 'e', mnemonic: '微笑长「衣」iː，see 拉长音', examples: ['see', 'sheep', 'tree', 'meet'], tip: '舌位前高,嘴扁平,音长清晰', similar: ['ɪ']},
    {ipa: 'ɑː', type: 'vowel', group: 'long', groupLabel: '长元音', articulation: 'ah', mnemonic: '大嘴长「啊」ɑː，car 开远门', examples: ['car', 'far', 'park', 'arm'], tip: '舌位后低,嘴大开,音长', similar: ['ʌ']},
    {ipa: 'ɔː', type: 'vowel', group: 'long', groupLabel: '长元音', articulation: 'or', mnemonic: '圆唇长「哦」ɔː，four 有四个', examples: ['four', 'door', 'sport', 'horse'], tip: '舌位后半低,圆唇,音长', similar: ['ɒ']},
    {ipa: 'uː', type: 'vowel', group: 'long', groupLabel: '长元音', articulation: 'oo', mnemonic: '嘟嘴长「乌」uː，food 吃得香', examples: ['food', 'moon', 'blue', 'school'], tip: '舌位后高,圆唇,音长', similar: ['ʊ']},
    {ipa: 'ɜː', type: 'vowel', group: 'long', groupLabel: '长元音', articulation: 'er', mnemonic: '长「饿」ɜː，bird 里找它', examples: ['bird', 'girl', 'her', 'work'], tip: '舌位中央,嘴半开,音长'},
];

const DIPHTHONGS: Phoneme[] = [
    {ipa: 'eɪ', type: 'vowel', group: 'diphthong', groupLabel: '双元音', articulation: 'ay', mnemonic: '滑音「诶」eɪ，day 收尾上扬', examples: ['name', 'day', 'cake', 'rain'], tip: '从 /e/ 滑向 /ɪ/'},
    {ipa: 'aɪ', type: 'vowel', group: 'diphthong', groupLabel: '双元音', articulation: 'eye', mnemonic: '开口「爱」aɪ，my 就是我', examples: ['five', 'time', 'my', 'sky'], tip: '从 /a/ 滑向 /ɪ/'},
    {ipa: 'ɔɪ', type: 'vowel', group: 'diphthong', groupLabel: '双元音', articulation: 'oy', mnemonic: '「噢衣」ɔɪ，boy 男孩子', examples: ['boy', 'toy', 'coin', 'voice'], tip: '从 /ɔ/ 滑向 /ɪ/'},
    {ipa: 'aʊ', type: 'vowel', group: 'diphthong', groupLabel: '双元音', articulation: 'ow', mnemonic: '「奥」aʊ，now 就现在', examples: ['now', 'how', 'house', 'down'], tip: '从 /a/ 滑向 /ʊ/'},
    {ipa: 'əʊ', type: 'vowel', group: 'diphthong', groupLabel: '双元音', articulation: 'oh', mnemonic: '「欧」əʊ，go 向前走', examples: ['go', 'no', 'home', 'snow'], tip: '从 /ə/ 滑向 /ʊ/'},
    {ipa: 'ɪə', type: 'vowel', group: 'diphthong', groupLabel: '双元音', articulation: 'eer', mnemonic: '「衣饿」ɪə，ear 贴耳听', examples: ['ear', 'here', 'near', 'dear'], tip: '从 /ɪ/ 滑向 /ə/'},
    {ipa: 'eə', type: 'vowel', group: 'diphthong', groupLabel: '双元音', articulation: 'air', mnemonic: '「哎饿」eə，air 空气新', examples: ['air', 'hair', 'chair', 'where'], tip: '从 /e/ 滑向 /ə/'},
    {ipa: 'ʊə', type: 'vowel', group: 'diphthong', groupLabel: '双元音', articulation: 'oor', mnemonic: '「乌饿」ʊə，tour 去远游', examples: ['tour', 'sure', 'poor', 'pure'], tip: '从 /ʊ/ 滑向 /ə/'},
];

// ============================================================================
// 辅音 28 个(按清浊配对)
// ============================================================================

const PLOSIVES: Phoneme[] = [
    {ipa: 'p', type: 'consonant', group: 'plosive', groupLabel: '爆破音', voiced: false, articulation: 'puh', mnemonic: '轻「泼」p，双唇一碰就破', examples: ['pen', 'pig', 'apple', 'happy'], tip: '双唇紧闭后突然爆破,清辅音', similar: ['b']},
    {ipa: 'b', type: 'consonant', group: 'plosive', groupLabel: '爆破音', voiced: true, articulation: 'buh', mnemonic: '浊「伯」b，声带跟着震动', examples: ['bed', 'big', 'baby', 'book'], tip: '双唇紧闭后突然爆破,浊辅音', similar: ['p']},
    {ipa: 't', type: 'consonant', group: 'plosive', groupLabel: '爆破音', voiced: false, articulation: 'tuh', mnemonic: '轻「特」t，舌尖弹上颚', examples: ['top', 'ten', 'cat', 'water'], tip: '舌尖抵上齿龈爆破,清辅音', similar: ['d']},
    {ipa: 'd', type: 'consonant', group: 'plosive', groupLabel: '爆破音', voiced: true, articulation: 'duh', mnemonic: '浊「德」d，带震动的 t', examples: ['dog', 'day', 'red', 'door'], tip: '舌尖抵上齿龈爆破,浊辅音', similar: ['t']},
    {ipa: 'k', type: 'consonant', group: 'plosive', groupLabel: '爆破音', voiced: false, articulation: 'kuh', mnemonic: '轻「科」k，舌根抬一抬', examples: ['cat', 'key', 'book', 'cake'], tip: '舌后部抵软腭爆破,清辅音', similar: ['ɡ']},
    {ipa: 'ɡ', type: 'consonant', group: 'plosive', groupLabel: '爆破音', voiced: true, articulation: 'guh', mnemonic: '浊「哥」ɡ，带震动的 k', examples: ['go', 'good', 'big', 'game'], tip: '舌后部抵软腭爆破,浊辅音', similar: ['k']},
];

const FRICATIVES: Phoneme[] = [
    {ipa: 'f', type: 'consonant', group: 'fricative', groupLabel: '摩擦音', voiced: false, articulation: 'fuh', mnemonic: '咬唇「佛」f，上牙碰下唇', examples: ['four', 'fish', 'face', 'life'], tip: '上齿轻咬下唇,气流摩擦,清辅音', similar: ['v']},
    {ipa: 'v', type: 'consonant', group: 'fricative', groupLabel: '摩擦音', voiced: true, articulation: 'vuh', mnemonic: '咬唇「佛」v，加上声带震', examples: ['very', 'voice', 'love', 'five'], tip: '上齿轻咬下唇,声带震动,浊辅音', similar: ['f']},
    {ipa: 's', type: 'consonant', group: 'fricative', groupLabel: '摩擦音', voiced: false, articulation: 'suh', mnemonic: '蛇「丝」s，嘶嘶不漏气', examples: ['see', 'sit', 'bus', 'class'], tip: '舌尖靠近上齿龈,清辅音', similar: ['z', 'θ']},
    {ipa: 'z', type: 'consonant', group: 'fricative', groupLabel: '摩擦音', voiced: true, articulation: 'zuh', mnemonic: '蜂「兹」z，嗡嗡带震动', examples: ['zoo', 'zero', 'is', 'busy'], tip: '舌尖靠近上齿龈,浊辅音', similar: ['s', 'ð']},
    {ipa: 'θ', type: 'consonant', group: 'fricative', groupLabel: '摩擦音', voiced: false, articulation: 'thuh', mnemonic: '咬舌「思」θ，think 伸舌尖', examples: ['think', 'three', 'thank', 'mouth'], tip: '舌尖伸出齿间,清辅音(中文无对应)', similar: ['s', 'ð']},
    {ipa: 'ð', type: 'consonant', group: 'fricative', groupLabel: '摩擦音', voiced: true, articulation: 'the', mnemonic: '咬舌「兹」ð，this 带震动', examples: ['this', 'that', 'mother', 'they'], tip: '舌尖伸出齿间,浊辅音', similar: ['θ', 'z', 'd']},
    {ipa: 'ʃ', type: 'consonant', group: 'fricative', groupLabel: '摩擦音', voiced: false, articulation: 'shuh', mnemonic: '「嘘」ʃ，安静别说话', examples: ['she', 'ship', 'fish', 'wash'], tip: '舌前部靠近上齿龈后部,清辅音', similar: ['ʒ', 's']},
    {ipa: 'ʒ', type: 'consonant', group: 'fricative', groupLabel: '摩擦音', voiced: true, articulation: 'zhuh', mnemonic: '「日」ʒ，vision 里找它', examples: ['vision', 'pleasure', 'measure', 'usual'], tip: '舌前部靠近上齿龈后部,浊辅音', similar: ['ʃ', 'z']},
    {ipa: 'h', type: 'consonant', group: 'fricative', groupLabel: '摩擦音', voiced: false, articulation: 'huh', mnemonic: '哈气「喝」h，hat 轻轻哈', examples: ['he', 'hat', 'home', 'happy'], tip: '声门摩擦,送气,清辅音'},
    {ipa: 'r', type: 'consonant', group: 'fricative', groupLabel: '摩擦音', voiced: true, articulation: 'ruh', mnemonic: '卷舌「若」r，red 舌头卷', examples: ['red', 'right', 'very', 'tree'], tip: '舌尖卷起靠近上齿龈,浊辅音'},
];

const AFFRICATES: Phoneme[] = [
    {ipa: 'tʃ', type: 'consonant', group: 'affricate', groupLabel: '破擦音', voiced: false, articulation: 'chuh', mnemonic: '「吃」tʃ，chair 坐一坐', examples: ['chair', 'cheese', 'teach', 'much'], tip: '/t/ + /ʃ/ 连读,清辅音', similar: ['dʒ', 'ʃ']},
    {ipa: 'dʒ', type: 'consonant', group: 'affricate', groupLabel: '破擦音', voiced: true, articulation: 'juh', mnemonic: '「知」dʒ，jump 跳一跳', examples: ['jump', 'job', 'page', 'bridge'], tip: '/d/ + /ʒ/ 连读,浊辅音', similar: ['tʃ', 'ʒ']},
    {ipa: 'tr', type: 'consonant', group: 'affricate', groupLabel: '破擦音', voiced: false, articulation: 'truh', mnemonic: '「戳」tr，tree 一棵松', examples: ['tree', 'try', 'train', 'truck'], tip: '/t/ + /r/ 连读,清辅音', similar: ['dr']},
    {ipa: 'dr', type: 'consonant', group: 'affricate', groupLabel: '破擦音', voiced: true, articulation: 'druh', mnemonic: '「捉」dr，dream 做个梦', examples: ['dry', 'draw', 'dream', 'drink'], tip: '/d/ + /r/ 连读,浊辅音', similar: ['tr']},
    {ipa: 'ts', type: 'consonant', group: 'affricate', groupLabel: '破擦音', voiced: false, articulation: 'tsuh', mnemonic: '「刺」ts，cats 词尾见', examples: ['its', 'cats', 'bits', 'students'], tip: '/t/ + /s/ 连读,清辅音(多出现于词尾)', similar: ['dz']},
    {ipa: 'dz', type: 'consonant', group: 'affricate', groupLabel: '破擦音', voiced: true, articulation: 'dzuh', mnemonic: '「资」dz，birds 词尾见', examples: ['birds', 'kids', 'goods', 'beds'], tip: '/d/ + /z/ 连读,浊辅音(多出现于词尾)', similar: ['ts']},
];

const NASALS: Phoneme[] = [
    {ipa: 'm', type: 'consonant', group: 'nasal', groupLabel: '鼻音', voiced: true, articulation: 'muh', mnemonic: '闭嘴「姆」m，mom 喊妈妈', examples: ['mom', 'man', 'come', 'time'], tip: '双唇闭合,气流从鼻腔出', similar: ['n']},
    {ipa: 'n', type: 'consonant', group: 'nasal', groupLabel: '鼻音', voiced: true, articulation: 'nuh', mnemonic: '开口「嗯」n，no 舌尖顶上', examples: ['no', 'name', 'sun', 'run'], tip: '舌尖抵上齿龈,气流从鼻腔出', similar: ['m', 'ŋ']},
    {ipa: 'ŋ', type: 'consonant', group: 'nasal', groupLabel: '鼻音', voiced: true, articulation: 'ung', mnemonic: '后鼻「嗯」ŋ，sing 挂鼻腔', examples: ['sing', 'long', 'thing', 'morning'], tip: '舌后抵软腭,气流从鼻腔出', similar: ['n']},
];

const LATERALS: Phoneme[] = [
    {ipa: 'l', type: 'consonant', group: 'lateral', groupLabel: '边音', voiced: true, articulation: 'luh', mnemonic: '舌尖「了」l，look 顶上颚', examples: ['look', 'love', 'school', 'tell'], tip: '舌尖抵上齿龈,气流从舌两侧通过'},
];

const SEMIVOWELS: Phoneme[] = [
    {ipa: 'j', type: 'consonant', group: 'semivowel', groupLabel: '半元音', voiced: true, articulation: 'yuh', mnemonic: '短「耶」j，yes 快滑出', examples: ['yes', 'you', 'yellow', 'year'], tip: '舌位接近 /iː/,但更紧'},
    {ipa: 'w', type: 'consonant', group: 'semivowel', groupLabel: '半元音', voiced: true, articulation: 'wuh', mnemonic: '圆唇「乌」w，we 一滑而过', examples: ['we', 'water', 'window', 'way'], tip: '双唇收圆,舌位接近 /uː/'},
];

// ============================================================================
// 汇总导出
// ============================================================================

export const VOWELS: Phoneme[] = [...SHORT_VOWELS, ...LONG_VOWELS, ...DIPHTHONGS];
export const CONSONANTS: Phoneme[] = [...PLOSIVES, ...FRICATIVES, ...AFFRICATES, ...NASALS, ...LATERALS, ...SEMIVOWELS];
export const ALL_PHONEMES: Phoneme[] = [...VOWELS, ...CONSONANTS];

/** 按一级分组(元音/辅音)+ 子分组聚合,用于音标表分组展示 */
export interface PhonemeGroup {
    title: string;        // "元音 Vowels"
    subtitle?: string;    // "20 个"
    sections: Array<{
        label: string;     // "短元音"
        en: string;        // "Short"
        phonemes: Phoneme[];
    }>;
}

export const PHONEME_TABLE: PhonemeGroup[] = [
    {
        title: '元音',
        subtitle: 'Vowels · 20',
        sections: [
            {label: '短元音', en: 'Short', phonemes: SHORT_VOWELS},
            {label: '长元音', en: 'Long', phonemes: LONG_VOWELS},
            {label: '双元音', en: 'Diphthongs', phonemes: DIPHTHONGS},
        ],
    },
    {
        title: '辅音',
        subtitle: 'Consonants · 28',
        sections: [
            {label: '爆破音', en: 'Plosives', phonemes: PLOSIVES},
            {label: '摩擦音', en: 'Fricatives', phonemes: FRICATIVES},
            {label: '破擦音', en: 'Affricates', phonemes: AFFRICATES},
            {label: '鼻音', en: 'Nasals', phonemes: NASALS},
            {label: '边音', en: 'Lateral', phonemes: LATERALS},
            {label: '半元音', en: 'Semi-vowels', phonemes: SEMIVOWELS},
        ],
    },
];

/** 按 IPA 符号查找音素 */
export function findPhoneme(ipa: string): Phoneme | undefined {
    return ALL_PHONEMES.find(p => p.ipa === ipa);
}

// ============================================================================
// 最小对立对 (Minimal Pairs)
// ============================================================================

/**
 * 一对仅在某个音素上不同的常见单词,用于听辨训练
 * 精选 70+ 对,优先覆盖中国学习者最易混淆的发音对立
 */
export interface MinimalPair {
    a: string;        // 单词 A
    b: string;        // 单词 B
    phoneticA: string; // A 的音标
    phoneticB: string; // B 的音标
    contrast: string;  // 对立点说明,如 '/ɪ/ vs /iː/'
    /** 难度:1=入门 2=中级 3=进阶 */
    difficulty: 1 | 2 | 3;
}

export const MINIMAL_PAIRS: MinimalPair[] = [
    // === /ɪ/ vs /iː/ 短/长 i ===
    {a: 'ship', b: 'sheep', phoneticA: 'ʃɪp', phoneticB: 'ʃiːp', contrast: '/ɪ/ vs /iː/', difficulty: 1},
    {a: 'bit', b: 'beat', phoneticA: 'bɪt', phoneticB: 'biːt', contrast: '/ɪ/ vs /iː/', difficulty: 1},
    {a: 'fit', b: 'feet', phoneticA: 'fɪt', phoneticB: 'fiːt', contrast: '/ɪ/ vs /iː/', difficulty: 1},
    {a: 'live', b: 'leave', phoneticA: 'lɪv', phoneticB: 'liːv', contrast: '/ɪ/ vs /iː/', difficulty: 2},
    {a: 'hit', b: 'heat', phoneticA: 'hɪt', phoneticB: 'hiːt', contrast: '/ɪ/ vs /iː/', difficulty: 1},
    {a: 'fill', b: 'feel', phoneticA: 'fɪl', phoneticB: 'fiːl', contrast: '/ɪ/ vs /iː/', difficulty: 1},
    {a: 'pick', b: 'peak', phoneticA: 'pɪk', phoneticB: 'piːk', contrast: '/ɪ/ vs /iː/', difficulty: 2},

    // === /e/ vs /æ/ ===
    {a: 'bed', b: 'bad', phoneticA: 'bed', phoneticB: 'bæd', contrast: '/e/ vs /æ/', difficulty: 1},
    {a: 'ten', b: 'tan', phoneticA: 'ten', phoneticB: 'tæn', contrast: '/e/ vs /æ/', difficulty: 1},
    {a: 'pen', b: 'pan', phoneticA: 'pen', phoneticB: 'pæn', contrast: '/e/ vs /æ/', difficulty: 1},
    {a: 'men', b: 'man', phoneticA: 'men', phoneticB: 'mæn', contrast: '/e/ vs /æ/', difficulty: 1},
    {a: 'said', b: 'sad', phoneticA: 'sed', phoneticB: 'sæd', contrast: '/e/ vs /æ/', difficulty: 2},

    // === /æ/ vs /ʌ/ ===
    {a: 'cat', b: 'cut', phoneticA: 'kæt', phoneticB: 'kʌt', contrast: '/æ/ vs /ʌ/', difficulty: 1},
    {a: 'bat', b: 'but', phoneticA: 'bæt', phoneticB: 'bʌt', contrast: '/æ/ vs /ʌ/', difficulty: 1},
    {a: 'hat', b: 'hut', phoneticA: 'hæt', phoneticB: 'hʌt', contrast: '/æ/ vs /ʌ/', difficulty: 1},
    {a: 'ran', b: 'run', phoneticA: 'ræn', phoneticB: 'rʌn', contrast: '/æ/ vs /ʌ/', difficulty: 1},
    {a: 'sang', b: 'sung', phoneticA: 'sæŋ', phoneticB: 'sʌŋ', contrast: '/æ/ vs /ʌ/', difficulty: 2},

    // === /ɒ/ vs /ɔː/ ===
    {a: 'cot', b: 'caught', phoneticA: 'kɒt', phoneticB: 'kɔːt', contrast: '/ɒ/ vs /ɔː/', difficulty: 2},
    {a: 'don', b: 'dawn', phoneticA: 'dɒn', phoneticB: 'dɔːn', contrast: '/ɒ/ vs /ɔː/', difficulty: 2},
    {a: 'pot', b: 'port', phoneticA: 'pɒt', phoneticB: 'pɔːt', contrast: '/ɒ/ vs /ɔː/', difficulty: 2},

    // === /ʊ/ vs /uː/ ===
    {a: 'pull', b: 'pool', phoneticA: 'pʊl', phoneticB: 'puːl', contrast: '/ʊ/ vs /uː/', difficulty: 1},
    {a: 'full', b: 'fool', phoneticA: 'fʊl', phoneticB: 'fuːl', contrast: '/ʊ/ vs /uː/', difficulty: 1},
    {a: 'look', b: 'Luke', phoneticA: 'lʊk', phoneticB: 'luːk', contrast: '/ʊ/ vs /uː/', difficulty: 2},

    // === /ʌ/ vs /ɑː/ ===
    {a: 'cup', b: 'carp', phoneticA: 'kʌp', phoneticB: 'kɑːp', contrast: '/ʌ/ vs /ɑː/', difficulty: 2},
    {a: 'hut', b: 'heart', phoneticA: 'hʌt', phoneticB: 'hɑːt', contrast: '/ʌ/ vs /ɑː/', difficulty: 2},

    // === /p/ vs /b/ ===
    {a: 'pen', b: 'Ben', phoneticA: 'pen', phoneticB: 'ben', contrast: '/p/ vs /b/', difficulty: 1},
    {a: 'pat', b: 'bat', phoneticA: 'pæt', phoneticB: 'bæt', contrast: '/p/ vs /b/', difficulty: 1},
    {a: 'pig', b: 'big', phoneticA: 'pɪɡ', phoneticB: 'bɪɡ', contrast: '/p/ vs /b/', difficulty: 1},
    {a: 'pull', b: 'bull', phoneticA: 'pʊl', phoneticB: 'bʊl', contrast: '/p/ vs /b/', difficulty: 1},
    {a: 'cap', b: 'cab', phoneticA: 'kæp', phoneticB: 'kæb', contrast: '/p/ vs /b/', difficulty: 2},

    // === /t/ vs /d/ ===
    {a: 'tear', b: 'dear', phoneticA: 'tɪə', phoneticB: 'dɪə', contrast: '/t/ vs /d/', difficulty: 1},
    {a: 'tie', b: 'die', phoneticA: 'taɪ', phoneticB: 'daɪ', contrast: '/t/ vs /d/', difficulty: 1},
    {a: 'town', b: 'down', phoneticA: 'taʊn', phoneticB: 'daʊn', contrast: '/t/ vs /d/', difficulty: 1},
    {a: 'time', b: 'dime', phoneticA: 'taɪm', phoneticB: 'daɪm', contrast: '/t/ vs /d/', difficulty: 2},
    {a: 'two', b: 'do', phoneticA: 'tuː', phoneticB: 'duː', contrast: '/t/ vs /d/', difficulty: 2},

    // === /k/ vs /ɡ/ ===
    {a: 'cap', b: 'gap', phoneticA: 'kæp', phoneticB: 'ɡæp', contrast: '/k/ vs /ɡ/', difficulty: 1},
    {a: 'came', b: 'game', phoneticA: 'keɪm', phoneticB: 'ɡeɪm', contrast: '/k/ vs /ɡ/', difficulty: 1},
    {a: 'coat', b: 'goat', phoneticA: 'kəʊt', phoneticB: 'ɡəʊt', contrast: '/k/ vs /ɡ/', difficulty: 1},
    {a: 'class', b: 'glass', phoneticA: 'klɑːs', phoneticB: 'ɡlɑːs', contrast: '/k/ vs /ɡ/', difficulty: 2},

    // === /f/ vs /v/ ===
    {a: 'fan', b: 'van', phoneticA: 'fæn', phoneticB: 'væn', contrast: '/f/ vs /v/', difficulty: 1},
    {a: 'fast', b: 'vast', phoneticA: 'fɑːst', phoneticB: 'vɑːst', contrast: '/f/ vs /v/', difficulty: 2},
    {a: 'leaf', b: 'leave', phoneticA: 'liːf', phoneticB: 'liːv', contrast: '/f/ vs /v/', difficulty: 2},
    {a: 'few', b: 'view', phoneticA: 'fjuː', phoneticB: 'vjuː', contrast: '/f/ vs /v/', difficulty: 2},

    // === /s/ vs /z/ ===
    {a: 'sue', b: 'zoo', phoneticA: 'suː', phoneticB: 'zuː', contrast: '/s/ vs /z/', difficulty: 1},
    {a: 'peace', b: 'peas', phoneticA: 'piːs', phoneticB: 'piːz', contrast: '/s/ vs /z/', difficulty: 2},
    {a: 'price', b: 'prize', phoneticA: 'praɪs', phoneticB: 'praɪz', contrast: '/s/ vs /z/', difficulty: 2},
    {a: 'bus', b: 'buzz', phoneticA: 'bʌs', phoneticB: 'bʌz', contrast: '/s/ vs /z/', difficulty: 2},

    // === /θ/ vs /s/ ===
    {a: 'thin', b: 'sin', phoneticA: 'θɪn', phoneticB: 'sɪn', contrast: '/θ/ vs /s/', difficulty: 2},
    {a: 'think', b: 'sink', phoneticA: 'θɪŋk', phoneticB: 'sɪŋk', contrast: '/θ/ vs /s/', difficulty: 2},
    {a: 'thick', b: 'sick', phoneticA: 'θɪk', phoneticB: 'sɪk', contrast: '/θ/ vs /s/', difficulty: 2},
    {a: 'path', b: 'pass', phoneticA: 'pɑːθ', phoneticB: 'pɑːs', contrast: '/θ/ vs /s/', difficulty: 3},

    // === /θ/ vs /ð/ ===
    {a: 'thigh', b: 'thy', phoneticA: 'θaɪ', phoneticB: 'ðaɪ', contrast: '/θ/ vs /ð/', difficulty: 3},
    {a: 'breath', b: 'breathe', phoneticA: 'breθ', phoneticB: 'briːð', contrast: '/θ/ vs /ð/', difficulty: 3},

    // === /tʃ/ vs /dʒ/ ===
    {a: 'chain', b: 'Jane', phoneticA: 'tʃeɪn', phoneticB: 'dʒeɪn', contrast: '/tʃ/ vs /dʒ/', difficulty: 2},
    {a: 'cheer', b: 'jeer', phoneticA: 'tʃɪə', phoneticB: 'dʒɪə', contrast: '/tʃ/ vs /dʒ/', difficulty: 2},
    {a: 'choke', b: 'joke', phoneticA: 'tʃəʊk', phoneticB: 'dʒəʊk', contrast: '/tʃ/ vs /dʒ/', difficulty: 2},
    {a: 'rich', b: 'ridge', phoneticA: 'rɪtʃ', phoneticB: 'rɪdʒ', contrast: '/tʃ/ vs /dʒ/', difficulty: 3},

    // === /ʃ/ vs /tʃ/ ===
    {a: 'sheep', b: 'cheap', phoneticA: 'ʃiːp', phoneticB: 'tʃiːp', contrast: '/ʃ/ vs /tʃ/', difficulty: 2},
    {a: 'wash', b: 'watch', phoneticA: 'wɒʃ', phoneticB: 'wɒtʃ', contrast: '/ʃ/ vs /tʃ/', difficulty: 2},
    {a: 'ship', b: 'chip', phoneticA: 'ʃɪp', phoneticB: 'tʃɪp', contrast: '/ʃ/ vs /tʃ/', difficulty: 2},

    // === /l/ vs /r/ ===
    {a: 'light', b: 'right', phoneticA: 'laɪt', phoneticB: 'raɪt', contrast: '/l/ vs /r/', difficulty: 1},
    {a: 'lice', b: 'rice', phoneticA: 'laɪs', phoneticB: 'raɪs', contrast: '/l/ vs /r/', difficulty: 1},
    {a: 'glow', b: 'grow', phoneticA: 'ɡləʊ', phoneticB: 'ɡrəʊ', contrast: '/l/ vs /r/', difficulty: 2},
    {a: 'flame', b: 'frame', phoneticA: 'fleɪm', phoneticB: 'freɪm', contrast: '/l/ vs /r/', difficulty: 2},
    {a: 'collect', b: 'correct', phoneticA: 'kəˈlekt', phoneticB: 'kəˈrekt', contrast: '/l/ vs /r/', difficulty: 3},

    // === /m/ vs /n/ ===
    {a: 'mail', b: 'nail', phoneticA: 'meɪl', phoneticB: 'neɪl', contrast: '/m/ vs /n/', difficulty: 1},
    {a: 'mine', b: 'nine', phoneticA: 'maɪn', phoneticB: 'naɪn', contrast: '/m/ vs /n/', difficulty: 1},
    {a: 'sum', b: 'sun', phoneticA: 'sʌm', phoneticB: 'sʌn', contrast: '/m/ vs /n/', difficulty: 2},
    {a: 'met', b: 'net', phoneticA: 'met', phoneticB: 'net', contrast: '/m/ vs /n/', difficulty: 1},

    // === /n/ vs /ŋ/ ===
    {a: 'sin', b: 'sing', phoneticA: 'sɪn', phoneticB: 'sɪŋ', contrast: '/n/ vs /ŋ/', difficulty: 2},
    {a: 'win', b: 'wing', phoneticA: 'wɪn', phoneticB: 'wɪŋ', contrast: '/n/ vs /ŋ/', difficulty: 2},
    {a: 'run', b: 'rung', phoneticA: 'rʌn', phoneticB: 'rʌŋ', contrast: '/n/ vs /ŋ/', difficulty: 2},
    {a: 'thin', b: 'thing', phoneticA: 'θɪn', phoneticB: 'θɪŋ', contrast: '/n/ vs /ŋ/', difficulty: 2},

    // === /v/ vs /w/ ===
    {a: 'vine', b: 'wine', phoneticA: 'vaɪn', phoneticB: 'waɪn', contrast: '/v/ vs /w/', difficulty: 2},
    {a: 'vest', b: 'west', phoneticA: 'vest', phoneticB: 'west', contrast: '/v/ vs /w/', difficulty: 2},
    {a: 'veil', b: 'wail', phoneticA: 'veɪl', phoneticB: 'weɪl', contrast: '/v/ vs /w/', difficulty: 3},

    // === /eɪ/ vs /aɪ/ ===
    {a: 'late', b: 'light', phoneticA: 'leɪt', phoneticB: 'laɪt', contrast: '/eɪ/ vs /aɪ/', difficulty: 2},
    {a: 'pale', b: 'pile', phoneticA: 'peɪl', phoneticB: 'paɪl', contrast: '/eɪ/ vs /aɪ/', difficulty: 2},

    // === /əʊ/ vs /aʊ/ ===
    {a: 'know', b: 'now', phoneticA: 'nəʊ', phoneticB: 'naʊ', contrast: '/əʊ/ vs /aʊ/', difficulty: 2},
    {a: 'load', b: 'loud', phoneticA: 'ləʊd', phoneticB: 'laʊd', contrast: '/əʊ/ vs /aʊ/', difficulty: 2},
];

