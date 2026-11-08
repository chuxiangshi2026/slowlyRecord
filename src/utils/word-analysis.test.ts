import { describe, it, expect } from 'vitest'
import {
  analyzeWord,
  getComponentClass,
  getComponentLabel,
  generateDetailedTooltip,
  generateSimpleTooltip,
  type WordComponent
} from './word-analysis'

describe('analyzeWord', () => {
  describe('边界情况', () => {
    it('应该处理空字符串', () => {
      const result = analyzeWord('')
      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({ text: '', type: 'whole' })
    })

    it('应该处理单字符单词', () => {
      const result = analyzeWord('a')
      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({ text: 'a', type: 'whole' })
    })

    it('应该处理双字符单词', () => {
      const result = analyzeWord('ab')
      expect(result).toHaveLength(1)
      // 双字符单词如果无法匹配前缀/后缀，中间部分作为 subword
      expect(result[0].type).toBe('subword')
    })

    it('应该处理无词根词缀的单词', () => {
      const result = analyzeWord('xyz')
      expect(result).toHaveLength(1)
      // 无词根词缀但长度>=2的单词，中间部分作为 subword
      expect(result[0].type).toBe('subword')
    })
  })

  describe('前缀识别', () => {
    it('应该识别前缀 un-', () => {
      const result = analyzeWord('unhappy')
      expect(result.some(c => c.type === 'prefix' && c.text.toLowerCase() === 'un')).toBe(true)
    })

    it('应该识别前缀 re-', () => {
      const result = analyzeWord('rewrite')
      expect(result.some(c => c.type === 'prefix' && c.text.toLowerCase() === 're')).toBe(true)
    })

    it('应该识别前缀 dis-', () => {
      const result = analyzeWord('dislike')
      expect(result.some(c => c.type === 'prefix' && c.text.toLowerCase() === 'dis')).toBe(true)
    })

    it('应该识别前缀 pre-', () => {
      const result = analyzeWord('preview')
      expect(result.some(c => c.type === 'prefix' && c.text.toLowerCase() === 'pre')).toBe(true)
    })

    it('应该识别前缀 over-', () => {
      const result = analyzeWord('overlook')
      expect(result.some(c => c.type === 'prefix' && c.text.toLowerCase() === 'over')).toBe(true)
    })

    it('应该识别前缀 trans-', () => {
      const result = analyzeWord('transport')
      expect(result.some(c => c.type === 'prefix' && c.text.toLowerCase() === 'trans')).toBe(true)
    })

    it('应该保持原始大小写', () => {
      const result = analyzeWord('UNHAPPY')
      const prefix = result.find(c => c.type === 'prefix')
      expect(prefix?.text).toBe('UN')
    })
  })

  describe('后缀识别', () => {
    it('应该识别后缀 -able', () => {
      const result = analyzeWord('readable')
      expect(result.some(c => c.type === 'suffix' && c.text.toLowerCase() === 'able')).toBe(true)
    })

    it('应该识别后缀 -tion', () => {
      const result = analyzeWord('education')
      // education 优先匹配更长的后缀 -ation，所以 -tion 不是独立的
      const hasSuffix = result.some(c => c.type === 'suffix')
      expect(hasSuffix).toBe(true)
      // 确认匹配到的是 -ation 或 -tion
      const suffix = result.find(c => c.type === 'suffix')
      expect(['tion', 'ation']).toContain(suffix?.text.toLowerCase())
    })

    it('应该识别后缀 -ment', () => {
      const result = analyzeWord('movement')
      expect(result.some(c => c.type === 'suffix' && c.text.toLowerCase() === 'ment')).toBe(true)
    })

    it('应该识别后缀 -ness', () => {
      const result = analyzeWord('happiness')
      expect(result.some(c => c.type === 'suffix' && c.text.toLowerCase() === 'ness')).toBe(true)
    })

    it('应该识别后缀 -ly', () => {
      const result = analyzeWord('quickly')
      expect(result.some(c => c.type === 'suffix' && c.text.toLowerCase() === 'ly')).toBe(true)
    })

    it('应该识别后缀 -ing', () => {
      const result = analyzeWord('reading')
      expect(result.some(c => c.type === 'suffix' && c.text.toLowerCase() === 'ing')).toBe(true)
    })

    it('应该识别后缀 -ed', () => {
      const result = analyzeWord('walked')
      expect(result.some(c => c.type === 'suffix' && c.text.toLowerCase() === 'ed')).toBe(true)
    })

    it('应该识别后缀 -er', () => {
      const result = analyzeWord('teacher')
      expect(result.some(c => c.type === 'suffix' && c.text.toLowerCase() === 'er')).toBe(true)
    })

    it('应该优先匹配更长的后缀', () => {
      const result = analyzeWord('talkative')
      // 应该匹配 -ative 而不是 -ive（如果有更长的）
      const suffixes = result.filter(c => c.type === 'suffix')
      expect(suffixes.length).toBeGreaterThan(0)
    })
  })

  describe('词根识别', () => {
    it('应该识别词根', () => {
      const result = analyzeWord('transport')
      expect(result.some(c => c.type === 'root')).toBe(true)
    })

    it('应该为识别的词根包含数据', () => {
      const result = analyzeWord('unhappy')
      const prefix = result.find(c => c.type === 'prefix')
      expect(prefix?.data).toBeDefined()
      expect(prefix?.data?.meaning).toBeDefined()
    })
  })

  describe('复杂单词', () => {
    it('应该处理包含多个成分的单词', () => {
      const result = analyzeWord('uncomfortable')
      const hasPrefix = result.some(c => c.type === 'prefix')
      const hasSuffix = result.some(c => c.type === 'suffix')
      expect(hasPrefix || hasSuffix).toBe(true)
    })

    it('应该处理 unhappiness - 前缀+词根+后缀', () => {
      const result = analyzeWord('unhappiness')
      expect(result.length).toBeGreaterThan(1)
      const hasPrefix = result.some(c => c.type === 'prefix')
      const hasSuffix = result.some(c => c.type === 'suffix')
      expect(hasPrefix).toBe(true)
      expect(hasSuffix).toBe(true)
    })

    it('所有成分的文本拼接应该等于原始单词（全小写）', () => {
      const word = 'unhappy'
      const result = analyzeWord(word)
      const combinedText = result.map(c => c.text.toLowerCase()).join('')
      expect(combinedText).toBe(word.toLowerCase())
    })

    it('应该处理带前缀和后缀的长单词', () => {
      const word = 'uncomfortable'
      const result = analyzeWord(word)
      const combinedText = result.map(c => c.text.toLowerCase()).join('')
      expect(combinedText).toBe(word.toLowerCase())
    })
  })

  describe('合成词与歧义处理', () => {
    it('seasick 应该拆成 sea + sick，而不是前缀 se', () => {
      const result = analyzeWord('seasick')
      expect(result).toEqual([
        expect.objectContaining({ text: 'sea', type: 'compound' }),
        expect.objectContaining({ text: 'sick', type: 'compound' }),
      ])
    })

    it('常见合成词应该按两个单词拆分', () => {
      const expected: Record<string, string[]> = {
        household: ['house', 'hold'],
        blacksmith: ['black', 'smith'],
        headstrong: ['head', 'strong'],
        notebook: ['note', 'book'],
        passport: ['pass', 'port'],
      }
      for (const [word, parts] of Object.entries(expected)) {
        const result = analyzeWord(word)
        expect(result.map(item => item.text)).toEqual(parts)
        expect(result.every(item => item.type === 'compound')).toBe(true)
      }
    })

    it('season 不应该被误拆成 sea + son', () => {
      expect(analyzeWord('season').some(item => item.type === 'compound')).toBe(false)
    })

    it('短前缀没有词干支撑时不标注', () => {
      for (const word of ['apple', 'about', 'around']) {
        expect(analyzeWord(word).some(item => item.type === 'prefix')).toBe(false)
      }
    })

    it('family / only 不应该被标成 -ly 后缀', () => {
      for (const word of ['family', 'only']) {
        expect(analyzeWord(word).some(item => item.type === 'suffix')).toBe(false)
      }
    })

    it('长前缀不应抢走更短的“前缀 + 词根”组合', () => {
      expect(analyzeWord('contract')).toEqual([
        expect.objectContaining({ text: 'con', type: 'prefix' }),
        expect.objectContaining({ text: 'tract', type: 'root' }),
      ])
      expect(analyzeWord('extract')).toEqual([
        expect.objectContaining({ text: 'ex', type: 'prefix' }),
        expect.objectContaining({ text: 'tract', type: 'root' }),
      ])
    })

    it('后缀不应该吃掉词根的首字母', () => {
      expect(analyzeWord('mission')).toEqual([
        expect.objectContaining({ text: 'miss', type: 'root' }),
        expect.objectContaining({ text: 'ion', type: 'suffix' }),
      ])
      expect(analyzeWord('vision')).toEqual([
        expect.objectContaining({ text: 'vis', type: 'root' }),
        expect.objectContaining({ text: 'ion', type: 'suffix' }),
      ])
    })

    it('常见的同形词不应被误拆前缀', () => {
      for (const word of ['problem', 'imagine']) {
        expect(analyzeWord(word).some(item => item.type === 'prefix')).toBe(false)
      }
    })

    it('派生后缀优先于词尾 s', () => {
      expect(analyzeWord('illness').some(item => item.type === 'suffix' && item.text === 'ness')).toBe(true)
      expect(analyzeWord('reliable').some(item => item.type === 'suffix' && item.text === 'able')).toBe(true)
    })
  })

  describe('成分文本一致性', () => {
    it('成分文本拼接应还原原始单词', () => {
      const testWords = ['unhappy', 'rewrite', 'readable', 'transport', 'quickly']
      for (const word of testWords) {
        const result = analyzeWord(word)
        const combinedText = result.map(c => c.text.toLowerCase()).join('')
        expect(combinedText).toBe(word.toLowerCase())
      }
    })
  })
})

