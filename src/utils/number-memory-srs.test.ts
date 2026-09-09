import {describe, it, expect} from 'vitest'
import {
    clampLevel,
    getEntryLevel,
    isDue,
    isRemembered,
    markCorrect,
    markWrong,
    MAX_LEVEL,
    MASTERED_LEVEL,
    DEFAULT_LEVEL,
} from './number-memory-srs'
import {DEFAULT_INTERVALS} from '@/constants'
import type {NumberMemoryEntry} from '@/types/number-memory'

function makeEntry(partial: Partial<NumberMemoryEntry> = {}): NumberMemoryEntry {
    return {
        _id: 'entry_1',
        type: 'number_memory_entry',
        title: '测试',
        numbers: '123',
        tags: [],
        createdAt: 1,
        updatedAt: 1,
        reviewCount: 0,
        ...partial,
    }
}

describe('number-memory-srs', () => {
    describe('clampLevel', () => {
        it('低于 0 时返回 0', () => {
            expect(clampLevel(-1)).toBe(0)
        })

        it('高于 MAX_LEVEL 时返回 MAX_LEVEL', () => {
            expect(clampLevel(100)).toBe(MAX_LEVEL)
        })

        it('正常范围内原样返回', () => {
            expect(clampLevel(5)).toBe(5)
        })
    })

    describe('getEntryLevel', () => {
        it('有 level 时返回 clamp 后的值', () => {
            expect(getEntryLevel(makeEntry({level: 5}))).toBe(5)
        })

        it('无 level 时返回默认值', () => {
            expect(getEntryLevel(makeEntry())).toBe(DEFAULT_LEVEL)
        })

        it('level 越界时会被 clamp', () => {
            expect(getEntryLevel(makeEntry({level: 99}))).toBe(MAX_LEVEL)
        })
    })

    describe('isRemembered', () => {
        it('level >= 12 时返回 true', () => {
            expect(isRemembered(makeEntry({level: MASTERED_LEVEL}))).toBe(true)
        })

        it('level < 12 时返回 false', () => {
            expect(isRemembered(makeEntry({level: 11}))).toBe(false)
        })
    })

    describe('isDue', () => {
        it('无 learnDate 时返回 true', () => {
            expect(isDue(makeEntry({level: 1}), Date.now())).toBe(true)
        })

        it('未到期时返回 false', () => {
            const now = Date.now()
            const entry = makeEntry({level: 1, learnDate: now})
            expect(isDue(entry, now)).toBe(false)
        })

        it('已到期时返回 true', () => {
            const now = Date.now()
            const intervalMs = (DEFAULT_INTERVALS[DEFAULT_LEVEL] ?? 5) * 60 * 1000
            const entry = makeEntry({level: 1, learnDate: now - intervalMs - 1})
            expect(isDue(entry, now)).toBe(true)
        })

        it('字符串 learnDate 能正确解析', () => {
            const now = Date.now()
            const entry = makeEntry({level: 1, learnDate: new Date(now - DEFAULT_INTERVALS[1] * 60 * 1000 - 1).toISOString()})
            expect(isDue(entry, now)).toBe(true)
        })

        it('非法字符串 learnDate 视为刚学习', () => {
            const now = Date.now()
            const entry = makeEntry({level: 1, learnDate: 'invalid-date'})
            expect(isDue(entry, now)).toBe(false)
        })
    })

    describe('markCorrect', () => {
        it('到期条目升级', () => {
            const entry = makeEntry({level: 1, learnDate: 0})
            const now = Date.now()
            const result = markCorrect(entry, now)
            expect(result.level).toBe(2)
            expect(result.learnDate).toBe(now)
        })

        it('封顶 12 级', () => {
            const entry = makeEntry({level: MAX_LEVEL, learnDate: 0})
            const result = markCorrect(entry, Date.now())
            expect(result.level).toBe(MAX_LEVEL)
        })

        it('未到期时刷新 learnDate 但不升级', () => {
            const now = Date.now()
            const entry = makeEntry({level: 1, learnDate: now})
            const result = markCorrect(entry, now)
            expect(result.level).toBe(1)
            expect(result.learnDate).toBe(now)
        })

        it('到期但超过窗口时不升级，刷新 learnDate', () => {
            const now = Date.now()
            // level 1 窗口结束时间为 learnDate + DEFAULT_INTERVALS[4]
            const endWindowMs = DEFAULT_INTERVALS[4] * 60 * 1000 + 1
            const entry = makeEntry({level: 1, learnDate: now - endWindowMs})
            const result = markCorrect(entry, now)
            expect(result.level).toBe(1)
            expect(result.learnDate).toBe(now)
        })

        it('记忆牢固度 "较强" 时 +2 级', () => {
            const entry = makeEntry({level: 1, learnDate: 0})
            const result = markCorrect(entry, Date.now(), '较强')
            expect(result.level).toBe(3)
        })

        it('记忆牢固度 "极强" 时 +3 级', () => {
            const entry = makeEntry({level: 1, learnDate: 0})
            const result = markCorrect(entry, Date.now(), '极强')
            expect(result.level).toBe(4)
        })

        it('记忆牢固度 + 升级不突破 12 级', () => {
            const entry = makeEntry({level: 11, learnDate: 0})
            const result = markCorrect(entry, Date.now(), '极强')
            expect(result.level).toBe(MAX_LEVEL)
        })
    })

    describe('markWrong', () => {
        it('普通等级降级', () => {
            const entry = makeEntry({level: 9})
            const now = Date.now()
            const result = markWrong(entry, now)
            expect(result.level).toBe(5)
            expect(result.learnDate).toBe(now)
        })

        it('0 级答错按统一下限升为 1 级', () => {
            const entry = makeEntry({level: 0})
            const result = markWrong(entry, Date.now())
            expect(result.level).toBe(1)
        })

        it('12 级答错降为 8 级（降级幅度封顶 -4）', () => {
            const entry = makeEntry({level: MASTERED_LEVEL})
            const now = Date.now()
            const result = markWrong(entry, now)
            expect(result.level).toBe(8)
            expect(result.learnDate).toBe(now)
        })
    })
})
