/**
 * 通用知识包服务
 * 参考 wordbank-service.ts 结构，从 public/knowledgebanks/ 加载 JSON 并做 localStorage 缓存。
 */

import type {KnowledgePack, KnowledgePackCategory, KnowledgePackInfo} from '@/types/knowledge-memory';

// 本地知识包文件路径（适配 base: './' 配置）
const LOCAL_KNOWLEDGEBANK_PATH = import.meta.env.BASE_URL + 'knowledgebanks/';

// 缓存配置
const CACHE_KEY_PREFIX = 'slowlyrecord-knowledgebank-';
const CACHE_EXPIRY = 7 * 24 * 60 * 60 * 1000; // 7天
const MIN_PACK_SIZE = 1; // 最小有效条目数

// 并发加载同包去重：相同 id 的 in-flight Promise 共享
const inFlight = new Map<string, Promise<KnowledgePack>>();

export interface LoadStrategy {
    priority: 'local';      // 仅支持本地文件
    useCache: boolean;      // 是否使用缓存
    timeout: number;        // 超时时间(ms)
}

export const DEFAULT_STRATEGY: LoadStrategy = {
    priority: 'local',
    useCache: true,
    timeout: 5000,
};

// 内置知识包元数据（与 public/knowledgebanks/*.json 对应）
// category: math 为数理化（数学/物理/化学/生物等），text 为文史常识，geo 为地理；展示层再按 peg/math/text/geo 四个 tab 过滤
export const KNOWLEDGE_PACK_LIST: KnowledgePackInfo[] = [
    {id: 'multiplication-9x9', name: '小九九乘法表', description: '1×1 到 9×9 的乘法口诀', itemCount: 81, ordered: false, usableAsPeg: false, category: 'math', version: 2},
    {id: 'multiplication-19x19', name: '大九九乘法表', description: '1×1 到 19×19 的乘法口诀', itemCount: 100, ordered: false, usableAsPeg: false, category: 'math', version: 2},
    {id: 'elements', name: '元素周期表', description: '元素周期表 118 号元素（氢到鿫）：符号、中文名、序数、拼音与类别，附经典记忆口诀', itemCount: 137, ordered: false, usableAsPeg: false, category: 'math', version: 5},
    {id: 'solar-terms-24', name: '二十四节气', description: '二十四节气及其日期与物候，顺序本身是考点', itemCount: 24, ordered: true, usableAsPeg: true, category: 'text', version: 3},
    {id: 'zodiac-12', name: '十二生肖', description: '十二生肖及其对应地支，顺序本身是考点', itemCount: 12, ordered: true, usableAsPeg: true, category: 'text', version: 3},
    {id: 'number-pegs-12', name: '数字桩（1-12）', description: '经典数字形象桩，1-6 号位提供多个备选桩', itemCount: 12, ordered: true, usableAsPeg: true, category: 'text', version: 2},
    {id: 'home-route-12', name: '家居路线桩（12 桩）', description: '按进门后的巡视路线排列的家居地点桩', itemCount: 12, ordered: true, usableAsPeg: true, category: 'text', version: 2},
    {id: 'constellations-12', name: '十二星座', description: '十二星座及其日期范围，顺序本身是考点，按日期顺序可作 12 桩', itemCount: 12, ordered: true, usableAsPeg: true, category: 'text', version: 2},
    {id: 'ethnic-groups-56', name: '五十六个民族', description: '中国 56 个民族名称', itemCount: 56, ordered: false, usableAsPeg: false, category: 'text'},
    {id: 'cuisines-8', name: '八大菜系', description: '中国八大菜系及其代表特点', itemCount: 8, ordered: false, usableAsPeg: false, category: 'text'},
    {id: 'provinces-capitals', name: '中国省级行政区及省会', description: '34 个省级行政区及其省会、首府或政府驻地', itemCount: 34, ordered: false, usableAsPeg: false, category: 'geo'},
    {id: 'math-formulas', name: '常用数学公式', description: '小学到高中入门常用数学公式与函数', itemCount: 33, ordered: false, usableAsPeg: false, category: 'math', version: 5},
    {id: 'math-calculus', name: '高等数学·微积分基础', description: '极限、导数、微分、积分与级数入门 15 条', itemCount: 15, ordered: false, usableAsPeg: false, category: 'math', version: 2},
    {id: 'math-linalg', name: '高等数学·线性代数基础', description: '矩阵、行列式、向量与特征值入门 14 条', itemCount: 14, ordered: false, usableAsPeg: false, category: 'math', version: 2},
    {id: 'math-probability', name: '高等数学·概率统计基础', description: '排列组合、概率公式与常见分布入门 15 条', itemCount: 15, ordered: false, usableAsPeg: false, category: 'math', version: 2},
    {id: 'chemistry-formulas', name: '常用化学公式', description: '初中化学常见方程式与计算式 22 条', itemCount: 22, ordered: false, usableAsPeg: false, category: 'math', version: 2},
    {id: 'physics-formulas', name: '初中物理公式', description: '初中物理常用公式 21 条', itemCount: 21, ordered: false, usableAsPeg: false, category: 'math', version: 2},
    {id: 'physics-laws', name: '初中物理定律与原理', description: '初中物理常见定律与原理 15 条', itemCount: 15, ordered: false, usableAsPeg: false, category: 'math', version: 2},
    {id: 'physics-experiments', name: '初中物理实验', description: '初中常见物理实验 15 个', itemCount: 15, ordered: false, usableAsPeg: false, category: 'math', version: 2},
    {id: 'biology-experiments', name: '初中生物实验', description: '初中常见生物实验 15 个', itemCount: 15, ordered: false, usableAsPeg: false, category: 'math', version: 2},
    {id: 'geography-concepts', name: '初中地理核心概念', description: '初中地理核心概念 41 条', itemCount: 41, ordered: false, usableAsPeg: false, category: 'geo', version: 2},
    {id: 'body-pegs-12', name: '身体桩', description: '从头顶到脚底 12 个身体部位，按从上到下的固定顺序用作记忆桩', itemCount: 12, ordered: true, usableAsPeg: true, category: 'text', version: 1},
    {id: 'earthly-branches-12', name: '十二地支', description: '十二地支及其时辰时段、生肖、五行、阴阳与方位', itemCount: 12, ordered: true, usableAsPeg: true, category: 'text', version: 1},
    {id: 'room-pegs-12', name: '房间桩', description: '典型户型 12 个房间，按进出动线排列用作记忆桩', itemCount: 12, ordered: true, usableAsPeg: true, category: 'text', version: 1},
    {id: 'dynasties-china', name: '中国历代王朝', description: '从夏到清 18 个主要朝代，含起止年份、都城与创立者', itemCount: 18, ordered: true, usableAsPeg: true, category: 'text', version: 2},
    {id: 'common-units', name: '常用计量单位', description: '物理量的国际单位与常见单位换算', itemCount: 35, ordered: false, usableAsPeg: false, category: 'math', version: 2},
    {id: 'colors-12', name: '十二种颜色', description: '12 种常见颜色的色值与英文名称', itemCount: 12, ordered: false, usableAsPeg: false, category: 'text', version: 1},
    {id: 'musical-notes', name: '十二平均律', description: 'C 大调 12 个半音的音名、十二律中文名、音阶位置与 A4 基准频率', itemCount: 12, ordered: true, usableAsPeg: true, category: 'text', version: 1},
    {id: 'math-formulas-2', name: '常用数学公式（进阶篇）', description: '高中与竞赛方向的数列、几何、圆锥曲线、微积分与概率公式', itemCount: 28, ordered: false, usableAsPeg: false, category: 'math', version: 1},
    {id: 'squares-cubes-powers', name: '平方立方与幂次', description: '1-25 平方、1-10 立方、2 的 1-16 次幂与 10 的 6-12 次幂（含中文数位）', itemCount: 58, ordered: false, usableAsPeg: false, category: 'math', version: 1},
    {id: 'primes-under-100', name: '100 以内质数表', description: '100 以内 25 个质数及其序位，顺序本身是考点', itemCount: 25, ordered: true, usableAsPeg: false, category: 'math', version: 1},
    {id: 'poker-pegs-52', name: '扑克牌桩（52 张）', description: '一副扑克 52 张牌的花色点数桩（黑桃/红桃/方块/梅花），按花色顺序用作记忆宫殿桩位', itemCount: 52, ordered: true, usableAsPeg: true, category: 'text', version: 1},
    {id: 'alphabet-pegs-26', name: '字母形象桩（A-Z）', description: 'A-Z 26 个字母的英文首词形象桩，按字母序用作记忆宫殿桩位', itemCount: 26, ordered: true, usableAsPeg: true, category: 'text', version: 1},
    {id: 'thirty-six-stratagems', name: '三十六计', description: '三十六计全目，按六套（胜战/敌战/攻战/混战/并战/败战）顺序排列，顺序本身是考点', itemCount: 36, ordered: true, usableAsPeg: false, category: 'text', version: 1},
    {id: 'world-capitals-40', name: '世界国家与首都', description: '六大洲 100 个常见国家及其首都（南非为行政首都比勒陀利亚，玻利维亚为法定首都苏克雷，坦桑尼亚为法定首都多多马）', itemCount: 100, ordered: false, usableAsPeg: false, category: 'geo', version: 2},
    {id: 'physics-formulas-high', name: '高中物理公式', description: '高中物理必修主干公式 28 条（直线运动、力学、电磁学）', itemCount: 28, ordered: false, usableAsPeg: false, category: 'math', version: 1},
    {id: 'chemistry-valences', name: '常见元素化合价', description: '常见元素与原子团化合价 28 条，含化合价口诀', itemCount: 28, ordered: false, usableAsPeg: false, category: 'math', version: 1},
    {id: 'history-mnemonics', name: '历史朝代口诀', description: '朝代歌与战国七雄、五代十国等历史速记口诀 10 条', itemCount: 10, ordered: false, usableAsPeg: false, category: 'text', version: 1},
    {id: 'english-roots-affixes', name: '英语常用词根词缀', description: '高频词根 14 个、前缀 9 个、后缀 7 个，附例词', itemCount: 30, ordered: false, usableAsPeg: false, category: 'text', version: 1},
    {id: 'chinese-classical-words', name: '文言文常见实词虚词', description: '中考高频文言虚词 8 个 + 古今异义实词 12 个', itemCount: 20, ordered: false, usableAsPeg: false, category: 'text', version: 1},
    {id: 'biology-basics', name: '初中生物核心概念', description: '初中生物核心概念 20 条（细胞、生理、遗传、生态）', itemCount: 20, ordered: false, usableAsPeg: false, category: 'math', version: 1},
    {id: 'world-geography-records', name: '世界地理之最', description: '世界地理之最 20 条（山川、河湖、海陆、人文）', itemCount: 20, ordered: false, usableAsPeg: false, category: 'geo', version: 1},
    {id: 'geography-china', name: '中国地理常识', description: '中国地理常识 30 条（地形、山脉、河湖、海洋岛屿、气候与地理分界）', itemCount: 30, ordered: false, usableAsPeg: false, category: 'geo', version: 1},
    // ==================== 小容量桩库（2-11 桩）：按记忆条数选桩，12 桩见上方生肖/地支/身体桩等 ====================
    {id: 'yin-yang-2', name: '阴阳两仪（2 桩）', description: '太极生两仪：阴与阳，最基础的两元对立', itemCount: 2, ordered: true, usableAsPeg: true, category: 'text', version: 1},
    {id: 'tian-di-2', name: '天地（2 桩）', description: '天与地，上下两极的天然顺序', itemCount: 2, ordered: true, usableAsPeg: true, category: 'text', version: 1},
    {id: 'day-night-2', name: '昼夜（2 桩）', description: '昼与夜，一日的时间两段', itemCount: 2, ordered: true, usableAsPeg: true, category: 'text', version: 1},
    {id: 'left-right-2', name: '左右（2 桩）', description: '左与右，以自身为参照的方位对', itemCount: 2, ordered: true, usableAsPeg: true, category: 'text', version: 1},
    {id: 'up-down-2', name: '上下（2 桩）', description: '上与下，垂直方向的天然顺序', itemCount: 2, ordered: true, usableAsPeg: true, category: 'text', version: 1},
    {id: 'san-cai-3', name: '三才（3 桩）', description: '天、地、人三才，《易经》宇宙观的三个层次', itemCount: 3, ordered: true, usableAsPeg: true, category: 'text', version: 1},
    {id: 'san-guang-3', name: '三光（3 桩）', description: '日、月、星三光，天空三种光源', itemCount: 3, ordered: true, usableAsPeg: true, category: 'text', version: 1},
    {id: 'three-tenses-3', name: '三时（3 桩）', description: '过去、现在、未来，时间的三段', itemCount: 3, ordered: true, usableAsPeg: true, category: 'text', version: 1},
    {id: 'three-primary-colors-3', name: '三原色（3 桩）', description: '颜料三原色：红、黄、蓝，可调出万色', itemCount: 3, ordered: true, usableAsPeg: true, category: 'text', version: 1},
    {id: 'meng-zhong-ji-3', name: '孟仲季（3 桩）', description: '兄弟排行或季度三个月的次序：孟、仲、季', itemCount: 3, ordered: true, usableAsPeg: true, category: 'text', version: 1},
    {id: 'four-seasons-4', name: '四季（4 桩）', description: '春、夏、秋、冬，一年的四个季节', itemCount: 4, ordered: true, usableAsPeg: true, category: 'text', version: 1},
    {id: 'four-directions-4', name: '四方（4 桩）', description: '东、南、西、北四方，按顺时针排列', itemCount: 4, ordered: true, usableAsPeg: true, category: 'text', version: 1},
    {id: 'four-symbols-4', name: '四象神兽（4 桩）', description: '青龙、白虎、朱雀、玄武，分镇东南西北', itemCount: 4, ordered: true, usableAsPeg: true, category: 'text', version: 1},
    {id: 'four-gentlemen-4', name: '四君子（4 桩）', description: '梅、兰、竹、菊，花中四君子', itemCount: 4, ordered: true, usableAsPeg: true, category: 'text', version: 1},
    {id: 'four-arts-4', name: '琴棋书画（4 桩）', description: '古代文人四艺：琴、棋、书、画', itemCount: 4, ordered: true, usableAsPeg: true, category: 'text', version: 1},
    {id: 'four-elements-4', name: '四大元素（4 桩）', description: '地、水、火、风，古印度与古希腊共通的四元素说', itemCount: 4, ordered: true, usableAsPeg: true, category: 'text', version: 1},
    {id: 'wuxing-5', name: '五行（5 桩）', description: '金、木、水、火、土五行，相生相克的万物归类', itemCount: 5, ordered: true, usableAsPeg: true, category: 'text', version: 1},
    {id: 'five-directions-5', name: '五方（5 桩）', description: '东、南、西、北、中五方', itemCount: 5, ordered: true, usableAsPeg: true, category: 'text', version: 1},
    {id: 'five-colors-5', name: '五色（5 桩）', description: '青、赤、黄、白、黑五正色', itemCount: 5, ordered: true, usableAsPeg: true, category: 'text', version: 1},
    {id: 'five-flavors-5', name: '五味（5 桩）', description: '酸、甜、苦、辣、咸五味', itemCount: 5, ordered: true, usableAsPeg: true, category: 'text', version: 1},
    {id: 'five-virtues-5', name: '五常（5 桩）', description: '仁、义、礼、智、信，儒家五种常德', itemCount: 5, ordered: true, usableAsPeg: true, category: 'text', version: 1},
    {id: 'five-tones-5', name: '五音（5 桩）', description: '宫、商、角、徵、羽，古代五声音阶', itemCount: 5, ordered: true, usableAsPeg: true, category: 'text', version: 1},
    {id: 'six-arts-6', name: '六艺（6 桩）', description: '礼、乐、射、御、书、数，周代贵族教育六门功课', itemCount: 6, ordered: true, usableAsPeg: true, category: 'text', version: 1},
    {id: 'liu-shu-6', name: '六书（6 桩）', description: '象形、指事、会意、形声、转注、假借，汉字造字用字六法', itemCount: 6, ordered: true, usableAsPeg: true, category: 'text', version: 1},
    {id: 'six-roots-6', name: '六根（6 桩）', description: '眼、耳、鼻、舌、身、意，佛教所说六种感知根器', itemCount: 6, ordered: true, usableAsPeg: true, category: 'text', version: 1},
    {id: 'liu-he-6', name: '六合（6 桩）', description: '天地四方：上（天）、下（地）、东、南、西、北，整个空间', itemCount: 6, ordered: true, usableAsPeg: true, category: 'text', version: 1},
    {id: 'six-fu-6', name: '六腑（6 桩）', description: '胆、胃、小肠、大肠、膀胱、三焦，中医传化之腑', itemCount: 6, ordered: true, usableAsPeg: true, category: 'text', version: 1},
    {id: 'liu-lv-6', name: '六律（6 桩）', description: '黄钟、太簇、姑洗、蕤宾、夷则、无射，古代十二律中的六个阳律', itemCount: 6, ordered: true, usableAsPeg: true, category: 'text', version: 1},
    {id: 'qi-yao-7', name: '七曜（7 桩）', description: '日、月、火、水、木、金、土七曜，古代星期制度的来源', itemCount: 7, ordered: true, usableAsPeg: true, category: 'text', version: 1},
    {id: 'big-dipper-7', name: '北斗七星（7 桩）', description: '天枢到天权为斗魁，玉衡到摇光为斗柄，附星名别名', itemCount: 7, ordered: true, usableAsPeg: true, category: 'text', version: 1},
    {id: 'rainbow-7', name: '七彩（7 桩）', description: '红、橙、黄、绿、青、蓝、紫，彩虹七色由外到内', itemCount: 7, ordered: true, usableAsPeg: true, category: 'text', version: 1},
    {id: 'jianpu-7', name: '简谱七音（7 桩）', description: 'do、re、mi、fa、sol、la、si，对应简谱 1-7', itemCount: 7, ordered: true, usableAsPeg: true, category: 'text', version: 1},
    {id: 'seven-emotions-7', name: '七情（7 桩）', description: '喜、怒、忧、思、悲、恐、惊，中医所说七种情志', itemCount: 7, ordered: true, usableAsPeg: true, category: 'text', version: 1},
    {id: 'bagua-8', name: '八卦（8 桩）', description: '乾兑离震巽坎艮坤，按先天八卦序（乾一兑二离三震四巽五坎六艮七坤八）', itemCount: 8, ordered: true, usableAsPeg: true, category: 'text', version: 1},
    {id: 'eight-immortals-8', name: '八仙（8 桩）', description: '铁拐李到曹国舅，各执法器，八仙过海各显神通', itemCount: 8, ordered: true, usableAsPeg: true, category: 'text', version: 1},
    {id: 'eight-directions-8', name: '八方（8 桩）', description: '四方加四隅：东、东南、南、西南、西、西北、北、东北，按顺时针排列', itemCount: 8, ordered: true, usableAsPeg: true, category: 'text', version: 1},
    {id: 'eight-solar-nodes-8', name: '八节（8 桩）', description: '立春、春分、立夏、夏至、立秋、秋分、立冬、冬至，二十四节气中最重要的八个节点', itemCount: 8, ordered: true, usableAsPeg: true, category: 'text', version: 1},
    {id: 'ba-yin-8', name: '八音（8 桩）', description: '金、石、丝、竹、匏、土、革、木，周代按材质的乐器分类', itemCount: 8, ordered: true, usableAsPeg: true, category: 'text', version: 1},
    {id: 'nine-planets-9', name: '九大行星（9 桩）', description: '按距日由近及远：水金地火木土天海冥（冥王星 2006 年降级为矮行星，此序仍是经典记忆口诀）', itemCount: 9, ordered: true, usableAsPeg: true, category: 'text', version: 1},
    {id: 'nine-zhou-9', name: '禹贡九州（9 桩）', description: '冀、兖、青、徐、扬、荆、豫、梁、雍，《尚书·禹贡》大禹治水所划九州', itemCount: 9, ordered: true, usableAsPeg: true, category: 'text', version: 1},
    {id: 'luo-shu-9', name: '洛书九宫（9 桩）', description: '戴九履一、左三右七、二四为肩、六八为足、五居中央，按宫位数字 1-9 排列', itemCount: 9, ordered: true, usableAsPeg: true, category: 'text', version: 1},
    {id: 'nine-stars-9', name: '北斗九星（9 桩）', description: '北斗七星加左辅、右弼两颗隐星，合称九星', itemCount: 9, ordered: true, usableAsPeg: true, category: 'text', version: 1},
    {id: 'nine-heavens-9', name: '九天（9 桩）', description: '《吕氏春秋》所载九天：中央钧天，四正四隅各一天', itemCount: 9, ordered: true, usableAsPeg: true, category: 'text', version: 1},
    {id: 'heavenly-stems-10', name: '十天干（10 桩）', description: '甲乙丙丁戊己庚辛壬癸，与十二地支相配纪年纪日', itemCount: 10, ordered: true, usableAsPeg: true, category: 'text', version: 1},
    {id: 'ten-directions-10', name: '十方（10 桩）', description: '佛教十方世界：四方、四隅加上下（东、南、西、北、东南、西南、西北、东北、上、下）', itemCount: 10, ordered: true, usableAsPeg: true, category: 'text', version: 1},
    {id: 'ten-fingers-10', name: '双手十指（10 桩）', description: '左手拇食中无小、右手拇食中无小，随身可用的天然身体桩', itemCount: 10, ordered: true, usableAsPeg: true, category: 'text', version: 1},
    {id: 'ten-marshals-10', name: '十大元帅（10 桩）', description: '1955 年授衔的十位元帅，按授衔名单顺序', itemCount: 10, ordered: true, usableAsPeg: true, category: 'text', version: 1},
    {id: 'ten-yama-10', name: '十殿阎罗（10 桩）', description: '民间信仰地府十殿阎王，从一殿秦广王到十殿转轮王', itemCount: 10, ordered: true, usableAsPeg: true, category: 'text', version: 1},
    {id: 'eleven-luminaries-11', name: '十一曜（11 桩）', description: '七曜（日月五星）加四余（罗睺、计都、紫炁、月孛），古代星命学十一大曜', itemCount: 11, ordered: true, usableAsPeg: true, category: 'text', version: 1},
    {id: 'football-xi-11', name: '足球首发十一人（11 桩）', description: '传统球衣号码 1-11 对应位置：1 号门将，2-5 号后卫，中场 6/8/10，边锋 7/11，中锋 9', itemCount: 11, ordered: true, usableAsPeg: true, category: 'text', version: 1},
];

