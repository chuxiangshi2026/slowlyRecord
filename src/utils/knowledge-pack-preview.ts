/**
 * 知识包配图（emoji）预览工具
 * 包内条目的 imageUrl 存的是 emoji 字符（见 KnowledgeItem.imageUrl 注释）。
 * 列表卡片与导入行用它拼出一行缩略图，不进入包页就能看出包的形态。
 */

import {fetchKnowledgePack} from './knowledge-pack-service';
import type {KnowledgeItem, KnowledgePackInfo} from '@/types/knowledge-memory';

// 缩略预览最多取的条目数
const DEFAULT_PREVIEW_COUNT = 4;

/**
 * 取条目里前 max 枚不重复的配图 emoji，拼成一行字符串。
 * 包内没有配图时返回空字符串，调用方据此不渲染缩略图。
 */
export function packPreviewEmojis(
    items: Array<Pick<KnowledgeItem, 'imageUrl'>> | undefined,
    max: number = DEFAULT_PREVIEW_COUNT,
): string {
    if (!items) return '';
    const emojis: string[] = [];
    for (const item of items) {
        const emoji = item.imageUrl;
        if (typeof emoji === 'string' && emoji && !emojis.includes(emoji)) {
            emojis.push(emoji);
        }
        if (emojis.length >= max) break;
    }
    return emojis.join(' ');
}

/**
 * 批量加载若干知识包的配图缩略预览（底层 fetchKnowledgePack 带 7 天 localStorage 缓存）。
 * 单个包加载失败静默跳过，不影响其余包展示；返回 { packId: 缩略串 }。
 */
export async function loadPackPreviews(
    packs: KnowledgePackInfo[],
    max: number = DEFAULT_PREVIEW_COUNT,
): Promise<Record<string, string>> {
    const previews: Record<string, string> = {};
    await Promise.all(
        packs.map(async pack => {
            try {
                const loaded = await fetchKnowledgePack(pack.id, {timeout: 3000});
                const emojis = packPreviewEmojis(loaded.items, max);
                if (emojis) previews[pack.id] = emojis;
            } catch {
                // 包内容不可用（网络/文件缺失）时不显示缩略图
            }
        }),
    );
    return previews;
}
