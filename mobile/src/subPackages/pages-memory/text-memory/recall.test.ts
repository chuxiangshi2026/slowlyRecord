/**
 * 遮挡回忆分块逻辑测试
 */
import { describe, it, expect } from 'vitest'
import { splitContentToBlocks, splitAnnotatedBlocks, firstCharHint, isArticleDue } from './recall'

describe('正文分块', () => {
  it('空内容返回空数组', () => {
    expect(splitContentToBlocks('')).toEqual([])
  })

  it('按行拆分并跳过空行', () => {
    const content = '床前明月光\n\n疑是地上霜\n\n\n举头望明月'
    expect(splitContentToBlocks(content)).toEqual([
      '床前明月光',
      '疑是地上霜',
      '举头望明月',
    ])
  })

  it('单行未超长时保留整行（含句读不拆）', () => {
    const content = '春眠不觉晓，处处闻啼鸟。'
    expect(splitContentToBlocks(content)).toEqual(['春眠不觉晓，处处闻啼鸟。'])
  })

  it('超长行按句读切分', () => {
    const content = '这是一个很长的句子用来测试切分逻辑，它应该被切成多个块。第二句也足够长以便继续分块处理。'
    const blocks = splitContentToBlocks(content)
    expect(blocks.length).toBeGreaterThan(1)
    expect(blocks.every((b) => b.length <= 40)).toBe(true)
    expect(blocks.join('')).toContain('第二句也足够长')
  })

  it('超长的单句按硬长度截断兜底', () => {
    const long = '啊'.repeat(100)
    const blocks = splitContentToBlocks(long)
    expect(blocks.length).toBe(3)
    expect(blocks[0].length).toBe(40)
  })
})

describe('带拼音分块', () => {
  it('无拼音时退化为普通分块', () => {
    const blocks = splitAnnotatedBlocks('床前明月光\n疑是地上霜')
    expect(blocks).toEqual([{ text: '床前明月光' }, { text: '疑是地上霜' }])
  })

  it('拼音与正文逐行配对', () => {
    const content = '床前明月光，疑是地上霜。\n举头望明月，低头思故乡。'
    const pinyin = 'chuáng qián míng yuè guāng，yí shì dì shàng shuāng。\njǔ tóu wàng míng yuè，dī tóu sī gù xiāng。'
    expect(splitAnnotatedBlocks(content, pinyin)).toEqual([
      { text: '床前明月光，疑是地上霜。', pinyin: 'chuáng qián míng yuè guāng，yí shì dì shàng shuāng。' },
      { text: '举头望明月，低头思故乡。', pinyin: 'jǔ tóu wàng míng yuè，dī tóu sī gù xiāng。' },
    ])
  })

  it('空行两侧同步跳过', () => {
    const content = '第一段\n\n第二段'
    const pinyin = 'dì yī duàn\n\ndì èr duàn'
    expect(splitAnnotatedBlocks(content, pinyin)).toEqual([
      { text: '第一段', pinyin: 'dì yī duàn' },
      { text: '第二段', pinyin: 'dì èr duàn' },
    ])
  })

  it('拼音行数不足时缺失侧留空，超长行保持整块', () => {
    const long = '啊'.repeat(60)
    const blocks = splitAnnotatedBlocks(`${long}\n短行`, 'ā ā ā')
    expect(blocks).toHaveLength(2)
    expect(blocks[0]).toEqual({ text: long, pinyin: 'ā ā ā' })
    expect(blocks[1]).toEqual({ text: '短行' })
  })
})

describe('首字提示', () => {
  it('取第一个非标点非空白字符', () => {
    expect(firstCharHint('床前明月光，')).toBe('床')
    expect(firstCharHint('Hello world')).toBe('H')
    expect(firstCharHint('（东风）夜放花千树')).toBe('东')
  })

  it('整块都是标点/空白时返回空串', () => {
    expect(firstCharHint('。，！')).toBe('')
    expect(firstCharHint('')).toBe('')
  })
})

describe('到期判定封装', () => {
  it('从未排期视为到期', () => {
    expect(isArticleDue(undefined, 1000)).toBe(true)
  })

  it('按 nextReview 与 now 比较', () => {
    expect(isArticleDue(1000, 1000)).toBe(true)
    expect(isArticleDue(1001, 1000)).toBe(false)
  })
})