interface CacheData {
    timestamp: number;
    /** 写入缓存时的包数据版本（旧缓存无此字段，视为 1） */
    version?: number;
    pack: KnowledgePack;
}

/**
 * 获取包当前数据版本（元数据未显式声明时为 1）
 */
export function getPackVersion(id: string): number {
    return getKnowledgePackInfo(id)?.version ?? 1;
}

/**
 * 缓存是否可用：未过期、版本与当前包一致、数据结构合法。
 * 版本不一致（如 math-formulas 新增函数条目后老缓存缺数据）视为失效。
 */
export function isCacheUsable(data: CacheData | null, expectedVersion: number, now: number = Date.now()): boolean {
    if (!data) return false;
    if (now - data.timestamp > CACHE_EXPIRY) return false;
    if ((data.version ?? 1) !== expectedVersion) return false;
    if (!data.pack || !Array.isArray(data.pack.items) || data.pack.items.length < MIN_PACK_SIZE) return false;
    return true;
}

function buildCacheKey(id: string): string {
    return CACHE_KEY_PREFIX + id;
}

/**
 * 从 localStorage 读取缓存
 */
function getFromCache(id: string): KnowledgePack | null {
    try {
        const cached = localStorage.getItem(buildCacheKey(id));
        if (!cached) return null;

        const data: CacheData = JSON.parse(cached);
        if (!isCacheUsable(data, getPackVersion(id))) {
            localStorage.removeItem(buildCacheKey(id));
            return null;
        }
        return data.pack;
    } catch (error) {
        console.warn(`[KnowledgePack] 读取缓存失败: ${id}`, error);
        return null;
    }
}

