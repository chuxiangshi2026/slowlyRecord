import { describe, expect, it } from 'vitest'
import { ALL_PHONICS_RULES, findPhonicsRule } from './phonics-data'
import { buildListenOptions, buildSplitOptions, correctSplitOf, pickBlendingQuestions, ROUND_SIZE } from './phonics-practice'
import { findPhoneme } from './phoneme-data'

const seq = (seed = 1) => {
    let s = seed
    return () => {
        s = (s * 9301 + 49297) % 233280
        return s / 233280
    }
}

describe('phonics-data 数据完整性', () => {
    it('规则 id 全局唯一', () => {
        const ids = ALL_PHONICS_RULES.map((r) => r.id)
        expect(new Set(ids).size).toBe(ids.length)
    })

    it('每条规则的 ipa 都能在 48 音素表里查到', () => {
        for (const r of ALL_PHONICS_RULES) {
            expect(findPhoneme(r.ipa), `${r.id} -> ${r.ipa}`).toBeTruthy()
        }
    })

    it('例词 blocks 能无损还原原词（magic-e 块的 e 对应词尾静音 e）', () => {
        for (const r of ALL_PHONICS_RULES) {
            for (const e of r.examples) {
                const hasMagicE = e.blocks.some((b) => b.includes('_'))
                // '_e' 表示结尾静音 e，还原时不占中间位置
                const joined = e.blocks.join('').replace(/_e/g, '').toLowerCase()
                const word = e.word.toLowerCase().replace(/[^a-z]/g, '')
                if (hasMagicE) {
                    expect(word.endsWith('e'), `${e.word} 应以 e 结尾`).toBe(true)
                    expect(joined, `${e.word} blocks=${e.blocks}`).toBe(word.slice(0, -1))
                } else {
                    expect(joined, `${e.word} blocks=${e.blocks}`).toBe(word)
                }
            }
        }
    })

    it('findPhonicsRule 命中与未命中', () => {
        expect(findPhonicsRule('sh')?.ipa).toBe('ʃ')
        expect(findPhonicsRule('a_e')?.ipa).toBe('eɪ')
        expect(findPhonicsRule('nope')).toBeUndefined()
    })
})

describe('pickBlendingQuestions', () => {
    it('抽出指定数量的题，一轮内规则不重复', () => {
        const qs = pickBlendingQuestions(() => undefined, ROUND_SIZE, seq())
        expect(qs).toHaveLength(ROUND_SIZE)
        const ruleIds = qs.map((q) => q.rule.id)
        expect(new Set(ruleIds).size).toBe(ROUND_SIZE)
    })

    it('优先抽到期的规则', () => {
        const future = Date.now() + 24 * 3600 * 1000
        const qs = pickBlendingQuestions(
            (id) => (id === 'sh' ? { level: 3, nextReview: future } : undefined),
            ROUND_SIZE,
            seq(7),
        )
        expect(qs.some((q) => q.rule.id === 'sh')).toBe(false)
    })

    it('规则全部未到期时也能出满一轮', () => {
        const future = Date.now() + 24 * 3600 * 1000
        const qs = pickBlendingQuestions(() => ({ level: 3, nextReview: future }), ROUND_SIZE, seq(3))
        expect(qs).toHaveLength(ROUND_SIZE)
    })
})

describe('buildListenOptions', () => {
    it('返回 4 个不重复选项且包含目标词', () => {
        const target = { rule: findPhonicsRule('sh')!, example: findPhonicsRule('sh')!.examples[0] }
        const opts = buildListenOptions(target, 4, seq(11))
        expect(opts).toHaveLength(4)
        expect(new Set(opts.map((o) => o.word)).size).toBe(4)
        expect(opts.some((o) => o.word === target.example.word)).toBe(true)
    })
})

describe('buildSplitOptions', () => {
    it('返回 3 个不重复选项且包含正确切分', () => {
        const rule = findPhonicsRule('sh')!
        const q = { rule, example: rule.examples[0] } // ship: sh-i-p
        const opts = buildSplitOptions(q, seq(5))
        expect(opts).toHaveLength(3)
        expect(new Set(opts).size).toBe(3)
        expect(opts).toContain('sh-i-p')
        expect(opts).toContain('s-h-i-p')
    })

    it('magic-e 词的正确切分用 a-e 形式展示', () => {
        expect(correctSplitOf(findPhonicsRule('a_e')!.examples[0])).toBe('c-a-e-k')
    })

    it('双块词也能凑够选项', () => {
        const rule = findPhonicsRule('ee')! // see: s-ee
        const q = { rule, example: rule.examples[0] }
        const opts = buildSplitOptions(q, seq(9))
        expect(opts.length).toBeGreaterThanOrEqual(2)
        expect(opts).toContain('s-ee')
    })
})
