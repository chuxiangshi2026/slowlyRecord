/**
 * 自然拼读（phonics）规则数据集
 *
 * 覆盖：26 个字母基础音 + 24 个高频字母组合（CVC 阶段够用的高频子集）
 * 每条规则给出 2–3 个例词，例词预切好拼读块（blocks），供拼读（blending）练习逐块发音。
 * blocks 优先使用规则 id（如 'sh'、'a_e'），练习页据此查 ipa 走 TTS 拟音；
 * 非规则块（如词尾 'se'）直接按原字符串发音。
 *
 * 与 phoneme-data.ts 的关系：规则通过 ipa 字段关联 48 音素，掌握度按规则 id 独立追踪。
 */

export interface PhonicsExample {
    /** 单词 */
    word: string;
    /** 拼读块（顺序拼接即原词） */
    blocks: string[];
    /** 中文释义 */
    meaning: string;
}

export interface PhonicsRule {
    /** 规则 id：字母本身或组合（magic-e 用 'a_e' 形式） */
    id: string;
    /** 展示用字形（magic-e 显示 'a-e'） */
    grapheme: string;
    /** 对应音素（关联 phoneme-data.ts 的 ipa） */
    ipa: string;
    /** letter=26 字母基础音 / combo=字母组合 */
    type: 'letter' | 'combo';
    /** 中文提示 */
    tip: string;
    /** 例词（2–3 个） */
    examples: PhonicsExample[];
}

const ex = (word: string, blocks: string[], meaning: string): PhonicsExample => ({word, blocks, meaning});

// ============================================================================
// 26 字母基础音（短元音 a e i o u + 辅音字母）
// ============================================================================

