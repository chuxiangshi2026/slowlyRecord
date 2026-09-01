/**
 * 数字映射表图片导出工具（Canvas 2D 手绘，零依赖）
 *
 * 把 0-99（或当前范围）的数字-图片映射渲染成一张网格大图：
 * 每格包含数字 + 对应的 emoji / 上传图片；未配置的格子置灰。
 * emoji 直接 fillText，dataURL 图片用 Image 异步加载后 drawImage。
 *
 * 布局计算（computeMappingGridLayout / buildMappingGridCells）为纯函数，
 * 可在 Node 环境下单测；只有真正绘制/下载的函数才会触碰 document / canvas。
 */

import type { NumberImageAssociation } from '@/types/number-memory';
import { buildFilename } from './table-image-export';

/** 网格中的一个单元格数据 */
export interface MappingCellData {
    /** 数字文本（如 '0'、'07'、'42'） */
    number: string;
    /** 已配置的 emoji 字符或 dataURL 图片；未配置为 null */
    imageUrl: string | null;
}

export interface MappingGridOptions {
    /** 网格列数，默认 10 */
    cols?: number;
    /** 单元格边长（px），默认 96 */
    cellSize?: number;
    /** 单元格间距（px），默认 8 */
    gap?: number;
    /** 画布外边距（px），默认 24 */
    padding?: number;
    /** 图片标题，默认「数字映射表」 */
    title?: string;
    /** 标题字号，默认 24 */
    titleFontSize?: number;
    /** 日期字号，默认 12 */
    dateFontSize?: number;
    /** 数字标签字号，默认 14 */
    numberFontSize?: number;
    /** emoji 字号，默认 40 */
    emojiFontSize?: number;
    /** 下载文件名（不含扩展名与日期），默认用标题 */
    filename?: string;
}

export interface MappingGridLayout {
    /** 列数 */
    cols: number;
    /** 行数（按单元格数量与列数计算，0 个单元格时为 0） */
    rows: number;
    /** 单元格边长（px） */
    cellSize: number;
    /** 单元格间距（px） */
    gap: number;
    /** 画布外边距（px） */
    padding: number;
    /** 标题区高度（px，含标题与日期两行） */
    titleHeight: number;
    /** 画布宽度（px） */
    canvasWidth: number;
    /** 画布高度（px） */
    canvasHeight: number;
}

const FONT_FAMILY = '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif';
const DEFAULT_COLS = 10;
const DEFAULT_CELL_SIZE = 96;
const DEFAULT_GAP = 8;
const DEFAULT_PADDING = 24;
const DEFAULT_TITLE = '数字映射表';
const DEFAULT_TITLE_FONT_SIZE = 24;
const DEFAULT_DATE_FONT_SIZE = 12;
const DEFAULT_NUMBER_FONT_SIZE = 14;
const DEFAULT_EMOJI_FONT_SIZE = 40;
/** 单元格顶部数字标签区高度（px） */
const NUMBER_LABEL_HEIGHT = 22;

/**
 * 计算网格布局（纯函数）：行列数、标题区高度与画布尺寸。
 * 行数 = ceil(cellCount / cols)；单元格为 0 时只有标题区。
 */
export function computeMappingGridLayout(cellCount: number, options: MappingGridOptions = {}): MappingGridLayout {
    const cols = Math.max(1, options.cols ?? DEFAULT_COLS);
    const cellSize = options.cellSize ?? DEFAULT_CELL_SIZE;
    const gap = options.gap ?? DEFAULT_GAP;
    const padding = options.padding ?? DEFAULT_PADDING;
    const titleFontSize = options.titleFontSize ?? DEFAULT_TITLE_FONT_SIZE;
    const dateFontSize = options.dateFontSize ?? DEFAULT_DATE_FONT_SIZE;

    const rows = cellCount > 0 ? Math.ceil(cellCount / cols) : 0;
    // 标题区 = 标题行 + 日期行 + 上下留白
    const titleHeight = Math.round(titleFontSize * 1.6 + dateFontSize * 1.6 + 16);

    const canvasWidth = Math.round(padding * 2 + cols * cellSize + (cols - 1) * gap);
    const gridHeight = rows > 0 ? rows * cellSize + (rows - 1) * gap : 0;
    const canvasHeight = Math.round(padding * 2 + titleHeight + gridHeight);

    return { cols, rows, cellSize, gap, padding, titleHeight, canvasWidth, canvasHeight };
}

/**
 * 按给定数字列表生成单元格数据（纯函数）：
 * 有映射的格子带上 imageUrl，未配置的格子 imageUrl 为 null。
 */
export function buildMappingGridCells(numbers: string[], associations: NumberImageAssociation[]): MappingCellData[] {
    const map = new Map(associations.map(a => [a.number, a.imageUrl]));
    return numbers.map(num => ({ number: num, imageUrl: map.get(num) ?? null }));
}

/** 判断是否为 base64 dataURL 图片（否则按 emoji 文本处理） */
export function isBase64ImageUrl(url: string): boolean {
    return url?.startsWith('data:image/') || false;
}

