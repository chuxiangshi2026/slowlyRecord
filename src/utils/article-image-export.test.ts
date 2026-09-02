import {describe, it, expect} from 'vitest'
import {computeArticleImageLayout} from './article-image-export'
import type {ArticleImageData} from './article-image-export'

/** 简易文本测量：每个字符按 10px 估算 */
const measure = (text: string) => text.length * 10

function makeArticle(title = '静夜思'): ArticleImageData['articles'][number] {
    return {
        title,
        authorLine: '唐 · 李白',
        paragraphs: ['床前明月光，疑是地上霜。', '举头望明月，低头思故乡。'],
    }
}

function makeData(articles = [makeArticle()]): ArticleImageData {
    return {title: '文本记忆', date: '2026年9月3日', articles}
}

describe('computeArticleImageLayout', () => {
    it('画布尺寸为正，含标题区与各文章卡片', () => {
        const layout = computeArticleImageLayout(makeData(), measure)
        expect(layout.canvasWidth).toBe(1080)
        expect(layout.headerHeight).toBeGreaterThan(0)
        expect(layout.blocks).toHaveLength(1)
        expect(layout.blocks[0].height).toBeGreaterThan(0)
        expect(layout.canvasHeight).toBeGreaterThan(layout.headerHeight + layout.blocks[0].height)
    })

    it('正文超宽时按卡片内容区宽度自动换行', () => {
        // 内容区宽度 = 1080 - 48*2 - 32*2 = 920，10px/字符 → 92 字符/行
        const data = makeData([{title: '长文', paragraphs: ['x'.repeat(200)]}])
        const layout = computeArticleImageLayout(data, measure)
        // 200 字符硬切为 3 行（92 + 92 + 16）
        expect(layout.blocks[0].paragraphLines[0]).toHaveLength(3)
    })

    it('篇间距计入总高：两篇比一篇多出一张卡片加一个间距', () => {
        const one = computeArticleImageLayout(makeData([makeArticle()]), measure)
        const two = computeArticleImageLayout(makeData([makeArticle(), makeArticle('望庐山瀑布')]), measure)
        expect(two.blocks).toHaveLength(2)
        // canvasHeight 内部做了 Math.round，允许 ±1 的取整误差
        const diff = two.canvasHeight - one.canvasHeight
        expect(diff).toBeGreaterThanOrEqual(two.blocks[1].height + two.articleGap - 1)
        expect(diff).toBeLessThanOrEqual(two.blocks[1].height + two.articleGap + 1)
    })

    it('空内容兜底：无段落时按一个空行计算，卡片高度仍有效', () => {
        const data = makeData([{title: '空文', paragraphs: []}])
        const layout = computeArticleImageLayout(data, measure)
        expect(layout.blocks[0].paragraphLines).toEqual([['']])
        expect(layout.blocks[0].height).toBeGreaterThan(0)
        expect(layout.canvasHeight).toBeGreaterThan(0)
    })

    it('空字符串段落同样兜底为一行', () => {
        const data = makeData([{title: '空段', paragraphs: ['']}])
        const layout = computeArticleImageLayout(data, measure)
        expect(layout.blocks[0].paragraphLines).toEqual([['']])
    })

    it('无作者行时卡片更矮', () => {
        const withMeta = computeArticleImageLayout(makeData(), measure)
        const noMeta = computeArticleImageLayout(
            makeData([{title: '静夜思', paragraphs: makeArticle().paragraphs}]),
            measure,
        )
        expect(noMeta.blocks[0].metaLines).toEqual([])
        expect(noMeta.blocks[0].height).toBeLessThan(withMeta.blocks[0].height)
    })

    it('多段落之间有段间距，段落越多卡片越高', () => {
        const onePara = computeArticleImageLayout(
            makeData([{title: 't', paragraphs: ['一段']}]),
            measure,
        )
        const twoPara = computeArticleImageLayout(
            makeData([{title: 't', paragraphs: ['一段', '二段']}]),
            measure,
        )
        expect(twoPara.blocks[0].height).toBeGreaterThan(onePara.blocks[0].height)
    })

    it('无日期时标题区更矮', () => {
        const withDate = computeArticleImageLayout(makeData(), measure)
        const noDate = computeArticleImageLayout({title: '文本记忆', articles: [makeArticle()]}, measure)
        expect(noDate.headerHeight).toBeLessThan(withDate.headerHeight)
    })
})
