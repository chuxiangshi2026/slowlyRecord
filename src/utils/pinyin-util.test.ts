import { describe, expect, it } from 'vitest'
import { hasPinyin, splitAnnotatedLines, splitAnnotatedParagraphs } from './pinyin-util'

describe('pinyin-util', () => {
  it('按行配对正文与拼音，行数不足时补空', () => {
    expect(splitAnnotatedLines('床前明月光\n疑是地上霜', 'chuáng qián míng yuè guāng\nyí shì dì shàng shuāng'))
      .toEqual([
        { text: '床前明月光', pinyin: 'chuáng qián míng yuè guāng' },
        { text: '疑是地上霜', pinyin: 'yí shì dì shàng shuāng' },
      ])
    expect(splitAnnotatedLines('甲\n乙', 'jiǎ')).toEqual([
      { text: '甲', pinyin: 'jiǎ' },
      { text: '乙', pinyin: '' },
    ])
  })

  it('没有拼音时正文保持原样', () => {
    expect(splitAnnotatedLines('一行\n二行')).toEqual([
      { text: '一行', pinyin: '' },
      { text: '二行', pinyin: '' },
    ])
  })

  it('按空行分段并丢弃空段', () => {
    const paras = splitAnnotatedParagraphs('第一段\n\n第二段', 'dì yī duàn\n\n dì èr duàn')
    expect(paras).toHaveLength(2)
    expect(paras[1][0]).toEqual({ text: '第二段', pinyin: 'dì èr duàn' })
  })

  it('hasPinyin 识别空值', () => {
    expect(hasPinyin('nǐ hǎo')).toBe(true)
    expect(hasPinyin('   ')).toBe(false)
    expect(hasPinyin(undefined)).toBe(false)
  })
})
