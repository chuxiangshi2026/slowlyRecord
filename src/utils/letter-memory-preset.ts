/**
 * 字母映射预设数据
 * 每个字母提供基于发音/形状的推荐图片映射
 */
import type { LetterImageAssociation } from '@/types/letter-memory'

interface LetterPreset {
  letter: string;
  keyword: string; // 关联关键词
  suggestions: {
    name: string;
    url: string;     // emoji
    description: string;
  }[];
}

// 26个字母的预设映射
const LETTER_PRESETS: LetterPreset[] = [
  { letter: 'a', keyword: '苹果/apple', suggestions: [
    { name: '苹果', url: '🍎', description: 'A-Apple-苹果' },
    { name: '锚', url: '⚓', description: 'A形状像锚' },
    { name: '斧头', url: '🪓', description: 'A形状像斧头' },
  ]},
  { letter: 'b', keyword: '男孩/boy', suggestions: [
    { name: '香蕉', url: '🍌', description: 'B-Banana-香蕉' },
    { name: '蝴蝶', url: '🦋', description: 'B形状像蝴蝶' },
    { name: '面包', url: '🍞', description: 'B-Bread-面包' },
  ]},
  { letter: 'c', keyword: '猫/cat', suggestions: [
    { name: '猫', url: '🐱', description: 'C-Cat-猫' },
    { name: '月亮', url: '🌙', description: 'C形状像月亮' },
    { name: '胡萝卜', url: '🥕', description: 'C-Carrot-胡萝卜' },
  ]},
  { letter: 'd', keyword: '狗/dog', suggestions: [
    { name: '狗', url: '🐶', description: 'D-Dog-狗' },
    { name: '门', url: '🚪', description: 'D-Door-门' },
    { name: '钻石', url: '💎', description: 'D-Diamond-钻石' },
  ]},
  { letter: 'e', keyword: '大象/elephant', suggestions: [
    { name: '大象', url: '🐘', description: 'E-Elephant-大象' },
    { name: '蛋', url: '🥚', description: 'E-Egg-蛋' },
    { name: '眼睛', url: '👁️', description: 'E-Eye-眼睛' },
  ]},
  { letter: 'f', keyword: '鱼/fish', suggestions: [
    { name: '鱼', url: '🐟', description: 'F-Fish-鱼' },
    { name: '花', url: '🌸', description: 'F-Flower-花' },
    { name: '青蛙', url: '🐸', description: 'F-Frog-青蛙' },
  ]},
  { letter: 'g', keyword: '葡萄/grape', suggestions: [
    { name: '葡萄', url: '🍇', description: 'G-Grape-葡萄' },
    { name: '吉他', url: '🎸', description: 'G-Guitar-吉他' },
    { name: '山羊', url: '🐐', description: 'G-Goat-山羊' },
  ]},
  { letter: 'h', keyword: '马/horse', suggestions: [
    { name: '马', url: '🐴', description: 'H-Horse-马' },
    { name: '心', url: '❤️', description: 'H-Heart-心' },
    { name: '帽子', url: '🎩', description: 'H-Hat-帽子' },
  ]},
  { letter: 'i', keyword: '冰/ice', suggestions: [
    { name: '冰', url: '🧊', description: 'I-Ice-冰' },
    { name: '岛屿', url: '🏝️', description: 'I-Island-岛屿' },
    { name: '主意', url: '💡', description: 'I-Idea-主意(灯泡)' },
  ]},
  { letter: 'j', keyword: '果冻/jelly', suggestions: [
    { name: '果酱', url: '🫙', description: 'J-Jam-果酱' },
    { name: '水母', url: '🪼', description: 'J-Jellyfish-水母' },
    { name: '宝石', url: '💎', description: 'J-Jewel-宝石' },
  ]},
  { letter: 'k', keyword: '钥匙/key', suggestions: [
    { name: '钥匙', url: '🔑', description: 'K-Key-钥匙' },
    { name: '风筝', url: '🪁', description: 'K-Kite-风筝' },
    { name: '袋鼠', url: '🦘', description: 'K-Kangaroo-袋鼠' },
  ]},
  { letter: 'l', keyword: '柠檬/lemon', suggestions: [
    { name: '柠檬', url: '🍋', description: 'L-Lemon-柠檬' },
    { name: '灯', url: '🔦', description: 'L-Lamp-灯' },
    { name: '叶子', url: '🍃', description: 'L-Leaf-叶子' },
  ]},
  { letter: 'm', keyword: '月亮/moon', suggestions: [
    { name: '西瓜', url: '🍉', description: 'M-Melon-西瓜' },
    { name: '山', url: '⛰️', description: 'M形状像山' },
    { name: '猴子', url: '🐒', description: 'M-Monkey-猴子' },
  ]},
  { letter: 'n', keyword: '坚果/nut', suggestions: [
    { name: '坚果', url: '🥜', description: 'N-Nut-坚果' },
    { name: '巢', url: '🪺', description: 'N-Nest-巢' },
    { name: '夜晚', url: '🌃', description: 'N-Night-夜晚' },
  ]},
  { letter: 'o', keyword: '橙子/orange', suggestions: [
    { name: '橙子', url: '🍊', description: 'O-Orange-橙子' },
    { name: '猫头鹰', url: '🦉', description: 'O-Owl-猫头鹰' },
    { name: '洋葱', url: '🧅', description: 'O-Onion-洋葱' },
  ]},
  { letter: 'p', keyword: '桃子/peach', suggestions: [
    { name: '桃子', url: '🍑', description: 'P-Peach-桃子' },
    { name: '钢琴', url: '🎹', description: 'P-Piano-钢琴' },
    { name: '企鹅', url: '🐧', description: 'P-Penguin-企鹅' },
  ]},
  { letter: 'q', keyword: '女王/queen', suggestions: [
    { name: '女王', url: '👑', description: 'Q-Queen-女王' },
    { name: '问题', url: '❓', description: 'Q-Question-问题' },
    { name: '被子', url: '🛏️', description: 'Q-Quilt-被子' },
  ]},
  { letter: 'r', keyword: '玫瑰/rose', suggestions: [
    { name: '玫瑰', url: '🌹', description: 'R-Rose-玫瑰' },
    { name: '兔子', url: '🐰', description: 'R-Rabbit-兔子' },
    { name: '彩虹', url: '🌈', description: 'R-Rainbow-彩虹' },
  ]},
  { letter: 's', keyword: '太阳/sun', suggestions: [
    { name: '太阳', url: '☀️', description: 'S-Sun-太阳' },
    { name: '蛇', url: '🐍', description: 'S形状像蛇' },
    { name: '星星', url: '⭐', description: 'S-Star-星星' },
  ]},
  { letter: 't', keyword: '老虎/tiger', suggestions: [
    { name: '老虎', url: '🐯', description: 'T-Tiger-老虎' },
    { name: '树', url: '🌳', description: 'T-Tree-树' },
    { name: '番茄', url: '🍅', description: 'T-Tomato-番茄' },
  ]},
  { letter: 'u', keyword: '雨伞/umbrella', suggestions: [
    { name: '雨伞', url: '☂️', description: 'U-Umbrella-雨伞' },
    { name: '独角兽', url: '🦄', description: 'U-Unicorn-独角兽' },
    { name: '宇宙', url: '🌌', description: 'U-Universe-宇宙' },
  ]},
  { letter: 'v', keyword: '小提琴/violin', suggestions: [
    { name: '小提琴', url: '🎻', description: 'V-Violin-小提琴' },
    { name: '火山', url: '🌋', description: 'V-Volcano-火山' },
    { name: '蔬菜', url: '🥬', description: 'V-Vegetable-蔬菜' },
  ]},
  { letter: 'w', keyword: '西瓜/watermelon', suggestions: [
    { name: '西瓜', url: '🍉', description: 'W-Watermelon-西瓜' },
    { name: '鲸鱼', url: '🐋', description: 'W-Whale-鲸鱼' },
    { name: '狼', url: '🐺', description: 'W-Wolf-狼' },
  ]},
  { letter: 'x', keyword: '木琴/xylophone', suggestions: [
    { name: '未知', url: '❌', description: 'X标记' },
    { name: '箱子', url: '📦', description: 'X-Box-箱子' },
    { name: '骷髅', url: '☠️', description: 'X形状像交叉骨' },
  ]},
  { letter: 'y', keyword: '牦牛/yak', suggestions: [
    { name: '牦牛', url: '🐂', description: 'Y-Yak-牦牛' },
    { name: '纱线', url: '🧶', description: 'Y-Yarn-纱线' },
    { name: '溜溜球', url: '🪀', description: 'Y-Yo-yo-溜溜球' },
  ]},
  { letter: 'z', keyword: '斑马/zebra', suggestions: [
    { name: '斑马', url: '🦓', description: 'Z-Zebra-斑马' },
    { name: '拉链', url: '🤐', description: 'Z-Zip-拉链' },
    { name: '动物园', url: '🦁', description: 'Z-Zoo-动物园' },
  ]},
];

