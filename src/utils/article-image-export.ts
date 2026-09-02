/**
 * 文章图片导出工具（Canvas 2D 手绘，零依赖）
 *
 * 用于把多篇文本记忆文章（诗词/成语/文章）竖向拼接渲染成一张长 PNG 下载。
 * 每篇文章一个卡片区块：标题（大字加粗）、作者/朝代/来源（灰色小字）、
 * 正文按画布宽度自动换行分段绘制，篇间留间距并画分隔线。
 *
 * 布局计算（computeArticleImageLayout）为纯函数，可在 Node 环境下单测；
 * 只有真正绘制/下载的函数才会触碰 document / canvas。
 * 文本换行（wrapText）与文件名生成（buildFilename）复用 table-image-export。
 */

import {wrapText, buildFilename} from './table-image-export';
import type {MeasureTextFn} from './table-image-export';

/** 单篇文章的图片导出数据 */
export interface ArticleImageItem {
    /** 文章标题 */
    title: string;
    /** 作者/朝代/来源拼接行（可选，如「唐 · 李白」） */
    authorLine?: string;
    /** 正文分段（每段一个字符串） */
    paragraphs: string[];
}

export interface ArticleImageData {
    /** 整图大标题（如「文本记忆」） */
    title: string;
    /** 日期行（可选，如「2026年9月3日」） */
    date?: string;
    /** 文章列表（按此顺序竖向拼接） */
    articles: ArticleImageItem[];
}

export interface ArticleImageOptions {
    /** 画布宽度（px），默认 1080 */
    width?: number;
    /** 页面左右外边距，默认 48 */
    pagePadding?: number;
    /** 卡片左右内边距，默认 32 */
    cardPaddingX?: number;
    /** 卡片上下内边距，默认 24 */
    cardPaddingY?: number;
    /** 篇间距（px），默认 32 */
    articleGap?: number;
    /** 大标题字号，默认 28 */
    headerFontSize?: number;
    /** 文章标题字号，默认 22 */
    titleFontSize?: number;
    /** 作者行字号，默认 14 */
    metaFontSize?: number;
    /** 正文字号，默认 17 */
    bodyFontSize?: number;
    /** 行高（相对字号倍数），默认 1.7 */
    lineHeight?: number;
    /** 页面背景色，默认白 */
    backgroundColor?: string;
    /** 卡片背景色，默认极浅灰 */
    cardBackground?: string;
    /** 卡片边框/分隔线颜色，默认浅灰 */
    borderColor?: string;
    /** 大标题/文章标题颜色，默认深灰 */
    titleColor?: string;
    /** 作者行颜色，默认中灰 */
    metaColor?: string;
    /** 正文颜色，默认深灰 */
    textColor?: string;
    /** 下载文件名（不含扩展名与日期），默认用大标题 */
    filename?: string;
}

/** 单篇文章卡片的布局结果 */
export interface ArticleBlockLayout {
    /** 标题换行结果 */
    titleLines: string[];
    /** 作者行换行结果（无作者行为空数组） */
    metaLines: string[];
    /** 每段正文的换行结果 */
    paragraphLines: string[][];
    /** 卡片总高度（px） */
    height: number;
}

export interface ArticleImageLayout {
    /** 画布宽度（px） */
    canvasWidth: number;
    /** 画布高度（px） */
    canvasHeight: number;
    /** 顶部标题区高度（px） */
    headerHeight: number;
    /** 各文章卡片布局 */
    blocks: ArticleBlockLayout[];
    /** 篇间距（px） */
    articleGap: number;
    /** 页面外边距（px） */
    pagePadding: number;
    /** 卡片内边距（px） */
    cardPaddingX: number;
    cardPaddingY: number;
}

const FONT_FAMILY = '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif';
const DEFAULT_WIDTH = 1080;
const DEFAULT_PAGE_PADDING = 48;
const DEFAULT_CARD_PADDING_X = 32;
const DEFAULT_CARD_PADDING_Y = 24;
const DEFAULT_ARTICLE_GAP = 32;
const DEFAULT_HEADER_FONT_SIZE = 28;
const DEFAULT_TITLE_FONT_SIZE = 22;
const DEFAULT_META_FONT_SIZE = 14;
const DEFAULT_BODY_FONT_SIZE = 17;
const DEFAULT_LINE_HEIGHT = 1.7;
/** 标题与作者行间距（px） */
const META_GAP = 6;
/** 标题区与正文的间距（px） */
const BODY_TOP_GAP = 12;

