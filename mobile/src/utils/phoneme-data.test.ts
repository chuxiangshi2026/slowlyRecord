/**
 * phoneme-data.ts 数据完整性测试
 * 重点守护：48 音素速记总口诀必须一个不落地覆盖全部音素（漏音 = 口诀误人）
 */
import { describe, it, expect } from 'vitest'
import { ALL_PHONEMES, PHONEME_CHANT } from '@/utils/phoneme-data'

describe('PHONEME_CHANT 速记总口诀', () => {
  it('覆盖全部 48 个音素，无遗漏无多余', () => {
    const chantText = PHONEME_CHANT.join(' ')
    const covered = new Set<string>()
    for (const ph of ALL_PHONEMES) {
      if (chantText.includes(ph.ipa)) covered.add(ph.ipa)
    }
    expect(ALL_PHONEMES).toHaveLength(48)
    expect([...covered].sort()).toEqual(ALL_PHONEMES.map(p => p.ipa).sort())
  })

  it('每个音素都配了助记口诀与发音要点', () => {
    for (const ph of ALL_PHONEMES) {
      expect(ph.mnemonic, ph.ipa).toBeTruthy()
      expect(ph.tip, ph.ipa).toBeTruthy()
    }
  })
})