const LETTER_RULES: PhonicsRule[] = [
    {id: 'a', grapheme: 'a', ipa: 'æ', type: 'letter', tip: '短元音，嘴张大像"哎"', examples: [ex('cat', ['c', 'a', 't'], '猫'), ex('bag', ['b', 'a', 'g'], '书包'), ex('ant', ['a', 'n', 't'], '蚂蚁')]},
    {id: 'e', grapheme: 'e', ipa: 'e', type: 'letter', tip: '短元音，嘴半开', examples: [ex('bed', ['b', 'e', 'd'], '床'), ex('ten', ['t', 'e', 'n'], '十'), ex('red', ['r', 'e', 'd'], '红色')]},
    {id: 'i', grapheme: 'i', ipa: 'ɪ', type: 'letter', tip: '短元音，短促有力', examples: [ex('sit', ['s', 'i', 't'], '坐'), ex('pig', ['p', 'i', 'g'], '猪'), ex('fish', ['f', 'i', 'sh'], '鱼')]},
    {id: 'o', grapheme: 'o', ipa: 'ɒ', type: 'letter', tip: '短元音，嘴大开圆唇', examples: [ex('dog', ['d', 'o', 'g'], '狗'), ex('hot', ['h', 'o', 't'], '热的'), ex('box', ['b', 'o', 'x'], '盒子')]},
    {id: 'u', grapheme: 'u', ipa: 'ʌ', type: 'letter', tip: '短元音，嘴自然半开', examples: [ex('cup', ['c', 'u', 'p'], '杯子'), ex('sun', ['s', 'u', 'n'], '太阳'), ex('bus', ['b', 'u', 's'], '公交车')]},
    {id: 'b', grapheme: 'b', ipa: 'b', type: 'letter', tip: '浊辅音，双唇爆破', examples: [ex('ball', ['b', 'all'], '球'), ex('book', ['b', 'oo', 'k'], '书'), ex('bus', ['b', 'u', 's'], '公交车')]},
    {id: 'c', grapheme: 'c', ipa: 'k', type: 'letter', tip: '最常见读 /k/（在 e/i/y 前读 /s/）', examples: [ex('cat', ['c', 'a', 't'], '猫'), ex('cup', ['c', 'u', 'p'], '杯子'), ex('car', ['c', 'ar'], '汽车')]},
    {id: 'd', grapheme: 'd', ipa: 'd', type: 'letter', tip: '浊辅音，舌尖抵上龈', examples: [ex('dog', ['d', 'o', 'g'], '狗'), ex('bed', ['b', 'e', 'd'], '床'), ex('red', ['r', 'e', 'd'], '红色')]},
    {id: 'f', grapheme: 'f', ipa: 'f', type: 'letter', tip: '上齿咬下唇吹气', examples: [ex('fish', ['f', 'i', 'sh'], '鱼'), ex('fun', ['f', 'u', 'n'], '乐趣'), ex('four', ['f', 'our'], '四')]},
    {id: 'g', grapheme: 'g', ipa: 'ɡ', type: 'letter', tip: '浊辅音，舌根爆破', examples: [ex('go', ['g', 'o'], '去'), ex('big', ['b', 'i', 'g'], '大的'), ex('bag', ['b', 'a', 'g'], '书包')]},
    {id: 'h', grapheme: 'h', ipa: 'h', type: 'letter', tip: '气流从喉咙呼出', examples: [ex('hot', ['h', 'o', 't'], '热的'), ex('hat', ['h', 'a', 't'], '帽子'), ex('hand', ['h', 'a', 'n', 'd'], '手')]},
    {id: 'j', grapheme: 'j', ipa: 'dʒ', type: 'letter', tip: '浊辅音，像"知"的浊音', examples: [ex('jump', ['j', 'u', 'm', 'p'], '跳'), ex('jam', ['j', 'a', 'm'], '果酱'), ex('job', ['j', 'o', 'b'], '工作')]},
    {id: 'k', grapheme: 'k', ipa: 'k', type: 'letter', tip: '清辅音，与 c 同音', examples: [ex('kid', ['k', 'i', 'd'], '小孩'), ex('kiss', ['k', 'i', 'ss'], '吻'), ex('book', ['b', 'oo', 'k'], '书')]},
    {id: 'l', grapheme: 'l', ipa: 'l', type: 'letter', tip: '舌尖抵上龈，气流从两侧出', examples: [ex('leg', ['l', 'e', 'g'], '腿'), ex('look', ['l', 'oo', 'k'], '看'), ex('ball', ['b', 'all'], '球')]},
    {id: 'm', grapheme: 'm', ipa: 'm', type: 'letter', tip: '双唇闭合，鼻音', examples: [ex('map', ['m', 'a', 'p'], '地图'), ex('mom', ['m', 'o', 'm'], '妈妈'), ex('milk', ['m', 'i', 'l', 'k'], '牛奶')]},
    {id: 'n', grapheme: 'n', ipa: 'n', type: 'letter', tip: '舌尖抵上龈，鼻音', examples: [ex('no', ['n', 'o'], '不'), ex('ten', ['t', 'e', 'n'], '十'), ex('sun', ['s', 'u', 'n'], '太阳')]},
    {id: 'p', grapheme: 'p', ipa: 'p', type: 'letter', tip: '清辅音，双唇爆破', examples: [ex('pen', ['p', 'e', 'n'], '钢笔'), ex('pig', ['p', 'i', 'g'], '猪'), ex('cup', ['c', 'u', 'p'], '杯子')]},
    {id: 'q', grapheme: 'q', ipa: 'k', type: 'letter', tip: '总是和 u 一起出现，读 /kw/', examples: [ex('queen', ['qu', 'ee', 'n'], '女王'), ex('quick', ['qu', 'i', 'ck'], '快的'), ex('quilt', ['qu', 'i', 'l', 't'], '被子')]},
    {id: 'r', grapheme: 'r', ipa: 'r', type: 'letter', tip: '舌尖卷起不碰上龈', examples: [ex('red', ['r', 'e', 'd'], '红色'), ex('run', ['r', 'u', 'n'], '跑'), ex('car', ['c', 'ar'], '汽车')]},
    {id: 's', grapheme: 's', ipa: 's', type: 'letter', tip: '清辅音，像"丝"', examples: [ex('sun', ['s', 'u', 'n'], '太阳'), ex('sit', ['s', 'i', 't'], '坐'), ex('bus', ['b', 'u', 's'], '公交车')]},
    {id: 't', grapheme: 't', ipa: 't', type: 'letter', tip: '清辅音，舌尖弹开', examples: [ex('ten', ['t', 'e', 'n'], '十'), ex('cat', ['c', 'a', 't'], '猫'), ex('top', ['t', 'o', 'p'], '顶部')]},
    {id: 'v', grapheme: 'v', ipa: 'v', type: 'letter', tip: '浊辅音，上齿咬下唇带声', examples: [ex('van', ['v', 'a', 'n'], '货车'), ex('five', ['f', 'i_e', 'v'], '五'), ex('vest', ['v', 'e', 's', 't'], '背心')]},
    {id: 'w', grapheme: 'w', ipa: 'w', type: 'letter', tip: '双唇收圆前突，像"乌"快速滑出', examples: [ex('we', ['w', 'e'], '我们'), ex('win', ['w', 'i', 'n'], '赢'), ex('water', ['w', 'a', 't', 'er'], '水')]},
    {id: 'x', grapheme: 'x', ipa: 'k', type: 'letter', tip: '读 /ks/，像 k+s 连读', examples: [ex('box', ['b', 'o', 'x'], '盒子'), ex('six', ['s', 'i', 'x'], '六'), ex('fox', ['f', 'o', 'x'], '狐狸')]},
    {id: 'y', grapheme: 'y', ipa: 'j', type: 'letter', tip: '词首读 /j/，像"耶"的声母', examples: [ex('yes', ['y', 'e', 's'], '是'), ex('yellow', ['y', 'e', 'll', 'ow'], '黄色'), ex('yo-yo', ['y', 'o', 'y', 'o'], '溜溜球')]},
    {id: 'z', grapheme: 'z', ipa: 'z', type: 'letter', tip: '浊辅音，像"兹"带声', examples: [ex('zoo', ['z', 'oo'], '动物园'), ex('zero', ['z', 'e', 'r', 'o'], '零'), ex('buzz', ['b', 'u', 'zz'], '嗡嗡声')]},
];

