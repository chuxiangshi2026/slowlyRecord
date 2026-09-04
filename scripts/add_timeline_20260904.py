#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""向历史时间线内置库追加事件（2026-09-04 批次）。

用法：python3 scripts/add_timeline_20260904.py [--check]
  --check 只做重名校验，不写盘。

追加原则：
  - title 全库唯一（timeline-service 无去重逻辑，靠 title 作 key）
  - category ∈ politics|literature|science|thought|society
  - region ∈ china|west（types/text-memory.d.ts 的 TimelineRegion，无 modern）
  - era / reign 为自由字符串，可新增（仅用于筛选下拉补全，不校验）
  - location 只填 parseTimelineLocation 能解析的地名，否则省略（避免地图视图丢点）
  - figures/relations 中人名需互相一致，才能画关系连线
"""
import json
import os
import sys
from datetime import datetime, timezone, timedelta

BASE = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                    'public', 'datafile', 'timeline')
CHECK_ONLY = '--check' in sys.argv
# 北京时间 2026-09-04 00:00
UPDATED = int(datetime(2026, 9, 4, 0, 0, 0,
                       tzinfo=timezone(timedelta(hours=8))).timestamp() * 1000)

E = lambda **kw: kw


def fig(name, title, desc):
    return {'name': name, 'title': title, 'desc': desc}


def rel(frm, to, rtype, desc):
    return {'from': frm, 'to': to, 'type': rtype, 'desc': desc}


EVENTS = [
    # ==================== 先秦 / 战国：补思想与文献 ====================
    E(title='《诗经》编定成书', year=-500, era='先秦', region='china', category='literature',
      location='西安',
      content='《诗经》收录西周初年至春秋中叶的诗歌三百零五篇，分风、雅、颂三部分，是我国第一部诗歌总集。相传孔子曾删定《诗三百》，使之成为儒家经典。',
      background='《诗经》是采集各国民歌（风）与宫廷雅乐（雅、颂）汇编而成，"风""雅""颂"既是音乐分类也是内容分类。',
      tags=['儒家经典', '诗歌总集', '国风', '三百篇']),
    E(title='墨家学派创立', year=-470, era='先秦', region='china', category='thought',
      content='墨子创立墨家，主张兼爱、非攻、尚贤、节用，代表手工业者与小生产者利益，是先秦时期与儒家并称的大学派。',
      background='战国初期礼崩乐坏、战乱频繁，墨子以"兼爱""非攻"反对不义战争，组织严密的墨者团体行义救世。',
      tags=['诸子百家', '兼爱非攻', '墨子'],
      figures=[fig('墨子', '墨家学派创始人', '主张兼爱、非攻、尚贤、节用')],
      relations=[rel('墨子', '孔子', '论敌', '儒墨并称诸子，主张针锋相对')]),
    E(title='孙武著《孙子兵法》', year=-500, era='先秦', region='china', category='thought',
      content='春秋末期军事家孙武著成《孙子兵法》，共十三篇，系统论述治军、用间、奇正、虚实等战争法则，被誉为"兵学圣典"。',
      background='吴王阖闾召见孙武，孙武以兵法十三篇进献，并训练宫女试法，遂拜为大将。',
      tags=['兵家', '十三篇', '谋略'],
      figures=[fig('孙武', '兵家至圣', '著《孙子兵法》十三篇')]),
    E(title='孟子著《孟子》', year=-350, era='先秦', region='china', category='thought',
      location='曲阜',
      content='孟子继承孔子学说，主张性善、仁政、民贵君轻，其言行被门人整理为《孟子》七篇，后与《诗》《书》《礼》《易》并称四书。',
      background='孟子周游列国而不遇用，转而著书立说，提出"民为贵，社稷次之，君为轻"的民本思想。',
      tags=['儒家', '仁政', '性善论', '四书'],
      figures=[fig('孟子', '亚圣', '主张性善、仁政、民贵君轻')],
      relations=[rel('孟子', '孔子', '师徒', '孟子自谓私淑孔子，承其学脉')]),
    E(title='韩非著《韩非子》', year=-233, era='战国', region='china', category='thought',
      content='法家集大成者韩非著《韩非子》五十五篇，系统总结法、术、势三派理论，主张以法治国、中央集权。',
      background='韩非为韩国宗室，学于荀子，著书数十万言；其《孤愤》《五蠹》被秦王政赏识，后入秦受害而亡。',
      tags=['法家', '法术势', '集权'],
      figures=[fig('韩非', '法家集大成者', '著《韩非子》，主张法、术、势'),
               fig('荀子', '儒家集大成者', '韩非与李斯之师')],
      relations=[rel('荀子', '韩非', '师徒', '韩非与李斯同为荀子学生')]),

    # ==================== 秦汉 ====================
    E(title='秦始皇北击匈奴修长城', year=-214, era='秦', region='china', category='politics',
      content='秦始皇派蒙恬率三十万大军北击匈奴，收复河套地区，并连接、增筑战国旧长城，西起临洮、东到辽东，形成万里长城雏形。',
      background='秦统一后匈奴屡犯边，秦始皇以长城为屏障，又徙谪民与戍卒屯垦守边。',
      tags=['长城', '边疆', '蒙恬'],
      figures=[fig('秦始皇', '秦始皇', '统一六国、筑长城'),
               fig('蒙恬', '大将军', '率军北逐匈奴、主持修筑长城')],
      relations=[rel('秦始皇', '蒙恬', '君臣', '派蒙恬北逐匈奴并筑长城')]),
    E(title='昭君出塞和亲', year=-33, era='西汉', region='china', category='society',
      content='汉元帝竟宁元年，宫人王嫱（昭君）自愿出塞嫁给匈奴呼韩邪单于，开启了汉匈和平近半个世纪的时期。',
      background='匈奴分裂后呼韩邪单于请和亲，朝中无人应允，王嫱自请和亲，被赐封"王昭君"。',
      tags=['和亲', '民族交融', '汉匈'],
      figures=[fig('王昭君', '宫人、宁胡阏氏', '自愿出塞和亲')]),
    E(title='蔡伦改进造纸术', year=105, era='东汉', region='china', category='science',
      content='东汉蔡伦总结前人造纸经验，以树皮、麻头、破布、渔网为原料抄造出质地优良的纸，史称"蔡侯纸"，使书写材料大为普及。',
      background='蔡伦任尚方令，负责宫廷器物制造；此前虽有麻纸，但质地粗糙，难以用于书写。',
      tags=['四大发明', '造纸术', '科技'],
      figures=[fig('蔡伦', '尚方令', '改进造纸术，发明蔡侯纸')]),

    # ==================== 魏晋南北朝（原库空白最多的时期） ====================
    E(title='建安文学蔚然成风', year=205, era='三国', region='china', category='literature',
      content='东汉建安年间，以曹操、曹丕、曹植父子与"建安七子"为核心的文人集团创作出慷慨悲凉、刚健质朴的诗文，史称"建安风骨"。',
      background='汉末战乱频仍，文人身处乱世而抒发济世之志，诗风雄浑劲健，开一代之先声。',
      tags=['建安七子', '三曹', '文学', '五言诗'],
      figures=[fig('曹操', '魏王', '开建安文学风气'),
               fig('曹丕', '魏文帝', '著《典论·论文》，首倡文学独立'),
               fig('曹植', '陈王', '才高八斗，著《洛神赋》')],
      relations=[rel('曹操', '曹丕', '父子', '曹丕继魏王位'),
                 rel('曹丕', '曹植', '兄弟', '同曹操并称"三曹"')]),
    E(title='王羲之作《兰亭集序》', year=353, era='魏晋', region='china', category='literature',
      location='绍兴',
      content='东晋永和九年三月初三，王羲之与谢安等四十一人于会稽山阴兰亭修禊，醉后挥毫写下《兰亭集序》，被称为"天下第一行书"。',
      background='兰亭修禊为晋人雅集之风，序文追叹人生短促、感慨死生，书文书法俱堪称绝。',
      tags=['书法', '行书', '雅集', '晋人风度'],
      figures=[fig('王羲之', '书圣', '书《兰亭集序》'),
               fig('谢安', '太保', '东晋名臣，指挥淝水之战')]),
    E(title='陶渊明归隐田园', year=405, era='魏晋', region='china', category='literature',
      location='柴桑',
      content='东晋末年，陶渊明辞去彭泽县令，赋《归去来兮辞》归隐田园，创作大量田园诗与饮酒诗，开创中国文学的田园诗派。',
      background='陶渊明不为五斗米折腰，采菊东篱、躬耕南亩，其诗平淡自然而意味深长，被尊为"田园诗人"。',
      tags=['田园诗', '隐逸', '归去来兮辞'],
      figures=[fig('陶渊明', '田园诗人', '归隐田园，作《归去来兮辞》')]),
    E(title='刘裕建立南朝宋', year=420, era='南北朝', region='china', category='politics',
      content='东晋权臣刘裕代晋建宋，是为宋武帝，南方进入宋、齐、梁、陈更迭的南朝时期，北朝则与北魏对峙。',
      background='刘裕出身寒微而功业显赫，曾率军北伐收复长安、洛阳，终因功高震主而受禅代晋。',
      tags=['南朝', '禅代', '南北朝对峙'],
      figures=[fig('刘裕', '宋武帝', '代晋建宋，开南朝之始')]),
    E(title='贾思勰著《齐民要术》', year=533, era='南北朝', region='china', category='science',
      content='北魏贾思勰撰成《齐民要术》十卷，收录种植、酿造、畜养、加工等农业技术八百余条，是世界上现存最早的完整农业科学著作。',
      background='北魏末年战乱流离，贾思勰访求农事经验、博览农书，务求"生民之本，当先资于食"。',
      tags=['农学', '典籍', '科技'],
      figures=[fig('贾思勰', '北魏农学家', '著《齐民要术》')]),

    # ==================== 唐 ====================
    E(title='唐传奇兴起', year=780, era='唐', region='china', category='literature',
      content='中唐时期出现《任氏传》《莺莺传》《霍小玉传》等文言短篇，题材从神鬼志怪转向现实人情，标志着中国文言小说的成熟。',
      background='唐代科举重文词，文人刻意"以文为戏"，传奇之名即取"奇特可喜之事"，为后世白话小说奠基。',
      tags=['小说', '文言短篇', '唐传奇']),
    E(title='李白奉召入长安', year=742, era='唐', region='china', category='literature',
      location='长安',
      content='天宝元年，李白应玄宗征召入京供奉翰林，深得恩遇，写下《清平调》三首与《答王十二寒夜独酌》等诗，三年后赐金放还。',
      background='玉真公主与贺知章、张垍为之举荐，李白"仰天大笑出门去"，以为政治抱负可达。',
      tags=['盛唐', '诗人', '翰林'],
      figures=[fig('李白', '诗仙', '供奉翰林，作《清平调》')]),
    E(title='杜甫寓居成都草堂', year=759, era='唐', region='china', category='literature',
      location='成都',
      content='乾元二年秋，杜甫避乱至成都浣花溪畔，筑草堂而居，两年间写下《春夜喜雨》《茅屋为秋风所破歌》《江畔独步寻花》等六十余首名篇。',
      background='安史之乱后杜甫漂泊西南，草堂岁月是其创作的高产期，也孕育了"安得广厦千万间"的仁者情怀。',
      tags=['诗圣', '草堂', '现实主义'],
      figures=[fig('杜甫', '诗圣', '寓居浣花溪草堂')]),
    E(title='韩愈倡导古文运动', year=815, era='唐', region='china', category='literature',
      location='长安',
      content='韩愈与柳宗元倡导古文运动，反对六朝以来的骈俪文风，主张"文以载道"、言必己出，重建先秦两汉散文传统。',
      background='中唐藩镇割据、佛老盛行，韩愈以"道统"自任，倡儒排佛，其文气盛言宜，开宋代古文之门。',
      tags=['古文运动', '文以载道', '唐宋八大家'],
      figures=[fig('韩愈', '唐宋八大家之首', '倡古文运动，主张文以载道'),
               fig('柳宗元', '唐宋八大家', '与韩愈同倡古文，著《永州八记》')],
      relations=[rel('韩愈', '柳宗元', '同僚', '并称"韩柳"，共倡古文')]),

    # ==================== 宋 ====================
    E(title='交子成为世界最早纸币', year=1023, era='北宋', region='china', category='society',
      location='成都',
      content='北宋天圣元年，政府在成都设立益州交子务，正式发行官交子，这是世界上最早的官方纸币，比欧洲纸币早出现六百余年。',
      background='成都多用铁钱，笨重难携，商民先自发发行私交子；官办后按界分印，十年一易。',
      tags=['货币', '商业', '经济史'],
      figures=[fig('宋真宗', '北宋皇帝', '在位期间推行官交子')]),
    E(title='乌台诗案', year=1079, era='北宋', region='china', category='politics',
      content='王安石变法期间，苏轼因诗讽新法被御史台狱（乌台）拘捕百余日，几陷死罪，贬知黄州，此后写下《念奴娇·赤壁怀古》等旷达之作。',
      background='新旧党争激烈，苏轼反对新法急进，御史何正臣等指其诗句"谤讪朝廷"。',
      tags=['党争', '贬谪', '文字狱'],
      figures=[fig('苏轼', '北宋文学家', '乌台诗案后贬黄州'),
               fig('王安石', '宰相', '主持变法，政见与苏轼相左')],
      relations=[rel('苏轼', '王安石', '政敌', '对新法推行方式意见相左')]),
    E(title='司马光编成《资治通鉴》', year=1084, era='北宋', region='china', category='literature',
      content='北宋元丰七年，司马光奉书宋神宗，历时十九年编成的编年体通史《资治通鉴》二百九十四卷完成，上起战国下至五代。',
      background='司马光以"鉴于往事，有资于治道"为宗旨，与刘恕、刘攽、范祖禹共同考订史料，采"删夺繁省"之法。',
      tags=['史学', '编年体', '通史'],
      figures=[fig('司马光', '陕陕郡公', '主编《资治通鉴》'),
               fig('宋神宗', '北宋皇帝', '御制《资治通鉴》序')],
      relations=[rel('宋神宗', '司马光', '君臣', '赐御制序并赐书于神宗')]),
    E(title='沈括著《梦溪笔谈》', year=1089, era='北宋', region='china', category='science',
      content='北宋沈括撰成《梦溪笔谈》二十六卷，记录天文、数学、物理、地质、冶金、医药等科技成就，被誉为"中国科学史上的坐标"。',
      background='沈括晚年退居润州梦溪园，将毕生见闻与实验记录成书，其中活字印刷、磁偏角等记载领先世界。',
      tags=['科技典籍', '物理', '地质'],
      figures=[fig('沈括', '北宋科学家', '著《梦溪笔谈》')]),

    # ==================== 元 ====================
    E(title='元朝推行行省制度', year=1264, era='元', region='china', category='politics',
      content='元世祖忽必烈设中书省总领全国政务，并在地方设行中书省（行省）分治天下，行省制为后世省制所本，影响延续七百余年。',
      background='元疆域空前辽阔，中央设枢密院掌军、御史台掌监察，行省辖区大而权力受节制。',
      tags=['行省制', '中央集权', '疆域'],
      figures=[fig('忽必烈', '元世祖', '定国号大元，推行行省制度')],
      relations=[rel('成吉思汗', '忽必烈', '祖孙', '忽必烈为铁木真之孙')]),
    E(title='元杂剧兴盛', year=1280, era='元', region='china', category='literature',
      content='元代戏曲以杂剧为代表，关汉卿《窦娥冤》、马致远《汉宫秋》、白朴《梧桐雨》、郑光祖《倩女离魂》并称四大名作，戏曲进入黄金时代。',
      background='元代科举长期停废，文人转入勾栏院本，市井观众与剧作家相互成就，形成"元曲四大家"。',
      tags=['戏曲', '元曲四大家', '杂剧']),

    # ==================== 明 ====================
    E(title='王阳明创立心学', year=1508, era='明', region='china', category='thought',
      content='明孝宗正德年间，王守仁在贵州龙场悟得"圣人之道，吾性自足"，提出心即理、知行合一、致良知，开明代心学之宗。',
      background='王阳明因忤刘瑾被贬龙场驿，在困顿中参悟，后平宁王之乱，讲学四方，门徒遍天下。',
      tags=['心学', '知行合一', '致良知'],
      figures=[fig('王阳明', '心学宗师', '倡心即理、知行合一、致良知')]),
    E(title='李时珍著《本草纲目》', year=1578, era='明', region='china', category='science',
      content='明万历六年，李时珍历经二十七年调研，编成《本草纲目》五十二卷，收药一千八百九十二种、附方万余，被誉为"东方药物巨典"。',
      background='李时珍三易其稿，遍访江湖、亲历物候，以纲目相兼、按类归部，纠正前人诸多谬误。',
      tags=['医药', '典籍', '科技'],
      figures=[fig('李时珍', '明代医学家', '著《本草纲目》')]),
    E(title='汤显祖作《牡丹亭》', year=1598, era='明', region='china', category='literature',
      content='明万历二十六年，汤显祖完成传奇《牡丹亭》五十五出，以杜丽娘与柳梦梅的生死之爱"生者可以死，死者可以生"，为明代戏曲之巅峰。',
      background='汤显祖自称一生四梦（牡丹、紫钗、南柯、邯郸），"临川四梦"代表其浪漫主义追求。',
      tags=['戏曲', '传奇', '临川四梦']),

    # ==================== 清 ====================
    E(title='顾炎武著《日知录》', year=1682, era='清初', region='china', category='thought',
      content='明末清初顾炎武著《日知录》三十二卷，记述经史、典章、舆地、治术，提出"天下兴亡，匹夫有责"，开清代考据学风之先。',
      background='顾炎武亡国后隐居华山、遍游北方，凡经史、音韵、兵法、水利无所不问，为清初三大儒之一。',
      tags=['考据学', '明清之际', '经世致用'],
      figures=[fig('顾炎武', '明末清初学者', '著《日知录》，倡经世致用')]),
    E(title='乾隆开四库全书馆', year=1773, era='清', region='china', category='literature',
      location='北京',
      content='清乾隆三十八年，高宗下诏开设四库全书馆，纪昀总其大成，编纂《四库全书》三万六千余册，同时禁毁不利于清朝的典籍。',
      background='编纂历时十余年，按经史子集四部分类；与编纂并行的是大规模查禁销毁，史称"文字狱"时代。',
      tags=['丛书', '禁毁', '学术'],
      figures=[fig('乾隆帝', '清高宗', '敕建四库全书馆'),
               fig('纪昀', '四库全书总纂官', '主持编纂《四库全书》')]),

    # ==================== 近现代中国 ====================
    E(title='孟德尔发现遗传规律', year=1865, era='近代', region='west', category='science',
      content='奥地利博物学家孟德尔在布拉格发表豌豆杂交实验结果，提出遗传的分离与自由组合规律，奠定现代遗传学基础。',
      background='孟德尔在修道院花园种植豌豆八年，通过定量统计得出"数学上的规律"，其成果沉寂三十四年后方被重新发现。',
      tags=['遗传学', '定量实验', '科学革命'],
      figures=[fig('孟德尔', '遗传学之父', '发现遗传定律')]),
    E(title='蒸汽火车问世', year=1814, era='工业革命', region='west', category='science',
      location='伦敦',
      content='英国工程师史蒂芬逊制成第一台能牵引车列行驶的蒸汽机车，十九世纪铁路网络遍布欧美，把世界连成一张"铁路之网"。',
      background='瓦特改良蒸汽机后，运输需求催生铁路；1825 年第一条营业铁路（斯托克顿—达灵顿）通车。',
      tags=['工业革命', '铁路', '交通'],
      figures=[fig('史蒂芬逊', '铁路工程师', '发明早期蒸汽机车')]),
    E(title='培根著《新工具》', year=1620, era='科学革命', region='west', category='thought',
      content='英国哲学家培根著《新工具》（Novum Organum），系统提出经验归纳法，主张知识来源于实验与观察，倡导"知识就是力量"。',
      background='培根与笛卡尔分别代表经验论与唯理论，共同奠定近代科学方法论。',
      tags=['经验主义', '方法论', '科学革命'],
      figures=[fig('培根', '经验主义鼻祖', '著《新工具》，倡归纳法')]),
    E(title='孟德斯鸠著《论法的精神》', year=1748, era='启蒙运动', region='west', category='thought',
      location='巴黎',
      content='孟德斯鸠出版《论法的精神》，论证政体与自然气候、风俗、经济的关系，提出立法、行政、司法三权分立的学说。',
      background='启蒙思想影响美国制宪：三权分立与制衡原则直接写入美国 1787 年宪法。',
      tags=['启蒙思想', '三权分立', '政体'],
      figures=[fig('孟德斯鸠', '启蒙思想家', '著《论法的精神》'),
               fig('卢梭', '启蒙思想家', '主张社会契约与人民主权')],
      relations=[rel('孟德斯鸠', '卢梭', '同僚', '同署启蒙思想，政见略有分歧')]),
    E(title='卢梭著《社会契约论》', year=1762, era='启蒙运动', region='west', category='thought',
      location='巴黎',
      content='卢梭在《社会契约论》中提出"人生而自由，却无往不在枷锁之中"，主张主权在民与公意立法，为法国大革命提供了理论武器。',
      background='《社会契约论》在日内瓦出版后被列禁，卢梭本人亦遭驱逐；其学说与《论人类不平等的起源》并称。',
      tags=['启蒙思想', '人民主权', '公意'],
      figures=[fig('卢梭', '启蒙思想家', '著《社会契约论》')]),
    E(title='蔡元培改革北京大学', year=1917, era='近代', region='china', category='thought',
      location='北京',
      content='蔡元培出任北大校长，倡"思想自由、兼容并包"，延聘陈独秀、胡适、李大钊等新派学者，使北大成为新文化运动与五四运动的中心。',
      background='蔡元培留德七年，回国后以欧洲大学之制整顿北大，废等级、尊学术，奠定现代大学精神。',
      tags=['新文化运动', '五四运动', '教育'],
      figures=[fig('蔡元培', '北大校长', '倡思想自由、兼容并包'),
               fig('陈独秀', '新文化运动旗手', '主编《新青年》'),
               fig('鲁迅', '文学家', '发表《狂人日记》')],
      relations=[rel('蔡元培', '陈独秀', '同僚', '聘请陈独秀任文科学长')]),

    # ==================== 现代 ====================
    E(title='钱学森冲破阻挠归国', year=1955, era='现代', region='china', category='science',
      content='1955 年，在经历五年美方阻留后，钱学森携妻女回到祖国，此后主持"两弹一星"研制，使中国导弹与航天技术跻身世界前列。',
      background='钱学森在美任教于加州理工，是伯克霍夫学派的核心人物；回国时美方以"等于五个师"为由层层设卡。',
      tags=['科学家', '两弹一星', '留学归国'],
      figures=[fig('钱学森', '航天之父', '主持导弹与航天工程')],
      relations=[rel('钱学森', '邓稼先', '同僚', '同为两弹一星核心科学家')]),
    E(title='图灵提出通用计算机模型', year=1936, era='现代', region='west', category='science',
      content='英国数学家图灵发表《论可计算数》，用"图灵机"形式化定义了可计算性，奠定了现代计算机科学与人工智能的理论基础。',
      background='图灵机用纸带与读写头表达一切算法；二战期间他参与破解恩尼格玛密码，其思想成就超前数十年。',
      tags=['计算机科学', '理论', '人工智能'],
      figures=[fig('图灵', '计算机科学之父', '提出图灵机模型')]),
    E(title='电子计算机 ENIAC 诞生', year=1946, era='现代', region='west', category='science',
      location='费城',
      content='美国宾夕法尼亚大学研制成功世界上第一台通用电子数字计算机 ENIAC，重达三十吨、耗电一百五十千瓦，标志着电子计算时代的开始。',
      background='ENIAC 最初为弹道计算而造，后用于氢弹相关计算；其发明者莫奇利与埃克特亦主张程序存储。',
      tags=['计算机', '电子技术', '里程碑']),
    E(title='苏联发射第一颗人造卫星', year=1957, era='现代', region='west', category='science',
      location='莫斯科',
      content='1957 年 10 月 4 日，苏联成功发射斯普特尼克一号，人类首次将人造物体送入地球轨道，航天时代由此开启。',
      background='卫星发射引发美国"斯普特尼克危机"，双方由此展开长达数十年的太空竞赛。',
      tags=['航天', '太空竞赛', '冷战'],
      figures=[fig('科罗廖夫', '航天总工程师', '主持斯普特尼克发射')]),
    E(title='人工合成牛胰岛素', year=1965, era='现代', region='china', category='science',
      content='1965 年 9 月，中国科学家在世界上首次人工合成具有完整生物活性的结晶牛胰岛素，是首个由人工合成的蛋白质。',
      background='上海、北京多家研究所协作，历时十年，用化学方法合成四十一肽的 A、B 两条链并对接成正确结构。',
      tags=['生物化学', '蛋白质合成', '合作攻关']),
    E(title='杂交水稻育成', year=1973, era='现代', region='china', category='science',
      location='长沙',
      content='1973 年，袁隆平团队培育出籼型杂交水稻三系组合并试种成功，亩产大幅提高，被称为"东方魔稻"。',
      background='袁隆平从天然雄性不育株入手，历经六年找到"野败"，突破了水稻自花授粉难以杂交的传统认识。',
      tags=['农业', '粮食安全', '育种'],
      figures=[fig('袁隆平', '杂交水稻之父', '育成三系杂交水稻')]),
    E(title='克隆羊多莉诞生', year=1996, era='现代', region='west', category='science',
      content='1996 年 7 月，英国罗斯林研究所用体细胞核移植技术克隆出绵羊"多莉"，首次证明哺乳动物体细胞可重新编程为全能细胞。',
      background='多莉由乳腺上皮细胞核与去核卵母细胞融合而成，其成果引发全球关于克隆伦理的持续争论。',
      tags=['生物技术', '克隆', '干细胞']),
    E(title='人类基因组计划完成', year=2003, era='现代', region='west', category='science',
      content='2003 年 4 月，国际人类基因组计划宣布完成人类基因组序列测定，三十亿碱基对、约两万两千个基因，人类进入精准医学与基因编辑时代。',
      background='该计划于 1990 年启动，耗资三十亿美元，由六国科学家合作完成；测序成本的下降随后催生精准医疗产业。',
      tags=['基因组学', '国际合作', '生命科学']),
    E(title='全球气候大会通过《巴黎协定》', year=2015, era='现代', region='west', category='society',
      location='巴黎',
      content='2015 年 12 月，196 个缔约方在巴黎签署《巴黎协定》，约定将全球升温控制在 2 摄氏度以内、力争不超过 1.5 摄氏度。',
      background='协定首次以共同但有区别的责任为基础确立各方自主贡献（NDC），2016 年 11 月正式生效。',
      tags=['气候变化', '国际合作', '环境'],
      figures=[fig('联合国', '国际组织', '主持《巴黎协定》谈判')]),
    E(title='生成式人工智能兴起', year=2022, era='现代', region='west', category='science',
      content='2022 年底大语言模型 ChatGPT 上线，Transformer 与大规模预训练技术催生生成式 AI 浪潮，内容生产、编程与教育方式被迅速重塑。',
      background='Transformer 架构自 2017 年提出，随后参数规模与数据量指数级扩张，模型开始具备常识推理与工具调用能力。',
      tags=['人工智能', '大模型', '技术变革'],
      figures=[fig('Altman', '生成式 AI 负责人', 'ChatGPT 项目负责人')]),

    # ==================== 近代中国科技补充 ====================
    E(title='詹天佑主持修建京张铁路', year=1909, era='近代', region='china', category='science',
      location='北京',
      content='1909 年，詹天佑主持的京张铁路全线通车，采用"人字形"展线与竖井开凿法建成八达岭关沟段，是中国首条自主设计施工的干线铁路。',
      background='京张铁路曾被列强断言中国无能力自修，詹天佑以技术革新与精细管理提前两年竣工。',
      tags=['铁路', '自主创新', '近代工程'],
      figures=[fig('詹天佑', '铁路总工程师', '主持京张铁路建设')]),
]

NEW_TITLE = '淝水之战'  # 库中 383 年误作"泗水之战"，本脚本同时修正其 title 与正文

# parseTimelineLocation 的解析白名单：主表键值（含别名）+ 已核实可由诗词古地名库兜底解析的地名。
# 主表见 src/utils/timeline-service.ts:81 的 TIMELINE_LOCATION_COORDS；
# 兜底见 src/utils/poetry-location.ts（如 柴桑→九江、成都、绍兴）。
COORD_KEYS = {'伦敦', '巴黎', '罗马', '柏林', '华盛顿', '纽约', '莫斯科', '东京', '雅典',
              '维也纳', '佛罗伦萨', '北京', '南京', '广州', '武汉', '长沙', '曲阜', '南昌',
              '遵义', '沈阳', '威海', '延安', '重庆', '香港', '上海', '西安', '华沙', '费城',
              '萨拉热窝'}
COORD_ALIASES = {'北平', '顺天', '燕京', '金陵', '建康', '江宁', '羊城', '穗', '长安', '柴桑',
                 '成都', '绍兴', '岳阳', '济南', '扬州', '洛阳', '黄冈', '开封', '九江'}


def main():
    path = os.path.join(BASE, 'index.json')
    with open(path, encoding='utf-8') as f:
        doc = json.load(f)

    old_titles = {e['title'] for e in doc['events']}
    new_titles = [e['title'] for e in EVENTS]
    dup_old = [t for t in new_titles if t in old_titles]
    dup_new = sorted({t for t in new_titles if new_titles.count(t) > 1})
    print(f'现有事件 {len(doc["events"])} 条，计划新增 {len(EVENTS)} 条'
          f' | 与旧库重名={dup_old} 批内重名={dup_new}')
    assert not dup_old, dup_old
    assert not dup_new, dup_new

    bad_cat = [e['title'] for e in EVENTS
               if e['category'] not in ('politics', 'literature', 'science', 'thought', 'society')]
    bad_region = [e['title'] for e in EVENTS if e['region'] not in ('china', 'west')]
    bad_year = [e['title'] for e in EVENTS if not isinstance(e.get('year'), int)]
    print(f'分类越界={bad_cat} 区域越界={bad_region} 年份异常={bad_year}')
    assert not bad_cat and not bad_region and not bad_year

    # location 必须能被 parseTimelineLocation 解析，否则地图视图会丢点
    bad_loc = [e['title'] for e in EVENTS
               if e.get('location') and e['location'] not in COORD_KEYS | COORD_ALIASES]
    print(f'地点无法解析={bad_loc}')
    assert not bad_loc, bad_loc

    # figures 人名必须非空，否则关系图上会出现无名节点
    bad_fig = [(e['title'], f['name']) for e in EVENTS for f in e.get('figures') or []
               if not f['name'] or not f['desc']]
    print(f'异常 figures={bad_fig}')
    assert not bad_fig, bad_fig

    # relations 两端人名应对上本次批次或旧库已有 figures，否则图里只剩光秃秃的裸节点
    batch_names = {f['name'] for e in EVENTS for f in e.get('figures') or []}
    library_names = {f['name'] for e in doc['events'] for f in e.get('figures') or []}
    known = batch_names | library_names
    orphan = [(e['title'], r['from'], r['to']) for e in EVENTS
              for r in e.get('relations') or []
              if r['from'] not in known or r['to'] not in known]
    print(f'关系端点无任何 figures 条目={orphan}')
    assert not orphan, orphan

    # 修正库中"泗水之战"的错字（谢玄破苻坚处为淝水）
    fixed = 0
    for e in doc['events']:
        if e['title'] == '泗水之战':
            e['title'] = NEW_TITLE
            e['content'] = e['content'].replace('泗水', '淝水')
            fixed += 1
    print(f'修正"泗水之战"→"淝水之战": {fixed} 处')
    assert fixed == 1

    doc['events'].extend(EVENTS)
    doc['version'] = 2
    doc['updatedAt'] = UPDATED
    # 库描述里写的是 region(china|west|modern)，与 TimelineRegion 类型（china|west）不符，一并修正
    doc['description'] = doc['description'].replace('region(china|west|modern)', 'region(china|west)')

    if not CHECK_ONLY:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(json.dumps(doc, ensure_ascii=False, indent=2))

    print(f'总计 {len(doc["events"]) - len(EVENTS)} -> {len(doc["events"])}'
          f'（新增 {len(EVENTS)} 条）version={doc["version"]} updatedAt={doc["updatedAt"]}'
          + (' [check only]' if CHECK_ONLY else ''))


if __name__ == '__main__':
    main()
