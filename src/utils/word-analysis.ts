/**
 * 词根词缀解析工具
 * 用于解析单词的词根、前缀、后缀和子单词
 */

/** 词根词缀数据接口 */
interface AffixData {
  /** 词根/词缀文本 */
  text: string;
  /** 中文释义 */
  meaning: string;
  /** 英文描述 */
  description?: string;
  /** 示例单词 */
  examples?: string[];
}

// 常见前缀列表（带释义）
const PREFIXES_DATA: AffixData[] = [
  // 否定/相反
  { text: 'un', meaning: '不，无，相反', description: 'not, opposite of', examples: ['unhappy', 'unable', 'uncover'] },
  { text: 're', meaning: '再，重新，回', description: 'again, back', examples: ['rewrite', 'return', 'review'] },
  { text: 'in', meaning: '不，无，向内', description: 'not, into', examples: ['incorrect', 'inside', 'income'] },
  { text: 'im', meaning: '不，无，向内', description: 'not, into (用于b,m,p前)', examples: ['impossible', 'import', 'improve'] },
  { text: 'dis', meaning: '不，相反，分开', description: 'not, opposite, apart', examples: ['dislike', 'disappear', 'discover'] },
  { text: 'en', meaning: '使，使成为', description: 'make, cause to be', examples: ['enable', 'enlarge', 'enrich'] },
  { text: 'em', meaning: '使，使成为', description: 'make (用于b,m,p前)', examples: ['empower', 'embrace', 'employ'] },
  { text: 'non', meaning: '不，非', description: 'not', examples: ['nonstop', 'nonsense', 'nonexistent'] },
  // 位置/方向
  { text: 'pre', meaning: '前，预先', description: 'before, in advance', examples: ['preview', 'prepare', 'prefix'] },
  { text: 'pro', meaning: '向前，支持', description: 'forward, in favor of', examples: ['progress', 'promote', 'protect'] },
  { text: 'over', meaning: '过度，在...之上', description: 'excessive, above', examples: ['overtime', 'overcome', 'overlook'] },
  { text: 'mis', meaning: '错误，坏', description: 'wrong, bad', examples: ['mistake', 'mislead', 'misunderstand'] },
  { text: 'sub', meaning: '下，次，亚', description: 'under, below, secondary', examples: ['subway', 'subject', 'subtitle'] },
  { text: 'super', meaning: '超，超级', description: 'above, beyond, super', examples: ['supermarket', 'superstar', 'superman'] },
  { text: 'inter', meaning: '在...之间，相互', description: 'between, among, mutual', examples: ['international', 'internet', 'interview'] },
  { text: 'fore', meaning: '前，预先', description: 'before, in advance', examples: ['forecast', 'forehead', 'foreground'] },
  { text: 'de', meaning: '下，除去，否定', description: 'down, away, remove', examples: ['decrease', 'defend', 'describe'] },
  { text: 'trans', meaning: '横过，转移，变换', description: 'across, beyond, change', examples: ['transport', 'translate', 'transform'] },
  // 其他
  { text: 'anti', meaning: '反，抗，防', description: 'against, opposite', examples: ['antivirus', 'antiwar', 'antibiotic'] },
  { text: 'auto', meaning: '自，自动', description: 'self, automatic', examples: ['automatic', 'autonomy', 'autobiography'] },
  { text: 'bi', meaning: '二，双', description: 'two, double', examples: ['bicycle', 'bilingual', 'biweekly'] },
  { text: 'co', meaning: '共同，一起', description: 'together, with', examples: ['cooperate', 'combine', 'connect'] },
  { text: 'counter', meaning: '反，逆，对应', description: 'against, opposite, corresponding', examples: ['counterattack', 'counterpart'] },
  { text: 'ex', meaning: '出，外，前', description: 'out, former', examples: ['export', 'exit', 'ex-wife'] },
  { text: 'extra', meaning: '以外的，额外的', description: 'beyond, outside, extra', examples: ['extraordinary', 'extracurricular'] },
  { text: 'homo', meaning: '同，相同', description: 'same', examples: ['homosexual', 'homogeneous'] },
  { text: 'hetero', meaning: '异，不同', description: 'different, other', examples: ['heterogeneous', 'heterosexual'] },
  { text: 'hyper', meaning: '超过，过度', description: 'excessive, above', examples: ['hyperactive', 'hyperlink', 'hypertension'] },
  { text: 'hypo', meaning: '下，低，次', description: 'under, below, less', examples: ['hypothesis', 'hypocrisy'] },
  { text: 'il', meaning: '不，非', description: 'not (用于l前)', examples: ['illegal', 'illogical', 'illiterate'] },
  { text: 'ir', meaning: '不，非', description: 'not (用于r前)', examples: ['irregular', 'irresponsible', 'irrelevant'] },
  { text: 'mid', meaning: '中，中间', description: 'middle', examples: ['midday', 'midnight', 'midterm'] },
  { text: 'mini', meaning: '小，迷你', description: 'small, miniature', examples: ['minibus', 'minimum', 'miniskirt'] },
  { text: 'mono', meaning: '单，一', description: 'one, single', examples: ['monologue', 'monopoly', 'monotonous'] },
  { text: 'multi', meaning: '多', description: 'many, much', examples: ['multimedia', 'multiply', 'multinational'] },
  { text: 'out', meaning: '出，外，超过', description: 'out, beyond', examples: ['outdoor', 'output', 'outstanding'] },
  { text: 'post', meaning: '后，邮政', description: 'after, behind, mail', examples: ['postwar', 'postpone', 'postcard'] },
  { text: 'semi', meaning: '半', description: 'half', examples: ['semicircle', 'semiconductor', 'semifinal'] },
  { text: 'tri', meaning: '三', description: 'three', examples: ['triangle', 'tricycle', 'triple'] },
  { text: 'ultra', meaning: '超，极端', description: 'beyond, extreme', examples: ['ultraviolet', 'ultrasonic', 'ultramodern'] },
  { text: 'under', meaning: '下，内，不足', description: 'under, below, insufficient', examples: ['underground', 'underline', 'underestimate'] },
  { text: 'with', meaning: '向后，相反', description: 'back, against', examples: ['withdraw', 'withhold', 'withstand'] }
];