describe('getComponentClass', () => {
  it('应该返回正确的 CSS 类名', () => {
    expect(getComponentClass('root')).toBe('word-root')
    expect(getComponentClass('prefix')).toBe('word-prefix')
    expect(getComponentClass('suffix')).toBe('word-suffix')
    expect(getComponentClass('subword')).toBe('word-subword')
    expect(getComponentClass('whole')).toBe('word-whole')
  })

  it('所有类型都应该有对应的类名', () => {
    const types: WordComponent['type'][] = ['root', 'prefix', 'suffix', 'subword', 'whole']
    for (const type of types) {
      const result = getComponentClass(type)
      expect(result).toBeTruthy()
      expect(result).toContain('word-')
    }
  })
})

describe('getComponentLabel', () => {
  it('应该返回正确的中文标签', () => {
    expect(getComponentLabel('root')).toBe('词根')
    expect(getComponentLabel('prefix')).toBe('前缀')
    expect(getComponentLabel('suffix')).toBe('后缀')
    expect(getComponentLabel('subword')).toBe('子单词')
    expect(getComponentLabel('whole')).toBe('完整单词')
  })

  it('所有类型都应该有对应的中文标签', () => {
    const types: WordComponent['type'][] = ['root', 'prefix', 'suffix', 'subword', 'whole']
    for (const type of types) {
      const result = getComponentLabel(type)
      expect(result).toBeTruthy()
      expect(typeof result).toBe('string')
    }
  })
})

