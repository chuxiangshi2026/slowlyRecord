import { describe, expect, it } from 'vitest'
import type { LanguageCode } from './types'
import {
  compareWords,
  getActiveLanguage,
  getProfile,
  isPhraseText,
  isSpellChar,
  isValidLanguage,
  isWordText,
  listLanguages,
  normalizeForCompare,
  setActiveLanguage,
  splitSpellUnits,
  supportsSpelling,
  tokenize,
  wordCount,
} from './index'

const p = (lang: LanguageCode) => getProfile(lang)

describe('language/profiles', () => {
  it('五种语言档案齐全', () => {
    expect(listLanguages().map(l => l.code)).toEqual(['en', 'ja', 'ru', 'es', 'fr'])
    expect(p('en').ttsLang).toBe('en-US')
    expect(p('ja').ttsLang).toBe('ja-JP')
    expect(p('ja').youdaoVoiceType).toBeNull()
    expect(p('en').youdaoVoiceType).toBe(1)
    expect(p('ja').caseInsensitive).toBe(false)
    expect(p('ru').ocrLang).toBe('rus')
    expect(p('es').ocrLang).toBe('spa')
    expect(p('fr').ocrLang).toBe('fra')
  })

  it('非法语言回退 en', () => {
    expect(getProfile('xx').code).toBe('en')
    expect(getProfile(undefined).code).toBe('en')
    expect(isValidLanguage('ja')).toBe(true)
    expect(isValidLanguage('xx')).toBe(false)
  })

  it('激活语言的设置与回退', () => {
    setActiveLanguage('ja')
    expect(getActiveLanguage()).toBe('ja')
    setActiveLanguage('xx')
    expect(getActiveLanguage()).toBe('en')
    setActiveLanguage(undefined)
    expect(getActiveLanguage()).toBe('en')
  })
})

describe('language/text 英语行为（回归基线）', () => {
  let en: ReturnType<typeof p>
  beforeAll(() => { en = p('en') })

  it('isWordText 与原 /^[a-zA-Z0-9]+(?:[-\'\\s][a-zA-Z0-9]+)*$/ 行为一致', () => {
    expect(isWordText('hello', en)).toBe(true)
    expect(isWordText('well-known', en)).toBe(true)
    expect(isWordText("don't", en)).toBe(true)
    expect(isWordText('take care', en)).toBe(true)
    expect(isWordText('123', en)).toBe(false) // 纯数字不含字母
    expect(isWordText('你好', en)).toBe(false)
    expect(isWordText('食べる', en)).toBe(false)
    expect(isWordText('', en)).toBe(false)
    expect(isWordText('  ', en)).toBe(false)
  })

  it('tokenize 提取英文单词（保留大小写）', () => {
    expect(tokenize('Hello, hello world 123 IPv6', en)).toEqual(['Hello', 'hello', 'world', 'IPv6'])
    expect(tokenize("well-known don't", en)).toEqual(['well-known', "don't"])
  })

  it('wordCount/isPhraseText 按空格', () => {
    expect(wordCount('take care of', en)).toBe(3)
    expect(isPhraseText('take care', en)).toBe(true)
    expect(isPhraseText('hello', en)).toBe(false)
  })

  it('normalizeForCompare 小写化', () => {
    expect(normalizeForCompare('  Hello  World ', en)).toBe('hello world')
  })

  it('拼写模式：a-zA-Z 单键，逐字母切分', () => {
    expect(isSpellChar('a', en)).toBe(true)
    expect(isSpellChar('1', en)).toBe(false)
    expect(isSpellChar('ab', en)).toBe(false)
    expect(supportsSpelling(en)).toBe(true)
    expect(splitSpellUnits('cat', en)).toEqual(['c', 'a', 't'])
  })

  it('compareWords 使用 en locale', () => {
    expect(compareWords('apple', 'banana', en)).toBeLessThan(0)
  })
})

describe('language/text 日语', () => {
  let ja: ReturnType<typeof p>
  beforeAll(() => { ja = p('ja') })

  it('isWordText 接受汉字/假名/长音符', () => {
    expect(isWordText('食べる', ja)).toBe(true)
    expect(isWordText('パソコン', ja)).toBe(true)
    expect(isWordText('ラーメン', ja)).toBe(true)
    expect(isWordText('hello', ja)).toBe(false) // 纯拉丁词不算日语词
    expect(isWordText('食べ る', ja)).toBe(false) // 含空格
  })

  it('tokenize 用 Intl.Segmenter 或降级分词', () => {
    const tokens = tokenize('私は毎日日本語を勉強する', ja)
    expect(tokens.length).toBeGreaterThan(1)
    expect(tokens.join('')).toBe('私は毎日日本語を勉強する')
  })

  it('isPhraseText/wordCount 按分词数量', () => {
    expect(wordCount('食べる', ja)).toBe(1)
    expect(isPhraseText('食べる', ja)).toBe(false)
    expect(isPhraseText('猫を飼う', ja)).toBe(true)
  })

  it('normalizeForCompare 不小写化', () => {
    expect(normalizeForCompare('カタカナ', ja)).toBe('カタカナ')
  })

  it('grapheme 切分组合假名', () => {
    expect(splitSpellUnits('きゃ', ja)).toEqual(['きゃ'])
    expect(splitSpellUnits('がく', ja)).toEqual(['が', 'く'])
  })

  it('日语不支持拼写模式', () => {
    expect(supportsSpelling(ja)).toBe(false)
    expect(isSpellChar('あ', ja)).toBe(false)
  })
})

describe('language/text 俄/西/法', () => {
  it('俄语西里尔字母', () => {
    const ru = p('ru') // eslint 下行断言在 it 内执行，profile 此时已加载
    expect(isWordText('привет', ru)).toBe(true)
    expect(isWordText('кошка', ru)).toBe(true)
    expect(isWordText('hello', ru)).toBe(true) // 拉丁字母不阻止（混合词库容忍）
    expect(isWordText('食べる', ru)).toBe(false)
    expect(normalizeForCompare('ПРИВЕТ', ru)).toBe('привет')
    expect(isSpellChar('п', ru)).toBe(true)
    expect(splitSpellUnits('кот', ru)).toEqual(['к', 'о', 'т'])
  })

  it('西班牙语重音字母与 ñ', () => {
    const es = p('es')
    expect(isWordText('niño', es)).toBe(true)
    expect(isWordText('corazón', es)).toBe(true)
    expect(tokenize('El niño come mañana', es)).toEqual(['El', 'niño', 'come', 'mañana'])
    expect(normalizeForCompare('NIÑO', es)).toBe('niño')
    expect(isSpellChar('ñ', es)).toBe(true)
  })

  it('法语重音字母与撇号', () => {
    const fr = p('fr')
    expect(isWordText('élève', fr)).toBe(true)
    expect(isWordText("l'école", fr)).toBe(true)
    expect(tokenize("l'école française", fr)).toEqual(["l'école", 'française'])
    expect(isSpellChar('é', fr)).toBe(true)
  })
})
