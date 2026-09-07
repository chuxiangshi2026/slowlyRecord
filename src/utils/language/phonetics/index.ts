/**
 * 发音学习数据集注册表（按语言）
 *
 * en：48 国际音标（自 phoneme-data.ts 搬迁注册）
 * ja：五十音（清音 46 + 浊音/半浊音 25 + 拗音 33），articulation 即假名本身，可 TTS
 * ru：33 西里尔字母发音
 * es / fr：元音 + 特色辅音精简集
 *
 * Phoneme 接口形状复用 src/utils/phoneme-data.ts，ipa 字段语义放宽为"音素/假名符号"。
 */
import type { LanguageCode } from '@/utils/language/types'
import type { Phoneme, PhonemeGroup } from '@/utils/phoneme-data'
import { PHONEME_TABLE as EN_TABLE, ALL_PHONEMES as EN_ALL } from '@/utils/phoneme-data'

// ============================================================================
// 日语：五十音
// ============================================================================


/** 五十音清音表（行 = 子分组） */
const KANA_CLEAN: Array<{ label: string; items: string[]; tip?: string }> = [
    {label: 'あ行', items: ['あ', 'い', 'う', 'え', 'お']},
    {label: 'か行', items: ['か', 'き', 'く', 'け', 'こ']},
    {label: 'さ行', items: ['さ', 'し', 'す', 'せ', 'そ']},
    {label: 'た行', items: ['た', 'ち', 'つ', 'て', 'と']},
    {label: 'な行', items: ['な', 'に', 'ぬ', 'ね', 'の']},
    {label: 'は行', items: ['は', 'ひ', 'ふ', 'へ', 'ほ']},
    {label: 'ま行', items: ['ま', 'み', 'む', 'め', 'も']},
    {label: 'や行', items: ['や', 'ゆ', 'よ']},
    {label: 'ら行', items: ['ら', 'り', 'る', 'れ', 'ろ']},
    {label: 'わ行', items: ['わ', 'を']},
    {label: '拨音', items: ['ん']},
]

const KANA_VOICED: Array<{ label: string; items: string[] }> = [
    {label: 'が行', items: ['が', 'ぎ', 'ぐ', 'げ', 'ご']},
    {label: 'ざ行', items: ['ざ', 'じ', 'ず', 'ぜ', 'ぞ']},
    {label: 'だ行', items: ['だ', 'ぢ', 'づ', 'で', 'ど']},
    {label: 'ば行', items: ['ば', 'び', 'ぶ', 'べ', 'ぼ']},
    {label: 'ぱ行', items: ['ぱ', 'ぴ', 'ぷ', 'ぺ', 'ぽ']},
]

const KANA_YOON: Array<{ label: string; items: string[] }> = [
    {label: 'きゃ行', items: ['きゃ', 'きゅ', 'きょ']},
    {label: 'しゃ行', items: ['しゃ', 'しゅ', 'しょ']},
    {label: 'ちゃ行', items: ['ちゃ', 'ちゅ', 'ちょ']},
    {label: 'にゃ行', items: ['にゃ', 'にゅ', 'にょ']},
    {label: 'ひゃ行', items: ['ひゃ', 'ひゅ', 'ひょ']},
    {label: 'みゃ行', items: ['みゃ', 'みゅ', 'みょ']},
    {label: 'りゃ行', items: ['りゃ', 'りゅ', 'りょ']},
    {label: 'ぎゃ行', items: ['ぎゃ', 'ぎゅ', 'ぎょ']},
    {label: 'じゃ行', items: ['じゃ', 'じゅ', 'じょ']},
    {label: 'びゃ行', items: ['びゃ', 'びゅ', 'びょ']},
    {label: 'ぴゃ行', items: ['ぴゃ', 'ぴゅ', 'ぴょ']},
]