// 常见后缀列表（带释义）
const SUFFIXES_DATA: AffixData[] = [
  // 形容词后缀
  { text: 'able', meaning: '可...的，能...的', description: 'able to, capable of being', examples: ['readable', 'comfortable', 'valuable'] },
  { text: 'ible', meaning: '可...的，能...的', description: 'able to, capable of being', examples: ['visible', 'possible', 'terrible'] },
  { text: 'al', meaning: '...的，属于...的', description: 'relating to, of the kind of', examples: ['national', 'natural', 'normal'] },
  { text: 'ial', meaning: '...的，属于...的', description: 'relating to', examples: ['facial', 'racial', 'social'] },
  { text: 'ful', meaning: '充满...的，有...性质的', description: 'full of, having', examples: ['beautiful', 'careful', 'helpful'] },
  { text: 'ic', meaning: '...的，与...有关的', description: 'relating to', examples: ['heroic', 'poetic', 'scientific'] },
  { text: 'ive', meaning: '有...性质的，倾向于...的', description: 'having the nature of, tending to', examples: ['active', 'creative', 'expensive'] },
  { text: 'ative', meaning: '有...性质的', description: 'having the nature of', examples: ['talkative', 'informative'] },
  { text: 'itive', meaning: '有...性质的', description: 'having the nature of', examples: ['sensitive', 'positive'] },
  { text: 'ous', meaning: '具有...的，多...的', description: 'having, full of', examples: ['famous', 'dangerous', 'nervous'] },
  { text: 'eous', meaning: '具有...的', description: 'having the nature of', examples: ['courageous', 'advantageous'] },
  { text: 'ious', meaning: '具有...的', description: 'having the nature of', examples: ['curious', 'serious', 'various'] },
  { text: 'less', meaning: '无...的，不...的', description: 'without, not having', examples: ['homeless', 'careless', 'hopeless'] },
  // 名词后缀
  { text: 'er', meaning: '...的人/物，...者', description: 'person or thing that does', examples: ['teacher', 'worker', 'computer'] },
  { text: 'or', meaning: '...的人/物，...者', description: 'person or thing that does', examples: ['actor', 'doctor', 'conductor'] },
  { text: 'ion', meaning: '...行为/状态/结果', description: 'action, state, result', examples: ['education', 'population', 'invitation'] },
  { text: 'tion', meaning: '...行为/状态/结果', description: 'action, state, result', examples: ['attention', 'situation', 'population'] },
  { text: 'ation', meaning: '...行为/状态/结果', description: 'action, state, result', examples: ['information', 'preparation', 'organization'] },
  { text: 'ition', meaning: '...行为/状态/结果', description: 'action, state, result', examples: ['competition', 'position', 'condition'] },
  { text: 'ity', meaning: '...性质/状态', description: 'quality, state, degree', examples: ['reality', 'ability', 'possibility'] },
  { text: 'ty', meaning: '...性质/状态', description: 'quality, state', examples: ['safety', 'cruelty', 'loyalty'] },
  { text: 'ment', meaning: '...行为/结果/手段', description: 'action, result, means', examples: ['movement', 'development', 'government'] },
  { text: 'ness', meaning: '...性质/状态/程度', description: 'quality, state, degree', examples: ['happiness', 'kindness', 'darkness'] },
  // 动词后缀
  { text: 'en', meaning: '使成为，使变得', description: 'make, become, cause to be', examples: ['strengthen', 'soften', 'deepen'] },
  { text: 'ize', meaning: '使...化，使成为', description: 'make, cause to be, become', examples: ['realize', 'modernize', 'organize'] },
  { text: 'ise', meaning: '使...化，使成为', description: 'make, cause to be (英式拼写)', examples: ['realise', 'organise'] },
  { text: 'ify', meaning: '使...化，使成为', description: 'make, cause to be', examples: ['simplify', 'beautify', 'clarify'] },
  { text: 'fy', meaning: '使...化', description: 'make, cause to be', examples: ['satisfy', 'terrify', 'classify'] },
  // 副词后缀
  { text: 'ly', meaning: '...地，以...方式', description: 'in the manner of', examples: ['quickly', 'slowly', 'carefully'] },
  { text: 'ward', meaning: '向...方向', description: 'in the direction of', examples: ['forward', 'backward', 'toward'] },
  { text: 'wise', meaning: '以...方式，向...方向', description: 'in the manner of, direction', examples: ['likewise', 'clockwise', 'otherwise'] },
  { text: 'wards', meaning: '向...方向', description: 'in the direction of (英式)', examples: ['towards', 'backwards', 'forwards'] },
  // 复数/时态
  { text: 's', meaning: '复数，第三人称单数', description: 'plural, third person singular', examples: ['books', 'runs'] },
  { text: 'es', meaning: '复数，第三人称单数', description: 'plural, third person singular', examples: ['boxes', 'watches', 'goes'] },
  { text: 'ed', meaning: '过去式/过去分词', description: 'past tense/participle', examples: ['walked', 'played', 'wanted'] },
  { text: 'ing', meaning: '进行时/动名词', description: 'present participle/gerund', examples: ['reading', 'running', 'swimming'] }
];

