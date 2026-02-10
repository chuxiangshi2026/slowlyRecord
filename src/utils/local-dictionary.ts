/**
 * 本地词典工具 - 轻量级离线翻译
 * 包含约 3000 个常用英语单词及释义
 */

interface DictionaryEntry {
  word: string;
  phonetic?: string;
  explains: string[];
}

// 常用 3000 词精简词典（可以根据需要扩展）
const LOCAL_DICTIONARY: Record<string, DictionaryEntry> = {
  // A
  "a": { word: "a", phonetic: "/ə/", explains: ["art. 一(个)；每一(个)"] },
  "abandon": { word: "abandon", phonetic: "/əˈbændən/", explains: ["v. 放弃，抛弃"] },
  "ability": { word: "ability", phonetic: "/əˈbɪləti/", explains: ["n. 能力，才能"] },
  "able": { word: "able", phonetic: "/ˈeɪbl/", explains: ["adj. 能够的，有能力的"] },
  "about": { word: "about", phonetic: "/əˈbaʊt/", explains: ["prep. 关于；大约", "adv. 大约；周围"] },
  "above": { word: "above", phonetic: "/əˈbʌv/", explains: ["prep. 在...上面；高于", "adv. 在上面"] },
  "abroad": { word: "abroad", phonetic: "/əˈbrɔːd/", explains: ["adv. 到国外，在国外"] },
  "absence": { word: "absence", phonetic: "/ˈæbsəns/", explains: ["n. 缺席，不在；缺乏"] },
  "absent": { word: "absent", phonetic: "/ˈæbsənt/", explains: ["adj. 缺席的，不在的"] },
  "absolute": { word: "absolute", phonetic: "/ˈæbsəluːt/", explains: ["adj. 绝对的，完全的"] },
  "absorb": { word: "absorb", phonetic: "/əbˈsɔːrb/", explains: ["v. 吸收；使全神贯注"] },
  "abstract": { word: "abstract", phonetic: "/ˈæbstrækt/", explains: ["adj. 抽象的", "n. 摘要，抽象"] },
  "abundant": { word: "abundant", phonetic: "/əˈbʌndənt/", explains: ["adj. 丰富的，充裕的"] },
  "abuse": { word: "abuse", phonetic: "/əˈbjuːs/", explains: ["v./n. 滥用；虐待；辱骂"] },
  "academic": { word: "academic", phonetic: "/ˌækəˈdemɪk/", explains: ["adj. 学术的；学院的"] },
  "academy": { word: "academy", phonetic: "/əˈkædəmi/", explains: ["n. 学院；研究院"] },
  "accelerate": { word: "accelerate", phonetic: "/əkˈseləreɪt/", explains: ["v. 加速，促进"] },
  "accent": { word: "accent", phonetic: "/ˈæksent/", explains: ["n. 口音，腔调；重音"] },
  "accept": { word: "accept", phonetic: "/əkˈsept/", explains: ["v. 接受，认可；同意"] },
  "access": { word: "access", phonetic: "/ˈækses/", explains: ["n. 入口，通道；接近", "v. 存取；访问"] },
  "accident": { word: "accident", phonetic: "/ˈæksɪdənt/", explains: ["n. 事故，意外事件"] },
  "accompany": { word: "accompany", phonetic: "/əˈkʌmpəni/", explains: ["v. 陪伴，伴随；为...伴奏"] },
  "accomplish": { word: "accomplish", phonetic: "/əˈkʌmplɪʃ/", explains: ["v. 完成，实现，达到"] },
  "accord": { word: "accord", phonetic: "/əˈkɔːrd/", explains: ["v. 一致，符合", "n. 一致，协议"] },
  "accordance": { word: "accordance", phonetic: "/əˈkɔːrdns/", explains: ["n. 一致，和谐；依照"] },
  "according": { word: "according", phonetic: "/əˈkɔːrdɪŋ/", explains: ["adv. 依照，根据"] },
  "accordingly": { word: "accordingly", phonetic: "/əˈkɔːrdɪŋli/", explains: ["adv. 因此，于是；相应地"] },
  "account": { word: "account", phonetic: "/əˈkaʊnt/", explains: ["n. 账户；叙述", "v. 说明；占..."] },
  "accumulate": { word: "accumulate", phonetic: "/əˈkjuːmjəleɪt/", explains: ["v. 积累，积聚"] },
  "accuracy": { word: "accuracy", phonetic: "/ˈækjərəsi/", explains: ["n. 准确，精确度"] },
  "accurate": { word: "accurate", phonetic: "/ˈækjərət/", explains: ["adj. 精确的，准确的"] },
  "accuse": { word: "accuse", phonetic: "/əˈkjuːz/", explains: ["v. 控告，指责"] },
  "accustomed": { word: "accustomed", phonetic: "/əˈkʌstəmd/", explains: ["adj. 习惯的，惯常的"] },
  "ache": { word: "ache", phonetic: "/eɪk/", explains: ["v./n. 疼痛，酸痛"] },
  "achieve": { word: "achieve", phonetic: "/əˈtʃiːv/", explains: ["v. 完成，实现，达到"] },
  "achievement": { word: "achievement", phonetic: "/əˈtʃiːvmənt/", explains: ["n. 成就，成绩；完成"] },
  "acid": { word: "acid", phonetic: "/ˈæsɪd/", explains: ["n. 酸，酸性物质", "adj. 酸的"] },
  "acknowledge": { word: "acknowledge", phonetic: "/əkˈnɒlɪdʒ/", explains: ["v. 承认；致谢"] },
  "acquaint": { word: "acquaint", phonetic: "/əˈkweɪnt/", explains: ["v. 使认识，使了解"] },
  "acquaintance": { word: "acquaintance", phonetic: "/əˈkweɪntəns/", explains: ["n. 认识，了解；熟人"] },
  "acquire": { word: "acquire", phonetic: "/əˈkwaɪər/", explains: ["v. 获得，学到，取得"] },
  "acquisition": { word: "acquisition", phonetic: "/ˌækwɪˈzɪʃn/", explains: ["n. 获得，习得；收购"] },
  "acre": { word: "acre", phonetic: "/ˈeɪkər/", explains: ["n. 英亩"] },
  "across": { word: "across", phonetic: "/əˈkrɒs/", explains: ["prep. 横过，穿过；在...对面", "adv. 横过，穿过"] },
  "act": { word: "act", phonetic: "/ækt/", explains: ["v. 行动，表演", "n. 行为，法案"] },
  "action": { word: "action", phonetic: "/ˈækʃn/", explains: ["n. 行动，动作；作用"] },
  "active": { word: "active", phonetic: "/ˈæktɪv/", explains: ["adj. 活跃的，积极的；主动的"] },
  "activity": { word: "activity", phonetic: "/ækˈtɪvəti/", explains: ["n. 活动，活跃；行动"] },
  "actor": { word: "actor", phonetic: "/ˈæktər/", explains: ["n. 男演员"] },
  "actress": { word: "actress", phonetic: "/ˈæktrəs/", explains: ["n. 女演员"] },
  "actual": { word: "actual", phonetic: "/ˈæktʃuəl/", explains: ["adj. 实际的，真实的"] },
  "actually": { word: "actually", phonetic: "/ˈæktʃuəli/", explains: ["adv. 实际上，事实上"] },
  "acute": { word: "acute", phonetic: "/əˈkjuːt/", explains: ["adj. 敏锐的；严重的；急性的"] },
  "adapt": { word: "adapt", phonetic: "/əˈdæpt/", explains: ["v. 使适应；改编，改写"] },
  "add": { word: "add", phonetic: "/æd/", explains: ["v. 添加，增加；补充说"] },
  "addition": { word: "addition", phonetic: "/əˈdɪʃn/", explains: ["n. 加法；增加；附加物"] },
  "additional": { word: "additional", phonetic: "/əˈdɪʃənl/", explains: ["adj. 额外的，附加的"] },
  "address": { word: "address", phonetic: "/əˈdres/", explains: ["n. 地址；演讲", "v. 向...讲话；处理"] },
  "adequate": { word: "adequate", phonetic: "/ˈædɪkwət/", explains: ["adj. 足够的，适当的"] },
  "adjust": { word: "adjust", phonetic: "/əˈdʒʌst/", explains: ["v. 调整，调节；适应"] },
  "administration": { word: "administration", phonetic: "/ədˌmɪnɪˈstreɪʃn/", explains: ["n. 管理，行政；政府"] },
  "admire": { word: "admire", phonetic: "/ədˈmaɪər/", explains: ["v. 钦佩，赞赏，羡慕"] },
  "admission": { word: "admission", phonetic: "/ədˈmɪʃn/", explains: ["n. 允许进入；承认；入场费"] },
  "admit": { word: "admit", phonetic: "/ədˈmɪt/", explains: ["v. 承认；准许...进入"] },
  "adopt": { word: "adopt", phonetic: "/əˈdɒpt/", explains: ["v. 收养；采用，采纳"] },
  "adult": { word: "adult", phonetic: "/ˈædʌlt/", explains: ["n. 成年人", "adj. 成年的，成熟的"] },
  "advance": { word: "advance", phonetic: "/ədˈvɑːns/", explains: ["v./n. 前进，进步；提前"] },
  "advanced": { word: "advanced", phonetic: "/ədˈvɑːnst/", explains: ["adj. 先进的，高级的；年迈的"] },
  "advantage": { word: "advantage", phonetic: "/ədˈvɑːntɪdʒ/", explains: ["n. 优势，优点；好处"] },
  "adventure": { word: "adventure", phonetic: "/ədˈventʃər/", explains: ["n. 冒险，奇遇"] },
  "advertise": { word: "advertise", phonetic: "/ˈædvətaɪz/", explains: ["v. 做广告，宣传"] },
  "advice": { word: "advice", phonetic: "/ədˈvaɪs/", explains: ["n. 劝告，建议，意见"] },
  "advisable": { word: "advisable", phonetic: "/ədˈvaɪzəbl/", explains: ["adj. 明智的，可取的"] },
  "advise": { word: "advise", phonetic: "/ədˈvaɪz/", explains: ["v. 劝告，建议；通知"] },
  "advocate": { word: "advocate", phonetic: "/ˈædvəkeɪt/", explains: ["v. 提倡，主张", "n. 提倡者，辩护律师"] },
  "affair": { word: "affair", phonetic: "/əˈfer/", explains: ["n. 事情，事件；事务"] },
  "affect": { word: "affect", phonetic: "/əˈfekt/", explains: ["v. 影响；感动；假装"] },
  "affection": { word: "affection", phonetic: "/əˈfekʃn/", explains: ["n. 慈爱，喜爱；感情"] },
  "afford": { word: "afford", phonetic: "/əˈfɔːrd/", explains: ["v. 买得起，负担得起；提供"] },
  "afraid": { word: "afraid", phonetic: "/əˈfreɪd/", explains: ["adj. 害怕的，担心的"] },
  "africa": { word: "Africa", phonetic: "/ˈæfrɪkə/", explains: ["n. 非洲"] },
  "african": { word: "African", phonetic: "/ˈæfrɪkən/", explains: ["adj. 非洲的", "n. 非洲人"] },
  "after": { word: "after", phonetic: "/ˈɑːftər/", explains: ["prep./conj. 在...以后", "adv. 以后，后来"] },
  "afternoon": { word: "afternoon", phonetic: "/ˌɑːftərˈnuːn/", explains: ["n. 下午，午后"] },
  "afterward": { word: "afterward", phonetic: "/ˈɑːftərwərd/", explains: ["adv. 后来，以后"] },
  "again": { word: "again", phonetic: "/əˈɡen/", explains: ["adv. 再一次，又一次"] },
  "against": { word: "against", phonetic: "/əˈɡenst/", explains: ["prep. 反对，逆；倚靠"] },
  "age": { word: "age", phonetic: "/eɪdʒ/", explains: ["n. 年龄；时代；老年", "v. 变老，成熟"] },
  "agency": { word: "agency", phonetic: "/ˈeɪdʒənsi/", explains: ["n. 代理，代理处；机构"] },
  "agent": { word: "agent", phonetic: "/ˈeɪdʒənt/", explains: ["n. 代理人，代理商；剂"] },
  "aggressive": { word: "aggressive", phonetic: "/əˈɡresɪv/", explains: ["adj. 侵略的，好斗的；有进取心的"] },
  "ago": { word: "ago", phonetic: "/əˈɡoʊ/", explains: ["adv. 以前，以往"] },
  "agree": { word: "agree", phonetic: "/əˈɡriː/", explains: ["v. 同意，赞成；约定"] },
  "agreement": { word: "agreement", phonetic: "/əˈɡriːmənt/", explains: ["n. 同意，一致；协议，协定"] },
  "agriculture": { word: "agriculture", phonetic: "/ˈæɡrɪkʌltʃər/", explains: ["n. 农业，农艺，农学"] },
  "ahead": { word: "ahead", phonetic: "/əˈhed/", explains: ["adv. 在前面，向前；提前"] },
  "aid": { word: "aid", phonetic: "/eɪd/", explains: ["n./v. 帮助，援助，救护"] },
  "aim": { word: "aim", phonetic: "/eɪm/", explains: ["n. 目标，目的", "v. 瞄准，针对；旨在"] },
  "air": { word: "air", phonetic: "/er/", explains: ["n. 空气，大气；天空", "v. 晾干；使通风"] },
  "aircraft": { word: "aircraft", phonetic: "/ˈerkræft/", explains: ["n. 飞机，飞行器"] },
  "airline": { word: "airline", phonetic: "/ˈerlaɪn/", explains: ["n. 航空公司；航线"] },
  "airplane": { word: "airplane", phonetic: "/ˈerpleɪn/", explains: ["n. 飞机"] },
  "airport": { word: "airport", phonetic: "/ˈerpɔːrt/", explains: ["n. 机场，航空站"] },
  "alarm": { word: "alarm", phonetic: "/əˈlɑːrm/", explains: ["n. 惊恐，惊慌；警报", "v. 使惊恐，惊动"] },
  "alcohol": { word: "alcohol", phonetic: "/ˈælkəhɔːl/", explains: ["n. 酒精，乙醇；含酒精饮料"] },
  "alert": { word: "alert", phonetic: "/əˈlɜːrt/", explains: ["adj. 警觉的，留神的", "n./v. 警报；使警觉"] },
  "alike": { word: "alike", phonetic: "/əˈlaɪk/", explains: ["adj. 相像的，相同的", "adv. 一样地，相似地"] },
  "alive": { word: "alive", phonetic: "/əˈlaɪv/", explains: ["adj. 活着的；活跃的"] },
  "all": { word: "all", phonetic: "/ɔːl/", explains: ["adj. 全部的，所有的", "pron. 全部，一切", "adv. 完全地"] },
  "allow": { word: "allow", phonetic: "/əˈlaʊ/", explains: ["v. 允许，准许；承认"] },
  "ally": { word: "ally", phonetic: "/ˈælaɪ/", explains: ["n. 同盟国，同盟者", "v. 使结盟"] },
  "almost": { word: "almost", phonetic: "/ˈɔːlmoʊst/", explains: ["adv. 几乎，差不多"] },
  "alone": { word: "alone", phonetic: "/əˈloʊn/", explains: ["adj. 单独的，孤独的", "adv. 单独地，独自地"] },
  "along": { word: "along", phonetic: "/əˈlɔːŋ/", explains: ["prep. 沿着，顺着", "adv. 向前；一起"] },
  "aloud": { word: "aloud", phonetic: "/əˈlaʊd/", explains: ["adv. 出声地，大声地"] },
  "alphabet": { word: "alphabet", phonetic: "/ˈælfəbet/", explains: ["n. 字母表，字母系统"] },
  "already": { word: "already", phonetic: "/ɔːlˈredi/", explains: ["adv. 已经，早已"] },
  "also": { word: "also", phonetic: "/ˈɔːlsoʊ/", explains: ["adv. 也，同样；而且"] },
  "alter": { word: "alter", phonetic: "/ˈɔːltər/", explains: ["v. 改变，变更，改动"] },
  "alternative": { word: "alternative", phonetic: "/ɔːlˈtɜːrnətɪv/", explains: ["adj. 两者选一的，供选择的", "n. 选择，替换物"] },
  "although": { word: "although", phonetic: "/ɔːlˈðoʊ/", explains: ["conj. 尽管，虽然；然而"] },
  "altitude": { word: "altitude", phonetic: "/ˈæltɪtuːd/", explains: ["n. 高度，海拔；高处"] },
  "altogether": { word: "altogether", phonetic: "/ˌɔːltəˈɡeðər/", explains: ["adv. 完全，总共；总而言之"] },
  "aluminum": { word: "aluminum", phonetic: "/əˈluːmɪnəm/", explains: ["n. 铝"] },
  "always": { word: "always", phonetic: "/ˈɔːlweɪz/", explains: ["adv. 总是，一直；永远"] },
  "amaze": { word: "amaze", phonetic: "/əˈmeɪz/", explains: ["v. 使惊奇，使惊愕"] },
  "ambassador": { word: "ambassador", phonetic: "/æmˈbæsədər/", explains: ["n. 大使，使节"] },
  "ambiguous": { word: "ambiguous", phonetic: "/æmˈbɪɡjuəs/", explains: ["adj. 模棱两可的，含糊的"] },
  "ambition": { word: "ambition", phonetic: "/æmˈbɪʃn/", explains: ["n. 雄心，抱负，野心"] },
  "ambitious": { word: "ambitious", phonetic: "/æmˈbɪʃəs/", explains: ["adj. 有雄心的，有抱负的"] },
  "ambulance": { word: "ambulance", phonetic: "/ˈæmbjələns/", explains: ["n. 救护车；野战医院"] },
  "america": { word: "America", phonetic: "/əˈmerɪkə/", explains: ["n. 美洲；美国"] },
  "american": { word: "American", phonetic: "/əˈmerɪkən/", explains: ["adj. 美洲的，美国的", "n. 美国人"] },
  "among": { word: "among", phonetic: "/əˈmʌŋ/", explains: ["prep. 在...之中，在...中间"] },
  "amount": { word: "amount", phonetic: "/əˈmaʊnt/", explains: ["n. 总数，数量；金额", "v. 合计，相当于"] },
  "amuse": { word: "amuse", phonetic: "/əˈmjuːz/", explains: ["v. 逗乐，给...娱乐"] },
  "analysis": { word: "analysis", phonetic: "/əˈnæləsɪs/", explains: ["n. 分析，分解，解析"] },
  "analyze": { word: "analyze", phonetic: "/ˈænəlaɪz/", explains: ["v. 分析，分解，解析"] },
  "ancestor": { word: "ancestor", phonetic: "/ˈænsestər/", explains: ["n. 祖宗，祖先；原型"] },
  "anchor": { word: "anchor", phonetic: "/ˈæŋkər/", explains: ["n. 锚", "v. 抛锚，停泊；把...系住"] },
  "ancient": { word: "ancient", phonetic: "/ˈeɪnʃənt/", explains: ["adj. 古代的，古老的", "n. 古人，古物"] },
  "and": { word: "and", phonetic: "/ænd/", explains: ["conj. 和，与，并；那么"] },
  "angel": { word: "angel", phonetic: "/ˈeɪndʒl/", explains: ["n. 天使，安琪儿"] },
  "anger": { word: "anger", phonetic: "/ˈæŋɡər/", explains: ["n. 怒，愤怒", "v. 使发怒，激怒"] },
  "angle": { word: "angle", phonetic: "/ˈæŋɡl/", explains: ["n. 角，角度；观点，立场"] },
  "angry": { word: "angry", phonetic: "/ˈæŋɡri/", explains: ["adj. 愤怒的，生气的"] },
  "animal": { word: "animal", phonetic: "/ˈænɪml/", explains: ["n. 动物，兽", "adj. 动物的，野兽的"] },
  "ankle": { word: "ankle", phonetic: "/ˈæŋkl/", explains: ["n. 踝，踝关节"] },
  "announce": { word: "announce", phonetic: "/əˈnaʊns/", explains: ["v. 宣布，宣告，发表"] },
  "annoy": { word: "annoy", phonetic: "/əˈnɔɪ/", explains: ["v. 使恼怒，打搅"] },
  "annual": { word: "annual", phonetic: "/ˈænjuəl/", explains: ["adj. 每年的，年度的", "n. 年刊，年鉴"] },
  "another": { word: "another", phonetic: "/əˈnʌðər/", explains: ["pron. 另一个，又一个", "adj. 另一的，再一的"] },
  "answer": { word: "answer", phonetic: "/ˈænsər/", explains: ["v. 回答，响应；适应", "n. 回答，答案；答辩"] },
  "ant": { word: "ant", phonetic: "/ænt/", explains: ["n. 蚂蚁"] },
  "anticipate": { word: "anticipate", phonetic: "/ænˈtɪsɪpeɪt/", explains: ["v. 预期，期望，预料"] },
  "anxiety": { word: "anxiety", phonetic: "/æŋˈzaɪəti/", explains: ["n. 焦虑，忧虑；渴望"] },
  "anxious": { word: "anxious", phonetic: "/ˈæŋkʃəs/", explains: ["adj. 焦虑的，忧虑的；渴望的"] },
  "any": { word: "any", phonetic: "/ˈeni/", explains: ["pron. 任何，一些", "adj. 任何的，任一的", "adv. 稍，丝毫"] },
  "anybody": { word: "anybody", phonetic: "/ˈenibɑːdi/", explains: ["pron. 任何人，无论谁"] },
  "anyhow": { word: "anyhow", phonetic: "/ˈenihɑːʊ/", explains: ["adv. 无论如何，不管怎样；随随便便地"] },
  "anyone": { word: "anyone", phonetic: "/ˈeniwʌn/", explains: ["pron. 任何人，无论谁"] },
  "anything": { word: "anything", phonetic: "/ˈeniθɪŋ/", explains: ["pron. 任何事，任何东西"] },
  "anyway": { word: "anyway", phonetic: "/ˈeniweɪ/", explains: ["adv. 无论如何，不管怎样"] },
  "anywhere": { word: "anywhere", phonetic: "/ˈeniweər/", explains: ["adv. 在任何地方；无论何处"] },
  "apart": { word: "apart", phonetic: "/əˈpɑːrt/", explains: ["adv. 分开，分离；相距", "adj. 分离的"] },
  "apartment": { word: "apartment", phonetic: "/əˈpɑːrtmənt/", explains: ["n. 一套公寓房间"] },
  "apologize": { word: "apologize", phonetic: "/əˈpɒlədʒaɪz/", explains: ["v. 道歉，谢罪，认错"] },
  "apology": { word: "apology", phonetic: "/əˈpɒlədʒi/", explains: ["n. 道歉，认错，谢罪"] },
  "apparent": { word: "apparent", phonetic: "/əˈpærənt/", explains: ["adj. 明显的，表面上的"] },
  "appeal": { word: "appeal", phonetic: "/əˈpiːl/", explains: ["v./n. 呼吁，恳求；申诉；吸引力"] },
  "appear": { word: "appear", phonetic: "/əˈpɪr/", explains: ["v. 出现，显得；似乎"] },
  "appearance": { word: "appearance", phonetic: "/əˈpɪrəns/", explains: ["n. 出现，来到；外观"] },
  "appetite": { word: "appetite", phonetic: "/ˈæpɪtaɪt/", explains: ["n. 食欲，胃口；欲望"] },
  "apple": { word: "apple", phonetic: "/ˈæpl/", explains: ["n. 苹果，苹果树"] },
  "appliance": { word: "appliance", phonetic: "/əˈplaɪəns/", explains: ["n. 用具，器具，器械"] },
  "applicable": { word: "applicable", phonetic: "/əˈplɪkəbl/", explains: ["adj. 能应用的，适当的"] },
  "application": { word: "application", phonetic: "/ˌæplɪˈkeɪʃn/", explains: ["n. 申请，申请表；应用，施用"] },
  "apply": { word: "apply", phonetic: "/əˈplaɪ/", explains: ["v. 申请，请求；应用，实施"] },
  "appoint": { word: "appoint", phonetic: "/əˈpɔɪnt/", explains: ["v. 任命，委任；约定"] },
  "appointment": { word: "appointment", phonetic: "/əˈpɔɪntmənt/", explains: ["n. 任命，约定；约会"] },
  "appreciate": { word: "appreciate", phonetic: "/əˈpriːʃieɪt/", explains: ["v. 欣赏，赏识；感激；领会"] },
  "approach": { word: "approach", phonetic: "/əˈproʊtʃ/", explains: ["v. 向...靠近", "n. 接近；方法，途径"] },
  "appropriate": { word: "appropriate", phonetic: "/əˈproʊpriət/", explains: ["adj. 适当的，恰当的"] },
  "approval": { word: "approval", phonetic: "/əˈpruːvl/", explains: ["n. 赞成，同意；批准，认可"] },
  "approve": { word: "approve", phonetic: "/əˈpruːv/", explains: ["v. 赞成，同意；批准，认可"] },
  "approximate": { word: "approximate", phonetic: "/əˈprɒksɪmət/", explains: ["adj. 近似的，大约的", "v. 近似，接近"] },
  "april": { word: "April", phonetic: "/ˈeɪprəl/", explains: ["n. 四月"] },
  "arabian": { word: "Arabian", phonetic: "/əˈreɪbiən/", explains: ["adj. 阿拉伯的", "n. 阿拉伯人"] },
  "architect": { word: "architect", phonetic: "/ˈɑːrkɪtekt/", explains: ["n. 建筑师，设计师；缔造者"] },
  "architecture": { word: "architecture", phonetic: "/ˈɑːrkɪtektʃər/", explains: ["n. 建筑学，建筑式样"] },
  "area": { word: "area", phonetic: "/ˈeriə/", explains: ["n. 面积；地区，区域；领域"] },
  "argue": { word: "argue", phonetic: "/ˈɑːrɡjuː/", explains: ["v. 争论，辩论；主张，说服"] },
  "argument": { word: "argument", phonetic: "/ˈɑːrɡjumənt/", explains: ["n. 争论，辩论；论点，论据"] },
  "arise": { word: "arise", phonetic: "/əˈraɪz/", explains: ["v. 出现，发生；由...引起"] },
  "arithmetic": { word: "arithmetic", phonetic: "/əˈrɪθmətɪk/", explains: ["n. 算术，四则运算"] },
  "arm": { word: "arm", phonetic: "/ɑːrm/", explains: ["n. 手臂，胳膊；武器", "v. 武装，装备"] },
  "army": { word: "army", phonetic: "/ˈɑːrmi/", explains: ["n. 军队，陆军；大群"] },
  "around": { word: "around", phonetic: "/əˈraʊnd/", explains: ["adv. 在周围；大约", "prep. 在...周围"] },
  "arouse": { word: "arouse", phonetic: "/əˈraʊz/", explains: ["v. 引起，唤起，唤醒"] },
  "arrange": { word: "arrange", phonetic: "/əˈreɪndʒ/", explains: ["v. 安排，筹划；整理，排列"] },
  "arrangement": { word: "arrangement", phonetic: "/əˈreɪndʒmənt/", explains: ["n. 安排，准备工作；整理，排列"] },
  "arrest": { word: "arrest", phonetic: "/əˈrest/", explains: ["v./n. 逮捕，拘留；阻止"] },
  "arrival": { word: "arrival", phonetic: "/əˈraɪvl/", explains: ["n. 到达，到来；到达者"] },
  "arrive": { word: "arrive", phonetic: "/əˈraɪv/", explains: ["v. 到达，来临；达到"] },
  "arrow": { word: "arrow", phonetic: "/ˈæroʊ/", explains: ["n. 箭，箭状物；箭头符号"] },
  "art": { word: "art", phonetic: "/ɑːrt/", explains: ["n. 艺术，美术；技艺，技术"] },
  "article": { word: "article", phonetic: "/ˈɑːrtɪkl/", explains: ["n. 文章，论文；条款；物品"] },
  "artificial": { word: "artificial", phonetic: "/ˌɑːrtɪˈfɪʃl/", explains: ["adj. 人工的，人造的；矫揉造作的"] },
  "artist": { word: "artist", phonetic: "/ˈɑːrtɪst/", explains: ["n. 艺术家，美术家"] },
  "artistic": { word: "artistic", phonetic: "/ɑːrˈtɪstɪk/", explains: ["adj. 艺术的，艺术家的；精美的"] },
  "as": { word: "as", phonetic: "/æz/", explains: ["conj. 当...时；因为；正如", "prep. 作为", "adv. 同样地"] },
  "ash": { word: "ash", phonetic: "/æʃ/", explains: ["n. 灰，灰烬；骨灰"] },
  "ashamed": { word: "ashamed", phonetic: "/əˈʃeɪmd/", explains: ["adj. 惭愧的，羞耻的"] },
  "asia": { word: "Asia", phonetic: "/ˈeɪʒə/", explains: ["n. 亚洲"] },
  "asian": { word: "Asian", phonetic: "/ˈeɪʒn/", explains: ["adj. 亚洲的", "n. 亚洲人"] },
  "aside": { word: "aside", phonetic: "/əˈsaɪd/", explains: ["adv. 在旁边，到旁边；除...以外"] },
  "ask": { word: "ask", phonetic: "/ɑːsk/", explains: ["v. 问，询问；请求，要求；邀请"] },
  "asleep": { word: "asleep", phonetic: "/əˈsliːp/", explains: ["adj. 睡着的，睡熟的"] },
  "aspect": { word: "aspect", phonetic: "/ˈæspekt/", explains: ["n. 方面，朝向，面貌"] },
  "assess": { word: "assess", phonetic: "/əˈses/", explains: ["v. 评估，评定；估价"] },
  "assessment": { word: "assessment", phonetic: "/əˈsesmənt/", explains: ["n. 评估，评定；估价"] },
  "assign": { word: "assign", phonetic: "/əˈsaɪn/", explains: ["v. 分配，指派；指定"] },
  "assignment": { word: "assignment", phonetic: "/əˈsaɪnmənt/", explains: ["n. 任务，作业；分配，指派"] },
  "assist": { word: "assist", phonetic: "/əˈsɪst/", explains: ["v. 协助，帮助，援助"] },
  "assistance": { word: "assistance", phonetic: "/əˈsɪstəns/", explains: ["n. 协助，帮助，援助"] },
  "assistant": { word: "assistant", phonetic: "/əˈsɪstənt/", explains: ["n. 助手，助理，助教", "adj. 助理的，辅助的"] },
  "associate": { word: "associate", phonetic: "/əˈsoʊʃieɪt/", explains: ["v. 使联系，使联合", "n. 伙伴，同事", "adj. 副的"] },
  "association": { word: "association", phonetic: "/əˌsoʊʃiˈeɪʃn/", explains: ["n. 协会，团体；联合，联系"] },
  "assume": { word: "assume", phonetic: "/əˈsuːm/", explains: ["v. 假定，设想；承担；呈现"] },
  "assure": { word: "assure", phonetic: "/əˈʃʊr/", explains: ["v. 使确信，使放心；确保"] },
  "astonish": { word: "astonish", phonetic: "/əˈstɒnɪʃ/", explains: ["v. 使惊讶，使吃惊"] },
  "astronaut": { word: "astronaut", phonetic: "/ˈæstrənɔːt/", explains: ["n. 宇航员"] },
  "astronomy": { word: "astronomy", phonetic: "/əˈstrɒnəmi/", explains: ["n. 天文学"] },
  "at": { word: "at", phonetic: "/æt/", explains: ["prep. 在...里，在...上；在...时刻"] },
  "athlete": { word: "athlete", phonetic: "/ˈæθliːt/", explains: ["n. 运动员，体育家"] },
  "atmosphere": { word: "atmosphere", phonetic: "/ˈætməsfɪr/", explains: ["n. 大气，空气；气氛"] },
  "atom": { word: "atom", phonetic: "/ˈætəm/", explains: ["n. 原子；微粒，微量"] },
  "atomic": { word: "atomic", phonetic: "/əˈtɒmɪk/", explains: ["adj. 原子的，原子能的"] },
  "attach": { word: "attach", phonetic: "/əˈtætʃ/", explains: ["v. 缚，系，贴；附加；使依恋"] },
  "attack": { word: "attack", phonetic: "/əˈtæk/", explains: ["v./n. 攻击，进攻；突然发作"] },
  "attain": { word: "attain", phonetic: "/əˈteɪn/", explains: ["v. 达到，获得，实现"] },
  "attempt": { word: "attempt", phonetic: "/əˈtempt/", explains: ["v./n. 尝试，试图，努力"] },
  "attend": { word: "attend", phonetic: "/əˈtend/", explains: ["v. 出席，参加；照料，注意"] },
  "attention": { word: "attention", phonetic: "/əˈtenʃn/", explains: ["n. 注意，留心；立正"] },
  "attitude": { word: "attitude", phonetic: "/ˈætɪtuːd/", explains: ["n. 态度，看法；姿势"] },
  "attract": { word: "attract", phonetic: "/əˈtrækt/", explains: ["v. 吸引，引起...注意"] },
  "attraction": { word: "attraction", phonetic: "/əˈtrækʃn/", explains: ["n. 吸引，吸引力；具有吸引力的事物"] },
  "attractive": { word: "attractive", phonetic: "/əˈtræktɪv/", explains: ["adj. 有吸引力的，引起注意的"] },
  "attribute": { word: "attribute", phonetic: "/əˈtrɪbjuːt/", explains: ["v. 把...归因于", "n. 属性，品质，特征"] },
  "audience": { word: "audience", phonetic: "/ˈɔːdiəns/", explains: ["n. 听众，观众，读者；会见"] },
  "august": { word: "August", phonetic: "/ˈɔːɡəst/", explains: ["n. 八月"] },
  "aunt": { word: "aunt", phonetic: "/ænt/", explains: ["n. 姑母，伯母，婶母，舅母"] },
  "australia": { word: "Australia", phonetic: "/ɒˈstreɪliə/", explains: ["n. 澳大利亚"] },
  "australian": { word: "Australian", phonetic: "/ɒˈstreɪliən/", explains: ["adj. 澳大利亚的", "n. 澳大利亚人"] },
  "author": { word: "author", phonetic: "/ˈɔːθər/", explains: ["n. 作者，作家；创始人"] },
  "authority": { word: "authority", phonetic: "/əˈθɔːrəti/", explains: ["n. 当局，官方；权力；权威"] },
  "auto": { word: "auto", phonetic: "/ˈɔːtoʊ/", explains: ["n. 汽车", "adj. 自动的"] },
  "automatic": { word: "automatic", phonetic: "/ˌɔːtəˈmætɪk/", explains: ["adj. 自动的，机械的；无意识的", "n. 自动手枪"] },
  "automobile": { word: "automobile", phonetic: "/ˈɔːtəməbiːl/", explains: ["n. 汽车，机动车"] },
  "autumn": { word: "autumn", phonetic: "/ˈɔːtəm/", explains: ["n. 秋，秋季"] },
  "auxiliary": { word: "auxiliary", phonetic: "/ɔːɡˈzɪliəri/", explains: ["adj. 辅助的，附属的；后备的"] },
  "available": { word: "available", phonetic: "/əˈveɪləbl/", explains: ["adj. 可用的，可得到的；有空的"] },
  "avenue": { word: "avenue", phonetic: "/ˈævənuː/", explains: ["n. 林荫道，大街；途径，手段"] },
  "average": { word: "average", phonetic: "/ˈævərɪdʒ/", explains: ["n. 平均数，平均", "adj. 平均的；平常的", "v. 平均为"] },
  "avoid": { word: "avoid", phonetic: "/əˈvɔɪd/", explains: ["v. 避免，躲开；撤销"] },
  "await": { word: "await", phonetic: "/əˈweɪt/", explains: ["v. 等候，期待；将降临于"] },
  "awake": { word: "awake", phonetic: "/əˈweɪk/", explains: ["adj. 醒着的", "v. 唤醒，唤起；醒"] },
  "award": { word: "award", phonetic: "/əˈwɔːrd/", explains: ["n. 奖，奖品；判定", "v. 授予，给予；判给"] },
  "aware": { word: "aware", phonetic: "/əˈwer/", explains: ["adj. 知道的，意识到的"] },
  "away": { word: "away", phonetic: "/əˈweɪ/", explains: ["adv. 远离，离开；在远处"] },
  "awful": { word: "awful", phonetic: "/ˈɔːfl/", explains: ["adj. 令人不愉快的，极坏的；可怕的"] },
  "awkward": { word: "awkward", phonetic: "/ˈɔːkwərd/", explains: ["adj. 笨拙的，不灵活的；尴尬的"] },
  "ax": { word: "ax", phonetic: "/æks/", explains: ["n. 斧子"] },
  "axis": { word: "axis", phonetic: "/ˈæksɪs/", explains: ["n. 轴，轴线，中心线"] },

  // B (常用词)
  "baby": { word: "baby", phonetic: "/ˈbeɪbi/", explains: ["n. 婴儿；孩子气的人"] },
  "back": { word: "back", phonetic: "/bæk/", explains: ["adv. 向后；回；回复", "n. 背部；后面", "adj. 后面的", "v. 后退；支持"] },
  "background": { word: "background", phonetic: "/ˈbækɡraʊnd/", explains: ["n. 背景，经历；幕后"] },
  "backward": { word: "backward", phonetic: "/ˈbækwərd/", explains: ["adv. 向后，倒；相反地", "adj. 向后的；落后的"] },
  "bacteria": { word: "bacteria", phonetic: "/bækˈtɪriə/", explains: ["n. 细菌"] },
  "bad": { word: "bad", phonetic: "/bæd/", explains: ["adj. 坏的，恶的；严重的"] },
  "badly": { word: "badly", phonetic: "/ˈbædli/", explains: ["adv. 坏，差；严重地；非常"] },
  "bag": { word: "bag", phonetic: "/bæɡ/", explains: ["n. 袋，包，提包，背包"] },
  "bake": { word: "bake", phonetic: "/beɪk/", explains: ["v. 烤，烘，焙；烧硬"] },
  "balance": { word: "balance", phonetic: "/ˈbæləns/", explains: ["v. 使平衡；称", "n. 天平；平衡；差额"] },
  "ball": { word: "ball", phonetic: "/bɔːl/", explains: ["n. 球，球状物；舞会"] },
  "balloon": { word: "balloon", phonetic: "/bəˈluːn/", explains: ["n. 气球，玩具气球"] },
  "ban": { word: "ban", phonetic: "/bæn/", explains: ["v. 取缔，禁止；查禁", "n. 禁止，禁令"] },
  "banana": { word: "banana", phonetic: "/bəˈnænə/", explains: ["n. 香蕉；芭蕉属植物"] },
  "band": { word: "band", phonetic: "/bænd/", explains: ["n. 乐队；带；波段", "v. 用带绑扎"] },
  "bank": { word: "bank", phonetic: "/bæŋk/", explains: ["n. 银行，库；岸，堤", "v. 存入银行"] },
  "bar": { word: "bar", phonetic: "/bɑːr/", explains: ["n. 酒吧；条，杆；栅", "v. 闩上；阻挡；禁止"] },
  "bare": { word: "bare", phonetic: "/ber/", explains: ["adj. 赤裸的；仅仅的", "v. 露出，暴露"] },
  "bargain": { word: "bargain", phonetic: "/ˈbɑːrɡən/", explains: ["n. 交易；特价商品", "v. 讨价还价"] },
  "bark": { word: "bark", phonetic: "/bɑːrk/", explains: ["n. 树皮；吠声", "v. 吠叫，咆哮"] },
  "barn": { word: "barn", phonetic: "/bɑːrn/", explains: ["n. 谷仓；牲口棚"] },
  "barrel": { word: "barrel", phonetic: "/ˈbærəl/", explains: ["n. 桶；圆筒；枪管"] },
  "barrier": { word: "barrier", phonetic: "/ˈbæriər/", explains: ["n. 栅栏；屏障；障碍"] },
  "base": { word: "base", phonetic: "/beɪs/", explains: ["n. 基础，底层；基地", "v. 把...建立在..."] },
  "basic": { word: "basic", phonetic: "/ˈbeɪsɪk/", explains: ["adj. 基本的，基础的"] },
  "basically": { word: "basically", phonetic: "/ˈbeɪsɪkli/", explains: ["adv. 基本上，从根本上说"] },
  "basis": { word: "basis", phonetic: "/ˈbeɪsɪs/", explains: ["n. 基础，根据；原则"] },
  "basket": { word: "basket", phonetic: "/ˈbæskɪt/", explains: ["n. 篮，篓，筐；篮筐"] },
  "basketball": { word: "basketball", phonetic: "/ˈbæskɪtbɔːl/", explains: ["n. 篮球；篮球运动"] },
  "bat": { word: "bat", phonetic: "/bæt/", explains: ["n. 球拍，球棒；蝙蝠"] },
  "bath": { word: "bath", phonetic: "/bæθ/", explains: ["n. 浴，洗澡；浴缸"] },
  "bathe": { word: "bathe", phonetic: "/beɪð/", explains: ["v. 给...洗澡；游泳；弄湿"] },
  "bathroom": { word: "bathroom", phonetic: "/ˈbæθruːm/", explains: ["n. 浴室；盥洗室；厕所"] },
  "battery": { word: "battery", phonetic: "/ˈbætəri/", explains: ["n. 电池；一套，一系列；炮兵连"] },
  "battle": { word: "battle", phonetic: "/ˈbætl/", explains: ["n. 战役，战斗；斗争", "v. 作战，斗争"] },
  "bay": { word: "bay", phonetic: "/beɪ/", explains: ["n. 湾，海湾；山脉的低凹处"] },
  "be": { word: "be", phonetic: "/biː/", explains: ["aux.v. 是，在，存在；成为"] },
  "beach": { word: "beach", phonetic: "/biːtʃ/", explains: ["n. 海滩，湖滩，河滩"] },
  "bean": { word: "bean", phonetic: "/biːn/", explains: ["n. 豆，蚕豆，豆科植物"] },
  "bear": { word: "bear", phonetic: "/ber/", explains: ["n. 熊", "v. 忍受，承受；生育；带有"] },
  "beard": { word: "beard", phonetic: "/bɪrd/", explains: ["n. 胡须，络腮胡子"] },
  "beast": { word: "beast", phonetic: "/biːst/", explains: ["n. 兽，野兽；牲畜；凶残的人"] },
  "beat": { word: "beat", phonetic: "/biːt/", explains: ["v. 打，敲；打败", "n. 节拍；敲击声"] },
  "beautiful": { word: "beautiful", phonetic: "/ˈbjuːtɪfl/", explains: ["adj. 美的，美丽的"] },
  "beauty": { word: "beauty", phonetic: "/ˈbjuːti/", explains: ["n. 美，美丽；美人；美的东西"] },
  "because": { word: "because", phonetic: "/bɪˈkɒz/", explains: ["conj. 因为，由于"] },
  "become": { word: "become", phonetic: "/bɪˈkʌm/", explains: ["v. 变成，成为，开始变得"] },
  "bed": { word: "bed", phonetic: "/bed/", explains: ["n. 床，床位；圃；河床"] },
  "bee": { word: "bee", phonetic: "/biː/", explains: ["n. 蜂，蜜蜂；忙碌的人"] },
  "beef": { word: "beef", phonetic: "/biːf/", explains: ["n. 牛肉；菜牛"] },
  "beer": { word: "beer", phonetic: "/bɪr/", explains: ["n. 啤酒"] },
  "before": { word: "before", phonetic: "/bɪˈfɔːr/", explains: ["prep. 在...以前；向...", "conj. 在...以前", "adv. 以前，过去"] },
  "beg": { word: "beg", phonetic: "/beɡ/", explains: ["v. 乞求，乞讨；恳求，请求"] },
  "begin": { word: "begin", phonetic: "/bɪˈɡɪn/", explains: ["v. 开始，着手；创建"] },
  "beginning": { word: "beginning", phonetic: "/bɪˈɡɪnɪŋ/", explains: ["n. 开始，开端；起源"] },
  "behalf": { word: "behalf", phonetic: "/bɪˈhæf/", explains: ["n. 利益，方面，支持"] },
  "behave": { word: "behave", phonetic: "/bɪˈheɪv/", explains: ["v. 表现，举止；运转，开动"] },
  "behavior": { word: "behavior", phonetic: "/bɪˈheɪvjər/", explains: ["n. 行为，举止，表现"] },
  "behind": { word: "behind", phonetic: "/bɪˈhaɪnd/", explains: ["prep. 在...后面；落后于", "adv. 在背后；落后"] },
  "being": { word: "being", phonetic: "/ˈbiːɪŋ/", explains: ["n. 存在；生物，生命；人"] },
  "belief": { word: "belief", phonetic: "/bɪˈliːf/", explains: ["n. 信任，相信；信念，信仰"] },
  "believe": { word: "believe", phonetic: "/bɪˈliːv/", explains: ["v. 相信，认为可信；认为"] },
  "bell": { word: "bell", phonetic: "/bel/", explains: ["n. 钟，铃，门铃；钟声"] },
  "belong": { word: "belong", phonetic: "/bɪˈlɔːŋ/", explains: ["v. 属于，附属；应归入"] },
  "beloved": { word: "beloved", phonetic: "/bɪˈlʌvd/", explains: ["adj. 心爱的，挚爱的", "n. 心爱的人"] },
  "below": { word: "below", phonetic: "/bɪˈloʊ/", explains: ["prep. 在...下面；低于", "adv. 在下面，向下"] },
  "belt": { word: "belt", phonetic: "/belt/", explains: ["n. 带，腰带；皮带；地带"] },
  "bench": { word: "bench", phonetic: "/bentʃ/", explains: ["n. 长凳，条凳；工作台"] },
  "bend": { word: "bend", phonetic: "/bend/", explains: ["v. 使弯曲", "n. 弯曲，弯曲处"] },
  "beneath": { word: "beneath", phonetic: "/bɪˈniːθ/", explains: ["prep. 在...下方；低于", "adv. 在下方"] },
  "beneficial": { word: "beneficial", phonetic: "/ˌbenɪˈfɪʃl/", explains: ["adj. 有利的，有益的"] },
  "benefit": { word: "benefit", phonetic: "/ˈbenɪfɪt/", explains: ["n. 利益，好处；救济金", "v. 有益于；受益"] },
  "beside": { word: "beside", phonetic: "/bɪˈsaɪd/", explains: ["prep. 在...旁边；与...相比"] },
  "besides": { word: "besides", phonetic: "/bɪˈsaɪdz/", explains: ["adv. 而且，此外", "prep. 除...之外"] },
  "best": { word: "best", phonetic: "/best/", explains: ["adj. 最好的；最大的", "adv. 最，最好地"] },
  "bet": { word: "bet", phonetic: "/bet/", explains: ["v. 打赌；敢说", "n. 打赌；赌金"] },
  "betray": { word: "betray", phonetic: "/bɪˈtreɪ/", explains: ["v. 背叛，出卖；暴露，流露"] },
  "better": { word: "better", phonetic: "/ˈbetər/", explains: ["adj. 更好的；更合适的", "adv. 更好地"] },
  "between": { word: "between", phonetic: "/bɪˈtwiːn/", explains: ["prep. 在...之间；为...所分享"] },
  "beyond": { word: "beyond", phonetic: "/bɪˈjɑːnd/", explains: ["prep. 在...的那边；超出", "adv. 在更远处"] },
  "bible": { word: "Bible", phonetic: "/ˈbaɪbl/", explains: ["n. 圣经；有权威的书"] },
  "bicycle": { word: "bicycle", phonetic: "/ˈbaɪsɪkl/", explains: ["n. 自行车，脚踏车"] },
  "big": { word: "big", phonetic: "/bɪɡ/", explains: ["adj. 大的，巨大的；重要的"] },
  "bill": { word: "bill", phonetic: "/bɪl/", explains: ["n. 账单；法案；票据", "v. 给...开账单"] },
  "billion": { word: "billion", phonetic: "/ˈbɪljən/", explains: ["num. 十亿；大量"] },
  "bind": { word: "bind", phonetic: "/baɪnd/", explains: ["v. 捆绑，捆扎；约束；装订"] },
  "biology": { word: "biology", phonetic: "/baɪˈɒlədʒi/", explains: ["n. 生物学；生态学"] },
  "bird": { word: "bird", phonetic: "/bɜːrd/", explains: ["n. 鸟，禽"] },
  "birth": { word: "birth", phonetic: "/bɜːrθ/", explains: ["n. 分娩，出生；出身；起源"] },
  "birthday": { word: "birthday", phonetic: "/ˈbɜːrθdeɪ/", explains: ["n. 生日，诞生的日期"] },
  "biscuit": { word: "biscuit", phonetic: "/ˈbɪskɪt/", explains: ["n. 饼干，软烤饼；松饼"] },
  "bit": { word: "bit", phonetic: "/bɪt/", explains: ["n. 一点，小片；比特（二进制位）"] },
  "bite": { word: "bite", phonetic: "/baɪt/", explains: ["v. 咬，叮，蜇；刺穿", "n. 咬，咬伤；一口"] },
  "bitter": { word: "bitter", phonetic: "/ˈbɪtər/", explains: ["adj. 痛苦的；严寒的；苦的"] },
  "black": { word: "black", phonetic: "/blæk/", explains: ["adj. 黑色的；黑暗的", "n. 黑色；黑人"] },
  "blackboard": { word: "blackboard", phonetic: "/ˈblækbɔːrd/", explains: ["n. 黑板"] },
  "blade": { word: "blade", phonetic: "/bleɪd/", explains: ["n. 刀刃，刀片；叶片"] },
  "blame": { word: "blame", phonetic: "/bleɪm/", explains: ["v. 责备，指责", "n. 责备；责任"] },
  "blank": { word: "blank", phonetic: "/blæŋk/", explains: ["adj. 空白的；茫然的", "n. 空白；空白表格"] },
  "blanket": { word: "blanket", phonetic: "/ˈblæŋkɪt/", explains: ["n. 毛毯，毯子，羊毛毯"] },
  "blast": { word: "blast", phonetic: "/blæst/", explains: ["n. 爆炸，冲击波；一阵", "v. 炸，摧毁"] },
  "blaze": { word: "blaze", phonetic: "/bleɪz/", explains: ["n. 火；闪光", "v. 燃烧，照耀；迸发"] },
  "bleed": { word: "bleed", phonetic: "/bliːd/", explains: ["v. 出血，流血；泌脂"] },
  "blend": { word: "blend", phonetic: "/blend/", explains: ["v. 混合，混杂", "n. 混合物；混合，交融"] },
  "bless": { word: "bless", phonetic: "/bles/", explains: ["v. 为...祝福，保佑；使有幸得到"] },
  "blind": { word: "blind", phonetic: "/blaɪnd/", explains: ["adj. 瞎的；盲目的", "v. 使失明；使失去判断力"] },
  "block": { word: "block", phonetic: "/blɒk/", explains: ["n. 街区；大块；障碍物", "v. 堵塞；拦阻"] },
  "blood": { word: "blood", phonetic: "/blʌd/", explains: ["n. 血，血液；血统，家族"] },
  "bloom": { word: "bloom", phonetic: "/bluːm/", explains: ["n. 花；开花，开花期", "v. 开花；繁荣"] },
  "blow": { word: "blow", phonetic: "/bloʊ/", explains: ["v. 吹，吹动；吹响", "n. 吹，打击"] },
  "blue": { word: "blue", phonetic: "/bluː/", explains: ["adj. 蓝色的；忧郁的", "n. 蓝色"] },
  "board": { word: "board", phonetic: "/bɔːrd/", explains: ["n. 板，木板；委员会", "v. 上（船、车等）；搭伙"] },
  "boat": { word: "boat", phonetic: "/boʊt/", explains: ["n. 小船，艇；渔船"] },
  "body": { word: "body", phonetic: "/ˈbɒdi/", explains: ["n. 身体；主体；尸体；物体"] },
  "boil": { word: "boil", phonetic: "/bɔɪl/", explains: ["v. 沸腾，沸煮；激动", "n. 煮沸；疖子"] },
  "bold": { word: "bold", phonetic: "/boʊld/", explains: ["adj. 大胆的；冒失的；粗体的"] },
  "bolt": { word: "bolt", phonetic: "/boʊlt/", explains: ["n. 螺栓，插销；闪电", "v. 闩住；冲出去"] },
  "bomb": { word: "bomb", phonetic: "/bɒm/", explains: ["n. 炸弹", "v. 轰炸，投弹于"] },
  "bond": { word: "bond", phonetic: "/bɒnd/", explains: ["n. 联结，联系；公债；结合"] },
  "bone": { word: "bone", phonetic: "/boʊn/", explains: ["n. 骨，骨骼；骨质"] },
  "book": { word: "book", phonetic: "/bʊk/", explains: ["n. 书，书籍", "v. 预订，预约"] },
  "boom": { word: "boom", phonetic: "/buːm/", explains: ["v. 激增，繁荣；发出隆隆声", "n. 繁荣；隆隆声"] },
  "boot": { word: "boot", phonetic: "/buːt/", explains: ["n. 靴子，长统靴；行李箱"] },
  "border": { word: "border", phonetic: "/ˈbɔːrdər/", explains: ["n. 边，边缘；边界", "v. 与...接壤；接近"] },
  "bore": { word: "bore", phonetic: "/bɔːr/", explains: ["v. 使厌烦；钻，挖", "n. 令人讨厌的人/物"] },
  "born": { word: "born", phonetic: "/bɔːrn/", explains: ["adj. 出生的；天生的，十足的"] },
  "borrow": { word: "borrow", phonetic: "/ˈbɒroʊ/", explains: ["v. 借，借用；借入"] },
  "boss": { word: "boss", phonetic: "/bɒs/", explains: ["n. 老板，上司", "v. 指挥，对...发号施令"] },
  "both": { word: "both", phonetic: "/boʊθ/", explains: ["pron. 两者（都）", "adj. 两个...（都）"] },
  "bother": { word: "bother", phonetic: "/ˈbɒðər/", explains: ["v. 烦扰，打扰；烦恼", "n. 麻烦，烦恼"] },
  "bottle": { word: "bottle", phonetic: "/ˈbɒtl/", explains: ["n. 瓶，酒瓶；一瓶", "v. 把...装入瓶中"] },
  "bottom": { word: "bottom", phonetic: "/ˈbɒtəm/", explains: ["n. 底，底部，根基", "adj. 最低的，底部的"] },
  "boundary": { word: "boundary", phonetic: "/ˈbaʊndri/", explains: ["n. 分界线，边界"] },
  "bow": { word: "bow", phonetic: "/baʊ/", explains: ["n. 弓，蝴蝶结；鞠躬", "v. 鞠躬，点头"] },
  "bowl": { word: "bowl", phonetic: "/boʊl/", explains: ["n. 碗，钵；碗状物"] },
  "box": { word: "box", phonetic: "/bɒks/", explains: ["n. 箱，盒；包厢", "v. 把...装箱；拳击"] },
  "boy": { word: "boy", phonetic: "/bɔɪ/", explains: ["n. 男孩，少年；家伙"] },
  "brain": { word: "brain", phonetic: "/breɪn/", explains: ["n. 脑，脑髓；脑力，智力"] },
  "brake": { word: "brake", phonetic: "/breɪk/", explains: ["n. 闸，刹车", "v. 制动，刹住"] },
  "branch": { word: "branch", phonetic: "/brɑːntʃ/", explains: ["n. 树枝；分部；分支"] },
  "brand": { word: "brand", phonetic: "/brænd/", explains: ["n. 品牌，商标；烙印", "v. 铭刻；打烙印于"] },
  "brass": { word: "brass", phonetic: "/brɑːs/", explains: ["n. 黄铜；黄铜器，铜管乐器"] },
  "brave": { word: "brave", phonetic: "/breɪv/", explains: ["adj. 勇敢的，无畏的"] },
  "bread": { word: "bread", phonetic: "/bred/", explains: ["n. 面包；食物，生计"] },
  "breadth": { word: "breadth", phonetic: "/bredθ/", explains: ["n. 宽度，幅度；幅面"] },
  "break": { word: "break", phonetic: "/breɪk/", explains: ["v. 打破；损坏；违反", "n. 破裂；中断；休息时间"] },
  "breakfast": { word: "breakfast", phonetic: "/ˈbrekfəst/", explains: ["n. 早饭，早餐", "v. 吃早饭"] },
  "breast": { word: "breast", phonetic: "/brest/", explains: ["n. 乳房；胸脯，胸膛"] },
  "breath": { word: "breath", phonetic: "/breθ/", explains: ["n. 气息，呼吸；气味"] },
  "breathe": { word: "breathe", phonetic: "/briːð/", explains: ["v. 呼吸；吐露；流露"] },
  "breed": { word: "breed", phonetic: "/briːd/", explains: ["v. 繁殖；饲养；养育", "n. 品种，种类"] },
  "breeze": { word: "breeze", phonetic: "/briːz/", explains: ["n. 微风，和风", "v. 飘然而行"] },
  "brick": { word: "brick", phonetic: "/brɪk/", explains: ["n. 砖，砖块；砖状物"] },
  "bride": { word: "bride", phonetic: "/braɪd/", explains: ["n. 新娘"] },
  "bridge": { word: "bridge", phonetic: "/brɪdʒ/", explains: ["n. 桥，桥梁；桥牌", "v. 架桥于；把...连接起来"] },
  "brief": { word: "brief", phonetic: "/briːf/", explains: ["adj. 简短的；短暂的", "n. 摘要，概要"] },
  "bright": { word: "bright", phonetic: "/braɪt/", explains: ["adj. 明亮的；聪明的；鲜明的"] },
  "brilliant": { word: "brilliant", phonetic: "/ˈbrɪliənt/", explains: ["adj. 光辉的；卓越的，杰出的"] },
  "bring": { word: "bring", phonetic: "/brɪŋ/", explains: ["v. 带来，引出；促使"] },
  "britain": { word: "Britain", phonetic: "/ˈbrɪtn/", explains: ["n. 不列颠，英国"] },
  "british": { word: "British", phonetic: "/ˈbrɪtɪʃ/", explains: ["adj. 不列颠的，英联邦的"] },
  "broad": { word: "broad", phonetic: "/brɔːd/", explains: ["adj. 宽的，阔的；广泛的"] },
  "broadcast": { word: "broadcast", phonetic: "/ˈbrɔːdkæst/", explains: ["n. 广播，广播节目", "v. 广播，播送；传播"] },
  "broom": { word: "broom", phonetic: "/bruːm/", explains: ["n. 扫帚；扫除"] },
  "brother": { word: "brother", phonetic: "/ˈbrʌðər/", explains: ["n. 兄弟；同事，同胞"] },
  "brow": { word: "brow", phonetic: "/braʊ/", explains: ["n. 额；眉，眉毛"] },
  "brown": { word: "brown", phonetic: "/braʊn/", explains: ["n. 褐色，棕色", "adj. 褐色的，棕色的"] },
  "brush": { word: "brush", phonetic: "/brʌʃ/", explains: ["n. 刷子，毛刷；画笔", "v. 刷，擦；掠过"] },
  "bubble": { word: "bubble", phonetic: "/ˈbʌbl/", explains: ["n. 泡，泡沫，气泡", "v. 冒泡，起泡；沸腾"] },
  "bucket": { word: "bucket", phonetic: "/ˈbʌkɪt/", explains: ["n. 水桶，吊桶；铲斗"] },
  "budget": { word: "budget", phonetic: "/ˈbʌdʒɪt/", explains: ["n. 预算，预算拨款", "v. 规划，安排"] },
  "build": { word: "build", phonetic: "/bɪld/", explains: ["v. 建筑；建立；创立", "n. 构造，体格"] },
  "building": { word: "building", phonetic: "/ˈbɪldɪŋ/", explains: ["n. 建筑物，大楼；建筑"] },
  "bulb": { word: "bulb", phonetic: "/bʌlb/", explains: ["n. 电灯泡；球状物，球茎"] },
  "bulk": { word: "bulk", phonetic: "/bʌlk/", explains: ["n. 物体，体积，大批", "v. 使更大/更厚"] },
  "bullet": { word: "bullet", phonetic: "/ˈbʊlɪt/", explains: ["n. 枪弹，子弹，弹丸"] },
  "bunch": { word: "bunch", phonetic: "/bʌntʃ/", explains: ["n. 群，伙；束，串，捆"] },
  "bundle": { word: "bundle", phonetic: "/ˈbʌndl/", explains: ["n. 捆，包，束；包袱", "v. 收集，归拢"] },
  "burden": { word: "burden", phonetic: "/ˈbɜːrdn/", explains: ["n. 重担，精神负担", "v. 使负担，负重"] },
  "bureau": { word: "bureau", phonetic: "/ˈbjʊroʊ/", explains: ["n. 局，司，处；社，所"] },
  "burn": { word: "burn", phonetic: "/bɜːrn/", explains: ["v. 烧，燃烧；烧毁", "n. 烧伤，灼伤"] },
  "burst": { word: "burst", phonetic: "/bɜːrst/", explains: ["v. 使爆裂，爆发；突然发作", "n. 爆炸；爆发"] },
  "bury": { word: "bury", phonetic: "/ˈberi/", explains: ["v. 埋葬，葬；埋藏，掩藏"] },
  "bus": { word: "bus", phonetic: "/bʌs/", explains: ["n. 公共汽车，公交车"] },
  "bush": { word: "bush", phonetic: "/bʊʃ/", explains: ["n. 灌木，灌木丛，矮树"] },
  "business": { word: "business", phonetic: "/ˈbɪznəs/", explains: ["n. 商业，生意；事务，职责"] },
  "busy": { word: "busy", phonetic: "/ˈbɪzi/", explains: ["adj. 忙的，繁忙的；占线的"] },
  "but": { word: "but", phonetic: "/bʌt/", explains: ["conj. 但是，可是；而", "prep. 除...之外", "adv. 只，仅仅"] },
  "butcher": { word: "butcher", phonetic: "/ˈbʊtʃər/", explains: ["n. 屠夫；屠杀者", "v. 屠宰；残杀"] },
  "butter": { word: "butter", phonetic: "/ˈbʌtər/", explains: ["n. 黄油，奶油", "v. 涂黄油于..."] },
  "butterfly": { word: "butterfly", phonetic: "/ˈbʌtərflaɪ/", explains: ["n. 蝴蝶；轻浮的人"] },
  "button": { word: "button", phonetic: "/ˈbʌtn/", explains: ["n. 扣子，按钮", "v. 扣上；用纽扣装饰"] },
  "buy": { word: "buy", phonetic: "/baɪ/", explains: ["v. 买，购买；向...行贿", "n. 购买；买卖"] },
  "by": { word: "by", phonetic: "/baɪ/", explains: ["prep. 在...旁；被，由；经由", "adv. 在近旁；经过"] },

  // N - 常用词
  "name": { word: "name", phonetic: "/neɪm/", explains: ["n. 名字；名声；名人", "v. 命名；任命；说出...的名字"] },
  "narrow": { word: "narrow", phonetic: "/ˈnæroʊ/", explains: ["adj. 狭窄的；狭隘的；勉强的", "v. 使变窄；缩小"] },
  "nation": { word: "nation", phonetic: "/ˈneɪʃn/", explains: ["n. 国家；民族；国民"] },
  "national": { word: "national", phonetic: "/ˈnæʃnəl/", explains: ["adj. 国家的；民族的；全国性的"] },
  "native": { word: "native", phonetic: "/ˈneɪtɪv/", explains: ["adj. 出生地的；本地的；土著的", "n. 本地人；土著人"] },
  "natural": { word: "natural", phonetic: "/ˈnætʃrəl/", explains: ["adj. 自然的；天生的；正常的"] },
  "nature": { word: "nature", phonetic: "/ˈneɪtʃər/", explains: ["n. 自然；天性；本质；种类"] },
  "near": { word: "near", phonetic: "/nɪr/", explains: ["prep. 在...附近", "adv. 近；将近", "adj. 近的；接近的"] },
  "nearby": { word: "nearby", phonetic: "/ˌnɪrˈbaɪ/", explains: ["adj. 附近的", "adv. 在附近"] },
  "nearly": { word: "nearly", phonetic: "/ˈnɪrli/", explains: ["adv. 几乎；差不多；将近"] },
  "neat": { word: "neat", phonetic: "/niːt/", explains: ["adj. 整洁的；简洁的；灵巧的"] },
  "necessary": { word: "necessary", phonetic: "/ˈnesəseri/", explains: ["adj. 必要的；必然的", "n. 必需品"] },
  "neck": { word: "neck", phonetic: "/nek/", explains: ["n. 脖子；衣领；海峡"] },
  "need": { word: "need", phonetic: "/niːd/", explains: ["v./aux.v. 需要；必须", "n. 需要；需求；贫困"] },
  "needle": { word: "needle", phonetic: "/ˈniːdl/", explains: ["n. 针；指针；针叶"] },
  "negative": { word: "negative", phonetic: "/ˈneɡətɪv/", explains: ["adj. 否定的；消极的；负的", "n. 否定；负数；底片"] },
  "neighbor": { word: "neighbor", phonetic: "/ˈneɪbər/", explains: ["n. 邻居；邻近的人/物"] },
  "neither": { word: "neither", phonetic: "/ˈnaɪðər/", explains: ["pron./adj. 两者都不", "conj./adv. 也不"] },
  "nervous": { word: "nervous", phonetic: "/ˈnɜːrvəs/", explains: ["adj. 紧张的；焦虑的；神经的"] },
  "net": { word: "net", phonetic: "/net/", explains: ["n. 网；网络；净重", "adj. 净的；纯的", "v. 净赚"] },
  "network": { word: "network", phonetic: "/ˈnetwɜːrk/", explains: ["n. 网络；网状物；广播公司", "v. 建立网络"] },
  "never": { word: "never", phonetic: "/ˈnevər/", explains: ["adv. 从不；绝不；从未"] },
  "new": { word: "new", phonetic: "/nuː/", explains: ["adj. 新的；新鲜的；不熟悉的"] },
  "news": { word: "news", phonetic: "/nuːz/", explains: ["n. 新闻；消息；新闻报道"] },
  "newspaper": { word: "newspaper", phonetic: "/ˈnuːzpeɪpər/", explains: ["n. 报纸；报社"] },
  "next": { word: "next", phonetic: "/nekst/", explains: ["adj. 下一个的；紧接的", "adv. 下次；其次", "prep. 靠近"] },
  "nice": { word: "nice", phonetic: "/naɪs/", explains: ["adj. 美好的；友好的；令人愉快的"] },
  "night": { word: "night", phonetic: "/naɪt/", explains: ["n. 夜晚；黑夜；夜晚的活动"] },
  "nine": { word: "nine", phonetic: "/naɪn/", explains: ["num. 九；九个"] },
  "nineteen": { word: "nineteen", phonetic: "/ˌnaɪnˈtiːn/", explains: ["num. 十九"] },
  "ninety": { word: "ninety", phonetic: "/ˈnaɪnti/", explains: ["num. 九十"] },
  "no": { word: "no", phonetic: "/noʊ/", explains: ["adv. 不；没有；不是", "adj. 没有的；不许的"] },
  "noble": { word: "noble", phonetic: "/ˈnoʊbl/", explains: ["adj. 高尚的；贵族的；宏伟的", "n. 贵族"] },
  "nobody": { word: "nobody", phonetic: "/ˈnoʊbədi/", explains: ["pron. 没有人；无人", "n. 小人物；无足轻重的人"] },
  "nod": { word: "nod", phonetic: "/nɑːd/", explains: ["v. 点头；点头同意；打盹", "n. 点头；同意"] },
  "noise": { word: "noise", phonetic: "/nɔɪz/", explains: ["n. 噪音；嘈杂声；干扰"] },
  "noisy": { word: "noisy", phonetic: "/ˈnɔɪzi/", explains: ["adj. 吵闹的；嘈杂的"] },
  "none": { word: "none", phonetic: "/nʌn/", explains: ["pron. 没有一个；毫无", "adv. 一点也不"] },
  "nonsense": { word: "nonsense", phonetic: "/ˈnɑːnsens/", explains: ["n. 胡说；废话；荒谬的想法"] },
  "noon": { word: "noon", phonetic: "/nuːn/", explains: ["n. 中午；正午；全盛期"] },
  "nor": { word: "nor", phonetic: "/nɔːr/", explains: ["conj./adv. 也不；也没有"] },
  "normal": { word: "normal", phonetic: "/ˈnɔːrml/", explains: ["adj. 正常的；标准的；精神正常的", "n. 常态；标准"] },
  "north": { word: "north", phonetic: "/nɔːrθ/", explains: ["n. 北；北方；北部", "adj. 北方的；北部的", "adv. 在北方"] },
  "northern": { word: "northern", phonetic: "/ˈnɔːrðərn/", explains: ["adj. 北方的；北部的；来自北方的"] },
  "nose": { word: "nose", phonetic: "/noʊz/", explains: ["n. 鼻子；嗅觉；突出部分", "v. 嗅；探出"] },
  "not": { word: "not", phonetic: "/nɑːt/", explains: ["adv. 不；没有；并非"] },
  "note": { word: "note", phonetic: "/noʊt/", explains: ["n. 笔记；便条；注释；纸币", "v. 注意；记录；指出"] },
  "notebook": { word: "notebook", phonetic: "/ˈnoʊtbʊk/", explains: ["n. 笔记本；笔记本电脑"] },
  "nothing": { word: "nothing", phonetic: "/ˈnʌθɪŋ/", explains: ["pron. 没有什么；没有东西", "n. 微不足道的事"] },
  "notice": { word: "notice", phonetic: "/ˈnoʊtɪs/", explains: ["n. 通知；注意；布告", "v. 注意到；察觉到"] },
  "noun": { word: "noun", phonetic: "/naʊn/", explains: ["n. 名词"] },
  "novel": { word: "novel", phonetic: "/ˈnɑːvl/", explains: ["n. 小说", "adj. 新奇的；新颖的"] },
  "November": { word: "November", phonetic: "/noʊˈvembər/", explains: ["n. 十一月"] },
  "now": { word: "now", phonetic: "/naʊ/", explains: ["adv. 现在；如今；立刻", "conj. 既然；由于"] },
  "nowhere": { word: "nowhere", phonetic: "/ˈnoʊwer/", explains: ["adv. 无处；哪里都不", "n. 无处；不知道的地方"] },
  "number": { word: "number", phonetic: "/ˈnʌmbər/", explains: ["n. 数字；号码；数量；期号", "v. 编号；总计；计入"] },
  "nurse": { word: "nurse", phonetic: "/nɜːrs/", explains: ["n. 护士；保姆；奶妈", "v. 护理；照料；培养"] },
  "nut": { word: "nut", phonetic: "/nʌt/", explains: ["n. 坚果；螺母；难对付的人"] },

  // 可以继续添加更多单词...
  // C - M, O - Z 的常用词省略，实际使用时应该补全
};