/** 每个假名一例常用词（首词作为发音示范上下文） */
const KANA_EXAMPLES: Record<string, string[]> = {
    'あ': ['あめ', 'あさ', 'あに'], 'い': ['いえ', 'いす', 'いち'], 'う': ['うみ', 'うた', 'うし'], 'え': ['えき', 'えほん', 'えいが'], 'お': ['おと', 'おかね', 'おちゃ'],
    'か': ['かさ', 'かみ', 'かお'], 'き': ['きって', 'きのう', 'きおく'], 'く': ['くつ', 'くち', 'くら'], 'け': ['けむり', 'けいたい', 'けが'], 'こ': ['こども', 'こおり', 'こえ'],
    'さ': ['さくら', 'さかな', 'さとう'], 'し': ['しんぶん', 'しお', 'しま'], 'す': ['すし', 'すいえい', 'すな'], 'せ': ['せかい', 'せんせい', 'せびろ'], 'そ': ['そら', 'そと', 'そば'],
    'た': ['たまご', 'たてもの', 'たかい'], 'ち': ['ちかてつ', 'ちず', 'ちから'], 'つ': ['つくえ', 'つき', 'つかう'], 'て': ['てら', 'てがみ', 'てんき'], 'と': ['とけい', 'とり', 'ともだち'],
    'な': ['なつ', 'なまえ', 'なつ'], 'に': ['にく', 'にわ', 'にほん'], 'ぬ': ['ぬの', 'ぬま', 'ぬいぐるみ'], 'ね': ['ねこ', 'ねつ', 'ねだん'], 'の': ['のり', 'のうはう', 'のはら'],
    'は': ['はな', 'はし', 'はる'], 'ひ': ['ひと', 'ひこうき', 'ひらがな'], 'ふ': ['ふね', 'ふゆ', 'ふく'], 'へ': ['へや', 'へいわ', 'へそ'], 'ほ': ['ほし', 'ほん', 'ほいくえん'],
    'ま': ['まど', 'まち', 'まつ'], 'み': ['みず', 'みせ', 'みち'], 'む': ['むし', 'むら', 'むすこ'], 'め': ['めがね', 'めし', 'めうえ'], 'も': ['もん', 'もり', 'もくてき'],
    'や': ['やま', 'やさい', 'やくそく'], 'ゆ': ['ゆき', 'ゆめ', 'ゆうびん'], 'よ': ['よる', 'ようふく', 'よこはま'],
    'ら': ['らくがき', 'らいねん', 'らーめん'], 'り': ['りんご', 'りょうり', 'りか'], 'る': ['るす', 'るすばん', 'るーる'], 'れ': ['れきし', 'れすとらん', 'れんしゅう'], 'ろ': ['ろうか', 'ろくでなし', 'ろくが'],
    'わ': ['わたし', 'わかもの', 'わらう'], 'を': ['をんがく', 'をんな', 'をとこ'], 'ん': ['にほんご', 'せんせい', 'みんな'],
    'が': ['がっこう', 'がいこく', 'がんばる'], 'ぎ': ['ぎんこう', 'ぎゅうにゅう', 'ぎじゅつ'], 'ぐ': ['ぐあい', 'ぐんじん', 'ぐみ'], 'げ': ['げんき', 'げいじゅつ', 'げーむ'], 'ご': ['ごはん', 'ごご', 'ごみ'],
    'ざ': ['ざっし', 'ざこや', 'ざるそば'], 'じ': ['じかん', 'じどうしゃ', 'じんじゃ'], 'ず': ['ずかん', 'ずぼん', 'ずっと'], 'ぜ': ['ぜんぶ', 'ぜいたく', 'ぜんたい'], 'ぞ': ['ぞう', 'ぞっきょう', 'ぞんぶん'],
    'だ': ['だいがく', 'だいじょうぶ', 'だれ'], 'ぢ': ['はなぢ', 'ちぢむ', 'ぢから'], 'づ': ['つづく', 'ちぢみ', 'づかい'], 'で': ['でんわ', 'でぐち', 'でかける'], 'ど': ['どあ', 'どこ', 'どようび'],
    'ば': ['ばす', 'ばんごはん', 'ばしょ'], 'び': ['びょういん', 'びじゅつかん', 'びっくり'], 'ぶ': ['ぶどう', 'ぶたい', 'ぶんぼうぐ'], 'べ': ['べんり', 'べんきょう', 'べる'], 'ぼ': ['ぼうし', 'ぼく', 'ぼたん'],
    'ぱ': ['ぱん', 'ぱーてぃー', 'ぱそこん'], 'ぴ': ['ぴあの', 'ぴかぴか', 'ぴーち'], 'ぷ': ['ぷりん', 'ぷーる', 'ぷれぜんと'], 'ぺ': ['ぺん', 'ぺージ', 'ぺこぺこ'], 'ぽ': ['ぽけっと', 'ぽすと', 'ぽかぽか'],
    'きゃ': ['きゃべつ', 'きゃんぷ', 'きゃりー'], 'きゅ': ['きゅうり', 'きゅうこう', 'きゅく'], 'きょ': ['きょうと', 'きょねん', 'きょり'],
    'しゃ': ['しゃしん', 'しゃかい', 'しゃちょう'], 'しゅ': ['しゅくだい', 'しゅみ', 'しゅじんこう'], 'しょ': ['しょくどう', 'しょてん', 'しょゆう'],
    'ちゃ': ['ちゃいろ', 'ちゃんと', 'ちゃわん'], 'ちゅ': ['ちゅうい', 'ちゅうがっこう', 'ちゅうもん'], 'ちょ': ['ちょうど', 'ちょこっと', 'ちょうり'],
    'にゃ': ['にゃんこ', 'にやにや', 'にゅーす'], 'にゅ': ['にゅうす', 'にゅうもん', 'にゅうがく'], 'にょ': ['にょきにょき', 'にょきっと', 'にょー'],
    'ひゃ': ['ひゃく', 'ひゃっかじてん', 'ひょうげん'], 'ひゅ': ['ひゅーてん', 'ひゅうが', 'ひゅーまん'], 'ひょ': ['ひょうばん', 'ひょうじょう', 'ひょうろん'],
    'みゃ': ['みゃく', 'みゃーく', 'みゃおう'], 'みゅ': ['みゅーじっく', 'みゅーと', 'みゅう'], 'みょ': ['みょうじ', 'みょうが', 'みょうちょう'],
    'りゃ': ['りゃくご', 'りゃくごう', 'りゃん'], 'りゅ': ['りゅうがく', 'りゅうこう', 'りゅうし'], 'りょ': ['りょかん', 'りょうり', 'りょう'],
    'ぎゃ': ['ぎゃく', 'ぎゃんぶる', 'ぎゃらりー'], 'ぎゅ': ['ぎゅうにく', 'ぎゅっと', 'ぎゅうどん'], 'ぎょ': ['ぎょかい', 'ぎょうざ', 'ぎょうむ'],
    'じゃ': ['じゃがいも', 'じゃんぷ', 'じゃーなる'], 'じゅ': ['じゅぎょう', 'じゅんび', 'じゅうたい'], 'じょ': ['じょうほう', 'じょせい', 'じょうけん'],
    'びゃ': ['びゃっか', 'びょういん', 'びゃっし'], 'びゅ': ['びゅー', 'びゅーぽいんと', 'びゅーちふぉと'], 'びょ': ['びょうき', 'びょうどう', 'びょうん'],
    'ぴゃ': ['ぴゃーる', 'ぴゃっとな', 'ぴょんぴょん'], 'ぴゅ': ['ぴゅーま', 'ぴゅあ', 'ぴゅーる'], 'ぴょ': ['ぴょんぎょ', 'ぴょんぴょん', 'ぴょんと'],
}