// 常见词根列表（带释义）
const ROOTS_DATA: AffixData[] = [
  { text: 'act', meaning: '做，行动', description: 'do, act', examples: ['action', 'active', 'actor', 'react'] },
  { text: 'ag', meaning: '做，行动', description: 'do, act', examples: ['agent', 'agency', 'agenda'] },
  { text: 'anim', meaning: '生命，精神', description: 'life, spirit', examples: ['animal', 'animate', 'unanimous'] },
  { text: 'ann', meaning: '年', description: 'year', examples: ['annual', 'anniversary', 'annuity'] },
  { text: 'audi', meaning: '听', description: 'hear', examples: ['audience', 'audio', 'auditorium'] },
  { text: 'bell', meaning: '战争', description: 'war', examples: ['rebel', 'bellicose', 'antebellum'] },
  { text: 'bene', meaning: '好', description: 'good', examples: ['benefit', 'beneficial', 'benevolent'] },
  { text: 'bio', meaning: '生命', description: 'life', examples: ['biology', 'biography', 'biodegradable'] },
  { text: 'cap', meaning: '拿，抓，头', description: 'take, hold, head', examples: ['capture', 'capable', 'captain'] },
  { text: 'ced', meaning: '走，让步', description: 'go, yield', examples: ['precede', 'proceed', 'succeed'] },
  { text: 'cept', meaning: '拿，抓', description: 'take, receive', examples: ['accept', 'concept', 'except', 'reception'] },
  { text: 'cert', meaning: '确实，确定', description: 'sure, certain', examples: ['certain', 'certify', 'certificate'] },
  { text: 'cid', meaning: '落，掉', description: 'fall, happen', examples: ['accident', 'incident', 'coincide'] },
  { text: 'cis', meaning: '切，杀', description: 'cut, kill', examples: ['decide', 'precise', 'suicide'] },
  { text: 'clud', meaning: '关闭', description: 'close', examples: ['conclude', 'include', 'exclude'] },
  { text: 'cogn', meaning: '知道', description: 'know', examples: ['recognize', 'cognitive', 'diagnose'] },
  { text: 'cor', meaning: '心', description: 'heart', examples: ['core', 'cordial', 'courage'] },
  { text: 'corp', meaning: '身体', description: 'body', examples: ['corporation', 'corpse', 'incorporate'] },
  { text: 'cred', meaning: '相信', description: 'believe, trust', examples: ['credit', 'credible', 'incredible'] },
  { text: 'cur', meaning: '跑，流', description: 'run, flow', examples: ['current', 'occur', 'recur'] },
  { text: 'cycl', meaning: '圆，环', description: 'circle, wheel', examples: ['cycle', 'recycle', 'bicycle'] },
  { text: 'dent', meaning: '齿', description: 'tooth', examples: ['dentist', 'dental', 'indent'] },
  { text: 'dic', meaning: '说，宣称', description: 'say, speak', examples: ['dictate', 'indicate', 'dedicate'] },
  { text: 'dict', meaning: '说', description: 'say, speak', examples: ['predict', 'contradict', 'verdict'] },
  { text: 'doc', meaning: '教', description: 'teach', examples: ['doctor', 'docile', 'doctrine'] },
  { text: 'doct', meaning: '教', description: 'teach', examples: ['doctrine', 'doctor'] },
  { text: 'domin', meaning: '统治，家', description: 'rule, home', examples: ['dominate', 'domestic', 'kingdom'] },
  { text: 'don', meaning: '给', description: 'give', examples: ['donate', 'pardon', 'antidote'] },
  { text: 'duc', meaning: '引导', description: 'lead, bring', examples: ['educate', 'produce', 'introduce'] },
  { text: 'duct', meaning: '引导', description: 'lead, bring', examples: ['conduct', 'product', 'reduce'] },
  { text: 'dur', meaning: '持久', description: 'last, harden', examples: ['durable', 'endure', 'duration'] },
  { text: 'equ', meaning: '相等', description: 'equal', examples: ['equal', 'adequate', 'equator'] },
  { text: 'fac', meaning: '做', description: 'do, make', examples: ['factory', 'facility', 'facilitate'] },
  { text: 'fact', meaning: '做', description: 'do, make', examples: ['fact', 'manufacture', 'satisfaction'] },
  { text: 'fer', meaning: '带，拿', description: 'carry, bring, bear', examples: ['transfer', 'refer', 'prefer'] },
  { text: 'fid', meaning: '信任', description: 'trust, faith', examples: ['confidence', 'fidelity', 'confide'] },
  { text: 'fin', meaning: '结束，界限', description: 'end, limit', examples: ['final', 'finish', 'define', 'infinite'] },
  { text: 'flex', meaning: '弯曲', description: 'bend', examples: ['flexible', 'reflect', 'deflect'] },
  { text: 'flect', meaning: '弯曲', description: 'bend', examples: ['reflect', 'deflect', 'inflect'] },
  { text: 'flu', meaning: '流', description: 'flow', examples: ['fluent', 'influence', 'fluid'] },
  { text: 'forc', meaning: '强', description: 'strong', examples: ['force', 'enforce', 'reinforce'] },
  { text: 'fort', meaning: '强', description: 'strong', examples: ['effort', 'comfort', 'fortify'] },
  { text: 'form', meaning: '形状', description: 'shape', examples: ['form', 'transform', 'uniform', 'formal'] },
  { text: 'frag', meaning: '破，碎', description: 'break', examples: ['fragment', 'fragile', 'fraction'] },
  { text: 'fract', meaning: '破，碎', description: 'break', examples: ['fracture', 'fraction', 'refract'] },
  { text: 'fus', meaning: '流，注', description: 'pour, melt', examples: ['confuse', 'refuse', 'transfusion'] },
  { text: 'grad', meaning: '步，走，级', description: 'step, go, grade', examples: ['grade', 'gradual', 'degrade'] },
  { text: 'gram', meaning: '写，画，文', description: 'write, record', examples: ['grammar', 'program', 'telegram'] },
  { text: 'graph', meaning: '写，画，记录', description: 'write, record', examples: ['graph', 'photograph', 'biography'] },
  { text: 'grat', meaning: '高兴，感激', description: 'pleasing, grateful', examples: ['grateful', 'gratitude', 'congratulate'] },
  { text: 'grav', meaning: '重', description: 'heavy, serious', examples: ['gravity', 'grave', 'aggravate'] },
  { text: 'gress', meaning: '行走', description: 'go, walk', examples: ['progress', 'congress', 'aggressive'] },
  { text: 'habit', meaning: '居住，拥有', description: 'dwell, have', examples: ['habit', 'inhabit', 'habitat'] },
  { text: 'her', meaning: '粘附', description: 'stick', examples: ['adhere', 'coherent', 'inherent'] },
  { text: 'hes', meaning: '粘附', description: 'stick', examples: ['hesitate', 'adhesive', 'cohesion'] },
  { text: 'hibit', meaning: '拿，持', description: 'hold, have', examples: ['exhibit', 'inhibit', 'prohibit'] },
  { text: 'hom', meaning: '同，人', description: 'same, human', examples: ['homo', 'human'] },
  { text: 'hum', meaning: '土，湿，人', description: 'earth, wet, human', examples: ['human', 'humble', 'humid'] },
  { text: 'hydro', meaning: '水', description: 'water', examples: ['hydrogen', 'hydrant', 'dehydrate'] },
  { text: 'ject', meaning: '投掷，扔', description: 'throw, cast', examples: ['project', 'reject', 'inject', 'subject'] },
  { text: 'join', meaning: '连接', description: 'join, connect', examples: ['join', 'joint', 'adjacent'] },
  { text: 'junct', meaning: '连接', description: 'join, connect', examples: ['junction', 'adjunct', 'conjunction'] },
  { text: 'jud', meaning: '判断，法律', description: 'judge, law', examples: ['judge', 'judicial', 'prejudice'] },
  { text: 'jug', meaning: '连接，结合', description: 'join, yoke', examples: ['conjugate', 'subjugate'] },
  { text: 'just', meaning: '正义，法律', description: 'justice, law', examples: ['justice', 'justify', 'adjust'] },
  { text: 'lat', meaning: '携带，产生', description: 'carry, bear', examples: ['translate', 'relate', 'correlate'] },
  { text: 'lect', meaning: '选，读', description: 'choose, read', examples: ['select', 'collect', 'intellect', 'lecture'] },
  { text: 'leg', meaning: '读，法律', description: 'read, law', examples: ['legend', 'legal', 'legislate'] },
  { text: 'lig', meaning: '绑，选择', description: 'bind, choose', examples: ['oblige', 'religion', 'elegant'] },
  { text: 'lev', meaning: '轻，举', description: 'light, raise', examples: ['elevator', 'lever', 'relieve'] },
  { text: 'liber', meaning: '自由', description: 'free', examples: ['liberty', 'liberal', 'liberate'] },
  { text: 'liter', meaning: '文字，字母', description: 'letter', examples: ['literature', 'literal', 'literate'] },
  { text: 'loc', meaning: '地方', description: 'place', examples: ['local', 'location', 'allocate'] },
  { text: 'log', meaning: '言语，思想', description: 'speech, thought', examples: ['logic', 'dialogue', 'apology'] },
  { text: 'loqu', meaning: '说', description: 'speak', examples: ['eloquent', 'colloquial', 'soliloquy'] },
  { text: 'luc', meaning: '光', description: 'light', examples: ['lucid', 'elucidate', 'translucent'] },
  { text: 'lud', meaning: '玩，戏剧', description: 'play, game', examples: ['ludicrous', 'allude', 'collude'] },
  { text: 'lus', meaning: '光，游戏', description: 'light, play', examples: ['illustrate', 'illusion'] },
  { text: 'magn', meaning: '大', description: 'great, large', examples: ['magnificent', 'magnitude', 'magnify'] },
  { text: 'maj', meaning: '大', description: 'great', examples: ['major', 'majesty', 'magnate'] },
  { text: 'man', meaning: '手', description: 'hand', examples: ['manual', 'manufacture', 'manuscript'] },
  { text: 'manu', meaning: '手', description: 'hand', examples: ['manuscript', 'manual', 'manufacture'] },
  { text: 'mar', meaning: '海', description: 'sea', examples: ['marine', 'submarine', 'maritime'] },
  { text: 'mater', meaning: '母', description: 'mother', examples: ['maternal', 'matrimony', 'matrix'] },
  { text: 'matr', meaning: '母', description: 'mother', examples: ['matriarch', 'matrimony', 'matrix'] },
  { text: 'medi', meaning: '中间', description: 'middle', examples: ['medium', 'immediate', 'medieval'] },
  { text: 'memor', meaning: '记忆', description: 'remember', examples: ['memory', 'memorial', 'memorize'] },
  { text: 'ment', meaning: '心，神智', description: 'mind', examples: ['mental', 'mention', 'demented'] },
  { text: 'merg', meaning: '沉，浸', description: 'dip, sink', examples: ['emerge', 'merge', 'submerge'] },
  { text: 'mers', meaning: '沉，浸', description: 'dip, sink', examples: ['immerse', 'submersion'] },
  { text: 'meter', meaning: '测量', description: 'measure', examples: ['thermometer', 'barometer', 'diameter'] },
  { text: 'metr', meaning: '测量', description: 'measure', examples: ['geometry', 'symmetry', 'arithmetic'] },
  { text: 'micr', meaning: '小，微', description: 'small', examples: ['microphone', 'microscope', 'microwave'] },
  { text: 'migr', meaning: '迁移', description: 'wander', examples: ['migrate', 'immigrant', 'transmigrate'] },
  { text: 'min', meaning: '小，少', description: 'small, little', examples: ['minute', 'minimize', 'diminish'] },
  { text: 'mir', meaning: '惊奇，看', description: 'wonder, look', examples: ['admire', 'miracle', 'mirror'] },
  { text: 'miss', meaning: '送，发', description: 'send, throw', examples: ['mission', 'dismiss', 'emit'] },
  { text: 'mit', meaning: '送，发', description: 'send', examples: ['transmit', 'admit', 'commit', 'permit'] },
  { text: 'mob', meaning: '动', description: 'move', examples: ['mobile', 'automobile', 'mobility'] },
  { text: 'mod', meaning: '方式，度量', description: 'measure, manner', examples: ['mode', 'model', 'modify', 'modern'] },
  { text: 'mon', meaning: '警告，提醒', description: 'warn, remind', examples: ['monitor', 'admonish', 'monument'] },
  { text: 'mor', meaning: '道德，风俗', description: 'custom, moral', examples: ['moral', 'morality', 'mores'] },
  { text: 'mort', meaning: '死', description: 'death', examples: ['mortal', 'immortal', 'mortgage'] },
  { text: 'mot', meaning: '动', description: 'move', examples: ['motion', 'motive', 'promote', 'remote'] },
  { text: 'mov', meaning: '动', description: 'move', examples: ['move', 'remove', 'movable'] },
  { text: 'mut', meaning: '改变', description: 'change', examples: ['mutual', 'commute', 'mutation'] },
  { text: 'nat', meaning: '出生，天生', description: 'born', examples: ['nation', 'nature', 'native', 'neonate'] },
  { text: 'nav', meaning: '船，海', description: 'ship, sea', examples: ['navy', 'navigate', 'naval'] },
  { text: 'nect', meaning: '绑，连接', description: 'bind, connect', examples: ['connect', 'disconnect'] },
  { text: 'nex', meaning: '绑', description: 'bind', examples: ['nexus', 'annex', 'connexion'] },
  { text: 'neg', meaning: '否认', description: 'deny', examples: ['negative', 'neglect', 'negotiate'] },
  { text: 'nihil', meaning: '无', description: 'nothing', examples: ['annihilate', 'nihilism'] },
  { text: 'noc', meaning: '伤害', description: 'harm', examples: ['innocent', 'nocuous', 'innocuous'] },
  { text: 'nox', meaning: '伤害，夜', description: 'harm, night', examples: ['noxious', 'obnoxious', 'equinox'] },
  { text: 'nom', meaning: '名字，法则', description: 'name, law', examples: ['nomenclature', 'nominal', 'autonomy'] },
  { text: 'nomin', meaning: '名字', description: 'name', examples: ['nominate', 'nominative', 'ignominious'] },
  { text: 'norm', meaning: '规则，标准', description: 'rule, standard', examples: ['normal', 'enormous', 'abnormal'] },
  { text: 'not', meaning: '知道，标记', description: 'know, mark', examples: ['note', 'notice', 'notorious', 'denote'] },
  { text: 'nounce', meaning: '报告，说', description: 'report, tell', examples: ['announce', 'denounce', 'pronounce'] },
  { text: 'nov', meaning: '新', description: 'new', examples: ['novel', 'innovate', 'renovate', 'novice'] },
  { text: 'null', meaning: '无，空', description: 'none', examples: ['null', 'annul', 'nullify'] },
  { text: 'numer', meaning: '数', description: 'number', examples: ['number', 'numerous', 'numeral'] },
  { text: 'oper', meaning: '工作', description: 'work', examples: ['operate', 'cooperate', 'opera'] },
  { text: 'opt', meaning: '选择，视', description: 'choose, see', examples: ['adopt', 'option', 'optical'] },
  { text: 'ori', meaning: '升起，开始', description: 'rise, begin', examples: ['origin', 'orient', 'abort'] },
  { text: 'orn', meaning: '装饰', description: 'adorn, equip', examples: ['adorn', 'ornament', 'suborn'] },
  { text: 'pact', meaning: '同意，紧', description: 'agreed, fast', examples: ['compact', 'pact', 'impact'] },
  { text: 'pair', meaning: '相等，准备', description: 'equal, prepare', examples: ['repair', 'impair', 'compare'] },
  { text: 'pare', meaning: '相等，准备', description: 'equal, prepare', examples: ['prepare', 'separate', 'apparent'] },
  { text: 'par', meaning: '相等，出现', description: 'equal, appear', examples: ['par', 'apparent', 'transparent'] },
  { text: 'part', meaning: '部分', description: 'part', examples: ['part', 'depart', 'impartial', 'particle'] },
  { text: 'pass', meaning: '通过，感情', description: 'pass, feeling', examples: ['pass', 'passion', 'passive', 'bypass'] },
  { text: 'pati', meaning: '忍受，感情', description: 'suffer, feel', examples: ['patient', 'compatible', 'patience'] },
  { text: 'path', meaning: '感情，痛苦', description: 'feeling, suffering', examples: ['sympathy', 'pathetic', 'pathos'] },
  { text: 'patr', meaning: '父，祖国', description: 'father', examples: ['patriot', 'paternal', 'patron'] },
  { text: 'ped', meaning: '足，儿童', description: 'foot, child', examples: ['pedal', 'pedestrian', 'pediatric'] },
  { text: 'pel', meaning: '推，驱', description: 'push, drive', examples: ['compel', 'propel', 'expel', 'repel'] },
  { text: 'pend', meaning: '悬挂，称量，支付', description: 'hang, weigh, pay', examples: ['depend', 'suspend', 'expend'] },
  { text: 'pens', meaning: '悬挂，称量，支付', description: 'hang, weigh, pay', examples: ['pension', 'compensate', 'dispense'] },
  { text: 'peri', meaning: '周围，尝试', description: 'around, try', examples: ['period', 'experience', 'experiment'] },
  { text: 'phon', meaning: '声，音', description: 'sound, voice', examples: ['phone', 'symphony', 'microphone'] },
  { text: 'photo', meaning: '光', description: 'light', examples: ['photo', 'photograph', 'photosynthesis'] },
  { text: 'plic', meaning: '折叠，弯', description: 'fold, bend', examples: ['complicate', 'explicit', 'implicit'] },
  { text: 'ply', meaning: '折叠', description: 'fold', examples: ['apply', 'supply', 'reply', 'imply'] },
  { text: 'plore', meaning: '喊，哭', description: 'cry out', examples: ['explore', 'deplore', 'implore'] },
  { text: 'polis', meaning: '城市', description: 'city', examples: ['police', 'policy', 'metropolis'] },
  { text: 'polit', meaning: '城市，公民', description: 'city, citizen', examples: ['politics', 'polite', 'cosmopolitan'] },
  { text: 'port', meaning: '携带，搬运', description: 'carry', examples: ['port', 'export', 'import', 'transport', 'report'] },
  { text: 'pos', meaning: '放置', description: 'put, place', examples: ['position', 'oppose', 'propose', 'compose'] },
  { text: 'posit', meaning: '放置', description: 'put, place', examples: ['position', 'deposit', 'composite'] },
  { text: 'preci', meaning: '价格，价值', description: 'price, value', examples: ['precious', 'appreciate', 'depreciate'] },
  { text: 'prehend', meaning: '抓住', description: 'seize, grasp', examples: ['comprehend', 'apprehend', 'reprehend'] },
  { text: 'press', meaning: '压', description: 'press', examples: ['press', 'express', 'impress', 'depress'] },
  { text: 'prim', meaning: '第一，最初', description: 'first', examples: ['primary', 'prime', 'primitive', 'primer'] },
  { text: 'prin', meaning: '第一，主要', description: 'first, chief', examples: ['prince', 'principal', 'principle'] },
  { text: 'prior', meaning: '在先，优先', description: 'former, prior', examples: ['prior', 'priority'] },
  { text: 'priv', meaning: '个人，私有', description: 'private, separate', examples: ['private', 'privilege', 'deprive'] },
  { text: 'prob', meaning: '试验，证明', description: 'test, prove', examples: ['prove', 'probe', 'probable', 'proof'] },
  { text: 'prov', meaning: '试验，证明', description: 'test, prove', examples: ['prove', 'approve', 'probable'] },
  { text: 'pter', meaning: '翅，翼', description: 'wing, feather', examples: ['helicopter', 'pterodactyl'] },
  { text: 'pugn', meaning: '战斗', description: 'fight', examples: ['repugnant', 'pugnacious', 'impugn'] },
  { text: 'punct', meaning: '点，刺', description: 'point, prick', examples: ['punctual', 'puncture', 'punctuate'] },
  { text: 'pur', meaning: '纯净', description: 'pure', examples: ['pure', 'purify', 'purge'] },
  { text: 'put', meaning: '想，计算', description: 'think, reckon', examples: ['compute', 'reputation', 'dispute'] },
  { text: 'quer', meaning: '问，寻求', description: 'ask, seek', examples: ['query', 'querulous'] },
  { text: 'quest', meaning: '问，寻求', description: 'ask, seek', examples: ['question', 'request', 'conquest'] },
  { text: 'qui', meaning: '安静', description: 'quiet', examples: ['quiet', 'quit', 'tranquil'] },
  { text: 'quiet', meaning: '安静', description: 'quiet', examples: ['quiet', 'tranquil', 'acquiesce'] },
  { text: 'quit', meaning: '使自由，免除', description: 'free', examples: ['quit', 'acquit', 'requite'] },
  { text: 'quot', meaning: '数目', description: 'how many', examples: ['quota', 'quote', 'quotient'] },
  { text: 'radi', meaning: '光线，射线', description: 'ray', examples: ['radiate', 'radio', 'radius'] },
  { text: 'ram', meaning: '枝', description: 'branch', examples: ['ramify', 'ramification'] },
  { text: 'rat', meaning: '计算，推理', description: 'reckon', examples: ['ratio', 'rate', 'ration'] },
  { text: 'rect', meaning: '正，直', description: 'straight, right', examples: ['correct', 'direct', 'erect', 'rectangle'] },
  { text: 'rid', meaning: '笑', description: 'laugh', examples: ['ridiculous', 'deride'] },
  { text: 'ris', meaning: '笑', description: 'laugh', examples: ['risible', 'derision'] },
  { text: 'rog', meaning: '问，要求', description: 'ask', examples: ['arrogant', 'prerogative', 'interrogate'] },
  { text: 'rot', meaning: '轮，转', description: 'wheel, turn', examples: ['rotate', 'rotary', 'round'] },
  { text: 'rub', meaning: '红', description: 'red', examples: ['ruby', 'rubric', 'ruddy'] },
  { text: 'rud', meaning: '原始，粗糙', description: 'rough', examples: ['rude', 'erudite', 'rudiment'] },
  { text: 'rupt', meaning: '破，断裂', description: 'break', examples: ['interrupt', 'bankrupt', 'erupt', 'abrupt'] },
  { text: 'sacr', meaning: '神圣', description: 'sacred', examples: ['sacred', 'sacrifice', 'sacrilege'] },
  { text: 'sanct', meaning: '神圣', description: 'sacred', examples: ['sanctify', 'sanctuary', 'sanction'] },
  { text: 'sal', meaning: '盐，跳', description: 'salt, leap', examples: ['salary', 'salad'] },
  { text: 'salv', meaning: '救', description: 'save', examples: ['salvation', 'salvage', 'save'] },
  { text: 'sat', meaning: '满足，足够', description: 'enough', examples: ['satisfy', 'saturate', 'satire'] },
  { text: 'satis', meaning: '足够', description: 'enough', examples: ['satisfy', 'satisfaction', 'saturate'] },
  { text: 'scend', meaning: '爬，攀', description: 'climb', examples: ['ascend', 'descend', 'transcend'] },
  { text: 'sci', meaning: '知道', description: 'know', examples: ['science', 'conscious', 'conscience'] },
  { text: 'scrib', meaning: '写', description: 'write', examples: ['describe', 'prescribe', 'proscribe'] },
  { text: 'script', meaning: '写', description: 'write', examples: ['script', 'manuscript', 'postscript'] },
  { text: 'sec', meaning: '跟随', description: 'follow', examples: ['second', 'sequence'] },
  { text: 'sect', meaning: '切，割', description: 'cut', examples: ['section', 'insect', 'bisect'] },
  { text: 'sed', meaning: '坐', description: 'sit', examples: ['sedentary', 'sediment', 'preside'] },
  { text: 'sess', meaning: '坐', description: 'sit', examples: ['session', 'possess', 'assess'] },
  { text: 'seg', meaning: '切，割', description: 'cut', examples: ['segment', 'segregate'] },
  { text: 'sent', meaning: '感觉', description: 'feel', examples: ['sentiment', 'consent', 'dissent'] },
  { text: 'sens', meaning: '感觉', description: 'feel', examples: ['sense', 'sensitive', 'sensation'] },
  { text: 'seq', meaning: '跟随', description: 'follow', examples: ['sequence', 'sequel', 'consequence'] },
  { text: 'secut', meaning: '跟随', description: 'follow', examples: ['consecutive', 'persecute', 'prosecute'] },
  { text: 'serv', meaning: '保持，服务', description: 'keep, serve', examples: ['preserve', 'reserve', 'observe', 'serve'] },
  { text: 'sert', meaning: '放置，结合', description: 'join, put', examples: ['insert', 'assert', 'desert', 'exert'] },
  { text: 'sign', meaning: '标记，符号', description: 'mark, sign', examples: ['sign', 'signal', 'design', 'assign'] },
  { text: 'simil', meaning: '相似，相同', description: 'like', examples: ['similar', 'assimilate', 'simulate'] },
  { text: 'simul', meaning: '相似，同时', description: 'like, at the same time', examples: ['simulate', 'simultaneous'] },
  { text: 'sist', meaning: '站立', description: 'stand', examples: ['assist', 'insist', 'persist', 'resist', 'consist'] },
  { text: 'sol', meaning: '单独，太阳', description: 'alone, sun', examples: ['sole', 'solo', 'solitary', 'solar'] },
  { text: 'solv', meaning: '松，解', description: 'loosen', examples: ['solve', 'resolve', 'dissolve', 'solvent'] },
  { text: 'somn', meaning: '睡眠', description: 'sleep', examples: ['insomnia', 'somnambulist', 'somnolent'] },
  { text: 'son', meaning: '声音', description: 'sound', examples: ['sonic', 'supersonic', 'unison'] },
  { text: 'soph', meaning: '智慧', description: 'wise', examples: ['sophomore', 'philosophy', 'sophisticated'] },
  { text: 'spec', meaning: '看', description: 'look', examples: ['special', 'specific', 'specimen', 'spectacle'] },
  { text: 'spect', meaning: '看', description: 'look', examples: ['inspect', 'prospect', 'respect', 'suspect'] },
  { text: 'spi', meaning: '呼吸', description: 'breathe', examples: ['spirit', 'inspire', 'expire', 'conspire'] },
  { text: 'spir', meaning: '呼吸', description: 'breathe', examples: ['spirit', 'inspire', 'aspiration'] },
  { text: 'stab', meaning: '稳定', description: 'stand', examples: ['stable', 'establish', 'obstacle'] },
  { text: 'stat', meaning: '站立，建立', description: 'stand', examples: ['state', 'status', 'station', 'statue'] },
  { text: 'stan', meaning: '站立', description: 'stand', examples: ['stance', 'standard', 'substance'] },
  { text: 'stant', meaning: '站立', description: 'stand', examples: ['distant', 'constant', 'substantial'] },
  { text: 'stin', meaning: '站立', description: 'stand', examples: ['destine', 'obstinate', 'extinct'] },
  { text: 'stra', meaning: '绑，限制', description: 'bind', examples: ['strict', 'restrict', 'constrain'] },
  { text: 'strict', meaning: '绑，拉紧', description: 'bind, draw tight', examples: ['strict', 'restrict', 'district'] },
  { text: 'string', meaning: '绑，拉紧', description: 'bind, draw tight', examples: ['stringent', 'astringent', 'constringe'] },
  { text: 'stru', meaning: '堆积，建造', description: 'build', examples: ['structure', 'construct', 'destruct'] },
  { text: 'struct', meaning: '堆积，建造', description: 'build', examples: ['structure', 'construct', 'instruction'] },
  { text: 'sum', meaning: '总，拿', description: 'total, take', examples: ['summary', 'summit', 'assume', 'consume'] },
  { text: 'sumpt', meaning: '拿，买', description: 'take, buy', examples: ['consume', 'assume', 'presumption'] },
  { text: 'sur', meaning: '肯定，安全', description: 'sure, secure', examples: ['sure', 'assure', 'insure'] },
  { text: 'tact', meaning: '接触', description: 'touch', examples: ['tact', 'contact', 'intact', 'tactics'] },
  { text: 'tag', meaning: '接触', description: 'touch', examples: ['tag', 'contact', 'contagious'] },
  { text: 'tang', meaning: '接触', description: 'touch', examples: ['tangent', 'tangible', 'intangible'] },
  { text: 'tain', meaning: '保持，握持', description: 'hold, keep', examples: ['contain', 'maintain', 'obtain', 'sustain'] },
  { text: 'tec', meaning: '艺术，技术', description: 'art, skill', examples: ['technic', 'technical'] },
  { text: 'techn', meaning: '艺术，技术', description: 'art, skill', examples: ['technology', 'technique', 'technical'] },
  { text: 'teg', meaning: '覆盖', description: 'cover', examples: ['tegument', 'protect', 'detect'] },
  { text: 'tect', meaning: '覆盖', description: 'cover', examples: ['protect', 'detect', 'architect'] },
  { text: 'tele', meaning: '远', description: 'far', examples: ['telephone', 'television', 'telegraph', 'telescope'] },
  { text: 'temper', meaning: '节制，调和', description: 'moderate, mix', examples: ['temper', 'temperature', 'temperament'] },
  { text: 'tempor', meaning: '时间', description: 'time', examples: ['temporary', 'contemporary', 'temporal'] },
  { text: 'tempt', meaning: '尝试', description: 'try', examples: ['attempt', 'tempt', 'contempt'] },
  { text: 'tend', meaning: '伸展，倾向', description: 'stretch, aim', examples: ['extend', 'intend', 'attend', 'contend'] },
  { text: 'tens', meaning: '伸展', description: 'stretch', examples: ['tension', 'intense', 'tent'] },
  { text: 'tent', meaning: '伸展', description: 'stretch', examples: ['tent', 'tentative', 'tensity'] },
  { text: 'tenu', meaning: '薄，细', description: 'thin', examples: ['tenuous', 'attenuate', 'extenuate'] },
  { text: 'term', meaning: '界限，末端', description: 'end, limit', examples: ['term', 'terminal', 'determine'] },
  { text: 'terr', meaning: '土地，恐吓', description: 'earth, frighten', examples: ['territory', 'terrain', 'terror'] },
  { text: 'test', meaning: '证明，见证', description: 'witness', examples: ['test', 'testify', 'attest', 'contest'] },
  { text: 'the', meaning: '神', description: 'god', examples: ['theology', 'atheist', 'monotheism'] },
  { text: 'theo', meaning: '神', description: 'god', examples: ['theology', 'theocracy', 'monotheism'] },
  { text: 'therm', meaning: '热', description: 'heat', examples: ['thermometer', 'thermal', 'thermos'] },
  { text: 'thes', meaning: '放置', description: 'place, put', examples: ['thesis', 'synthesis', 'hypothesis'] },
  { text: 'tim', meaning: '恐惧', description: 'fear', examples: ['timid', 'intimidate', 'timorous'] },
  { text: 'tir', meaning: '拉，引', description: 'draw, pull', examples: ['entire', 'retire', 'tiresome'] },
  { text: 'tom', meaning: '切', description: 'cut', examples: ['atom', 'anatomy', 'epitome', 'tome'] },
  { text: 'tor', meaning: '扭，转', description: 'twist', examples: ['torment', 'torture', 'distort'] },
  { text: 'tort', meaning: '扭，转', description: 'twist', examples: ['torture', 'distort', 'extort', 'contort'] },
  { text: 'tour', meaning: '转，巡回', description: 'turn', examples: ['tour', 'tourist', 'contour', 'detour'] },
  { text: 'tract', meaning: '拉，拖，抽', description: 'draw, pull', examples: ['attract', 'contract', 'extract', 'tractor'] },
  { text: 'tribut', meaning: '给予', description: 'assign, give', examples: ['contribute', 'attribute', 'distribute'] },
  { text: 'trud', meaning: '推，冲', description: 'push, thrust', examples: ['intrude', 'extrude', 'protrude'] },
  { text: 'trus', meaning: '推，冲', description: 'push, thrust', examples: ['abstruse', 'obtrusive'] },
  { text: 'turb', meaning: '扰乱，转动', description: 'disturb, stir', examples: ['disturb', 'turbulent', 'turbine'] },
  { text: 'twine', meaning: '编织，扭', description: 'twist, weave', examples: ['twine', 'entwine', 'intertwine'] },
  { text: 'typ', meaning: '模式，印记', description: 'type, model', examples: ['type', 'typical', 'prototype'] },
  { text: 'ultim', meaning: '最后', description: 'last', examples: ['ultimate', 'ultimatum', 'penultimate'] },
  { text: 'ultra', meaning: '超过', description: 'beyond', examples: ['ultraviolet', 'ultrasonic', 'ultramodern'] },
  { text: 'umbr', meaning: '阴影', description: 'shade, shadow', examples: ['umbrella', 'umbrage', 'adumbrate'] },
  { text: 'unci', meaning: '钩', description: 'hook', examples: ['unciform'] },
  { text: 'und', meaning: '波浪，流动', description: 'wave, flow', examples: ['abundant', 'redundant', 'undulate'] },
  { text: 'uni', meaning: '一，单一', description: 'one', examples: ['unite', 'union', 'unique', 'uniform'] },
  { text: 'up', meaning: '向上', description: 'up', examples: ['up', 'upward', 'uplift', 'upset'] },
  { text: 'urb', meaning: '城市', description: 'city', examples: ['urban', 'suburb', 'urbane'] },
  { text: 'us', meaning: '使用', description: 'use', examples: ['use', 'usual', 'abuse', 'usage'] },
  { text: 'ut', meaning: '使用', description: 'use', examples: ['utensil', 'utilize', 'utility'] },
  { text: 'util', meaning: '使用', description: 'use', examples: ['utility', 'utilize', 'utensil'] },
  { text: 'vac', meaning: '空', description: 'empty', examples: ['vacant', 'vacation', 'evacuate', 'vacuum'] },
  { text: 'vacu', meaning: '空', description: 'empty', examples: ['vacuum', 'vacuous', 'evacuate'] },
  { text: 'vad', meaning: '走，去', description: 'go', examples: ['invade', 'evade', 'pervade'] },
  { text: 'vas', meaning: '走，去', description: 'go', examples: ['evasive', 'invasive', 'pervasion'] },
  { text: 'vag', meaning: '漫游', description: 'wander', examples: ['vague', 'vagrant', 'vagabond', 'extravagant'] },
  { text: 'vail', meaning: '价值，力量', description: 'worth, be strong', examples: ['available', 'prevail', 'equivalent'] },
  { text: 'val', meaning: '价值，力量', description: 'worth, be strong', examples: ['value', 'valid', 'valiant', 'equivalent'] },
  { text: 'valu', meaning: '价值', description: 'worth', examples: ['value', 'evaluate', 'invaluable'] },
  { text: 'van', meaning: '空，前', description: 'empty, before', examples: ['vanity', 'vanish', 'evanescent', 'vanguard'] },
  { text: 'vari', meaning: '变化', description: 'vary, change', examples: ['various', 'variable', 'variety', 'vary'] },
  { text: 've', meaning: '来，走', description: 'come, go', examples: ['convene', 'intervene', 'prevent'] },
  { text: 'veh', meaning: '携带', description: 'carry', examples: ['vehicle', 'vehement', 'convex'] },
  { text: 'vel', meaning: '掩盖，飞', description: 'cover, veil', examples: ['veil', 'reveal', 'velvet'] },
  { text: 'ven', meaning: '来', description: 'come', examples: ['convene', 'intervene', 'prevent', 'avenue'] },
  { text: 'vent', meaning: '来', description: 'come', examples: ['advent', 'convention', 'prevent', 'inventory'] },
  { text: 'ver', meaning: '真实，转', description: 'true, turn', examples: ['verify', 'very', 'convert', 'universe'] },
  { text: 'verb', meaning: '词语', description: 'word', examples: ['verb', 'verbal', 'adverb', 'proverb'] },
  { text: 'veri', meaning: '真实', description: 'true', examples: ['verify', 'verity', 'verily'] },
  { text: 'vers', meaning: '转', description: 'turn', examples: ['universe', 'reverse', 'diverse', 'version'] },
  { text: 'vert', meaning: '转', description: 'turn', examples: ['convert', 'invert', 'divert', 'advertise'] },
  { text: 'vi', meaning: '路，生命', description: 'way, life', examples: ['viable', 'vivid', 'vital', 'convivial'] },
  { text: 'vic', meaning: '改变，代理', description: 'change, substitute', examples: ['vicar', 'vicarious', 'vicinity'] },
  { text: 'vict', meaning: '征服', description: 'conquer', examples: ['victor', 'victory', 'convict', 'evict'] },
  { text: 'vig', meaning: '生命，活力', description: 'life, lively', examples: ['vigor', 'vigilant', 'invigorate'] },
  { text: 'vil', meaning: '卑鄙， cheap', description: 'cheap, base', examples: ['vile', 'vilify', 'revile'] },
  { text: 'vin', meaning: '征服', description: 'conquer', examples: ['convince', 'evince', 'invincible'] },
  { text: 'vis', meaning: '看', description: 'see', examples: ['visible', 'vision', 'visit', 'advise'] },
  { text: 'vid', meaning: '看', description: 'see', examples: ['video', 'evident', 'provide', 'divide'] },
  { text: 'viv', meaning: '生命', description: 'life', examples: ['vivid', 'survive', 'revive', 'vivacious'] },
  { text: 'voc', meaning: '声音，叫喊', description: 'voice, call', examples: ['vocal', 'advocate', 'vocation', 'evoke'] },
  { text: 'vok', meaning: '声音，叫喊', description: 'voice, call', examples: ['invoke', 'provoke', 'revoke'] },
  { text: 'vol', meaning: '意志，意愿', description: 'will', examples: ['volunteer', 'voluntary', 'benevolent'] },
  { text: 'volv', meaning: '滚，转', description: 'roll, turn', examples: ['involve', 'revolve', 'evolve', 'volume'] },
  { text: 'volut', meaning: '滚，转', description: 'roll, turn', examples: ['revolution', 'convoluted', 'evolution'] },
  { text: 'vor', meaning: '吃', description: 'eat', examples: ['carnivore', 'herbivore', 'devour'] },
  { text: 'vour', meaning: '吃', description: 'eat', examples: ['devour', 'savour', 'tumour'] },
  { text: 'vow', meaning: '发誓', description: 'vow', examples: ['vow', 'avow'] },
  { text: 'vul', meaning: '普通，群众', description: 'common people', examples: ['vulgar', 'divulge', 'vulnerable'] },
  { text: 'vulg', meaning: '普通，群众', description: 'common people', examples: ['vulgar', 'divulge', 'promulgate'] }
];

