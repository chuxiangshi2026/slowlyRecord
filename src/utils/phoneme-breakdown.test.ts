/**
 * 音素切分单元测试
 */
import { describe, it, expect } from 'vitest'
import { breakdownPhonetic, BREAKDOWN_WORDS } from './phoneme-breakdown'

function ipaOf(phonetic: string): string[] {
  return breakdownPhonetic(phonetic).phonemes.map(p => p.ipa)
}

describe('breakdownPhonetic: 多字符音素优先', () => {
  it('tʃ 优先于 t+ʃ（chair）', () => {
    expect(ipaOf('tʃeə')).toEqual(['tʃ', 'eə'])
  })

  it('dʒ 优先于 d+ʒ（jump）', () => {
    expect(ipaOf('dʒʌmp')).toEqual(['dʒ', 'ʌ', 'm', 'p'])
  })

  it('iː 优先于 i+ː（see）', () => {
    expect(ipaOf('siː')).toEqual(['s', 'iː'])
  })

  it('双元音 eɪ 整体匹配（day）', () => {
    expect(ipaOf('deɪ')).toEqual(['d', 'eɪ'])
  })

  it('tr/dr 作为破擦音整体匹配（tree/dream）', () => {
    expect(ipaOf('triː')).toEqual(['tr', 'iː'])
    expect(ipaOf('driːm')).toEqual(['dr', 'iː', 'm'])
  })
})

describe('breakdownPhonetic: 输入归一化', () => {
  it('支持 /.../ 斜杠包裹与 ˈ 重音符（ship）', () => {
    const r = breakdownPhonetic('/ʃɪp/')
    expect(r.complete).toBe(true)
    expect(r.phonemes.map(p => p.ipa)).toEqual(['ʃ', 'ɪ', 'p'])
  })

  it('支持 [ˈhɒt] 方括号包裹', () => {
    const r = breakdownPhonetic('[ˈhɒt]')
    expect(r.complete).toBe(true)
    expect(r.phonemes.map(p => p.ipa)).toEqual(['h', 'ɒ', 't'])
  })

  it('普通 g 归一化为 IPA ɡ（big）', () => {
    const r = breakdownPhonetic('bɪg')
    expect(r.complete).toBe(true)
    expect(r.phonemes.map(p => p.ipa)).toEqual(['b', 'ɪ', 'ɡ'])
  })

  it('半角冒号归一化为长音符号（si:）', () => {
    const r = breakdownPhonetic('si:')
    expect(r.complete).toBe(true)
    expect(r.phonemes.map(p => p.ipa)).toEqual(['s', 'iː'])
  })
})

describe('breakdownPhonetic: 无法识别的字符', () => {
  it('含未知道符时 complete=false 且跳过该字符', () => {
    const r = breakdownPhonetic('xɪp')
    expect(r.complete).toBe(false)
    expect(r.phonemes.map(p => p.ipa)).toEqual(['ɪ', 'p'])
  })

  it('空字符串视为完整切分（无跳过字符）', () => {
    expect(breakdownPhonetic('')).toEqual({ phonemes: [], complete: true })
  })
})

describe('BREAKDOWN_WORDS 数据完整性', () => {
  it('所有预设词的音标都能完整切分（complete=true）', () => {
    const failures = BREAKDOWN_WORDS.filter(w => !breakdownPhonetic(w.phonetic).complete)
    expect(failures).toEqual([])
  })

  it('预设词数量与难度分布合理', () => {
    expect(BREAKDOWN_WORDS.length).toBeGreaterThanOrEqual(25)
    for (const w of BREAKDOWN_WORDS) {
      const count = breakdownPhonetic(w.phonetic).phonemes.length
      expect(count).toBeGreaterThanOrEqual(2)
      expect(count).toBeLessThanOrEqual(5)
    }
  })
})
