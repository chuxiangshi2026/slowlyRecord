import {describe, expect, it, vi} from 'vitest';
import {fetchKnowledgePack} from './knowledge-pack-service';
import {loadPackPreviews, packPreviewEmojis} from './knowledge-pack-preview';
import type {KnowledgePackInfo} from '@/types/knowledge-memory';

vi.mock('./knowledge-pack-service', () => ({
    fetchKnowledgePack: vi.fn(),
}));

function buildPack(id: string): KnowledgePackInfo {
    return {
        id,
        name: id,
        description: `${id} 描述`,
        itemCount: 1,
        ordered: false,
        usableAsPeg: false,
        category: 'text',
    };
}

function buildLoaded(emojis: Array<string | undefined>): any {
    return {
        id: 'x',
        name: 'x',
        description: '',
        items: emojis.map((emoji, index) => ({
            id: `i${index}`,
            question: `q${index}`,
            answer: 'a',
            ...(emoji === undefined ? {} : {imageUrl: emoji}),
        })),
    };
}

describe('packPreviewEmojis', () => {
    it('取前 max 枚不重复配图，按空格连接', () => {
        const items = [{imageUrl: '🌱'}, {imageUrl: '🌧️'}, {imageUrl: '🌱'}, {imageUrl: '🌗'}, {imageUrl: '🍃'}];
        expect(packPreviewEmojis(items)).toBe('🌱 🌧️ 🌗 🍃');
        expect(packPreviewEmojis(items, 2)).toBe('🌱 🌧️');
        expect(packPreviewEmojis(items, 10)).toBe('🌱 🌧️ 🌗 🍃');
    });

    it('忽略缺失、空字符串或非字符串的配图字段', () => {
        const items = [{}, {imageUrl: ''}, {imageUrl: 123}, {imageUrl: '🌱'}];
        expect(packPreviewEmojis(items as any)).toBe('🌱');
    });

    it('条目为空或参数缺失时返回空字符串', () => {
        expect(packPreviewEmojis(undefined)).toBe('');
        expect(packPreviewEmojis([])).toBe('');
        expect(packPreviewEmojis([{}])).toBe('');
    });
});

describe('loadPackPreviews', () => {
    it('逐包加载，只返回有配图的包', async () => {
        const fetch = fetchKnowledgePack as any;
        fetch.mockImplementation(async (id: string) => {
            if (id === 'p2') return buildLoaded([]);
            return buildLoaded(id === 'p1' ? ['🌱', '🌱', '🌧️'] : ['🍃']);
        });

        const previews = await loadPackPreviews([buildPack('p1'), buildPack('p2'), buildPack('p3')], 4);

        expect(previews).toEqual({p1: '🌱 🌧️', p3: '🍃'});
        expect(fetch).toHaveBeenCalledWith('p1', {timeout: 3000});
        expect(fetch).toHaveBeenCalledTimes(3);
    });

    it('支持自定义缩略数量上限', async () => {
        (fetchKnowledgePack as any).mockResolvedValue(buildLoaded(['🌱', '🌧️', '🌗', '🍃']));

        const previews = await loadPackPreviews([buildPack('p1')], 2);

        expect(previews).toEqual({p1: '🌱 🌧️'});
    });

    it('单个包加载失败静默跳过，不影响其余包', async () => {
        const fetch = fetchKnowledgePack as any;
        fetch.mockImplementation(async (id: string) => {
            if (id === 'p2') throw new Error('网络错误');
            return buildLoaded(['🌱']);
        });

        const previews = await loadPackPreviews([buildPack('p1'), buildPack('p2'), buildPack('p3')]);

        expect(previews).toEqual({p1: '🌱', p3: '🌱'});
    });

    it('空列表返回空映射', async () => {
        expect(await loadPackPreviews([])).toEqual({});
    });
});
