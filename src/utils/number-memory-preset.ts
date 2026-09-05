import type { PresetImageMap } from "@/types/number-memory";

/**
 * 数字编码预设图片库
 * 基于数字的发音谐音和外形特征
 * 支持0-99的数字编码系统
 */
export const presetImageMap: PresetImageMap = {
  // 个位数 0-9
  0: {
    keyword: "铃/球/蛋/洞",
    suggestions: [
      { name: "铃铛", url: "🔔", description: "0像铃铛" },
      { name: "鸡蛋", url: "🥚", description: "0像鸡蛋" },
      { name: "甜甜圈", url: "🍩", description: "0像甜甜圈" },
      { name: "眼镜", url: "👓", description: "0像眼镜框" }
    ]
  },
  1: {
    keyword: "衣/树/笔/椅",
    suggestions: [
      { name: "衣服", url: "👔", description: "1谐音衣" },
      { name: "树", url: "🌲", description: "1像树干" },
      { name: "铅笔", url: "✏️", description: "1像铅笔" },
      { name: "筷子", url: "🥢", description: "1像筷子" }
    ]
  },
  2: {
    keyword: "鹅/鸭/兔/耳",
    suggestions: [
      { name: "天鹅", url: "🦢", description: "2像天鹅" },
      { name: "鸭子", url: "🦆", description: "2像鸭子" },
      { name: "兔子", url: "🐰", description: "2像兔子耳朵" },
      { name: "耳朵", url: "👂", description: "2谐音耳" }
    ]
  },
  3: {
    keyword: "山/伞/耳/蝶",
    suggestions: [
      { name: "山", url: "⛰️", description: "3像山峰" },
      { name: "雨伞", url: "☂️", description: "3像雨伞" },
      { name: "蝴蝶", url: "🦋", description: "3像蝴蝶翅膀" },
      { name: "耳朵", url: "👂", description: "3像耳朵" }
    ]
  },
  4: {
    keyword: "寺/旗/蛇/帆",
    suggestions: [
      { name: "寺庙", url: "🏛️", description: "4谐音寺" },
      { name: "旗帜", url: "🚩", description: "4像旗帜" },
      { name: "帆船", url: "⛵", description: "4像帆船" },
      { name: "蛇", url: "🐍", description: "4像蛇形" }
    ]
  },
  5: {
    keyword: "舞/虎/钩/屋",
    suggestions: [
      { name: "跳舞", url: "💃", description: "5谐音舞" },
      { name: "老虎", url: "🐯", description: "5像虎纹" },
      { name: "鱼钩", url: "🪝", description: "5像鱼钩" },
      { name: "手套", url: "🧤", description: "5像手套" }
    ]
  },
  6: {
    keyword: "柳/牛/斗/烟",
    suggestions: [
      { name: "柳树", url: "🌿", description: "6谐音柳" },
      { name: "牛", url: "🐮", description: "6像牛头" },
      { name: "烟斗", url: "🚬", description: "6像烟斗" },
      { name: "哨子", url: "📢", description: "6像哨子" }
    ]
  },
  7: {
    keyword: "棋/鸡/锄/拐",
    suggestions: [
      { name: "象棋", url: "♟️", description: "7谐音棋" },
      { name: "公鸡", url: "🐓", description: "7像鸡头" },
      { name: "锄头", url: "⛏️", description: "7像锄头" },
      { name: "拐杖", url: "🦯", description: "7像拐杖" }
    ]
  },
  8: {
    keyword: "发/爸/葫芦/花",
    suggestions: [
      { name: "葫芦", url: "🍶", description: "8像葫芦" },
      { name: "雪人", url: "☃️", description: "8像雪人" },
      { name: "麻花", url: "🥨", description: "8像麻花" },
      { name: "眼镜蛇", url: "🐍", description: "8像盘蛇" }
    ]
  },
  9: {
    keyword: "酒/猫/舅/勺",
    suggestions: [
      { name: "酒瓶", url: "🍾", description: "9谐音酒" },
      { name: "猫", url: "🐱", description: "9像猫" },
      { name: "勺子", url: "🥄", description: "9像勺子" },
      { name: "气球", url: "🎈", description: "9像气球" }
    ]
  },
  // 十位数 10-19
  10: {
    keyword: "衣领/衣洞/棒球",
    suggestions: [
      { name: "衣领", url: "👔", description: "10像衣领" },
      { name: "棒球", url: "⚾", description: "10像棒球" },
      { name: "保龄球", url: "🎳", description: "10像保龄球" },
      { name: "戒指", url: "💍", description: "10像戒指" }
    ]
  },
  11: {
    keyword: "筷子/双筷/楼梯",
    suggestions: [
      { name: "筷子", url: "🥢", description: "11像双筷" },
      { name: "楼梯", url: "🪜", description: "11像楼梯" },
      { name: "双杠", url: "🏋️", description: "11像双杠" },
      { name: "铁轨", url: "🛤️", description: "11像铁轨" }
    ]
  },
  12: {
    keyword: "婴儿/椅儿/羊儿",
    suggestions: [
      { name: "婴儿", url: "👶", description: "12谐音婴儿" },
      { name: "小羊", url: "🐑", description: "12像羊儿" },
      { name: "椅子", url: "🪑", description: "12像椅儿" },
      { name: "奶嘴", url: "🍼", description: "12像婴儿用品" }
    ]
  },
  13: {
    keyword: "雨伞/医生/西山",
    suggestions: [
      { name: "医生", url: "👨‍⚕️", description: "13谐音医生" },
      { name: "雨伞", url: "☂️", description: "13像雨伞" },
      { name: "药丸", url: "💊", description: "13像药丸" },
      { name: "听诊器", url: "🩺", description: "13像医生用具" }
    ]
  },
  14: {
    keyword: "钥匙/石狮/喜事",
    suggestions: [
      { name: "钥匙", url: "🗝️", description: "14谐音钥匙" },
      { name: "石狮", url: "🦁", description: "14谐音石狮" },
      { name: "锁", url: "🔒", description: "14配钥匙" },
      { name: "门", url: "🚪", description: "14钥匙开门" }
    ]
  },
  15: {
    keyword: "鹦鹉/食物/圆屋",
    suggestions: [
      { name: "鹦鹉", url: "🦜", description: "15谐音鹦鹉" },
      { name: "月饼", url: "🥮", description: "15像圆月" },
      { name: "圆球", url: "⚽", description: "15像圆球" },
      { name: "鱼", url: "🐟", description: "15谐音鱼" }
    ]
  },
  16: {
    keyword: "杨柳/一流/石牛",
    suggestions: [
      { name: "杨柳", url: "🌿", description: "16谐音杨柳" },
      { name: "牛", url: "🐮", description: "16像石牛" },
      { name: "柳树", url: "🌳", description: "16像柳树" },
      { name: "河流", url: "🏞️", description: "16谐音一流" }
    ]
  },
  17: {
    keyword: "仪器/一起/奇异",
    suggestions: [
      { name: "显微镜", url: "🔬", description: "17像仪器" },
      { name: "望远镜", url: "🔭", description: "17像仪器" },
      { name: "天秤", url: "⚖️", description: "17像仪器" },
      { name: "齿轮", url: "⚙️", description: "17像仪器零件" }
    ]
  },
  18: {
    keyword: "要发/泥巴/石坝",
    suggestions: [
      { name: "发财", url: "💰", description: "18谐音要发" },
      { name: "泥巴", url: "🟫", description: "18谐音泥巴" },
      { name: "水坝", url: "🌊", description: "18像石坝" },
      { name: "金币", url: "🪙", description: "18要发财" }
    ]
  },
  19: {
    keyword: "药酒/石球/衣钩",
    suggestions: [
      { name: "药酒", url: "🍶", description: "19谐音药酒" },
      { name: "药瓶", url: "🧴", description: "19像药瓶" },
      { name: "钩针", url: "🧶", description: "19像衣钩" },
      { name: "拐杖", url: "🦯", description: "19像拐杖" }
    ]
  },
  // 20-29
  20: {
    keyword: "耳环/耳铃/鸭蛋",
    suggestions: [
      { name: "耳环", url: "💎", description: "20像耳环" },
      { name: "鸭蛋", url: "🥚", description: "20像鸭蛋" },
      { name: "戒指", url: "💍", description: "20像戒指" },
      { name: "项链", url: "📿", description: "20像项链" }
    ]
  },
  21: {
    keyword: "鳄鱼/耳衣/儿医",
    suggestions: [
      { name: "鳄鱼", url: "🐊", description: "21谐音鳄鱼" },
      { name: "医生", url: "👨‍⚕️", description: "21谐音儿医" },
      { name: "牙齿", url: "🦷", description: "21鳄鱼牙齿" },
      { name: "河流", url: "🏞️", description: "21鳄鱼栖息地" }
    ]
  },
  22: {
    keyword: "双双/鹅鹅/两鹅",
    suggestions: [
      { name: "天鹅", url: "🦢", description: "22双双鹅" },
      { name: "鸭子", url: "🦆", description: "22双双鸭" },
      { name: "企鹅", url: "🐧", description: "22双双企鹅" },
      { name: "兔子", url: "🐰", description: "22双双兔" }
    ]
  },
  23: {
    keyword: "耳扇/凉山/鹅山",
    suggestions: [
      { name: "扇子", url: "🪭", description: "23像耳扇" },
      { name: "山", url: "⛰️", description: "23像凉山" },
      { name: "鹅", url: "🦢", description: "23鹅上山" },
      { name: "风筝", url: "🪁", description: "23像风筝" }
    ]
  },
  24: {
    keyword: "耳屎/鹅翅/饿死",
    suggestions: [
      { name: "时钟", url: "🕰️", description: "24像时钟" },
      { name: "翅膀", url: "🪶", description: "24像鹅翅" },
      { name: "手表", url: "⌚", description: "24像手表" },
      { name: "面包", url: "🍞", description: "24反饿死" }
    ]
  },
  25: {
    keyword: "耳鼓/二胡/鹅虎",
    suggestions: [
      { name: "二胡", url: "🎻", description: "25谐音二胡" },
      { name: "鼓", url: "🥁", description: "25像耳鼓" },
      { name: "老虎", url: "🐯", description: "25鹅遇虎" },
      { name: "乐器", url: "🎺", description: "25像乐器" }
    ]
  },
  26: {
    keyword: "二流/耳铃/鹅柳",
    suggestions: [
      { name: "河流", url: "🏞️", description: "26二流河" },
      { name: "铃铛", url: "🔔", description: "26像耳铃" },
      { name: "柳树", url: "🌿", description: "26鹅依柳" },
      { name: "风铃", url: "🎐", description: "26像风铃" }
    ]
  },
  27: {
    keyword: "耳机/耳鸡/二妻",
    suggestions: [
      { name: "耳机", url: "🎧", description: "27谐音耳机" },
      { name: "公鸡", url: "🐓", description: "27耳旁鸡" },
      { name: "麦克风", url: "🎤", description: "27像麦克风" },
      { name: "音箱", url: "🔊", description: "27配耳机" }
    ]
  },
  28: {
    keyword: "二爸/耳发/鹅爸",
    suggestions: [
      { name: "爸爸", url: "👨", description: "28谐音二爸" },
      { name: "头发", url: "💇", description: "28耳后发" },
      { name: "胡子", url: "🧔", description: "28像胡子" },
      { name: "葫芦", url: "🍶", description: "28像葫芦" }
    ]
  },
  29: {
    keyword: "二舅/耳钩/鹅脚",
    suggestions: [
      { name: "舅舅", url: "👨", description: "29谐音二舅" },
      { name: "钩子", url: "🪝", description: "29像耳钩" },
      { name: "鹅掌", url: "🦶", description: "29鹅脚掌" },
      { name: "锚", url: "⚓", description: "29像锚" }
    ]
  },
  // 30-39
  30: {
    keyword: "山洞/伞铃/三零",
    suggestions: [
      { name: "山洞", url: "🕳️", description: "30像山洞" },
      { name: "隧道", url: "🚇", description: "30像隧道" },
      { name: "洞穴", url: "⛰️", description: "30山洞穴" },
      { name: "矿井", url: "⛏️", description: "30像矿井" }
    ]
  },
  31: {
    keyword: "山衣/鲨鱼/山药",
    suggestions: [
      { name: "鲨鱼", url: "🦈", description: "31谐音鲨鱼" },
      { name: "山药", url: "🥔", description: "31谐音山药" },
      { name: "衣服", url: "👔", description: "31山上有衣" },
      { name: "船", url: "🚢", description: "31鲨鱼船" }
    ]
  },
  32: {
    keyword: "扇儿/山鹅/伞儿",
    suggestions: [
      { name: "扇子", url: "🪭", description: "32谐音扇儿" },
      { name: "鹅", url: "🦢", description: "32山上鹅" },
      { name: "风车", url: "🌬️", description: "32像风车" },
      { name: "羽毛", url: "🪶", description: "32扇羽毛" }
    ]
  },
  33: {
    keyword: "双双/伞伞/珊珊",
    suggestions: [
      { name: "蝴蝶", url: "🦋", description: "33双双蝶" },
      { name: "双伞", url: "☂️", description: "33双双伞" },
      { name: "珍珠", url: "📿", description: "33像珊珊" },
      { name: "宝石", url: "💎", description: "33像宝石" }
    ]
  },
  34: {
    keyword: "山寺/扇子/山石",
    suggestions: [
      { name: "寺庙", url: "🏛️", description: "34山寺" },
      { name: "石头", url: "🪨", description: "34山石" },
      { name: "石碑", url: "🗿", description: "34像石碑" },
      { name: "宝塔", url: "🗼", description: "34山寺塔" }
    ]
  },
  35: {
    keyword: "山谷/伞舞/山虎",
    suggestions: [
      { name: "山谷", url: "🏞️", description: "35山谷" },
      { name: "老虎", url: "🐯", description: "35山中虎" },
      { name: "瀑布", url: "💦", description: "35山谷瀑布" },
      { name: "云雾", url: "☁️", description: "35山谷云雾" }
    ]
  },
  36: {
    keyword: "山柳/伞铃/山路",
    suggestions: [
      { name: "柳树", url: "🌿", description: "36山柳" },
      { name: "道路", url: "🛤️", description: "36山路" },
      { name: "山路", url: "🛣️", description: "36像山路" },
      { name: "铃铛", url: "🔔", description: "36伞上铃" }
    ]
  },
  37: {
    keyword: "山鸡/伞漆/散漆",
    suggestions: [
      { name: "山鸡", url: "🐔", description: "37山鸡" },
      { name: "孔雀", url: "🦚", description: "37像山鸡" },
      { name: "油漆", url: "🎨", description: "37散油漆" },
      { name: "彩虹", url: "🌈", description: "37像彩虹" }
    ]
  },
  38: {
    keyword: "女人/伞把/三爸",
    suggestions: [
      { name: "女人", url: "👩", description: "38谐音女人" },
      { name: "伞把", url: "🌂", description: "38像伞把" },
      { name: "葫芦", url: "🍶", description: "38像葫芦" },
      { name: "妈妈", url: "🤱", description: "38像妈妈" }
    ]
  },
  39: {
    keyword: "三角/山丘/伞钩",
    suggestions: [
      { name: "三角", url: "📐", description: "39三角" },
      { name: "山丘", url: "⛰️", description: "39山丘" },
      { name: "金字塔", url: "🔺", description: "39像金字塔" },
      { name: "钩子", url: "🪝", description: "39伞有钩" }
    ]
  },
  // 40-49
  40: {
    keyword: "司令/死灵/石洞",
    suggestions: [
      { name: "司令", url: "🎖️", description: "40谐音司令" },
      { name: "将军", url: "⚔️", description: "40像司令" },
      { name: "军帽", url: "🪖", description: "40像军帽" },
      { name: "勋章", url: "🏅", description: "40像勋章" }
    ]
  },
  41: {
    keyword: "司衣/死鱼/丝瓜",
    suggestions: [
      { name: "鱼", url: "🐟", description: "41死鱼" },
      { name: "丝瓜", url: "🥒", description: "41谐音丝瓜" },
      { name: "衣服", url: "👔", description: "41司令衣" },
      { name: "网", url: "🕸️", description: "41捕鱼网" }
    ]
  },
  42: {
    keyword: "死鹅/丝瓜/寺儿",
    suggestions: [
      { name: "天鹅", url: "🦢", description: "42死鹅" },
      { name: "鸭子", url: "🦆", description: "42寺儿鸭" },
      { name: "丝瓜", url: "🍈", description: "42谐音丝瓜" },
      { name: "葫芦", url: "🍶", description: "42像葫芦" }
    ]
  },
  43: {
    keyword: "死山/石山/寺山",
    suggestions: [
      { name: "山", url: "⛰️", description: "43石山" },
      { name: "火山", url: "🌋", description: "43死火山" },
      { name: "石碑", url: "🪦", description: "43石碑" },
      { name: "岩石", url: "🪨", description: "43山石" }
    ]
  },
  44: {
    keyword: "死死/石狮/试试",
    suggestions: [
      { name: "石狮", url: "🦁", description: "44石狮" },
      { name: "寺庙", url: "⛩️", description: "44寺寺" },
      { name: "老虎", url: "🐅", description: "44石虎" },
      { name: "麒麟", url: "🦄", description: "44像麒麟" }
    ]
  },
  45: {
    keyword: "食物/石屋/死虎",
    suggestions: [
      { name: "食物", url: "🍱", description: "45谐音食物" },
      { name: "房子", url: "🏠", description: "45石屋" },
      { name: "汉堡", url: "🍔", description: "45食物" },
      { name: "面包", url: "🥐", description: "45食物" }
    ]
  },
  46: {
    keyword: "死柳/石榴/思路",
    suggestions: [
      { name: "石榴", url: "🍎", description: "46谐音石榴" },
      { name: "柳树", url: "🌿", description: "46死柳" },
      { name: "苹果", url: "🍏", description: "46像石榴" },
      { name: "樱桃", url: "🍒", description: "46像樱桃" }
    ]
  },
  47: {
    keyword: "司机/死鸡/武器",
    suggestions: [
      { name: "司机", url: "🚕", description: "47谐音司机" },
      { name: "方向盘", url: "🔄", description: "47像方向盘" },
      { name: "汽车", url: "🚗", description: "47司机车" },
      { name: "卡车", url: "🚚", description: "47司机开" }
    ]
  },
  48: {
    keyword: "死花/石坝/丝瓜",
    suggestions: [
      { name: "荷花", url: "🪷", description: "48死花" },
      { name: "坝", url: "🌊", description: "48石坝" },
      { name: "玫瑰", url: "🌹", description: "48像死花" },
      { name: "菊花", url: "🌼", description: "48像菊花" }
    ]
  },
  49: {
    keyword: "死狗/四舅/酒家",
    suggestions: [
      { name: "狗", url: "🐕", description: "49死狗" },
      { name: "舅舅", url: "👨", description: "49四舅" },
      { name: "酒店", url: "🏨", description: "49酒家" },
      { name: "酒瓶", url: "🍾", description: "49酒瓶" }
    ]
  },
  // 50-59
  50: {
    keyword: "武林/舞林/屋洞",
    suggestions: [
      { name: "武术", url: "🥋", description: "50武林" },
      { name: "功夫", url: "🗡️", description: "50武术" },
      { name: "太极", url: "☯️", description: "50像太极" },
      { name: "拳脚", url: "👊", description: "50武林拳" }
    ]
  },
  51: {
    keyword: "舞衣/乌鸦/屋衣",
    suggestions: [
      { name: "乌鸦", url: "🐦‍⬛", description: "51谐音乌鸦" },
      { name: "燕子", url: "🐦", description: "51像燕子" },
      { name: "衣服", url: "👗", description: "51舞衣" },
      { name: "鸟", url: "🕊️", description: "51像鸟" }
    ]
  },
  52: {
    keyword: "舞儿/屋鹅/吾儿",
    suggestions: [
      { name: "天鹅", url: "🦢", description: "52舞鹅" },
      { name: "白鹅", url: "🪿", description: "52白鹅" },
      { name: "小鸟", url: "🐦", description: "52吾儿鸟" },
      { name: "鸟巢", url: "🪹", description: "52吾儿巢" }
    ]
  },
  53: {
    keyword: "舞伞/乌山/巫山",
    suggestions: [
      { name: "山", url: "⛰️", description: "53巫山" },
      { name: "雨伞", url: "☂️", description: "53舞伞" },
      { name: "云雾", url: "☁️", description: "53巫山云" },
      { name: "雨", url: "🌧️", description: "53打伞" }
    ]
  },
  54: {
    keyword: "舞狮/武士/屋寺",
    suggestions: [
      { name: "狮子", url: "🦁", description: "54舞狮" },
      { name: "武士", url: "🥷", description: "54武士" },
      { name: "寺庙", url: "⛩️", description: "54屋寺" },
      { name: "剑", url: "⚔️", description: "54武士剑" }
    ]
  },
  55: {
    keyword: "舞舞/呜呜/虎虎",
    suggestions: [
      { name: "老虎", url: "🐯", description: "55虎虎" },
      { name: "舞蹈", url: "💃", description: "55舞舞" },
      { name: "双虎", url: "🐅", description: "55双虎" },
      { name: "鼓", url: "🥁", description: "55咚咚" }
    ]
  },
  56: {
    keyword: "物流/舞柳/五柳",
    suggestions: [
      { name: "卡车", url: "🚚", description: "56物流" },
      { name: "柳树", url: "🌿", description: "56五柳" },
      { name: "货车", url: "🚛", description: "56物流车" },
      { name: "箱子", url: "📦", description: "56物流箱" }
    ]
  },
  57: {
    keyword: "武器/舞鸡/屋脊",
    suggestions: [
      { name: "武器", url: "🛡️", description: "57谐音武器" },
      { name: "剑", url: "🗡️", description: "57武器" },
      { name: "枪", url: "🔫", description: "57武器" },
      { name: "弓箭", url: "🏹", description: "57武器" }
    ]
  },
  58: {
    keyword: "舞吧/五八/窝粑",
    suggestions: [
      { name: "舞台", url: "🎭", description: "58舞吧" },
      { name: "酒吧", url: "🍺", description: "58酒吧" },
      { name: "麦克风", url: "🎤", description: "58舞吧唱" },
      { name: "音乐", url: "🎵", description: "58舞吧曲" }
    ]
  },
  59: {
    keyword: "舞舅/无酒/屋旧",
    suggestions: [
      { name: "酒杯", url: "🍷", description: "59无酒" },
      { name: "空瓶", url: "🫙", description: "59无酒瓶" },
      { name: "叔叔", url: "👨", description: "59舞舅" },
      { name: "空杯", url: "🥃", description: "59空酒杯" }
    ]
  },
  // 60-69
  60: {
    keyword: "绿林/柳洞/流转",
    suggestions: [
      { name: "森林", url: "🌲", description: "60绿林" },
      { name: "树林", url: "🌳", description: "60柳林" },
      { name: "山洞", url: "🕳️", description: "60柳洞" },
      { name: "树叶", url: "🍃", description: "60绿叶" }
    ]
  },
  61: {
    keyword: "六一/儿童/流衣",
    suggestions: [
      { name: "儿童", url: "👦", description: "61六一" },
      { name: "礼物", url: "🎁", description: "61礼物" },
      { name: "气球", url: "🎈", description: "61气球" },
      { name: "糖果", url: "🍬", description: "61糖果" }
    ]
  },
  62: {
    keyword: "牛儿/柳儿/六耳",
    suggestions: [
      { name: "牛", url: "🐮", description: "62牛儿" },
      { name: "小牛", url: "🐄", description: "62小牛" },
      { name: "牛奶", url: "🥛", description: "62牛奶" },
      { name: "耳朵", url: "👂", description: "62六耳" }
    ]
  },
  63: {
    keyword: "硫酸/牛山/流散",
    suggestions: [
      { name: "烧杯", url: "🧪", description: "63硫酸" },
      { name: "试管", url: "🧫", description: "63试管" },
      { name: "药水", url: "🧴", description: "63硫酸" },
      { name: "实验室", url: "🔬", description: "63实验室" }
    ]
  },
  64: {
    keyword: "牛屎/律师/六四",
    suggestions: [
      { name: "律师", url: "📜", description: "64谐音律师" },
      { name: "天平", url: "⚖️", description: "64天平" },
      { name: "法官", url: "👨‍⚖️", description: "64像法官" },
      { name: "法槌", url: "🔨", description: "64法槌" }
    ]
  },
  65: {
    keyword: "落伍/牛虎/六五",
    suggestions: [
      { name: "老虎", url: "🐯", description: "65牛虎" },
      { name: "牛", url: "🐮", description: "65落伍牛" },
      { name: "钟表", url: "⏰", description: "65落伍" },
      { name: "老钟", url: "🕰️", description: "65老钟" }
    ]
  },
  66: {
    keyword: "牛牛/柳柳/六六",
    suggestions: [
      { name: "牛群", url: "🐄", description: "66牛牛" },
      { name: "牛", url: "🐮", description: "66牛" },
      { name: "六", url: "6️⃣", description: "66六六" },
      { name: "顺", url: "✅", description: "66大顺" }
    ]
  },
  67: {
    keyword: "牛漆/鹿鸡/六妻",
    suggestions: [
      { name: "油漆", url: "🎨", description: "67牛漆" },
      { name: "鸡", url: "🐔", description: "67鹿鸡" },
      { name: "刷子", url: "🖌️", description: "67漆刷" },
      { name: "涂料", url: "🪣", description: "67涂料" }
    ]
  },
  68: {
    keyword: "牛爸/绿坝/六八",
    suggestions: [
      { name: "爸爸", url: "👨", description: "68牛爸" },
      { name: "牛", url: "🐂", description: "68牛" },
      { name: "篱笆", url: "🚧", description: "68绿坝" },
      { name: "栅栏", url: "🪜", description: "68栅栏" }
    ]
  },
  69: {
    keyword: "六舅/牛脚/绿酒",
    suggestions: [
      { name: "舅舅", url: "👨", description: "69六舅" },
      { name: "脚", url: "🦶", description: "69牛脚" },
      { name: "酒瓶", url: "🍾", description: "69绿酒" },
      { name: "酒杯", url: "🍷", description: "69酒杯" }
    ]
  },
  // 70-79
  70: {
    keyword: "麒麟/奇洞/七零",
    suggestions: [
      { name: "麒麟", url: "🦄", description: "70谐音麒麟" },
      { name: "龙", url: "🐉", description: "70像龙" },
      { name: "凤凰", url: "🦚", description: "70像凤凰" },
      { name: "神兽", url: "🐲", description: "70神兽" }
    ]
  },
  71: {
    keyword: "七一/起义/奇衣",
    suggestions: [
      { name: "红旗", url: "🚩", description: "71起义" },
      { name: "党员", url: "👨", description: "71党员" },
      { name: "衣服", url: "🎽", description: "71奇衣" },
      { name: "徽章", url: "🏅", description: "71徽章" }
    ]
  },
  72: {
    keyword: "七二/妻儿/奇鹅",
    suggestions: [
      { name: "妻子", url: "👩", description: "72妻儿" },
      { name: "天鹅", url: "🦢", description: "72奇鹅" },
      { name: "儿子", url: "👶", description: "72奇儿" },
      { name: "小孩", url: "🧒", description: "72奇儿" }
    ]
  },
  73: {
    keyword: "奇山/气散/妻散",
    suggestions: [
      { name: "山", url: "⛰️", description: "73奇山" },
      { name: "云雾", url: "☁️", description: "73气散" },
      { name: "仙山", url: "🏔️", description: "73仙山" },
      { name: "雾气", url: "🌫️", description: "73雾气" }
    ]
  },
  74: {
    keyword: "骑士/气死/奇石",
    suggestions: [
      { name: "骑士", url: "🤴", description: "74骑士" },
      { name: "马", url: "🐴", description: "74骑士马" },
      { name: "石头", url: "🪨", description: "74奇石" },
      { name: "宝剑", url: "⚔️", description: "74骑士剑" }
    ]
  },
  75: {
    keyword: "起舞/气雾/七五",
    suggestions: [
      { name: "舞蹈", url: "💃", description: "75起舞" },
      { name: "舞", url: "🕺", description: "75起舞" },
      { name: "雾气", url: "🌫️", description: "75气雾" },
      { name: "彩虹", url: "🌈", description: "75彩虹" }
    ]
  },
  76: {
    keyword: "七六/骑鹿/气流",
    suggestions: [
      { name: "鹿", url: "🦌", description: "76骑鹿" },
      { name: "气流", url: "💨", description: "76气流" },
      { name: "风", url: "🌬️", description: "76风" },
      { name: "龙卷风", url: "🌪️", description: "76龙卷风" }
    ]
  },
  77: {
    keyword: "七七/棋棋/齐齐",
    suggestions: [
      { name: "象棋", url: "♟️", description: "77棋棋" },
      { name: "棋盘", url: "🎯", description: "77棋盘" },
      { name: "七", url: "7️⃣", description: "77七七" },
      { name: "双七", url: "🌌", description: "77七夕星空" }
    ]
  },
  78: {
    keyword: "七爸/奇葩/气发",
    suggestions: [
      { name: "奇葩", url: "🌺", description: "78谐音奇葩" },
      { name: "花", url: "🌸", description: "78奇葩" },
      { name: "爸爸", url: "👨", description: "78七爸" },
      { name: "愤怒", url: "😤", description: "78气发" }
    ]
  },
  79: {
    keyword: "七舅/气酒/齐救",
    suggestions: [
      { name: "舅舅", url: "👨", description: "79七舅" },
      { name: "酒瓶", url: "🍾", description: "79气酒" },
      { name: "救护车", url: "🚑", description: "79齐救" },
      { name: "医生", url: "👨‍⚕️", description: "79齐救" }
    ]
  },
  // 80-89
  80: {
    keyword: "八零/发令/疤洞",
    suggestions: [
      { name: "发令", url: "🏃", description: "80发令" },
      { name: "枪", url: "🔫", description: "80发令枪" },
      { name: "起跑", url: "🏁", description: "80起跑" },
      { name: "裁判", url: "🧑‍⚖️", description: "80裁判" }
    ]
  },
  81: {
    keyword: "八一/发衣/疤衣",
    suggestions: [
      { name: "军人", url: "🪖", description: "81八一" },
      { name: "红旗", url: "🚩", description: "81红旗" },
      { name: "军装", url: "🎖️", description: "81军衣" },
      { name: "勋章", url: "🏅", description: "81勋章" }
    ]
  },
  82: {
    keyword: "八二/发儿/疤儿",
    suggestions: [
      { name: "儿子", url: "👦", description: "82发儿" },
      { name: "小孩", url: "🧒", description: "82发儿" },
      { name: "婴儿", url: "👶", description: "82发儿" },
      { name: "爸爸", url: "👨‍👦", description: "82父子" }
    ]
  },
  83: {
    keyword: "八三/发伞/八山",
    suggestions: [
      { name: "伞", url: "☂️", description: "83发伞" },
      { name: "山", url: "⛰️", description: "83八山" },
      { name: "发财", url: "💰", description: "83发财" },
      { name: "金山", url: "🗻", description: "83金山" }
    ]
  },
  84: {
    keyword: "八四/发誓/发矢",
    suggestions: [
      { name: "发誓", url: "✋", description: "84发誓" },
      { name: "箭头", url: "➡️", description: "84发矢" },
      { name: "弓箭", url: "🏹", description: "84弓箭" },
      { name: "箭", url: "🎯", description: "84箭" }
    ]
  },
  85: {
    keyword: "八五/发我/八虎",
    suggestions: [
      { name: "我", url: "🙋", description: "85发我" },
      { name: "老虎", url: "🐯", description: "85八虎" },
      { name: "钱", url: "💵", description: "85发我钱" },
      { name: "钱包", url: "👛", description: "85钱包" }
    ]
  },
  86: {
    keyword: "八六/发柳/巴柳",
    suggestions: [
      { name: "柳树", url: "🌿", description: "86发柳" },
      { name: "树", url: "🌳", description: "86巴柳" },
      { name: "发芽", url: "🌱", description: "86发芽" },
      { name: "种子", url: "🌰", description: "86种子" }
    ]
  },
  87: {
    keyword: "八七/发起/巴妻",
    suggestions: [
      { name: "妻子", url: "👩", description: "87巴妻" },
      { name: "鸡", url: "🐔", description: "87发起" },
      { name: "开始", url: "🌅", description: "87日出开始" },
      { name: "火箭", url: "🚀", description: "87发起" }
    ]
  },
  88: {
    keyword: "八八/爸爸/发发",
    suggestions: [
      { name: "爸爸", url: "👨", description: "88爸爸" },
      { name: "发财", url: "💰", description: "88发发" },
      { name: "葫芦", url: "🍶", description: "88葫芦" },
      { name: "雪人", url: "☃️", description: "88雪人" }
    ]
  },
  89: {
    keyword: "八舅/发酒/八九",
    suggestions: [
      { name: "舅舅", url: "👨", description: "89八舅" },
      { name: "酒", url: "🍾", description: "89发酒" },
      { name: "酒杯", url: "🍷", description: "89酒杯" },
      { name: "发财酒", url: "🍶", description: "89发财酒" }
    ]
  },
  // 90-99
  90: {
    keyword: "九零/酒洞/舅洞",
    suggestions: [
      { name: "酒窖", url: "🍷", description: "90酒洞" },
      { name: "洞", url: "🕳️", description: "90洞" },
      { name: "酒瓶", url: "🍾", description: "90酒瓶" },
      { name: "酒坛", url: "🏺", description: "90酒坛" }
    ]
  },
  91: {
    keyword: "九一/酒衣/舅衣",
    suggestions: [
      { name: "衣服", url: "👕", description: "91酒衣" },
      { name: "和服", url: "👘", description: "91和服" },
      { name: "酒保", url: "🤵", description: "91酒保" },
      { name: "制服", url: "🥼", description: "91制服" }
    ]
  },
  92: {
    keyword: "九二/酒儿/舅儿",
    suggestions: [
      { name: "儿子", url: "👦", description: "92酒儿" },
      { name: "小孩", url: "🧒", description: "92酒儿" },
      { name: "醉汉", url: "🥴", description: "92醉汉" },
      { name: "酒瓶", url: "🍶", description: "92酒瓶" }
    ]
  },
  93: {
    keyword: "九三/酒山/舅山",
    suggestions: [
      { name: "山", url: "⛰️", description: "93酒山" },
      { name: "酒桶", url: "🛢️", description: "93酒桶" },
      { name: "酒窖", url: "🏚️", description: "93酒窖" },
      { name: "山庄", url: "🏡", description: "93山庄" }
    ]
  },
  94: {
    keyword: "九四/酒食/九死",
    suggestions: [
      { name: "食物", url: "🍱", description: "94酒食" },
      { name: "酒席", url: "🍽️", description: "94酒席" },
      { name: "餐具", url: "🍴", description: "94餐具" },
      { name: "骷髅", url: "💀", description: "94九死" }
    ]
  },
  95: {
    keyword: "九五/酒虎/九武",
    suggestions: [
      { name: "老虎", url: "🐯", description: "95酒虎" },
      { name: "皇帝", url: "🤴", description: "95九五至尊" },
      { name: "龙", url: "🐉", description: "95龙" },
      { name: "皇冠", url: "👑", description: "95皇冠" }
    ]
  },
  96: {
    keyword: "九六/酒柳/久留",
    suggestions: [
      { name: "柳树", url: "🌿", description: "96酒柳" },
      { name: "久留", url: "♾️", description: "96久留" },
      { name: "沙漏", url: "⏳", description: "96沙漏" },
      { name: "树", url: "🌳", description: "96柳树" }
    ]
  },
  97: {
    keyword: "九七/酒器/久期",
    suggestions: [
      { name: "酒杯", url: "🥂", description: "97酒器" },
      { name: "茶壶", url: "🫖", description: "97酒器" },
      { name: "酒瓶", url: "🍶", description: "97酒瓶" },
      { name: "酒具", url: "🍷", description: "97酒具" }
    ]
  },
  98: {
    keyword: "九八/酒发/九爸",
    suggestions: [
      { name: "发财", url: "💰", description: "98酒发" },
      { name: "爸爸", url: "👨", description: "98九爸" },
      { name: "金币", url: "🪙", description: "98金币" },
      { name: "钱袋", url: "🧧", description: "98红包" }
    ]
  },
  99: {
    keyword: "久久/舅舅/酒酒",
    suggestions: [
      { name: "舅舅", url: "👨", description: "99舅舅" },
      { name: "久久", url: "⏰", description: "99久久" },
      { name: "双酒", url: "🍾", description: "99双酒" },
      { name: "长寿", url: "🍑", description: "99长寿" }
    ]
  }
};