/**
 * 写入 localStorage 缓存
 */
function saveToCache(id: string, pack: KnowledgePack): void {
    try {
        const data: CacheData = {
            timestamp: Date.now(),
            version: getPackVersion(id),
            pack,
        };
        localStorage.setItem(buildCacheKey(id), JSON.stringify(data));
    } catch (e) {
        console.warn('[KnowledgePack] 缓存失败:', e);
    }
}

function getFileName(id: string): string {
    return `${id}.json`;
}

/**
 * 从本地目录加载知识包 JSON
 */
async function loadLocalPack(id: string, timeout: number): Promise<KnowledgePack | null> {
    try {
        const fileName = getFileName(id);
        const localUrl = `${LOCAL_KNOWLEDGEBANK_PATH}${fileName}`;
        console.log(`[KnowledgePack] 加载本地知识包: ${id} from ${localUrl}`);

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(localUrl, {
            method: 'GET',
            headers: {Accept: 'application/json'},
            signal: controller.signal,
        });
        clearTimeout(timer);

        if (response.ok) {
            const data = await response.json();
            const validation = validateKnowledgePack(data);
            if (!validation.valid) {
                console.warn(`[KnowledgePack] 数据校验失败: ${id}`, validation.error);
                return null;
            }
            const pack = normalizePack(data as KnowledgePack);
            console.log(`[KnowledgePack] 成功加载 ${id}, 条目数: ${pack.items.length}`);
            return pack;
        }
        console.warn(`[KnowledgePack] 请求失败: ${response.status} ${response.statusText}`);
        return null;
    } catch (error) {
        console.warn(`[KnowledgePack] 本地加载失败: ${id}`, error);
        return null;
    }
}

