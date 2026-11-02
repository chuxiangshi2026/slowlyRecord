/**
 * 内置示例书（生成产物，勿手改；重新生成：node scripts/gen-wordbook-samples.cjs）
 *
 * 两本书：四级词根（old / spect / pre）、四级发音（/əʊ/ /eɪ/）。
 * 首次进入词图闯关时播种，用户删除后不再自动恢复。
 */

export interface WordBookSampleWord {
  text: string
  explains: string
  phonetic?: string
  freq?: number
}

export interface WordBookSampleChapter {
  name: string
  keyType: 'root' | 'prefix' | 'suffix' | 'phonetic'
  keyValue: string
  words: WordBookSampleWord[]
}

export interface WordBookSampleBook {
  name: string
  desc: string
  chapters: WordBookSampleChapter[]
}

export const WORDBOOK_SAMPLES: WordBookSampleBook[] = [
  {
    "name": "四级词根",
    "desc": "按词根/词缀把四级词归堆，一页记一组",
    "chapters": [
      {
        "name": "词根 old",
        "keyType": "root",
        "keyValue": "old",
        "words": [
          {
            "text": "hold",
            "explains": "v. 拿住；掌握；拥有",
            "phonetic": "/həʊld/",
            "freq": 295
          },
          {
            "text": "cold",
            "explains": "adj. 冷的；冷淡的；n. 冷",
            "phonetic": "/kəʊld/",
            "freq": 625
          },
          {
            "text": "gold",
            "explains": "n. 金；adj. 金制的",
            "phonetic": "/gəʊld/",
            "freq": 886
          },
          {
            "text": "golden",
            "explains": "adj. 金色的；极好的",
            "phonetic": "/'gəʊld(ə)n/",
            "freq": 2097
          },
          {
            "text": "bold",
            "explains": "adj. 大胆的；冒失的",
            "phonetic": "/bəʊld/",
            "freq": 4922
          },
          {
            "text": "household",
            "explains": "n. 家庭，户；家务",
            "phonetic": "/'haʊshəʊld/",
            "freq": 5678
          },
          {
            "text": "fold",
            "explains": "v. 折叠；合拢；n. 褶",
            "phonetic": "/fəʊld/",
            "freq": 6020
          }
        ]
      },
      {
        "name": "词根 spect",
        "keyType": "root",
        "keyValue": "spect",
        "words": [
          {
            "text": "suspect",
            "explains": "v. 怀疑；疑心",
            "phonetic": "/ˈsʌspekt; (for v.) səˈspekt/",
            "freq": 1327
          },
          {
            "text": "perspective",
            "explains": "n. 透视；远景；观点",
            "phonetic": "/pə'spektɪv/",
            "freq": 4959
          },
          {
            "text": "inspection",
            "explains": "n. 检阅；检查，审查",
            "phonetic": "/ɪn'spekʃn/",
            "freq": 6718
          },
          {
            "text": "aspect",
            "explains": "n. 方面；样子，外表",
            "phonetic": "/'æspekt/",
            "freq": 7861
          },
          {
            "text": "prospect",
            "explains": "n. 展望；前景，前程",
            "phonetic": "/'prɒspekt/",
            "freq": 10041
          },
          {
            "text": "inspect",
            "explains": "v. 检查，审查；检阅",
            "phonetic": "/ɪn'spekt/",
            "freq": 11219
          },
          {
            "text": "respective",
            "explains": "adj. 各自的，各个的",
            "phonetic": "/rɪ'spektɪv/",
            "freq": 21243
          },
          {
            "text": "respectively",
            "explains": "adv. 各自地，分别地",
            "phonetic": "/rɪ'spektɪvlɪ/",
            "freq": 42153
          }
        ]
      },
      {
        "name": "前缀 pre",
        "keyType": "prefix",
        "keyValue": "pre",
        "words": [
          {
            "text": "pretty",
            "explains": "adj. 漂亮的，标致的",
            "phonetic": "/'prɪtɪ/",
            "freq": 302
          },
          {
            "text": "president",
            "explains": "n. 总统；（某组织的）最高权力人",
            "phonetic": "/'prezɪd(ə)nt/",
            "freq": 710
          },
          {
            "text": "present",
            "explains": "adj. 现在的；n. 目前",
            "phonetic": "/'prez(ə)nt/",
            "freq": 865
          },
          {
            "text": "press",
            "explains": "v. 压，按；按，揿；催促",
            "phonetic": "/pres/",
            "freq": 1155
          },
          {
            "text": "pressure",
            "explains": "n. 压力；〔工作或生活中的〕压力；压，按",
            "phonetic": "/'preʃə/",
            "freq": 1283
          },
          {
            "text": "pretend",
            "explains": "v. 假装",
            "phonetic": "/prɪ'tend/",
            "freq": 1608
          },
          {
            "text": "prepare",
            "explains": "v. 准备，预备",
            "phonetic": "/prɪ'peə/",
            "freq": 1631
          },
          {
            "text": "prefer",
            "explains": "v. 更喜欢",
            "phonetic": "/prɪ'fɜː/",
            "freq": 1641
          },
          {
            "text": "presence",
            "explains": "n. 出席，到场；在",
            "phonetic": "/'prez(ə)ns/",
            "freq": 2344
          },
          {
            "text": "precious",
            "explains": "adj. 珍贵的，宝贵的",
            "phonetic": "/'preʃəs/",
            "freq": 2362
          },
          {
            "text": "prevent",
            "explains": "v. 预防，防止；阻止",
            "phonetic": "/prɪ'vent/",
            "freq": 3386
          },
          {
            "text": "previous",
            "explains": "adj. 先的；前的",
            "phonetic": "/'priːvɪəs/",
            "freq": 3524
          },
          {
            "text": "precise",
            "explains": "adj. 精确的，准确的",
            "phonetic": "/prɪ'saɪs/",
            "freq": 5598
          },
          {
            "text": "preserve",
            "explains": "v. 保护；保存；腌渍",
            "phonetic": "/prɪ'zɜːv/",
            "freq": 6599
          },
          {
            "text": "predict",
            "explains": "v. 预言，预告，预测",
            "phonetic": "/prɪ'dɪkt/",
            "freq": 7098
          },
          {
            "text": "preparation",
            "explains": "n. 准备，预备；制备",
            "phonetic": "/,prepə'reɪʃ(ə)n/",
            "freq": 8439
          },
          {
            "text": "preliminary",
            "explains": "adj. 预备的，初步的",
            "phonetic": "/prɪ'lɪmɪn(ə)rɪ/",
            "freq": 8512
          },
          {
            "text": "precision",
            "explains": "n. 精确，精密，精密度",
            "phonetic": "/prɪ'sɪʒ(ə)n/",
            "freq": 10009
          },
          {
            "text": "prejudice",
            "explains": "n. 偏见，成见",
            "phonetic": "/'predʒʊdɪs/",
            "freq": 10517
          },
          {
            "text": "precaution",
            "explains": "n. 预防；警惕",
            "phonetic": "/prɪ'kɔːʃ(ə)n/",
            "freq": 10918
          },
          {
            "text": "prevail",
            "explains": "v. 流行；胜，优胜",
            "phonetic": "/prɪ'veɪl/",
            "freq": 12367
          },
          {
            "text": "presently",
            "explains": "adv. 一会儿；目前",
            "phonetic": "/'prez(ə)ntlɪ/",
            "freq": 12502
          },
          {
            "text": "preference",
            "explains": "n. 偏爱；优先；优先权",
            "phonetic": "/'pref(ə)r(ə)ns/",
            "freq": 14643
          },
          {
            "text": "prescribe",
            "explains": "v. 开处（方）；命令",
            "phonetic": "/prɪ'skraɪb/",
            "freq": 15083
          }
        ]
      }
    ]
  },
  {
    "name": "四级发音",
    "desc": "按音标归堆，同音词放一页，读音一起记",
    "chapters": [
      {
        "name": "音标 /əʊ/",
        "keyType": "phonetic",
        "keyValue": "əʊ",
        "words": [
          {
            "text": "no",
            "explains": "adv. 不；并不；adj. 没有",
            "phonetic": "/nəʊ/",
            "freq": 27
          },
          {
            "text": "know",
            "explains": "v. 知道；认识；通晓",
            "phonetic": "/nəʊ/",
            "freq": 33
          },
          {
            "text": "go",
            "explains": "v. 去；走；变为",
            "phonetic": "/gəʊ/",
            "freq": 47
          },
          {
            "text": "oh",
            "explains": "int. 嗬，哦，唉呀",
            "phonetic": "/əʊ/",
            "freq": 56
          },
          {
            "text": "okay",
            "explains": "convention. 对，好",
            "phonetic": "/'əʊ'keɪ/",
            "freq": 82
          },
          {
            "text": "only",
            "explains": "adv. 只，仅仅；adj. 唯一的",
            "phonetic": "/'əʊnlɪ/",
            "freq": 117
          },
          {
            "text": "over",
            "explains": "prep. 在…上方；超过",
            "phonetic": "/'əʊvə/",
            "freq": 119
          },
          {
            "text": "home",
            "explains": "n. 家；家乡；adj. 家庭的",
            "phonetic": "/həʊm/",
            "freq": 168
          },
          {
            "text": "old",
            "explains": "adj. 老的；…岁的",
            "phonetic": "/əʊld/",
            "freq": 197
          },
          {
            "text": "hello",
            "explains": "int. 喂",
            "phonetic": "/hə'ləʊ; he-/",
            "freq": 203
          },
          {
            "text": "own",
            "explains": "adj. 自己的；v. 有，拥有",
            "phonetic": "/əʊn/",
            "freq": 239
          },
          {
            "text": "most",
            "explains": "det,pron. 最多的；adv. 最，很",
            "phonetic": "/məʊst/",
            "freq": 279
          },
          {
            "text": "both",
            "explains": "pron. 两者（都）",
            "phonetic": "/bəʊθ/",
            "freq": 286
          },
          {
            "text": "hold",
            "explains": "v. 拿住；掌握；拥有",
            "phonetic": "/həʊld/",
            "freq": 295
          },
          {
            "text": "also",
            "explains": "adv. 而且，还；亦，也",
            "phonetic": "/'ɔːlsəʊ/",
            "freq": 301
          },
          {
            "text": "alone",
            "explains": "adj. 单独的；adv. 单独地",
            "phonetic": "/ə'ləʊn/",
            "freq": 326
          },
          {
            "text": "phone",
            "explains": "n. 电话，电话机",
            "phonetic": "/fəʊn/",
            "freq": 333
          },
          {
            "text": "ago",
            "explains": "adv. 以前",
            "phonetic": "/ə'gəʊ/",
            "freq": 342
          },
          {
            "text": "open",
            "explains": "adj. 开的；开放的；v. 开",
            "phonetic": "/'əʊp(ə)n/",
            "freq": 343
          },
          {
            "text": "hope",
            "explains": "v. 希望；n. 希望",
            "phonetic": "/həʊp/",
            "freq": 346
          },
          {
            "text": "close",
            "explains": "v. 关，闭；结束",
            "phonetic": "/kləʊs/",
            "freq": 431
          },
          {
            "text": "moment",
            "explains": "n. 时刻；片刻，瞬间",
            "phonetic": "/'məʊm(ə)nt/",
            "freq": 448
          },
          {
            "text": "nobody",
            "explains": "pron. 谁也不；无人",
            "phonetic": "/'nəʊbədɪ/",
            "freq": 457
          },
          {
            "text": "almost",
            "explains": "adv. 几乎，差不多",
            "phonetic": "/'ɔːlməʊst/",
            "freq": 475
          }
        ]
      },
      {
        "name": "音标 /eɪ/",
        "keyType": "phonetic",
        "keyValue": "eɪ",
        "words": [
          {
            "text": "a",
            "explains": "art. 一（个）；每一（个）",
            "phonetic": "/ə; eɪ/",
            "freq": 5
          },
          {
            "text": "okay",
            "explains": "convention. 对，好",
            "phonetic": "/'əʊ'keɪ/",
            "freq": 82
          },
          {
            "text": "say",
            "explains": "v. 比如说[用于举例]",
            "phonetic": "/seɪ/",
            "freq": 101
          },
          {
            "text": "make",
            "explains": "v. 做，制造；使",
            "phonetic": "/meɪk/",
            "freq": 114
          },
          {
            "text": "day",
            "explains": "n. （一）天；白昼，白天",
            "phonetic": "/deɪ/",
            "freq": 149
          },
          {
            "text": "again",
            "explains": "adv. 又一次；而且",
            "phonetic": "/ə'gen; ə'geɪn/",
            "freq": 154
          },
          {
            "text": "maybe",
            "explains": "adv. 大概，或许；也许",
            "phonetic": "/'meɪbiː; -bɪ/",
            "freq": 155
          },
          {
            "text": "away",
            "explains": "adv. 离开，远离；…去",
            "phonetic": "/ə'weɪ/",
            "freq": 165
          },
          {
            "text": "great",
            "explains": "adj. 大的；伟大的",
            "phonetic": "/greɪt/",
            "freq": 171
          },
          {
            "text": "always",
            "explains": "adv. 总是，一直；永远",
            "phonetic": "/'ɔːlweɪz; -ɪz/",
            "freq": 180
          },
          {
            "text": "name",
            "explains": "n. 名字；名誉；v. 说出",
            "phonetic": "/neɪm/",
            "freq": 189
          },
          {
            "text": "place",
            "explains": "n. 地方，地点；住所",
            "phonetic": "/pleɪs/",
            "freq": 190
          },
          {
            "text": "may",
            "explains": "modal verb. 可能；可以；祝",
            "phonetic": "/meɪ/",
            "freq": 225
          },
          {
            "text": "baby",
            "explains": "n. 婴儿；孩子气的人",
            "phonetic": "/'beɪbɪ/",
            "freq": 274
          },
          {
            "text": "play",
            "explains": "v. 玩，游戏；演奏",
            "phonetic": "/pleɪ/",
            "freq": 334
          },
          {
            "text": "face",
            "explains": "n. 脸；表面",
            "phonetic": "/feɪs/",
            "freq": 347
          },
          {
            "text": "case",
            "explains": "n. 情况；病例；事实",
            "phonetic": "/keɪs/",
            "freq": 354
          },
          {
            "text": "later",
            "explains": "adv. 后来；过一会儿",
            "phonetic": "/'leɪtə/",
            "freq": 363
          },
          {
            "text": "late",
            "explains": "adj. 迟的；adv. 迟，晚",
            "phonetic": "/leɪt/",
            "freq": 382
          },
          {
            "text": "pay",
            "explains": "v. 支付；付给；给予",
            "phonetic": "/peɪ/",
            "freq": 388
          },
          {
            "text": "crazy",
            "explains": "adj. 疯狂的，荒唐的",
            "phonetic": "/'kreɪzɪ/",
            "freq": 389
          },
          {
            "text": "change",
            "explains": "n. 改变，变化；零钱",
            "phonetic": "/tʃeɪn(d)ʒ/",
            "freq": 393
          },
          {
            "text": "afraid",
            "explains": "adj. 害怕的；担心的",
            "phonetic": "/ə'freɪd/",
            "freq": 424
          },
          {
            "text": "anyway",
            "explains": "adv. 无论如何",
            "phonetic": "/'enɪweɪ/",
            "freq": 430
          }
        ]
      }
    ]
  }
]
