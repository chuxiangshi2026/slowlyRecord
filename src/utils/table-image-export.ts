/**
 * 表格图片导出工具（Canvas 2D 手绘，零依赖）
 *
 * 用于把知识包等内容渲染成规整的表格 PNG 图片下载，
 * 支持完整表（含答案）与填空表（答案留空画下划线）两种形态。
 *
 * 布局计算（computeTableLayout / wrapText / buildFilename）为纯函数，
 * 可在 Node 环境下单测；只有真正绘制/下载的函数才会触碰 document / canvas。
 */

export interface TableColumnData {
    /** 表头文本 */
    header: string;
    /** 该列所有单元格文本（各列等长；填空表留空字符串即可） */
    values: string[];
}

export interface TableImageData {
    /** 表格标题（如知识包名） */
    title: string;
    /** 列定义 */
    columns: TableColumnData[];
}

/** 文本测量函数：返回给定字符串在当前字体下的像素宽度 */
export type MeasureTextFn = (text: string) => number;

export interface TableImageOptions {
    /** 画布最大宽度（px），内容超出时整体等比缩放，默认 1200 */
    maxWidth?: number;
    /** 单元格左右内边距，默认 16 */
    cellPaddingX?: number;
    /** 单元格上下内边距，默认 10 */
    cellPaddingY?: number;
    /** 正文字号，默认 16 */
    fontSize?: number;
    /** 标题字号，默认 24 */
    titleFontSize?: number;
    /** 行高（相对字号倍数），默认 1.6 */
    lineHeight?: number;
    /** 表头底色，默认浅灰 */
    headerBg?: string;
    /** 网格线颜色，默认浅灰 */
    gridColor?: string;
    /** 标题颜色，默认深灰 */
    titleColor?: string;
    /** 正文/表头文字颜色，默认深灰 */
    textColor?: string;
    /** 填空下划线颜色，默认深灰 */
    blankColor?: string;
    /** 画布背景色，默认白 */
    backgroundColor?: string;
    /** 下载文件名（不含扩展名与日期），默认用标题 */
    filename?: string;
}

export interface TableLayoutResult {
    /** 画布宽度（px） */
    canvasWidth: number;
    /** 画布高度（px） */
    canvasHeight: number;
    /** 各列宽度（px） */
    columnWidths: number[];
    /** 表头行高（px） */
    headerHeight: number;
    /** 标题区高度（px） */
    titleHeight: number;
    /** 每行数据行高（px） */
    rowHeights: number[];
    /** 内容区底部留白（px） */
    paddingY: number;
}

const FONT_FAMILY = '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif';
const DEFAULT_MAX_WIDTH = 1200;
const DEFAULT_CELL_PADDING_X = 16;
const DEFAULT_CELL_PADDING_Y = 10;
const DEFAULT_FONT_SIZE = 16;
const DEFAULT_TITLE_FONT_SIZE = 24;
const DEFAULT_LINE_HEIGHT = 1.6;

/**
 * 按最大宽度把文本拆成多行。
 * 优先在空格处断行，避免拆散英文单词；单个超长词按字符硬切。
 * 空字符串返回 ['']，表示一个空行（填空位）。
 */
export function wrapText(text: string, maxWidth: number, measure: MeasureTextFn): string[] {
    if (!text) return [''];
    const words = text.split(/\s+/).filter(Boolean);
    if (words.length === 0) return [''];
    const lines: string[] = [];
    let current = '';
    for (const word of words) {
        // 单个词超过列宽时按字符硬切
        if (measure(word) > maxWidth) {
            if (current) {
                lines.push(current);
                current = '';
            }
            let rest = word;
            while (rest) {
                let take = rest.length;
                while (take > 1 && measure(rest.slice(0, take)) > maxWidth) take--;
                lines.push(rest.slice(0, take));
                rest = rest.slice(take);
            }
            continue;
        }
        const candidate = current ? `${current} ${word}` : word;
        if (current && measure(candidate) > maxWidth) {
            lines.push(current);
            current = word;
        } else {
            current = candidate;
        }
    }
    if (current) lines.push(current);
    return lines;
}

/**
 * 计算表格布局（纯函数）：列宽 / 行高 / 画布尺寸。
 * 列宽按「表头与内容的最大单行宽度 + 内边距」自适应，总宽超出 maxWidth 时整体等比缩放；
 * 行高按单元格换行后的行数自适应。
 */