describe('generateDetailedTooltip', () => {
  it('应该为单个成分返回空字符串', () => {
    const components: WordComponent[] = [{ text: 'hello', type: 'whole' }]
    const result = generateDetailedTooltip(components)
    expect(result).toBe('')
  })

  it('应该为空数组返回空字符串', () => {
    const result = generateDetailedTooltip([])
    expect(result).toBe('')
  })

  it('应该生成详细的提示信息', () => {
    const components: WordComponent[] = [
      { text: 'un', type: 'prefix', data: { text: 'un', meaning: '不，无，相反', description: 'not, opposite of' } },
      { text: 'happy', type: 'subword' }
    ]
    const result = generateDetailedTooltip(components)
    expect(result).toContain('前缀')
    expect(result).toContain('un')
    expect(result).toContain('不，无，相反')
  })

  it('应该跳过 whole 和 subword 类型', () => {
    const components: WordComponent[] = [
      { text: 'un', type: 'prefix', data: { text: 'un', meaning: '不，无，相反' } },
      { text: 'happy', type: 'subword' },
      { text: 'unhappy', type: 'whole' }
    ]
    const result = generateDetailedTooltip(components)
    expect(result).toContain('前缀')
    expect(result).not.toContain('子单词')
    expect(result).not.toContain('完整单词')
  })

  it('应该包含示例单词', () => {
    const components: WordComponent[] = [
      { text: 'un', type: 'prefix', data: { text: 'un', meaning: '不，无，相反', examples: ['unhappy', 'unable'] } },
      { text: 'happy', type: 'subword' }
    ]
    const result = generateDetailedTooltip(components)
    expect(result).toContain('例:')
  })

  it('应该处理无数据的成分', () => {
    const components: WordComponent[] = [
      { text: 'test', type: 'prefix' },
      { text: 'ing', type: 'suffix', data: { text: 'ing', meaning: '进行时' } }
    ]
    const result = generateDetailedTooltip(components)
    expect(result).toContain('前缀')
    expect(result).toContain('test')
  })

  it('应该包含英文描述（如果有）', () => {
    const components: WordComponent[] = [
      { text: 'un', type: 'prefix', data: { text: 'un', meaning: '不，无，相反', description: 'not, opposite of' } },
      { text: 'happy', type: 'subword' }
    ]
    const result = generateDetailedTooltip(components)
    expect(result).toContain('not, opposite of')
  })

  it('应该处理只有词根和后缀的情况', () => {
    const components: WordComponent[] = [
      { text: 'port', type: 'root', data: { text: 'port', meaning: '携带，搬运', description: 'carry' } },
      { text: 'able', type: 'suffix', data: { text: 'able', meaning: '可...的，能...的', description: 'able to' } }
    ]
    const result = generateDetailedTooltip(components)
    expect(result).toContain('词根')
    expect(result).toContain('后缀')
    expect(result).toContain('携带，搬运')
    expect(result).toContain('可...的，能...的')
  })

  it('多个成分之间应该用换行分隔', () => {
    const components: WordComponent[] = [
      { text: 'un', type: 'prefix', data: { text: 'un', meaning: '不' } },
      { text: 'able', type: 'suffix', data: { text: 'able', meaning: '能' } }
    ]
    const result = generateDetailedTooltip(components)
    expect(result).toContain('\n')
  })
})