/**
 * 计算文章长图布局（纯函数）：大标题区 + 各文章卡片高度 + 画布总高。
 * 正文按卡片内容区宽度自动换行；无段落时兜底为一个空行，保证卡片高度有效。
 */
export function computeArticleImageLayout(
    data: ArticleImageData,
    measure: MeasureTextFn,
    options: ArticleImageOptions = {},
): ArticleImageLayout {
    const canvasWidth = options.width ?? DEFAULT_WIDTH;
    const pagePadding = options.pagePadding ?? DEFAULT_PAGE_PADDING;
    const cardPaddingX = options.cardPaddingX ?? DEFAULT_CARD_PADDING_X;
    const cardPaddingY = options.cardPaddingY ?? DEFAULT_CARD_PADDING_Y;
    const articleGap = options.articleGap ?? DEFAULT_ARTICLE_GAP;
    const headerFontSize = options.headerFontSize ?? DEFAULT_HEADER_FONT_SIZE;
    const titleFontSize = options.titleFontSize ?? DEFAULT_TITLE_FONT_SIZE;
    const metaFontSize = options.metaFontSize ?? DEFAULT_META_FONT_SIZE;
    const bodyFontSize = options.bodyFontSize ?? DEFAULT_BODY_FONT_SIZE;
    const lineHeight = options.lineHeight ?? DEFAULT_LINE_HEIGHT;

    // 卡片内容区可用宽度
    const innerW = Math.max(canvasWidth - pagePadding * 2 - cardPaddingX * 2, 10);

    // 大标题区：标题（可换行）+ 日期行 + 底部留白
    const headerLines = wrapText(data.title, innerW, measure);
    const headerHeight =
        headerLines.length * headerFontSize * lineHeight +
        (data.date ? metaFontSize * lineHeight : 0) +
        cardPaddingY;

    // 逐篇计算卡片高度
    const blocks: ArticleBlockLayout[] = data.articles.map(article => {
        const titleLines = wrapText(article.title, innerW, measure);
        const metaLines = article.authorLine ? wrapText(article.authorLine, innerW, measure) : [];
        // 无段落时兜底为一个空行，避免卡片高度塌陷
        const paragraphs = article.paragraphs.length > 0 ? article.paragraphs : [''];
        const paragraphLines = paragraphs.map(p => wrapText(p, innerW, measure));

        const paraGap = bodyFontSize * 0.7;
        const bodyLineCount = paragraphLines.reduce((sum, lines) => sum + lines.length, 0);
        const height =
            cardPaddingY * 2 +
            titleLines.length * titleFontSize * lineHeight +
            (metaLines.length > 0 ? META_GAP + metaLines.length * metaFontSize * lineHeight : 0) +
            BODY_TOP_GAP +
            bodyLineCount * bodyFontSize * lineHeight +
            paraGap * (paragraphs.length - 1);

        return {titleLines, metaLines, paragraphLines, height};
    });

    const canvasHeight = Math.round(
        headerHeight +
        blocks.reduce((sum, b) => sum + b.height, 0) +
        articleGap * Math.max(blocks.length - 1, 0) +
        pagePadding,
    );

    return {
        canvasWidth,
        canvasHeight,
        headerHeight,
        blocks,
        articleGap,
        pagePadding,
        cardPaddingX,
        cardPaddingY,
    };
}

function fontString(px: number, bold = false): string {
    return `${bold ? 'bold ' : ''}${px}px ${FONT_FAMILY}`;
}

/**
 * 用 Canvas 2D 绘制文章长图并返回画布（devicePixelRatio 放大保证导出清晰）。
 * 标题与作者行居中，正文左对齐分段绘制；篇间画分隔线。
 */