function buildJaPhonemes(): Phoneme[] {
    const result: Phoneme[] = []
    const push = (items: string[], groupLabel: string, group: string, type: Phoneme['type']) => {
        for (const kana of items) {
            result.push({
                ipa: kana,
                type,
                group: type === 'vowel' ? 'short' : group as Phoneme['group'],
                groupLabel,
                examples: KANA_EXAMPLES[kana] || [kana],
                articulation: kana,
                tip: `${groupLabel}：${kana}（罗马音 ${kana}）`,
            })
        }
    }
    for (const row of KANA_CLEAN) {
        // あ行按元音处理（日语基本元音 5 个）
        const type: Phoneme['type'] = row.label === 'あ行' ? 'vowel' : 'consonant'
        push(row.items, row.label, 'kana', type)
    }
    for (const row of KANA_VOICED) push(row.items, row.label, 'kana', 'consonant')
    for (const row of KANA_YOON) push(row.items, row.label, 'kana', 'consonant')
    return result
}

const JA_ALL = buildJaPhonemes()

const JA_TABLE: PhonemeGroup[] = [
    {
        title: '清音（五十音）',
        subtitle: 'Hiragana · 46',
        sections: KANA_CLEAN.map(row => ({label: row.label, en: '', phonemes: JA_ALL.filter(p => row.items.includes(p.ipa))})),
    },
    {
        title: '浊音 / 半浊音',
        subtitle: 'Daku-on · 25',
        sections: KANA_VOICED.map(row => ({label: row.label, en: '', phonemes: JA_ALL.filter(p => row.items.includes(p.ipa))})),
    },
    {
        title: '拗音',
        subtitle: 'Yō-on · 33',
        sections: KANA_YOON.map(row => ({label: row.label, en: '', phonemes: JA_ALL.filter(p => row.items.includes(p.ipa))})),
    },
]

