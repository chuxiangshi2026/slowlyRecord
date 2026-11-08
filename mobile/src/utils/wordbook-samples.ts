/**
 * 内置示例词集（生成产物，勿手改；重新生成：node scripts/gen-wordbook-samples.cjs）
 *
 * 四本示例：词根册、词缀册、拼写组合册与场景名词。
 * 页面 note 记录词根来源与派生链，词条 note 记录单个词的构词关系。
 * 首次进入词集时播种，用户删除或编辑归入「我的词集」后不再自动恢复。
 */

export interface WordBookSampleWord {
  entryId: string
  text: string
  explains: string
  phonetic?: string
  freq?: number
  note?: string
  examples?: { english: string; chinese: string }[]
  memoryTip?: string
}

export interface WordBookSamplePage {
  keyType: 'letters' | 'root' | 'prefix' | 'suffix' | 'phonetic' | 'text'
  keyValue: string
  keyDescription?: string
  note?: string
  words: WordBookSampleWord[]
}

export interface WordBookSampleChapter {
  name: string
  pages: WordBookSamplePage[]
}

export interface WordBookSampleBook {
  name: string
  desc: string
  chapters: WordBookSampleChapter[]
}

export const WORDBOOK_SAMPLES: WordBookSampleBook[] = [
  {
    "name": "词根册",
    "desc": "先高频核心词根（act/form/port），再进阶词根；派生越多的排越前",
    "chapters": [
      {
        "name": "核心词根",
        "pages": [
          {
            "keyType": "root",
            "keyValue": "act",
            "keyDescription": "做、驱动、行动：act 行动，react 反应",
            "note": "拉丁 agere/actus（做、驱动）。act 行动，action 行动，active 活跃的，activity 活动，actor 演员；re- + act → react 反应。inter- + act → interact（见词缀册 interact 派生页）。",
            "words": [
              {
                "text": "act",
                "explains": "v. 行动；见效；n. 行为",
                "phonetic": "/ækt/",
                "freq": 722,
                "note": "拉丁 agere（做、驱动）→ 行动",
                "examples": [
                  {
                    "english": "She acted quickly to help the child.",
                    "chinese": "她迅速行动去帮助那个孩子。"
                  }
                ],
                "memoryTip": "act = 做；actor 是做戏的人。",
                "entryId": "sample_roots_core_roots_act_act"
              },
              {
                "text": "action",
                "explains": "n. 行动；作用；功能",
                "phonetic": "/'ækʃ(ə)n/",
                "freq": 1175,
                "note": "act + -ion（名词后缀）→ 行动/作用",
                "examples": [
                  {
                    "english": "We need action, not just words.",
                    "chinese": "我们需要行动，而不只是空话。"
                  }
                ],
                "memoryTip": "act + -ion → 做出来的事。",
                "entryId": "sample_roots_core_roots_act_action"
              },
              {
                "text": "exact",
                "explains": "adj. 确切的；精确的",
                "phonetic": "/ɪg'zækt; eg-/",
                "freq": 2402,
                "note": "ex-（出）+ act（做）→ 做得精确的",
                "examples": [
                  {
                    "english": "Can you tell me the exact time?",
                    "chinese": "你能告诉我确切的时间吗？"
                  }
                ],
                "memoryTip": "ex-（出）+ act（做）→ 做到点子上。",
                "entryId": "sample_roots_core_roots_act_exact"
              },
              {
                "text": "actor",
                "explains": "n. 演剧的人",
                "phonetic": "/'æktə/",
                "freq": 2499,
                "note": "act + -or（人）→ 演员",
                "examples": [
                  {
                    "english": "He is a famous actor.",
                    "chinese": "他是一位著名演员。"
                  }
                ],
                "memoryTip": "act + -or（人）→ 演戏的人。",
                "entryId": "sample_roots_core_roots_act_actor"
              },
              {
                "text": "actual",
                "explains": "adj. 实际的",
                "phonetic": "/'æktʃʊəl; -tjʊəl/",
                "freq": 2637,
                "note": "act + -ual → 实际发生的",
                "examples": [
                  {
                    "english": "The actual cost was higher.",
                    "chinese": "实际费用更高。"
                  }
                ],
                "memoryTip": "act + -ual → 实际发生的。",
                "entryId": "sample_roots_core_roots_act_actual"
              },
              {
                "text": "reaction",
                "explains": "n. 反应；反作用力",
                "phonetic": "/rɪ'ækʃ(ə)n/",
                "freq": 2934,
                "note": "react + -ion（名词后缀）→ 反应",
                "examples": [
                  {
                    "english": "Her reaction surprised everyone.",
                    "chinese": "她的反应让所有人吃惊。"
                  }
                ],
                "memoryTip": "re-（回）+ act + -ion。",
                "entryId": "sample_roots_core_roots_act_reaction"
              },
              {
                "text": "activity",
                "explains": "n. 活动；活力；行动",
                "phonetic": "/æk'tɪvɪtɪ/",
                "freq": 3377,
                "note": "active + -ity（名词后缀）→ 活动",
                "examples": [
                  {
                    "english": "The school offers many activities.",
                    "chinese": "学校提供许多活动。"
                  }
                ],
                "memoryTip": "active + -ity → 活动。",
                "entryId": "sample_roots_core_roots_act_activity"
              },
              {
                "text": "active",
                "explains": "adj. 活跃的；积极的",
                "phonetic": "/'æktɪv/",
                "freq": 3752,
                "note": "act + -ive（形容词后缀）→ 活跃的",
                "examples": [
                  {
                    "english": "She stays active every day.",
                    "chinese": "她每天都很活跃。"
                  }
                ],
                "memoryTip": "act + -ive → 活跃的。",
                "entryId": "sample_roots_core_roots_act_active"
              },
              {
                "text": "react",
                "explains": "v. 作出反应；有影响",
                "phonetic": "/rɪ'ækt/",
                "freq": 4710,
                "note": "re-（回）+ act（做）→ 反应",
                "examples": [
                  {
                    "english": "How did he react to the news?",
                    "chinese": "他对这个消息有什么反应？"
                  }
                ],
                "memoryTip": "re-（回）+ act → 反应。",
                "entryId": "sample_roots_core_roots_act_react"
              }
            ]
          },
          {
            "keyType": "root",
            "keyValue": "form",
            "keyDescription": "形状：transform 改变形状",
            "note": "拉丁 forma（形状）。inform 给头脑定形→通知，perform 彻底成型→表演/执行，transform 改变形状，uniform 同一形状→制服/统一的。",
            "words": [
              {
                "text": "form",
                "explains": "n. 形式；形状；v. 形成",
                "phonetic": "/fɔːm/",
                "freq": 1260,
                "note": "form（形状）→ 形式/形成",
                "examples": [
                  {
                    "english": "Please fill in this form.",
                    "chinese": "请填写这张表格。"
                  }
                ],
                "memoryTip": "form = 形状/形式。",
                "entryId": "sample_roots_core_roots_form_form"
              },
              {
                "text": "information",
                "explains": "n. 消息，信息；通知",
                "phonetic": "/ɪnfə'meɪʃ(ə)n/",
                "freq": 778,
                "note": "inform + -ation（名词后缀）→ 信息",
                "examples": [
                  {
                    "english": "I need more information.",
                    "chinese": "我需要更多信息。"
                  }
                ],
                "memoryTip": "in + form：把内容放进头脑形成形状。",
                "entryId": "sample_roots_core_roots_form_information"
              },
              {
                "text": "perform",
                "explains": "v. 演出；履行，执行",
                "phonetic": "/pə'fɔːm/",
                "freq": 2733,
                "note": "per-（彻底）+ form（形状）→ 彻底成型→表演/执行",
                "examples": [
                  {
                    "english": "They will perform on stage tonight.",
                    "chinese": "他们今晚将在台上表演。"
                  }
                ],
                "memoryTip": "per-（彻底）+ form → 完全做出来。",
                "entryId": "sample_roots_core_roots_form_perform"
              },
              {
                "text": "inform",
                "explains": "v. 通知，向…报告",
                "phonetic": "/ɪn'fɔːm/",
                "freq": 3128,
                "note": "in-（向内）+ form（形状）→ 给头脑定形→通知",
                "examples": [
                  {
                    "english": "Please inform me of any changes.",
                    "chinese": "如有变化请通知我。"
                  }
                ],
                "memoryTip": "in + form → 给头脑定形。",
                "entryId": "sample_roots_core_roots_form_inform"
              },
              {
                "text": "formal",
                "explains": "adj. 正式的；礼仪上的",
                "phonetic": "/'fɔːm(ə)l/",
                "freq": 5047,
                "note": "form（形状）+ -al → 正式的",
                "examples": [
                  {
                    "english": "This is a formal meeting.",
                    "chinese": "这是一次正式会议。"
                  }
                ],
                "memoryTip": "form + -al → 正式的。",
                "entryId": "sample_roots_core_roots_form_formal"
              },
              {
                "text": "reform",
                "explains": "v. 改革，改良；n. 改革，改良",
                "phonetic": "/rɪ'fɔːm/",
                "freq": 7492,
                "note": "re-（重新）+ form（形状）→ 重新塑形→改革",
                "examples": [
                  {
                    "english": "The government plans to reform the system.",
                    "chinese": "政府计划改革这个制度。"
                  }
                ],
                "memoryTip": "re-（重新）+ form → 重新塑形。",
                "entryId": "sample_roots_core_roots_form_reform"
              },
              {
                "text": "transform",
                "explains": "v. 改变；改造；变换",
                "phonetic": "/træns'fɔːm; trɑːns-; -nz-/",
                "freq": 7936,
                "note": "trans-（改变）+ form（形状）→ 变形",
                "examples": [
                  {
                    "english": "The city has transformed in ten years.",
                    "chinese": "这座城市十年间变了样。"
                  }
                ],
                "memoryTip": "trans-（改变）+ form → 变形。",
                "entryId": "sample_roots_core_roots_form_transform"
              }
            ]
          },
          {
            "keyType": "root",
            "keyValue": "port",
            "keyDescription": "拿、运、带：import 运进来，export 运出去",
            "note": "拉丁 portare（搬运）。import 运进来，export 运出去，transport 横跨搬运；再加 -able 成 portable（可携带的）、-er 成 porter（搬运工）、-ation 成 transportation（运输）。",
            "words": [
              {
                "text": "report",
                "explains": "v. 报告；汇报",
                "phonetic": "/rɪ'pɔːt/",
                "freq": 727,
                "note": "re-（回）+ port（带）→ 把消息带回来",
                "examples": [
                  {
                    "english": "She gave a short report on the project.",
                    "chinese": "她就这个项目做了简短汇报。"
                  }
                ],
                "memoryTip": "re-（回）+ port（带）→ 把消息带回来。",
                "entryId": "sample_roots_core_roots_port_report"
              },
              {
                "text": "support",
                "explains": "v. 经受，承受",
                "phonetic": "/sə'pɔːt/",
                "freq": 1083,
                "note": "sup-（从下往上）+ port（托）→ 支持",
                "examples": [
                  {
                    "english": "My parents always support me.",
                    "chinese": "父母一直支持我。"
                  }
                ],
                "memoryTip": "sup（下）+ port（托）→ 从下面托住。",
                "entryId": "sample_roots_core_roots_port_support"
              },
              {
                "text": "reporter",
                "explains": "n. 记者，通讯员",
                "phonetic": "/rɪ'pɔːtə/",
                "freq": 2467,
                "note": "report + -er（人）→ 记者",
                "examples": [
                  {
                    "english": "The reporter asked several questions.",
                    "chinese": "记者问了几个问题。"
                  }
                ],
                "memoryTip": "report + -er。",
                "entryId": "sample_roots_core_roots_port_reporter"
              },
              {
                "text": "transport",
                "explains": "v. 运输；n. 运输",
                "phonetic": "/træn'spɔːt; trɑːn-/",
                "freq": 3644,
                "note": "trans-（横跨）+ port（搬运）→ 运输",
                "examples": [
                  {
                    "english": "We transport goods by train.",
                    "chinese": "我们用火车运输货物。"
                  }
                ],
                "memoryTip": "trans-（横跨）+ port。",
                "entryId": "sample_roots_core_roots_port_transport"
              },
              {
                "text": "porter",
                "explains": "n. 搬运工人",
                "phonetic": "/'pɔːtə/",
                "freq": 5238,
                "note": "port + -er（人）→ 搬运工",
                "examples": [
                  {
                    "english": "The porter carried our bags.",
                    "chinese": "搬运工帮我们搬行李。"
                  }
                ],
                "memoryTip": "port + -er（人）。",
                "entryId": "sample_roots_core_roots_port_porter"
              },
              {
                "text": "transportation",
                "explains": "n. 运输，运送，客运",
                "phonetic": "/trænspɔː'teɪʃ(ə)n; trɑːns-/",
                "freq": 7798,
                "note": "transport + -ation（名词后缀）→ 运输",
                "examples": [
                  {
                    "english": "Public transportation is convenient here.",
                    "chinese": "这里的公共交通很方便。"
                  }
                ],
                "memoryTip": "transport + -ation。",
                "entryId": "sample_roots_core_roots_port_transportation"
              },
              {
                "text": "portable",
                "explains": "adj. 轻便的；手提的",
                "phonetic": "/'pɔːtəb(ə)l/",
                "freq": 11485,
                "note": "port + -able（可…的）→ 可携带的",
                "examples": [
                  {
                    "english": "This speaker is small and portable.",
                    "chinese": "这个音箱小巧便携。"
                  }
                ],
                "memoryTip": "port + -able。",
                "entryId": "sample_roots_core_roots_port_portable"
              },
              {
                "text": "import",
                "explains": "n. 输入，进口；v. 输入，进口",
                "freq": 12676,
                "note": "im-（向内）+ port（搬运）→ 运进来",
                "examples": [
                  {
                    "english": "The country imports oil.",
                    "chinese": "这个国家进口石油。"
                  }
                ],
                "memoryTip": "im-（向内）+ port。",
                "entryId": "sample_roots_core_roots_port_import"
              },
              {
                "text": "export",
                "explains": "v. 出口；输出",
                "phonetic": "/ˈekspɔːt；ɪkˈ-/",
                "freq": 14152,
                "note": "ex-（向外）+ port（搬运）→ 运出去",
                "examples": [
                  {
                    "english": "They export tea to Europe.",
                    "chinese": "他们向欧洲出口茶叶。"
                  }
                ],
                "memoryTip": "ex-（向外）+ port。",
                "entryId": "sample_roots_core_roots_port_export"
              }
            ]
          },
          {
            "keyType": "root",
            "keyValue": "pos",
            "keyDescription": "放、置：compose 放到一起",
            "note": "拉丁 ponere/positus（放）。position 放的位置，compose 放到一起→组成，expose 放出去→暴露，deposit 放下→存款/沉淀。",
            "words": [
              {
                "text": "position",
                "explains": "n. 姿势；位置；职位",
                "phonetic": "/pə'zɪʃ(ə)n/",
                "freq": 992,
                "note": "posit（放）+ -ion → 放的位置",
                "examples": [
                  {
                    "english": "Please put the chair in position.",
                    "chinese": "请把椅子放到位置上。"
                  }
                ],
                "memoryTip": "posit（放）+ -ion。",
                "entryId": "sample_roots_core_roots_pos_position"
              },
              {
                "text": "propose",
                "explains": "v. 提议；求婚",
                "phonetic": "/prə'pəʊz/",
                "freq": 3830,
                "note": "pro-（向前）+ pos（放）→ 放到前面→提议",
                "examples": [
                  {
                    "english": "I propose a short break.",
                    "chinese": "我提议短暂休息。"
                  }
                ],
                "memoryTip": "pro-（向前）+ pos。",
                "entryId": "sample_roots_core_roots_pos_propose"
              },
              {
                "text": "deposit",
                "explains": "v. 使沉淀；存放",
                "phonetic": "/dɪ'pɒzɪt/",
                "freq": 4625,
                "note": "de-（向下）+ pos（放）→ 放下→存款/沉淀",
                "examples": [
                  {
                    "english": "You need to pay a deposit.",
                    "chinese": "你需要付押金。"
                  }
                ],
                "memoryTip": "de-（向下）+ pos → 放下。",
                "entryId": "sample_roots_core_roots_pos_deposit"
              },
              {
                "text": "expose",
                "explains": "v. 使暴露；揭露",
                "phonetic": "/ɪk'spəʊz; ek-/",
                "freq": 5465,
                "note": "ex-（出）+ pos（放）→ 放出去→暴露",
                "examples": [
                  {
                    "english": "Do not expose your skin to the sun.",
                    "chinese": "不要让皮肤暴露在阳光下。"
                  }
                ],
                "memoryTip": "ex-（出）+ pos。",
                "entryId": "sample_roots_core_roots_pos_expose"
              },
              {
                "text": "oppose",
                "explains": "v. 反对；反抗",
                "phonetic": "/ə'pəʊz/",
                "freq": 9853,
                "note": "op-（对着）+ pos（放）→ 放在对面→反对",
                "examples": [
                  {
                    "english": "Many people oppose the plan.",
                    "chinese": "许多人反对这个计划。"
                  }
                ],
                "memoryTip": "op-（对着）+ pos。",
                "entryId": "sample_roots_core_roots_pos_oppose"
              },
              {
                "text": "dispose",
                "explains": "v. 去掉，丢掉；销毁",
                "phonetic": "/dɪ'spəʊz/",
                "freq": 10091,
                "note": "dis-（分开）+ pos（放）→ 分开摆放→处理/丢弃",
                "examples": [
                  {
                    "english": "Please dispose of the waste properly.",
                    "chinese": "请妥善处理垃圾。"
                  }
                ],
                "memoryTip": "dis-（分开）+ pos。",
                "entryId": "sample_roots_core_roots_pos_dispose"
              },
              {
                "text": "compose",
                "explains": "v. 创作；组成，构成",
                "phonetic": "/kəm'pəʊz/",
                "freq": 15771,
                "note": "com-（共同）+ pos（放）→ 放到一起→组成",
                "examples": [
                  {
                    "english": "She composed a beautiful song.",
                    "chinese": "她创作了一首优美的歌。"
                  }
                ],
                "memoryTip": "com-（一起）+ pos。",
                "entryId": "sample_roots_core_roots_pos_compose"
              }
            ]
          },
          {
            "keyType": "root",
            "keyValue": "gen",
            "keyDescription": "出生、产生：generate 产生",
            "note": "拉丁 genus/generare（出生、产生）。generate 产生，generation 一代，genius 与生俱来的天赋，generous 出身好→慷慨的。",
            "words": [
              {
                "text": "general",
                "explains": "adj. 总的；一般的；n. 将军",
                "phonetic": "/'dʒen(ə)r(ə)l/",
                "freq": 735,
                "note": "gen（种类）+ -al → 一般的/普遍的",
                "examples": [
                  {
                    "english": "The general idea is clear.",
                    "chinese": "总体思路是清楚的。"
                  }
                ],
                "memoryTip": "gen（种类）+ -al。",
                "entryId": "sample_roots_core_roots_gen_general"
              },
              {
                "text": "genius",
                "explains": "n. 天才，天赋，天资",
                "phonetic": "/'dʒiːnɪəs/",
                "freq": 1932,
                "note": "gen（出生）+ -ius → 与生俱来的天赋",
                "examples": [
                  {
                    "english": "She has a genius for math.",
                    "chinese": "她有数学天赋。"
                  }
                ],
                "memoryTip": "gen（出生）+ -ius → 与生俱来。",
                "entryId": "sample_roots_core_roots_gen_genius"
              },
              {
                "text": "generation",
                "explains": "n. 一代，一代人；产生",
                "phonetic": "/dʒenə'reɪʃ(ə)n/",
                "freq": 3059,
                "note": "generate + -ion → 一代",
                "examples": [
                  {
                    "english": "This generation grew up with the internet.",
                    "chinese": "这一代人伴随互联网长大。"
                  }
                ],
                "memoryTip": "generate + -ion。",
                "entryId": "sample_roots_core_roots_gen_generation"
              },
              {
                "text": "generous",
                "explains": "adj. 慷慨的；宽厚的",
                "phonetic": "/'dʒen(ə)rəs/",
                "freq": 3161,
                "note": "gen（出身）+ -ous → 出身好→慷慨的",
                "examples": [
                  {
                    "english": "He is generous with his time.",
                    "chinese": "他很慷慨地付出时间。"
                  }
                ],
                "memoryTip": "gen（出身）+ -ous → 出身好。",
                "entryId": "sample_roots_core_roots_gen_generous"
              },
              {
                "text": "gene",
                "explains": "n. [遗] 基因，遗传因子",
                "phonetic": "/dʒiːn/",
                "freq": 3562,
                "note": "gen（产生）+ -e → 基因",
                "examples": [
                  {
                    "english": "Genes carry information.",
                    "chinese": "基因携带信息。"
                  }
                ],
                "memoryTip": "gen（产生）+ -e。",
                "entryId": "sample_roots_core_roots_gen_gene"
              },
              {
                "text": "generate",
                "explains": "v. 发生；引起",
                "phonetic": "/'dʒenəreɪt/",
                "freq": 10355,
                "note": "gen（产生）+ -erate → 产生",
                "examples": [
                  {
                    "english": "Wind can generate electricity.",
                    "chinese": "风可以发电。"
                  }
                ],
                "memoryTip": "gen = 产生。",
                "entryId": "sample_roots_core_roots_gen_generate"
              }
            ]
          },
          {
            "keyType": "root",
            "keyValue": "fer",
            "keyDescription": "带、拿：transfer 转带，offer 带来",
            "note": "拉丁 ferre（带、拿）。transfer 转移，prefer 更看重→更喜欢，offer 带来→提供，conference 带到一起→会议，differ 分开带→不同。",
            "words": [
              {
                "text": "offer",
                "explains": "v. 提供；提出；n. 提供",
                "phonetic": "/'ɒfə/",
                "freq": 909,
                "note": "of-（向前）+ fer（带）→ 带到面前→提供",
                "examples": [
                  {
                    "english": "They offered me a job.",
                    "chinese": "他们给了我一份工作。"
                  }
                ],
                "memoryTip": "of-（向前）+ fer（带）。",
                "entryId": "sample_roots_core_roots_fer_offer"
              },
              {
                "text": "prefer",
                "explains": "v. 更喜欢",
                "phonetic": "/prɪ'fɜː/",
                "freq": 1641,
                "note": "pre-（在前）+ fer（带）→ 更看重→更喜欢",
                "examples": [
                  {
                    "english": "I prefer tea to coffee.",
                    "chinese": "比起咖啡我更喜欢茶。"
                  }
                ],
                "memoryTip": "pre-（在前）+ fer。",
                "entryId": "sample_roots_core_roots_fer_prefer"
              },
              {
                "text": "suffer",
                "explains": "v. 遭受；忍受；经历；n. (Suffer)人名；(意)苏费尔",
                "phonetic": "/'sʌfə/",
                "freq": 2102,
                "note": "suf-（在下）+ fer（承受）→ 在下面承受→受苦",
                "examples": [
                  {
                    "english": "He suffered from a bad cold.",
                    "chinese": "他患了重感冒。"
                  }
                ],
                "memoryTip": "suf-（下）+ fer（承受）。",
                "entryId": "sample_roots_core_roots_fer_suffer"
              },
              {
                "text": "conference",
                "explains": "n. 会议，讨论会",
                "phonetic": "/'kɒnf(ə)r(ə)ns/",
                "freq": 2580,
                "note": "con-（共同）+ fer（带）+ -ence → 带到一起→会议",
                "examples": [
                  {
                    "english": "She spoke at the conference.",
                    "chinese": "她在会议上发言。"
                  }
                ],
                "memoryTip": "con-（一起）+ fer + -ence。",
                "entryId": "sample_roots_core_roots_fer_conference"
              },
              {
                "text": "transfer",
                "explains": "v. 转移；调动",
                "phonetic": "/træns'fɜː; trɑːns-; -nz-/",
                "freq": 2816,
                "note": "trans-（横跨）+ fer（带）→ 转移",
                "examples": [
                  {
                    "english": "Please transfer the money today.",
                    "chinese": "请今天转账。"
                  }
                ],
                "memoryTip": "trans-（转移）+ fer。",
                "entryId": "sample_roots_core_roots_fer_transfer"
              },
              {
                "text": "refer",
                "explains": "v. 谈到",
                "phonetic": "/rɪ'fɜː/",
                "freq": 6756,
                "note": "re-（回）+ fer（带）→ 带回去→提及/参考",
                "examples": [
                  {
                    "english": "Please refer to the guide.",
                    "chinese": "请参考指南。"
                  }
                ],
                "memoryTip": "re-（回）+ fer。",
                "entryId": "sample_roots_core_roots_fer_refer"
              },
              {
                "text": "differ",
                "explains": "v. 不同，相异",
                "phonetic": "/'dɪfə/",
                "freq": 12573,
                "note": "dif-（分开）+ fer（带）→ 分开带→不同",
                "examples": [
                  {
                    "english": "Opinions differ on this issue.",
                    "chinese": "在这个问题上意见不同。"
                  }
                ],
                "memoryTip": "dif-（分开）+ fer。",
                "entryId": "sample_roots_core_roots_fer_differ"
              }
            ]
          },
          {
            "keyType": "root",
            "keyValue": "vis",
            "keyDescription": "看：visible 看得见，revise 再看一遍",
            "note": "拉丁 videre（看）。vision 视力/愿景，visible 可见的，visit 去看，revise 再看一遍→修订；invisible 是“看不见的”。",
            "words": [
              {
                "text": "visit",
                "explains": "v. 拜访",
                "phonetic": "/'vɪzɪt/",
                "freq": 979,
                "note": "vis（看）+ -it → 去看",
                "examples": [
                  {
                    "english": "We will visit the museum.",
                    "chinese": "我们将参观博物馆。"
                  }
                ],
                "memoryTip": "vis + -it → 去看。",
                "entryId": "sample_roots_core_roots_vis_visit"
              },
              {
                "text": "vision",
                "explains": "n. 视力；想象力；梦幻",
                "phonetic": "/'vɪʒ(ə)n/",
                "freq": 2466,
                "note": "vis（看）+ -ion → 视力/愿景",
                "examples": [
                  {
                    "english": "He has good vision.",
                    "chinese": "他视力很好。"
                  }
                ],
                "memoryTip": "vis（看）+ -ion。",
                "entryId": "sample_roots_core_roots_vis_vision"
              },
              {
                "text": "invisible",
                "explains": "adj. 看不见的；无形的",
                "phonetic": "/ɪn'vɪzɪb(ə)l/",
                "freq": 3765,
                "note": "in-（不）+ vis（看）+ -ible → 看不见的",
                "examples": [
                  {
                    "english": "Air is invisible.",
                    "chinese": "空气是看不见的。"
                  }
                ],
                "memoryTip": "in-（不）+ visible。",
                "entryId": "sample_roots_core_roots_vis_invisible"
              },
              {
                "text": "advise",
                "explains": "v. 劝告；建议；通知",
                "phonetic": "/əd'vaɪz/",
                "freq": 4630,
                "note": "ad-（向）+ vis（看）→ 提出看法→建议",
                "examples": [
                  {
                    "english": "I advise you to rest.",
                    "chinese": "我建议你休息。"
                  }
                ],
                "memoryTip": "ad-（向）+ vis（看）→ 提出看法。",
                "entryId": "sample_roots_core_roots_vis_advise"
              },
              {
                "text": "visual",
                "explains": "adj. 视觉的，视力的",
                "phonetic": "/'vɪʒjʊəl; -zj-/",
                "freq": 4777,
                "note": "vis（看）+ -ual → 视觉的",
                "examples": [
                  {
                    "english": "The film has strong visual effects.",
                    "chinese": "这部电影视觉效果很强。"
                  }
                ],
                "memoryTip": "vis + -ual。",
                "entryId": "sample_roots_core_roots_vis_visual"
              },
              {
                "text": "visible",
                "explains": "adj. 可见的，看得见的",
                "phonetic": "/ˈvɪzəbl/",
                "freq": 6414,
                "note": "vis（看）+ -ible（可…的）→ 可见的",
                "examples": [
                  {
                    "english": "The mountains are visible today.",
                    "chinese": "今天能看到群山。"
                  }
                ],
                "memoryTip": "vis + -ible。",
                "entryId": "sample_roots_core_roots_vis_visible"
              },
              {
                "text": "revise",
                "explains": "v. 修订，校订；修改",
                "phonetic": "/rɪ'vaɪz/",
                "freq": 20960,
                "note": "re-（再）+ vis（看）→ 再看一遍→修订",
                "examples": [
                  {
                    "english": "Please revise your essay.",
                    "chinese": "请修改你的文章。"
                  }
                ],
                "memoryTip": "re-（再）+ vis（看）。",
                "entryId": "sample_roots_core_roots_vis_revise"
              }
            ]
          },
          {
            "keyType": "root",
            "keyValue": "spect",
            "keyDescription": "看：inspect 往里看，respect 反复看",
            "note": "拉丁 specere（看）。inspect 往里看，respect 反复看→尊敬，prospect 向前看→前景，perspective 看问题的角度；spectator 是“看的人”。",
            "words": [
              {
                "text": "respect",
                "explains": "n. 尊敬，尊重；方面；敬意；v. 尊敬，尊重；遵守",
                "phonetic": "/rɪ'spekt/",
                "freq": 949,
                "note": "re-（反复）+ spect（看）→ 反复看→尊敬",
                "examples": [
                  {
                    "english": "We should respect each other.",
                    "chinese": "我们应该互相尊重。"
                  }
                ],
                "memoryTip": "re-（反复）+ spect。",
                "entryId": "sample_roots_core_roots_spect_respect"
              },
              {
                "text": "perspective",
                "explains": "n. 透视；远景；观点",
                "phonetic": "/pə'spektɪv/",
                "freq": 4959,
                "note": "per-（穿过）+ spect（看）→ 看问题的角度",
                "examples": [
                  {
                    "english": "Try to see it from her perspective.",
                    "chinese": "试着从她的角度看。"
                  }
                ],
                "memoryTip": "per-（穿过）+ spect。",
                "entryId": "sample_roots_core_roots_spect_perspective"
              },
              {
                "text": "inspection",
                "explains": "n. 检阅；检查，审查",
                "phonetic": "/ɪn'spekʃn/",
                "freq": 6718,
                "note": "inspect + -ion（名词后缀）→ 检查",
                "examples": [
                  {
                    "english": "The factory passed the inspection.",
                    "chinese": "工厂通过了检查。"
                  }
                ],
                "memoryTip": "inspect + -ion。",
                "entryId": "sample_roots_core_roots_spect_inspection"
              },
              {
                "text": "prospect",
                "explains": "n. 展望；前景，前程",
                "phonetic": "/'prɒspekt/",
                "freq": 10041,
                "note": "pro-（向前）+ spect（看）→ 前景",
                "examples": [
                  {
                    "english": "The job has good prospects.",
                    "chinese": "这份工作前景不错。"
                  }
                ],
                "memoryTip": "pro-（向前）+ spect。",
                "entryId": "sample_roots_core_roots_spect_prospect"
              },
              {
                "text": "inspect",
                "explains": "v. 检查，审查；检阅",
                "phonetic": "/ɪn'spekt/",
                "freq": 11219,
                "note": "in-（向内）+ spect（看）→ 往里检查",
                "examples": [
                  {
                    "english": "The teacher inspected our homework.",
                    "chinese": "老师检查了我们的作业。"
                  }
                ],
                "memoryTip": "in-（向内）+ spect（看）。",
                "entryId": "sample_roots_core_roots_spect_inspect"
              },
              {
                "text": "spectator",
                "explains": "n. 参观者，观众",
                "phonetic": "/spek'teɪtə/",
                "freq": 20077,
                "note": "spect + -ator（人）→ 观看者",
                "examples": [
                  {
                    "english": "The spectators cheered loudly.",
                    "chinese": "观众大声欢呼。"
                  }
                ],
                "memoryTip": "spect + -ator（人）。",
                "entryId": "sample_roots_core_roots_spect_spectator"
              }
            ]
          },
          {
            "keyType": "root",
            "keyValue": "dict",
            "keyDescription": "说：predict 预先说，contradict 反着说",
            "note": "拉丁 dicere（说）。predict 预先说→预测，contradict 反着说→反驳，dictate 口述；dictionary 是“词语的集合”。",
            "words": [
              {
                "text": "predict",
                "explains": "v. 预言，预告，预测",
                "phonetic": "/prɪ'dɪkt/",
                "freq": 7098,
                "note": "pre-（预先）+ dict（说）→ 预言",
                "examples": [
                  {
                    "english": "It is hard to predict the future.",
                    "chinese": "很难预测未来。"
                  }
                ],
                "memoryTip": "pre-（预先）+ dict（说）。",
                "entryId": "sample_roots_core_roots_dict_predict"
              },
              {
                "text": "dictionary",
                "explains": "n. 词典，字典",
                "phonetic": "/'dɪkʃ(ə)n(ə)rɪ/",
                "freq": 9848,
                "note": "dict（说）+ -ion + -ary → 词语的集合",
                "examples": [
                  {
                    "english": "Look it up in the dictionary.",
                    "chinese": "在词典里查一下。"
                  }
                ],
                "memoryTip": "dict（说）+ -ion + -ary。",
                "entryId": "sample_roots_core_roots_dict_dictionary"
              },
              {
                "text": "dictate",
                "explains": "v. 口授；命令",
                "phonetic": "/dɪk'teɪt/",
                "freq": 12609,
                "note": "dict（说）+ -ate → 口述/命令",
                "examples": [
                  {
                    "english": "The teacher dictated a sentence.",
                    "chinese": "老师口述了一个句子。"
                  }
                ],
                "memoryTip": "dict + -ate。",
                "entryId": "sample_roots_core_roots_dict_dictate"
              },
              {
                "text": "contradiction",
                "explains": "n. 矛盾，不一致；否认",
                "phonetic": "/kɒntrə'dɪkʃ(ə)n/",
                "freq": 17457,
                "note": "contradict + -ion（名词后缀）→ 矛盾/反驳",
                "examples": [
                  {
                    "english": "There is a contradiction in his story.",
                    "chinese": "他的说法有矛盾。"
                  }
                ],
                "memoryTip": "contra-（相反）+ dict + -ion。",
                "entryId": "sample_roots_core_roots_dict_contradiction"
              },
              {
                "text": "dictation",
                "explains": "n. 口授笔录；听写",
                "phonetic": "/dɪk'teɪʃ(ə)n/",
                "freq": 24994,
                "note": "dictate + -ion（名词后缀）→ 听写",
                "examples": [
                  {
                    "english": "We have a dictation every Friday.",
                    "chinese": "我们每周五听写。"
                  }
                ],
                "memoryTip": "dictate + -ion。",
                "entryId": "sample_roots_core_roots_dict_dictation"
              }
            ]
          },
          {
            "keyType": "root",
            "keyValue": "ject",
            "keyDescription": "投、扔：reject 扔回去，project 往前投",
            "note": "拉丁 iacere（投、扔）。project 向前投→项目/投射，reject 扔回去→拒绝，inject 投入→注射，subject 置于其下→主题/臣民。",
            "words": [
              {
                "text": "project",
                "explains": "n. 方案，工程；v. 伸出",
                "phonetic": "/prəˈdʒekt; ˈprɒdʒekt/",
                "freq": 1541,
                "note": "pro-（向前）+ ject（投）→ 向前投→项目/投射",
                "examples": [
                  {
                    "english": "We finished the project on time.",
                    "chinese": "我们按时完成了项目。"
                  }
                ],
                "memoryTip": "pro-（向前）+ ject（投）。",
                "entryId": "sample_roots_core_roots_ject_project"
              },
              {
                "text": "subject",
                "explains": "v. 使隶属",
                "phonetic": "/ˈsʌbdʒɪkt/",
                "freq": 1884,
                "note": "sub-（在下）+ ject（投）→ 置于其下→主题/臣民",
                "examples": [
                  {
                    "english": "Math is my favorite subject.",
                    "chinese": "数学是我最喜欢的科目。"
                  }
                ],
                "memoryTip": "sub-（在下）+ ject。",
                "entryId": "sample_roots_core_roots_ject_subject"
              },
              {
                "text": "object",
                "explains": "n. 物，物体；目的",
                "phonetic": "/'ɒbdʒɪkt; -dʒekt/",
                "freq": 2571,
                "note": "ob-（对着）+ ject（投）→ 对着投→物体/反对",
                "examples": [
                  {
                    "english": "He objected to the plan.",
                    "chinese": "他反对这个计划。"
                  }
                ],
                "memoryTip": "ob-（对着）+ ject。",
                "entryId": "sample_roots_core_roots_ject_object"
              },
              {
                "text": "objection",
                "explains": "n. 反对，异议；不喜欢",
                "phonetic": "/əb'dʒekʃ(ə)n/",
                "freq": 3787,
                "note": "object + -ion（名词后缀）→ 反对",
                "examples": [
                  {
                    "english": "He raised an objection.",
                    "chinese": "他提出了反对。"
                  }
                ],
                "memoryTip": "object + -ion。",
                "entryId": "sample_roots_core_roots_ject_objection"
              },
              {
                "text": "reject",
                "explains": "v. 拒绝；驳回；丢掉",
                "phonetic": "/rɪ'dʒekt/",
                "freq": 7071,
                "note": "re-（回）+ ject（投）→ 扔回去→拒绝",
                "examples": [
                  {
                    "english": "She rejected his offer.",
                    "chinese": "她拒绝了他的提议。"
                  }
                ],
                "memoryTip": "re-（回）+ ject。",
                "entryId": "sample_roots_core_roots_ject_reject"
              },
              {
                "text": "inject",
                "explains": "v. 注射；注满；喷射",
                "phonetic": "/ɪn'dʒekt/",
                "freq": 11542,
                "note": "in-（向内）+ ject（投）→ 投入→注射",
                "examples": [
                  {
                    "english": "The nurse injected the medicine.",
                    "chinese": "护士注射了药物。"
                  }
                ],
                "memoryTip": "in-（向内）+ ject。",
                "entryId": "sample_roots_core_roots_ject_inject"
              },
              {
                "text": "eject",
                "explains": "v. 逐出，排斥；喷射",
                "phonetic": "/ɪ'dʒekt/",
                "freq": 20097,
                "note": "e-（出）+ ject（投）→ 投出去→弹出",
                "examples": [
                  {
                    "english": "The machine ejected the card.",
                    "chinese": "机器把卡弹了出来。"
                  }
                ],
                "memoryTip": "e-（出）+ ject。",
                "entryId": "sample_roots_core_roots_ject_eject"
              }
            ]
          }
        ]
      },
      {
        "name": "进阶词根",
        "pages": [
          {
            "keyType": "root",
            "keyValue": "mit",
            "keyDescription": "送、派：admit 送进去，transmit 传送",
            "note": "拉丁 mittere（送、派）。admit 送进去→准许进入，submit 呈交，transmit 传送，permit 放行→允许；committee 是被派去办事的人。",
            "words": [
              {
                "text": "admit",
                "explains": "v. 承认；准许…进入",
                "phonetic": "/əd'mɪt/",
                "freq": 1229,
                "note": "ad-（向）+ mit（送）→ 送进去→准许进入",
                "examples": [
                  {
                    "english": "He admitted his mistake.",
                    "chinese": "他承认了错误。"
                  }
                ],
                "memoryTip": "ad-（向）+ mit（送）。",
                "entryId": "sample_roots_advanced_roots_mit_admit"
              },
              {
                "text": "commit",
                "explains": "v. 犯（错误）；干（坏事）",
                "phonetic": "/kə'mɪt/",
                "freq": 2659,
                "note": "com-（共同）+ mit（送）→ 交付/承诺",
                "examples": [
                  {
                    "english": "She committed herself to the project.",
                    "chinese": "她全身心投入这个项目。"
                  }
                ],
                "memoryTip": "com-（共同）+ mit（送）→ 交付自己。",
                "entryId": "sample_roots_advanced_roots_mit_commit"
              },
              {
                "text": "committee",
                "explains": "n. 委员会；全体委员",
                "phonetic": "/kə'mɪtɪ/",
                "freq": 2745,
                "note": "com-（共同）+ mit（派）+ -ee（被…的人）→ 被派去办事的人",
                "examples": [
                  {
                    "english": "The committee will meet on Monday.",
                    "chinese": "委员会将在周一开会。"
                  }
                ],
                "memoryTip": "被派去办事的一群人。",
                "entryId": "sample_roots_advanced_roots_mit_committee"
              },
              {
                "text": "permit",
                "explains": "v. 允许；n. 执照",
                "phonetic": "/pə'mɪt/",
                "freq": 4296,
                "note": "per-（通过）+ mit（送）→ 放行→允许",
                "examples": [
                  {
                    "english": "Smoking is not permitted here.",
                    "chinese": "这里不允许吸烟。"
                  }
                ],
                "memoryTip": "per-（通过）+ mit（送）→ 放行。",
                "entryId": "sample_roots_advanced_roots_mit_permit"
              },
              {
                "text": "submit",
                "explains": "v. 服从",
                "phonetic": "/səb'mɪt/",
                "freq": 6534,
                "note": "sub-（在下）+ mit（送）→ 呈交",
                "examples": [
                  {
                    "english": "Please submit your report by Friday.",
                    "chinese": "请在周五前提交报告。"
                  }
                ],
                "memoryTip": "sub-（在下）+ mit（送）→ 呈交。",
                "entryId": "sample_roots_advanced_roots_mit_submit"
              },
              {
                "text": "transmit",
                "explains": "v. 传送，传达；发射",
                "phonetic": "/trænz'mɪt; trɑːnz-; -ns-/",
                "freq": 12164,
                "note": "trans-（横跨）+ mit（送）→ 传送",
                "examples": [
                  {
                    "english": "The station transmits signals all day.",
                    "chinese": "电台全天传送信号。"
                  }
                ],
                "memoryTip": "trans-（横跨）+ mit。",
                "entryId": "sample_roots_advanced_roots_mit_transmit"
              }
            ]
          },
          {
            "keyType": "root",
            "keyValue": "miss",
            "keyDescription": "送、派：mission 使命，dismiss 送走",
            "note": "miss 与 mit 同源（送）。mission 被派出的任务，dismiss 送走→解散，permission 放行→许可，missile 被投掷的东西→导弹。",
            "words": [
              {
                "text": "mission",
                "explains": "n. 使命，任务；使团",
                "phonetic": "/'mɪʃ(ə)n/",
                "freq": 1164,
                "note": "miss（送）+ -ion → 被派出的任务",
                "examples": [
                  {
                    "english": "Their mission is to help others.",
                    "chinese": "他们的使命是帮助他人。"
                  }
                ],
                "memoryTip": "miss（送）+ -ion。",
                "entryId": "sample_roots_advanced_roots_miss_mission"
              },
              {
                "text": "permission",
                "explains": "n. 允许，许可，同意",
                "phonetic": "/pə'mɪʃ(ə)n/",
                "freq": 1871,
                "note": "per-（通过）+ miss（送）+ -ion → 许可",
                "examples": [
                  {
                    "english": "You need permission to enter.",
                    "chinese": "你需要许可才能进入。"
                  }
                ],
                "memoryTip": "permit 的名词形式。",
                "entryId": "sample_roots_advanced_roots_miss_permission"
              },
              {
                "text": "missile",
                "explains": "n. 导弹；发射物",
                "phonetic": "/'mɪsaɪl/",
                "freq": 5284,
                "note": "miss（送）+ -ile（物）→ 被投掷的东西→导弹",
                "examples": [
                  {
                    "english": "The missile hit the target.",
                    "chinese": "导弹击中了目标。"
                  }
                ],
                "memoryTip": "miss（送）+ -ile（物）→ 被投出去的东西。",
                "entryId": "sample_roots_advanced_roots_miss_missile"
              },
              {
                "text": "transmission",
                "explains": "n. 传送；传动；发射",
                "phonetic": "/trænz'mɪʃ(ə)n; trɑːnz-; -ns-/",
                "freq": 5937,
                "note": "trans-（横跨）+ miss（送）+ -ion → 传送",
                "examples": [
                  {
                    "english": "The transmission was interrupted.",
                    "chinese": "信号传输中断了。"
                  }
                ],
                "memoryTip": "transmit + -ion。",
                "entryId": "sample_roots_advanced_roots_miss_transmission"
              },
              {
                "text": "dismiss",
                "explains": "v. 不再考虑；解雇",
                "phonetic": "/dɪs'mɪs/",
                "freq": 8131,
                "note": "dis-（离开）+ miss（送）→ 送走→解散",
                "examples": [
                  {
                    "english": "The teacher dismissed the class early.",
                    "chinese": "老师提前下课了。"
                  }
                ],
                "memoryTip": "dis-（离开）+ miss（送）→ 送走。",
                "entryId": "sample_roots_advanced_roots_miss_dismiss"
              },
              {
                "text": "admission",
                "explains": "n. 承认；允许进入",
                "phonetic": "/əd'mɪʃ(ə)n/",
                "freq": 8667,
                "note": "ad-（向）+ miss（送）+ -ion → 准许进入",
                "examples": [
                  {
                    "english": "Admission is free on Sundays.",
                    "chinese": "周日免费入场。"
                  }
                ],
                "memoryTip": "ad-（向）+ miss（送）+ -ion。",
                "entryId": "sample_roots_advanced_roots_miss_admission"
              }
            ]
          },
          {
            "keyType": "root",
            "keyValue": "duct",
            "keyDescription": "引导：conduct 引导，product 生产出来",
            "note": "拉丁 ducere（引导）。produce 引出→生产，introduce 引进→介绍，conduct 引导→指挥/实施，reduce 引回→减少。",
            "words": [
              {
                "text": "production",
                "explains": "n. 生产；总产量",
                "phonetic": "/prə'dʌkʃ(ə)n/",
                "freq": 2779,
                "note": "produce + -tion（名词后缀）→ 生产",
                "examples": [
                  {
                    "english": "The factory increased production.",
                    "chinese": "工厂提高了产量。"
                  }
                ],
                "memoryTip": "produce + -tion。",
                "entryId": "sample_roots_advanced_roots_duct_production"
              },
              {
                "text": "product",
                "explains": "n. 产品；产物；（乘）积",
                "phonetic": "/'prɒdʌkt/",
                "freq": 3172,
                "note": "pro-（向前）+ duct（引导）→ 生产出来的东西",
                "examples": [
                  {
                    "english": "This product sells well.",
                    "chinese": "这个产品卖得很好。"
                  }
                ],
                "memoryTip": "pro-（向前）+ duct（引导）→ 生产出来的东西。",
                "entryId": "sample_roots_advanced_roots_duct_product"
              },
              {
                "text": "conduct",
                "explains": "n. 举止，行为",
                "phonetic": "/'kɒndʌkt/",
                "freq": 4361,
                "note": "con-（共同）+ duct（引导）→ 引导→指挥/实施",
                "examples": [
                  {
                    "english": "They conducted a survey.",
                    "chinese": "他们进行了一项调查。"
                  }
                ],
                "memoryTip": "con-（一起）+ duct（引导）→ 引导实施。",
                "entryId": "sample_roots_advanced_roots_duct_conduct"
              },
              {
                "text": "introduction",
                "explains": "n. 介绍；引进；引言",
                "phonetic": "/,ɪntrə'dʌkʃ(ə)n/",
                "freq": 8529,
                "note": "introduce + -tion（名词后缀）→ 介绍",
                "examples": [
                  {
                    "english": "The book has a short introduction.",
                    "chinese": "这本书有一个简短引言。"
                  }
                ],
                "memoryTip": "introduce + -tion。",
                "entryId": "sample_roots_advanced_roots_duct_introduction"
              },
              {
                "text": "conductor",
                "explains": "n. 售票员；（乐队）指挥",
                "phonetic": "/kən'dʌktə/",
                "freq": 9268,
                "note": "conduct + -or（人）→ 指挥/乘务员",
                "examples": [
                  {
                    "english": "The conductor led the orchestra.",
                    "chinese": "指挥带领管弦乐队。"
                  }
                ],
                "memoryTip": "conduct + -or（人）。",
                "entryId": "sample_roots_advanced_roots_duct_conductor"
              },
              {
                "text": "reduction",
                "explains": "n. 减少，减小，缩减",
                "phonetic": "/rɪ'dʌkʃ(ə)n/",
                "freq": 14487,
                "note": "reduce + -tion（名词后缀）→ 减少",
                "examples": [
                  {
                    "english": "The store offered a price reduction.",
                    "chinese": "商店提供了降价。"
                  }
                ],
                "memoryTip": "reduce + -tion。",
                "entryId": "sample_roots_advanced_roots_duct_reduction"
              }
            ]
          },
          {
            "keyType": "root",
            "keyValue": "tract",
            "keyDescription": "拉、拖：attract 拉过来，contract 拉紧",
            "note": "拉丁 trahere（拉、拖）。attract 拉过来→吸引，contract 拉紧→合同/收缩，extract 拉出来→提取，distract 拉开→分心。",
            "words": [
              {
                "text": "contract",
                "explains": "n. 契约，合同",
                "phonetic": "/'kɒntrækt/",
                "freq": 1827,
                "note": "con-（共同）+ tract（拉）→ 拉紧→合同/收缩",
                "examples": [
                  {
                    "english": "They signed a two-year contract.",
                    "chinese": "他们签了两年合同。"
                  }
                ],
                "memoryTip": "con-（一起）+ tract（拉紧）。",
                "entryId": "sample_roots_advanced_roots_tract_contract"
              },
              {
                "text": "attractive",
                "explains": "adj. 有吸引力的",
                "phonetic": "/ə'træktɪv/",
                "freq": 3084,
                "note": "attract + -ive（形容词后缀）→ 有吸引力的",
                "examples": [
                  {
                    "english": "The offer is very attractive.",
                    "chinese": "这个提议很有吸引力。"
                  }
                ],
                "memoryTip": "attract + -ive。",
                "entryId": "sample_roots_advanced_roots_tract_attractive"
              },
              {
                "text": "attract",
                "explains": "v. 吸引；引起……的兴趣；诱惑",
                "phonetic": "/ə'trækt/",
                "freq": 6246,
                "note": "at-（向）+ tract（拉）→ 拉过来→吸引",
                "examples": [
                  {
                    "english": "The show attracted many visitors.",
                    "chinese": "展览吸引了许多游客。"
                  }
                ],
                "memoryTip": "at-（向）+ tract（拉）。",
                "entryId": "sample_roots_advanced_roots_tract_attract"
              },
              {
                "text": "distract",
                "explains": "v. 分散（心思）；打扰",
                "phonetic": "/dɪ'strækt/",
                "freq": 6552,
                "note": "dis-（分开）+ tract（拉）→ 拉开→分心",
                "examples": [
                  {
                    "english": "Do not distract the driver.",
                    "chinese": "不要分散司机的注意力。"
                  }
                ],
                "memoryTip": "dis-（分开）+ tract（拉）。",
                "entryId": "sample_roots_advanced_roots_tract_distract"
              },
              {
                "text": "tractor",
                "explains": "n. 拖拉机；牵引车",
                "phonetic": "/'træktə/",
                "freq": 8476,
                "note": "tract（拉）+ -or（物）→ 拖拉机",
                "examples": [
                  {
                    "english": "The farmer drove a tractor.",
                    "chinese": "农民开着一辆拖拉机。"
                  }
                ],
                "memoryTip": "tract（拉）+ -or（物）。",
                "entryId": "sample_roots_advanced_roots_tract_tractor"
              },
              {
                "text": "extract",
                "explains": "v. 取出；提取；n. 摘录",
                "phonetic": "/ˈekstrækt/",
                "freq": 8949,
                "note": "ex-（出）+ tract（拉）→ 拉出来→提取",
                "examples": [
                  {
                    "english": "They extract oil from seeds.",
                    "chinese": "他们从种子中提取油。"
                  }
                ],
                "memoryTip": "ex-（出）+ tract（拉）。",
                "entryId": "sample_roots_advanced_roots_tract_extract"
              },
              {
                "text": "abstract",
                "explains": "adj. 抽象的；n. 摘要",
                "phonetic": "/'æbstrækt/",
                "freq": 13067,
                "note": "abs-（离开）+ tract（拉）→ 拉开→抽象的",
                "examples": [
                  {
                    "english": "The idea is too abstract.",
                    "chinese": "这个想法太抽象了。"
                  }
                ],
                "memoryTip": "abs-（离开）+ tract（拉）→ 拉离具体事物。",
                "entryId": "sample_roots_advanced_roots_tract_abstract"
              }
            ]
          },
          {
            "keyType": "root",
            "keyValue": "struct",
            "keyDescription": "建造、堆叠：construct 建造",
            "note": "拉丁 struere（建造、堆叠）。construct 建造，instruct 在头脑里搭建→指导，destruction 拆毁，obstruct 挡住建造→阻碍。",
            "words": [
              {
                "text": "construction",
                "explains": "n. 建造；建筑；建筑物",
                "phonetic": "/kən'strʌkʃ(ə)n/",
                "freq": 3140,
                "note": "construct + -ion（名词后缀）→ 建造",
                "examples": [
                  {
                    "english": "The construction will take a year.",
                    "chinese": "这项建设需要一年。"
                  }
                ],
                "memoryTip": "construct + -ion。",
                "entryId": "sample_roots_advanced_roots_struct_construction"
              },
              {
                "text": "destruction",
                "explains": "n. 破坏，毁灭，消灭",
                "phonetic": "/dɪ'strʌkʃ(ə)n/",
                "freq": 3650,
                "note": "de-（向下）+ struct（建造）+ -ion → 拆毁",
                "examples": [
                  {
                    "english": "The storm caused great destruction.",
                    "chinese": "风暴造成了巨大破坏。"
                  }
                ],
                "memoryTip": "de-（向下）+ struct（建造）+ -ion。",
                "entryId": "sample_roots_advanced_roots_struct_destruction"
              },
              {
                "text": "structure",
                "explains": "n. 结构；构造；建筑物；v. 组织；构成；建造",
                "phonetic": "/'strʌktʃə/",
                "freq": 4001,
                "note": "struct（建造）+ -ure → 建造出来的结构",
                "examples": [
                  {
                    "english": "The structure is strong and simple.",
                    "chinese": "这个结构坚固又简单。"
                  }
                ],
                "memoryTip": "struct（建造）+ -ure。",
                "entryId": "sample_roots_advanced_roots_struct_structure"
              },
              {
                "text": "instruction",
                "explains": "n. 命令；教学；教训",
                "phonetic": "/ɪn'strʌkʃ(ə)n/",
                "freq": 11066,
                "note": "instruct + -ion（名词后缀）→ 指导/说明",
                "examples": [
                  {
                    "english": "Read the instructions carefully.",
                    "chinese": "仔细阅读说明。"
                  }
                ],
                "memoryTip": "instruct + -ion。",
                "entryId": "sample_roots_advanced_roots_struct_instruction"
              },
              {
                "text": "construct",
                "explains": "v. 建造；建设；构筑",
                "phonetic": "/kən'strʌkt/",
                "freq": 12735,
                "note": "con-（共同）+ struct（建造）→ 建造",
                "examples": [
                  {
                    "english": "They plan to construct a new bridge.",
                    "chinese": "他们计划建一座新桥。"
                  }
                ],
                "memoryTip": "con-（共同）+ struct（建造）。",
                "entryId": "sample_roots_advanced_roots_struct_construct"
              },
              {
                "text": "instruct",
                "explains": "v. 指示；教；通知",
                "phonetic": "/ɪn'strʌkt/",
                "freq": 14869,
                "note": "in-（在内）+ struct（搭建）→ 在头脑里搭建→指导",
                "examples": [
                  {
                    "english": "The teacher instructed us to be quiet.",
                    "chinese": "老师指示我们安静。"
                  }
                ],
                "memoryTip": "in-（在内）+ struct（搭建）→ 在头脑里搭建。",
                "entryId": "sample_roots_advanced_roots_struct_instruct"
              },
              {
                "text": "obstruct",
                "explains": "v. 妨碍；阻塞；遮断",
                "phonetic": "/əb'strʌkt/",
                "freq": 28811,
                "note": "ob-（对着）+ struct（建造）→ 挡住→阻碍",
                "examples": [
                  {
                    "english": "A fallen tree obstructed the road.",
                    "chinese": "倒下的树挡住了路。"
                  }
                ],
                "memoryTip": "ob-（对着）+ struct（建造）→ 挡住。",
                "entryId": "sample_roots_advanced_roots_struct_obstruct"
              }
            ]
          },
          {
            "keyType": "root",
            "keyValue": "vid",
            "keyDescription": "看：video 看见的画面，evidence 看得见的证据",
            "note": "vid 与 vis 同源，拉丁 videre（看）。video 看见的画面，evidence 看得见的证据，evident 明显的；provide 是“向前看→预先准备”。",
            "words": [
              {
                "text": "evidence",
                "explains": "n. 根据；证据，证人",
                "phonetic": "/'evɪd(ə)ns/",
                "freq": 766,
                "note": "e-（出）+ vid（看）+ -ence → 看得见的证据",
                "examples": [
                  {
                    "english": "There is no evidence for that claim.",
                    "chinese": "那个说法没有证据。"
                  }
                ],
                "memoryTip": "e-（出）+ vid（看）+ -ence → 看得见的东西。",
                "entryId": "sample_roots_advanced_roots_vid_evidence"
              },
              {
                "text": "video",
                "explains": "adj. 录像的",
                "phonetic": "/'vɪdɪəʊ/",
                "freq": 1280,
                "note": "vid（看）+ -eo → 看见的画面",
                "examples": [
                  {
                    "english": "We watched a short video.",
                    "chinese": "我们看了一段短视频。"
                  }
                ],
                "memoryTip": "vid（看）+ -eo。",
                "entryId": "sample_roots_advanced_roots_vid_video"
              },
              {
                "text": "provide",
                "explains": "v. 提供；装备，供给",
                "phonetic": "/prə'vaɪd/",
                "freq": 2581,
                "note": "pro-（向前）+ vid（看）→ 预先准备→提供",
                "examples": [
                  {
                    "english": "They provide free lunch at school.",
                    "chinese": "学校提供免费午餐。"
                  }
                ],
                "memoryTip": "pro-（向前）+ vid（看）→ 预先准备。",
                "entryId": "sample_roots_advanced_roots_vid_provide"
              },
              {
                "text": "evidently",
                "explains": "adv. 显然，明显地；清楚地",
                "phonetic": "/'evɪd(ə)ntlɪ/",
                "freq": 9698,
                "examples": [
                  {
                    "english": "He was evidently very tired.",
                    "chinese": "他显然非常累。"
                  }
                ],
                "memoryTip": "evident + -ly。",
                "entryId": "sample_roots_advanced_roots_vid_evidently"
              },
              {
                "text": "evident",
                "explains": "adj. 明显的，明白的",
                "phonetic": "/'evɪd(ə)nt/",
                "freq": 15007,
                "note": "e-（出）+ vid（看）+ -ent → 明显的",
                "examples": [
                  {
                    "english": "Her joy was evident to everyone.",
                    "chinese": "她的喜悦大家都看得出来。"
                  }
                ],
                "memoryTip": "e-（出）+ vid（看）+ -ent。",
                "entryId": "sample_roots_advanced_roots_vid_evident"
              }
            ]
          },
          {
            "keyType": "root",
            "keyValue": "geo",
            "keyDescription": "地球、土地：geography 地理，geometry 测量土地",
            "note": "希腊 gē（土地）。geography 描写大地→地理，geometry 测量土地→几何，geology 研究土地→地质学。",
            "words": [
              {
                "text": "geography",
                "explains": "n. 地理，地理学",
                "phonetic": "/dʒɪ'ɒgrəfɪ/",
                "freq": 11690,
                "note": "geo（土地）+ -graphy（写）→ 描写大地→地理",
                "examples": [
                  {
                    "english": "She studies geography at school.",
                    "chinese": "她在学校学地理。"
                  }
                ],
                "memoryTip": "geo（地）+ -graphy（写）。",
                "entryId": "sample_roots_advanced_roots_geo_geography"
              },
              {
                "text": "geometry",
                "explains": "n. 几何，几何学",
                "phonetic": "/dʒɪ'ɒmɪtrɪ/",
                "freq": 14985,
                "note": "geo（土地）+ -metry（测量）→ 测量土地→几何",
                "examples": [
                  {
                    "english": "Geometry deals with shapes and space.",
                    "chinese": "几何学研究形状和空间。"
                  }
                ],
                "memoryTip": "geo（地）+ -metry（测量）。",
                "entryId": "sample_roots_advanced_roots_geo_geometry"
              },
              {
                "text": "geology",
                "explains": "n. 地质学；（某地）地质",
                "phonetic": "/dʒɪ'ɒlədʒɪ/",
                "freq": 19640,
                "note": "geo（土地）+ -logy（学科）→ 地质学",
                "examples": [
                  {
                    "english": "Geology studies rocks and the earth.",
                    "chinese": "地质学研究岩石和地球。"
                  }
                ],
                "memoryTip": "geo（地）+ -logy（学科）。",
                "entryId": "sample_roots_advanced_roots_geo_geology"
              },
              {
                "text": "geologist",
                "explains": "n. 地质学家，地质学者",
                "phonetic": "/dʒɪ'ɒlədʒɪst/",
                "freq": 19814,
                "note": "geology + -ist（人）→ 地质学家",
                "examples": [
                  {
                    "english": "The geologist examined the rock.",
                    "chinese": "地质学家检查了岩石。"
                  }
                ],
                "memoryTip": "geology + -ist（人）。",
                "entryId": "sample_roots_advanced_roots_geo_geologist"
              },
              {
                "text": "geographical",
                "explains": "adj. 地理的；地区（性）的",
                "phonetic": "/dʒɪə'græfɪk(ə)l/",
                "freq": 27342,
                "note": "geography + -ical → 地理的",
                "examples": [
                  {
                    "english": "The region has many geographical features.",
                    "chinese": "这个地区有许多地理特征。"
                  }
                ],
                "memoryTip": "geography + -ical。",
                "entryId": "sample_roots_advanced_roots_geo_geographical"
              }
            ]
          },
          {
            "keyType": "root",
            "keyValue": "graph",
            "keyDescription": "写、画、记录：photograph 用光记录",
            "note": "希腊 graphein（写、画）。photograph 用光记录→照片，paragraph 写在旁边→段落，biography 写生平→传记；graph 本身是“写下的图”。",
            "words": [
              {
                "text": "graph",
                "explains": "n. （曲线）图，图表",
                "phonetic": "/grɑːf; græf/",
                "freq": 21001,
                "note": "graph（写、画）→ 写下的图",
                "examples": [
                  {
                    "english": "The graph shows the sales trend.",
                    "chinese": "图表显示了销售趋势。"
                  }
                ],
                "memoryTip": "graph = 写下的图。",
                "entryId": "sample_roots_advanced_roots_graph_graph"
              },
              {
                "text": "photograph",
                "explains": "n. 照片，相片",
                "phonetic": "/'fəʊtəgrɑːf/",
                "freq": 3528,
                "note": "photo（光）+ graph（写）→ 用光记录→照片",
                "examples": [
                  {
                    "english": "He took a photograph of the lake.",
                    "chinese": "他拍了一张湖的照片。"
                  }
                ],
                "memoryTip": "photo（光）+ graph（写）。",
                "entryId": "sample_roots_advanced_roots_graph_photograph"
              },
              {
                "text": "geography",
                "explains": "n. 地理，地理学",
                "phonetic": "/dʒɪ'ɒgrəfɪ/",
                "freq": 11690,
                "note": "geo（土地）+ -graphy（写）→ 描写大地→地理",
                "examples": [
                  {
                    "english": "She studies geography at school.",
                    "chinese": "她在学校学地理。"
                  }
                ],
                "memoryTip": "geo（地）+ -graphy（写）。",
                "entryId": "sample_roots_advanced_roots_graph_geography"
              },
              {
                "text": "paragraph",
                "explains": "n. （文章的）段，节",
                "phonetic": "/'pærəgrɑːf/",
                "freq": 12117,
                "note": "para-（旁边）+ graph（写）→ 写在旁边→段落",
                "examples": [
                  {
                    "english": "Read the first paragraph again.",
                    "chinese": "再读一遍第一段。"
                  }
                ],
                "memoryTip": "para-（旁边）+ graph（写）。",
                "entryId": "sample_roots_advanced_roots_graph_paragraph"
              },
              {
                "text": "biography",
                "explains": "n. 传记；档案；个人简介",
                "phonetic": "/baɪ'ɒgrəfɪ/",
                "freq": 16735,
                "note": "bio（生命）+ -graphy（写）→ 写生平→传记",
                "examples": [
                  {
                    "english": "She wrote a biography of the scientist.",
                    "chinese": "她写了一本科学家传记。"
                  }
                ],
                "memoryTip": "bio（生命）+ -graphy（写）。",
                "entryId": "sample_roots_advanced_roots_graph_biography"
              }
            ]
          },
          {
            "keyType": "root",
            "keyValue": "phon",
            "keyDescription": "声音：telephone 远处的声音",
            "note": "希腊 phōnē（声音）。telephone 远处的声音，microphone 把声音放大，symphony 声音一起响→交响乐；phonetic 语音的。",
            "words": [
              {
                "text": "phone",
                "explains": "n. 电话，电话机",
                "phonetic": "/fəʊn/",
                "freq": 333,
                "note": "phon（声音）+ -e → 电话",
                "examples": [
                  {
                    "english": "My phone is on the table.",
                    "chinese": "我的手机在桌上。"
                  }
                ],
                "memoryTip": "phon（声音）+ -e。",
                "entryId": "sample_roots_advanced_roots_phon_phone"
              },
              {
                "text": "telephone",
                "explains": "n. （美）电话；电话机；电话耳机；v. 打电话",
                "phonetic": "/'telɪfəʊn/",
                "freq": 1988,
                "note": "tele-（远）+ phon（声音）→ 远处的声音",
                "examples": [
                  {
                    "english": "Please answer the telephone.",
                    "chinese": "请接电话。"
                  }
                ],
                "memoryTip": "tele-（远）+ phone（声音）。",
                "entryId": "sample_roots_advanced_roots_phon_telephone"
              },
              {
                "text": "microphone",
                "explains": "n. 话筒，麦克风",
                "phonetic": "/'maɪkrəfəʊn/",
                "freq": 7946,
                "note": "micro-（小）+ phon（声音）→ 把声音放大",
                "examples": [
                  {
                    "english": "Speak into the microphone.",
                    "chinese": "对着麦克风说话。"
                  }
                ],
                "memoryTip": "micro-（小）+ phon（声音）。",
                "entryId": "sample_roots_advanced_roots_phon_microphone"
              },
              {
                "text": "symphony",
                "explains": "n. 交响乐；交响乐团",
                "phonetic": "/'sɪmf(ə)nɪ/",
                "freq": 10686,
                "note": "sym-（共同）+ phon（声音）→ 声音一起响→交响乐",
                "examples": [
                  {
                    "english": "The symphony lasted an hour.",
                    "chinese": "交响乐持续了一小时。"
                  }
                ],
                "memoryTip": "sym-（共同）+ phon（声音）。",
                "entryId": "sample_roots_advanced_roots_phon_symphony"
              },
              {
                "text": "phonetic",
                "explains": "adj. 语音的，语音学的；音形一致的；发音有细微区别的",
                "phonetic": "/fə'netɪk/",
                "note": "phon（声音）+ -etic → 语音的",
                "examples": [
                  {
                    "english": "The book explains phonetic symbols.",
                    "chinese": "这本书讲解音标。"
                  }
                ],
                "memoryTip": "phon（声音）+ -etic。",
                "entryId": "sample_roots_advanced_roots_phon_phonetic"
              }
            ]
          },
          {
            "keyType": "root",
            "keyValue": "audi",
            "keyDescription": "听：audience 听众，audio 音频",
            "note": "拉丁 audire（听）。audience 听众，audio 音频，auditorium 礼堂；audible 听得见的，audition 试听/试镜。",
            "words": [
              {
                "text": "audience",
                "explains": "n. 听众，观众，读者",
                "phonetic": "/'ɔːdɪəns/",
                "freq": 1605,
                "note": "audi（听）+ -ence → 听众",
                "examples": [
                  {
                    "english": "The audience clapped at the end.",
                    "chinese": "演出结束时观众鼓掌。"
                  }
                ],
                "memoryTip": "audi（听）+ -ence。",
                "entryId": "sample_roots_advanced_roots_audi_audience"
              },
              {
                "text": "audition",
                "explains": "n. 听力，听觉；试听；v. 试听；试音",
                "phonetic": "/ɔː'dɪʃ(ə)n/",
                "freq": 4332,
                "note": "audi（听）+ -ition → 试听/试镜",
                "examples": [
                  {
                    "english": "She has an audition next week.",
                    "chinese": "她下周有一场试镜。"
                  }
                ],
                "memoryTip": "audi（听）+ -ition。",
                "entryId": "sample_roots_advanced_roots_audi_audition"
              },
              {
                "text": "audio",
                "explains": "adj. 声音的；[声] 音频的，[声] 声频的",
                "phonetic": "/'ɔːdɪəʊ/",
                "freq": 7649,
                "note": "audi（听）+ -o → 音频",
                "examples": [
                  {
                    "english": "The audio quality is excellent.",
                    "chinese": "音频质量很好。"
                  }
                ],
                "memoryTip": "audi（听）+ -o。",
                "entryId": "sample_roots_advanced_roots_audi_audio"
              },
              {
                "text": "audible",
                "explains": "adj. 听得见的",
                "phonetic": "/'ɔːdɪb(ə)l/",
                "freq": 11373,
                "note": "audi（听）+ -ible（可…的）→ 听得见的",
                "examples": [
                  {
                    "english": "His voice was barely audible.",
                    "chinese": "他的声音几乎听不见。"
                  }
                ],
                "memoryTip": "audi（听）+ -ible。",
                "entryId": "sample_roots_advanced_roots_audi_audible"
              },
              {
                "text": "auditorium",
                "explains": "n. 礼堂，会堂；观众席",
                "phonetic": "/ɔːdɪ'tɔːrɪəm/",
                "freq": 17043,
                "note": "audi（听）+ -orium（场所）→ 礼堂",
                "examples": [
                  {
                    "english": "The auditorium was full of students.",
                    "chinese": "礼堂里坐满了学生。"
                  }
                ],
                "memoryTip": "audi（听）+ -orium（场所）。",
                "entryId": "sample_roots_advanced_roots_audi_auditorium"
              }
            ]
          },
          {
            "keyType": "root",
            "keyValue": "bio",
            "keyDescription": "生命：biology 生物学，biography 写生平",
            "note": "希腊 bios（生命）。biology 生物学，biography 写生平→传记；biological 生物的，biologist 生物学家，autobiography 自传。",
            "words": [
              {
                "text": "biological",
                "explains": "adj. 生物的；生物学的",
                "phonetic": "/baɪə(ʊ)'lɒdʒɪk(ə)l/",
                "freq": 6177,
                "note": "biology + -ical → 生物的",
                "examples": [
                  {
                    "english": "Biological research takes time.",
                    "chinese": "生物学研究需要时间。"
                  }
                ],
                "memoryTip": "biology + -ical。",
                "entryId": "sample_roots_advanced_roots_bio_biological"
              },
              {
                "text": "biology",
                "explains": "n. 生物学",
                "phonetic": "/baɪ'ɒlədʒɪ/",
                "freq": 7866,
                "note": "bio（生命）+ -logy（学科）→ 生物学",
                "examples": [
                  {
                    "english": "Biology is the study of life.",
                    "chinese": "生物学是研究生命的学科。"
                  }
                ],
                "memoryTip": "bio（生命）+ -logy（学科）。",
                "entryId": "sample_roots_advanced_roots_bio_biology"
              },
              {
                "text": "biography",
                "explains": "n. 传记；档案；个人简介",
                "phonetic": "/baɪ'ɒgrəfɪ/",
                "freq": 16735,
                "note": "bio（生命）+ -graphy（写）→ 写生平→传记",
                "examples": [
                  {
                    "english": "She wrote a biography of the scientist.",
                    "chinese": "她写了一本科学家传记。"
                  }
                ],
                "memoryTip": "bio（生命）+ -graphy（写）。",
                "entryId": "sample_roots_advanced_roots_bio_biography"
              },
              {
                "text": "biologist",
                "explains": "n. 生物学家",
                "phonetic": "/baɪ'ɒlədʒɪst/",
                "freq": 18052,
                "note": "biology + -ist（人）→ 生物学家",
                "examples": [
                  {
                    "english": "The biologist studies plants.",
                    "chinese": "这位生物学家研究植物。"
                  }
                ],
                "memoryTip": "biology + -ist。",
                "entryId": "sample_roots_advanced_roots_bio_biologist"
              },
              {
                "text": "autobiography",
                "explains": "n. 自传；自传文学",
                "phonetic": "/ɔːtəbaɪ'ɒgrəfɪ/",
                "freq": 21150,
                "note": "auto-（自己）+ biography（传记）→ 自传",
                "examples": [
                  {
                    "english": "He published his autobiography last year.",
                    "chinese": "他去年出版了自传。"
                  }
                ],
                "memoryTip": "auto-（自己）+ biography。",
                "entryId": "sample_roots_advanced_roots_bio_autobiography"
              }
            ]
          }
        ]
      }
    ]
  },
  {
    "name": "词缀册",
    "desc": "先学高频、最好举一反三的前缀和后缀，再进入派生页",
    "chapters": [
      {
        "name": "常用前缀",
        "pages": [
          {
            "keyType": "prefix",
            "keyValue": "un",
            "keyDescription": "不、相反：unhappy 不开心",
            "note": "un- 加在形容词或动词前表示否定：happy → unhappy，lock → unlock，known → unknown。",
            "words": [
              {
                "text": "unusual",
                "explains": "adj. 不寻常的；与众不同的；不平常的",
                "phonetic": "/ʌn'juːʒʊəl/",
                "freq": 2461,
                "examples": [
                  {
                    "english": "It is unusual to see snow here.",
                    "chinese": "这里下雪很少见。"
                  }
                ],
                "entryId": "sample_affixes_prefix_un_unusual"
              },
              {
                "text": "unknown",
                "explains": "adj. 不知道的；未知的",
                "phonetic": "/ʌn'nəʊn/",
                "freq": 2859,
                "examples": [
                  {
                    "english": "The cause is still unknown.",
                    "chinese": "原因仍然未知。"
                  }
                ],
                "entryId": "sample_affixes_prefix_un_unknown"
              },
              {
                "text": "unhappy",
                "explains": "adj. 不快乐的；不幸福的；不适当的",
                "phonetic": "/ʌn'hæpɪ/",
                "freq": 3303,
                "examples": [
                  {
                    "english": "He looked unhappy after the news.",
                    "chinese": "听到消息后他显得不开心。"
                  }
                ],
                "memoryTip": "un-（不）+ happy。",
                "entryId": "sample_affixes_prefix_un_unhappy"
              },
              {
                "text": "unable",
                "explains": "adj. 不会的，不能的；[劳经] 无能力的；不能胜任的",
                "phonetic": "/ʌn'eɪb(ə)l/",
                "freq": 3600,
                "examples": [
                  {
                    "english": "He was unable to attend.",
                    "chinese": "他无法出席。"
                  }
                ],
                "entryId": "sample_affixes_prefix_un_unable"
              },
              {
                "text": "unfair",
                "explains": "adj. 不公平的，不公正的",
                "phonetic": "/ʌn'feə/",
                "freq": 4355,
                "examples": [
                  {
                    "english": "The rule seems unfair.",
                    "chinese": "这条规则似乎不公平。"
                  }
                ],
                "entryId": "sample_affixes_prefix_un_unfair"
              },
              {
                "text": "unexpected",
                "explains": "adj. 想不到的，意外的",
                "phonetic": "/ʌnɪk'spektɪd; ʌnek-/",
                "freq": 4550,
                "examples": [
                  {
                    "english": "We had an unexpected visitor.",
                    "chinese": "我们迎来了一位不速之客。"
                  }
                ],
                "entryId": "sample_affixes_prefix_un_unexpected"
              },
              {
                "text": "unlock",
                "explains": "v. 开…的锁；开启",
                "phonetic": "/ʌn'lɒk/",
                "freq": 7305,
                "examples": [
                  {
                    "english": "She unlocked the door.",
                    "chinese": "她打开了门锁。"
                  }
                ],
                "entryId": "sample_affixes_prefix_un_unlock"
              }
            ]
          },
          {
            "keyType": "prefix",
            "keyValue": "re",
            "keyDescription": "再、重新、回：rewrite 重写",
            "note": "re- 表示“再一次、往回”：write → rewrite，view → review，turn → return，cycle → recycle。",
            "words": [
              {
                "text": "return",
                "explains": "v. 返回；报答；n. 返回；归还；回球；adj. 报答的；回程的；返回的",
                "phonetic": "/rɪ'tɜːn/",
                "freq": 667,
                "examples": [
                  {
                    "english": "Please return the book tomorrow.",
                    "chinese": "请明天还书。"
                  }
                ],
                "entryId": "sample_affixes_prefix_re_return"
              },
              {
                "text": "replace",
                "explains": "v. 把...放回原处",
                "phonetic": "/rɪ'pleɪs/",
                "freq": 3287,
                "examples": [
                  {
                    "english": "We need to replace the old machine.",
                    "chinese": "我们需要更换旧机器。"
                  }
                ],
                "entryId": "sample_affixes_prefix_re_replace"
              },
              {
                "text": "review",
                "explains": "v. 再检查；n. 复习",
                "phonetic": "/rɪ'vjuː/",
                "freq": 3845,
                "examples": [
                  {
                    "english": "Let us review the notes.",
                    "chinese": "我们复习一下笔记。"
                  }
                ],
                "entryId": "sample_affixes_prefix_re_review"
              },
              {
                "text": "recover",
                "explains": "v. 重新获得；挽回",
                "phonetic": "/rɪ'kʌvə/",
                "freq": 4114,
                "examples": [
                  {
                    "english": "He is recovering from a cold.",
                    "chinese": "他正在从感冒中恢复。"
                  }
                ],
                "entryId": "sample_affixes_prefix_re_recover"
              },
              {
                "text": "react",
                "explains": "v. 作出反应；有影响",
                "phonetic": "/rɪ'ækt/",
                "freq": 4710,
                "note": "re-（回）+ act（做）→ 反应",
                "examples": [
                  {
                    "english": "How did he react to the news?",
                    "chinese": "他对这个消息有什么反应？"
                  }
                ],
                "memoryTip": "re-（回）+ act → 反应。",
                "entryId": "sample_affixes_prefix_re_react"
              },
              {
                "text": "rewrite",
                "explains": "v. 改写；重写；n. 重写或改写的文稿；改写的作品",
                "phonetic": "/riː'raɪt/",
                "freq": 11446,
                "examples": [
                  {
                    "english": "Please rewrite this sentence.",
                    "chinese": "请重写这个句子。"
                  }
                ],
                "memoryTip": "re-（再）+ write。",
                "entryId": "sample_affixes_prefix_re_rewrite"
              },
              {
                "text": "recycle",
                "explains": "v. 使再循环；使…重新利用；n. 再生；再循环；重复利用",
                "phonetic": "/riː'saɪk(ə)l/",
                "freq": 19173,
                "examples": [
                  {
                    "english": "We recycle paper and glass.",
                    "chinese": "我们回收纸张和玻璃。"
                  }
                ],
                "entryId": "sample_affixes_prefix_re_recycle"
              }
            ]
          },
          {
            "keyType": "prefix",
            "keyValue": "dis",
            "keyDescription": "不、分离：disappear 消失",
            "note": "dis- 表示“相反、分开”：agree → disagree，appear → disappear，cover → discover。",
            "words": [
              {
                "text": "disappear",
                "explains": "v. 消失；不见；失踪",
                "phonetic": "/dɪsə'pɪə/",
                "freq": 2238,
                "examples": [
                  {
                    "english": "The sun disappeared behind the cloud.",
                    "chinese": "太阳消失在云后。"
                  }
                ],
                "memoryTip": "dis-（不/离开）+ appear。",
                "entryId": "sample_affixes_prefix_dis_disappear"
              },
              {
                "text": "discover",
                "explains": "v. 发现",
                "phonetic": "/dɪ'skʌvə/",
                "freq": 3523,
                "examples": [
                  {
                    "english": "They discovered a new planet.",
                    "chinese": "他们发现了一颗新行星。"
                  }
                ],
                "entryId": "sample_affixes_prefix_dis_discover"
              },
              {
                "text": "disagree",
                "explains": "v. 有分歧；不一致",
                "phonetic": "/dɪsə'griː/",
                "freq": 5217,
                "examples": [
                  {
                    "english": "I disagree with that idea.",
                    "chinese": "我不同意那个想法。"
                  }
                ],
                "entryId": "sample_affixes_prefix_dis_disagree"
              },
              {
                "text": "disorder",
                "explains": "n. 骚乱；混乱，杂乱",
                "freq": 6109,
                "examples": [
                  {
                    "english": "The room was in disorder.",
                    "chinese": "房间很乱。"
                  }
                ],
                "entryId": "sample_affixes_prefix_dis_disorder"
              },
              {
                "text": "dismiss",
                "explains": "v. 不再考虑；解雇",
                "phonetic": "/dɪs'mɪs/",
                "freq": 8131,
                "note": "dis-（离开）+ miss（送）→ 送走→解散",
                "examples": [
                  {
                    "english": "The teacher dismissed the class early.",
                    "chinese": "老师提前下课了。"
                  }
                ],
                "memoryTip": "dis-（离开）+ miss（送）→ 送走。",
                "entryId": "sample_affixes_prefix_dis_dismiss"
              },
              {
                "text": "dislike",
                "explains": "v. 不喜爱，厌恶；n. 不喜爱，厌恶",
                "phonetic": "/dɪs'laɪk/",
                "freq": 8368,
                "examples": [
                  {
                    "english": "She dislikes cold weather.",
                    "chinese": "她不喜欢寒冷的天气。"
                  }
                ],
                "entryId": "sample_affixes_prefix_dis_dislike"
              },
              {
                "text": "disable",
                "explains": "v. 使无能，使伤残",
                "phonetic": "/dɪs'eɪb(ə)l/",
                "freq": 14965,
                "examples": [
                  {
                    "english": "The accident disabled the machine.",
                    "chinese": "事故使机器无法运转。"
                  }
                ],
                "entryId": "sample_affixes_prefix_dis_disable"
              }
            ]
          },
          {
            "keyType": "prefix",
            "keyValue": "pre",
            "keyDescription": "前、预先：predict 预先说",
            "note": "pre- 表示“在…之前”：view → preview，dict → predict，pare → prepare，vent → prevent。",
            "words": [
              {
                "text": "prepare",
                "explains": "v. 准备，预备",
                "phonetic": "/prɪ'peə/",
                "freq": 1631,
                "examples": [
                  {
                    "english": "We need to prepare for the exam.",
                    "chinese": "我们需要为考试做准备。"
                  }
                ],
                "memoryTip": "pre-（预先）+ pare。",
                "entryId": "sample_affixes_prefix_pre_prepare"
              },
              {
                "text": "prefer",
                "explains": "v. 更喜欢",
                "phonetic": "/prɪ'fɜː/",
                "freq": 1641,
                "note": "pre-（在前）+ fer（带）→ 更看重→更喜欢",
                "examples": [
                  {
                    "english": "I prefer tea to coffee.",
                    "chinese": "比起咖啡我更喜欢茶。"
                  }
                ],
                "memoryTip": "pre-（在前）+ fer。",
                "entryId": "sample_affixes_prefix_pre_prefer"
              },
              {
                "text": "prevent",
                "explains": "v. 预防，防止；阻止",
                "phonetic": "/prɪ'vent/",
                "freq": 3386,
                "examples": [
                  {
                    "english": "Wash your hands to prevent illness.",
                    "chinese": "洗手以预防疾病。"
                  }
                ],
                "entryId": "sample_affixes_prefix_pre_prevent"
              },
              {
                "text": "previous",
                "explains": "adj. 先的；前的",
                "phonetic": "/'priːvɪəs/",
                "freq": 3524,
                "examples": [
                  {
                    "english": "The previous owner kept the garden.",
                    "chinese": "前任房主保留了花园。"
                  }
                ],
                "entryId": "sample_affixes_prefix_pre_previous"
              },
              {
                "text": "preserve",
                "explains": "v. 保护；保存；腌渍",
                "phonetic": "/prɪ'zɜːv/",
                "freq": 6599,
                "examples": [
                  {
                    "english": "We must preserve the old buildings.",
                    "chinese": "我们必须保护老建筑。"
                  }
                ],
                "entryId": "sample_affixes_prefix_pre_preserve"
              },
              {
                "text": "predict",
                "explains": "v. 预言，预告，预测",
                "phonetic": "/prɪ'dɪkt/",
                "freq": 7098,
                "note": "pre-（预先）+ dict（说）→ 预言",
                "examples": [
                  {
                    "english": "It is hard to predict the future.",
                    "chinese": "很难预测未来。"
                  }
                ],
                "memoryTip": "pre-（预先）+ dict（说）。",
                "entryId": "sample_affixes_prefix_pre_predict"
              },
              {
                "text": "precaution",
                "explains": "n. 预防；警惕",
                "phonetic": "/prɪ'kɔːʃ(ə)n/",
                "freq": 10918,
                "examples": [
                  {
                    "english": "Take precautions against fire.",
                    "chinese": "采取防火措施。"
                  }
                ],
                "entryId": "sample_affixes_prefix_pre_precaution"
              }
            ]
          },
          {
            "keyType": "prefix",
            "keyValue": "ex",
            "keyDescription": "出、向外：export 运出去",
            "note": "ex- 表示“向外、出”：port → export，it → exit，pect → expect，plain → explain。",
            "words": [
              {
                "text": "explain",
                "explains": "v. 解释；为…辩解",
                "phonetic": "/ɪk'spleɪn/",
                "freq": 695,
                "examples": [
                  {
                    "english": "Can you explain the rule?",
                    "chinese": "你能解释这条规则吗？"
                  }
                ],
                "entryId": "sample_affixes_prefix_ex_explain"
              },
              {
                "text": "expect",
                "explains": "v. 预料，预期；等待",
                "phonetic": "/ɪk'spekt; ek-/",
                "freq": 797,
                "examples": [
                  {
                    "english": "We expect rain tomorrow.",
                    "chinese": "我们预计明天有雨。"
                  }
                ],
                "entryId": "sample_affixes_prefix_ex_expect"
              },
              {
                "text": "except",
                "explains": "prep. 除…之外",
                "phonetic": "/ɪk'sept; ek-/",
                "freq": 811,
                "examples": [
                  {
                    "english": "Everyone came except Tom.",
                    "chinese": "除了汤姆，大家都来了。"
                  }
                ],
                "entryId": "sample_affixes_prefix_ex_except"
              },
              {
                "text": "experience",
                "explains": "n. 经验，感受；经历",
                "phonetic": "/ɪk'spɪərɪəns; ek-/",
                "freq": 1095,
                "examples": [
                  {
                    "english": "She has years of teaching experience.",
                    "chinese": "她有多年教学经验。"
                  }
                ],
                "entryId": "sample_affixes_prefix_ex_experience"
              },
              {
                "text": "exit",
                "explains": "n. 出口；退场；v. 退出",
                "phonetic": "/'eksɪt; 'egzɪt/",
                "freq": 3147,
                "examples": [
                  {
                    "english": "Please use the side exit.",
                    "chinese": "请走侧门出口。"
                  }
                ],
                "memoryTip": "ex-（出）+ it。",
                "entryId": "sample_affixes_prefix_ex_exit"
              },
              {
                "text": "expand",
                "explains": "v. 扩大；使膨胀",
                "phonetic": "/ɪk'spænd; ek-/",
                "freq": 7264,
                "examples": [
                  {
                    "english": "The company plans to expand.",
                    "chinese": "公司计划扩张。"
                  }
                ],
                "entryId": "sample_affixes_prefix_ex_expand"
              },
              {
                "text": "export",
                "explains": "v. 出口；输出",
                "phonetic": "/ˈekspɔːt；ɪkˈ-/",
                "freq": 14152,
                "note": "ex-（向外）+ port（搬运）→ 运出去",
                "examples": [
                  {
                    "english": "They export tea to Europe.",
                    "chinese": "他们向欧洲出口茶叶。"
                  }
                ],
                "memoryTip": "ex-（向外）+ port。",
                "entryId": "sample_affixes_prefix_ex_export"
              }
            ]
          },
          {
            "keyType": "prefix",
            "keyValue": "inter",
            "keyDescription": "在…之间、相互（连在一起）：international 国际的",
            "note": "拉丁 inter（在…之间、相互，连在一起）。inter + net → internet 互联网，inter + act → interact 互动，inter + connect → interconnect 互联，inter + national → international 国际的。",
            "words": [
              {
                "text": "interview",
                "explains": "n. 接见；会见；面谈",
                "phonetic": "/'ɪntəvjuː/",
                "freq": 1727,
                "note": "inter-（相互）+ view（看）→ 面对面交谈",
                "examples": [
                  {
                    "english": "I have a job interview tomorrow.",
                    "chinese": "我明天有一场求职面试。"
                  }
                ],
                "memoryTip": "inter-（相互）+ view（看）。",
                "entryId": "sample_affixes_prefix_inter_interview"
              },
              {
                "text": "internet",
                "explains": "n. 因特网",
                "phonetic": "/'ɪntənet/",
                "freq": 2347,
                "note": "inter-（之间）+ net（网）→ 互联网",
                "examples": [
                  {
                    "english": "I found the answer on the internet.",
                    "chinese": "我在网上找到了答案。"
                  }
                ],
                "memoryTip": "inter-（之间）+ net（网）。",
                "entryId": "sample_affixes_prefix_inter_internet"
              },
              {
                "text": "international",
                "explains": "adj. 国际的，世界（性）的",
                "phonetic": "/ɪntə'næʃ(ə)n(ə)l/",
                "freq": 2551,
                "note": "inter-（之间）+ national（国家的）→ 国际的",
                "examples": [
                  {
                    "english": "She works for an international company.",
                    "chinese": "她在一家国际公司工作。"
                  }
                ],
                "memoryTip": "inter-（之间）+ national。",
                "entryId": "sample_affixes_prefix_inter_international"
              },
              {
                "text": "internal",
                "explains": "adj. 国内的；内的",
                "phonetic": "/ɪn'tɜːn(ə)l/",
                "freq": 3766,
                "note": "inter-（在内）+ -al → 内部的",
                "examples": [
                  {
                    "english": "This is an internal matter.",
                    "chinese": "这是内部事务。"
                  }
                ],
                "memoryTip": "inter-（在内）+ -al。",
                "entryId": "sample_affixes_prefix_inter_internal"
              },
              {
                "text": "interact",
                "explains": "v. 相互作用",
                "phonetic": "/ɪntər'ækt/",
                "freq": 13926,
                "note": "inter-（相互）+ act（做）→ 互动",
                "examples": [
                  {
                    "english": "Children learn by interacting with others.",
                    "chinese": "孩子们通过与他人互动学习。"
                  }
                ],
                "memoryTip": "inter-（相互）+ act（做）。",
                "entryId": "sample_affixes_prefix_inter_interact"
              },
              {
                "text": "interaction",
                "explains": "n. 相互作用；干扰",
                "phonetic": "/ɪntər'ækʃ(ə)n/",
                "freq": 14082,
                "note": "interact + -ion（名词后缀）→ 相互作用",
                "examples": [
                  {
                    "english": "Online interaction is common now.",
                    "chinese": "现在线上互动很常见。"
                  }
                ],
                "memoryTip": "interact + -ion。",
                "entryId": "sample_affixes_prefix_inter_interaction"
              },
              {
                "text": "interface",
                "explains": "n. 分界面",
                "phonetic": "/'ɪntəfeɪs/",
                "freq": 15088,
                "note": "inter-（之间）+ face（面）→ 界面",
                "examples": [
                  {
                    "english": "The interface is easy to use.",
                    "chinese": "这个界面很容易使用。"
                  }
                ],
                "memoryTip": "inter- + face（面）。",
                "entryId": "sample_affixes_prefix_inter_interface"
              },
              {
                "text": "interpersonal",
                "explains": "adj. 人际的；人与人之间的",
                "phonetic": "/ɪntə'pɜːs(ə)n(ə)l/",
                "freq": 40952,
                "note": "inter-（之间）+ personal（个人的）→ 人际的",
                "examples": [
                  {
                    "english": "Good interpersonal skills are important.",
                    "chinese": "良好的人际交往能力很重要。"
                  }
                ],
                "memoryTip": "inter- + personal。",
                "entryId": "sample_affixes_prefix_inter_interpersonal"
              },
              {
                "text": "interconnect",
                "explains": "v. 使互相联系",
                "phonetic": "/ɪntəkə'nekt/",
                "note": "inter-（相互）+ connect（连接）→ 互相连接",
                "examples": [
                  {
                    "english": "These computers are interconnected.",
                    "chinese": "这些计算机互相连接。"
                  }
                ],
                "memoryTip": "inter- + connect。",
                "entryId": "sample_affixes_prefix_inter_interconnect"
              }
            ]
          },
          {
            "keyType": "text",
            "keyValue": "interact",
            "keyDescription": "inter- 相互 + act 做 → 互动；再看它的派生",
            "note": "interact = inter-（相互）+ act（做）→ 互动。加 -ion 成 interaction（名词，相互作用），加 -ive 成 interactive（形容词，交互式的）；interconnect 是同族词（inter- + connect）。",
            "words": [
              {
                "text": "interact",
                "explains": "v. 相互作用",
                "phonetic": "/ɪntər'ækt/",
                "freq": 13926,
                "note": "inter-（相互）+ act（做）→ 互动",
                "examples": [
                  {
                    "english": "Children learn by interacting with others.",
                    "chinese": "孩子们通过与他人互动学习。"
                  }
                ],
                "memoryTip": "inter-（相互）+ act（做）。",
                "entryId": "sample_affixes_prefix_interact_interact"
              },
              {
                "text": "interaction",
                "explains": "n. 相互作用；干扰",
                "phonetic": "/ɪntər'ækʃ(ə)n/",
                "freq": 14082,
                "note": "interact + -ion（名词后缀）→ 相互作用",
                "examples": [
                  {
                    "english": "Online interaction is common now.",
                    "chinese": "现在线上互动很常见。"
                  }
                ],
                "memoryTip": "interact + -ion。",
                "entryId": "sample_affixes_prefix_interact_interaction"
              },
              {
                "text": "interactive",
                "explains": "adj. 交互式的；相互作用的",
                "phonetic": "/ɪntər'æktɪv/",
                "freq": 26269,
                "note": "interact + -ive（形容词后缀）→ 交互式的",
                "examples": [
                  {
                    "english": "The app has an interactive map.",
                    "chinese": "这个应用有互动地图。"
                  }
                ],
                "memoryTip": "interact + -ive。",
                "entryId": "sample_affixes_prefix_interact_interactive"
              },
              {
                "text": "interconnect",
                "explains": "v. 使互相联系",
                "phonetic": "/ɪntəkə'nekt/",
                "note": "inter-（相互）+ connect（连接）→ 互相连接",
                "examples": [
                  {
                    "english": "These computers are interconnected.",
                    "chinese": "这些计算机互相连接。"
                  }
                ],
                "memoryTip": "inter- + connect。",
                "entryId": "sample_affixes_prefix_interact_interconnect"
              }
            ]
          },
          {
            "keyType": "prefix",
            "keyValue": "trans",
            "keyDescription": "横跨、转移：transport 运输",
            "note": "trans- 表示“横跨、转移”：port → transport，fer → transfer，form → transform，late → translate。",
            "words": [
              {
                "text": "transfer",
                "explains": "v. 转移；调动",
                "phonetic": "/træns'fɜː; trɑːns-; -nz-/",
                "freq": 2816,
                "note": "trans-（横跨）+ fer（带）→ 转移",
                "examples": [
                  {
                    "english": "Please transfer the money today.",
                    "chinese": "请今天转账。"
                  }
                ],
                "memoryTip": "trans-（转移）+ fer。",
                "entryId": "sample_affixes_prefix_trans_transfer"
              },
              {
                "text": "transport",
                "explains": "v. 运输；n. 运输",
                "phonetic": "/træn'spɔːt; trɑːn-/",
                "freq": 3644,
                "note": "trans-（横跨）+ port（搬运）→ 运输",
                "examples": [
                  {
                    "english": "We transport goods by train.",
                    "chinese": "我们用火车运输货物。"
                  }
                ],
                "memoryTip": "trans-（横跨）+ port。",
                "entryId": "sample_affixes_prefix_trans_transport"
              },
              {
                "text": "translate",
                "explains": "v. 翻译；转化；解释；转变为；调动",
                "phonetic": "/træns'leɪt; trɑːns-; -nz-/",
                "freq": 7286,
                "examples": [
                  {
                    "english": "Please translate this sentence.",
                    "chinese": "请翻译这个句子。"
                  }
                ],
                "entryId": "sample_affixes_prefix_trans_translate"
              },
              {
                "text": "transportation",
                "explains": "n. 运输，运送，客运",
                "phonetic": "/trænspɔː'teɪʃ(ə)n; trɑːns-/",
                "freq": 7798,
                "note": "transport + -ation（名词后缀）→ 运输",
                "examples": [
                  {
                    "english": "Public transportation is convenient here.",
                    "chinese": "这里的公共交通很方便。"
                  }
                ],
                "memoryTip": "transport + -ation。",
                "entryId": "sample_affixes_prefix_trans_transportation"
              },
              {
                "text": "transform",
                "explains": "v. 改变；改造；变换",
                "phonetic": "/træns'fɔːm; trɑːns-; -nz-/",
                "freq": 7936,
                "note": "trans-（改变）+ form（形状）→ 变形",
                "examples": [
                  {
                    "english": "The city has transformed in ten years.",
                    "chinese": "这座城市十年间变了样。"
                  }
                ],
                "memoryTip": "trans-（改变）+ form → 变形。",
                "entryId": "sample_affixes_prefix_trans_transform"
              },
              {
                "text": "transmit",
                "explains": "v. 传送，传达；发射",
                "phonetic": "/trænz'mɪt; trɑːnz-; -ns-/",
                "freq": 12164,
                "note": "trans-（横跨）+ mit（送）→ 传送",
                "examples": [
                  {
                    "english": "The station transmits signals all day.",
                    "chinese": "电台全天传送信号。"
                  }
                ],
                "memoryTip": "trans-（横跨）+ mit。",
                "entryId": "sample_affixes_prefix_trans_transmit"
              },
              {
                "text": "transparent",
                "explains": "adj. 透明的；易识破的",
                "phonetic": "/træn'spær(ə)nt; trɑːn-; -'speə-/",
                "freq": 12280,
                "examples": [
                  {
                    "english": "The glass is transparent.",
                    "chinese": "玻璃是透明的。"
                  }
                ],
                "entryId": "sample_affixes_prefix_trans_transparent"
              }
            ]
          },
          {
            "keyType": "prefix",
            "keyValue": "pro",
            "keyDescription": "向前、支持：progress 前进",
            "note": "pro- 表示“向前、支持”：gress → progress，tect → protect，mote → promote，pose → propose。",
            "words": [
              {
                "text": "protect",
                "explains": "v. 保护，保卫，警戒",
                "phonetic": "/prə'tekt/",
                "freq": 825,
                "examples": [
                  {
                    "english": "We should protect the environment.",
                    "chinese": "我们应该保护环境。"
                  }
                ],
                "entryId": "sample_affixes_prefix_pro_protect"
              },
              {
                "text": "project",
                "explains": "n. 方案，工程；v. 伸出",
                "phonetic": "/prəˈdʒekt; ˈprɒdʒekt/",
                "freq": 1541,
                "note": "pro-（向前）+ ject（投）→ 向前投→项目/投射",
                "examples": [
                  {
                    "english": "We finished the project on time.",
                    "chinese": "我们按时完成了项目。"
                  }
                ],
                "memoryTip": "pro-（向前）+ ject（投）。",
                "entryId": "sample_affixes_prefix_pro_project"
              },
              {
                "text": "program",
                "explains": "n. 程序；节目单",
                "phonetic": "/'prəʊɡræm/",
                "freq": 1636,
                "examples": [
                  {
                    "english": "He wrote a small program.",
                    "chinese": "他写了一个小程序。"
                  }
                ],
                "entryId": "sample_affixes_prefix_pro_program"
              },
              {
                "text": "progress",
                "explains": "n. 前进；进展；进步",
                "phonetic": "/'prəʊgres/",
                "freq": 2460,
                "examples": [
                  {
                    "english": "She made great progress.",
                    "chinese": "她取得了很大进步。"
                  }
                ],
                "memoryTip": "pro-（向前）+ gress（走）。",
                "entryId": "sample_affixes_prefix_pro_progress"
              },
              {
                "text": "produce",
                "explains": "v. 产生；生产；展现",
                "phonetic": "/prə'djuːs/",
                "freq": 3398,
                "note": "pro-（向前）+ duc（引导）→ 引出→生产",
                "examples": [
                  {
                    "english": "The farm produces fresh milk.",
                    "chinese": "农场生产新鲜牛奶。"
                  }
                ],
                "entryId": "sample_affixes_prefix_pro_produce"
              },
              {
                "text": "propose",
                "explains": "v. 提议；求婚",
                "phonetic": "/prə'pəʊz/",
                "freq": 3830,
                "note": "pro-（向前）+ pos（放）→ 放到前面→提议",
                "examples": [
                  {
                    "english": "I propose a short break.",
                    "chinese": "我提议短暂休息。"
                  }
                ],
                "memoryTip": "pro-（向前）+ pos。",
                "entryId": "sample_affixes_prefix_pro_propose"
              },
              {
                "text": "promote",
                "explains": "v. 促进，发扬；提升",
                "phonetic": "/prə'məʊt/",
                "freq": 8520,
                "examples": [
                  {
                    "english": "They promoted her to manager.",
                    "chinese": "他们把她提升为经理。"
                  }
                ],
                "entryId": "sample_affixes_prefix_pro_promote"
              }
            ]
          },
          {
            "keyType": "prefix",
            "keyValue": "over",
            "keyDescription": "过度、在上：overcome 克服",
            "note": "over- 表示“在上、过度”：come → overcome，look → overlook，time → overtime，coat → overcoat。",
            "words": [
              {
                "text": "overnight",
                "explains": "adv. 一夜；突然",
                "phonetic": "/əʊvə'naɪt/",
                "freq": 4572,
                "examples": [
                  {
                    "english": "We stayed overnight in the city.",
                    "chinese": "我们在城里过了一夜。"
                  }
                ],
                "entryId": "sample_affixes_prefix_over_overnight"
              },
              {
                "text": "overcome",
                "explains": "v. 克服；战胜",
                "phonetic": "/əʊvə'kʌm/",
                "freq": 5068,
                "examples": [
                  {
                    "english": "He overcame many difficulties.",
                    "chinese": "他克服了许多困难。"
                  }
                ],
                "memoryTip": "over-（在上）+ come。",
                "entryId": "sample_affixes_prefix_over_overcome"
              },
              {
                "text": "overseas",
                "explains": "adv. 海外；adj. 在海外的",
                "phonetic": "/əʊvə'siːz/",
                "freq": 7047,
                "examples": [
                  {
                    "english": "She works overseas.",
                    "chinese": "她在海外工作。"
                  }
                ],
                "entryId": "sample_affixes_prefix_over_overseas"
              },
              {
                "text": "overtime",
                "explains": "n. 加班；加班的时间",
                "phonetic": "/'əʊvətaɪm/",
                "freq": 7425,
                "examples": [
                  {
                    "english": "He worked overtime last night.",
                    "chinese": "他昨晚加班了。"
                  }
                ],
                "entryId": "sample_affixes_prefix_over_overtime"
              },
              {
                "text": "overall",
                "explains": "n. 工装裤；adj. 全面的",
                "phonetic": "/'əʊvərɔːl/",
                "freq": 8144,
                "examples": [
                  {
                    "english": "Overall, the plan works.",
                    "chinese": "总的来说，这个计划可行。"
                  }
                ],
                "entryId": "sample_affixes_prefix_over_overall"
              },
              {
                "text": "overlook",
                "explains": "v. 忽略；未注意到；眺望",
                "phonetic": "/əʊvə'lʊk/",
                "freq": 12936,
                "examples": [
                  {
                    "english": "Do not overlook small mistakes.",
                    "chinese": "不要忽视小错误。"
                  }
                ],
                "entryId": "sample_affixes_prefix_over_overlook"
              },
              {
                "text": "overcoat",
                "explains": "n. 外衣，大衣",
                "phonetic": "/'əʊvəkəʊt/",
                "freq": 20478,
                "examples": [
                  {
                    "english": "He wore a warm overcoat.",
                    "chinese": "他穿着一件暖和的大衣。"
                  }
                ],
                "entryId": "sample_affixes_prefix_over_overcoat"
              }
            ]
          },
          {
            "keyType": "prefix",
            "keyValue": "under",
            "keyDescription": "在下、不足：understand 理解",
            "note": "under- 表示“在下、不足”：stand → understand，line → underline，go → undergo，estimate → underestimate。",
            "words": [
              {
                "text": "understand",
                "explains": "v. 理解；懂；获悉；推断；省略",
                "phonetic": "/ʌndə'stænd/",
                "freq": 235,
                "examples": [
                  {
                    "english": "I understand your point.",
                    "chinese": "我理解你的观点。"
                  }
                ],
                "memoryTip": "under + stand：站在下面听。",
                "entryId": "sample_affixes_prefix_under_understand"
              },
              {
                "text": "underneath",
                "explains": "prep,adv. 在下面，在底下",
                "phonetic": "/ʌndə'niːθ/",
                "freq": 3186,
                "examples": [
                  {
                    "english": "The cat is underneath the table.",
                    "chinese": "猫在桌子下面。"
                  }
                ],
                "entryId": "sample_affixes_prefix_under_underneath"
              },
              {
                "text": "undergo",
                "explains": "v. 经历，经受，忍受",
                "phonetic": "/ʌndə'gəʊ/",
                "freq": 15368,
                "examples": [
                  {
                    "english": "The building will undergo repairs.",
                    "chinese": "这栋楼将进行维修。"
                  }
                ],
                "entryId": "sample_affixes_prefix_under_undergo"
              },
              {
                "text": "undertake",
                "explains": "v. 从事；承担；保证",
                "phonetic": "/ʌndə'teɪk/",
                "freq": 17534,
                "examples": [
                  {
                    "english": "They undertook a difficult task.",
                    "chinese": "他们承担了一项艰巨任务。"
                  }
                ],
                "entryId": "sample_affixes_prefix_under_undertake"
              },
              {
                "text": "undergraduate",
                "explains": "n. 大学在校生",
                "phonetic": "/ʌndə'grædjʊət/",
                "freq": 35188,
                "examples": [
                  {
                    "english": "She is an undergraduate student.",
                    "chinese": "她是一名本科生。"
                  }
                ],
                "entryId": "sample_affixes_prefix_under_undergraduate"
              },
              {
                "text": "underline",
                "explains": "v. 划线于…之下",
                "phonetic": "/ʌndə'laɪn/",
                "freq": 38062,
                "examples": [
                  {
                    "english": "Please underline the key words.",
                    "chinese": "请给关键词画线。"
                  }
                ],
                "entryId": "sample_affixes_prefix_under_underline"
              }
            ]
          },
          {
            "keyType": "prefix",
            "keyValue": "mis",
            "keyDescription": "错误、坏：mistake 错误",
            "note": "mis- 表示“错误、坏”：take → mistake，lead → mislead，understand → misunderstand。",
            "words": [
              {
                "text": "mistake",
                "explains": "n. 错误；v. 误解，弄错",
                "phonetic": "/mɪ'steɪk/",
                "freq": 750,
                "examples": [
                  {
                    "english": "Everyone makes mistakes.",
                    "chinese": "每个人都会犯错。"
                  }
                ],
                "memoryTip": "mis-（错）+ take（拿）。",
                "entryId": "sample_affixes_prefix_mis_mistake"
              },
              {
                "text": "misfortune",
                "explains": "n. 不幸，灾祸，灾难",
                "phonetic": "/mɪs'fɔːtʃuːn; -tʃ(ə)n/",
                "freq": 7975,
                "examples": [
                  {
                    "english": "He bore his misfortune bravely.",
                    "chinese": "他勇敢地承受不幸。"
                  }
                ],
                "entryId": "sample_affixes_prefix_mis_misfortune"
              },
              {
                "text": "misunderstand",
                "explains": "v. 误解，误会，曲解",
                "phonetic": "/,mɪsʌndə'stænd/",
                "freq": 9768,
                "examples": [
                  {
                    "english": "Do not misunderstand my meaning.",
                    "chinese": "不要误解我的意思。"
                  }
                ],
                "entryId": "sample_affixes_prefix_mis_misunderstand"
              },
              {
                "text": "mislead",
                "explains": "v. 将…引入歧途，误导",
                "phonetic": "/mɪs'liːd/",
                "freq": 20840,
                "examples": [
                  {
                    "english": "The sign may mislead visitors.",
                    "chinese": "这个标志可能会误导游客。"
                  }
                ],
                "entryId": "sample_affixes_prefix_mis_mislead"
              },
              {
                "text": "misbehave",
                "explains": "v. 作弊；行为不礼貌",
                "phonetic": "/mɪsbɪ'heɪv/",
                "freq": 26247,
                "examples": [
                  {
                    "english": "The child misbehaved in class.",
                    "chinese": "那个孩子在课堂上捣乱。"
                  }
                ],
                "entryId": "sample_affixes_prefix_mis_misbehave"
              }
            ]
          },
          {
            "keyType": "prefix",
            "keyValue": "out",
            "keyDescription": "出、超过：output 输出",
            "note": "out- 表示“向外、超过”：side → outside，put → output，standing → outstanding，line → outline。",
            "words": [
              {
                "text": "outside",
                "explains": "n. 外部；外表；adj. 外部的",
                "phonetic": "/aʊt'saɪd; 'aʊtsaɪd/",
                "freq": 534,
                "examples": [
                  {
                    "english": "The children are playing outside.",
                    "chinese": "孩子们在外面玩。"
                  }
                ],
                "entryId": "sample_affixes_prefix_out_outside"
              },
              {
                "text": "outstanding",
                "explains": "adj. 突出的，杰出的",
                "phonetic": "/aʊt'stændɪŋ/",
                "freq": 6627,
                "examples": [
                  {
                    "english": "Her work is outstanding.",
                    "chinese": "她的工作非常出色。"
                  }
                ],
                "entryId": "sample_affixes_prefix_out_outstanding"
              },
              {
                "text": "outcome",
                "explains": "n. 结果，后果，成果",
                "phonetic": "/'aʊtkʌm/",
                "freq": 6951,
                "examples": [
                  {
                    "english": "We are waiting for the outcome.",
                    "chinese": "我们在等待结果。"
                  }
                ],
                "entryId": "sample_affixes_prefix_out_outcome"
              },
              {
                "text": "outdoor",
                "explains": "adj. 户外的，室外的",
                "phonetic": "/'aʊtdɔː/",
                "freq": 12194,
                "examples": [
                  {
                    "english": "We enjoy outdoor activities.",
                    "chinese": "我们喜欢户外活动。"
                  }
                ],
                "entryId": "sample_affixes_prefix_out_outdoor"
              },
              {
                "text": "output",
                "explains": "n. 产量；输出量；输出",
                "phonetic": "/'aʊtpʊt/",
                "freq": 12706,
                "examples": [
                  {
                    "english": "The factory increased its output.",
                    "chinese": "工厂提高了产量。"
                  }
                ],
                "memoryTip": "out-（出）+ put。",
                "entryId": "sample_affixes_prefix_out_output"
              },
              {
                "text": "outline",
                "explains": "n. 轮廓；略图；大纲",
                "phonetic": "/'aʊtlaɪn/",
                "freq": 15045,
                "examples": [
                  {
                    "english": "He gave a brief outline of the plan.",
                    "chinese": "他简要介绍了计划。"
                  }
                ],
                "entryId": "sample_affixes_prefix_out_outline"
              },
              {
                "text": "outlook",
                "explains": "n. 观点，看法；展望",
                "phonetic": "/'aʊtlʊk/",
                "freq": 17268,
                "examples": [
                  {
                    "english": "The outlook for the economy is good.",
                    "chinese": "经济前景良好。"
                  }
                ],
                "entryId": "sample_affixes_prefix_out_outlook"
              }
            ]
          }
        ]
      },
      {
        "name": "常用后缀",
        "pages": [
          {
            "keyType": "suffix",
            "keyValue": "er",
            "keyDescription": "名词后缀：…的人/物",
            "note": "动词 + -er → 做某事的人/物：teach → teacher，compute → computer，read → reader。",
            "words": [
              {
                "text": "teacher",
                "explains": "n. 教师；导师",
                "phonetic": "/'tiːtʃə/",
                "freq": 1015,
                "examples": [
                  {
                    "english": "Our teacher is very patient.",
                    "chinese": "我们的老师很有耐心。"
                  }
                ],
                "memoryTip": "teach + -er。",
                "entryId": "sample_affixes_suffix_er_teacher"
              },
              {
                "text": "computer",
                "explains": "n. 计算机，电脑",
                "phonetic": "/kəm'pjuːtə/",
                "freq": 1099,
                "examples": [
                  {
                    "english": "My computer is very fast.",
                    "chinese": "我的电脑很快。"
                  }
                ],
                "entryId": "sample_affixes_suffix_er_computer"
              },
              {
                "text": "leader",
                "explains": "n. 领袖，领导人；首领",
                "phonetic": "/'liːdə/",
                "freq": 1431,
                "examples": [
                  {
                    "english": "She is a strong leader.",
                    "chinese": "她是一位坚强的领导者。"
                  }
                ],
                "entryId": "sample_affixes_suffix_er_leader"
              },
              {
                "text": "writer",
                "explains": "n. 作家；作者",
                "phonetic": "/'raɪtə/",
                "freq": 2549,
                "examples": [
                  {
                    "english": "The writer published a new book.",
                    "chinese": "这位作家出版了一本新书。"
                  }
                ],
                "entryId": "sample_affixes_suffix_er_writer"
              },
              {
                "text": "singer",
                "explains": "n. 歌手，歌唱家",
                "phonetic": "/'sɪŋə(r)/",
                "freq": 2940,
                "examples": [
                  {
                    "english": "The singer has a beautiful voice.",
                    "chinese": "这位歌手嗓音优美。"
                  }
                ],
                "entryId": "sample_affixes_suffix_er_singer"
              },
              {
                "text": "worker",
                "explains": "n. 工人；劳动者；职蚁",
                "phonetic": "/'wɜːkə/",
                "freq": 3449,
                "examples": [
                  {
                    "english": "The worker repaired the roof.",
                    "chinese": "工人修好了屋顶。"
                  }
                ],
                "entryId": "sample_affixes_suffix_er_worker"
              },
              {
                "text": "reader",
                "explains": "n. 读者；读物，读本",
                "phonetic": "/'riːdə/",
                "freq": 8937,
                "examples": [
                  {
                    "english": "The reader asked a question.",
                    "chinese": "读者问了一个问题。"
                  }
                ],
                "entryId": "sample_affixes_suffix_er_reader"
              }
            ]
          },
          {
            "keyType": "suffix",
            "keyValue": "ly",
            "keyDescription": "副词后缀：…地",
            "note": "形容词 + -ly → 副词：quick → quickly，careful → carefully，usual → usually。",
            "words": [
              {
                "text": "probably",
                "explains": "adv. 或许，大概",
                "freq": 369,
                "examples": [
                  {
                    "english": "It will probably rain later.",
                    "chinese": "稍后可能会下雨。"
                  }
                ],
                "entryId": "sample_affixes_suffix_ly_probably"
              },
              {
                "text": "exactly",
                "explains": "adv. 确切地；恰恰正是",
                "phonetic": "/ɪg'zæk(t)lɪ; eg-/",
                "freq": 384,
                "examples": [
                  {
                    "english": "That is exactly what I meant.",
                    "chinese": "那正是我的意思。"
                  }
                ],
                "entryId": "sample_affixes_suffix_ly_exactly"
              },
              {
                "text": "finally",
                "explains": "adv. 最后",
                "phonetic": "/'faɪnəlɪ/",
                "freq": 622,
                "examples": [
                  {
                    "english": "We finally arrived home.",
                    "chinese": "我们终于到家了。"
                  }
                ],
                "entryId": "sample_affixes_suffix_ly_finally"
              },
              {
                "text": "completely",
                "explains": "adv. 十分，完全地",
                "phonetic": "/kəm'pliːtlɪ/",
                "freq": 770,
                "examples": [
                  {
                    "english": "I completely agree with you.",
                    "chinese": "我完全同意你。"
                  }
                ],
                "entryId": "sample_affixes_suffix_ly_completely"
              },
              {
                "text": "quickly",
                "explains": "adv. 迅速地；很快地",
                "phonetic": "/'kwɪklɪ/",
                "freq": 885,
                "examples": [
                  {
                    "english": "She finished the work quickly.",
                    "chinese": "她很快完成了工作。"
                  }
                ],
                "memoryTip": "quick + -ly。",
                "entryId": "sample_affixes_suffix_ly_quickly"
              },
              {
                "text": "usually",
                "explains": "adv. 通常，经常",
                "phonetic": "/ˈjuːʒʊəlɪ/",
                "freq": 1112,
                "examples": [
                  {
                    "english": "I usually get up at seven.",
                    "chinese": "我通常七点起床。"
                  }
                ],
                "entryId": "sample_affixes_suffix_ly_usually"
              },
              {
                "text": "slowly",
                "explains": "adv. 缓慢地，慢慢地",
                "phonetic": "/'sləʊlɪ/",
                "freq": 1750,
                "examples": [
                  {
                    "english": "Please speak more slowly.",
                    "chinese": "请说慢一点。"
                  }
                ],
                "entryId": "sample_affixes_suffix_ly_slowly"
              },
              {
                "text": "carefully",
                "explains": "adv. 小心地",
                "phonetic": "/'keəfəlɪ/",
                "freq": 2046,
                "examples": [
                  {
                    "english": "She carefully checked the report.",
                    "chinese": "她仔细检查了报告。"
                  }
                ],
                "entryId": "sample_affixes_suffix_ly_carefully"
              }
            ]
          },
          {
            "keyType": "suffix",
            "keyValue": "tion",
            "keyDescription": "名词后缀：动作、状态、结果",
            "note": "动词 + -tion → 名词：educate → education，inform → information，attract → attention。",
            "words": [
              {
                "text": "information",
                "explains": "n. 消息，信息；通知",
                "phonetic": "/ɪnfə'meɪʃ(ə)n/",
                "freq": 778,
                "note": "inform + -ation（名词后缀）→ 信息",
                "examples": [
                  {
                    "english": "I need more information.",
                    "chinese": "我需要更多信息。"
                  }
                ],
                "memoryTip": "in + form：把内容放进头脑形成形状。",
                "entryId": "sample_affixes_suffix_tion_information"
              },
              {
                "text": "attention",
                "explains": "n. 注意，留心；注意力",
                "phonetic": "/ə'tenʃ(ə)n/",
                "freq": 845,
                "examples": [
                  {
                    "english": "Please pay attention to the details.",
                    "chinese": "请注意细节。"
                  }
                ],
                "entryId": "sample_affixes_suffix_tion_attention"
              },
              {
                "text": "action",
                "explains": "n. 行动；作用；功能",
                "phonetic": "/'ækʃ(ə)n/",
                "freq": 1175,
                "note": "act + -ion（名词后缀）→ 行动/作用",
                "examples": [
                  {
                    "english": "We need action, not just words.",
                    "chinese": "我们需要行动，而不只是空话。"
                  }
                ],
                "memoryTip": "act + -ion → 做出来的事。",
                "entryId": "sample_affixes_suffix_tion_action"
              },
              {
                "text": "operation",
                "explains": "n. 手术；操作；运算",
                "phonetic": "/ɒpə'reɪʃ(ə)n/",
                "freq": 1498,
                "examples": [
                  {
                    "english": "The operation was successful.",
                    "chinese": "手术很成功。"
                  }
                ],
                "entryId": "sample_affixes_suffix_tion_operation"
              },
              {
                "text": "condition",
                "explains": "n. 状况，状态；环境",
                "phonetic": "/kən'dɪʃ(ə)n/",
                "freq": 1595,
                "examples": [
                  {
                    "english": "The car is in good condition.",
                    "chinese": "这辆车状况良好。"
                  }
                ],
                "entryId": "sample_affixes_suffix_tion_condition"
              },
              {
                "text": "solution",
                "explains": "n. 解决，解答；溶解",
                "phonetic": "/sə'luːʃ(ə)n/",
                "freq": 2430,
                "examples": [
                  {
                    "english": "We found a simple solution.",
                    "chinese": "我们找到了一个简单的解决办法。"
                  }
                ],
                "entryId": "sample_affixes_suffix_tion_solution"
              },
              {
                "text": "education",
                "explains": "n. 教育；训导",
                "phonetic": "/edjʊ'keɪʃ(ə)n/",
                "freq": 2609,
                "examples": [
                  {
                    "english": "Education changes lives.",
                    "chinese": "教育改变生活。"
                  }
                ],
                "entryId": "sample_affixes_suffix_tion_education"
              },
              {
                "text": "population",
                "explains": "n. 人口；全体居民",
                "phonetic": "/pɒpjʊ'leɪʃ(ə)n/",
                "freq": 3645,
                "examples": [
                  {
                    "english": "The population is growing.",
                    "chinese": "人口在增长。"
                  }
                ],
                "entryId": "sample_affixes_suffix_tion_population"
              }
            ]
          },
          {
            "keyType": "suffix",
            "keyValue": "able",
            "keyDescription": "形容词后缀：可…的",
            "note": "动词 + -able → 形容词“可…的”：read → readable，comfort → comfortable，rely → reliable。",
            "words": [
              {
                "text": "comfortable",
                "explains": "adj. 舒适的",
                "phonetic": "/ˈkʌmftəbl/",
                "freq": 1612,
                "examples": [
                  {
                    "english": "This chair is very comfortable.",
                    "chinese": "这把椅子很舒服。"
                  }
                ],
                "memoryTip": "comfort + -able。",
                "entryId": "sample_affixes_suffix_able_comfortable"
              },
              {
                "text": "available",
                "explains": "adj. 可利用的",
                "phonetic": "/ə'veɪləb(ə)l/",
                "freq": 2202,
                "examples": [
                  {
                    "english": "The room is available now.",
                    "chinese": "房间现在可用。"
                  }
                ],
                "entryId": "sample_affixes_suffix_able_available"
              },
              {
                "text": "reasonable",
                "explains": "adj. 合情合理的；公道的",
                "phonetic": "/'riːz(ə)nəb(ə)l/",
                "freq": 3312,
                "examples": [
                  {
                    "english": "The price is reasonable.",
                    "chinese": "价格合理。"
                  }
                ],
                "entryId": "sample_affixes_suffix_able_reasonable"
              },
              {
                "text": "remarkable",
                "explains": "adj. 异常的，非凡的",
                "phonetic": "/rɪ'mɑːkəb(ə)l/",
                "freq": 3934,
                "examples": [
                  {
                    "english": "She made remarkable progress.",
                    "chinese": "她取得了显著进步。"
                  }
                ],
                "entryId": "sample_affixes_suffix_able_remarkable"
              },
              {
                "text": "reliable",
                "explains": "adj. 可靠的，可信赖的",
                "phonetic": "/rɪ'laɪəb(ə)l/",
                "freq": 5867,
                "examples": [
                  {
                    "english": "This car is very reliable.",
                    "chinese": "这辆车很可靠。"
                  }
                ],
                "entryId": "sample_affixes_suffix_able_reliable"
              },
              {
                "text": "acceptable",
                "explains": "adj. 可接受的，合意的",
                "phonetic": "/ək'septəb(ə)l/",
                "freq": 7396,
                "examples": [
                  {
                    "english": "The result is acceptable.",
                    "chinese": "结果可以接受。"
                  }
                ],
                "entryId": "sample_affixes_suffix_able_acceptable"
              },
              {
                "text": "portable",
                "explains": "adj. 轻便的；手提的",
                "phonetic": "/'pɔːtəb(ə)l/",
                "freq": 11485,
                "note": "port + -able（可…的）→ 可携带的",
                "examples": [
                  {
                    "english": "This speaker is small and portable.",
                    "chinese": "这个音箱小巧便携。"
                  }
                ],
                "memoryTip": "port + -able。",
                "entryId": "sample_affixes_suffix_able_portable"
              }
            ]
          },
          {
            "keyType": "suffix",
            "keyValue": "ible",
            "keyDescription": "形容词后缀：可…的",
            "note": "动词 + -ible → 形容词“可…的”：poss → possible，vis → visible，flex → flexible。",
            "words": [
              {
                "text": "possible",
                "explains": "adj. 可能的；可能存在的",
                "phonetic": "/'pɒsɪb(ə)l/",
                "freq": 598,
                "examples": [
                  {
                    "english": "It is possible to finish today.",
                    "chinese": "今天完成是可能的。"
                  }
                ],
                "memoryTip": "poss + -ible。",
                "entryId": "sample_affixes_suffix_ible_possible"
              },
              {
                "text": "terrible",
                "explains": "adj. 可怕的；极度的",
                "phonetic": "/'terɪb(ə)l/",
                "freq": 799,
                "examples": [
                  {
                    "english": "The weather is terrible today.",
                    "chinese": "今天天气很糟。"
                  }
                ],
                "entryId": "sample_affixes_suffix_ible_terrible"
              },
              {
                "text": "responsible",
                "explains": "adj. 可靠的；责任重大的",
                "phonetic": "/rɪ'spɒnsɪb(ə)l/",
                "freq": 1383,
                "examples": [
                  {
                    "english": "She is responsible for the team.",
                    "chinese": "她负责这个团队。"
                  }
                ],
                "entryId": "sample_affixes_suffix_ible_responsible"
              },
              {
                "text": "sensible",
                "explains": "adj. 明智的；感觉得到的",
                "phonetic": "/'sensɪb(ə)l/",
                "freq": 6116,
                "examples": [
                  {
                    "english": "That was a sensible choice.",
                    "chinese": "那是一个明智的选择。"
                  }
                ],
                "entryId": "sample_affixes_suffix_ible_sensible"
              },
              {
                "text": "visible",
                "explains": "adj. 可见的，看得见的",
                "phonetic": "/ˈvɪzəbl/",
                "freq": 6414,
                "note": "vis（看）+ -ible（可…的）→ 可见的",
                "examples": [
                  {
                    "english": "The mountains are visible today.",
                    "chinese": "今天能看到群山。"
                  }
                ],
                "memoryTip": "vis + -ible。",
                "entryId": "sample_affixes_suffix_ible_visible"
              },
              {
                "text": "flexible",
                "explains": "adj. 易弯曲的；灵活的",
                "phonetic": "/'fleksɪb(ə)l/",
                "freq": 10735,
                "examples": [
                  {
                    "english": "Our schedule is flexible.",
                    "chinese": "我们的日程很灵活。"
                  }
                ],
                "entryId": "sample_affixes_suffix_ible_flexible"
              },
              {
                "text": "feasible",
                "explains": "adj. 可行的；可能的",
                "phonetic": "/'fiːzɪb(ə)l/",
                "freq": 24830,
                "examples": [
                  {
                    "english": "The plan is feasible.",
                    "chinese": "这个计划可行。"
                  }
                ],
                "entryId": "sample_affixes_suffix_ible_feasible"
              }
            ]
          },
          {
            "keyType": "suffix",
            "keyValue": "ness",
            "keyDescription": "名词后缀：性质、状态",
            "note": "形容词 + -ness → 名词：happy → happiness，kind → kindness，dark → darkness。",
            "words": [
              {
                "text": "business",
                "explains": "n. 商业，生意；事务；事务",
                "phonetic": "/ˈbɪznɪs/",
                "freq": 353,
                "examples": [
                  {
                    "english": "He runs a small business.",
                    "chinese": "他经营一家小企业。"
                  }
                ],
                "entryId": "sample_affixes_suffix_ness_business"
              },
              {
                "text": "happiness",
                "explains": "n. 幸福，幸运；快乐",
                "phonetic": "/ˈhæpinəs/",
                "freq": 1712,
                "examples": [
                  {
                    "english": "Money cannot buy happiness.",
                    "chinese": "金钱买不到幸福。"
                  }
                ],
                "memoryTip": "happy + -ness。",
                "entryId": "sample_affixes_suffix_ness_happiness"
              },
              {
                "text": "darkness",
                "explains": "n. 黑暗；模糊；无知；阴郁",
                "phonetic": "/'dɑrknəs/",
                "freq": 2417,
                "examples": [
                  {
                    "english": "The room was in darkness.",
                    "chinese": "房间里一片漆黑。"
                  }
                ],
                "entryId": "sample_affixes_suffix_ness_darkness"
              },
              {
                "text": "illness",
                "explains": "n. 病，疾病",
                "phonetic": "/ˈɪlnəs/",
                "freq": 4171,
                "examples": [
                  {
                    "english": "She missed work because of illness.",
                    "chinese": "她因病没去上班。"
                  }
                ],
                "entryId": "sample_affixes_suffix_ness_illness"
              },
              {
                "text": "weakness",
                "explains": "n. 弱点；虚弱；软弱",
                "phonetic": "/ˈwiːknəs/",
                "freq": 4289,
                "examples": [
                  {
                    "english": "Everyone has a weakness.",
                    "chinese": "每个人都有弱点。"
                  }
                ],
                "entryId": "sample_affixes_suffix_ness_weakness"
              },
              {
                "text": "kindness",
                "explains": "n. 仁慈，好意",
                "phonetic": "/'kaɪn(d)nɪs/",
                "freq": 4883,
                "examples": [
                  {
                    "english": "Thank you for your kindness.",
                    "chinese": "谢谢你的好意。"
                  }
                ],
                "entryId": "sample_affixes_suffix_ness_kindness"
              },
              {
                "text": "consciousness",
                "explains": "n. 意识，觉悟；知觉",
                "phonetic": "/'kɒnʃəsnɪs/",
                "freq": 5098,
                "examples": [
                  {
                    "english": "He lost consciousness for a moment.",
                    "chinese": "他短暂失去了意识。"
                  }
                ],
                "entryId": "sample_affixes_suffix_ness_consciousness"
              }
            ]
          },
          {
            "keyType": "suffix",
            "keyValue": "ment",
            "keyDescription": "名词后缀：行为、结果、手段",
            "note": "动词 + -ment → 名词：develop → development，move → movement，agree → agreement。",
            "words": [
              {
                "text": "government",
                "explains": "n. 政府；治理；政治",
                "phonetic": "/'gʌv(ə)n,m(ə)nt; 'gʌvəm(ə)nt/",
                "freq": 894,
                "examples": [
                  {
                    "english": "The government announced a new policy.",
                    "chinese": "政府宣布了一项新政策。"
                  }
                ],
                "entryId": "sample_affixes_suffix_ment_government"
              },
              {
                "text": "treatment",
                "explains": "n. 待遇；治疗，疗法",
                "phonetic": "/'triːtm(ə)nt/",
                "freq": 2234,
                "examples": [
                  {
                    "english": "The treatment worked well.",
                    "chinese": "治疗效果很好。"
                  }
                ],
                "entryId": "sample_affixes_suffix_ment_treatment"
              },
              {
                "text": "equipment",
                "explains": "n. 装备，设备；配备",
                "phonetic": "/ɪ'kwɪpm(ə)nt/",
                "freq": 2468,
                "examples": [
                  {
                    "english": "The lab has new equipment.",
                    "chinese": "实验室有新设备。"
                  }
                ],
                "entryId": "sample_affixes_suffix_ment_equipment"
              },
              {
                "text": "movement",
                "explains": "n. 动作，活动；移动",
                "phonetic": "/'muːvm(ə)nt/",
                "freq": 2569,
                "examples": [
                  {
                    "english": "The movement of the leaves was gentle.",
                    "chinese": "树叶轻轻摇动。"
                  }
                ],
                "memoryTip": "move + -ment。",
                "entryId": "sample_affixes_suffix_ment_movement"
              },
              {
                "text": "agreement",
                "explains": "n. 协定，协议；同意",
                "phonetic": "/ə'griːm(ə)nt/",
                "freq": 2689,
                "examples": [
                  {
                    "english": "They reached an agreement.",
                    "chinese": "他们达成了协议。"
                  }
                ],
                "entryId": "sample_affixes_suffix_ment_agreement"
              },
              {
                "text": "environment",
                "explains": "n. 环境，外界",
                "phonetic": "/ɪn'vaɪrənm(ə)nt; en-/",
                "freq": 3263,
                "examples": [
                  {
                    "english": "We must protect the environment.",
                    "chinese": "我们必须保护环境。"
                  }
                ],
                "entryId": "sample_affixes_suffix_ment_environment"
              },
              {
                "text": "development",
                "explains": "n. 发展；生长；开发",
                "phonetic": "/dɪ'veləpm(ə)nt/",
                "freq": 3816,
                "examples": [
                  {
                    "english": "The city has seen rapid development.",
                    "chinese": "这座城市发展迅速。"
                  }
                ],
                "entryId": "sample_affixes_suffix_ment_development"
              },
              {
                "text": "management",
                "explains": "n. 管理；经营，处理",
                "phonetic": "/'mænɪdʒm(ə)nt/",
                "freq": 3916,
                "examples": [
                  {
                    "english": "Good management saves time.",
                    "chinese": "良好的管理能节省时间。"
                  }
                ],
                "entryId": "sample_affixes_suffix_ment_management"
              }
            ]
          },
          {
            "keyType": "suffix",
            "keyValue": "ity",
            "keyDescription": "名词后缀：性质、状态、程度",
            "note": "形容词 + -ity → 名词：able → ability，real → reality，possible → possibility。",
            "words": [
              {
                "text": "security",
                "explains": "n. 安全工作；安全；安全感",
                "phonetic": "/sɪ'kjʊərətɪ/",
                "freq": 781,
                "examples": [
                  {
                    "english": "Airport security is strict.",
                    "chinese": "机场安检很严格。"
                  }
                ],
                "entryId": "sample_affixes_suffix_ity_security"
              },
              {
                "text": "opportunity",
                "explains": "n. 机会，良机",
                "phonetic": "/ɒpə'tjuːnɪtɪ/",
                "freq": 1386,
                "examples": [
                  {
                    "english": "This is a good opportunity.",
                    "chinese": "这是一个好机会。"
                  }
                ],
                "entryId": "sample_affixes_suffix_ity_opportunity"
              },
              {
                "text": "reality",
                "explains": "n. 现实；真实",
                "phonetic": "/rɪ'ælɪtɪ/",
                "freq": 1845,
                "examples": [
                  {
                    "english": "The reality is more complex.",
                    "chinese": "现实更复杂。"
                  }
                ],
                "entryId": "sample_affixes_suffix_ity_reality"
              },
              {
                "text": "ability",
                "explains": "n. 能力；能耐；本领",
                "phonetic": "/ə'bɪlɪtɪ/",
                "freq": 2692,
                "examples": [
                  {
                    "english": "She has the ability to learn fast.",
                    "chinese": "她有快速学习的能力。"
                  }
                ],
                "memoryTip": "able + -ity。",
                "entryId": "sample_affixes_suffix_ity_ability"
              },
              {
                "text": "quality",
                "explains": "n. 质量；品质；特性",
                "phonetic": "/'kwɒlɪtɪ/",
                "freq": 2818,
                "examples": [
                  {
                    "english": "This product has good quality.",
                    "chinese": "这个产品质量很好。"
                  }
                ],
                "entryId": "sample_affixes_suffix_ity_quality"
              },
              {
                "text": "possibility",
                "explains": "n. 可能；可能的事",
                "phonetic": "/,pɒsɪ'bɪlɪtɪ/",
                "freq": 2879,
                "examples": [
                  {
                    "english": "There is a possibility of rain.",
                    "chinese": "有下雨的可能。"
                  }
                ],
                "entryId": "sample_affixes_suffix_ity_possibility"
              },
              {
                "text": "electricity",
                "explains": "n. 电，电学；电流",
                "phonetic": "/,ɪlek'trɪsɪtɪ; ,el-; ,iːl-/",
                "freq": 3117,
                "examples": [
                  {
                    "english": "The storm cut off electricity.",
                    "chinese": "风暴切断了电力。"
                  }
                ],
                "entryId": "sample_affixes_suffix_ity_electricity"
              },
              {
                "text": "activity",
                "explains": "n. 活动；活力；行动",
                "phonetic": "/æk'tɪvɪtɪ/",
                "freq": 3377,
                "note": "active + -ity（名词后缀）→ 活动",
                "examples": [
                  {
                    "english": "The school offers many activities.",
                    "chinese": "学校提供许多活动。"
                  }
                ],
                "memoryTip": "active + -ity → 活动。",
                "entryId": "sample_affixes_suffix_ity_activity"
              }
            ]
          },
          {
            "keyType": "suffix",
            "keyValue": "ful",
            "keyDescription": "形容词后缀：充满…的",
            "note": "名词 + -ful → 形容词“充满…的”：care → careful，help → helpful，beauty → beautiful。",
            "words": [
              {
                "text": "beautiful",
                "explains": "adj. 美的，美丽的",
                "phonetic": "/'bjuːtɪfʊl; -f(ə)l/",
                "freq": 370,
                "examples": [
                  {
                    "english": "The garden is beautiful.",
                    "chinese": "花园很美。"
                  }
                ],
                "entryId": "sample_affixes_suffix_ful_beautiful"
              },
              {
                "text": "careful",
                "explains": "adj. 仔细的；细致的",
                "phonetic": "/'keəfʊl; -f(ə)l/",
                "freq": 665,
                "examples": [
                  {
                    "english": "Be careful with the glass.",
                    "chinese": "小心玻璃。"
                  }
                ],
                "memoryTip": "care + -ful。",
                "entryId": "sample_affixes_suffix_ful_careful"
              },
              {
                "text": "wonderful",
                "explains": "adj. 极好的，精彩的，绝妙的；奇妙的；美妙；胜；神妙",
                "phonetic": "/'wʌndəfʊl; -f(ə)l/",
                "freq": 686,
                "examples": [
                  {
                    "english": "We had a wonderful time.",
                    "chinese": "我们度过了一段美好时光。"
                  }
                ],
                "entryId": "sample_affixes_suffix_ful_wonderful"
              },
              {
                "text": "powerful",
                "explains": "adj. 有权威的；强有力的",
                "phonetic": "/'paʊəfʊl; -f(ə)l/",
                "freq": 1474,
                "examples": [
                  {
                    "english": "The engine is very powerful.",
                    "chinese": "发动机非常强劲。"
                  }
                ],
                "entryId": "sample_affixes_suffix_ful_powerful"
              },
              {
                "text": "grateful",
                "explains": "adj. 感激的",
                "phonetic": "/'greɪtfʊl; -f(ə)l/",
                "freq": 2239,
                "examples": [
                  {
                    "english": "I am grateful for your help.",
                    "chinese": "我很感激你的帮助。"
                  }
                ],
                "entryId": "sample_affixes_suffix_ful_grateful"
              },
              {
                "text": "useful",
                "explains": "adj. 有用的，有益的；有帮助的",
                "phonetic": "/'juːsfʊl; -f(ə)l/",
                "freq": 2708,
                "examples": [
                  {
                    "english": "This tool is useful.",
                    "chinese": "这个工具很有用。"
                  }
                ],
                "entryId": "sample_affixes_suffix_ful_useful"
              },
              {
                "text": "helpful",
                "explains": "adj. 给予帮助的；有用的",
                "phonetic": "/'helpfʊl; -f(ə)l/",
                "freq": 3716,
                "examples": [
                  {
                    "english": "Your advice was very helpful.",
                    "chinese": "你的建议很有帮助。"
                  }
                ],
                "entryId": "sample_affixes_suffix_ful_helpful"
              }
            ]
          },
          {
            "keyType": "suffix",
            "keyValue": "less",
            "keyDescription": "形容词后缀：无…的",
            "note": "名词 + -less → 形容词“无…的”：hope → hopeless，care → careless，end → endless。",
            "words": [
              {
                "text": "useless",
                "explains": "adj. 无用的；无效的",
                "phonetic": "/ˈju:sləs/",
                "freq": 2060,
                "examples": [
                  {
                    "english": "This old phone is useless.",
                    "chinese": "这部旧手机没用了。"
                  }
                ],
                "entryId": "sample_affixes_suffix_less_useless"
              },
              {
                "text": "homeless",
                "explains": "adj. 无家可归的",
                "phonetic": "/'həʊmlɪs/",
                "freq": 4069,
                "examples": [
                  {
                    "english": "The charity helps homeless people.",
                    "chinese": "这家慈善机构帮助无家可归的人。"
                  }
                ],
                "entryId": "sample_affixes_suffix_less_homeless"
              },
              {
                "text": "hopeless",
                "explains": "adj. 没有希望的；绝望的",
                "phonetic": "/'həʊpləs/",
                "freq": 4749,
                "examples": [
                  {
                    "english": "The situation seems hopeless.",
                    "chinese": "情况似乎没有希望。"
                  }
                ],
                "entryId": "sample_affixes_suffix_less_hopeless"
              },
              {
                "text": "helpless",
                "explains": "adj. 无助的；无能的",
                "phonetic": "/'helplɪs/",
                "freq": 5042,
                "examples": [
                  {
                    "english": "The baby is helpless.",
                    "chinese": "婴儿很无助。"
                  }
                ],
                "entryId": "sample_affixes_suffix_less_helpless"
              },
              {
                "text": "endless",
                "explains": "adj. 无止境的",
                "phonetic": "/'endlɪs/",
                "freq": 5191,
                "examples": [
                  {
                    "english": "The road seemed endless.",
                    "chinese": "这条路似乎没有尽头。"
                  }
                ],
                "entryId": "sample_affixes_suffix_less_endless"
              },
              {
                "text": "regardless",
                "explains": "adv. 不顾一切地",
                "phonetic": "/rɪ'gɑːdlɪs/",
                "freq": 6133,
                "examples": [
                  {
                    "english": "He went out regardless of the rain.",
                    "chinese": "他不顾下雨出去了。"
                  }
                ],
                "entryId": "sample_affixes_suffix_less_regardless"
              },
              {
                "text": "careless",
                "explains": "adj. 粗心的；漫不经心的",
                "phonetic": "/'keələs/",
                "freq": 7706,
                "examples": [
                  {
                    "english": "A careless mistake cost him the game.",
                    "chinese": "一个粗心的错误让他输了比赛。"
                  }
                ],
                "memoryTip": "care + -less。",
                "entryId": "sample_affixes_suffix_less_careless"
              }
            ]
          },
          {
            "keyType": "suffix",
            "keyValue": "ive",
            "keyDescription": "形容词后缀：有…性质的",
            "note": "动词 + -ive → 形容词“有…性质的”：act → active，create → creative，attract → attractive。",
            "words": [
              {
                "text": "expensive",
                "explains": "adj. 昂贵的，花钱多的",
                "phonetic": "/ɪk'spensɪv; ek-/",
                "freq": 1873,
                "examples": [
                  {
                    "english": "The watch is too expensive.",
                    "chinese": "这块表太贵了。"
                  }
                ],
                "entryId": "sample_affixes_suffix_ive_expensive"
              },
              {
                "text": "positive",
                "explains": "adj. 积极的；确定的",
                "phonetic": "/'pɒzɪtɪv/",
                "freq": 2051,
                "examples": [
                  {
                    "english": "Keep a positive attitude.",
                    "chinese": "保持积极的态度。"
                  }
                ],
                "entryId": "sample_affixes_suffix_ive_positive"
              },
              {
                "text": "negative",
                "explains": "adj. 否定的；消极的",
                "phonetic": "/'negətɪv/",
                "freq": 2532,
                "examples": [
                  {
                    "english": "The test result was negative.",
                    "chinese": "检测结果是阴性。"
                  }
                ],
                "entryId": "sample_affixes_suffix_ive_negative"
              },
              {
                "text": "attractive",
                "explains": "adj. 有吸引力的",
                "phonetic": "/ə'træktɪv/",
                "freq": 3084,
                "note": "attract + -ive（形容词后缀）→ 有吸引力的",
                "examples": [
                  {
                    "english": "The offer is very attractive.",
                    "chinese": "这个提议很有吸引力。"
                  }
                ],
                "memoryTip": "attract + -ive。",
                "entryId": "sample_affixes_suffix_ive_attractive"
              },
              {
                "text": "active",
                "explains": "adj. 活跃的；积极的",
                "phonetic": "/'æktɪv/",
                "freq": 3752,
                "note": "act + -ive（形容词后缀）→ 活跃的",
                "examples": [
                  {
                    "english": "She stays active every day.",
                    "chinese": "她每天都很活跃。"
                  }
                ],
                "memoryTip": "act + -ive → 活跃的。",
                "entryId": "sample_affixes_suffix_ive_active"
              },
              {
                "text": "effective",
                "explains": "adj. 有效的；有影响的",
                "phonetic": "/ɪ'fektɪv/",
                "freq": 4098,
                "examples": [
                  {
                    "english": "This medicine is effective.",
                    "chinese": "这种药很有效。"
                  }
                ],
                "entryId": "sample_affixes_suffix_ive_effective"
              },
              {
                "text": "creative",
                "explains": "adj. 创造性的，创作的",
                "phonetic": "/kriː'eɪtɪv/",
                "freq": 4141,
                "examples": [
                  {
                    "english": "She is a creative designer.",
                    "chinese": "她是一位有创意的设计师。"
                  }
                ],
                "entryId": "sample_affixes_suffix_ive_creative"
              }
            ]
          },
          {
            "keyType": "suffix",
            "keyValue": "ous",
            "keyDescription": "形容词后缀：具有…的",
            "note": "名词 + -ous → 形容词“具有…的”：danger → dangerous，fame → famous，nerve → nervous。",
            "words": [
              {
                "text": "serious",
                "explains": "adj. 严肃的，严重的；认真的；庄重的；危急的",
                "phonetic": "/'sɪərɪəs/",
                "freq": 588,
                "examples": [
                  {
                    "english": "This is a serious problem.",
                    "chinese": "这是一个严重的问题。"
                  }
                ],
                "entryId": "sample_affixes_suffix_ous_serious"
              },
              {
                "text": "dangerous",
                "explains": "adj. 危险的，不安全的",
                "phonetic": "/'deɪn(d)ʒ(ə)rəs/",
                "freq": 834,
                "examples": [
                  {
                    "english": "It is dangerous to swim here.",
                    "chinese": "在这里游泳很危险。"
                  }
                ],
                "memoryTip": "danger + -ous。",
                "entryId": "sample_affixes_suffix_ous_dangerous"
              },
              {
                "text": "nervous",
                "explains": "adj. 神经的；易激动的",
                "phonetic": "/'nɜːvəs/",
                "freq": 1148,
                "examples": [
                  {
                    "english": "She felt nervous before the exam.",
                    "chinese": "考试前她感到紧张。"
                  }
                ],
                "entryId": "sample_affixes_suffix_ous_nervous"
              },
              {
                "text": "famous",
                "explains": "adj. 著名的，出名的",
                "phonetic": "/'feɪməs/",
                "freq": 1353,
                "examples": [
                  {
                    "english": "He is a famous writer.",
                    "chinese": "他是一位著名作家。"
                  }
                ],
                "entryId": "sample_affixes_suffix_ous_famous"
              },
              {
                "text": "obvious",
                "explains": "adj. 明显的，显而易见的",
                "phonetic": "/'ɒbvɪəs/",
                "freq": 1920,
                "examples": [
                  {
                    "english": "The answer is obvious.",
                    "chinese": "答案很明显。"
                  }
                ],
                "entryId": "sample_affixes_suffix_ous_obvious"
              },
              {
                "text": "curious",
                "explains": "adj. 好奇的；稀奇古怪的",
                "phonetic": "/'kjʊərɪəs/",
                "freq": 2272,
                "examples": [
                  {
                    "english": "The child is curious about everything.",
                    "chinese": "这个孩子对一切都好奇。"
                  }
                ],
                "entryId": "sample_affixes_suffix_ous_curious"
              },
              {
                "text": "various",
                "explains": "adj. 各种各样的，不同的",
                "phonetic": "/'veərɪəs/",
                "freq": 4144,
                "examples": [
                  {
                    "english": "The shop sells various gifts.",
                    "chinese": "这家店卖各种礼物。"
                  }
                ],
                "entryId": "sample_affixes_suffix_ous_various"
              }
            ]
          },
          {
            "keyType": "suffix",
            "keyValue": "ize",
            "keyDescription": "动词后缀：使…化",
            "note": "形容词/名词 + -ize → 动词“使…化”：real → realize，organ → organize，modern → modernize。",
            "words": [
              {
                "text": "realize",
                "explains": "v. 认识到；实现",
                "phonetic": "/'riːəlaɪz/",
                "freq": 994,
                "examples": [
                  {
                    "english": "I realized my mistake at once.",
                    "chinese": "我立刻意识到了错误。"
                  }
                ],
                "memoryTip": "real + -ize。",
                "entryId": "sample_affixes_suffix_ize_realize"
              },
              {
                "text": "apologize",
                "explains": "v. 道歉，谢罪，认错",
                "phonetic": "/ə'pɒlədʒaɪz/",
                "freq": 1419,
                "examples": [
                  {
                    "english": "You should apologize to her.",
                    "chinese": "你应该向她道歉。"
                  }
                ],
                "entryId": "sample_affixes_suffix_ize_apologize"
              },
              {
                "text": "recognize",
                "explains": "v. 认识，认出；承认",
                "phonetic": "/'rekəɡnaɪz/",
                "freq": 1603,
                "examples": [
                  {
                    "english": "I did not recognize him.",
                    "chinese": "我没认出他。"
                  }
                ],
                "entryId": "sample_affixes_suffix_ize_recognize"
              },
              {
                "text": "organize",
                "explains": "v. 组织；编组",
                "phonetic": "/ˈɔ:gənaɪz/",
                "freq": 7023,
                "examples": [
                  {
                    "english": "They organized a meeting.",
                    "chinese": "他们组织了一次会议。"
                  }
                ],
                "entryId": "sample_affixes_suffix_ize_organize"
              },
              {
                "text": "criticize",
                "explains": "v. 批评；非难；评论",
                "phonetic": "/'krɪtɪsaɪz/",
                "freq": 11977,
                "examples": [
                  {
                    "english": "Do not criticize others too quickly.",
                    "chinese": "不要急于批评别人。"
                  }
                ],
                "entryId": "sample_affixes_suffix_ize_criticize"
              },
              {
                "text": "emphasize",
                "explains": "v. 强调，着重",
                "phonetic": "/'emfəsaɪz/",
                "freq": 20253,
                "examples": [
                  {
                    "english": "He emphasized the main point.",
                    "chinese": "他强调了重点。"
                  }
                ],
                "entryId": "sample_affixes_suffix_ize_emphasize"
              },
              {
                "text": "summarize",
                "explains": "v. 概括，概述，总结",
                "phonetic": "/'sʌməraiz/",
                "freq": 27621,
                "examples": [
                  {
                    "english": "Please summarize the article.",
                    "chinese": "请总结这篇文章。"
                  }
                ],
                "entryId": "sample_affixes_suffix_ize_summarize"
              }
            ]
          }
        ]
      }
    ]
  },
  {
    "name": "拼写组合册",
    "desc": "按元音、辅音、特殊拼写分章，先高频组合，再特殊规则",
    "chapters": [
      {
        "name": "元音组合",
        "pages": [
          {
            "keyType": "letters",
            "keyValue": "ea",
            "keyDescription": "🦅 eagle / 🌊 sea / 🍽️ eat",
            "note": "ea 最常见的读音是 /iː/：sea、eat、tea；也有 /e/（bread）和 /eɪ/（great）等例外。",
            "words": [
              {
                "text": "eat",
                "explains": "v. 吃",
                "phonetic": "/iːt/",
                "freq": 373,
                "examples": [
                  {
                    "english": "We eat dinner at seven.",
                    "chinese": "我们七点吃晚饭。"
                  }
                ],
                "entryId": "sample_spelling_vowels_ea_eat"
              },
              {
                "text": "dream",
                "explains": "n. 梦；梦想；v. 做梦",
                "phonetic": "/driːm/",
                "freq": 644,
                "examples": [
                  {
                    "english": "I had a strange dream.",
                    "chinese": "我做了一个奇怪的梦。"
                  }
                ],
                "entryId": "sample_spelling_vowels_ea_dream"
              },
              {
                "text": "clean",
                "explains": "adj. 清洁的；纯洁的",
                "phonetic": "/kliːn/",
                "freq": 696,
                "examples": [
                  {
                    "english": "Please keep the room clean.",
                    "chinese": "请保持房间干净。"
                  }
                ],
                "entryId": "sample_spelling_vowels_ea_clean"
              },
              {
                "text": "sea",
                "explains": "n. 海；海洋；许多；大量",
                "phonetic": "/siː/",
                "freq": 902,
                "examples": [
                  {
                    "english": "The sea is calm today.",
                    "chinese": "今天海面平静。"
                  }
                ],
                "entryId": "sample_spelling_vowels_ea_sea"
              },
              {
                "text": "tea",
                "explains": "n. 茶叶；茶树；茶点；vt. 给…沏茶；vi. 喝茶；进茶点",
                "phonetic": "/tiː/",
                "freq": 928,
                "examples": [
                  {
                    "english": "She drinks tea every morning.",
                    "chinese": "她每天早上喝茶。"
                  }
                ],
                "entryId": "sample_spelling_vowels_ea_tea"
              },
              {
                "text": "teach",
                "explains": "v. 教；教授；教导；n. (Teach)人名；(英)蒂奇",
                "phonetic": "/tiːtʃ/",
                "freq": 1020,
                "examples": [
                  {
                    "english": "I teach English at school.",
                    "chinese": "我在学校教英语。"
                  }
                ],
                "entryId": "sample_spelling_vowels_ea_teach"
              },
              {
                "text": "beach",
                "explains": "n. 海滩，湖滩，河滩",
                "phonetic": "/biːtʃ/",
                "freq": 1378,
                "examples": [
                  {
                    "english": "We walked along the beach.",
                    "chinese": "我们沿着海滩散步。"
                  }
                ],
                "entryId": "sample_spelling_vowels_ea_beach"
              },
              {
                "text": "meat",
                "explains": "n. 肉",
                "phonetic": "/miːt/",
                "freq": 1503,
                "examples": [
                  {
                    "english": "He does not eat meat.",
                    "chinese": "他不吃肉。"
                  }
                ],
                "entryId": "sample_spelling_vowels_ea_meat"
              }
            ]
          },
          {
            "keyType": "letters",
            "keyValue": "ou",
            "keyDescription": "🏠 house / 🐭 mouse / 👄 mouth",
            "note": "ou 常读 /aʊ/：house、mouse、out；在 could、course 中读音不同。",
            "words": [
              {
                "text": "out",
                "explains": "adv. 出，在外；现出来",
                "phonetic": "/aʊt/",
                "freq": 50,
                "examples": [
                  {
                    "english": "They went out for lunch.",
                    "chinese": "他们出去吃午饭。"
                  }
                ],
                "entryId": "sample_spelling_vowels_ou_out"
              },
              {
                "text": "about",
                "explains": "prep. 关于；在…周围",
                "phonetic": "/ə'baʊt/",
                "freq": 51,
                "examples": [
                  {
                    "english": "Tell me about your day.",
                    "chinese": "跟我说说你的一天。"
                  }
                ],
                "entryId": "sample_spelling_vowels_ou_about"
              },
              {
                "text": "around",
                "explains": "prep. 在…周围",
                "phonetic": "/ə'raʊnd/",
                "freq": 187,
                "examples": [
                  {
                    "english": "We walked around the lake.",
                    "chinese": "我们绕着湖走了一圈。"
                  }
                ],
                "entryId": "sample_spelling_vowels_ou_around"
              },
              {
                "text": "house",
                "explains": "n. 房屋，住宅；商号",
                "phonetic": "/haʊs/",
                "freq": 213,
                "examples": [
                  {
                    "english": "They live in a small house.",
                    "chinese": "他们住在一栋小房子里。"
                  }
                ],
                "entryId": "sample_spelling_vowels_ou_house"
              },
              {
                "text": "mouth",
                "explains": "n. 嘴，口，口腔",
                "phonetic": "/maʊθ/",
                "freq": 771,
                "examples": [
                  {
                    "english": "Open your mouth, please.",
                    "chinese": "请张开嘴。"
                  }
                ],
                "entryId": "sample_spelling_vowels_ou_mouth"
              },
              {
                "text": "shout",
                "explains": "v. 呼喊；喊叫；大声说；n. 呼喊；呼叫",
                "phonetic": "/ʃaʊt/",
                "freq": 2926,
                "examples": [
                  {
                    "english": "Do not shout in the library.",
                    "chinese": "不要在图书馆大喊。"
                  }
                ],
                "entryId": "sample_spelling_vowels_ou_shout"
              },
              {
                "text": "mouse",
                "explains": "n. 鼠，耗子",
                "phonetic": "/maʊs/",
                "freq": 3361,
                "examples": [
                  {
                    "english": "The cat caught a mouse.",
                    "chinese": "猫抓住了一只老鼠。"
                  }
                ],
                "entryId": "sample_spelling_vowels_ou_mouse"
              },
              {
                "text": "cloud",
                "explains": "n. 云；云状物；阴影",
                "phonetic": "/klaʊd/",
                "freq": 3479,
                "examples": [
                  {
                    "english": "A dark cloud covered the sun.",
                    "chinese": "一片乌云遮住了太阳。"
                  }
                ],
                "entryId": "sample_spelling_vowels_ou_cloud"
              }
            ]
          },
          {
            "keyType": "letters",
            "keyValue": "ai",
            "keyDescription": "🌧️ rain / 🚂 train / 🐌 snail",
            "note": "ai 通常读 /eɪ/：rain、train、wait。",
            "words": [
              {
                "text": "wait",
                "explains": "v. 等候；推迟；延缓；n. 等待；等候",
                "phonetic": "/weɪt/",
                "freq": 159,
                "examples": [
                  {
                    "english": "Please wait for me here.",
                    "chinese": "请在这里等我。"
                  }
                ],
                "entryId": "sample_spelling_vowels_ai_wait"
              },
              {
                "text": "explain",
                "explains": "v. 解释；为…辩解",
                "phonetic": "/ɪk'spleɪn/",
                "freq": 695,
                "examples": [
                  {
                    "english": "Can you explain the rule?",
                    "chinese": "你能解释这条规则吗？"
                  }
                ],
                "entryId": "sample_spelling_vowels_ai_explain"
              },
              {
                "text": "train",
                "explains": "n. 火车；行列；长队；裙裾；v. 培养；训练；瞄准",
                "phonetic": "/treɪn/",
                "freq": 787,
                "examples": [
                  {
                    "english": "The train leaves at nine.",
                    "chinese": "火车九点出发。"
                  }
                ],
                "entryId": "sample_spelling_vowels_ai_train"
              },
              {
                "text": "rain",
                "explains": "n. 雨，雨水；v. 下雨",
                "phonetic": "/reɪn/",
                "freq": 1358,
                "examples": [
                  {
                    "english": "It began to rain.",
                    "chinese": "开始下雨了。"
                  }
                ],
                "entryId": "sample_spelling_vowels_ai_rain"
              },
              {
                "text": "paint",
                "explains": "v. （给…）上油漆；画，绘画",
                "phonetic": "/peɪnt/",
                "freq": 1799,
                "examples": [
                  {
                    "english": "They painted the wall blue.",
                    "chinese": "他们把墙刷成了蓝色。"
                  }
                ],
                "entryId": "sample_spelling_vowels_ai_paint"
              },
              {
                "text": "mail",
                "explains": "n. 邮件；v. 邮寄",
                "phonetic": "/meɪl/",
                "freq": 2173,
                "examples": [
                  {
                    "english": "I sent the letter by mail.",
                    "chinese": "我把信寄了出去。"
                  }
                ],
                "entryId": "sample_spelling_vowels_ai_mail"
              },
              {
                "text": "tail",
                "explains": "n. 尾巴；踪迹；辫子；燕尾服；v. 尾随；装上尾巴；adj. 从后面而来的；尾部的",
                "phonetic": "/teɪl/",
                "freq": 2607,
                "examples": [
                  {
                    "english": "The dog wagged its tail.",
                    "chinese": "狗摇了摇尾巴。"
                  }
                ],
                "entryId": "sample_spelling_vowels_ai_tail"
              },
              {
                "text": "snail",
                "explains": "n. 蜗牛；行动缓慢的人",
                "phonetic": "/sneɪl/",
                "freq": 13754,
                "examples": [
                  {
                    "english": "A snail moves very slowly.",
                    "chinese": "蜗牛爬得很慢。"
                  }
                ],
                "entryId": "sample_spelling_vowels_ai_snail"
              }
            ]
          },
          {
            "keyType": "letters",
            "keyValue": "ee",
            "keyDescription": "🐝 bee / 🌳 tree / 🦶 feet",
            "note": "ee 通常读 /iː/：bee、tree、see。",
            "words": [
              {
                "text": "see",
                "explains": "v. 看见；理解；领会；n. (See)人名；(英)西伊；(柬)塞；(德)泽",
                "phonetic": "/siː/",
                "freq": 69,
                "examples": [
                  {
                    "english": "I can see the mountains.",
                    "chinese": "我能看见群山。"
                  }
                ],
                "entryId": "sample_spelling_vowels_ee_see"
              },
              {
                "text": "need",
                "explains": "v. 需要",
                "phonetic": "/niːd/",
                "freq": 107,
                "examples": [
                  {
                    "english": "We need more time.",
                    "chinese": "我们需要更多时间。"
                  }
                ],
                "entryId": "sample_spelling_vowels_ee_need"
              },
              {
                "text": "keep",
                "explains": "v. 保持；坚持",
                "phonetic": "/kiːp/",
                "freq": 181,
                "examples": [
                  {
                    "english": "Please keep the door closed.",
                    "chinese": "请保持门关着。"
                  }
                ],
                "entryId": "sample_spelling_vowels_ee_keep"
              },
              {
                "text": "feel",
                "explains": "v. 有知觉；触，摸",
                "phonetic": "/fiːl/",
                "freq": 192,
                "examples": [
                  {
                    "english": "I feel much better today.",
                    "chinese": "我今天感觉好多了。"
                  }
                ],
                "entryId": "sample_spelling_vowels_ee_feel"
              },
              {
                "text": "meet",
                "explains": "v. 遇见",
                "phonetic": "/miːt/",
                "freq": 318,
                "examples": [
                  {
                    "english": "Let us meet after class.",
                    "chinese": "我们下课后见。"
                  }
                ],
                "entryId": "sample_spelling_vowels_ee_meet"
              },
              {
                "text": "week",
                "explains": "n. 周，星期",
                "phonetic": "/wiːk/",
                "freq": 450,
                "examples": [
                  {
                    "english": "We have a test this week.",
                    "chinese": "我们这周有考试。"
                  }
                ],
                "entryId": "sample_spelling_vowels_ee_week"
              },
              {
                "text": "tree",
                "explains": "n. 树；木料；树状物；v. 把赶上树",
                "phonetic": "/triː/",
                "freq": 1072,
                "examples": [
                  {
                    "english": "A bird sat in the tree.",
                    "chinese": "一只鸟停在树上。"
                  }
                ],
                "entryId": "sample_spelling_vowels_ee_tree"
              },
              {
                "text": "bee",
                "explains": "n. 蜂，密蜂；忙碌的人",
                "phonetic": "/biː/",
                "freq": 3967,
                "examples": [
                  {
                    "english": "A bee flew into the room.",
                    "chinese": "一只蜜蜂飞进了房间。"
                  }
                ],
                "entryId": "sample_spelling_vowels_ee_bee"
              }
            ]
          },
          {
            "keyType": "letters",
            "keyValue": "ow",
            "keyDescription": "🐄 cow / ❄️ snow",
            "note": "ow 可读 /aʊ/（cow、now）或 /əʊ/（snow、window）。",
            "words": [
              {
                "text": "now",
                "explains": "adv. 现在；立刻",
                "phonetic": "/naʊ/",
                "freq": 55,
                "examples": [
                  {
                    "english": "We should leave now.",
                    "chinese": "我们现在应该走了。"
                  }
                ],
                "entryId": "sample_spelling_vowels_ow_now"
              },
              {
                "text": "how",
                "explains": "adv. 怎么；怎样；多少",
                "phonetic": "/haʊ/",
                "freq": 61,
                "examples": [
                  {
                    "english": "How did you solve it?",
                    "chinese": "你是怎么解决的？"
                  }
                ],
                "entryId": "sample_spelling_vowels_ow_how"
              },
              {
                "text": "down",
                "explains": "adv. 向下；在下面",
                "phonetic": "/daʊn/",
                "freq": 113,
                "examples": [
                  {
                    "english": "She walked down the stairs.",
                    "chinese": "她走下楼梯。"
                  }
                ],
                "entryId": "sample_spelling_vowels_ow_down"
              },
              {
                "text": "town",
                "explains": "n. 城镇，市镇；市内商业区",
                "phonetic": "/taʊn/",
                "freq": 490,
                "examples": [
                  {
                    "english": "The town is quiet at night.",
                    "chinese": "这个小镇晚上很安静。"
                  }
                ],
                "entryId": "sample_spelling_vowels_ow_town"
              },
              {
                "text": "power",
                "explains": "n. 能力；力；权；幂",
                "phonetic": "/'paʊə/",
                "freq": 508,
                "examples": [
                  {
                    "english": "The storm cut off the power.",
                    "chinese": "风暴切断了电力。"
                  }
                ],
                "entryId": "sample_spelling_vowels_ow_power"
              },
              {
                "text": "brown",
                "explains": "n. 褐色，棕色",
                "phonetic": "/braʊn/",
                "freq": 1602,
                "examples": [
                  {
                    "english": "He wore a brown coat.",
                    "chinese": "他穿着一件棕色外套。"
                  }
                ],
                "entryId": "sample_spelling_vowels_ow_brown"
              },
              {
                "text": "flower",
                "explains": "n. 花，花卉；开花",
                "phonetic": "/'flaʊə/",
                "freq": 2305,
                "examples": [
                  {
                    "english": "The flower smells sweet.",
                    "chinese": "这朵花很香。"
                  }
                ],
                "entryId": "sample_spelling_vowels_ow_flower"
              },
              {
                "text": "cow",
                "explains": "n. 母牛，奶牛；母兽",
                "phonetic": "/kaʊ/",
                "freq": 2377,
                "examples": [
                  {
                    "english": "The cow is eating grass.",
                    "chinese": "奶牛在吃草。"
                  }
                ],
                "entryId": "sample_spelling_vowels_ow_cow"
              }
            ]
          },
          {
            "keyType": "letters",
            "keyValue": "oo",
            "keyDescription": "🌙 moon / 🍔 food / 🦁 zoo",
            "note": "oo 常读 /uː/：moon、food、zoo；在 blood、flood 中读 /ʌ/，在 door、floor 中读 /ɔː/。",
            "words": [
              {
                "text": "room",
                "explains": "n. 房间；空间；余地；机会；房间里所有的人；v. 为…提供住处；租房，合住；投宿，住宿；留…住宿",
                "phonetic": "/ruːm; rʊm/",
                "freq": 275,
                "examples": [
                  {
                    "english": "The room is clean and bright.",
                    "chinese": "房间干净明亮。"
                  }
                ],
                "entryId": "sample_spelling_vowels_oo_room"
              },
              {
                "text": "school",
                "explains": "n. 学校；学院；学派；鱼群；v. 教育",
                "phonetic": "/skuːl/",
                "freq": 328,
                "examples": [
                  {
                    "english": "The school is near my home.",
                    "chinese": "学校离我家很近。"
                  }
                ],
                "entryId": "sample_spelling_vowels_oo_school"
              },
              {
                "text": "cool",
                "explains": "adj. 凉的；冷静的",
                "phonetic": "/kuːl/",
                "freq": 504,
                "examples": [
                  {
                    "english": "The evening air is cool.",
                    "chinese": "傍晚的空气很凉爽。"
                  }
                ],
                "entryId": "sample_spelling_vowels_oo_cool"
              },
              {
                "text": "food",
                "explains": "n. 食物，食品；养料，精神食粮",
                "phonetic": "/fuːd/",
                "freq": 533,
                "examples": [
                  {
                    "english": "The food tastes good.",
                    "chinese": "食物味道很好。"
                  }
                ],
                "entryId": "sample_spelling_vowels_oo_food"
              },
              {
                "text": "moon",
                "explains": "n. 月球，月亮；卫星",
                "phonetic": "/muːn/",
                "freq": 1138,
                "examples": [
                  {
                    "english": "The moon is bright tonight.",
                    "chinese": "今晚月亮很亮。"
                  }
                ],
                "entryId": "sample_spelling_vowels_oo_moon"
              },
              {
                "text": "pool",
                "explains": "n. 游泳池；水塘，水池",
                "phonetic": "/puːl/",
                "freq": 1716,
                "examples": [
                  {
                    "english": "The children swam in the pool.",
                    "chinese": "孩子们在泳池里游泳。"
                  }
                ],
                "entryId": "sample_spelling_vowels_oo_pool"
              },
              {
                "text": "tooth",
                "explains": "n. 牙齿；vt. 给……装齿；vi. 啮合",
                "phonetic": "/tuːθ/",
                "freq": 3968,
                "examples": [
                  {
                    "english": "My tooth hurts.",
                    "chinese": "我的牙疼。"
                  }
                ],
                "entryId": "sample_spelling_vowels_oo_tooth"
              },
              {
                "text": "zoo",
                "explains": "n. 动物园",
                "phonetic": "/zuː/",
                "freq": 4303,
                "examples": [
                  {
                    "english": "We visited the zoo on Sunday.",
                    "chinese": "我们周日去了动物园。"
                  }
                ],
                "entryId": "sample_spelling_vowels_oo_zoo"
              }
            ]
          },
          {
            "keyType": "letters",
            "keyValue": "ay",
            "keyDescription": "🌞 day / 🎮 play / 🛣️ way",
            "note": "ay 在词尾通常读 /eɪ/：day、play、stay。",
            "words": [
              {
                "text": "say",
                "explains": "v. 比如说[用于举例]",
                "phonetic": "/seɪ/",
                "freq": 101,
                "examples": [
                  {
                    "english": "What did she say?",
                    "chinese": "她说了什么？"
                  }
                ],
                "entryId": "sample_spelling_vowels_ay_say"
              },
              {
                "text": "way",
                "explains": "n. （特定的）状态，状况",
                "phonetic": "/weɪ/",
                "freq": 112,
                "examples": [
                  {
                    "english": "This is the shortest way home.",
                    "chinese": "这是回家最近的路。"
                  }
                ],
                "entryId": "sample_spelling_vowels_ay_way"
              },
              {
                "text": "day",
                "explains": "n. （一）天；白昼，白天",
                "phonetic": "/deɪ/",
                "freq": 149,
                "examples": [
                  {
                    "english": "It was a sunny day.",
                    "chinese": "那是一个晴天。"
                  }
                ],
                "entryId": "sample_spelling_vowels_ay_day"
              },
              {
                "text": "stay",
                "explains": "v. 停留；坚持；暂住；停下；n. 逗留；停止；支柱",
                "phonetic": "/steɪ/",
                "freq": 219,
                "examples": [
                  {
                    "english": "We stayed at a small hotel.",
                    "chinese": "我们住在一家小旅馆。"
                  }
                ],
                "entryId": "sample_spelling_vowels_ay_stay"
              },
              {
                "text": "may",
                "explains": "modal verb. 可能；可以；祝",
                "phonetic": "/meɪ/",
                "freq": 225,
                "examples": [
                  {
                    "english": "It may rain tomorrow.",
                    "chinese": "明天可能会下雨。"
                  }
                ],
                "entryId": "sample_spelling_vowels_ay_may"
              },
              {
                "text": "today",
                "explains": "adv. 今天；现今；n. 今天；现今",
                "phonetic": "/tə'deɪ/",
                "freq": 232,
                "examples": [
                  {
                    "english": "I am busy today.",
                    "chinese": "我今天很忙。"
                  }
                ],
                "entryId": "sample_spelling_vowels_ay_today"
              },
              {
                "text": "play",
                "explains": "v. 玩，游戏；演奏",
                "phonetic": "/pleɪ/",
                "freq": 334,
                "examples": [
                  {
                    "english": "The children play in the park.",
                    "chinese": "孩子们在公园里玩。"
                  }
                ],
                "entryId": "sample_spelling_vowels_ay_play"
              },
              {
                "text": "pay",
                "explains": "v. 支付；付给；给予",
                "phonetic": "/peɪ/",
                "freq": 388,
                "examples": [
                  {
                    "english": "I will pay by card.",
                    "chinese": "我用卡支付。"
                  }
                ],
                "entryId": "sample_spelling_vowels_ay_pay"
              }
            ]
          },
          {
            "keyType": "letters",
            "keyValue": "oa",
            "keyDescription": "⛵ boat / 🧥 coat / 🛣️ road",
            "note": "oa 通常读 /əʊ/：boat、coat、road。",
            "words": [
              {
                "text": "road",
                "explains": "n. 公路，马路；道路；手段；vt. （狗）沿臭迹追逐（猎物）；adj. （美）巡回的",
                "phonetic": "/rəʊd/",
                "freq": 684,
                "examples": [
                  {
                    "english": "The road is wet after the rain.",
                    "chinese": "雨后路面湿了。"
                  }
                ],
                "entryId": "sample_spelling_vowels_oa_road"
              },
              {
                "text": "boat",
                "explains": "n. 小船，艇",
                "phonetic": "/bəʊt/",
                "freq": 884,
                "examples": [
                  {
                    "english": "The boat crossed the river.",
                    "chinese": "小船过了河。"
                  }
                ],
                "entryId": "sample_spelling_vowels_oa_boat"
              },
              {
                "text": "coach",
                "explains": "n. 长途公共汽车",
                "phonetic": "/kəʊtʃ/",
                "freq": 1525,
                "examples": [
                  {
                    "english": "The coach trained the team.",
                    "chinese": "教练训练了队伍。"
                  }
                ],
                "entryId": "sample_spelling_vowels_oa_coach"
              },
              {
                "text": "coat",
                "explains": "n. 外套，上衣；皮毛",
                "phonetic": "/kəʊt/",
                "freq": 1855,
                "examples": [
                  {
                    "english": "Put on your coat; it is cold.",
                    "chinese": "穿上外套，天冷了。"
                  }
                ],
                "entryId": "sample_spelling_vowels_oa_coat"
              },
              {
                "text": "load",
                "explains": "v. 装；装满；n. 负载",
                "phonetic": "/ləʊd/",
                "freq": 2278,
                "examples": [
                  {
                    "english": "They loaded the boxes onto the truck.",
                    "chinese": "他们把箱子装上卡车。"
                  }
                ],
                "entryId": "sample_spelling_vowels_oa_load"
              },
              {
                "text": "toast",
                "explains": "n. 烤面包；v. 烘，烤",
                "phonetic": "/təʊst/",
                "freq": 2352,
                "examples": [
                  {
                    "english": "I had toast for breakfast.",
                    "chinese": "我早餐吃了吐司。"
                  }
                ],
                "entryId": "sample_spelling_vowels_oa_toast"
              },
              {
                "text": "coast",
                "explains": "n. 海岸，海滨（地区）",
                "phonetic": "/kəʊst/",
                "freq": 2364,
                "examples": [
                  {
                    "english": "We drove along the coast.",
                    "chinese": "我们沿着海岸开车。"
                  }
                ],
                "entryId": "sample_spelling_vowels_oa_coast"
              },
              {
                "text": "goal",
                "explains": "n. 目的；球门；得分",
                "phonetic": "/gəʊl/",
                "freq": 2404,
                "examples": [
                  {
                    "english": "Her goal is to finish first.",
                    "chinese": "她的目标是第一个完成。"
                  }
                ],
                "entryId": "sample_spelling_vowels_oa_goal"
              }
            ]
          },
          {
            "keyType": "letters",
            "keyValue": "igh",
            "keyDescription": "🌙 night / 💡 light / ✈️ flight",
            "note": "igh 中的 gh 不发音，整体读 /aɪ/：night、light、high。",
            "words": [
              {
                "text": "right",
                "explains": "adj. 正确的；直接的；右方的；v. 复正；恢复平稳；n. 正确；右边；正义；adv. 正确地；恰当地；彻底地",
                "phonetic": "/raɪt/",
                "freq": 49,
                "examples": [
                  {
                    "english": "Turn right at the corner.",
                    "chinese": "在拐角处右转。"
                  }
                ],
                "entryId": "sample_spelling_vowels_igh_right"
              },
              {
                "text": "night",
                "explains": "n. 夜，夜间",
                "phonetic": "/naɪt/",
                "freq": 169,
                "examples": [
                  {
                    "english": "The night was quiet.",
                    "chinese": "夜晚很安静。"
                  }
                ],
                "entryId": "sample_spelling_vowels_igh_night"
              },
              {
                "text": "might",
                "explains": "v. 可能，会，也许",
                "phonetic": "/maɪt/",
                "freq": 230,
                "examples": [
                  {
                    "english": "It might snow tonight.",
                    "chinese": "今晚可能下雪。"
                  }
                ],
                "entryId": "sample_spelling_vowels_igh_might"
              },
              {
                "text": "fight",
                "explains": "v. 打（仗）；斗争",
                "phonetic": "/faɪt/",
                "freq": 449,
                "examples": [
                  {
                    "english": "They decided to fight for their rights.",
                    "chinese": "他们决定为权利而斗争。"
                  }
                ],
                "entryId": "sample_spelling_vowels_igh_fight"
              },
              {
                "text": "high",
                "explains": "adj. 高的；高级的；adv. 高",
                "phonetic": "/haɪ/",
                "freq": 499,
                "examples": [
                  {
                    "english": "The wall is very high.",
                    "chinese": "这堵墙很高。"
                  }
                ],
                "entryId": "sample_spelling_vowels_igh_high"
              },
              {
                "text": "light",
                "explains": "adj. 轻的；少量的",
                "phonetic": "/laɪt/",
                "freq": 535,
                "examples": [
                  {
                    "english": "Please turn on the light.",
                    "chinese": "请开灯。"
                  }
                ],
                "entryId": "sample_spelling_vowels_igh_light"
              },
              {
                "text": "sight",
                "explains": "n. 景象；名胜，风景",
                "phonetic": "/saɪt/",
                "freq": 1518,
                "examples": [
                  {
                    "english": "The sunset was a beautiful sight.",
                    "chinese": "日落很美。"
                  }
                ],
                "entryId": "sample_spelling_vowels_igh_sight"
              },
              {
                "text": "bright",
                "explains": "adj. 明亮的；聪明的",
                "phonetic": "/braɪt/",
                "freq": 1795,
                "examples": [
                  {
                    "english": "The room is bright and warm.",
                    "chinese": "房间明亮又温暖。"
                  }
                ],
                "entryId": "sample_spelling_vowels_igh_bright"
              }
            ]
          }
        ]
      },
      {
        "name": "辅音组合",
        "pages": [
          {
            "keyType": "letters",
            "keyValue": "ch",
            "keyDescription": "🪑 chair / 🧀 cheese",
            "note": "ch 通常读 /tʃ/：chair、child、teach。",
            "words": [
              {
                "text": "much",
                "explains": "adv. 非常，很；det. 许多的",
                "phonetic": "/mʌtʃ/",
                "freq": 135,
                "examples": [
                  {
                    "english": "Thank you very much.",
                    "chinese": "非常感谢。"
                  }
                ],
                "entryId": "sample_spelling_consonants_ch_much"
              },
              {
                "text": "watch",
                "explains": "v. 观察；注视；看守；警戒；n. 手表；监视；守护；值班人",
                "phonetic": "/wɒtʃ/",
                "freq": 365,
                "examples": [
                  {
                    "english": "We watched a film last night.",
                    "chinese": "我们昨晚看了一部电影。"
                  }
                ],
                "entryId": "sample_spelling_consonants_ch_watch"
              },
              {
                "text": "check",
                "explains": "v. 检查；制止；n. 检查",
                "phonetic": "/tʃek/",
                "freq": 410,
                "examples": [
                  {
                    "english": "Please check your answers.",
                    "chinese": "请检查你的答案。"
                  }
                ],
                "entryId": "sample_spelling_consonants_ch_check"
              },
              {
                "text": "child",
                "explains": "n. 小孩，儿童；儿子/女儿",
                "phonetic": "/tʃaɪld/",
                "freq": 469,
                "examples": [
                  {
                    "english": "The child is playing outside.",
                    "chinese": "孩子在外面玩。"
                  }
                ],
                "entryId": "sample_spelling_consonants_ch_child"
              },
              {
                "text": "catch",
                "explains": "v. 捉住；赶上；领会",
                "phonetic": "/kætʃ/",
                "freq": 636,
                "examples": [
                  {
                    "english": "Try to catch the ball.",
                    "chinese": "试着接住球。"
                  }
                ],
                "entryId": "sample_spelling_consonants_ch_catch"
              },
              {
                "text": "teach",
                "explains": "v. 教；教授；教导；n. (Teach)人名；(英)蒂奇",
                "phonetic": "/tiːtʃ/",
                "freq": 1020,
                "examples": [
                  {
                    "english": "I teach English at school.",
                    "chinese": "我在学校教英语。"
                  }
                ],
                "entryId": "sample_spelling_consonants_ch_teach"
              },
              {
                "text": "chicken",
                "explains": "n. 鸡；鸡肉",
                "phonetic": "/'tʃɪkɪn/",
                "freq": 1224,
                "examples": [
                  {
                    "english": "We had chicken for dinner.",
                    "chinese": "我们晚餐吃了鸡肉。"
                  }
                ],
                "entryId": "sample_spelling_consonants_ch_chicken"
              },
              {
                "text": "chair",
                "explains": "n. 椅子；主席",
                "phonetic": "/tʃeə/",
                "freq": 1590,
                "examples": [
                  {
                    "english": "Please sit on this chair.",
                    "chinese": "请坐在这把椅子上。"
                  }
                ],
                "entryId": "sample_spelling_consonants_ch_chair"
              }
            ]
          },
          {
            "keyType": "letters",
            "keyValue": "th",
            "keyDescription": "👍 thumb / 🤔 think / 👩 mother",
            "note": "th 可读 /θ/（think、mouth）或 /ð/（mother、brother）。",
            "words": [
              {
                "text": "think",
                "explains": "v. 想；认为；想起；想像；打算；n. 想；想法；adj. 思想的",
                "phonetic": "/θɪŋk/",
                "freq": 67,
                "examples": [
                  {
                    "english": "I think you are right.",
                    "chinese": "我认为你是对的。"
                  }
                ],
                "entryId": "sample_spelling_consonants_th_think"
              },
              {
                "text": "thank",
                "explains": "v. 感谢；n. 感谢；int. 谢谢",
                "phonetic": "/θæŋk/",
                "freq": 131,
                "examples": [
                  {
                    "english": "Thank you for your help.",
                    "chinese": "谢谢你的帮助。"
                  }
                ],
                "entryId": "sample_spelling_consonants_th_thank"
              },
              {
                "text": "father",
                "explains": "n. 父亲；神父；创始人",
                "phonetic": "/'fɑːðə/",
                "freq": 194,
                "examples": [
                  {
                    "english": "My father works in a hospital.",
                    "chinese": "我父亲在医院工作。"
                  }
                ],
                "entryId": "sample_spelling_consonants_th_father"
              },
              {
                "text": "mother",
                "explains": "n. 母亲，妈妈",
                "phonetic": "/'mʌðə/",
                "freq": 226,
                "examples": [
                  {
                    "english": "My mother cooks well.",
                    "chinese": "我母亲做饭很好。"
                  }
                ],
                "entryId": "sample_spelling_consonants_th_mother"
              },
              {
                "text": "three",
                "explains": "n. 三，三个；num. 三；adj. 三的，三个的",
                "phonetic": "/θriː/",
                "freq": 231,
                "examples": [
                  {
                    "english": "There are three books on the desk.",
                    "chinese": "桌上有三本书。"
                  }
                ],
                "entryId": "sample_spelling_consonants_th_three"
              },
              {
                "text": "brother",
                "explains": "n. 兄弟；同事，同胞",
                "phonetic": "/'brʌðə/",
                "freq": 300,
                "examples": [
                  {
                    "english": "My brother is older than me.",
                    "chinese": "我哥哥比我大。"
                  }
                ],
                "entryId": "sample_spelling_consonants_th_brother"
              },
              {
                "text": "mouth",
                "explains": "n. 嘴，口，口腔",
                "phonetic": "/maʊθ/",
                "freq": 771,
                "examples": [
                  {
                    "english": "Open your mouth, please.",
                    "chinese": "请张开嘴。"
                  }
                ],
                "entryId": "sample_spelling_consonants_th_mouth"
              },
              {
                "text": "tooth",
                "explains": "n. 牙齿；vt. 给……装齿；vi. 啮合",
                "phonetic": "/tuːθ/",
                "freq": 3968,
                "examples": [
                  {
                    "english": "My tooth hurts.",
                    "chinese": "我的牙疼。"
                  }
                ],
                "entryId": "sample_spelling_consonants_th_tooth"
              }
            ]
          },
          {
            "keyType": "letters",
            "keyValue": "sh",
            "keyDescription": "👟 shoe / 🚢 ship",
            "note": "sh 读 /ʃ/：shoe、ship、fish。",
            "words": [
              {
                "text": "finish",
                "explains": "v. 完成；结束；n. 结尾",
                "phonetic": "/'fɪnɪʃ/",
                "freq": 754,
                "examples": [
                  {
                    "english": "Please finish your homework.",
                    "chinese": "请完成作业。"
                  }
                ],
                "entryId": "sample_spelling_consonants_sh_finish"
              },
              {
                "text": "ship",
                "explains": "v. 运送，乘船；以船运送；n. 船；舰；太空船",
                "phonetic": "/ʃɪp/",
                "freq": 757,
                "examples": [
                  {
                    "english": "The ship left the port.",
                    "chinese": "船离开了港口。"
                  }
                ],
                "entryId": "sample_spelling_consonants_sh_ship"
              },
              {
                "text": "fish",
                "explains": "n. 鱼；鱼肉；v. 钓鱼",
                "phonetic": "/fɪʃ/",
                "freq": 888,
                "examples": [
                  {
                    "english": "We had fish for lunch.",
                    "chinese": "我们午餐吃了鱼。"
                  }
                ],
                "entryId": "sample_spelling_consonants_sh_fish"
              },
              {
                "text": "shop",
                "explains": "n. 商店；店铺；v. 购物",
                "phonetic": "/ʃɒp/",
                "freq": 1042,
                "examples": [
                  {
                    "english": "The shop opens at nine.",
                    "chinese": "商店九点开门。"
                  }
                ],
                "entryId": "sample_spelling_consonants_sh_shop"
              },
              {
                "text": "push",
                "explains": "v. 推；鼓励；敦促；逼迫",
                "phonetic": "/pʊʃ/",
                "freq": 1065,
                "examples": [
                  {
                    "english": "Push the door to open it.",
                    "chinese": "推门打开。"
                  }
                ],
                "entryId": "sample_spelling_consonants_sh_push"
              },
              {
                "text": "wash",
                "explains": "n. 洗涤；洗的衣服；化妆水；冲积物；v. 洗涤；洗刷；冲走；拍打",
                "phonetic": "/wɒʃ/",
                "freq": 1635,
                "examples": [
                  {
                    "english": "Please wash your hands.",
                    "chinese": "请洗手。"
                  }
                ],
                "entryId": "sample_spelling_consonants_sh_wash"
              },
              {
                "text": "shoe",
                "explains": "n. 鞋；蹄铁；外胎；v. 给……穿上鞋；穿……鞋",
                "phonetic": "/ʃuː/",
                "freq": 2826,
                "examples": [
                  {
                    "english": "One shoe is under the bed.",
                    "chinese": "一只鞋在床下。"
                  }
                ],
                "entryId": "sample_spelling_consonants_sh_shoe"
              },
              {
                "text": "sheep",
                "explains": "n. 羊，绵羊；胆小鬼",
                "phonetic": "/ʃiːp/",
                "freq": 3064,
                "examples": [
                  {
                    "english": "The sheep are on the hill.",
                    "chinese": "羊在山坡上。"
                  }
                ],
                "entryId": "sample_spelling_consonants_sh_sheep"
              }
            ]
          },
          {
            "keyType": "letters",
            "keyValue": "ng",
            "keyDescription": "🤴 king / 🔔 ring / 🎵 song",
            "note": "ng 通常读 /ŋ/：king、ring、song。",
            "words": [
              {
                "text": "long",
                "explains": "v. 渴望，极想念",
                "phonetic": "/lɒŋ/",
                "freq": 182,
                "examples": [
                  {
                    "english": "It was a long journey.",
                    "chinese": "那是一段漫长的旅程。"
                  }
                ],
                "entryId": "sample_spelling_consonants_ng_long"
              },
              {
                "text": "morning",
                "explains": "n. 早晨，上午",
                "phonetic": "/'mɔːnɪŋ/",
                "freq": 264,
                "examples": [
                  {
                    "english": "I run every morning.",
                    "chinese": "我每天早上跑步。"
                  }
                ],
                "entryId": "sample_spelling_consonants_ng_morning"
              },
              {
                "text": "bring",
                "explains": "v. 带来；引出；促使",
                "phonetic": "/brɪŋ/",
                "freq": 319,
                "examples": [
                  {
                    "english": "Please bring your notebook.",
                    "chinese": "请带笔记本。"
                  }
                ],
                "entryId": "sample_spelling_consonants_ng_bring"
              },
              {
                "text": "king",
                "explains": "n. 国王，君主",
                "phonetic": "/kɪŋ/",
                "freq": 558,
                "examples": [
                  {
                    "english": "The king lived in a castle.",
                    "chinese": "国王住在城堡里。"
                  }
                ],
                "entryId": "sample_spelling_consonants_ng_king"
              },
              {
                "text": "song",
                "explains": "n. 歌曲；歌唱；诗歌；鸣声",
                "phonetic": "/sɒŋ/",
                "freq": 679,
                "examples": [
                  {
                    "english": "She sang a beautiful song.",
                    "chinese": "她唱了一首优美的歌。"
                  }
                ],
                "entryId": "sample_spelling_consonants_ng_song"
              },
              {
                "text": "strong",
                "explains": "adj. 坚强的；强壮的；牢固的；擅长的；adv. 强劲地；猛烈地；n. (Strong)人名；(英)斯特朗",
                "phonetic": "/strɒŋ/",
                "freq": 716,
                "examples": [
                  {
                    "english": "He is strong enough to lift it.",
                    "chinese": "他足够强壮能举起它。"
                  }
                ],
                "entryId": "sample_spelling_consonants_ng_strong"
              },
              {
                "text": "sing",
                "explains": "v. 唱歌；歌颂；鸣叫；呼号；n. 演唱；鸣声；呼啸声",
                "phonetic": "/sɪŋ/",
                "freq": 798,
                "examples": [
                  {
                    "english": "They sing together every week.",
                    "chinese": "他们每周一起唱歌。"
                  }
                ],
                "entryId": "sample_spelling_consonants_ng_sing"
              },
              {
                "text": "spring",
                "explains": "v. 跳，跃；n. 泉；跳跃",
                "phonetic": "/sprɪŋ/",
                "freq": 1859,
                "examples": [
                  {
                    "english": "Flowers bloom in spring.",
                    "chinese": "春天花开。"
                  }
                ],
                "entryId": "sample_spelling_consonants_ng_spring"
              }
            ]
          },
          {
            "keyType": "letters",
            "keyValue": "ck",
            "keyDescription": "🕐 clock / 🦆 duck / 🧦 sock",
            "note": "ck 读 /k/：clock、duck、black。",
            "words": [
              {
                "text": "back",
                "explains": "adv. 回原处；回；在后",
                "phonetic": "/bæk/",
                "freq": 83,
                "examples": [
                  {
                    "english": "He looked back at the house.",
                    "chinese": "他回头看了看房子。"
                  }
                ],
                "entryId": "sample_spelling_consonants_ck_back"
              },
              {
                "text": "black",
                "explains": "adj. 黑色的；黑暗的",
                "phonetic": "/blæk/",
                "freq": 549,
                "examples": [
                  {
                    "english": "She wore a black dress.",
                    "chinese": "她穿着黑色连衣裙。"
                  }
                ],
                "entryId": "sample_spelling_consonants_ck_black"
              },
              {
                "text": "pick",
                "explains": "n. 镐，鹤嘴锄",
                "phonetic": "/pɪk/",
                "freq": 552,
                "examples": [
                  {
                    "english": "Pick a card from the box.",
                    "chinese": "从盒子里抽一张卡。"
                  }
                ],
                "entryId": "sample_spelling_consonants_ck_pick"
              },
              {
                "text": "luck",
                "explains": "n. 好运，幸运；运气",
                "phonetic": "/lʌk/",
                "freq": 616,
                "examples": [
                  {
                    "english": "Good luck with your exam.",
                    "chinese": "祝你考试顺利。"
                  }
                ],
                "entryId": "sample_spelling_consonants_ck_luck"
              },
              {
                "text": "quick",
                "explains": "adj. 快的；敏捷的",
                "phonetic": "/kwɪk/",
                "freq": 712,
                "examples": [
                  {
                    "english": "He gave a quick answer.",
                    "chinese": "他迅速回答。"
                  }
                ],
                "entryId": "sample_spelling_consonants_ck_quick"
              },
              {
                "text": "clock",
                "explains": "n. 钟，仪表",
                "phonetic": "/klɒk/",
                "freq": 1941,
                "examples": [
                  {
                    "english": "The clock on the wall is slow.",
                    "chinese": "墙上的钟慢了。"
                  }
                ],
                "entryId": "sample_spelling_consonants_ck_clock"
              },
              {
                "text": "duck",
                "explains": "n. 鸭；中文释义: 雌鸭；鸭肉",
                "phonetic": "/dʌk/",
                "freq": 2631,
                "examples": [
                  {
                    "english": "A duck swam across the lake.",
                    "chinese": "一只鸭子游过湖面。"
                  }
                ],
                "entryId": "sample_spelling_consonants_ck_duck"
              },
              {
                "text": "sock",
                "explains": "n. 短袜；一击；v. 重击；给……穿袜；adv. 正着地；不偏不倚地；adj. 非常成功的",
                "phonetic": "/sɒk/",
                "freq": 6858,
                "examples": [
                  {
                    "english": "I cannot find my other sock.",
                    "chinese": "我找不到另一只袜子。"
                  }
                ],
                "entryId": "sample_spelling_consonants_ck_sock"
              }
            ]
          },
          {
            "keyType": "letters",
            "keyValue": "qu",
            "keyDescription": "👑 queen / ❓ question / ⚡ quick",
            "note": "qu 通常读 /kw/：queen、question、quick。",
            "words": [
              {
                "text": "quite",
                "explains": "adv. 完全；相当；的确",
                "phonetic": "/kwaɪt/",
                "freq": 428,
                "examples": [
                  {
                    "english": "The film was quite good.",
                    "chinese": "这部电影相当不错。"
                  }
                ],
                "entryId": "sample_spelling_consonants_qu_quite"
              },
              {
                "text": "question",
                "explains": "n. 问题；疑问",
                "phonetic": "/'kwestʃ(ə)n/",
                "freq": 495,
                "examples": [
                  {
                    "english": "May I ask a question?",
                    "chinese": "我可以问一个问题吗？"
                  }
                ],
                "entryId": "sample_spelling_consonants_qu_question"
              },
              {
                "text": "quiet",
                "explains": "adj. 安静的；寂静的",
                "phonetic": "/'kwaɪət/",
                "freq": 660,
                "examples": [
                  {
                    "english": "Please be quiet in the library.",
                    "chinese": "在图书馆请安静。"
                  }
                ],
                "entryId": "sample_spelling_consonants_qu_quiet"
              },
              {
                "text": "quick",
                "explains": "adj. 快的；敏捷的",
                "phonetic": "/kwɪk/",
                "freq": 712,
                "examples": [
                  {
                    "english": "He gave a quick answer.",
                    "chinese": "他迅速回答。"
                  }
                ],
                "entryId": "sample_spelling_consonants_qu_quick"
              },
              {
                "text": "queen",
                "explains": "n. 女王；王后；王后",
                "phonetic": "/kwiːn/",
                "freq": 1014,
                "examples": [
                  {
                    "english": "The queen waved to the crowd.",
                    "chinese": "女王向人群挥手。"
                  }
                ],
                "entryId": "sample_spelling_consonants_qu_queen"
              },
              {
                "text": "quit",
                "explains": "v. 离开，退出；退出；停止",
                "phonetic": "/kwɪt/",
                "freq": 1047,
                "examples": [
                  {
                    "english": "He decided to quit smoking.",
                    "chinese": "他决定戒烟。"
                  }
                ],
                "entryId": "sample_spelling_consonants_qu_quit"
              },
              {
                "text": "square",
                "explains": "n. 正方形；广场",
                "phonetic": "/skweə/",
                "freq": 1929,
                "examples": [
                  {
                    "english": "The square is full of people.",
                    "chinese": "广场上满是人。"
                  }
                ],
                "entryId": "sample_spelling_consonants_qu_square"
              },
              {
                "text": "request",
                "explains": "n. 请求，要求；v. 请求，要求",
                "phonetic": "/rɪ'kwest/",
                "freq": 2042,
                "examples": [
                  {
                    "english": "She made a simple request.",
                    "chinese": "她提了一个简单的请求。"
                  }
                ],
                "entryId": "sample_spelling_consonants_qu_request"
              }
            ]
          },
          {
            "keyType": "letters",
            "keyValue": "ph",
            "keyDescription": "📱 phone / 📷 photo / 🐘 elephant",
            "note": "ph 读 /f/：phone、photo、elephant。",
            "words": [
              {
                "text": "phone",
                "explains": "n. 电话，电话机",
                "phonetic": "/fəʊn/",
                "freq": 333,
                "note": "phon（声音）+ -e → 电话",
                "examples": [
                  {
                    "english": "My phone is on the table.",
                    "chinese": "我的手机在桌上。"
                  }
                ],
                "memoryTip": "phon（声音）+ -e。",
                "entryId": "sample_spelling_consonants_ph_phone"
              },
              {
                "text": "photo",
                "explains": "n. 照片，相片",
                "phonetic": "/'fəʊtəʊ/",
                "freq": 1515,
                "examples": [
                  {
                    "english": "He showed me a photo of his family.",
                    "chinese": "他给我看了家人的照片。"
                  }
                ],
                "entryId": "sample_spelling_consonants_ph_photo"
              },
              {
                "text": "nephew",
                "explains": "n. 侄子，外甥",
                "phonetic": "/'nefjuː; 'nevjuː/",
                "freq": 3215,
                "examples": [
                  {
                    "english": "My nephew is five years old.",
                    "chinese": "我侄子五岁。"
                  }
                ],
                "entryId": "sample_spelling_consonants_ph_nephew"
              },
              {
                "text": "atmosphere",
                "explains": "n. 气氛；大气；空气",
                "phonetic": "/'ætməsfɪə/",
                "freq": 3356,
                "examples": [
                  {
                    "english": "The atmosphere is calm and quiet.",
                    "chinese": "气氛平静安宁。"
                  }
                ],
                "entryId": "sample_spelling_consonants_ph_atmosphere"
              },
              {
                "text": "photograph",
                "explains": "n. 照片，相片",
                "phonetic": "/'fəʊtəgrɑːf/",
                "freq": 3528,
                "note": "photo（光）+ graph（写）→ 用光记录→照片",
                "examples": [
                  {
                    "english": "He took a photograph of the lake.",
                    "chinese": "他拍了一张湖的照片。"
                  }
                ],
                "memoryTip": "photo（光）+ graph（写）。",
                "entryId": "sample_spelling_consonants_ph_photograph"
              },
              {
                "text": "elephant",
                "explains": "n. 象",
                "phonetic": "/'elɪf(ə)nt/",
                "freq": 3774,
                "examples": [
                  {
                    "english": "The elephant is very large.",
                    "chinese": "大象很大。"
                  }
                ],
                "entryId": "sample_spelling_consonants_ph_elephant"
              },
              {
                "text": "philosophy",
                "explains": "n. 哲学；哲理；人生观",
                "phonetic": "/fɪ'lɒsəfɪ/",
                "freq": 5197,
                "examples": [
                  {
                    "english": "She studies philosophy at university.",
                    "chinese": "她在大学学哲学。"
                  }
                ],
                "entryId": "sample_spelling_consonants_ph_philosophy"
              },
              {
                "text": "physics",
                "explains": "n. 物理学",
                "phonetic": "/'fɪzɪks/",
                "freq": 5244,
                "examples": [
                  {
                    "english": "Physics is my favorite subject.",
                    "chinese": "物理是我最喜欢的科目。"
                  }
                ],
                "entryId": "sample_spelling_consonants_ph_physics"
              }
            ]
          },
          {
            "keyType": "letters",
            "keyValue": "wh",
            "keyDescription": "🐋 whale / 🌾 wheat / 🎡 wheel",
            "note": "wh 通常读 /w/：whale、wheat、white。",
            "words": [
              {
                "text": "which",
                "explains": "pron. 哪/那一个；哪/那一些；adj. 哪一个；哪一些",
                "phonetic": "/wɪtʃ/",
                "freq": 199,
                "examples": [
                  {
                    "english": "Which color do you like?",
                    "chinese": "你喜欢哪种颜色？"
                  }
                ],
                "entryId": "sample_spelling_consonants_wh_which"
              },
              {
                "text": "while",
                "explains": "conj. 虽然；然而；当……的时候；n. 一会儿；一段时间；v. 消磨；轻松地度过",
                "phonetic": "/wʌɪl/",
                "freq": 311,
                "examples": [
                  {
                    "english": "Read a book while you wait.",
                    "chinese": "等待时读本书。"
                  }
                ],
                "entryId": "sample_spelling_consonants_wh_while"
              },
              {
                "text": "white",
                "explains": "adj. 白种（人）的",
                "phonetic": "/wʌɪt/",
                "freq": 574,
                "examples": [
                  {
                    "english": "She wore a white shirt.",
                    "chinese": "她穿着白衬衫。"
                  }
                ],
                "entryId": "sample_spelling_consonants_wh_white"
              },
              {
                "text": "wheel",
                "explains": "n. 轮，车轮",
                "phonetic": "/wiːl/",
                "freq": 2433,
                "examples": [
                  {
                    "english": "The wheel turns slowly.",
                    "chinese": "轮子慢慢转动。"
                  }
                ],
                "entryId": "sample_spelling_consonants_wh_wheel"
              },
              {
                "text": "whistle",
                "explains": "n. 口哨；v. 吹口哨",
                "phonetic": "/'wɪs(ə)l/",
                "freq": 2760,
                "examples": [
                  {
                    "english": "He blew the whistle.",
                    "chinese": "他吹响了哨子。"
                  }
                ],
                "entryId": "sample_spelling_consonants_wh_whistle"
              },
              {
                "text": "whale",
                "explains": "n. 鲸",
                "phonetic": "/weɪl/",
                "freq": 4930,
                "examples": [
                  {
                    "english": "A whale swam near the boat.",
                    "chinese": "一头鲸鱼游近小船。"
                  }
                ],
                "entryId": "sample_spelling_consonants_wh_whale"
              },
              {
                "text": "whisper",
                "explains": "v. 低声地讲",
                "phonetic": "/'wɪspə/",
                "freq": 6447,
                "examples": [
                  {
                    "english": "Do not whisper in class.",
                    "chinese": "上课不要窃窃私语。"
                  }
                ],
                "entryId": "sample_spelling_consonants_wh_whisper"
              },
              {
                "text": "wheat",
                "explains": "n. 小麦",
                "phonetic": "/wiːt/",
                "freq": 6965,
                "examples": [
                  {
                    "english": "The fields are full of wheat.",
                    "chinese": "田里长满了小麦。"
                  }
                ],
                "entryId": "sample_spelling_consonants_wh_wheat"
              }
            ]
          }
        ]
      },
      {
        "name": "特殊拼写",
        "pages": [
          {
            "keyType": "letters",
            "keyValue": "old",
            "keyDescription": "🥇 gold / ❄️ cold / 🤝 hold",
            "note": "old 是 /əʊld/ 的稳定拼写：gold、cold、hold；看到 old 先读 /əʊld/。",
            "words": [
              {
                "text": "old",
                "explains": "adj. 老的；…岁的",
                "phonetic": "/əʊld/",
                "freq": 197,
                "examples": [
                  {
                    "english": "The old house needs repairs.",
                    "chinese": "老房子需要维修。"
                  }
                ],
                "entryId": "sample_spelling_special_old_old"
              },
              {
                "text": "hold",
                "explains": "v. 拿住；掌握；拥有",
                "phonetic": "/həʊld/",
                "freq": 295,
                "examples": [
                  {
                    "english": "Please hold the door open.",
                    "chinese": "请把门扶住。"
                  }
                ],
                "entryId": "sample_spelling_special_old_hold"
              },
              {
                "text": "cold",
                "explains": "adj. 冷的；冷淡的；n. 冷",
                "phonetic": "/kəʊld/",
                "freq": 625,
                "examples": [
                  {
                    "english": "The water is very cold.",
                    "chinese": "水很冷。"
                  }
                ],
                "entryId": "sample_spelling_special_old_cold"
              },
              {
                "text": "gold",
                "explains": "n. 金；adj. 金制的",
                "phonetic": "/gəʊld/",
                "freq": 886,
                "examples": [
                  {
                    "english": "The ring is made of gold.",
                    "chinese": "戒指是金的。"
                  }
                ],
                "entryId": "sample_spelling_special_old_gold"
              },
              {
                "text": "golden",
                "explains": "adj. 金色的；极好的",
                "phonetic": "/'gəʊld(ə)n/",
                "freq": 2097,
                "examples": [
                  {
                    "english": "The sky turned golden at sunset.",
                    "chinese": "日落时天空变成金色。"
                  }
                ],
                "entryId": "sample_spelling_special_old_golden"
              },
              {
                "text": "bold",
                "explains": "adj. 大胆的；冒失的",
                "phonetic": "/bəʊld/",
                "freq": 4922,
                "examples": [
                  {
                    "english": "It was a bold decision.",
                    "chinese": "这是一个大胆的决定。"
                  }
                ],
                "entryId": "sample_spelling_special_old_bold"
              },
              {
                "text": "household",
                "explains": "n. 家庭，户；家务",
                "phonetic": "/'haʊshəʊld/",
                "freq": 5678,
                "examples": [
                  {
                    "english": "The household shares the chores.",
                    "chinese": "全家人分担家务。"
                  }
                ],
                "entryId": "sample_spelling_special_old_household"
              },
              {
                "text": "fold",
                "explains": "v. 折叠；合拢；n. 褶",
                "phonetic": "/fəʊld/",
                "freq": 6020,
                "examples": [
                  {
                    "english": "Please fold the paper in half.",
                    "chinese": "请把纸对折。"
                  }
                ],
                "entryId": "sample_spelling_special_old_fold"
              }
            ]
          },
          {
            "keyType": "letters",
            "keyValue": "kn",
            "keyDescription": "🔪 knife / 🚪 knock / 🦵 knee",
            "note": "kn 在词首时 k 不发音，源自古英语 cn-：knife、knee、know。",
            "words": [
              {
                "text": "know",
                "explains": "v. 知道；认识；通晓",
                "phonetic": "/nəʊ/",
                "freq": 33,
                "examples": [
                  {
                    "english": "I know the answer.",
                    "chinese": "我知道答案。"
                  }
                ],
                "entryId": "sample_spelling_special_kn_know"
              },
              {
                "text": "knock",
                "explains": "v. 敲，击，打；n. 敲，击，打",
                "phonetic": "/nɒk/",
                "freq": 1119,
                "examples": [
                  {
                    "english": "Someone knocked on the door.",
                    "chinese": "有人敲门。"
                  }
                ],
                "entryId": "sample_spelling_special_kn_knock"
              },
              {
                "text": "knife",
                "explains": "n. 小刀，刀，餐刀",
                "phonetic": "/naɪf/",
                "freq": 1399,
                "examples": [
                  {
                    "english": "Be careful with the knife.",
                    "chinese": "小心刀。"
                  }
                ],
                "entryId": "sample_spelling_special_kn_knife"
              },
              {
                "text": "knowledge",
                "explains": "n. 知识，学识；知道",
                "phonetic": "/'nɒlɪdʒ/",
                "freq": 2027,
                "examples": [
                  {
                    "english": "Knowledge is power.",
                    "chinese": "知识就是力量。"
                  }
                ],
                "entryId": "sample_spelling_special_kn_knowledge"
              },
              {
                "text": "unknown",
                "explains": "adj. 不知道的；未知的",
                "phonetic": "/ʌn'nəʊn/",
                "freq": 2859,
                "examples": [
                  {
                    "english": "The cause is still unknown.",
                    "chinese": "原因仍然未知。"
                  }
                ],
                "entryId": "sample_spelling_special_kn_unknown"
              },
              {
                "text": "knee",
                "explains": "n. 膝，膝盖，膝关节",
                "phonetic": "/niː/",
                "freq": 3759,
                "examples": [
                  {
                    "english": "He hurt his knee.",
                    "chinese": "他伤了膝盖。"
                  }
                ],
                "entryId": "sample_spelling_special_kn_knee"
              },
              {
                "text": "kneel",
                "explains": "v. 跪，跪下，跪着",
                "phonetic": "/niːl/",
                "freq": 7195,
                "examples": [
                  {
                    "english": "She knelt down to tie her shoe.",
                    "chinese": "她跪下来系鞋带。"
                  }
                ],
                "entryId": "sample_spelling_special_kn_kneel"
              },
              {
                "text": "knot",
                "explains": "n. （绳的）结；（树的）节",
                "phonetic": "/nɒt/",
                "freq": 7767,
                "examples": [
                  {
                    "english": "He tied a tight knot.",
                    "chinese": "他打了一个紧结。"
                  }
                ],
                "entryId": "sample_spelling_special_kn_knot"
              }
            ]
          },
          {
            "keyType": "letters",
            "keyValue": "wr",
            "keyDescription": "⌚ wrist / 🎁 wrap / ✍️ write",
            "note": "wr 在词首时 w 不发音，源自古英语 wr-：write、wrist、wrong。",
            "words": [
              {
                "text": "wrong",
                "explains": "adv. 错误地；邪恶地，不正当地；n. 坏事；不公正；adj. 错误的；失常的；不适当的；v. 委屈；无理地对待；诽谤",
                "phonetic": "/rɒŋ/",
                "freq": 227,
                "examples": [
                  {
                    "english": "You took the wrong road.",
                    "chinese": "你走错路了。"
                  }
                ],
                "entryId": "sample_spelling_special_wr_wrong"
              },
              {
                "text": "write",
                "explains": "v. 写，写字；写作，作曲；写信",
                "phonetic": "/raɪt/",
                "freq": 645,
                "examples": [
                  {
                    "english": "Please write your name here.",
                    "chinese": "请在这里写下你的名字。"
                  }
                ],
                "entryId": "sample_spelling_special_wr_write"
              },
              {
                "text": "writing",
                "explains": "n. 书写；作品；著作；[法] 笔迹；v. 书写（write的ing形式）",
                "phonetic": "/'raɪtɪŋ/",
                "freq": 1255,
                "examples": [
                  {
                    "english": "Her writing is clear and simple.",
                    "chinese": "她的文字清楚简洁。"
                  }
                ],
                "entryId": "sample_spelling_special_wr_writing"
              },
              {
                "text": "writer",
                "explains": "n. 作家；作者",
                "phonetic": "/'raɪtə/",
                "freq": 2549,
                "examples": [
                  {
                    "english": "The writer published a new book.",
                    "chinese": "这位作家出版了一本新书。"
                  }
                ],
                "entryId": "sample_spelling_special_wr_writer"
              },
              {
                "text": "wrap",
                "explains": "v. 裹，包，捆；n. 披肩",
                "phonetic": "/ræp/",
                "freq": 3309,
                "examples": [
                  {
                    "english": "Please wrap the gift.",
                    "chinese": "请把礼物包起来。"
                  }
                ],
                "entryId": "sample_spelling_special_wr_wrap"
              },
              {
                "text": "wreck",
                "explains": "n. 沉船，失事船；v. 破坏",
                "phonetic": "/rek/",
                "freq": 4535,
                "examples": [
                  {
                    "english": "The storm wrecked the old boat.",
                    "chinese": "风暴毁坏了旧船。"
                  }
                ],
                "entryId": "sample_spelling_special_wr_wreck"
              },
              {
                "text": "wrist",
                "explains": "n. 腕，腕关节",
                "phonetic": "/rɪst/",
                "freq": 5240,
                "examples": [
                  {
                    "english": "He wears a watch on his wrist.",
                    "chinese": "他手腕上戴着手表。"
                  }
                ],
                "entryId": "sample_spelling_special_wr_wrist"
              },
              {
                "text": "wrestle",
                "explains": "n. 摔交；斗争，搏斗",
                "phonetic": "/'res(ə)l/",
                "freq": 11317,
                "examples": [
                  {
                    "english": "The two boys wrestled on the grass.",
                    "chinese": "两个男孩在草地上摔跤。"
                  }
                ],
                "entryId": "sample_spelling_special_wr_wrestle"
              }
            ]
          },
          {
            "keyType": "letters",
            "keyValue": "mb",
            "keyDescription": "🧗 climb / 🧨 bomb / 🐑 lamb",
            "note": "词尾 mb 的 b 不发音：climb、bomb、lamb；但 member、number 中的 b 要读。",
            "words": [
              {
                "text": "bomb",
                "explains": "n. 炸弹；v. 轰炸",
                "phonetic": "/bɒm/",
                "freq": 1325,
                "examples": [
                  {
                    "english": "The bomb was defused.",
                    "chinese": "炸弹被拆除了。"
                  }
                ],
                "entryId": "sample_spelling_special_mb_bomb"
              },
              {
                "text": "dumb",
                "explains": "adj. 哑的；无言的",
                "phonetic": "/dʌm/",
                "freq": 1659,
                "examples": [
                  {
                    "english": "He was struck dumb by the news.",
                    "chinese": "他被这个消息惊呆了。"
                  }
                ],
                "entryId": "sample_spelling_special_mb_dumb"
              },
              {
                "text": "climb",
                "explains": "v. 攀登，爬",
                "phonetic": "/klaɪm/",
                "freq": 2578,
                "examples": [
                  {
                    "english": "They climbed the mountain.",
                    "chinese": "他们爬上了山。"
                  }
                ],
                "entryId": "sample_spelling_special_mb_climb"
              },
              {
                "text": "lamb",
                "explains": "n. 羔羊，小羊；羔羊肉",
                "phonetic": "/læm/",
                "freq": 4102,
                "examples": [
                  {
                    "english": "The lamb stayed close to its mother.",
                    "chinese": "小羊紧跟着母亲。"
                  }
                ],
                "entryId": "sample_spelling_special_mb_lamb"
              },
              {
                "text": "tomb",
                "explains": "n. 坟墓；死亡；vt. 埋葬",
                "phonetic": "/tuːm/",
                "freq": 5139,
                "examples": [
                  {
                    "english": "The tomb is very old.",
                    "chinese": "这座墓很古老。"
                  }
                ],
                "entryId": "sample_spelling_special_mb_tomb"
              },
              {
                "text": "thumb",
                "explains": "v. 翻阅；以拇指拨弄；作搭车手势；笨拙地摆弄；n. 拇指",
                "phonetic": "/θʌm/",
                "freq": 5262,
                "examples": [
                  {
                    "english": "He hurt his thumb.",
                    "chinese": "他伤了大拇指。"
                  }
                ],
                "entryId": "sample_spelling_special_mb_thumb"
              },
              {
                "text": "comb",
                "explains": "n. 梳子；v. 梳理",
                "phonetic": "/kəʊm/",
                "freq": 7723,
                "examples": [
                  {
                    "english": "She combed her hair.",
                    "chinese": "她梳了头发。"
                  }
                ],
                "entryId": "sample_spelling_special_mb_comb"
              },
              {
                "text": "plumber",
                "explains": "n. 水管工；堵漏人员",
                "phonetic": "/'plʌmə/",
                "freq": 8485,
                "examples": [
                  {
                    "english": "The plumber fixed the pipe.",
                    "chinese": "水管工修好了管道。"
                  }
                ],
                "entryId": "sample_spelling_special_mb_plumber"
              }
            ]
          },
          {
            "keyType": "letters",
            "keyValue": "tch",
            "keyDescription": "🍳 kitchen / 🧤 catch / 🔘 switch",
            "note": "tch 读 /tʃ/，常出现在短元音后：catch、watch、kitchen。",
            "words": [
              {
                "text": "watch",
                "explains": "v. 观察；注视；看守；警戒；n. 手表；监视；守护；值班人",
                "phonetic": "/wɒtʃ/",
                "freq": 365,
                "examples": [
                  {
                    "english": "We watched a film last night.",
                    "chinese": "我们昨晚看了一部电影。"
                  }
                ],
                "entryId": "sample_spelling_special_tch_watch"
              },
              {
                "text": "catch",
                "explains": "v. 捉住；赶上；领会",
                "phonetic": "/kætʃ/",
                "freq": 636,
                "examples": [
                  {
                    "english": "Try to catch the ball.",
                    "chinese": "试着接住球。"
                  }
                ],
                "entryId": "sample_spelling_special_tch_catch"
              },
              {
                "text": "kitchen",
                "explains": "n. 厨房，灶间",
                "phonetic": "/'kɪtʃɪn; -tʃ(ə)n/",
                "freq": 1127,
                "examples": [
                  {
                    "english": "The kitchen smells wonderful.",
                    "chinese": "厨房里香气扑鼻。"
                  }
                ],
                "entryId": "sample_spelling_special_tch_kitchen"
              },
              {
                "text": "match",
                "explains": "n. 比赛，竞赛；对手",
                "phonetic": "/mætʃ/",
                "freq": 1143,
                "examples": [
                  {
                    "english": "They won the match.",
                    "chinese": "他们赢了比赛。"
                  }
                ],
                "entryId": "sample_spelling_special_tch_match"
              },
              {
                "text": "switch",
                "explains": "n. 开关；转换；v. 转换",
                "phonetic": "/swɪtʃ/",
                "freq": 2077,
                "examples": [
                  {
                    "english": "Please switch off the light.",
                    "chinese": "请关灯。"
                  }
                ],
                "entryId": "sample_spelling_special_tch_switch"
              },
              {
                "text": "scratch",
                "explains": "v. 搔；抓；n. 搔；抓",
                "phonetic": "/skrætʃ/",
                "freq": 3107,
                "examples": [
                  {
                    "english": "The cat scratched the sofa.",
                    "chinese": "猫抓坏了沙发。"
                  }
                ],
                "entryId": "sample_spelling_special_tch_scratch"
              },
              {
                "text": "fetch",
                "explains": "v. 拿来；请来，接去",
                "phonetic": "/fetʃ/",
                "freq": 3280,
                "examples": [
                  {
                    "english": "The dog fetched the ball.",
                    "chinese": "狗把球叼了回来。"
                  }
                ],
                "entryId": "sample_spelling_special_tch_fetch"
              },
              {
                "text": "patch",
                "explains": "n. 补丁；〔与周围部分不同的〕斑，小块；v. 修补，缝补",
                "phonetic": "/pætʃ/",
                "freq": 4127,
                "examples": [
                  {
                    "english": "He sewed a patch on his coat.",
                    "chinese": "他在外套上缝了一块补丁。"
                  }
                ],
                "entryId": "sample_spelling_special_tch_patch"
              }
            ]
          },
          {
            "keyType": "letters",
            "keyValue": "dge",
            "keyDescription": "🌉 bridge / 🧊 fridge / ⚖️ judge",
            "note": "dge 读 /dʒ/，常出现在短元音后：bridge、judge、fridge。",
            "words": [
              {
                "text": "judge",
                "explains": "n. 法官；裁判员",
                "phonetic": "/dʒʌdʒ/",
                "freq": 981,
                "examples": [
                  {
                    "english": "The judge listened carefully.",
                    "chinese": "法官仔细倾听。"
                  }
                ],
                "entryId": "sample_spelling_special_dge_judge"
              },
              {
                "text": "bridge",
                "explains": "n. 桥，桥梁；桥牌",
                "phonetic": "/brɪdʒ/",
                "freq": 1521,
                "examples": [
                  {
                    "english": "The bridge crosses the river.",
                    "chinese": "桥横跨河流。"
                  }
                ],
                "entryId": "sample_spelling_special_dge_bridge"
              },
              {
                "text": "knowledge",
                "explains": "n. 知识，学识；知道",
                "phonetic": "/'nɒlɪdʒ/",
                "freq": 2027,
                "examples": [
                  {
                    "english": "Knowledge is power.",
                    "chinese": "知识就是力量。"
                  }
                ],
                "entryId": "sample_spelling_special_dge_knowledge"
              },
              {
                "text": "edge",
                "explains": "n. 边缘，边；刀口",
                "phonetic": "/edʒ/",
                "freq": 2277,
                "examples": [
                  {
                    "english": "Do not stand near the edge.",
                    "chinese": "不要站在边缘附近。"
                  }
                ],
                "entryId": "sample_spelling_special_dge_edge"
              },
              {
                "text": "fridge",
                "explains": "n. 电冰箱",
                "phonetic": "/frɪdʒ/",
                "freq": 4034,
                "examples": [
                  {
                    "english": "The milk is in the fridge.",
                    "chinese": "牛奶在冰箱里。"
                  }
                ],
                "entryId": "sample_spelling_special_dge_fridge"
              },
              {
                "text": "budget",
                "explains": "n. 预算；〔政府的〕",
                "phonetic": "/'bʌdʒɪt/",
                "freq": 4095,
                "examples": [
                  {
                    "english": "The project is over budget.",
                    "chinese": "项目超出预算。"
                  }
                ],
                "entryId": "sample_spelling_special_dge_budget"
              },
              {
                "text": "lodge",
                "explains": "v. 暂住，借宿，投宿",
                "phonetic": "/lɒdʒ/",
                "freq": 6134,
                "examples": [
                  {
                    "english": "They stayed at a small lodge.",
                    "chinese": "他们住在一家小旅馆。"
                  }
                ],
                "entryId": "sample_spelling_special_dge_lodge"
              },
              {
                "text": "ridge",
                "explains": "n. 岭，山脉；脊；垄",
                "phonetic": "/rɪdʒ/",
                "freq": 6667,
                "examples": [
                  {
                    "english": "We walked along the ridge.",
                    "chinese": "我们沿着山脊走。"
                  }
                ],
                "entryId": "sample_spelling_special_dge_ridge"
              }
            ]
          }
        ]
      }
    ]
  },
  {
    "name": "场景名词",
    "desc": "按身体、日常物体和酒店场景组织常用名词",
    "chapters": [
      {
        "name": "身体",
        "pages": [
          {
            "keyType": "text",
            "keyValue": "身体",
            "keyDescription": "身体部位名词",
            "note": "身体部位词适合做“图词联动”：边指部位边说出单词，比孤立背释义更容易记住。",
            "words": [
              {
                "text": "head",
                "explains": "n. 头；上端；v. 率领",
                "phonetic": "/hed/",
                "freq": 290,
                "examples": [
                  {
                    "english": "My head hurts.",
                    "chinese": "我头疼。"
                  }
                ],
                "entryId": "sample_nouns_body_text_1_head"
              },
              {
                "text": "hand",
                "explains": "n. 手；指针",
                "phonetic": "/hænd/",
                "freq": 367,
                "examples": [
                  {
                    "english": "Raise your hand if you know.",
                    "chinese": "知道就举手。"
                  }
                ],
                "entryId": "sample_nouns_body_text_1_hand"
              },
              {
                "text": "arm",
                "explains": "n. 臂；臂状物；武器",
                "phonetic": "/ɑːm/",
                "freq": 1234,
                "examples": [
                  {
                    "english": "He broke his arm.",
                    "chinese": "他摔断了胳膊。"
                  }
                ],
                "entryId": "sample_nouns_body_text_1_arm"
              },
              {
                "text": "leg",
                "explains": "n. 腿，腿部",
                "phonetic": "/leg/",
                "freq": 1271,
                "examples": [
                  {
                    "english": "She hurt her leg while running.",
                    "chinese": "她跑步时伤了腿。"
                  }
                ],
                "entryId": "sample_nouns_body_text_1_leg"
              },
              {
                "text": "foot",
                "explains": "n. 脚；最下部；英尺",
                "phonetic": "/fʊt/",
                "freq": 1157,
                "examples": [
                  {
                    "english": "My foot is asleep.",
                    "chinese": "我的脚麻了。"
                  }
                ],
                "entryId": "sample_nouns_body_text_1_foot"
              },
              {
                "text": "eye",
                "explains": "n. 眼睛；眼力",
                "phonetic": "/aɪ/",
                "freq": 711,
                "examples": [
                  {
                    "english": "She has a sharp eye.",
                    "chinese": "她眼光敏锐。"
                  }
                ],
                "entryId": "sample_nouns_body_text_1_eye"
              },
              {
                "text": "ear",
                "explains": "n. 耳朵；听力，听觉",
                "phonetic": "/ɪə/",
                "freq": 2235,
                "examples": [
                  {
                    "english": "He whispered in my ear.",
                    "chinese": "他在我耳边低语。"
                  }
                ],
                "entryId": "sample_nouns_body_text_1_ear"
              },
              {
                "text": "nose",
                "explains": "n. 鼻子",
                "phonetic": "/nəʊz/",
                "freq": 1305,
                "examples": [
                  {
                    "english": "The dog has a good nose.",
                    "chinese": "狗的鼻子很灵。"
                  }
                ],
                "entryId": "sample_nouns_body_text_1_nose"
              }
            ]
          }
        ]
      },
      {
        "name": "日常物品",
        "pages": [
          {
            "keyType": "text",
            "keyValue": "日常物品",
            "keyDescription": "常见日常物品名词",
            "note": "把物品放在眼前，看到就说出英文；同场景的词一起记，比按字母顺序背更自然。",
            "words": [
              {
                "text": "book",
                "explains": "n. 书，书籍；v. 预定",
                "phonetic": "/bʊk/",
                "freq": 572,
                "examples": [
                  {
                    "english": "I am reading a good book.",
                    "chinese": "我在读一本好书。"
                  }
                ],
                "entryId": "sample_nouns_objects_text_1_book"
              },
              {
                "text": "pen",
                "explains": "n. 钢笔，自来水笔",
                "phonetic": "/pen/",
                "freq": 2573,
                "examples": [
                  {
                    "english": "May I borrow your pen?",
                    "chinese": "我可以借你的笔吗？"
                  }
                ],
                "entryId": "sample_nouns_objects_text_1_pen"
              },
              {
                "text": "pencil",
                "explains": "n. 铅笔",
                "phonetic": "/'pens(ə)l; -sɪl/",
                "freq": 5821,
                "examples": [
                  {
                    "english": "Write with a pencil.",
                    "chinese": "用铅笔写。"
                  }
                ],
                "entryId": "sample_nouns_objects_text_1_pencil"
              },
              {
                "text": "chair",
                "explains": "n. 椅子；主席",
                "phonetic": "/tʃeə/",
                "freq": 1590,
                "examples": [
                  {
                    "english": "Please sit on this chair.",
                    "chinese": "请坐在这把椅子上。"
                  }
                ],
                "entryId": "sample_nouns_objects_text_1_chair"
              },
              {
                "text": "clock",
                "explains": "n. 钟，仪表",
                "phonetic": "/klɒk/",
                "freq": 1941,
                "examples": [
                  {
                    "english": "The clock on the wall is slow.",
                    "chinese": "墙上的钟慢了。"
                  }
                ],
                "entryId": "sample_nouns_objects_text_1_clock"
              },
              {
                "text": "lamp",
                "explains": "n. 灯",
                "phonetic": "/læmp/",
                "freq": 4645,
                "examples": [
                  {
                    "english": "The lamp is on the desk.",
                    "chinese": "台灯在桌上。"
                  }
                ],
                "entryId": "sample_nouns_objects_text_1_lamp"
              },
              {
                "text": "bottle",
                "explains": "n. 瓶，酒瓶；一瓶",
                "phonetic": "/'bɒt(ə)l/",
                "freq": 1330,
                "examples": [
                  {
                    "english": "Please fill the bottle with water.",
                    "chinese": "请把瓶子装满水。"
                  }
                ],
                "entryId": "sample_nouns_objects_text_1_bottle"
              },
              {
                "text": "cup",
                "explains": "n. 杯子；（一）杯；奖杯",
                "phonetic": "/kʌp/",
                "freq": 1438,
                "examples": [
                  {
                    "english": "She drank a cup of tea.",
                    "chinese": "她喝了一杯茶。"
                  }
                ],
                "entryId": "sample_nouns_objects_text_1_cup"
              }
            ]
          }
        ]
      },
      {
        "name": "酒店",
        "pages": [
          {
            "keyType": "text",
            "keyValue": "酒店",
            "keyDescription": "酒店入住与服务场景名词",
            "note": "按入住流程串起来：luggage → reception → key → bed → towel → bill → tip。",
            "words": [
              {
                "text": "hotel",
                "explains": "n. 旅馆",
                "phonetic": "/həʊ'tel; əʊ-/",
                "freq": 792,
                "examples": [
                  {
                    "english": "We stayed at a small hotel.",
                    "chinese": "我们住在一家小旅馆。"
                  }
                ],
                "entryId": "sample_nouns_hotel_text_1_hotel"
              },
              {
                "text": "luggage",
                "explains": "n. 行李；皮箱，皮包",
                "phonetic": "/'lʌgɪdʒ/",
                "freq": 4518,
                "examples": [
                  {
                    "english": "Our luggage is in the room.",
                    "chinese": "我们的行李在房间里。"
                  }
                ],
                "entryId": "sample_nouns_hotel_text_1_luggage"
              },
              {
                "text": "bed",
                "explains": "n. 床，床位；圃；河床",
                "phonetic": "/bed/",
                "freq": 524,
                "examples": [
                  {
                    "english": "The bed is soft and warm.",
                    "chinese": "床又软又暖。"
                  }
                ],
                "entryId": "sample_nouns_hotel_text_1_bed"
              },
              {
                "text": "key",
                "explains": "n. 钥匙；键；答案",
                "phonetic": "/kiː/",
                "freq": 883,
                "examples": [
                  {
                    "english": "I lost my room key.",
                    "chinese": "我丢了房间钥匙。"
                  }
                ],
                "entryId": "sample_nouns_hotel_text_1_key"
              },
              {
                "text": "reception",
                "explains": "adj. 接待；招待会",
                "phonetic": "/rɪ'sepʃ(ə)n/",
                "freq": 4032,
                "examples": [
                  {
                    "english": "Please ask at reception.",
                    "chinese": "请到前台询问。"
                  }
                ],
                "entryId": "sample_nouns_hotel_text_1_reception"
              },
              {
                "text": "bill",
                "explains": "n. 账单；票据；招贴",
                "phonetic": "/bɪl/",
                "freq": 835,
                "examples": [
                  {
                    "english": "The bill is on the table.",
                    "chinese": "账单在桌上。"
                  }
                ],
                "entryId": "sample_nouns_hotel_text_1_bill"
              },
              {
                "text": "towel",
                "explains": "n. 毛巾，手巾",
                "phonetic": "/'taʊəl/",
                "freq": 4297,
                "examples": [
                  {
                    "english": "The towel is in the bathroom.",
                    "chinese": "毛巾在浴室里。"
                  }
                ],
                "entryId": "sample_nouns_hotel_text_1_towel"
              },
              {
                "text": "tip",
                "explains": "v. 轻击；给小费",
                "phonetic": "/tɪp/",
                "freq": 2297,
                "examples": [
                  {
                    "english": "He left a tip for the waiter.",
                    "chinese": "他给服务员留了小费。"
                  }
                ],
                "entryId": "sample_nouns_hotel_text_1_tip"
              }
            ]
          }
        ]
      }
    ]
  }
]