export function renderArticlesToCanvas(
    data: ArticleImageData,
    layout: ArticleImageLayout,
    measure: MeasureTextFn,
    options: ArticleImageOptions = {},
): HTMLCanvasElement {
    const headerFontSize = options.headerFontSize ?? DEFAULT_HEADER_FONT_SIZE;
    const titleFontSize = options.titleFontSize ?? DEFAULT_TITLE_FONT_SIZE;
    const metaFontSize = options.metaFontSize ?? DEFAULT_META_FONT_SIZE;
    const bodyFontSize = options.bodyFontSize ?? DEFAULT_BODY_FONT_SIZE;
    const lineHeight = options.lineHeight ?? DEFAULT_LINE_HEIGHT;
    const backgroundColor = options.backgroundColor ?? '#ffffff';
    const cardBackground = options.cardBackground ?? '#f7f8fa';
    const borderColor = options.borderColor ?? '#dcdfe6';
    const titleColor = options.titleColor ?? '#303133';
    const metaColor = options.metaColor ?? '#909399';
    const textColor = options.textColor ?? '#303133';

    const canvas = document.createElement('canvas');
    const dpr = Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, 2);
    canvas.width = Math.round(layout.canvasWidth * dpr);
    canvas.height = Math.round(layout.canvasHeight * dpr);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('当前环境不支持 Canvas 2D');

    ctx.scale(dpr, dpr);

    // 页面背景
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, layout.canvasWidth, layout.canvasHeight);

    const innerW = Math.max(layout.canvasWidth - layout.pagePadding * 2 - layout.cardPaddingX * 2, 10);
    const cardX = layout.pagePadding;
    const cardW = layout.canvasWidth - layout.pagePadding * 2;
    const textX = cardX + layout.cardPaddingX;
    const centerX = layout.canvasWidth / 2;

    // 大标题区（居中）
    let y = 0;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const headerLines = wrapText(data.title, innerW, measure);
    ctx.font = fontString(headerFontSize, true);
    ctx.fillStyle = titleColor;
    for (const line of headerLines) {
        ctx.fillText(line, centerX, y);
        y += headerFontSize * lineHeight;
    }
    if (data.date) {
        ctx.font = fontString(metaFontSize);
        ctx.fillStyle = metaColor;
        ctx.fillText(data.date, centerX, y);
    }
    y = layout.headerHeight;

    // 逐篇绘制卡片
    const paraGap = bodyFontSize * 0.7;
    data.articles.forEach((article, idx) => {
        const block = layout.blocks[idx];
        if (!block) return;

        // 卡片底色与边框
        ctx.fillStyle = cardBackground;
        ctx.fillRect(cardX, y, cardW, block.height);
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = 1;
        ctx.strokeRect(cardX + 0.5, y + 0.5, cardW - 1, block.height - 1);

        let cy = y + layout.cardPaddingY;

        // 文章标题（居中加粗）
        ctx.textAlign = 'center';
        ctx.font = fontString(titleFontSize, true);
        ctx.fillStyle = titleColor;
        for (const line of block.titleLines) {
            ctx.fillText(line, centerX, cy);
            cy += titleFontSize * lineHeight;
        }

        // 作者行（居中灰色小字）
        if (block.metaLines.length > 0) {
            cy += META_GAP;
            ctx.font = fontString(metaFontSize);
            ctx.fillStyle = metaColor;
            for (const line of block.metaLines) {
                ctx.fillText(line, centerX, cy);
                cy += metaFontSize * lineHeight;
            }
        }

        // 正文（左对齐分段）
        cy += BODY_TOP_GAP;
        ctx.textAlign = 'left';
        ctx.font = fontString(bodyFontSize);
        ctx.fillStyle = textColor;
        block.paragraphLines.forEach((lines, p) => {
            for (const line of lines) {
                if (line) ctx.fillText(line, textX, cy);
                cy += bodyFontSize * lineHeight;
            }
            if (p < block.paragraphLines.length - 1) cy += paraGap;
        });

        y += block.height;

        // 篇间分隔线（最后一篇不画）
        if (idx < data.articles.length - 1) {
            const sepY = y + layout.articleGap / 2;
            ctx.strokeStyle = borderColor;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(cardX, sepY + 0.5);
            ctx.lineTo(cardX + cardW, sepY + 0.5);
            ctx.stroke();
            y += layout.articleGap;
        }
    });

    return canvas;
}

/** 生成文章长图 PNG 并触发浏览器下载，返回绘制的画布（便于调用方复用） */
export function exportArticlesAsImage(data: ArticleImageData, options: ArticleImageOptions = {}): HTMLCanvasElement {
    const probe = document.createElement('canvas');
    const probeCtx = probe.getContext('2d');
    if (!probeCtx) throw new Error('当前环境不支持 Canvas 2D');
    const bodyFontSize = options.bodyFontSize ?? DEFAULT_BODY_FONT_SIZE;
    probeCtx.font = fontString(bodyFontSize);
    const measure: MeasureTextFn = text => probeCtx.measureText(text).width;

    const layout = computeArticleImageLayout(data, measure, options);
    const canvas = renderArticlesToCanvas(data, layout, measure, options);

    let url: string;
    try {
        url = canvas.toDataURL('image/png');
    } catch {
        throw new Error('导出失败');
    }
    const link = document.createElement('a');
    link.href = url;
    link.download = buildFilename(data.title, options.filename);
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    link.remove();
    return canvas;
}
