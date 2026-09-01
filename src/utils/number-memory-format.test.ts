import {describe, it, expect} from 'vitest'
import {
    segmentNumber,
    validateNumber,
    getEntryKind,
    KIND_LABELS,
    DEFAULT_KIND,
} from './number-memory-format'
import type {NumberMemoryEntry} from '@/types/number-memory'

describe('number-memory-format', () => {
    describe('segmentNumber', () => {
        it('无 kind 时原样返回', () => {
            expect(segmentNumber('1234567890')).toBe('1234567890')
        })

        it('手机号按 3-4-4 分段', () => {
            expect(segmentNumber('13800138000', 'phone')).toBe('138 0013 8000')
        })

        it('身份证按 6-8-4 分段', () => {
            expect(segmentNumber('110101199001011234', 'idcard')).toBe('110101 19900101 1234')
        })

        it('QQ 号 10 位按 3-3-4 分段', () => {
            expect(segmentNumber('1234567890', 'qq')).toBe('123 456 7890')
        })

        it('QQ 号非 10 位按 4 位一组分段', () => {
            expect(segmentNumber('1234567', 'qq')).toBe('1234 567')
        })

        it('银行卡按 4 位一组分段', () => {
            expect(segmentNumber('6222021234567890123', 'bankcard')).toBe('6222 0212 3456 7890 123')
        })

        it('π 按 5 位一组分段（带 3. 前缀）', () => {
            expect(segmentNumber('3.14159265358979323846', 'pi')).toBe('3.14159 26535 89793 23846')
        })

        it('π 纯数字按 5 位一组分段', () => {
            expect(segmentNumber('14159265358', 'pi')).toBe('14159 26535 8')
        })

        it('日期 8 位格式化为 YYYY-MM-DD', () => {
            expect(segmentNumber('20260902', 'date')).toBe('2026-09-02')
        })

        it('日期 12 位格式化为 YYYY-MM-DD HH:mm', () => {
            expect(segmentNumber('202609021530', 'date')).toBe('2026-09-02 15:30')
        })

        it('日期 14 位格式化为 YYYY-MM-DD HH:mm:ss', () => {
            expect(segmentNumber('20260902153000', 'date')).toBe('2026-09-02 15:30:00')
        })

        it('自定义类型原样返回', () => {
            expect(segmentNumber('abc123', 'custom')).toBe('abc123')
        })
    })

    describe('validateNumber', () => {
        it('手机号 11 位通过', () => {
            expect(validateNumber('13800138000', 'phone').valid).toBe(true)
        })

        it('手机号非 11 位失败', () => {
            const result = validateNumber('1380013800', 'phone')
            expect(result.valid).toBe(false)
            expect(result.message).toContain('11 位')
        })

        it('身份证 18 位通过', () => {
            expect(validateNumber('110101199001011234', 'idcard').valid).toBe(true)
        })

        it('身份证末位 X 通过', () => {
            expect(validateNumber('11010119900101123X', 'idcard').valid).toBe(true)
        })

        it('身份证长度不符失败', () => {
            expect(validateNumber('11010119900101123', 'idcard').valid).toBe(false)
        })

        it('QQ 号 5-11 位通过', () => {
            expect(validateNumber('12345', 'qq').valid).toBe(true)
            expect(validateNumber('12345678901', 'qq').valid).toBe(true)
        })

        it('QQ 号过短失败', () => {
            expect(validateNumber('1234', 'qq').valid).toBe(false)
        })

        it('银行卡 13-19 位通过', () => {
            expect(validateNumber('6222021234567', 'bankcard').valid).toBe(true)
        })

        it('银行卡过短失败', () => {
            expect(validateNumber('622202123456', 'bankcard').valid).toBe(false)
        })

        it('π 带 3. 前缀通过', () => {
            expect(validateNumber('3.14159', 'pi').valid).toBe(true)
        })

        it('π 含非数字失败', () => {
            expect(validateNumber('3.14a', 'pi').valid).toBe(false)
        })

        it('日期 8 位通过', () => {
            expect(validateNumber('20260902', 'date').valid).toBe(true)
        })

        it('日期长度异常失败', () => {
            expect(validateNumber('2026090', 'date').valid).toBe(false)
        })

        it('自定义类型始终通过', () => {
            expect(validateNumber('anything', 'custom').valid).toBe(true)
        })

        it('空串失败', () => {
            expect(validateNumber('', 'phone').valid).toBe(false)
        })
    })

    describe('getEntryKind', () => {
        it('有 kind 时返回 kind', () => {
            const entry = {_id: '1', type: 'number_memory_entry' as const, title: 't', numbers: '123', kind: 'phone', tags: [], createdAt: 1, updatedAt: 1, reviewCount: 0}
            expect(getEntryKind(entry)).toBe('phone')
        })

        it('无 kind 时返回 custom', () => {
            const entry = {_id: '1', type: 'number_memory_entry' as const, title: 't', numbers: '123', tags: [], createdAt: 1, updatedAt: 1, reviewCount: 0}
            expect(getEntryKind(entry)).toBe(DEFAULT_KIND)
        })
    })

    describe('KIND_LABELS', () => {
        it('包含所有类型的中文标签', () => {
            expect(KIND_LABELS.phone).toBe('手机号')
            expect(KIND_LABELS.pi).toBe('圆周率')
            expect(KIND_LABELS.custom).toBe('自定义')
        })
    })
})
