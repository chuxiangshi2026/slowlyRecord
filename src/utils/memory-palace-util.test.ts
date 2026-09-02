import {describe, expect, it} from 'vitest';
import {
  assignChunksToLoci,
  buildPegId,
  chunkArticleContent,
  knowledgePackToLoci,
  resolvePegContent,
} from './memory-palace-util';
import type {KnowledgePack} from '@/types/knowledge-memory';
import type {TextArticle} from '@/types/text-memory';
import type {PalaceLocus, PegItem} from '@/types/memory-palace';

// 构造测试用文章
function makeArticle(id: string, content: string): TextArticle {
  return {
    _id: id,
    title: '测试文章',
    content,
    tags: [],
    ctime: 0,
    utime: 0,
    reviewCount: 0,
  };
}

describe('chunkArticleContent', () => {
  it('按句切块（中文句末标点）', () => {
    const chunks = chunkArticleContent('床前明月光，疑是地上霜。举头望明月，低头思故乡。', 'sentence');
    expect(chunks).toEqual(['床前明月光，疑是地上霜。', '举头望明月，低头思故乡。']);
  });

  it('按句切块支持换行断句与英文标点', () => {
    const chunks = chunkArticleContent('第一句!\n第二句? 第三句', 'sentence');
    expect(chunks).toEqual(['第一句!', '第二句?', '第三句']);
  });

  it('按句切块支持英文句点', () => {
    const chunks = chunkArticleContent('Hello world. This is a test.', 'sentence');
    expect(chunks).toEqual(['Hello world.', 'This is a test.']);
  });

  it('小数点不被误切', () => {
    const chunks = chunkArticleContent('The value is 3.14. Price 1.23 and 4.56.', 'sentence');
    expect(chunks).toEqual(['The value is 3.14.', 'Price 1.23 and 4.56.']);
  });

  it('中英混排按句切块', () => {
    const chunks = chunkArticleContent('Hello. 你好，世界。Nice to meet you.', 'sentence');
    expect(chunks).toEqual(['Hello.', '你好，世界。', 'Nice to meet you.']);
  });

  it('连续英文句点按一个结尾处理', () => {
    const chunks = chunkArticleContent('Wait... what? OK...', 'sentence');
    expect(chunks).toEqual(['Wait...', 'what?', 'OK...']);
  });

  it('无结尾标点的末尾文本也成块', () => {
    const chunks = chunkArticleContent('第一句。第二句没有标点', 'sentence');
    expect(chunks).toEqual(['第一句。', '第二句没有标点']);
  });

  it('按段切块', () => {
    const chunks = chunkArticleContent('第一段\n\n第二段\n第三段', 'paragraph');
    expect(chunks).toEqual(['第一段', '第二段', '第三段']);
  });

  it('空内容返回空数组', () => {
    expect(chunkArticleContent('', 'sentence')).toEqual([]);
    expect(chunkArticleContent('  \n ', 'paragraph')).toEqual([]);
  });
});

describe('knowledgePackToLoci', () => {
  it('按 item.order 生成桩列表', () => {
    const pack: KnowledgePack = {
      id: 'solar-terms-24',
      name: '二十四节气',
      description: '',
      ordered: true,
      usableAsPeg: true,
      items: [
        {id: '2', question: '雨水', answer: '第二个节气', order: 2},
        {id: '1', question: '立春', answer: '第一个节气', order: 1},
      ],
    };
    const loci = knowledgePackToLoci(pack);
    expect(loci).toHaveLength(2);
    expect(loci[0]).toEqual({order: 1, name: '立春', description: '第一个节气'});
    expect(loci[1]).toEqual({order: 2, name: '雨水', description: '第二个节气'});
  });

  it('order 缺失时按原数组顺序', () => {
    const pack: KnowledgePack = {
      id: 'test',
      name: 'test',
      description: '',
      ordered: true,
      usableAsPeg: true,
      items: [
        {id: 'a', question: '甲', answer: 'A'},
        {id: 'b', question: '乙', answer: 'B'},
      ],
    };
    const loci = knowledgePackToLoci(pack);
    expect(loci.map(l => l.name)).toEqual(['甲', '乙']);
    expect(loci.map(l => l.order)).toEqual([1, 2]);
  });

  it('透传 item.alternates 到桩的备选桩名', () => {
    const pack: KnowledgePack = {
      id: 'number-pegs-12',
      name: '数字桩',
      description: '',
      ordered: true,
      usableAsPeg: true,
      items: [
        {id: '1', question: '蜡烛', answer: '数字 1', alternates: ['铅笔', '大树'], order: 1},
        {id: '2', question: '鸭子', answer: '数字 2', order: 2},
      ],
    };
    const loci = knowledgePackToLoci(pack);
    expect(loci[0].alternates).toEqual(['铅笔', '大树']);
    // 无备选桩时不设置该字段
    expect(loci[1].alternates).toBeUndefined();
  });
});

describe('assignChunksToLoci', () => {
  const loci: PalaceLocus[] = [
    {order: 1, name: '大门'},
    {order: 2, name: '客厅'},
    {order: 3, name: '厨房'},
  ];

  it('逐块分配到空桩', () => {
    const result = assignChunksToLoci(['块一', '块二'], loci, new Set());
    expect(result).toEqual([
      {chunkIndex: 0, locusOrder: 1},
      {chunkIndex: 1, locusOrder: 2},
    ]);
  });

  it('跳过已占用的桩', () => {
    const result = assignChunksToLoci(['块一'], loci, new Set([1, 2]));
    expect(result).toEqual([{chunkIndex: 0, locusOrder: 3}]);
  });

  it('桩不足时截断', () => {
    const result = assignChunksToLoci(['一', '二', '三', '四'], loci, new Set());
    expect(result).toHaveLength(3);
  });
});

describe('resolvePegContent', () => {
  const articles = [makeArticle('a1', '第一句。第二句。\n第二段。')];

  function makePeg(ref?: Partial<PegItem['contentRef']>, freeText?: string): PegItem {
    return {
      _id: 'peg_1',
      palaceId: 'p1',
      locusOrder: 1,
      contentRef: ref ? {type: 'text-article', articleId: 'a1', chunkIndex: 0, ...ref} as PegItem['contentRef'] : undefined,
      freeText,
    };
  }

  it('解析自由文本', () => {
    const result = resolvePegContent(makePeg(undefined, '自由内容'), articles);
    expect(result).toEqual({text: '自由内容', deleted: false});
  });

  it('解析文章切块引用（按句）', () => {
    const result = resolvePegContent(makePeg({chunkIndex: 1}), articles);
    expect(result.deleted).toBe(false);
    expect(result.text).toBe('第二句。');
    expect(result.articleTitle).toBe('测试文章');
  });

  it('解析文章切块引用（按段）', () => {
    const result = resolvePegContent(makePeg({chunkIndex: 1, mode: 'paragraph'}), articles);
    expect(result.text).toBe('第二段。');
  });

  it('源文章被删时兜底返回 deleted=true', () => {
    const result = resolvePegContent(makePeg({articleId: 'not-exist'}), articles);
    expect(result.deleted).toBe(true);
    expect(result.text).toBe('');
  });

  it('切块索引越界时兜底返回 deleted=true', () => {
    const result = resolvePegContent(makePeg({chunkIndex: 99}), articles);
    expect(result.deleted).toBe(true);
  });
});

describe('buildPegId', () => {
  it('同宫殿同桩生成唯一 ID', () => {
    expect(buildPegId('p1', 3)).toBe('peg_p1_3');
  });
});
