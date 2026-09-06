/**
 * 发音数据集注册表单测：五语言数据集完整性
 */
import { describe, expect, it } from 'vitest'
import { PHONETIC_DATASETS, getPhoneticDataset } from './index'

describe('phonetics/registry', () => {
  it('五语言数据集齐全', () => {
    expect(Object.keys(PHONETIC_DATASETS).sort()).toEqual(['en', 'es', 'fr', 'ja', 'ru'])
  })

  it('英语数据集与 phoneme-data 一致（回归基线）', () => {
    expect(PHONETIC_DATASETS.en.all.length).toBe(48)
    // 元音/辅音分组结构保留
    const titles = PHONETIC_DATASETS.en.table.map(g => g.title)
    expect(titles).toContain('元音')
    expect(titles).toContain('辅音')
  })

  it('日语五十音：清音46 + 浊音/半浊音25 + 拗音33 = 104 条', () => {
    const ja = PHONETIC_DATASETS.ja
    expect(ja.all.length).toBe(104)
    expect(ja.table.map(g => g.title)).toEqual(['清音（五十音）', '浊音 / 半浊音', '拗音'])
    // あ行按元音处理
    const a = ja.all.find(p => p.ipa === 'あ')
    expect(a?.type).toBe('vowel')
    // 组合假名作为整体存在
    expect(ja.all.some(p => p.ipa === 'きゃ')).toBe(true)
    // articulation 即假名本身（可 TTS）
    expect(a?.articulation).toBe('あ')
    // 例词来自 KANA_EXAMPLES
    expect(a?.examples.length).toBeGreaterThan(0)
  })

  it('俄语 33 个西里尔字母', () => {
    const ru = PHONETIC_DATASETS.ru
    expect(ru.all.length).toBe(33)
    // 硬音符号与软音符号不发音
    const tv = ru.all.find(p => p.ipa === 'Ъ')
    expect(tv?.tip).toContain('不发音')
  })

  it('西/法语精简集：含特色音素', () => {
    expect(PHONETIC_DATASETS.es.all.some(p => p.ipa === 'ñ')).toBe(true)
    expect(PHONETIC_DATASETS.es.all.some(p => p.ipa === 'rr')).toBe(true)
    expect(PHONETIC_DATASETS.fr.all.some(p => p.ipa === 'u')).toBe(true)
    expect(PHONETIC_DATASETS.fr.all.some(p => p.ipa === 'an/en')).toBe(true)
  })

  it('getPhoneticDataset 非法语言回退英语', () => {
    expect(getPhoneticDataset('xx')).toBe(PHONETIC_DATASETS.en)
    expect(getPhoneticDataset(undefined)).toBe(PHONETIC_DATASETS.en)
    expect(getPhoneticDataset('ja').all.length).toBe(104)
  })

  it('每条数据形状完整（type/group/groupLabel/examples/articulation/tip）', () => {
    for (const [, ds] of Object.entries(PHONETIC_DATASETS)) {
      for (const ph of ds.all) {
        expect(ph.ipa.length).toBeGreaterThan(0)
        expect(['vowel', 'consonant']).toContain(ph.type)
        expect(ph.groupLabel.length).toBeGreaterThan(0)
        expect(ph.examples.length).toBeGreaterThan(0)
        expect(typeof ph.articulation).toBe('string')
        expect(ph.tip.length).toBeGreaterThan(0)
      }
    }
  })
})