/**
 * 获取知识包（优先缓存，其次本地 JSON）
 */
export async function fetchKnowledgePack(
    id: string,
    strategy: Partial<LoadStrategy> = {},
): Promise<KnowledgePack> {
    const config = {...DEFAULT_STRATEGY, ...strategy};

    if (config.useCache) {
        const cached = getFromCache(id);
        if (cached) {
            console.log(`[KnowledgePack] 使用缓存: ${id}`);
            return cached;
        }
    }

    // 并发加载同包去重
    if (inFlight.has(id)) {
        return inFlight.get(id)!;
    }

    const promise = (async (): Promise<KnowledgePack> => {
        try {
            const pack = await loadLocalPack(id, config.timeout);
            if (pack) {
                if (config.useCache) {
                    saveToCache(id, pack);
                }
                return pack;
            }

            // 若本地也失败，但有合法缓存（即使过期），仍尝试兜底使用；版本不一致的老缓存不兜底
            const staleCached = localStorage.getItem(buildCacheKey(id));
            if (staleCached) {
                try {
                    const data: CacheData = JSON.parse(staleCached);
                    if ((data.version ?? 1) !== getPackVersion(id)) {
                        console.warn(`[KnowledgePack] 过期缓存版本不一致，放弃兜底: ${id}`);
                    } else if (data.pack && Array.isArray(data.pack.items) && data.pack.items.length >= MIN_PACK_SIZE) {
                        const validation = validateKnowledgePack(data.pack);
                        if (!validation.valid) {
                            console.warn(`[KnowledgePack] 过期缓存校验失败: ${id}`, validation.error);
                            throw new Error(`[KnowledgePack] 无法加载知识包: ${id}`);
                        }
                        console.warn(`[KnowledgePack] 本地不可用，使用过期缓存: ${id}`);
                        return data.pack;
                    }
                } catch {
                    // ignore
                }
            }

            throw new Error(`[KnowledgePack] 无法加载知识包: ${id}`);
        } finally {
            inFlight.delete(id);
        }
    })();

    inFlight.set(id, promise);
    return promise;
}

