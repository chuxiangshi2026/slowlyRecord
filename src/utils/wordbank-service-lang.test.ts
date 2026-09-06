/**
 * 多语言相关词库数据单测：JLPT N5 词库 JSON + 词汇量等级表 + 字母表
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { WORDBANK_LIST } from './wordbank-service'
import { WORD_BANK_LEVELS, WORD_BANK_LEVELS_BY_LANG, getWordBankLevels } from '@/stores/vocabularyTest'
import { getAlphabetLetters } from '@/utils/letter-memory-preset'

describe('wordbank-service / jlpt-n5', () => {
  it('注册表包含 jlpt-n5 类型', () => {
    const info = WORDBANK_LIST.find(wb => wb.id === 'jlpt-n5')
    expect(info).toBeDefined()
    expect(info?.name).toBe('JLPT N5')
  })

  it('词库 JSON 有效且词数 > 100', () => {
    const raw = JSON.parse(readFileSync(resolve(process.cwd(), 'public/wordbanks/jlpt-n5.json'), 'utf-8')) as
      Array<{ word: string; explains: string }>
    expect(raw.length).toBeGreaterThan(100)
    // 日语词形 + 中文释义
    expect(raw.every(w => w.word.trim().length > 0 && w.explains.trim().length > 0)).toBe(true)
    expect(raw.some(w => /[぀-ヿ]/.test(w.word))).toBe(true)
  })
})

describe('vocabularyTest / 按语言等级表', () => {
  it('英语保持 CET~GRE 阶梯（回归基线）', () => {
    expect(WORD_BANK_LEVELS.map(l => l.id)).toEqual(['cet4', 'cet6', 'kaoyan', 'ielts', 'toefl', 'gmat', 'gre'])
    expect(getWordBankLevels('en')).toBe(WORD_BANK_LEVELS)
  })

  it('日语 JLPT N5~N1', () => {
    expect(WORD_BANK_LEVELS_BY_LANG.ja.map(l => l.id)).toEqual(['n5', 'n4', 'n3', 'n2', 'n1'])
    expect(WORD_BANK_LEVELS_BY_LANG.ja[0].minWords).toBe(800)
  })

  it('ru/es/fr 用 CEFR 档位', () => {
    for (const lang of ['ru', 'es', 'fr']) {
      expect(WORD_BANK_LEVELS_BY_LANG[lang].map(l => l.id)).toEqual(['a1', 'a2', 'b1', 'b2', 'c1', 'c2'])
    }
  })

  it('getWordBankLevels 非法语言回退英语', () => {
    expect(getWordBankLevels('xx')).toBe(WORD_BANK_LEVELS)
  })
})

describe('letter-memory-preset / 按语言字母表', () => {
  it('英语 26 字母（回归基线）', () => {
    expect(getAlphabetLetters('en').length).toBe(26)
    expect(getAlphabetLetters('en')[0]).toBe('a')
  })

  it('日语假名 46 个（不含浊音/拗音）', () => {
    const ja = getAlphabetLetters('ja')
    expect(ja.length).toBe(46)
    expect(ja).toContain('あ')
    expect(ja).toContain('ん')
    expect(ja).not.toContain('が') // 浊音不进基础字母表
  })

  it('俄语 33 / 西语 27（含 ñ）/ 法语 26', () => {
    expect(getAlphabetLetters('ru').length).toBe(33)
    const es = getAlphabetLetters('es')
    expect(es.length).toBe(27)
    expect(es).toContain('ñ')
    expect(getAlphabetLetters('fr').length).toBe(26)
  })

  it('非法语言回退英语', () => {
    expect(getAlphabetLetters('xx')).toEqual(getAlphabetLetters('en'))
  })
})
