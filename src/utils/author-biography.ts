/**
 * 作者生平数据：生卒年 + 一生关键事件（含地点坐标），
 * 供地图「生平路线」生成从出生到逝世的真实轨迹（而非仅按作品年排序）。
 *
 * 口径：主流史学记载；生年、籍贯、卒地有争议的在事件文本中标注。
 * 坐标取今市/县城中心近似值。事件类型：
 * - birth/death：出生、逝世
 * - turning：人生转折点（及第、贬谪、入狱、南渡、罢官等）
 * - residence：长居地（endYear 为搬离年份，用于「停留最久」统计）
 * - travel：游历/短期途经
 */
export interface AuthorLifeEvent {
  year: number;
  /** 持续型事件的结束年（如长居）；缺省表示当年发生的点事件 */
  endYear?: number;
  place: string;
  geo: { lat: number; lng: number };
  event: string;
  type: 'birth' | 'death' | 'turning' | 'residence' | 'travel';
}

export interface AuthorBiography {
  author: string;
  birthYear: number;
  deathYear: number;
  /** 一句话生平概括 */
  summary: string;
  events: AuthorLifeEvent[];
}

export const AUTHOR_BIOGRAPHIES: Record<string, AuthorBiography> = {
  李白: {
    author: '李白',
    birthYear: 701,
    deathYear: 762,
    summary: '字太白，号青莲居士。少年出蜀漫游天下，中年入仕又失意，晚年因永王案流放遇赦，一生都在路上。',
    events: [
      { year: 701, place: '碎叶城', geo: { lat: 42.8, lng: 75.3 }, event: '出生（祖籍陇西，生于碎叶城，今吉尔吉斯斯坦托克马克；一说生于蜀中）', type: 'birth' },
      { year: 705, endYear: 724, place: '江油', geo: { lat: 31.78, lng: 104.75 }, event: '随父迁居绵州昌隆青莲乡，少年读书学剑', type: 'residence' },
      { year: 724, place: '江陵', geo: { lat: 30.33, lng: 112.24 }, event: '「仗剑去国，辞亲远游」，出三峡东下', type: 'turning' },
      { year: 726, place: '扬州', geo: { lat: 32.39, lng: 119.41 }, event: '漫游金陵、扬州，散金三十万，病卧旅邸作《静夜思》', type: 'travel' },
      { year: 727, endYear: 736, place: '安陆', geo: { lat: 31.26, lng: 113.69 }, event: '娶故相许圉师孙女，酒隐安陆十年', type: 'residence' },
      { year: 736, endYear: 742, place: '济宁', geo: { lat: 35.41, lng: 116.59 }, event: '移家东鲁任城，与孔巢父等号「竹溪六逸」', type: 'residence' },
      { year: 742, place: '长安', geo: { lat: 34.27, lng: 108.95 }, event: '受诏入京供奉翰林，「仰天大笑出门去，我辈岂是蓬蒿人」', type: 'turning' },
      { year: 744, place: '洛阳', geo: { lat: 34.62, lng: 112.45 }, event: '赐金放还；与杜甫初会于洛阳，同游梁宋', type: 'turning' },
      { year: 745, endYear: 755, place: '宣城', geo: { lat: 30.94, lng: 118.76 }, event: '南北漫游十年，往来剡中、齐鲁、宣城', type: 'travel' },
      { year: 756, place: '庐山', geo: { lat: 29.56, lng: 115.98 }, event: '避乱庐山，应邀入永王李璘幕府', type: 'turning' },
      { year: 758, place: '夜郎', geo: { lat: 28.13, lng: 106.83 }, event: '永王败，坐罪长流夜郎（今贵州桐梓）', type: 'turning' },
      { year: 759, place: '奉节', geo: { lat: 31.02, lng: 109.46 }, event: '行至白帝城遇赦，「千里江陵一日还」', type: 'turning' },
      { year: 762, place: '当涂', geo: { lat: 31.55, lng: 118.5 }, event: '投奔族叔李阳冰，卒于当涂，年六十二', type: 'death' },
    ],
  },
  杜甫: {
    author: '杜甫',
    birthYear: 712,
    deathYear: 770,
    summary: '字子美。青年漫游，中年困守长安逢安史之乱，晚年漂泊西南，诗史一生与乱世相始终。',
    events: [
      { year: 712, place: '巩义', geo: { lat: 34.75, lng: 112.98 }, event: '出生于巩县（今河南巩义）', type: 'birth' },
      { year: 731, endYear: 735, place: '绍兴', geo: { lat: 30.03, lng: 120.58 }, event: '漫游吴越，历金陵、姑苏、会稽', type: 'travel' },
      { year: 736, endYear: 740, place: '兖州', geo: { lat: 35.55, lng: 116.83 }, event: '漫游齐赵，登泰山作《望岳》', type: 'travel' },
      { year: 744, place: '洛阳', geo: { lat: 34.62, lng: 112.45 }, event: '与李白初会，同游梁宋', type: 'travel' },
      { year: 746, endYear: 755, place: '长安', geo: { lat: 34.27, lng: 108.95 }, event: '应试落第，困守长安十年，献赋求官不得志', type: 'residence' },
      { year: 755, place: '蒲城', geo: { lat: 34.96, lng: 109.59 }, event: '回奉先省家，幼子饿死，作《自京赴奉先县咏怀五百字》；同年安史之乱爆发', type: 'turning' },
      { year: 756, place: '富县', geo: { lat: 35.99, lng: 109.38 }, event: '携家避难于鄜州羌村，只身奔赴行在途中被俘，押回长安作《春望》', type: 'turning' },
      { year: 757, place: '凤翔', geo: { lat: 34.52, lng: 107.39 }, event: '逃出长安奔赴凤翔行在，授左拾遗', type: 'turning' },
      { year: 758, place: '渭南', geo: { lat: 34.52, lng: 109.49 }, event: '贬华州司功参军，往来洛阳途中作「三吏」「三别」', type: 'residence' },
      { year: 759, place: '天水', geo: { lat: 34.58, lng: 105.72 }, event: '弃官西行，经秦州、同谷，岁末抵达成都', type: 'turning' },
      { year: 760, endYear: 765, place: '成都', geo: { lat: 30.57, lng: 104.07 }, event: '筑草堂于浣花溪，其间一度避乱梓州，作《闻官军收河南河北》', type: 'residence' },
      { year: 766, endYear: 768, place: '奉节', geo: { lat: 31.02, lng: 109.46 }, event: '滞留夔州，创作达巅峰，《登高》《秋兴八首》皆成于此', type: 'residence' },
      { year: 768, place: '岳阳', geo: { lat: 29.37, lng: 113.13 }, event: '出三峡漂泊荆湘，作《登岳阳楼》', type: 'travel' },
      { year: 770, place: '耒阳', geo: { lat: 26.42, lng: 112.86 }, event: '由潭州赴郴州途中阻水耒阳，病逝于舟中，年五十九', type: 'death' },
    ],
  },
  毛泽东: {
    author: '毛泽东',
    birthYear: 1893,
    deathYear: 1976,
    summary: '字润之。从韶山农家子弟到新中国缔造者，诗词贯穿其革命一生。',
    events: [
      { year: 1893, place: '韶山', geo: { lat: 27.91, lng: 112.53 }, event: '出生于湖南韶山冲农家', type: 'birth' },
      { year: 1910, place: '湘乡', geo: { lat: 27.73, lng: 112.53 }, event: '出乡关求学，「孩儿立志出乡关，学不成名誓不还」', type: 'turning' },
      { year: 1913, endYear: 1918, place: '长沙', geo: { lat: 28.23, lng: 112.94 }, event: '湖南省立第一师范求学，后组织新民学会', type: 'residence' },
      { year: 1925, place: '长沙', geo: { lat: 28.23, lng: 112.94 }, event: '重游橘子洲，作《沁园春·长沙》', type: 'travel' },
      { year: 1927, place: '井冈山', geo: { lat: 26.58, lng: 114.29 }, event: '领导秋收起义，开辟井冈山根据地', type: 'turning' },
      { year: 1935, place: '遵义', geo: { lat: 27.73, lng: 106.93 }, event: '长征途中遵义会议，「雄关漫道真如铁，而今迈步从头越」', type: 'turning' },
      { year: 1935, endYear: 1947, place: '延安', geo: { lat: 36.6, lng: 109.49 }, event: '到达陕北，领导抗战与解放战争，作《沁园春·雪》', type: 'residence' },
      { year: 1949, place: '北京', geo: { lat: 39.9, lng: 116.4 }, event: '中华人民共和国成立，定都北京', type: 'turning' },
      { year: 1956, place: '武汉', geo: { lat: 30.59, lng: 114.31 }, event: '横渡长江，作《水调歌头·游泳》', type: 'travel' },
      { year: 1965, place: '井冈山', geo: { lat: 26.58, lng: 114.29 }, event: '重上井冈山，「世上无难事，只要肯登攀」', type: 'travel' },
      { year: 1976, place: '北京', geo: { lat: 39.9, lng: 116.4 }, event: '在北京逝世，年八十三', type: 'death' },
    ],
  },
  王维: {
    author: '王维',
    birthYear: 701,
    deathYear: 761,
    summary: '字摩诘，诗佛。少年及第名动京城，中年半官半隐于辋川，晚经乱离而诗入化境。',
    events: [
      { year: 701, place: '永济', geo: { lat: 34.87, lng: 110.45 }, event: '出生于蒲州（今山西永济）', type: 'birth' },
      { year: 721, place: '长安', geo: { lat: 34.27, lng: 108.95 }, event: '进士及第，任太乐丞；旋因伶人舞黄狮子案被贬', type: 'turning' },
      { year: 723, endYear: 728, place: '济宁', geo: { lat: 35.41, lng: 116.59 }, event: '贬济州司仓参军', type: 'residence' },
      { year: 734, place: '长安', geo: { lat: 34.27, lng: 108.95 }, event: '张九龄执政，擢右拾遗，重返朝廷', type: 'turning' },
      { year: 737, place: '武威', geo: { lat: 37.93, lng: 102.63 }, event: '出使河西节度使幕，「大漠孤烟直，长河落日圆」', type: 'travel' },
      { year: 740, endYear: 756, place: '蓝田', geo: { lat: 34.15, lng: 109.32 }, event: '营辋川别业，半官半隐，《辋川集》诸诗皆成于此', type: 'residence' },
      { year: 756, place: '长安', geo: { lat: 34.27, lng: 108.95 }, event: '安史之乱陷贼，被迫受伪职，狱中闻乐作《凝碧池》', type: 'turning' },
      { year: 757, place: '长安', geo: { lat: 34.27, lng: 108.95 }, event: '两京收复，以《凝碧池》诗获宥，官至尚书右丞', type: 'turning' },
      { year: 761, place: '长安', geo: { lat: 34.27, lng: 108.95 }, event: '卒于长安（上元二年），年六十一，葬辋川', type: 'death' },
    ],
  },
  苏轼: {
    author: '苏轼',
    birthYear: 1037,
    deathYear: 1101,
    summary: '字子瞻，号东坡居士。一生三起三落，贬谪足迹南至儋州，愈贬愈旷达，黄州后文章诗词俱入巅峰。',
    events: [
      { year: 1037, place: '眉山', geo: { lat: 30.08, lng: 103.85 }, event: '出生于四川眉山', type: 'birth' },
      { year: 1057, place: '开封', geo: { lat: 34.8, lng: 114.35 }, event: '进士及第，欧阳修叹「老夫当避路，放他出一头地」', type: 'turning' },
      { year: 1061, endYear: 1064, place: '凤翔', geo: { lat: 34.52, lng: 107.39 }, event: '签书凤翔府判官，初入仕途', type: 'residence' },
      { year: 1071, endYear: 1074, place: '杭州', geo: { lat: 30.25, lng: 120.17 }, event: '因反对新法自请外放，任杭州通判', type: 'residence' },
      { year: 1074, endYear: 1076, place: '诸城', geo: { lat: 35.99, lng: 119.41 }, event: '知密州，作《江城子·密州出猎》《水调歌头·明月几时有》', type: 'residence' },
      { year: 1079, place: '湖州', geo: { lat: 30.89, lng: 120.09 }, event: '乌台诗案发，下御史台狱百余日，几近死地', type: 'turning' },
      { year: 1080, endYear: 1084, place: '黄冈', geo: { lat: 30.45, lng: 114.87 }, event: '贬黄州团练副使，垦东坡自号居士，《赤壁赋》《念奴娇》成于此，人生与创作最大转折', type: 'turning' },
      { year: 1085, place: '开封', geo: { lat: 34.8, lng: 114.35 }, event: '神宗崩，高后听政，召还任翰林学士知制诰', type: 'turning' },
      { year: 1089, endYear: 1091, place: '杭州', geo: { lat: 30.25, lng: 120.17 }, event: '再知杭州，疏浚西湖筑苏堤', type: 'residence' },
      { year: 1094, place: '惠州', geo: { lat: 23.11, lng: 114.42 }, event: '新党再起，贬惠州，「日啖荔枝三百颗」', type: 'turning' },
      { year: 1097, endYear: 1100, place: '儋州', geo: { lat: 19.52, lng: 109.58 }, event: '再贬儋州（今海南儋州），办学教化，天涯海角', type: 'residence' },
      { year: 1101, place: '常州', geo: { lat: 31.81, lng: 119.97 }, event: '遇赦北归，卒于常州，年六十五', type: 'death' },
    ],
  },
  白居易: {
    author: '白居易',
    birthYear: 772,
    deathYear: 846,
    summary: '字乐天，号香山居士。早年兼济天下，江州之贬后转向独善其身，晚年隐居洛阳十八年。',
    events: [
      { year: 772, place: '新郑', geo: { lat: 34.4, lng: 113.74 }, event: '出生于河南新郑', type: 'birth' },
      { year: 787, endYear: 799, place: '宿州', geo: { lat: 33.65, lng: 116.96 }, event: '少年避乱南迁，居符离，作「离离原上草」', type: 'residence' },
      { year: 800, place: '长安', geo: { lat: 34.27, lng: 108.95 }, event: '进士及第，「慈恩塔下题名处，十七人中最少年」', type: 'turning' },
      { year: 806, place: '周至', geo: { lat: 34.16, lng: 108.22 }, event: '任盩厔县尉，作《长恨歌》', type: 'residence' },
      { year: 808, endYear: 815, place: '长安', geo: { lat: 34.27, lng: 108.95 }, event: '历任翰林学士、左拾遗，屡上奏章指斥时政，作《卖炭翁》等新乐府', type: 'residence' },
      { year: 815, place: '九江', geo: { lat: 29.71, lng: 116.0 }, event: '越职言事贬江州司马，人生分水岭，作《琵琶行》', type: 'turning' },
      { year: 818, endYear: 820, place: '忠县', geo: { lat: 30.29, lng: 108.04 }, event: '量移忠州刺史', type: 'residence' },
      { year: 822, endYear: 824, place: '杭州', geo: { lat: 30.25, lng: 120.17 }, event: '任杭州刺史，筑堤浚井，「最爱湖东行不足」', type: 'residence' },
      { year: 825, endYear: 826, place: '苏州', geo: { lat: 31.3, lng: 120.58 }, event: '任苏州刺史，因病去职', type: 'residence' },
      { year: 829, endYear: 846, place: '洛阳', geo: { lat: 34.62, lng: 112.45 }, event: '晚年定居洛阳履道里，号香山居士，与刘禹锡唱和，组织九老会', type: 'residence' },
      { year: 846, place: '洛阳', geo: { lat: 34.62, lng: 112.45 }, event: '卒于洛阳，年七十五，葬龙门香山', type: 'death' },
    ],
  },
  杜牧: {
    author: '杜牧',
    birthYear: 803,
    deathYear: 852,
    summary: '字牧之，京兆万年人。二十六岁及第，半生沉浮于幕僚与外任之间，咏史七绝独步晚唐。',
    events: [
      { year: 803, place: '长安', geo: { lat: 34.27, lng: 108.95 }, event: '出生于长安，祖父杜佑官至宰相', type: 'birth' },
      { year: 828, place: '洛阳', geo: { lat: 34.62, lng: 112.45 }, event: '进士及第，同年又登制科，一时才名震动', type: 'turning' },
      { year: 830, endYear: 833, place: '扬州', geo: { lat: 32.39, lng: 119.41 }, event: '入淮南节度使牛僧孺幕，「十年一觉扬州梦，赢得青楼薄幸名」', type: 'residence' },
      { year: 835, place: '洛阳', geo: { lat: 34.62, lng: 112.45 }, event: '任监察御史，分司东都，避过甘露之变', type: 'residence' },
      { year: 842, endYear: 844, place: '黄冈', geo: { lat: 30.45, lng: 114.87 }, event: '出任黄州刺史，作《赤壁》', type: 'residence' },
      { year: 846, endYear: 848, place: '池州', geo: { lat: 30.66, lng: 117.49 }, event: '迁池州刺史，作《清明》《山行》', type: 'residence' },
      { year: 848, endYear: 850, place: '建德', geo: { lat: 29.47, lng: 119.28 }, event: '迁睦州刺史', type: 'residence' },
      { year: 850, place: '湖州', geo: { lat: 30.89, lng: 120.09 }, event: '出任湖州刺史', type: 'residence' },
      { year: 852, place: '长安', geo: { lat: 34.27, lng: 108.95 }, event: '回京任中书舍人，岁暮卒于长安，年五十', type: 'death' },
    ],
  },
  李商隐: {
    author: '李商隐',
    birthYear: 813,
    deathYear: 858,
    summary: '字义山，号玉溪生。一生困于牛李党争夹缝，仕途蹭蹬而诗成绝响，无题诸作千古独步。',
    events: [
      { year: 813, place: '荥阳', geo: { lat: 34.79, lng: 113.38 }, event: '出生于荥阳（今河南郑州西）', type: 'birth' },
      { year: 829, endYear: 836, place: '东平', geo: { lat: 35.94, lng: 116.47 }, event: '入天平军节度使令狐楚幕，受知遇习骈文', type: 'residence' },
      { year: 837, place: '长安', geo: { lat: 34.27, lng: 108.95 }, event: '进士及第', type: 'turning' },
      { year: 838, place: '泾川', geo: { lat: 35.33, lng: 107.37 }, event: '入泾原节度使王茂元幕并娶其女，自此陷于牛李党争', type: 'turning' },
      { year: 847, endYear: 848, place: '桂林', geo: { lat: 25.27, lng: 110.29 }, event: '随桂管观察使郑亚远赴桂幕', type: 'residence' },
      { year: 851, endYear: 855, place: '三台', geo: { lat: 31.09, lng: 105.09 }, event: '入东川节度使柳仲郢幕，妻王氏新丧，作「巴山夜雨涨秋池」', type: 'residence' },
      { year: 858, place: '郑州', geo: { lat: 34.75, lng: 113.63 }, event: '罢幕归乡，卒于郑州，年四十六', type: 'death' },
    ],
  },
  辛弃疾: {
    author: '辛弃疾',
    birthYear: 1140,
    deathYear: 1207,
    summary: '字幼安，号稼轩。少年起义南归，壮志未酬而被闲置二十年，把金戈铁马都写进了词里。',
    events: [
      { year: 1140, place: '济南', geo: { lat: 36.65, lng: 117.0 }, event: '出生于山东历城，时中原已陷于金', type: 'birth' },
      { year: 1162, place: '建康', geo: { lat: 32.06, lng: 118.8 }, event: '率五十骑袭金营擒叛将张安国，渡淮南归，名震一时', type: 'turning' },
      { year: 1172, place: '滁州', geo: { lat: 32.3, lng: 118.32 }, event: '知滁州，荒政救灾，半年而市容复兴', type: 'residence' },
      { year: 1175, place: '赣州', geo: { lat: 25.83, lng: 114.93 }, event: '任江西提点刑狱，经造口作「青山遮不住，毕竟东流去」', type: 'residence' },
      { year: 1179, endYear: 1181, place: '长沙', geo: { lat: 28.23, lng: 112.94 }, event: '知潭州兼湖南安抚使，创建飞虎军', type: 'residence' },
      { year: 1181, place: '南昌', geo: { lat: 28.68, lng: 115.86 }, event: '任江西安抚使，冬被弹劾罢官，自此投闲置散', type: 'turning' },
      { year: 1182, endYear: 1203, place: '上饶', geo: { lat: 28.45, lng: 117.97 }, event: '闲居带湖、瓢泉二十年，词作大成，自号稼轩', type: 'residence' },
      { year: 1203, endYear: 1205, place: '镇江', geo: { lat: 32.19, lng: 119.43 }, event: '起知绍兴府改镇江知府，登北固亭作「廉颇老矣，尚能饭否」', type: 'residence' },
      { year: 1207, place: '铅山', geo: { lat: 28.31, lng: 117.71 }, event: '卒于铅山瓢泉，年六十八，临终犹呼「杀贼」', type: 'death' },
    ],
  },
  李清照: {
    author: '李清照',
    birthYear: 1084,
    deathYear: 1155,
    summary: '号易安居士。前半生美满闲适，靖康之变后国破夫亡、文物散失，词风由清丽转沉痛，婉约之宗。',
    events: [
      { year: 1084, place: '章丘', geo: { lat: 36.72, lng: 117.53 }, event: '出生于齐州章丘（今济南章丘），父李格非为苏门后四学士', type: 'birth' },
      { year: 1101, place: '开封', geo: { lat: 34.8, lng: 114.35 }, event: '嫁太学生赵明诚，居汴京，共赏金石书画', type: 'turning' },
      { year: 1108, endYear: 1121, place: '青州', geo: { lat: 36.68, lng: 118.48 }, event: '屏居青州十年，辑校《金石录》，「知否，知否」诸词多成于此期', type: 'residence' },
      { year: 1127, place: '南京', geo: { lat: 32.06, lng: 118.8 }, event: '靖康之变，仓皇南渡，金石书画沿途散失', type: 'turning' },
      { year: 1129, place: '南京', geo: { lat: 32.06, lng: 118.8 }, event: '赵明诚病逝于建康，自此只身漂泊江浙', type: 'turning' },
      { year: 1130, endYear: 1134, place: '杭州', geo: { lat: 30.25, lng: 120.17 }, event: '辗转抵临安，再嫁张汝舟，旋讼离入狱', type: 'residence' },
      { year: 1134, endYear: 1135, place: '金华', geo: { lat: 29.08, lng: 119.65 }, event: '避乱金华，登八咏楼，作《武陵春·风住尘香花已尽》', type: 'residence' },
      { year: 1155, place: '杭州', geo: { lat: 30.25, lng: 120.17 }, event: '约于此年卒于临安，年约七十二', type: 'death' },
    ],
  },
  陶渊明: {
    author: '陶渊明',
    birthYear: 365,
    deathYear: 427,
    summary: '一名潜，字元亮。五仕五隐，终因「不为五斗米折腰」归园田居，开创田园诗派。',
    events: [
      { year: 365, place: '九江', geo: { lat: 29.71, lng: 116.0 }, event: '出生于浔阳柴桑（今江西九江西南）', type: 'birth' },
      { year: 393, place: '九江', geo: { lat: 29.71, lng: 116.0 }, event: '初仕江州祭酒，不堪吏职，不久自解归', type: 'turning' },
      { year: 400, endYear: 404, place: '南京', geo: { lat: 32.06, lng: 118.8 }, event: '先后入桓玄、刘裕幕府，辗转建康、江陵间', type: 'residence' },
      { year: 405, place: '九江', geo: { lat: 29.71, lng: 116.0 }, event: '任彭泽令八十余日，「吾不能为五斗米折腰」，辞官作《归去来兮辞》', type: 'turning' },
      { year: 406, endYear: 427, place: '九江', geo: { lat: 29.71, lng: 116.0 }, event: '归隐柴桑栗里，躬耕自资，《归园田居》《桃花源记》皆成于此', type: 'residence' },
      { year: 427, place: '九江', geo: { lat: 29.71, lng: 116.0 }, event: '卒于柴桑，年六十三，后世谥靖节先生', type: 'death' },
    ],
  },
  陆游: {
    author: '陆游',
    birthYear: 1125,
    deathYear: 1210,
    summary: '字务观，号放翁。生逢靖康之难，一生志在恢复中原而不得，八十五载存诗近万首。',
    events: [
      { year: 1125, place: '绍兴', geo: { lat: 30.03, lng: 120.58 }, event: '生于父任所舟中，祖籍越州山阴；次年靖康之乱，随家南渡', type: 'birth' },
      { year: 1153, place: '杭州', geo: { lat: 30.25, lng: 120.17 }, event: '锁厅试名列第一，因秦桧之孙同榜被黜落', type: 'turning' },
      { year: 1170, place: '奉节', geo: { lat: 31.02, lng: 109.46 }, event: '入蜀任夔州通判', type: 'residence' },
      { year: 1172, place: '汉中', geo: { lat: 33.07, lng: 107.03 }, event: '入四川宣抚使王炎幕，戍边南郑，「铁马秋风大散关」，一生最意气风发处', type: 'turning' },
      { year: 1175, endYear: 1178, place: '成都', geo: { lat: 30.57, lng: 104.07 }, event: '入范成大幕府，纵酒唱和，自号放翁', type: 'residence' },
      { year: 1180, endYear: 1189, place: '抚州', geo: { lat: 27.95, lng: 116.36 }, event: '历任江西、严州地方官，因赈灾开义仓被劾', type: 'residence' },
      { year: 1190, endYear: 1210, place: '绍兴', geo: { lat: 30.03, lng: 120.58 }, event: '罢官归山阴，闲居二十年，村居诗万余首', type: 'residence' },
      { year: 1210, place: '绍兴', geo: { lat: 30.03, lng: 120.58 }, event: '卒于山阴，年八十五，绝笔《示儿》', type: 'death' },
    ],
  },
  王昌龄: {
    author: '王昌龄',
    birthYear: 698,
    deathYear: 756,
    summary: '字少伯，七绝圣手。诗名满天下而宦途不达，两遭贬谪，竟死于乱世之中。',
    events: [
      { year: 698, place: '太原', geo: { lat: 37.87, lng: 112.55 }, event: '约生于此年（籍贯有太原、京兆、江宁诸说）', type: 'birth' },
      { year: 727, place: '长安', geo: { lat: 34.27, lng: 108.95 }, event: '进士及第，授秘书省校书郎', type: 'turning' },
      { year: 730, endYear: 733, place: '西安', geo: { lat: 34.27, lng: 108.95 }, event: '再登博学宏词科，迁汜水县尉，后贬岭南遇赦北还', type: 'residence' },
      { year: 740, endYear: 748, place: '南京', geo: { lat: 32.06, lng: 118.8 }, event: '任江宁县丞，世称王江宁，与李白、岑参等唱和', type: 'residence' },
      { year: 748, endYear: 755, place: '怀化', geo: { lat: 27.55, lng: 110.0 }, event: '贬龙标县尉（今湖南怀化洪江），李白寄诗「我寄愁心与明月」', type: 'turning' },
      { year: 756, place: '凤阳', geo: { lat: 32.87, lng: 117.56 }, event: '安史乱中离任还乡，途经濠州为刺史闾丘晓所杀', type: 'death' },
    ],
  },
  王安石: {
    author: '王安石',
    birthYear: 1021,
    deathYear: 1086,
    summary: '字介甫，号半山。以变法撼动北宋政坛，两度拜相两度罢黜，晚年归隐江宁钟山。',
    events: [
      { year: 1021, place: '抚州', geo: { lat: 28.0, lng: 116.35 }, event: '出生于临川（今江西抚州）', type: 'birth' },
      { year: 1042, place: '开封', geo: { lat: 34.8, lng: 114.35 }, event: '进士及第（本拟状元，因语犯忌改置第四）', type: 'turning' },
      { year: 1047, endYear: 1050, place: '宁波', geo: { lat: 29.87, lng: 121.55 }, event: '知鄞县，兴修水利、贷谷与民，为日后变法雏形', type: 'residence' },
      { year: 1069, place: '开封', geo: { lat: 34.8, lng: 114.35 }, event: '拜参知政事，主持熙宁变法', type: 'turning' },
      { year: 1074, place: '南京', geo: { lat: 32.06, lng: 118.8 }, event: '首度罢相，出知江宁府', type: 'turning' },
      { year: 1076, place: '南京', geo: { lat: 32.06, lng: 118.8 }, event: '再度罢相，自此不复出', type: 'turning' },
      { year: 1076, endYear: 1086, place: '南京', geo: { lat: 32.06, lng: 118.8 }, event: '隐居江宁半山园，骑驴游钟山，诗风转精绝，「春风又绿江南岸」', type: 'residence' },
      { year: 1086, place: '南京', geo: { lat: 32.06, lng: 118.8 }, event: '新法尽废，忧愤卒于江宁，年六十六', type: 'death' },
    ],
  },
};

/** 获取作者生平数据；无数据返回 null（路线退化为仅作品年排序） */
export function getAuthorBiography(author: string): AuthorBiography | null {
  return AUTHOR_BIOGRAPHIES[author] || null;
}