/** 当前日期，如「2026年9月2日」 */
function formatDate(d: Date = new Date()): string {
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

/** 异步加载 dataURL 图片，失败时返回 null（对应格子按未配置处理） */
function loadImage(url: string): Promise<HTMLImageElement | null> {
    return new Promise(resolve => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = url;
    });
}

/** 在指定区域内等比绘制图片（contain 适配，居中） */
function drawImageContain(
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement,
    x: number,
    y: number,
    w: number,
    h: number,
): void {
    const scale = Math.min(w / img.width, h / img.height);
    const dw = img.width * scale;
    const dh = img.height * scale;
    ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

/**
 * 用 Canvas 2D 绘制映射网格并返回画布（devicePixelRatio 放大保证导出清晰）。
 * dataURL 图片会先全部加载完成再绘制。
 */
export async function renderMappingToCanvas(
    cells: MappingCellData[],
    layout: MappingGridLayout,
    options: MappingGridOptions = {},
): Promise<HTMLCanvasElement> {
    const title = options.title ?? DEFAULT_TITLE;
    const titleFontSize = options.titleFontSize ?? DEFAULT_TITLE_FONT_SIZE;
    const dateFontSize = options.dateFontSize ?? DEFAULT_DATE_FONT_SIZE;
    const numberFontSize = options.numberFontSize ?? DEFAULT_NUMBER_FONT_SIZE;
    const emojiFontSize = options.emojiFontSize ?? DEFAULT_EMOJI_FONT_SIZE;

    // 预加载所有 dataURL 图片：数字 -> 已加载的 Image（加载失败记为 null）
    const imageUrls = [...new Set(
        cells.filter(c => c.imageUrl && isBase64ImageUrl(c.imageUrl)).map(c => c.imageUrl as string),
    )];
    const loadedImages = new Map<string, HTMLImageElement | null>();
    await Promise.all(imageUrls.map(async url => {
        loadedImages.set(url, await loadImage(url));
    }));

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
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, layout.canvasWidth, layout.canvasHeight);

    // 标题与日期
    ctx.fillStyle = '#333333';
    ctx.font = `bold ${titleFontSize}px ${FONT_FAMILY}`;
    ctx.fillText(title, layout.canvasWidth / 2, layout.padding + titleFontSize * 0.8);
    ctx.fillStyle = '#888888';
    ctx.font = `${dateFontSize}px ${FONT_FAMILY}`;
    ctx.fillText(formatDate(), layout.canvasWidth / 2, layout.padding + titleFontSize * 1.6 + dateFontSize * 0.8);

    // 网格单元格
    const gridTop = layout.padding + layout.titleHeight;
    cells.forEach((cell, i) => {
        const col = i % layout.cols;
        const row = Math.floor(i / layout.cols);
        const x = layout.padding + col * (layout.cellSize + layout.gap);
        const y = gridTop + row * (layout.cellSize + layout.gap);
        const configured = cell.imageUrl !== null;

        // 格子底色与边框：未配置置灰
        ctx.fillStyle = configured ? '#ffffff' : '#f5f5f5';
        ctx.strokeStyle = configured ? '#c9c9c9' : '#e0e0e0';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(x + 0.5, y + 0.5, layout.cellSize - 1, layout.cellSize - 1, 6);
        ctx.fill();
        ctx.stroke();

        // 数字标签（顶部）
        ctx.fillStyle = configured ? '#333333' : '#bbbbbb';
        ctx.font = `bold ${numberFontSize}px ${FONT_FAMILY}`;
        ctx.fillText(cell.number, x + layout.cellSize / 2, y + NUMBER_LABEL_HEIGHT / 2 + 2);

        // 图片区（数字标签下方）
        const imgAreaY = y + NUMBER_LABEL_HEIGHT;
        const imgAreaH = layout.cellSize - NUMBER_LABEL_HEIGHT;
        if (cell.imageUrl && isBase64ImageUrl(cell.imageUrl)) {
            const img = loadedImages.get(cell.imageUrl);
            if (img) {
                drawImageContain(ctx, img, x + 4, imgAreaY + 2, layout.cellSize - 8, imgAreaH - 6);
            }
        } else if (cell.imageUrl) {
            // emoji 直接按文本绘制
            ctx.font = `${emojiFontSize}px ${FONT_FAMILY}`;
            ctx.fillText(cell.imageUrl, x + layout.cellSize / 2, imgAreaY + imgAreaH / 2);
        }
    });

    return canvas;
}

/** 生成映射表 PNG 并触发浏览器下载，返回绘制的画布（便于调用方复用） */
export async function exportMappingAsImage(
    numbers: string[],
    associations: NumberImageAssociation[],
    options: MappingGridOptions = {},
): Promise<HTMLCanvasElement> {
    const cells = buildMappingGridCells(numbers, associations);
    const layout = computeMappingGridLayout(cells.length, options);
    const canvas = await renderMappingToCanvas(cells, layout, options);

    let url: string;
    try {
        url = canvas.toDataURL('image/png');
    } catch {
        throw new Error('导出失败');
    }
    const link = document.createElement('a');
    link.href = url;
    link.download = buildFilename(options.title ?? DEFAULT_TITLE, options.filename);
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    link.remove();
    return canvas;
}