// 常见字母组合预设
const COMBO_PRESETS: LetterPreset[] = [
  { letter: 'ch', keyword: '椅子/chair', suggestions: [
    { name: '椅子', url: '🪑', description: 'CH-Chair-椅子' },
    { name: '奶酪', url: '🧀', description: 'CH-Cheese-奶酪' },
    { name: '樱桃', url: '🍒', description: 'CH-Cherry-樱桃' },
  ]},
  { letter: 'sh', keyword: '鞋子/shoe', suggestions: [
    { name: '鞋子', url: '👟', description: 'SH-Shoe-鞋子' },
    { name: '船', url: '🚢', description: 'SH-Ship-船' },
    { name: '绵羊', url: '🐑', description: 'SH-Sheep-绵羊' },
  ]},
  { letter: 'th', keyword: '拇指/thumb', suggestions: [
    { name: '拇指', url: '👍', description: 'TH-Thumb-拇指' },
    { name: '思考', url: '🤔', description: 'TH-Think-思考' },
    { name: '王位', url: '🪑', description: 'TH-Throne-王位' },
  ]},
  { letter: 'ph', keyword: '电话/phone', suggestions: [
    { name: '电话', url: '📱', description: 'PH-Phone-电话' },
    { name: '照片', url: '📷', description: 'PH-Photo-照片' },
    { name: '海豚', url: '🐬', description: 'PH-Dolphin(Phonics)' },
  ]},
  { letter: 'wh', keyword: '鲸鱼/whale', suggestions: [
    { name: '鲸鱼', url: '🐋', description: 'WH-Whale-鲸鱼' },
    { name: '小麦', url: '🌾', description: 'WH-Wheat-小麦' },
    { name: '轮子', url: '🎡', description: 'WH-Wheel-轮子' },
  ]},
  { letter: 'ck', keyword: '时钟/clock', suggestions: [
    { name: '时钟', url: '🕐', description: 'CK-Clock-时钟' },
    { name: '鸭子', url: '🦆', description: 'CK-Duck(ck发音)' },
    { name: '袜子', url: '🧦', description: 'CK-Sock(ck发音)' },
  ]},
  { letter: 'ng', keyword: '铃/bell', suggestions: [
    { name: '铃声', url: '🔔', description: 'NG-Ring(ng发音)' },
    { name: '歌', url: '🎵', description: 'NG-Song(ng发音)' },
    { name: '国王', url: '🤴', description: 'NG-King(ng发音)' },
  ]},
  { letter: 'oo', keyword: '月亮/moon', suggestions: [
    { name: '月亮', url: '🌙', description: 'OO-Moon-月亮' },
    { name: '食物', url: '🍔', description: 'OO-Food-食物' },
    { name: '动物园', url: '🦁', description: 'OO-Zoo-动物园' },
  ]},
  { letter: 'ee', keyword: '蜜蜂/bee', suggestions: [
    { name: '蜜蜂', url: '🐝', description: 'EE-Bee-蜜蜂' },
    { name: '树', url: '🌳', description: 'EE-Tree-树' },
    { name: '脚', url: '🦶', description: 'EE-Feet-脚' },
  ]},
  { letter: 'ea', keyword: '鹰/eagle', suggestions: [
    { name: '鹰', url: '🦅', description: 'EA-Eagle-鹰' },
    { name: '吃', url: '🍽️', description: 'EA-Eat-吃' },
    { name: '豆子', url: '🫘', description: 'EA-Bean-豆子' },
  ]},
  { letter: 'ai', keyword: '雨/rain', suggestions: [
    { name: '雨', url: '🌧️', description: 'AI-Rain-雨' },
    { name: '火车', url: '🚂', description: 'AI-Train-火车' },
    { name: '蜗牛', url: '🐌', description: 'AI-Snail-蜗牛' },
  ]},
  { letter: 'ou', keyword: '房子/house', suggestions: [
    { name: '房子', url: '🏠', description: 'OU-House-房子' },
    { name: '老鼠', url: '🐭', description: 'OU-Mouse-老鼠' },
    { name: '嘴巴', url: '👄', description: 'OU-Mouth-嘴巴' },
  ]},
];