export function computeTableLayout(
    data: TableImageData,
    measure: MeasureTextFn,
    options: TableImageOptions = {},
): TableLayoutResult {
    const maxWidth = options.maxWidth ?? DEFAULT_MAX_WIDTH;
    const cellPaddingX = options.cellPaddingX ?? DEFAULT_CELL_PADDING_X;
    const cellPaddingY = options.cellPaddingY ?? DEFAULT_CELL_PADDING_Y;
    const fontSize = options.fontSize ?? DEFAULT_FONT_SIZE;
    const titleFontSize = options.titleFontSize ?? DEFAULT_TITLE_FONT_SIZE;
    const lineHeight = options.lineHeight ?? DEFAULT_LINE_HEIGHT;

    // 1. 每列自然宽度 = max(表头, 全部内容) 单行宽度 + 水平内边距
    const naturalWidths = data.columns.map(col => {
        const headerW = measure(col.header);
        const maxValueW = col.values.reduce((max, v) => Math.max(max, measure(v)), 0);
        return Math.max(headerW, maxValueW) + cellPaddingX * 2;
    });
    const naturalTotal = naturalWidths.reduce((sum, w) => sum + w, 0);

    // 2. 总宽超出画布最大宽度时整体等比缩放
    const scale = naturalTotal > maxWidth ? maxWidth / naturalTotal : 1;
    const columnWidths = naturalWidths.map(w => w * scale);
    const canvasWidth = Math.round(columnWidths.reduce((sum, w) => sum + w, 0));

    // 3. 标题区高度（标题过长时自动换行）
    const titleInnerWidth = Math.max(canvasWidth - cellPaddingX * 2, 10);
    const titleLines = wrapText(data.title, titleInnerWidth, measure);
    const titleHeight = titleLines.length * titleFontSize * lineHeight + cellPaddingY * 2;

    // 4. 表头行高
    let headerHeight = 0;
    if (data.columns.length > 0) {
        const maxHeaderLines = data.columns.reduce((max, col, c) => {
            const innerW = Math.max(columnWidths[c] - cellPaddingX * 2, 10);
            return Math.max(max, wrapText(col.header, innerW, measure).length);
        }, 1);
        headerHeight = maxHeaderLines * fontSize * lineHeight + cellPaddingY * 2;
    }

    // 5. 每行数据行高（按实际换行后的行数自适应）
    const rowCount = data.columns.length > 0 ? data.columns[0].values.length : 0;
    const rowHeights: number[] = [];
    for (let r = 0; r < rowCount; r++) {
        let maxLines = 1;
        data.columns.forEach((col, c) => {
            const innerW = Math.max(columnWidths[c] - cellPaddingX * 2, 10);
            const lines = wrapText(col.values[r] ?? '', innerW, measure);
            maxLines = Math.max(maxLines, lines.length);
        });
        rowHeights.push(maxLines * fontSize * lineHeight + cellPaddingY * 2);
    }

    const canvasHeight = Math.round(
        titleHeight + headerHeight + rowHeights.reduce((sum, h) => sum + h, 0) + cellPaddingY * 2,
    );

    return {canvasWidth, canvasHeight, columnWidths, headerHeight, titleHeight, rowHeights, paddingY: cellPaddingY};
}

