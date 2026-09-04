#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""向诗词内置库追加经典篇目（2026-09-04 批次）。

用法：python3 scripts/add_poetry_20260904.py [--check]
  --check 只做重复/校验检查，不写盘。

写回规则：json.dumps(ensure_ascii=False, indent=2)，文件结尾不加换行，
与现有文件的 roundtrip 结果保持一致（已验证）。
"""
import json
import os
import sys

BASE = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                    'public', 'datafile', 'poetry')
UPDATED = '2026-09-04'
NEW_VERSION = '2.1'

CHECK_ONLY = '--check' in sys.argv


def load(path):
    with open(path, encoding='utf-8') as f:
        return json.load(f)


def dump(obj):
    return json.dumps(obj, ensure_ascii=False, indent=2)


def P(n, t, a, d, c, ct, tags, **kw):
    """构造一条诗词：n=序号, t=标题, a=作者, d=dynastyCode, c=内容, ct=contentType"""
    return {'n': n, 'title': t, 'author': a, 'dynastyCode': d, 'content': c,
            'contentType': ct, 'tags': tags, **kw}


TANG = [
    P('185', '题都城南庄', '崔护', 'tang',
      '去年今日此门中，人面桃花相映红。\n人面不知何处去，桃花依旧笑春风。',
      'poetry', ['七言绝句', '写景', '名篇'],
      source='《全唐诗》', location='长安', year=780),
    P('186', '赠别·其一', '杜牧', 'tang',
      '多情却似总无情，唯觉樽前笑不成。\n蜡烛有心还惜别，替人垂泪到天明。',
      'poetry', ['七言绝句', '送别', '名篇'],
      source='《全唐诗》', location='扬州', year=826),
    P('187', '遣怀', '杜牧', 'tang',
      '落魄江湖载酒行，楚腰纤细掌中轻。\n十年一觉扬州梦，赢得青楼薄幸名。',
      'poetry', ['七言绝句', '抒怀', '名篇'],
      source='《全唐诗》', location='扬州', year=824),
    P('188', '金谷园', '杜牧', 'tang',
      '繁华事散逐香尘，流水无情草自春。\n日暮东风怨啼鸟，落花犹似坠楼人。',
      'poetry', ['七言绝句', '怀古'],
      source='《全唐诗》', location='洛阳', year=826),
    P('189', '商山早行', '温庭筠', 'tang',
      '晨起动征铎，客行悲故乡。\n鸡声茅店月，人迹板桥霜。\n槲叶落山路，枳花明驿墙。\n因思杜陵梦，凫雁满回塘。',
      'poetry', ['五言律诗', '羁旅', '必背', '名篇'],
      source='《全唐诗》', location='长安', year=830),
    P('190', '题李凝幽居', '贾岛', 'tang',
      '闲居少邻并，草径入荒园。\n鸟宿池边树，僧敲月下门。\n过桥分野色，移石动云根。\n暂去还来此，幽期不负言。',
      'poetry', ['五言律诗', '访友', '必背', '名篇'],
      source='《全唐诗》', location='长安', year=825),
    P('191', '凉州词二首·其一', '王翰', 'tang',
      '葡萄美酒夜光杯，欲饮琵琶马上催。\n醉卧沙场君莫笑，古来征战几人回。',
      'poetry', ['七言绝句', '边塞', '必背', '名篇'],
      source='《全唐诗》', year=742),
    P('192', '塞下曲·其四', '卢纶', 'tang',
      '月黑雁飞高，单于夜遁逃。\n欲将轻骑逐，大雪满弓刀。',
      'poetry', ['五言绝句', '边塞', '必背'],
      source='《全唐诗》', year=783),
    P('193', '清平调三首·其一', '李白', 'tang',
      '云想衣裳花想容，春风拂槛露华浓。\n若非群玉山头见，会向瑶台月下逢。',
      'ci', ['七言绝句', '咏物', '名篇'],
      source='《全唐诗》', location='长安', year=742),
    P('194', '望月怀远', '张九龄', 'tang',
      '海上生明月，天涯共此时。\n情人怨遥夜，竟夕起相思。\n灭烛怜光满，披衣觉露滋。\n不堪盈手赠，还寝梦佳期。',
      'poetry', ['五言律诗', '怀人', '必背', '名篇'],
      source='《全唐诗》', location='长安', year=693),
    P('195', '山中送别', '王维', 'tang',
      '山中相送罢，日暮掩柴扉。\n青霭入看无，白云持赠归。',
      'poetry', ['五言绝句', '送别', '名篇'],
      source='《全唐诗》', year=735),
    P('196', '杂诗·君自故乡来', '王维', 'tang',
      '君自故乡来，应知故乡事。\n来日绮窗前，寒梅著花未。',
      'poetry', ['五言绝句', '思乡', '必背', '名篇'],
      source='《全唐诗》', location='长安', year=742),
    P('197', '送别·下马饮君酒', '王维', 'tang',
      '下马饮君酒，问君何所之。\n君言不得意，归卧南山陲。\n但去莫复问，白云无尽时。',
      'poetry', ['五言古诗', '送别'],
      source='《全唐诗》', location='长安', year=738),
    P('198', '终南山', '王维', 'tang',
      '太乙近天都，连山接海隅。\n白云回望合，青霭入看无。\n分野中峰变，阴晴众壑殊。\n欲投人处宿，隔水问樵夫。',
      'poetry', ['五言律诗', '写景', '必背', '名篇'],
      source='《全唐诗》', location='长安', year=737),
    P('199', '登楼', '杜甫', 'tang',
      '花近高楼伤客心，万方多难此登临。\n锦江春色来天地，玉垒浮云变古今。\n北极朝廷终不改，西山寇盗莫相侵。\n可怜后主还祠庙，日暮聊为《梁甫吟》。',
      'poetry', ['七言律诗', '怀古', '必背', '名篇'],
      source='《全唐诗》', location='成都', year=764),
    P('200', '绝句·两个黄鹂鸣翠柳', '杜甫', 'tang',
      '两个黄鹂鸣翠柳，一行白鹭上青天。\n窗含西岭千秋雪，门泊东吴万里船。',
      'poetry', ['七言绝句', '写景', '必背', '名篇'],
      source='《全唐诗》', location='成都', year=764),
    P('201', '渔翁', '柳宗元', 'tang',
      '烟销日出不见人，欸乃一声山水绿。\n回看天际下中流，岩上无心云相逐。',
      'poetry', ['五言绝句', '写景', '名篇'],
      source='《全唐诗》', year=815),
    P('202', '长恨歌（节选）', '白居易', 'tang',
      '汉皇重色思倾国，御宇多年求不得。\n杨家有女初长成，养在深闺人未识。\n春寒赐浴华清池，温泉水滑洗凝脂。\n云鬓花颜金步摇，芙蓉帐暖度春宵。\n春宵苦短日高起，从此君王不早朝。\n\n临别殷勤终寄词，词中有誓两心知。\n七月七日长生殿，夜半无人私语时。\n在天愿作比翼鸟，在地愿为连理枝。\n天长地久有时尽，此恨绵绵无绝期。',
      'prose', ['长篇叙事诗', '爱情', '必背', '名篇'],
      source='《全唐诗》', location='长安', year=806),
    P('203', '登科后', '孟郊', 'tang',
      '昔日龌龊不足夸，今朝放荡思无涯。\n春风得意马蹄疾，一日看尽长安花。',
      'poetry', ['七言绝句', '抒怀', '名篇'],
      source='《全唐诗》', location='长安', year=766),
    P('204', '望洞庭', '刘禹锡', 'tang',
      '湖光秋月两相和，潭面无风镜未磨。\n遥望洞庭山水翠，白银盘里一青螺。',
      'poetry', ['七言绝句', '写景', '必背', '名篇'],
      source='《全唐诗》', location='岳阳', year=824),
]

SONG = [
    P('084', '水龙吟·登建康赏心亭', '辛弃疾', 'song',
      '楚天千里清秋，水随天去秋无际。\n遥岑远目，献愁供恨，玉簪螺髻。\n落日楼头，断鸿声里，江南游子。\n把吴钩看了，栏杆拍遍，无人会，登临意。\n\n休说鲈鱼堪脍，尽西风，季鹰归未？\n求田问舍，怕应羞见，刘郎才气。\n可惜流年，忧愁风雨，树犹如此！\n倩何人唤取，红巾翠袖，揾英雄泪。',
      'ci', ['宋词', '登临', '名篇'],
      source='《稼轩长短句》', location='南京', year=1173),
    P('085', '摸鱼儿·更能消除几番风雨', '辛弃疾', 'song',
      '更能消、几番风雨，匆匆春又归去。\n惜春长怕花开早，何况落红无数。\n春且住，见说道，天涯芳草无归路。\n怨春不语。算只有殷勤，画檐蛛网，尽日惹飞絮。\n\n长门事，准拟佳期又误。\n蛾眉曾有人妒。\n千金纵买相如赋，脉脉此情谁诉？\n君莫舞，君不见、玉环飞燕皆尘土！\n闲愁最苦。休去倚危栏，斜阳正在，烟柳断肠处。',
      'ci', ['宋词', '咏春', '名篇'],
      source='《稼轩长短句》', location='绍兴', year=1180),
    P('086', '清平乐·春归何处', '黄庭坚', 'song',
      '春归何处？寂寞无行路。\n若有人知春去处，唤取归来同住。\n春无踪迹谁知？除非问取黄鹂。\n百啭无人能解，因风飞过蔷薇。',
      'ci', ['宋词', '咏春', '必背', '名篇'],
      source='《山谷词》', year=1115),
    P('087', '卜算子·黄州定慧院寓居作', '苏轼', 'song',
      '缺月挂疏桐，漏断人初静。\n谁见幽人独往来，缥缈孤鸿影。\n惊起却回头，有恨无人省。\n拣尽寒枝不肯栖，寂寞沙洲冷。',
      'ci', ['宋词', '咏物', '必背', '名篇'],
      source='《东坡乐府》', location='黄冈', year=1082),
    P('088', '西江月·世事一场大梦', '苏轼', 'song',
      '世事一场大梦，人生几度秋凉。\n夜来风叶已鸣廊，看取眉头鬓上。\n酒贱常愁客少，月明多被云妨。\n中秋谁与共孤光，把盏凄然北望。',
      'ci', ['宋词', '中秋', '名篇'],
      source='《东坡乐府》', location='黄冈', year=1094),
    P('089', '临江仙·夜饮东坡醒复醉', '苏轼', 'song',
      '夜饮东坡醒复醉，归来仿佛三更。\n家童鼻息已雷鸣。\n敲门都不应，倚杖听江声。\n\n长恨此身非我有，何时忘却营营？\n夜阑风静縠纹平。\n小舟从此逝，江海寄余生。',
      'ci', ['宋词', '抒怀', '必背', '名篇'],
      source='《东坡乐府》', location='黄冈', year=1082),
    P('090', '临江仙·送钱穆父', '苏轼', 'song',
      '一别都门三改火，天涯踏尽红尘。\n依然一笑作春温。\n无波真古井，有节是秋筠。\n\n惆怅孤帆连夜发，送行淡月微云。\n尊前不用翠眉颦。\n人生如逆旅，我亦是行人。',
      'ci', ['宋词', '送别', '必背', '名篇'],
      source='《东坡乐府》', location='杭州', year=1097),
    P('091', '浣溪沙·细雨斜风作晓寒', '苏轼', 'song',
      '细雨斜风作晓寒，淡烟疏柳媚晴滩。\n入淮清洛渐漫漫。\n雪沫乳花浮午盏，蓼茸蒿笋试春盘。\n人间有味是清欢。',
      'ci', ['宋词', '咏物', '名篇'],
      source='《东坡乐府》', year=1082),
    P('092', '醉花阴·薄雾浓云愁永昼', '李清照', 'song',
      '薄雾浓云愁永昼，瑞脑消金兽。\n佳节又重阳，玉枕纱厨，半夜凉初透。\n东篱把酒黄昏后，有暗香盈袖。\n莫道不销魂，帘卷西风，人比黄花瘦。',
      'ci', ['宋词', '重阳', '必背', '名篇'],
      source='《漱玉词》', location='济南', year=1115),
    P('093', '点绛唇·蹴罢秋千', '李清照', 'song',
      '蹴罢秋千，起来慵整纤纤手。\n露浓花瘦，薄汗轻衣透。\n见客入来，袜刬金钗溜。\n和羞走，倚门回首，却把青梅嗅。',
      'ci', ['宋词', '闺情', '必背', '名篇'],
      source='《漱玉词》', location='济南', year=1110),
    P('094', '清平乐·年年雪里', '李清照', 'song',
      '年年雪里，常插梅花醉。\n挼尽梅花无好意，赢得满衣清泪。\n今年海角天涯，萧萧两鬓生华。\n看取晚来风势，故应难看梅花。',
      'ci', ['宋词', '咏物', '名篇'],
      source='《漱玉词》', year=1129),
    P('095', '八声甘州·对潇潇暮雨洒江天', '柳永', 'song',
      '对潇潇暮雨洒江天，一番洗清秋。\n渐霜风凄紧，关河冷落，残照当楼。\n是处红衰翠减，苒苒物华休。\n惟有长江水，无语东流。\n\n不忍登高临远，望故乡渺邈，归思难收。\n叹年来踪迹，何事苦淹留？\n想佳人、妆楼颙望，误几回、天际识归舟。\n争知我，倚阑干处，正恁凝愁。',
      'ci', ['宋词', '思乡', '必背', '名篇'],
      source='《乐章集》', location='杭州', year=1015),
    P('096', '踏莎行·候馆梅残', '欧阳修', 'song',
      '候馆梅残，溪桥柳细。\n草薰风暖摇征辔。\n离愁渐远渐无穷，迢迢不断如春水。\n寸寸柔肠，盈盈粉泪。\n楼高莫近危阑倚。\n平芜尽处是春山，行人更在春山外。',
      'ci', ['宋词', '思乡', '名篇'],
      source='《六一词》', location='开封', year=1026),
    P('097', '元日', '王安石', 'song',
      '爆竹声中一岁除，春风送暖入屠苏。\n千门万户曈曈日，总把新桃换旧符。',
      'poetry', ['七言绝句', '咏节令', '必背', '名篇'],
      source='《王临川集》', location='开封', year=1059),
    P('098', '采桑子·轻舟短棹西湖好', '欧阳修', 'song',
      '轻舟短棹西湖好，绿水逶迤。芳草长堤。隐隐笙歌处处随。\n无风水面琉璃滑，不觉船移。微动涟漪。惊起沙禽掠水飞。',
      'ci', ['宋词', '写景', '必背', '名篇'],
      source='《六一词》', location='杭州', year=1038),
]

XIANQIN = [
    P('013', '击鼓（节选）', '佚名', 'xianqin',
      '击鼓其镗，踊跃用兵。\n土国城漕，我独南行。\n从孙子仲，平陈与宋。\n不我以归，忧心有忡。\n\n死生契阔，与子成说。\n执子之手，与子偕老。',
      'poetry', ['诗经', '必背', '名篇'],
      source='《诗经·邶风》', year=-800),
    P('014', '东山（节选）', '佚名', 'xianqin',
      '我徂东山，慆慆不归。\n我来自东，零雨其濛。\n我匪愆期，不如归，不如归。',
      'poetry', ['诗经'],
      source='《诗经·豳风》', year=-800),
    P('015', '燕燕（节选）', '佚名', 'xianqin',
      '燕燕于飞，差池其羽。\n之子于归，远送于野。\n瞻望弗及，泣涕如雨。',
      'poetry', ['诗经', '送别'],
      source='《诗经·邶风》', year=-800),
    P('016', '相鼠', '佚名', 'xianqin',
      '相鼠有皮，人而无仪！\n人而无仪，不死何为？\n相鼠有齿，人而无止！\n人而无止，不死何俟？\n相鼠有体，人而无礼！\n人而无礼，胡不遄死？',
      'poetry', ['诗经', '讽刺'],
      source='《诗经·邶风》', year=-800),
    P('017', '鹿鸣（节选）', '佚名', 'xianqin',
      '呦呦鹿鸣，食野之苹。\n我有嘉宾，鼓瑟吹笙。\n吹笙鼓簧，承筐是将。\n人之好我，示我周行。',
      'poetry', ['诗经', '必背', '宴饮'],
      source='《诗经·小雅》', year=-800),
    P('018', '月出', '佚名', 'xianqin',
      '月出皎兮，佼人僚兮。\n舒窈纠兮，劳心悄兮。\n月出皓兮，佼人懰兮。\n舒忧受兮，劳心慅兮。\n月出照兮，佼人燎兮。\n舒夭绍兮，劳心惨兮。',
      'poetry', ['诗经', '名篇', '怀人'],
      source='《诗经·陈风》', year=-800),
    P('019', '黍离（节选）', '佚名', 'xianqin',
      '彼黍离离，彼稷之苗。\n行迈靡靡，中心摇摇。\n知我者，谓我心忧；不知我者，谓我何求。\n悠悠苍天，此何人哉？',
      'poetry', ['诗经', '怀古'],
      source='《诗经·王风》', year=-750),
    P('020', '文王（节选）', '佚名', 'xianqin',
      '文王在上，于昭于天。\n周虽旧邦，其命维新。\n有周不显，明命不已。',
      'prose', ['诗经', '名篇'],
      source='《诗经·大雅》', year=-1000),
]

WEIJIN = [
    P('015', '七哀（节选）', '王粲', 'weijin',
      '出门无所见，白骨蔽平原。\n路有饥妇人，抱子求索食。',
      'poetry', ['五言古诗', '怀古'],
      source='《艺文类聚》', year=192),
    P('016', '拟行路难·其四', '鲍照', 'weijin',
      '泻水置平地，各自东西南北流。\n人生亦有命，安能行叹复坐愁？\n酌酒以自宽，举杯断绝歌路难。\n心非木石岂无感？吞声踯躅不敢言。',
      'poetry', ['五言古诗', '抒怀', '必背', '名篇'],
      source='《乐府诗集》', year=460),
    P('017', '读山海经·其一', '陶渊明', 'weijin',
      '孟夏草木长，绕屋树扶疏。\n众鸟欣有托，吾亦爱吾庐。\n既耕亦已种，时还读我书。\n穷巷隔深辙，颇回故人车。\n欢然酌春酒，摘我园中蔬。\n微雨从东来，好风与之俱。\n泛览周王传，流观山海图。\n俯仰终宇宙，不乐复何如？',
      'poetry', ['五言古诗', '田园', '必背', '名篇'],
      source='《陶渊明集》', year=405),
    P('018', '归园田居·其三', '陶渊明', 'weijin',
      '种豆南山下，草盛豆苗稀。\n晨兴理荒秽，带月荷锄归。\n道狭草木长，夕露沾我衣。\n衣沾不足惜，但使愿无违。',
      'poetry', ['五言古诗', '田园', '必背', '名篇'],
      source='《陶渊明集》', year=405),
    P('019', '世说新语·方正（节选）', '刘义庆', 'weijin',
      '陈太丘与友期行，期日中。日中不至，太丘舍去，去后乃至。\n元方时年七岁，门外戏。客问元方：『父在不？』答曰：『待君久不至，已去。』',
      'article', ['古文', '必背', '名篇'],
      source='《世说新语·方正》', year=430),
    P('020', '出师表（节选）', '诸葛亮', 'weijin',
      '臣本布衣，躬耕于南阳，苟全性命于乱世，不求闻达于诸侯。\n先帝不以臣卑鄙，猥自枉屈，三顾臣于草庐之中，咨臣以当世之事，由是感激，遂许先帝以驱驰。\n后值倾覆，受任于败军之际，奉命于危难之间，尔来二十有一年矣。',
      'article', ['古文', '必背', '名篇'],
      source='《三国志·诸葛亮传》', location='成都', year=227),
    P('021', '诫子书', '诸葛亮', 'weijin',
      '夫君子之行，静以修身，俭以养德。\n非淡泊无以明志，非宁静无以致远。\n夫学须静也，才须学也，非学无以广才，非志无以成学。\n淫慢则不能励精，险躁则不能治性。\n年与时驰，意与日去，遂成枯落，多不接世，悲守穷庐，将复何及！',
      'prose', ['古文', '必背', '名篇'],
      source='《诸葛亮集》', year=234),
    P('022', '洛神赋（节选）', '曹植', 'weijin',
      '余告之曰：『其形也，翩若惊鸿，婉若游龙。\n荣曜秋菊，华茂春松。\n仿佛兮若轻云之蔽月，飘飖兮若流风之回雪。』',
      'fu', ['赋', '必背', '名篇'],
      source='《文选》', year=222),
]

BATCH = [
    ('tang', TANG),
    ('song', SONG),
    ('xianqin', XIANQIN),
    ('weijin', WEIJIN),
]


def main():
    idx = load(os.path.join(BASE, 'index.json'))
    orig_total = idx['totalCount']
    dynasty_name = {d['code']: d['name'] for d in idx['dynasties']}

    # 全库标题去重检查
    all_titles = set()
    for fn in sorted(os.listdir(BASE)):
        if fn.endswith('.json') and fn != 'index.json':
            all_titles.update(p['title'] for p in load(os.path.join(BASE, fn))['poems'])

    stats = []
    for code, poems in BATCH:
        path = os.path.join(BASE, code + '.json')
        data = load(path)
        cur = data['poems']
        cur_ids = {p['id'] for p in cur}
        cur_titles = {p['title'] for p in cur}

        dup_title = [p['title'] for p in poems if p['title'] in all_titles]
        dup_id = [code + '_' + p['n'] for p in poems if (code + '_' + p['n']) in cur_ids]
        bad = [p['n'] for p in poems if not p['content'].strip()]
        print(f'[{code}] 现有 {len(cur)} 条，计划新增 {len(poems)} 条'
              f' | 重复标题={dup_title} 重复id={dup_id} 空内容={bad}')
        assert not dup_title, dup_title
        assert not dup_id, dup_id
        assert not bad
        assert not any(len(set(p['tags'])) != len(p['tags']) for p in poems), 'tags 有重复'

        new = []
        for p in poems:
            item = {
                'id': f"{code}_{p['n']}",
                'title': p['title'],
                'author': p['author'],
                'dynasty': dynasty_name[code],
                'dynastyCode': code,
                'content': p['content'],
                'contentType': p['contentType'],
                'tags': p['tags'],
                'wordCount': len(p['content']),
            }
            for k in ('source', 'location', 'year'):
                if k in p:
                    item[k] = p[k]
            new.append(item)
        assert all(len(x['content']) > 0 for x in new)

        before = len(data['poems'])
        data['poems'].extend(new)
        data['metadata']['count'] = len(data['poems'])
        data['metadata']['lastUpdated'] = UPDATED
        data['metadata']['version'] = NEW_VERSION
        stats.append((code, before, len(data['poems'])))
        if not CHECK_ONLY:
            with open(path, 'w', encoding='utf-8') as f:
                f.write(dump(data))

    total_add = sum(after - before for _, before, after in stats)
    real_counts = {code: after for code, _, after in stats}
    for d in idx['dynasties']:
        if d['code'] in real_counts:
            d['count'] = real_counts[d['code']]
    # 各朝代 count 已核实与文件实际篇数一致（xianqin 12 / han 14 / weijin 14 / sui 9 /
    # tang 184 / song 81 / yuan 10 / ming 9 / qing 27 / xiandai 18），但历史遗留的
    # totalCount 为 380、比实际篇数 378 多 2。这里以各朝代 count 之和为准一并校正。
    print(f'[index] dynasties.count 之和 = {sum(d["count"] for d in idx["dynasties"])}'
          f'（原 totalCount={orig_total}，累加 {total_add}）')
    idx['totalCount'] = sum(d['count'] for d in idx['dynasties'])
    idx['lastUpdated'] = UPDATED
    idx['version'] = NEW_VERSION
    if not CHECK_ONLY:
        with open(os.path.join(BASE, 'index.json'), 'w', encoding='utf-8') as f:
            f.write(dump(idx))

    for code, before, after in stats:
        print(f'  {code}: {before} -> {after}')
    print(f'总计 {idx["totalCount"] - total_add} -> {idx["totalCount"]}'
          f'（新增 {total_add} 篇）' + (' [check only]' if CHECK_ONLY else ''))


if __name__ == '__main__':
    main()