/**
 * 获取数字的推荐图片
 * @param number 数字 (0-99)
 * @returns 推荐图片列表
 */
export function getRecommendedImages(number: number) {
  if (number < 0 || number > 99) {
    return [];
  }
  return presetImageMap[number]?.suggestions || [];
}

/**
 * 获取数字的关键词
 * @param number 数字 (0-99)
 * @returns 关键词
 */
export function getNumberKeyword(number: number): string {
  if (number < 0 || number > 99) {
    return "";
  }
  return presetImageMap[number]?.keyword || "";
}

/**
 * 获取所有预设数字的列表
 * @param range 范围: 'single' (0-9), 'double' (10-99), 'all' (0-99), 默认 'all'
 * @returns 数字列表
 */
export function getAllPresetNumbers(range: 'single' | 'double' | 'all' = 'all'): number[] {
  switch (range) {
    case 'single':
      return [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    case 'double':
      return Array.from({ length: 90 }, (_, i) => i + 10);
    case 'all':
    default:
      return Array.from({ length: 100 }, (_, i) => i);
  }
}

/**
 * 随机打乱数组
 * @param array 数组
 * @returns 打乱后的数组
 */
export function shuffleArray<T>(array: T[]): T[] {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

/**
 * 随机选择指定数量的不重复数字
 * @param count 数量
 * @param range 范围: 'single' (0-9), 'double' (10-99), 'all' (0-99), 默认 'all'
 * @returns 随机数字数组
 */
export function getRandomNumbers(count: number, range: 'single' | 'double' | 'all' = 'all'): number[] {
  const numbers = getAllPresetNumbers(range);
  return shuffleArray(numbers).slice(0, Math.min(count, numbers.length));
}
