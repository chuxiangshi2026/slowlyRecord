import {describe, it, expect} from 'vitest'
import {
    computeMappingGridLayout,
    buildMappingGridCells,
    isBase64ImageUrl,
} from './mapping-image-export'
import type {NumberImageAssociation} from '@/types/number-memory'

describe('computeMappingGridLayout', () => {
    it('默认 10 列，100 个单元格为 10 行', () => {
        const layout = computeMappingGridLayout(100)
        expect(layout.cols).toBe(10)
        expect(layout.rows).toBe(10)
    })

    it('不足一行时按一行计算', () => {
        const layout = computeMappingGridLayout(10)
        expect(layout.rows).toBe(1)
    })

    it('非整倍数时行数向上取整', () => {
        // 全部范围 0-9、00-09、10-99 共 110 个数字 → 11 行
        const layout = computeMappingGridLayout(110)
        expect(layout.rows).toBe(11)
    })

    it('0 个单元格时行数为 0', () => {
        const layout = computeMappingGridLayout(0)
        expect(layout.rows).toBe(0)
    })

    it('画布尺寸由列数、单元格边长、间距与外边距推导', () => {
        const layout = computeMappingGridLayout(100, {cols: 10, cellSize: 100, gap: 10, padding: 20})
        // 宽 = 20*2 + 10*100 + 9*10 = 1130
        expect(layout.canvasWidth).toBe(1130)
        // 高 = 20*2 + 标题区 + 10*100 + 9*10
        expect(layout.canvasHeight).toBe(40 + layout.titleHeight + 1090)
    })

    it('自定义列数生效', () => {
        const layout = computeMappingGridLayout(20, {cols: 5})
        expect(layout.cols).toBe(5)
        expect(layout.rows).toBe(4)
    })
})

describe('buildMappingGridCells', () => {
    const associations: NumberImageAssociation[] = [
        {number: '0', imageUrl: '🎯', source: 'preset'},
        {number: '42', imageUrl: 'data:image/png;base64,xxxx', source: 'upload'},
    ]

    it('按数字列表生成单元格，已配置的带上图片', () => {
        const cells = buildMappingGridCells(['0', '1', '42'], associations)
        expect(cells).toEqual([
            {number: '0', imageUrl: '🎯'},
            {number: '1', imageUrl: null},
            {number: '42', imageUrl: 'data:image/png;base64,xxxx'},
        ])
    })

    it('无映射时全部格子为 null', () => {
        const cells = buildMappingGridCells(['0', '1'], [])
        expect(cells.every(c => c.imageUrl === null)).toBe(true)
    })

    it('空数字列表返回空数组', () => {
        expect(buildMappingGridCells([], associations)).toEqual([])
    })
})

describe('isBase64ImageUrl', () => {
    it('dataURL 识别为图片', () => {
        expect(isBase64ImageUrl('data:image/png;base64,xxxx')).toBe(true)
        expect(isBase64ImageUrl('data:image/jpeg;base64,xxxx')).toBe(true)
    })

    it('emoji 与普通字符串不识别为图片', () => {
        expect(isBase64ImageUrl('🎯')).toBe(false)
        expect(isBase64ImageUrl('https://example.com/a.png')).toBe(false)
    })
})