/** 生成下载文件名：标题清洗 + 日期，如「99乘法表-2026-09-02.png」 */
export function buildFilename(title: string, custom?: string): string {
    const base =
        (custom || title)
            .replace(/[\\/:*?"<>|\s]+/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_|_$/g, '') || 'table';
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${base}-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.png`;
}

function fontString(px: number, bold = false): string {
    return `${bold ? 'bold ' : ''}${px}px ${FONT_FAMILY}`;
}

/** 在指定中心位置绘制多行文本（整体垂直居中） */
function drawCenteredLines(
    ctx: CanvasRenderingContext2D,
    lines: string[],
    centerX: number,
    centerY: number,
    lineHeightPx: number,
    color: string,
): void {
    ctx.fillStyle = color;
    const totalH = lines.length * lineHeightPx;
    let y = centerY - totalH / 2 + lineHeightPx / 2;
    for (const line of lines) {
        ctx.fillText(line, centerX, y);
        y += lineHeightPx;
    }
}

/**
 * 用 Canvas 2D 绘制表格并返回画布（devicePixelRatio 放大保证导出清晰）。
 * 乘号 ×、上下标（πr²、H₂O）等字符直接按文本绘制。
 */
export function renderTableToCanvas(
    data: TableImageData,
    layout: TableLayoutResult,
    measure: MeasureTextFn,
    options: TableImageOptions = {},
): HTMLCanvasElement {
    const cellPaddingX = options.cellPaddingX ?? DEFAULT_CELL_PADDING_X;
    const cellPaddingY = options.cellPaddingY ?? DEFAULT_CELL_PADDING_Y;
    const fontSize = options.fontSize ?? DEFAULT_FONT_SIZE;
    const titleFontSize = options.titleFontSize ?? DEFAULT_TITLE_FONT_SIZE;
    const lineHeight = options.lineHeight ?? DEFAULT_LINE_HEIGHT;
    const headerBg = options.headerBg ?? '#f2f3f5';
    const gridColor = options.gridColor ?? '#c9c9c9';
    const titleColor = options.titleColor ?? '#333333';
    const textColor = options.textColor ?? '#333333';
    const blankColor = options.blankColor ?? '#555555';
    const backgroundColor = options.backgroundColor ?? '#ffffff';

    const canvas = document.createElement('canvas');
    const dpr = Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, 2);
    canvas.width = Math.round(layout.canvasWidth * dpr);
    canvas.height = Math.round(layout.canvasHeight * dpr);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('当前环境不支持 Canvas 2D');

    ctx.scale(dpr, dpr);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // 背景
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, layout.canvasWidth, layout.canvasHeight);

    let y = 0;

    // 标题
    const titleLines = wrapText(data.title, Math.max(layout.canvasWidth - cellPaddingX * 2, 10), measure);
    ctx.font = fontString(titleFontSize, true);
    drawCenteredLines(
        ctx,
        titleLines,
        layout.canvasWidth / 2,
        y + layout.titleHeight / 2,
        titleFontSize * lineHeight,
        titleColor,
    );
    y += layout.titleHeight;

    // 表头（底色 + 居中文本）
    if (data.columns.length > 0) {
        ctx.fillStyle = headerBg;
        ctx.fillRect(0, y, layout.canvasWidth, layout.headerHeight);
        ctx.font = fontString(fontSize, true);
        let x = 0;
        data.columns.forEach((col, c) => {
            const innerW = Math.max(layout.columnWidths[c] - cellPaddingX * 2, 10);
            const lines = wrapText(col.header, innerW, measure);
            drawCenteredLines(
                ctx,
                lines,
                x + layout.columnWidths[c] / 2,
                y + layout.headerHeight / 2,
                fontSize * lineHeight,
                textColor,
            );
            x += layout.columnWidths[c];
        });
        y += layout.headerHeight;
    }

    // 数据行：有内容居中绘制，空内容画填空下划线
    ctx.font = fontString(fontSize);
    const rowCount = data.columns.length > 0 ? data.columns[0].values.length : 0;
    for (let r = 0; r < rowCount; r++) {
        const rowH = layout.rowHeights[r] ?? 0;
        const centerY = y + rowH / 2;
        let x = 0;
        data.columns.forEach((col, c) => {
            const colW = layout.columnWidths[c] ?? 0;
            const cx = x + colW / 2;
            const text = col.values[r] ?? '';
            if (text) {
                const innerW = Math.max(colW - cellPaddingX * 2, 10);
                const lines = wrapText(text, innerW, measure);
                drawCenteredLines(ctx, lines, cx, centerY, fontSize * lineHeight, textColor);
            } else {
                // 填空空位：画一条居中的下划线
                const blankW = Math.min(colW - cellPaddingX * 2, 80);
                ctx.strokeStyle = blankColor;
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.moveTo(cx - blankW / 2, centerY + 8);
                ctx.lineTo(cx + blankW / 2, centerY + 8);
                ctx.stroke();
            }
            x += colW;
        });
        y += rowH;
    }

    // 网格线（外框 + 列分隔线 + 行分隔线）
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, layout.canvasWidth - 1, layout.canvasHeight - 1);

    let vx = 0;
    for (let c = 0; c < layout.columnWidths.length - 1; c++) {
        vx += layout.columnWidths[c];
        ctx.beginPath();
        ctx.moveTo(vx + 0.5, 0);
        ctx.lineTo(vx + 0.5, layout.canvasHeight);
        ctx.stroke();
    }

    let hy = layout.titleHeight;
    if (data.columns.length > 0) {
        ctx.beginPath();
        ctx.moveTo(0, hy + 0.5);
        ctx.lineTo(layout.canvasWidth, hy + 0.5);
        ctx.stroke();
        hy += layout.headerHeight;
    }
    for (let r = 0; r < layout.rowHeights.length; r++) {
        hy += layout.rowHeights[r];
        if (r < layout.rowHeights.length - 1) {
            ctx.beginPath();
            ctx.moveTo(0, hy + 0.5);
            ctx.lineTo(layout.canvasWidth, hy + 0.5);
            ctx.stroke();
        }
    }

    return canvas;
}

/** 生成表格 PNG 并触发浏览器下载，返回绘制的画布（便于调用方复用） */
export function exportTableAsImage(data: TableImageData, options: TableImageOptions = {}): HTMLCanvasElement {
    const probe = document.createElement('canvas');
    const probeCtx = probe.getContext('2d');
    if (!probeCtx) throw new Error('当前环境不支持 Canvas 2D');
    const fontSize = options.fontSize ?? DEFAULT_FONT_SIZE;
    probeCtx.font = fontString(fontSize);
    const measure: MeasureTextFn = text => probeCtx.measureText(text).width;

    const layout = computeTableLayout(data, measure, options);
    const canvas = renderTableToCanvas(data, layout, measure, options);

    let url: string;
    try {
        url = canvas.toDataURL('image/png');
    } catch (e) {
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