// ============================================================================
// 俄语：33 西里尔字母
// ============================================================================

const RU_LETTERS: Array<{letter: string; sound: string; tip: string; word: string}> = [
    {letter: 'А а', sound: 'а', tip: '同汉语"啊"', word: 'арбуз（西瓜）'},
    {letter: 'Б б', sound: 'б', tip: '清浊成对浊辅音，类似 b', word: 'банан（香蕉）'},
    {letter: 'В в', sound: 'в', tip: '类似 v，不是 w', word: 'вода（水）'},
    {letter: 'Г г', sound: 'г', tip: '类似 g', word: 'город（城市）'},
    {letter: 'Д д', sound: 'д', tip: '类似 d', word: 'дом（房子）'},
    {letter: 'Е е', sound: 'е', tip: '类似 ye', word: 'еда（食物）'},
    {letter: 'Ё ё', sound: 'ё', tip: '类似 yo，永远重读', word: 'ёлка（枞树）'},
    {letter: 'Ж ж', sound: 'ж', tip: '类似汉语"日"的声母', word: 'жизнь（生命）'},
    {letter: 'З з', sound: 'з', tip: '类似 z', word: 'зима（冬天）'},
    {letter: 'И и', sound: 'и', tip: '类似 i', word: 'имя（名字）'},
    {letter: 'Й й', sound: 'й', tip: '短 i，半元音', word: 'чай（茶）'},
    {letter: 'К к', sound: 'к', tip: '类似 k，不送气', word: 'кот（猫）'},
    {letter: 'Л л', sound: 'л', tip: '类似 l，舌抵上齿龈', word: 'луна（月亮）'},
    {letter: 'М м', sound: 'м', tip: '类似 m', word: 'мама（妈妈）'},
    {letter: 'Н н', sound: 'н', tip: '类似 n', word: 'нос（鼻子）'},
    {letter: 'О о', sound: 'о', tip: '非重读时弱化为 а', word: 'окно（窗户）'},
    {letter: 'П п', sound: 'п', tip: '类似 p，不送气', word: 'папа（爸爸）'},
    {letter: 'Р р', sound: 'р', tip: '大舌颤音 r', word: 'рука（手）'},
    {letter: 'С с', sound: 'с', tip: '类似 s', word: 'спасибо（谢谢）'},
    {letter: 'Т т', sound: 'т', tip: '类似 t，不送气', word: 'такси（出租车）'},
    {letter: 'У у', sound: 'у', tip: '类似 u', word: 'утро（早晨）'},
    {letter: 'Ф ф', sound: 'ф', tip: '类似 f', word: 'фото（照片）'},
    {letter: 'Х х', sound: 'х', tip: '类似汉语 h，但更靠后', word: 'хорошо（好）'},
    {letter: 'Ц ц', sound: 'ц', tip: '类似 ts', word: 'центр（中心）'},
    {letter: 'Ч ч', sound: 'ч', tip: '类似 ch', word: 'чай（茶）'},
    {letter: 'Ш ш', sound: 'ш', tip: '类似翘舌 sh', word: 'школа（学校）'},
    {letter: 'Щ щ', sound: 'щ', tip: '长软 sh', word: 'щётка（刷子）'},
    {letter: 'Ъ', sound: '', tip: '硬音符号，不发音，分隔辅音', word: 'объект'},
    {letter: 'Ы ы', sound: 'ы', tip: '介于 i/u 之间的紧元音', word: 'сын（儿子）'},
    {letter: 'Ь', sound: '', tip: '软音符号，不发音，软化前面的辅音', word: 'моль'},
    {letter: 'Э э', sound: 'э', tip: '类似 e', word: 'это（这是）'},
    {letter: 'Ю ю', sound: 'ю', tip: '类似 yu', word: 'юг（南方）'},
    {letter: 'Я я', sound: 'я', tip: '类似 ya', word: 'яблоко（苹果）'},
]

