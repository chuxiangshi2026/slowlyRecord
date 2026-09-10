/**
 * 遮挡回忆分块逻辑测试
 */
import { describe, it, expect } from 'vitest'
import { splitContentToBlocks, isArticleDue } from './recall'

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

describe('到期判定封装', () => {
  it('从未排期视为到期', () => {
    expect(isArticleDue(undefined, 1000)).toBe(true)
  })

  it('按 nextReview 与 now 比较', () => {
    expect(isArticleDue(1000, 1000)).toBe(true)
    expect(isArticleDue(1001, 1000)).toBe(false)
  })
})
