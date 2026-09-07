/**
 * 记忆测试用基础词表（按语言）
 * 各 30 个常用词，用于 MemoryTest 的单词记忆模式。
 */
import type { LanguageCode } from '@/utils/language/types'

export const BASIC_WORDS_BY_LANG: Record<LanguageCode, string[]> = {
    en: [
        'apple', 'book', 'cat', 'dog', 'egg', 'fish', 'girl', 'hat', 'ice', 'jump',
        'kite', 'lamp', 'moon', 'nest', 'orange', 'pen', 'queen', 'rose', 'sun', 'tree',
        'umbrella', 'violin', 'water', 'box', 'yellow', 'zoo', 'ant', 'bird', 'car', 'desk',
    ],
    ja: [
        'ねこ', 'いぬ', 'みず', 'やま', 'そら', 'はな', 'ひと', 'みち', 'うみ', 'ほし',
        'つき', 'ひかり', 'とり', 'さかな', 'たまご', 'ぱん', 'くつ', 'かさ', 'ゆき', 'はる',
        'ともだち', 'がっこう', 'せんせい', 'こども', 'ちゃいろ', 'きょうと', 'あさごはん', 'ゆうびん', 'きって', 'りんご',
    ],
    ru: [
        'кот', 'дом', 'вода', 'мир', 'друг', 'рука', 'ночь', 'день', 'хлеб', 'мама',
        'папа', 'сын', 'глаз', 'нос', 'зима', 'лето', 'лес', 'море', 'небо', 'солнце',
        'школа', 'книга', 'стол', 'стул', 'окно', 'дверь', 'дорога', 'город', 'время', 'слово',
    ],
    es: [
        'casa', 'agua', 'gato', 'perro', 'sol', 'luna', 'árbol', 'pan', 'leche', 'amigo',
        'niño', 'libro', 'mesa', 'silla', 'puerta', 'ventana', 'cielo', 'mar', 'flor', 'manzana',
        'escuela', 'ciudad', 'noche', 'día', 'manos', 'verde', 'negro', 'tigre', 'pájaro', 'caballo',
    ],
    fr: [
        'maison', 'eau', 'chat', 'chien', 'soleil', 'lune', 'arbre', 'pain', 'lait', 'ami',
        'enfant', 'livre', 'table', 'chaise', 'porte', 'fenêtre', 'ciel', 'mer', 'fleur', 'pomme',
        'école', 'ville', 'nuit', 'jour', 'main', 'vert', 'noir', 'tigre', 'oiseau', 'cheval',
    ],
}

/** 按语言取词表，非法语言回退英语 */
export function getBasicWords(lang: string): string[] {
    return BASIC_WORDS_BY_LANG[(lang as LanguageCode)] || BASIC_WORDS_BY_LANG.en
}