/**
 * 兼容旧版的简化调用
 * @deprecated 使用新的策略对象参数
 */
export async function fetchKnowledgePackLegacy(id: string, useCache: boolean = true): Promise<KnowledgePack> {
    return fetchKnowledgePack(id, {useCache});
}

/**
 * 校验知识包 JSON 结构
 */
export function validateKnowledgePack(data: unknown): { valid: boolean; error?: string } {
    if (!data || typeof data !== 'object') {
        return {valid: false, error: '知识包不是对象'};
    }
    const pack = data as Record<string, unknown>;

    if (typeof pack.id !== 'string' || !pack.id) {
        return {valid: false, error: '缺少 id 或 id 不是字符串'};
    }
    if (typeof pack.name !== 'string' || !pack.name) {
        return {valid: false, error: '缺少 name 或 name 不是字符串'};
    }
    if (typeof pack.description !== 'string') {
        return {valid: false, error: 'description 必须是字符串'};
    }
    if (typeof pack.ordered !== 'boolean') {
        return {valid: false, error: 'ordered 必须是布尔值'};
    }
    if (typeof pack.usableAsPeg !== 'boolean') {
        return {valid: false, error: 'usableAsPeg 必须是布尔值'};
    }
    if (!Array.isArray(pack.items)) {
        return {valid: false, error: 'items 必须是数组'};
    }

    const seenIds = new Set<string>();
    for (let i = 0; i < pack.items.length; i++) {
        const item = pack.items[i];
        if (!item || typeof item !== 'object') {
            return {valid: false, error: `items[${i}] 不是对象`};
        }
        const it = item as Record<string, unknown>;
        if (typeof it.id !== 'string' || !it.id) {
            return {valid: false, error: `items[${i}] 缺少 id`};
        }
        if (typeof it.question !== 'string') {
            return {valid: false, error: `items[${i}] question 不是字符串`};
        }
        if (typeof it.answer !== 'string') {
            return {valid: false, error: `items[${i}] answer 不是字符串`};
        }
        // 备选桩名为可选字段，存在时必须是字符串数组
        if (it.alternates !== undefined) {
            if (!Array.isArray(it.alternates) || it.alternates.some(a => typeof a !== 'string')) {
                return {valid: false, error: `items[${i}] alternates 必须是字符串数组`};
            }
        }
        // 配图（emoji 字符）为可选字段，存在时必须是字符串
        if (it.imageUrl !== undefined && typeof it.imageUrl !== 'string') {
            return {valid: false, error: `items[${i}] imageUrl 必须是字符串`};
        }
        // 复杂公式的 latex 源码与预渲染图相对路径，均为可选字段，存在时必须是字符串
        if (it.latex !== undefined && typeof it.latex !== 'string') {
            return {valid: false, error: `items[${i}] latex 必须是字符串`};
        }
        if (it.image !== undefined && typeof it.image !== 'string') {
            return {valid: false, error: `items[${i}] image 必须是字符串`};
        }
        if (seenIds.has(it.id)) {
            return {valid: false, error: `items 中存在重复 id: ${it.id}`};
        }
        seenIds.add(it.id);
    }

    return {valid: true};
}

