/**
 * 字母映射预设数据（移动端）
 *
 * 与桌面端 src/utils/letter-memory-preset.ts 同源（英语 26 字母 + 高频组合，
 * 每个给 3 个候选映射），移动端只做英语。emoji 直接当文本渲染，不走图片。
 */

export interface LetterSuggestion {
  name: string
  emoji: string
  description: string
}

export interface LetterPreset {
  letter: string
  keyword: string
  suggestions: LetterSuggestion[]
}

// 26 个字母的预设映射
export const LETTER_PRESETS: LetterPreset[] = [
  { letter: 'a', keyword: '苹果/apple', suggestions: [
    { name: '苹果', emoji: '🍎', description: 'A-Apple-苹果' },
    { name: '锚', emoji: '⚓', description: 'A形状像锚' },
    { name: '斧头', emoji: '🪓', description: 'A形状像斧头' },
  ]},
  { letter: 'b', keyword: '男孩/boy', suggestions: [
    { name: '香蕉', emoji: '🍌', description: 'B-Banana-香蕉' },
    { name: '蝴蝶', emoji: '🦋', description: 'B形状像蝴蝶' },
    { name: '面包', emoji: '🍞', description: 'B-Bread-面包' },
  ]},
  { letter: 'c', keyword: '猫/cat', suggestions: [
    { name: '猫', emoji: '🐱', description: 'C-Cat-猫' },
    { name: '月亮', emoji: '🌙', description: 'C形状像月亮' },
    { name: '胡萝卜', emoji: '🥕', description: 'C-Carrot-胡萝卜' },
  ]},
  { letter: 'd', keyword: '狗/dog', suggestions: [
    { name: '狗', emoji: '🐶', description: 'D-Dog-狗' },
    { name: '门', emoji: '🚪', description: 'D-Door-门' },
    { name: '钻石', emoji: '💎', description: 'D-Diamond-钻石' },
  ]},
  { letter: 'e', keyword: '大象/elephant', suggestions: [
    { name: '大象', emoji: '🐘', description: 'E-Elephant-大象' },
    { name: '蛋', emoji: '🥚', description: 'E-Egg-蛋' },
    { name: '眼睛', emoji: '👁️', description: 'E-Eye-眼睛' },
  ]},
  { letter: 'f', keyword: '鱼/fish', suggestions: [
    { name: '鱼', emoji: '🐟', description: 'F-Fish-鱼' },
    { name: '花', emoji: '🌸', description: 'F-Flower-花' },
    { name: '青蛙', emoji: '🐸', description: 'F-Frog-青蛙' },
  ]},
  { letter: 'g', keyword: '葡萄/grape', suggestions: [
    { name: '葡萄', emoji: '🍇', description: 'G-Grape-葡萄' },
    { name: '吉他', emoji: '🎸', description: 'G-Guitar-吉他' },
    { name: '山羊', emoji: '🐐', description: 'G-Goat-山羊' },
  ]},
  { letter: 'h', keyword: '马/horse', suggestions: [
    { name: '马', emoji: '🐴', description: 'H-Horse-马' },
    { name: '心', emoji: '❤️', description: 'H-Heart-心' },
    { name: '帽子', emoji: '🎩', description: 'H-Hat-帽子' },
  ]},
  { letter: 'i', keyword: '冰/ice', suggestions: [
    { name: '冰', emoji: '🧊', description: 'I-Ice-冰' },
    { name: '岛屿', emoji: '🏝️', description: 'I-Island-岛屿' },
    { name: '主意', emoji: '💡', description: 'I-Idea-主意(灯泡)' },
  ]},
  { letter: 'j', keyword: '果冻/jelly', suggestions: [
    { name: '果酱', emoji: '🫙', description: 'J-Jam-果酱' },
    { name: '水母', emoji: '🪼', description: 'J-Jellyfish-水母' },
    { name: '宝石', emoji: '💎', description: 'J-Jewel-宝石' },
  ]},
  { letter: 'k', keyword: '钥匙/key', suggestions: [
    { name: '钥匙', emoji: '🔑', description: 'K-Key-钥匙' },
    { name: '风筝', emoji: '🪁', description: 'K-Kite-风筝' },
    { name: '袋鼠', emoji: '🦘', description: 'K-Kangaroo-袋鼠' },
  ]},
  { letter: 'l', keyword: '柠檬/lemon', suggestions: [
    { name: '柠檬', emoji: '🍋', description: 'L-Lemon-柠檬' },
    { name: '灯', emoji: '🔦', description: 'L-Lamp-灯' },
    { name: '叶子', emoji: '🍃', description: 'L-Leaf-叶子' },
  ]},
  { letter: 'm', keyword: '月亮/moon', suggestions: [
    { name: '西瓜', emoji: '🍉', description: 'M-Melon-西瓜' },
    { name: '山', emoji: '⛰️', description: 'M形状像山' },
    { name: '猴子', emoji: '🐒', description: 'M-Monkey-猴子' },
  ]},
  { letter: 'n', keyword: '坚果/nut', suggestions: [
    { name: '坚果', emoji: '🥜', description: 'N-Nut-坚果' },
    { name: '巢', emoji: '🪺', description: 'N-Nest-巢' },
    { name: '夜晚', emoji: '🌃', description: 'N-Night-夜晚' },
  ]},
  { letter: 'o', keyword: '橙子/orange', suggestions: [
    { name: '橙子', emoji: '🍊', description: 'O-Orange-橙子' },
    { name: '猫头鹰', emoji: '🦉', description: 'O-Owl-猫头鹰' },
    { name: '洋葱', emoji: '🧅', description: 'O-Onion-洋葱' },
  ]},
  { letter: 'p', keyword: '桃子/peach', suggestions: [
    { name: '桃子', emoji: '🍑', description: 'P-Peach-桃子' },
    { name: '钢琴', emoji: '🎹', description: 'P-Piano-钢琴' },
    { name: '企鹅', emoji: '🐧', description: 'P-Penguin-企鹅' },
  ]},
  { letter: 'q', keyword: '女王/queen', suggestions: [
    { name: '女王', emoji: '👑', description: 'Q-Queen-女王' },
    { name: '问题', emoji: '❓', description: 'Q-Question-问题' },
    { name: '被子', emoji: '🛏️', description: 'Q-Quilt-被子' },
  ]},
  { letter: 'r', keyword: '玫瑰/rose', suggestions: [
    { name: '玫瑰', emoji: '🌹', description: 'R-Rose-玫瑰' },
    { name: '兔子', emoji: '🐰', description: 'R-Rabbit-兔子' },
    { name: '彩虹', emoji: '🌈', description: 'R-Rainbow-彩虹' },
  ]},
  { letter: 's', keyword: '太阳/sun', suggestions: [
    { name: '太阳', emoji: '☀️', description: 'S-Sun-太阳' },
    { name: '蛇', emoji: '🐍', description: 'S形状像蛇' },
    { name: '星星', emoji: '⭐', description: 'S-Star-星星' },
  ]},
  { letter: 't', keyword: '老虎/tiger', suggestions: [
    { name: '老虎', emoji: '🐯', description: 'T-Tiger-老虎' },
    { name: '树', emoji: '🌳', description: 'T-Tree-树' },
    { name: '番茄', emoji: '🍅', description: 'T-Tomato-番茄' },
  ]},
  { letter: 'u', keyword: '雨伞/umbrella', suggestions: [
    { name: '雨伞', emoji: '☂️', description: 'U-Umbrella-雨伞' },
    { name: '独角兽', emoji: '🦄', description: 'U-Unicorn-独角兽' },
    { name: '宇宙', emoji: '🌌', description: 'U-Universe-宇宙' },
  ]},
  { letter: 'v', keyword: '小提琴/violin', suggestions: [
    { name: '小提琴', emoji: '🎻', description: 'V-Violin-小提琴' },
    { name: '火山', emoji: '🌋', description: 'V-Volcano-火山' },
    { name: '蔬菜', emoji: '🥬', description: 'V-Vegetable-蔬菜' },
  ]},
  { letter: 'w', keyword: '西瓜/watermelon', suggestions: [
    { name: '西瓜', emoji: '🍉', description: 'W-Watermelon-西瓜' },
    { name: '鲸鱼', emoji: '🐋', description: 'W-Whale-鲸鱼' },
    { name: '狼', emoji: '🐺', description: 'W-Wolf-狼' },
  ]},
  { letter: 'x', keyword: '木琴/xylophone', suggestions: [
    { name: '未知', emoji: '❌', description: 'X标记' },
    { name: '箱子', emoji: '📦', description: 'X-Box-箱子' },
    { name: '骷髅', emoji: '☠️', description: 'X形状像交叉骨' },
  ]},
  { letter: 'y', keyword: '牦牛/yak', suggestions: [
    { name: '牦牛', emoji: '🐂', description: 'Y-Yak-牦牛' },
    { name: '纱线', emoji: '🧶', description: 'Y-Yarn-纱线' },
    { name: '溜溜球', emoji: '🪀', description: 'Y-Yo-yo-溜溜球' },
  ]},
  { letter: 'z', keyword: '斑马/zebra', suggestions: [
    { name: '斑马', emoji: '🦓', description: 'Z-Zebra-斑马' },
    { name: '拉链', emoji: '🤐', description: 'Z-Zip-拉链' },
    { name: '动物园', emoji: '🦁', description: 'Z-Zoo-动物园' },
  ]},
]