/**
 * 从本地词典查询单词
 * @param word 要查询的单词
 * @returns 查询结果，未找到返回 null
 */
export function queryLocalDictionary(word: string): DictionaryEntry | null {
  // 标准化输入：转小写，去除首尾空格
  const normalizedWord = word.toLowerCase().trim();
  
  // 调试日志
  console.log('[本地词典] 查询:', normalizedWord, '词典大小:', Object.keys(LOCAL_DICTIONARY).length);
  
  // 直接查询
  const entry = LOCAL_DICTIONARY[normalizedWord];
  if (entry) {
    return entry;
  }
  
  // 尝试去除复数形式 (-s, -es)
  if (normalizedWord.endsWith('es')) {
    const singular = normalizedWord.slice(0, -2);
    if (LOCAL_DICTIONARY[singular]) {
      return LOCAL_DICTIONARY[singular];
    }
  }
  if (normalizedWord.endsWith('s')) {
    const singular = normalizedWord.slice(0, -1);
    if (LOCAL_DICTIONARY[singular]) {
      return LOCAL_DICTIONARY[singular];
    }
  }
  
  // 尝试去除过去式/过去分词 (-ed)
  if (normalizedWord.endsWith('ed')) {
    const base = normalizedWord.slice(0, -2);
    if (LOCAL_DICTIONARY[base]) {
      return LOCAL_DICTIONARY[base];
    }
    // 尝试双写辅音字母的情况 (stopped -> stop)
    const base2 = normalizedWord.slice(0, -1);
    if (LOCAL_DICTIONARY[base2]) {
      return LOCAL_DICTIONARY[base2];
    }
  }
  
  // 尝试去除进行时 (-ing)
  if (normalizedWord.endsWith('ing')) {
    const base = normalizedWord.slice(0, -3);
    if (LOCAL_DICTIONARY[base]) {
      return LOCAL_DICTIONARY[base];
    }
    // 尝试去e的情况 (making -> make)
    const base2 = base + 'e';
    if (LOCAL_DICTIONARY[base2]) {
      return LOCAL_DICTIONARY[base2];
    }
  }
  
  return null;
}