/**
 * 标准化知识包数据（给可选字段默认值）
 */
function normalizePack(pack: KnowledgePack): KnowledgePack {
    return {
        id: pack.id,
        name: pack.name,
        description: pack.description || '',
        ordered: !!pack.ordered,
        usableAsPeg: !!pack.usableAsPeg,
        mnemonics: Array.isArray(pack.mnemonics) ? pack.mnemonics : undefined,
        items: pack.items.map(item => ({
            id: item.id,
            question: item.question,
            answer: item.answer,
            extras: item.extras && typeof item.extras === 'object' ? item.extras : undefined,
            alternates: Array.isArray(item.alternates) ? item.alternates : undefined,
            order: typeof item.order === 'number' ? item.order : undefined,
            imageUrl: typeof item.imageUrl === 'string' ? item.imageUrl : undefined,
            // 复杂公式：latex 源码 + 预渲染 PNG 相对路径
            latex: typeof item.latex === 'string' ? item.latex : undefined,
            image: typeof item.image === 'string' ? item.image : undefined,
        })),
    };
}

/**
 * 清除知识包缓存
 */
export function clearKnowledgePackCache(id?: string): void {
    if (id) {
        localStorage.removeItem(buildCacheKey(id));
        return;
    }
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
 * 获取知识包元数据
 */
export function getKnowledgePackInfo(id: string): KnowledgePackInfo | undefined {
    return KNOWLEDGE_PACK_LIST.find(p => p.id === id);
}

/**
 * 列出内置知识包元数据，可按 category 过滤（math → 数理化，text → 文史常识，geo → 地理）
 */
export function listKnowledgePacks(category?: KnowledgePackCategory): KnowledgePackInfo[] {
    return KNOWLEDGE_PACK_LIST
        .filter(p => !category || p.category === category)
        .map(p => ({...p}));
}

/**
 * 检查知识包是否已缓存
 */
export function isKnowledgePackCached(id: string): boolean {
    return getFromCache(id) !== null;
}

export default {
    fetchKnowledgePack,
    fetchKnowledgePackLegacy,
    clearKnowledgePackCache,
    getKnowledgePackInfo,
    listKnowledgePacks,
    isKnowledgePackCached,
    KNOWLEDGE_PACK_LIST,
    DEFAULT_STRATEGY,
    validateKnowledgePack,
};