/**
 * 获取字母的推荐图片
 */
export function getRecommendedImages(letter: string) {
  const allPresets = [...LETTER_PRESETS, ...COMBO_PRESETS];
  const preset = allPresets.find(p => p.letter === letter);
  return preset?.suggestions || [];
}

/**
 * 获取字母的关键词
 */
export function getLetterKeyword(letter: string): string {
  const allPresets = [...LETTER_PRESETS, ...COMBO_PRESETS];
  const preset = allPresets.find(p => p.letter === letter);
  return preset?.keyword || '';
}

/** 各语言字母表（联想建议仅 en/ja 精做，其他语言 suggestions 为空数组） */
const ALPHABET_BY_LANG: Record<string, string[]> = {
  en: LETTER_PRESETS.map(p => p.letter),
  ja: [
    'あ','い','う','え','お','か','き','く','け','こ','さ','し','す','せ','そ',
    'た','ち','つ','て','と','な','に','ぬ','ね','の','は','ひ','ふ','へ','ほ',
    'ま','み','む','め','も','や','ゆ','よ','ら','り','る','れ','ろ','わ','を','ん',
  ],
  ru: ['а','б','в','г','д','е','ё','ж','з','и','й','к','л','м','н','о','п','р','с','т','у','ф','х','ц','ч','ш','щ','ъ','ы','ь','э','ю','я'],
  es: ['a','b','c','d','e','f','g','h','i','j','k','l','m','n','ñ','o','p','q','r','s','t','u','v','w','x','y','z'],
  fr: ['a','b','c','d','e','f','g','h','i','j','k','l','m','n','o','p','q','r','s','t','u','v','w','x','y','z'],
}

/**
 * 获取当前语言的字母列表（默认英语 26 字母，行为不变）
 */
export function getAlphabetLetters(lang: string = 'en'): string[] {
  return ALPHABET_BY_LANG[lang] || ALPHABET_BY_LANG.en;
}

/**
 * 获取预设的字母组合列表
 */
export function getComboLetters(): string[] {
  return COMBO_PRESETS.map(p => p.letter);
}

/**
 * 获取所有预设字母/组合列表
 */
export function getAllPresetLetters(lang: string = 'en'): string[] {
  return [...getAlphabetLetters(lang), ...getComboLetters()];
}

/**
 * 打乱数组
 */
export function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}