const RU_ALL: Phoneme[] = RU_LETTERS.map(l => ({
    ipa: l.letter,
    type: 'consonant',
    group: 'kana' as const,
    groupLabel: '西里尔字母',
    examples: [l.word],
    articulation: l.letter,
    tip: `发音 ${l.sound || '（不发音）'}：${l.tip}`,
}))

const RU_TABLE: PhonemeGroup[] = [
    {title: '西里尔字母', subtitle: 'Кириллица · 33', sections: [{label: '全部字母', en: 'Alphabet', phonemes: RU_ALL}]},
]

// ============================================================================
// 西班牙语精简集
// ============================================================================

const ES_ITEMS: Array<{ipa: string; groupLabel: string; examples: string[]; articulation: string; tip: string}> = [
    {ipa: 'a', groupLabel: '元音', examples: ['casa', 'gato'], articulation: 'a', tip: '类似汉语 a，口大开'},
    {ipa: 'e', groupLabel: '元音', examples: ['mesa', 'bebé'], articulation: 'e', tip: '类似 ei 的前半'},
    {ipa: 'i', groupLabel: '元音', examples: ['sí', 'niño'], articulation: 'i', tip: '类似 i，短促'},
    {ipa: 'o', groupLabel: '元音', examples: ['oso', 'sol'], articulation: 'o', tip: '类似 o，圆唇'},
    {ipa: 'u', groupLabel: '元音', examples: ['tú', 'uno'], articulation: 'u', tip: '类似 u'},
    {ipa: 'ñ', groupLabel: '特色辅音', examples: ['año', 'mañana'], articulation: 'ni', tip: '类似汉语"尼"的声母'},
    {ipa: 'j', groupLabel: '特色辅音', examples: ['jamón', 'trabajo'], articulation: 'h', tip: '强送气 h'},
    {ipa: 'rr', groupLabel: '特色辅音', examples: ['perro', 'carro'], articulation: 'rr', tip: '大舌颤音'},
    {ipa: 'r', groupLabel: '特色辅音', examples: ['pero', 'caro'], articulation: 'r', tip: '单击闪音'},
    {ipa: 'z', groupLabel: '特色辅音', examples: ['zapato', 'cazar'], articulation: 'th', tip: '西班牙本土读 th，拉美读 s'},
    {ipa: 'c(a/o/u)', groupLabel: '特色辅音', examples: ['casa', 'comer'], articulation: 'k', tip: '在 a/o/u 前读 k'},
    {ipa: 'c(e/i)', groupLabel: '特色辅音', examples: ['cenar', 'cinco'], articulation: 'th', tip: '在 e/i 前本土读 th，拉美读 s'},
    {ipa: 'g(a/o/u)', groupLabel: '特色辅音', examples: ['gato', 'gusto'], articulation: 'g', tip: '硬 g'},
    {ipa: 'g(e/i)', groupLabel: '特色辅音', examples: ['gente', 'girar'], articulation: 'h', tip: '在 e/i 前读强 h'},
    {ipa: 'h', groupLabel: '特色辅音', examples: ['hola', 'hotel'], articulation: '', tip: '不发音！hola 读"奥拉"'},
    {ipa: 'll', groupLabel: '特色辅音', examples: ['llave', 'llamar'], articulation: 'y', tip: '多数地区读 y'},
    {ipa: 'v', groupLabel: '特色辅音', examples: ['vino', 'verde'], articulation: 'b', tip: '与 b 同音'},
    {ipa: 'b', groupLabel: '特色辅音', examples: ['bueno', 'boda'], articulation: 'b', tip: '词中间弱化为唇间音'},
    {ipa: 'd', groupLabel: '特色辅音', examples: ['dedo', 'dado'], articulation: 'd', tip: '词中间弱化为齿间擦音'},
    {ipa: 'gü', groupLabel: '特色辅音', examples: ['pingüino', 'vergüenza'], articulation: 'gw', tip: 'ü 表示 u 要发音'},
]