// 常见字母组合预设（兼顾拼写与读音）
export const COMBO_PRESETS: LetterPreset[] = [
  { letter: 'old', keyword: '金/gold', suggestions: [
    { name: '金子', emoji: '🥇', description: 'OLD-Gold-金（old 读 /əʊld/）' },
    { name: '寒冷', emoji: '❄️', description: 'OLD-Cold-冷' },
    { name: '拿住', emoji: '🤝', description: 'OLD-Hold-握住' },
  ]},
  { letter: 'ea', keyword: '鹰/eagle', suggestions: [
    { name: '鹰', emoji: '🦅', description: 'EA-Eagle-鹰（ea 常读 /iː/）' },
    { name: '海', emoji: '🌊', description: 'EA-Sea-海' },
    { name: '吃', emoji: '🍽️', description: 'EA-Eat-吃' },
  ]},
  { letter: 'ee', keyword: '蜜蜂/bee', suggestions: [
    { name: '蜜蜂', emoji: '🐝', description: 'EE-Bee-蜜蜂（ee 读 /iː/）' },
    { name: '树', emoji: '🌳', description: 'EE-Tree-树' },
    { name: '脚', emoji: '🦶', description: 'EE-Feet-脚' },
  ]},
  { letter: 'oo', keyword: '月亮/moon', suggestions: [
    { name: '月亮', emoji: '🌙', description: 'OO-Moon-月亮（oo 常读 /uː/）' },
    { name: '食物', emoji: '🍔', description: 'OO-Food-食物' },
    { name: '动物园', emoji: '🦁', description: 'OO-Zoo-动物园' },
  ]},
  { letter: 'ai', keyword: '雨/rain', suggestions: [
    { name: '雨', emoji: '🌧️', description: 'AI-Rain-雨（ai 读 /eɪ/）' },
    { name: '火车', emoji: '🚂', description: 'AI-Train-火车' },
    { name: '蜗牛', emoji: '🐌', description: 'AI-Snail-蜗牛' },
  ]},
  { letter: 'ay', keyword: '白天/day', suggestions: [
    { name: '白天', emoji: '🌞', description: 'AY-Day-白天（ay 读 /eɪ/）' },
    { name: '玩', emoji: '🎮', description: 'AY-Play-玩' },
    { name: '路', emoji: '🛣️', description: 'AY-Way-路' },
  ]},
  { letter: 'oa', keyword: '船/boat', suggestions: [
    { name: '船', emoji: '⛵', description: 'OA-Boat-船（oa 读 /əʊ/）' },
    { name: '外套', emoji: '🧥', description: 'OA-Coat-外套' },
    { name: '路', emoji: '🛣️', description: 'OA-Road-路' },
  ]},
  { letter: 'ou', keyword: '房子/house', suggestions: [
    { name: '房子', emoji: '🏠', description: 'OU-House-房子（ou 常读 /aʊ/）' },
    { name: '老鼠', emoji: '🐭', description: 'OU-Mouse-老鼠' },
    { name: '嘴巴', emoji: '👄', description: 'OU-Mouth-嘴巴' },
  ]},
  { letter: 'ow', keyword: '奶牛/cow', suggestions: [
    { name: '奶牛', emoji: '🐄', description: 'OW-Cow-奶牛（ow 可读 /aʊ/）' },
    { name: '雪', emoji: '❄️', description: 'OW-Snow-雪（也可读 /əʊ/）' },
    { name: '窗户', emoji: '🪟', description: 'OW-Window-窗户' },
  ]},
  { letter: 'igh', keyword: '夜晚/night', suggestions: [
    { name: '夜晚', emoji: '🌙', description: 'IGH-Night-夜晚（igh 读 /aɪ/）' },
    { name: '光', emoji: '💡', description: 'IGH-Light-光' },
    { name: '飞行', emoji: '✈️', description: 'IGH-Flight-飞行' },
  ]},
  { letter: 'ch', keyword: '椅子/chair', suggestions: [
    { name: '椅子', emoji: '🪑', description: 'CH-Chair-椅子（ch 读 /tʃ/）' },
    { name: '奶酪', emoji: '🧀', description: 'CH-Cheese-奶酪' },
    { name: '樱桃', emoji: '🍒', description: 'CH-Cherry-樱桃' },
  ]},
  { letter: 'sh', keyword: '鞋子/shoe', suggestions: [
    { name: '鞋子', emoji: '👟', description: 'SH-Shoe-鞋子（sh 读 /ʃ/）' },
    { name: '船', emoji: '🚢', description: 'SH-Ship-船' },
    { name: '绵羊', emoji: '🐑', description: 'SH-Sheep-绵羊' },
  ]},
  { letter: 'th', keyword: '拇指/thumb', suggestions: [
    { name: '拇指', emoji: '👍', description: 'TH-Thumb-拇指（th 读 /θ/）' },
    { name: '思考', emoji: '🤔', description: 'TH-Think-思考' },
    { name: '母亲', emoji: '👩', description: 'TH-Mother-母亲（th 读 /ð/）' },
  ]},
  { letter: 'ph', keyword: '电话/phone', suggestions: [
    { name: '电话', emoji: '📱', description: 'PH-Phone-电话（ph 读 /f/）' },
    { name: '照片', emoji: '📷', description: 'PH-Photo-照片' },
    { name: '大象', emoji: '🐘', description: 'PH-Elephant-大象' },
  ]},
  { letter: 'wh', keyword: '鲸鱼/whale', suggestions: [
    { name: '鲸鱼', emoji: '🐋', description: 'WH-Whale-鲸鱼（wh 读 /w/）' },
    { name: '小麦', emoji: '🌾', description: 'WH-Wheat-小麦' },
    { name: '轮子', emoji: '🎡', description: 'WH-Wheel-轮子' },
  ]},
  { letter: 'ck', keyword: '时钟/clock', suggestions: [
    { name: '时钟', emoji: '🕐', description: 'CK-Clock-时钟（ck 读 /k/）' },
    { name: '鸭子', emoji: '🦆', description: 'CK-Duck-鸭子' },
    { name: '袜子', emoji: '🧦', description: 'CK-Sock-袜子' },
  ]},
  { letter: 'ng', keyword: '国王/king', suggestions: [
    { name: '国王', emoji: '🤴', description: 'NG-King-国王（ng 读 /ŋ/）' },
    { name: '铃声', emoji: '🔔', description: 'NG-Ring-铃声' },
    { name: '歌', emoji: '🎵', description: 'NG-Song-歌' },
  ]},
  { letter: 'qu', keyword: '女王/queen', suggestions: [
    { name: '女王', emoji: '👑', description: 'QU-Queen-女王（qu 读 /kw/）' },
    { name: '问题', emoji: '❓', description: 'QU-Question-问题' },
    { name: '快', emoji: '⚡', description: 'QU-Quick-快的' },
  ]},
  { letter: 'kn', keyword: '刀/knife', suggestions: [
    { name: '刀', emoji: '🔪', description: 'KN-Knife-刀（k 不发音）' },
    { name: '敲门', emoji: '🚪', description: 'KN-Knock-敲（k 不发音）' },
    { name: '膝盖', emoji: '🦵', description: 'KN-Knee-膝盖（k 不发音）' },
  ]},
  { letter: 'wr', keyword: '手腕/wrist', suggestions: [
    { name: '手腕', emoji: '⌚', description: 'WR-Wrist-手腕（w 不发音）' },
    { name: '包裹', emoji: '🎁', description: 'WR-Wrap-包裹（w 不发音）' },
    { name: '写', emoji: '✍️', description: 'WR-Write-写（w 不发音）' },
  ]},
  { letter: 'mb', keyword: '攀登/climb', suggestions: [
    { name: '攀登', emoji: '🧗', description: 'MB-Climb-攀登（b 不发音）' },
    { name: '炸弹', emoji: '🧨', description: 'MB-Bomb-炸弹（b 不发音）' },
    { name: '羔羊', emoji: '🐑', description: 'MB-Lamb-羔羊（b 不发音）' },
  ]},
  { letter: 'tch', keyword: '厨房/kitchen', suggestions: [
    { name: '厨房', emoji: '🍳', description: 'TCH-Kitchen-厨房（tch 读 /tʃ/）' },
    { name: '接住', emoji: '🧤', description: 'TCH-Catch-接住' },
    { name: '开关', emoji: '🔘', description: 'TCH-Switch-开关' },
  ]},
  { letter: 'dge', keyword: '桥/bridge', suggestions: [
    { name: '桥', emoji: '🌉', description: 'DGE-Bridge-桥（dge 读 /dʒ/）' },
    { name: '冰箱', emoji: '🧊', description: 'DGE-Fridge-冰箱' },
    { name: '法官', emoji: '⚖️', description: 'DGE-Judge-法官' },
  ]},
]

const ALL_PRESETS = [...LETTER_PRESETS, ...COMBO_PRESETS]

/** 26 个字母（小写 a-z） */
export const LETTER_LIST = LETTER_PRESETS.map((p) => p.letter)

/** 组合列表（old/ea/ee/…） */
export const COMBO_LIST = COMBO_PRESETS.map((p) => p.letter)

/** 查某个字母/组合的预设（含 3 个候选） */
export function findLetterPreset(letter: string): LetterPreset | undefined {
  return ALL_PRESETS.find((p) => p.letter === letter)
}

/** 默认映射：预设的第一个候选 */
export function getDefaultSuggestion(letter: string): LetterSuggestion | undefined {
  return findLetterPreset(letter)?.suggestions[0]
}