// ============================================================================
// 24 个高频字母组合
// ============================================================================

const COMBO_RULES: PhonicsRule[] = [
    {id: 'sh', grapheme: 'sh', ipa: 'ʃ', type: 'combo', tip: '像"嘘"', examples: [ex('ship', ['sh', 'i', 'p'], '船'), ex('fish', ['f', 'i', 'sh'], '鱼'), ex('shop', ['sh', 'o', 'p'], '商店')]},
    {id: 'ch', grapheme: 'ch', ipa: 'tʃ', type: 'combo', tip: '像"吃"的声母', examples: [ex('chair', ['ch', 'air'], '椅子'), ex('lunch', ['l', 'u', 'n', 'ch'], '午餐'), ex('China', ['Ch', 'i', 'n', 'a'], '中国')]},
    {id: 'th', grapheme: 'th', ipa: 'θ', type: 'combo', tip: '咬舌尖：清音 three、浊音 this', examples: [ex('three', ['th', 'r', 'ee'], '三'), ex('think', ['th', 'i', 'n', 'k'], '想'), ex('this', ['th', 'i', 's'], '这个')]},
    {id: 'ck', grapheme: 'ck', ipa: 'k', type: 'combo', tip: '短元音后面的 /k/ 写作 ck', examples: [ex('duck', ['d', 'u', 'ck'], '鸭子'), ex('back', ['b', 'a', 'ck'], '背'), ex('sock', ['s', 'o', 'ck'], '袜子')]},
    {id: 'ng', grapheme: 'ng', ipa: 'ŋ', type: 'combo', tip: '鼻音，像"英"的韵尾', examples: [ex('sing', ['s', 'i', 'ng'], '唱'), ex('ring', ['r', 'i', 'ng'], '戒指'), ex('long', ['l', 'o', 'ng'], '长的')]},
    {id: 'ph', grapheme: 'ph', ipa: 'f', type: 'combo', tip: '希腊来源词里读 /f/', examples: [ex('phone', ['ph', 'o_e', 'n'], '电话'), ex('photo', ['ph', 'o', 't', 'o'], '照片'), ex('elephant', ['e', 'l', 'e', 'ph', 'a', 'n', 't'], '大象')]},
    {id: 'wh', grapheme: 'wh', ipa: 'w', type: 'combo', tip: '疑问词开头多读 /w/', examples: [ex('what', ['wh', 'a', 't'], '什么'), ex('when', ['wh', 'e', 'n'], '何时'), ex('white', ['wh', 'i_e', 't'], '白色')]},
    {id: 'a_e', grapheme: 'a-e', ipa: 'eɪ', type: 'combo', tip: 'magic e：结尾 e 不发音，a 读字母本音', examples: [ex('cake', ['c', 'a_e', 'k'], '蛋糕'), ex('name', ['n', 'a_e', 'm'], '名字'), ex('game', ['g', 'a_e', 'm'], '游戏')]},
    {id: 'i_e', grapheme: 'i-e', ipa: 'aɪ', type: 'combo', tip: 'magic e：i 读字母本音', examples: [ex('kite', ['k', 'i_e', 't'], '风筝'), ex('five', ['f', 'i_e', 'v'], '五'), ex('bike', ['b', 'i_e', 'k'], '自行车')]},
    {id: 'o_e', grapheme: 'o-e', ipa: 'əʊ', type: 'combo', tip: 'magic e：o 读字母本音', examples: [ex('home', ['h', 'o_e', 'm'], '家'), ex('nose', ['n', 'o_e', 's'], '鼻子'), ex('phone', ['ph', 'o_e', 'n'], '电话')]},
    {id: 'u_e', grapheme: 'u-e', ipa: 'uː', type: 'combo', tip: 'magic e：u 读字母本音 /juː/', examples: [ex('cute', ['c', 'u_e', 't'], '可爱的'), ex('mule', ['m', 'u_e', 'l'], '骡子'), ex('use', ['u_e', 's'], '使用')]},
    {id: 'ee', grapheme: 'ee', ipa: 'iː', type: 'combo', tip: '长音 /iː/，像"衣"', examples: [ex('see', ['s', 'ee'], '看见'), ex('tree', ['t', 'r', 'ee'], '树'), ex('bee', ['b', 'ee'], '蜜蜂')]},
    {id: 'ea', grapheme: 'ea', ipa: 'iː', type: 'combo', tip: '多读 /iː/（少数读 /e/ 如 head）', examples: [ex('eat', ['ea', 't'], '吃'), ex('tea', ['t', 'ea'], '茶'), ex('read', ['r', 'ea', 'd'], '读')]},
    {id: 'ai', grapheme: 'ai', ipa: 'eɪ', type: 'combo', tip: '词中读 /eɪ/', examples: [ex('rain', ['r', 'ai', 'n'], '雨'), ex('train', ['t', 'r', 'ai', 'n'], '火车'), ex('wait', ['w', 'ai', 't'], '等')]},
    {id: 'ay', grapheme: 'ay', ipa: 'eɪ', type: 'combo', tip: '词尾读 /eɪ/', examples: [ex('day', ['d', 'ay'], '天'), ex('play', ['p', 'l', 'ay'], '玩'), ex('say', ['s', 'ay'], '说')]},
    {id: 'oa', grapheme: 'oa', ipa: 'əʊ', type: 'combo', tip: '读 /əʊ/，像"欧"', examples: [ex('boat', ['b', 'oa', 't'], '船'), ex('coat', ['c', 'oa', 't'], '外套'), ex('road', ['r', 'oa', 'd'], '路')]},
    {id: 'oo', grapheme: 'oo', ipa: 'uː', type: 'combo', tip: '多读长音 /uː/（book 类读短 /ʊ/）', examples: [ex('moon', ['m', 'oo', 'n'], '月亮'), ex('food', ['f', 'oo', 'd'], '食物'), ex('zoo', ['z', 'oo'], '动物园')]},
    {id: 'ar', grapheme: 'ar', ipa: 'ɑː', type: 'combo', tip: '读 /ɑː/，像"啊"拉长', examples: [ex('car', ['c', 'ar'], '汽车'), ex('star', ['s', 't', 'ar'], '星星'), ex('park', ['p', 'ar', 'k'], '公园')]},
    {id: 'or', grapheme: 'or', ipa: 'ɔː', type: 'combo', tip: '读 /ɔː/，像"奥"', examples: [ex('for', ['f', 'or'], '为了'), ex('corn', ['c', 'or', 'n'], '玉米'), ex('horse', ['h', 'or', 'se'], '马')]},
    {id: 'er', grapheme: 'er', ipa: 'ə', type: 'combo', tip: '词尾弱读 /ə/，像很轻的"尔"', examples: [ex('sister', ['s', 'i', 's', 't', 'er'], '姐妹'), ex('water', ['w', 'a', 't', 'er'], '水'), ex('dinner', ['d', 'i', 'nn', 'er'], '晚餐')]},
    {id: 'ir', grapheme: 'ir', ipa: 'ɜː', type: 'combo', tip: '读 /ɜː/', examples: [ex('bird', ['b', 'ir', 'd'], '鸟'), ex('girl', ['g', 'ir', 'l'], '女孩'), ex('shirt', ['sh', 'ir', 't'], '衬衫')]},
    {id: 'ur', grapheme: 'ur', ipa: 'ɜː', type: 'combo', tip: '读 /ɜː/，与 ir 同音', examples: [ex('turn', ['t', 'ur', 'n'], '转'), ex('nurse', ['n', 'ur', 'se'], '护士'), ex('purple', ['p', 'ur', 'p', 'l', 'e'], '紫色')]},
    {id: 'oi', grapheme: 'oi', ipa: 'ɔɪ', type: 'combo', tip: '读 /ɔɪ/，像"奥伊"快读', examples: [ex('coin', ['c', 'oi', 'n'], '硬币'), ex('oil', ['oi', 'l'], '油'), ex('soil', ['s', 'oi', 'l'], '土壤')]},
    {id: 'oy', grapheme: 'oy', ipa: 'ɔɪ', type: 'combo', tip: '词尾读 /ɔɪ/，与 oi 同音', examples: [ex('boy', ['b', 'oy'], '男孩'), ex('toy', ['t', 'oy'], '玩具'), ex('joy', ['j', 'oy'], '快乐')]},
    {id: 'ou', grapheme: 'ou', ipa: 'aʊ', type: 'combo', tip: '读 /aʊ/，像"啊呜"快读', examples: [ex('house', ['h', 'ou', 'se'], '房子'), ex('mouse', ['m', 'ou', 'se'], '老鼠'), ex('cloud', ['c', 'l', 'ou', 'd'], '云')]},
    {id: 'ow', grapheme: 'ow', ipa: 'aʊ', type: 'combo', tip: '多读 /aʊ/（window 类读 /əʊ/）', examples: [ex('cow', ['c', 'ow'], '奶牛'), ex('how', ['h', 'ow'], '怎样'), ex('now', ['n', 'ow'], '现在')]},
    {id: 'igh', grapheme: 'igh', ipa: 'aɪ', type: 'combo', tip: 'gh 不发音，读 /aɪ/', examples: [ex('night', ['n', 'igh', 't'], '夜晚'), ex('light', ['l', 'igh', 't'], '光'), ex('right', ['r', 'igh', 't'], '右边')]},
];

export const ALL_PHONICS_RULES: PhonicsRule[] = [...LETTER_RULES, ...COMBO_RULES];

const RULE_MAP = new Map(ALL_PHONICS_RULES.map((r) => [r.id, r]));

/** 按 id 查规则 */
export function findPhonicsRule(id: string): PhonicsRule | undefined {
    return RULE_MAP.get(id);
}

/** 字母基础音 / 组合音 分组（供列表展示） */
export const LETTER_RULES_ONLY = LETTER_RULES;
export const COMBO_RULES_ONLY = COMBO_RULES;