const ES_ALL: Phoneme[] = ES_ITEMS.map(i => ({
    ipa: i.ipa, type: i.groupLabel === '元音' ? 'vowel' as const : 'consonant' as const,
    group: i.groupLabel === '元音' ? 'short' as const : 'kana' as const,
    groupLabel: i.groupLabel, examples: i.examples, articulation: i.articulation, tip: i.tip,
}))

const ES_TABLE: PhonemeGroup[] = [
    {title: '西班牙语发音', subtitle: 'Español · 20', sections: [
        {label: '元音', en: 'Vocales', phonemes: ES_ALL.filter(p => p.groupLabel === '元音')},
        {label: '特色辅音', en: 'Consonantes', phonemes: ES_ALL.filter(p => p.groupLabel !== '元音')},
    ]},
]

// ============================================================================
// 法语精简集
// ============================================================================

const FR_ITEMS: Array<{ipa: string; groupLabel: string; examples: string[]; articulation: string; tip: string}> = [
    {ipa: 'a', groupLabel: '元音', examples: ['chat', 'papa'], articulation: 'a', tip: '类似 a'},
    {ipa: 'e', groupLabel: '元音', examples: ['été', 'thé'], articulation: 'é', tip: '闭 e，类似 ei'},
    {ipa: 'è', groupLabel: '元音', examples: ['mère', 'père'], articulation: 'è', tip: '开 e，类似 ai'},
    {ipa: 'i', groupLabel: '元音', examples: ['vie', 'fille'], articulation: 'i', tip: '类似 i'},
    {ipa: 'o', groupLabel: '元音', examples: ['eau', 'dos'], articulation: 'o', tip: '闭 o'},
    {ipa: 'u', groupLabel: '元音', examples: ['vous', 'lune'], articulation: 'ü', tip: '圆唇 i（发 i 时撮唇）'},
    {ipa: 'y', groupLabel: '元音', examples: ['vue', 'rue'], articulation: 'ü', tip: '与 u 同音'},
    {ipa: 'ou', groupLabel: '元音', examples: ['vous', 'jour'], articulation: 'u', tip: '类似 u'},
    {ipa: 'eu', groupLabel: '元音', examples: ['deux', 'peu'], articulation: 'ö', tip: '圆唇 e'},
    {ipa: 'oi', groupLabel: '元音', examples: ['moi', 'voiture'], articulation: 'wa', tip: '读 wa'},
    {ipa: 'an/en', groupLabel: '鼻化元音', examples: ['enfant', 'chanter'], articulation: 'an', tip: '鼻化 a，气流过鼻腔'},
    {ipa: 'on', groupLabel: '鼻化元音', examples: ['bon', 'monde'], articulation: 'on', tip: '鼻化 o'},
    {ipa: 'in/ain', groupLabel: '鼻化元音', examples: ['vin', 'pain'], articulation: 'an', tip: '鼻化 e'},
    {ipa: 'un', groupLabel: '鼻化元音', examples: ['un', 'brun'], articulation: 'on', tip: '现代法语多并入 in'},
    {ipa: 'r', groupLabel: '特色辅音', examples: ['paris', 'rouge'], articulation: 'r', tip: '小舌颤音 r'},
    {ipa: 'j', groupLabel: '特色辅音', examples: ['jour', 'bonjour'], articulation: 'zh', tip: '类似汉语"日"'},
    {ipa: 'gn', groupLabel: '特色辅音', examples: ['montagne', 'oignon'], articulation: 'ni', tip: '类似汉语"尼"'},
    {ipa: 'h', groupLabel: '特色辅音', examples: ['hôtel', 'homme'], articulation: '', tip: '永不发音'},
    {ipa: 'ch', groupLabel: '特色辅音', examples: ['chat', 'cher'], articulation: 'sh', tip: '读 sh'},
    {ipa: 'qu', groupLabel: '特色辅音', examples: ['quatre', 'qui'], articulation: 'k', tip: '读 k'},
]