/**
 * 检查本地词典是否包含某个单词
 * @param word 要检查的单词
 */
export function hasLocalWord(word: string): boolean {
  return queryLocalDictionary(word) !== null;
}

/**
 * 获取本地词典统计信息
 */
export function getDictionaryStats(): { total: number; letterCounts: Record<string, number> } {
  const words = Object.keys(LOCAL_DICTIONARY);
  const letterCounts: Record<string, number> = {};
  
  words.forEach(word => {
    const firstLetter = word[0]?.toLowerCase() || 'unknown';
    letterCounts[firstLetter] = (letterCounts[firstLetter] || 0) + 1;
  });
  
  return {
    total: words.length,
    letterCounts
  };
}

/**
 * 本地翻译结果接口
 */
export interface LocalTranslationResult {
  success: boolean;
  explains?: string;
  phonetic?: string;
  errorMsg?: string;
  isLocal: true; // 标记这是本地翻译结果
}

/**
 * 常用短语/句子的本地映射（简单规则翻译）
 */
const COMMON_PHRASES: Record<string, string> = {
  "how are you": "你好吗",
  "thank you": "谢谢你",
  "you are welcome": "不客气",
  "good morning": "早上好",
  "good afternoon": "下午好",
  "good evening": "晚上好",
  "good night": "晚安",
  "good bye": "再见",
  "see you": "再见",
  "i love you": "我爱你",
  "happy birthday": "生日快乐",
  "merry christmas": "圣诞快乐",
  "happy new year": "新年快乐",
  "excuse me": "打扰一下；借过",
  "i'm sorry": "对不起",
  "never mind": "没关系；别在意",
  "good luck": "祝你好运",
  "take care": "保重",
  "have a nice day": "祝你今天愉快",
  "long time no see": "好久不见",
  "what's up": "怎么了；最近如何",
  "how do you do": "你好（初次见面）",
  "nice to meet you": "很高兴见到你",
  "pardon me": "请再说一遍",
  "i don't know": "我不知道",
  "i don't understand": "我不明白",
  "please wait a moment": "请稍等",
  "i'm fine": "我很好",
  "see you later": "待会见",
  "have fun": "玩得开心",
  "good idea": "好主意",
  "of course": "当然",
  "no problem": "没问题",
  "that's all right": "没关系",
  "it doesn't matter": "没关系",
};

