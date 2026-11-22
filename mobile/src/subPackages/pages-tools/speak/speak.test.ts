/**
 * AI 口语输出解析（speak.ts）单测
 * 覆盖：标准两行、单行合并、引号包裹、无标记退化、空输入
 */
import { describe, it, expect } from 'vitest'
import { parseReply } from './speak'

describe('parseReply', () => {
  it('标准两行输出', () => {
    expect(parseReply('EN: That sounds great!\nZH: 太棒了！')).toEqual({
      en: 'That sounds great!',
      zh: '太棒了！',
    })
  })

  it('EN/ZH 并到一行时截掉 ZH 尾巴且仍能提取 ZH', () => {
    const { en, zh } = parseReply('EN: No worries, happens to everyone. ZH: 没事，谁都遇到过。')
    expect(en).toBe('No worries, happens to everyone.')
    expect(zh).toBe('没事，谁都遇到过。')
  })

  it('小写标记与引号包裹容错', () => {
    expect(parseReply('en: "You bet!"\nzh: 当然！')).toEqual({ en: 'You bet!', zh: '当然！' })
  })

  it('无标记时退化取首个非空行', () => {
    expect(parseReply('\nPiece of cake.\n小菜一碟。\n')).toEqual({ en: 'Piece of cake.', zh: '小菜一碟。' })
  })

  it('空输入返回空串', () => {
    expect(parseReply('')).toEqual({ en: '', zh: '' })
    expect(parseReply('  \n ')).toEqual({ en: '', zh: '' })
  })
})