// 仅提取文本用于匹配
const COMMON_PREFIXES = PREFIXES_DATA.map(p => p.text);
const COMMON_SUFFIXES = SUFFIXES_DATA.map(s => s.text);
const COMMON_ROOTS = ROOTS_DATA.map(r => r.text);

/** 单词成分类型 */
export interface WordComponent {
  text: string;
  type: 'root' | 'prefix' | 'suffix' | 'subword' | 'whole';
  /** 释义数据 */
  data?: AffixData;
}

/**
 * 解析单词成分
 * 将单词分解为前缀、词根、后缀和子单词
 * @param word 要解析的单词
 * @returns 单词成分数组
 */
export function analyzeWord(word: string): WordComponent[] {
  if (!word || word.length < 2) {
    return [{ text: word, type: 'whole' }];
  }

  // 清理单词中的空白字符（换行、回车、空格等），防止脏数据影响解析和显示
  const cleanedWord = word.replace(/\s+/g, '');
  const lowerWord = cleanedWord.toLowerCase();
  const components: WordComponent[] = [];

  let remaining = lowerWord;
  let originalIndex = 0;

  // 1. 检测前缀（按长度降序匹配，优先匹配长的）
  const sortedPrefixes = [...PREFIXES_DATA].sort((a, b) => b.text.length - a.text.length);
  for (const prefixData of sortedPrefixes) {
    const prefix = prefixData.text;
    if (remaining.startsWith(prefix) && remaining.length > prefix.length + 1) {
      components.push({
        text: cleanedWord.slice(originalIndex, originalIndex + prefix.length),
        type: 'prefix',
        data: prefixData
      });
      remaining = remaining.slice(prefix.length);
      originalIndex += prefix.length;
      break;
    }
  }

  // 2. 检测后缀
  let suffixText = '';
  let suffixData: AffixData | undefined;
  let suffixStartInRemaining = remaining.length;
  const sortedSuffixes = [...SUFFIXES_DATA].sort((a, b) => b.text.length - a.text.length);

  for (const suffixItem of sortedSuffixes) {
    const suffix = suffixItem.text;
    if (remaining.endsWith(suffix) && remaining.length > suffix.length + 1) {
      suffixText = suffix;
      suffixData = suffixItem;
      suffixStartInRemaining = remaining.length - suffix.length;
      break;
    }
  }

  // 3. 提取中间部分（可能是词根+子单词的组合）
  const middlePart = remaining.slice(0, suffixStartInRemaining);

  if (middlePart.length > 0) {
    // 尝试在中间部分找到词根
    let rootFound = false;
    const sortedRoots = [...ROOTS_DATA].sort((a, b) => b.text.length - a.text.length);

    for (const rootData of sortedRoots) {
      const root = rootData.text;
      const rootIndex = middlePart.indexOf(root);
      if (rootIndex !== -1 && root.length >= 2) {
        // 词根前的子单词
        if (rootIndex > 0) {
          components.push({
            text: cleanedWord.slice(originalIndex, originalIndex + rootIndex),
            type: 'subword'
          });
        }

        // 词根本身
        components.push({
          text: cleanedWord.slice(originalIndex + rootIndex, originalIndex + rootIndex + root.length),
          type: 'root',
          data: rootData
        });

        // 词根后的子单词
        if (rootIndex + root.length < middlePart.length) {
          components.push({
            text: cleanedWord.slice(originalIndex + rootIndex + root.length, originalIndex + suffixStartInRemaining),
            type: 'subword'
          });
        }

        rootFound = true;
        break;
      }
    }

    // 如果没有找到词根，整个中间部分作为子单词
    if (!rootFound) {
      components.push({
        text: cleanedWord.slice(originalIndex, originalIndex + suffixStartInRemaining),
        type: 'subword'
      });
    }
  }

  // 4. 添加后缀
  if (suffixText && suffixData) {
    components.push({
      text: cleanedWord.slice(originalIndex + suffixStartInRemaining),
      type: 'suffix',
      data: suffixData
    });
  }

  // 如果没有任何成分被识别，返回整个单词
  if (components.length === 0) {
    return [{ text: cleanedWord, type: 'whole' }];
  }

  return components;
}