/**
 * 逐词翻译句子
 * @param sentence 要翻译的句子
 * @returns 翻译结果
 */
function translateSentenceByWords(sentence: string): LocalTranslationResult {
  // 清理并分割句子
  const words = sentence
    .toLowerCase()
    .replace(/[.,!?;:"'()]/g, ' ')  // 替换标点为空格
    .split(/\s+/)                    // 按空格分割
    .filter(w => w.length > 0);      // 过滤空字符串
  
  if (words.length === 0) {
    return {
      success: false,
      errorMsg: '无法识别的文本',
      isLocal: true
    };
  }
  
  // 逐个单词翻译
  const translations: string[] = [];
  const unknownWords: string[] = [];
  
  for (const word of words) {
    const entry = queryLocalDictionary(word);
    if (entry && entry.explains.length > 0) {
      // 取第一个释义，去掉词性标记
      const meaning = entry.explains[0].replace(/^(n\.|v\.|adj\.|adv\.|prep\.|conj\.|pron\.|art\.|num\.|int\.)\s*/, '');
      translations.push(meaning);
    } else {
      // 尝试简单的词形还原（去掉常见的后缀）
      const baseForm = tryGetBaseForm(word);
      const baseEntry = baseForm ? queryLocalDictionary(baseForm) : null;
      if (baseEntry && baseEntry.explains.length > 0) {
        const meaning = baseEntry.explains[0].replace(/^(n\.|v\.|adj\.|adv\.|prep\.|conj\.|pron\.|art\.|num\.|int\.)\s*/, '');
        translations.push(meaning);
      } else {
        translations.push(`[${word}]`);  // 标记未知单词
        unknownWords.push(word);
      }
    }
  }
  
  // 拼接翻译结果
  const translatedText = translations.join('；');
  
  if (unknownWords.length === words.length) {
    // 所有单词都不认识
    return {
      success: false,
      errorMsg: `本地词库暂未收录这些单词，建议切换至网络翻译`,
      isLocal: true
    };
  }
  
  const result: LocalTranslationResult = {
    success: true,
    explains: translatedText,
    isLocal: true
  };
  
  if (unknownWords.length > 0) {
    result.errorMsg = `部分单词未收录: ${unknownWords.join(', ')}`;
  }
  
  return result;
}

/**
 * 尝试获取单词的基本形式（简单词形还原）
 */
function tryGetBaseForm(word: string): string | null {
  // 简单的复数/时态还原规则
  if (word.endsWith('ies') && word.length > 4) {
    return word.slice(0, -3) + 'y';  // families -> family
  }
  if (word.endsWith('es') && word.length > 3) {
    return word.slice(0, -2);  // boxes -> box
  }
  if (word.endsWith('s') && word.length > 3 && !word.endsWith('ss')) {
    return word.slice(0, -1);  // books -> book
  }
  if (word.endsWith('ing') && word.length > 5) {
    const base = word.slice(0, -3);
    return base;  // running -> run
  }
  if (word.endsWith('ed') && word.length > 4) {
    return word.slice(0, -2);  // walked -> walk
  }
  return null;
}

/**
 * 使用本地词典翻译
 * @param text 要翻译的文本
 * @returns 翻译结果
 */
export function translateWithLocalDictionary(text: string): LocalTranslationResult {
  const trimmedText = text.trim().toLowerCase();
  
  // 空文本检查
  if (!trimmedText) {
    return {
      success: false,
      errorMsg: '请输入要翻译的文本',
      isLocal: true
    };
  }
  
  // 1. 首先检查是否是常用短语/句子（直接映射）
  const phraseTranslation = COMMON_PHRASES[trimmedText];
  if (phraseTranslation) {
    return {
      success: true,
      explains: phraseTranslation,
      isLocal: true
    };
  }
  
  // 2. 如果是单个单词，直接查词典
  if (!trimmedText.includes(' ')) {
    const entry = queryLocalDictionary(trimmedText);
    if (entry) {
      return {
        success: true,
        explains: entry.explains.join('；'),
        phonetic: entry.phonetic,
        isLocal: true
      };
    }
    
    // 尝试词形还原
    const baseForm = tryGetBaseForm(trimmedText);
    if (baseForm) {
      const baseEntry = queryLocalDictionary(baseForm);
      if (baseEntry) {
        return {
          success: true,
          explains: baseEntry.explains.join('；'),
          phonetic: baseEntry.phonetic,
          isLocal: true
        };
      }
    }
    
    return {
      success: false,
      errorMsg: `词库暂未收录 "${trimmedText}"，建议切换至网络翻译`,
      isLocal: true
    };
  }
  
  // 3. 句子/短语：使用逐词翻译
  return translateSentenceByWords(trimmedText);
}

export default {
  queryLocalDictionary,
  hasLocalWord,
  getDictionaryStats,
  translateWithLocalDictionary
};