const FR_ALL: Phoneme[] = FR_ITEMS.map(i => ({
    ipa: i.ipa,
    type: i.groupLabel === '鼻化元音' || i.ipa.length <= 2 ? 'vowel' as const : 'consonant' as const,
    group: 'kana' as const,
    groupLabel: i.groupLabel, examples: i.examples, articulation: i.articulation, tip: i.tip,
}))

const FR_TABLE: PhonemeGroup[] = [
    {title: '法语发音', subtitle: 'Français · 20', sections: [
        {label: '元音', en: 'Voyelles', phonemes: FR_ALL.filter(p => p.groupLabel === '元音')},
        {label: '鼻化元音', en: 'Nasales', phonemes: FR_ALL.filter(p => p.groupLabel === '鼻化元音')},
        {label: '特色辅音', en: 'Consonnes', phonemes: FR_ALL.filter(p => p.groupLabel === '特色辅音')},
    ]},
]

// ============================================================================
// 注册表
// ============================================================================

export interface PhoneticDataset {
    table: PhonemeGroup[]
    all: Phoneme[]
    /** 最小对立对（仅英语有数据） */
    minimalPairs?: import('@/utils/phoneme-data').MinimalPair[]
}

export const PHONETIC_DATASETS: Record<LanguageCode, PhoneticDataset> = {
    en: {table: EN_TABLE, all: EN_ALL},
    ja: {table: JA_TABLE, all: JA_ALL},
    ru: {table: RU_TABLE, all: RU_ALL},
    es: {table: ES_TABLE, all: ES_ALL},
    fr: {table: FR_TABLE, all: FR_ALL},
}

/** 按语言取数据集，非法语言回退英语 */
export function getPhoneticDataset(lang: LanguageCode | string | undefined | null): PhoneticDataset {
    return PHONETIC_DATASETS[(lang as LanguageCode)] ?? PHONETIC_DATASETS.en
}
