import {describe, it, expect} from 'vitest'
import {computeTableLayout, wrapText, buildFilename} from './table-image-export'
import type {TableImageData} from './table-image-export'

/** 简易文本测量：每个字符按 10px 估算 */
const measure = (text: string) => text.length * 10

function makeData(): TableImageData {
    return {
        title: '测试表',
        columns: [
            {header: '题目', values: ['1×1', '2×2', '3×3']},
            {header: '答案', values: ['1', '4', '9']},
        ],
    }
}

describe('wrapText', () => {
    it('短文本不换行', () => {
        expect(wrapText('7×8', 80, measure)).toEqual(['7×8'])
    })

    it('超宽文本优先在空格处断行', () => {
        expect(wrapText('a b c d', 45, measure)).toEqual(['a b', 'c d'])
    })

    it('保持单词完整', () => {
        expect(wrapText('hello world', 60, measure)).toEqual(['hello', 'world'])
    })

    it('无空格超宽文本按字符硬切', () => {
        expect(wrapText('abcdef', 25, measure)).toEqual(['ab', 'cd', 'ef'])
    })

    it('空字符串返回单空行（表示填空位）', () => {
        expect(wrapText('', 80, measure)).toEqual([''])
    })
})

describe('computeTableLayout', () => {
    it('按内容自适应列宽', () => {
        const layout = computeTableLayout(makeData(), measure)
        // 列宽 = max(表头, 内容) 字符数 * 10 + 左右内边距 16*2
        // 列1：'题目' 2 字符 vs '1×1' 3 字符 → 3 * 10 + 32 = 62
        expect(layout.columnWidths[0]).toBeCloseTo(62, 5)
        // 列2：'答案' 2 字符 vs '1' 1 字符 → 2 * 10 + 32 = 52
        expect(layout.columnWidths[1]).toBeCloseTo(52, 5)
    })

    it('行高与行数一致', () => {
        const layout = computeTableLayout(makeData(), measure)
        expect(layout.rowHeights).toHaveLength(3)
        // 单行内容：1 * 16 * 1.6 + 上下内边距 10*2 = 45.6
        expect(layout.rowHeights[0]).toBeCloseTo(45.6, 5)
    })

    it('画布高度包含标题、表头与数据区', () => {
        const layout = computeTableLayout(makeData(), measure)
        const expectBodyHeight =
            layout.headerHeight + layout.rowHeights.reduce((s, h) => s + h, 0)
        // canvasHeight 内部做了 Math.round
        expect(layout.canvasHeight).toBe(Math.round(layout.titleHeight + expectBodyHeight + 20))
        expect(layout.canvasWidth).toBeGreaterThan(0)
    })

    it('总宽超出 maxWidth 时等比缩放', () => {
        const data: TableImageData = {
            title: 't',
            columns: [
                {header: 'h1', values: ['x'.repeat(60)]},
                {header: 'h2', values: ['y'.repeat(60)]},
            ],
        }
        // 自然总宽 = 2 * (60 * 10 + 32) = 1264 > 1000，应缩放到 1000
        const layout = computeTableLayout(data, measure, {maxWidth: 1000})
        expect(layout.canvasWidth).toBe(1000)
        // 每列 = 632 * 1000 / 1264 = 500
        expect(layout.columnWidths[0]).toBeCloseTo(500, 5)
        expect(layout.columnWidths[1]).toBeCloseTo(500, 5)
    })

    it('长内容自动换行后行高增加', () => {
        const data: TableImageData = {
            title: 't',
            columns: [
                // 超宽表头把总宽撑超过 maxWidth，触发整体等比缩放
                {header: 'h'.repeat(100), values: ['1']},
                // 缩放后该列内宽收窄，60 字符内容放不下 → 换行成 2 行
                {header: 'h2', values: ['y'.repeat(60)]},
            ],
        }
        const layout = computeTableLayout(data, measure)
        // 自然总宽 = 1032 + 632 = 1664 > 1200，画布宽度应收敛到 maxWidth
        expect(layout.canvasWidth).toBe(1200)
        expect(layout.rowHeights[0]).toBeCloseTo(2 * 16 * 1.6 + 20, 5)
    })

    it('填空表（空答案）行高与完整表一致', () => {
        const full = computeTableLayout(makeData(), measure)
        const blank = computeTableLayout(
            {
                title: '测试表',
                columns: [
                    {header: '题目', values: ['1×1', '2×2', '3×3']},
                    {header: '答案', values: ['', '', '']},
                ],
            },
            measure,
        )
        expect(blank.rowHeights).toEqual(full.rowHeights)
    })

    it('空列返回零尺寸布局', () => {
        const layout = computeTableLayout({title: 't', columns: []}, measure)
        expect(layout.canvasWidth).toBe(0)
        expect(layout.rowHeights).toEqual([])
    })
})

describe('buildFilename', () => {
    it('清洗非法字符并附带日期', () => {
        expect(buildFilename('99 乘法表 / 上册')).toMatch(/^99_乘法表_上册-\d{4}-\d{2}-\d{2}\.png$/)
    })

    it('优先使用自定义文件名', () => {
        expect(buildFilename('任意标题', 'custom name')).toMatch(/^custom_name-\d{4}-\d{2}-\d{2}\.png$/)
    })

    it('标题为空时使用兜底名', () => {
        expect(buildFilename('')).toMatch(/^table-\d{4}-\d{2}-\d{2}\.png$/)
    })
})