/**
 * 获取单词组件的 CSS 类名
 * @param type 组件类型
 * @returns CSS 类名
 */
export function getComponentClass(type: WordComponent['type']): string {
  const classMap: Record<WordComponent['type'], string> = {
    root: 'word-root',
    prefix: 'word-prefix',
    suffix: 'word-suffix',
    subword: 'word-subword',
    whole: 'word-whole'
  };
  return classMap[type];
}

/**
 * 获取单词组件的中文描述
 * @param type 组件类型
 * @returns 中文描述
 */
export function getComponentLabel(type: WordComponent['type']): string {
  const labelMap: Record<WordComponent['type'], string> = {
    root: '词根',
    prefix: '前缀',
    suffix: '后缀',
    subword: '子单词',
    whole: '完整单词'
  };
  return labelMap[type];
}

/**
 * 生成详细的词根词缀提示信息
 * @param components 单词成分数组
 * @returns 格式化的提示文本
 */
export function generateDetailedTooltip(components: WordComponent[]): string {
  if (components.length <= 1) return '';

  const lines: string[] = [];

  for (const comp of components) {
    if (comp.type === 'whole' || comp.type === 'subword') continue;

    const label = getComponentLabel(comp.type);
    const text = comp.text.toLowerCase();

    if (comp.data) {
      // 有详细数据
      const meaning = comp.data.meaning;
      const desc = comp.data.description ? `(${comp.data.description})` : '';
      const examples = comp.data.examples ? `例: ${comp.data.examples.slice(0, 3).join(', ')}` : '';

      lines.push(`${label}「${text}」: ${meaning} ${desc}`);
      if (examples) {
        lines.push(`  ${examples}`);
      }
    } else {
      // 无详细数据，只显示类型
      lines.push(`${label}「${text}」`);
    }
  }

  return lines.join('\n');
}

/**
 * 生成简洁的词根词缀提示信息
 * @param components 单词成分数组
 * @returns 格式化的提示文本
 */
export function generateSimpleTooltip(components: WordComponent[]): string {
  if (components.length <= 1) return '';

  const parts = components
      .filter(c => c.type !== 'whole' && c.type !== 'subword' && c.data)
      .map(c => `${c.text}: ${c.data?.meaning}`);

  return parts.join(' | ');
}