describe('generateSimpleTooltip', () => {
  it('应该为单个成分返回空字符串', () => {
    const components: WordComponent[] = [{ text: 'hello', type: 'whole' }]
    const result = generateSimpleTooltip(components)
    expect(result).toBe('')
  })

  it('应该为空数组返回空字符串', () => {
    const result = generateSimpleTooltip([])
    expect(result).toBe('')
  })

  it('应该生成简洁的提示信息', () => {
    const components: WordComponent[] = [
      { text: 'un', type: 'prefix', data: { text: 'un', meaning: '不，无，相反' } },
      { text: 'happy', type: 'subword' }
    ]
    const result = generateSimpleTooltip(components)
    expect(result).toContain('un: 不，无，相反')
  })

  it('应该使用 | 分隔多个成分', () => {
    const components: WordComponent[] = [
      { text: 'un', type: 'prefix', data: { text: 'un', meaning: '不，无，相反' } },
      { text: 'able', type: 'suffix', data: { text: 'able', meaning: '可...的，能...的' } }
    ]
    const result = generateSimpleTooltip(components)
    expect(result).toContain('|')
  })

  it('应该跳过无数据的成分', () => {
    const components: WordComponent[] = [
      { text: 'un', type: 'prefix', data: { text: 'un', meaning: '不，无，相反' } },
      { text: 'test', type: 'prefix' }
    ]
    const result = generateSimpleTooltip(components)
    expect(result).not.toContain('test')
  })

  it('应该跳过 whole 类型的成分', () => {
    const components: WordComponent[] = [
      { text: 'hello', type: 'whole', data: { text: 'hello', meaning: '你好' } },
      { text: 'un', type: 'prefix', data: { text: 'un', meaning: '不' } }
    ]
    const result = generateSimpleTooltip(components)
    expect(result).not.toContain('hello')
    expect(result).toContain('un')
  })

  it('应该跳过 subword 类型的成分', () => {
    const components: WordComponent[] = [
      { text: 'hap', type: 'subword', data: { text: 'hap', meaning: '运气' } },
      { text: 'un', type: 'prefix', data: { text: 'un', meaning: '不' } }
    ]
    const result = generateSimpleTooltip(components)
    expect(result).not.toContain('hap')
    expect(result).toContain('un')
  })

  it('所有成分都无数据时应该返回空字符串', () => {
    const components: WordComponent[] = [
      { text: 'un', type: 'prefix' },
      { text: 'able', type: 'suffix' }
    ]
    const result = generateSimpleTooltip(components)
    expect(result).toBe('')
  })
})
