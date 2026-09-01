/**
 * 记忆宫殿核心逻辑工具
 *
 * 包含：文章切块、知识包 → 宫殿桩转换、挂载内容解析（含源删除兜底）。
 */
import type {KnowledgePack} from '@/types/knowledge-memory';
import type {TextArticle} from '@/types/text-memory';
import type {ChunkMode, PalaceLocus, PegItem, ResolvedPegContent} from '@/types/memory-palace';

// 句末标点（中英文）
const SENTENCE_ENDINGS = /[^。！？；!?\n]+[。！？；!?]*/g;

/**
 * 把文章内容切成块
 * - sentence：按句切（以 。！？；!? 或换行结尾）
 * - paragraph：按段落切（按换行）
 */
export function chunkArticleContent(content: string, mode: ChunkMode): string[] {
  if (!content || !content.trim()) return [];

  if (mode === 'paragraph') {
    return content
      .split(/\n+/)
      .map(p => p.trim())
      .filter(p => p.length > 0);
  }

  // 按句切：匹配"非句末标点的一段 + 结尾句末标点"，换行天然断句
  const matches = content.match(SENTENCE_ENDINGS);
  if (!matches) return [];
  return matches
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

/**
 * 知识包（usableAsPeg）转换为宫殿桩列表
 * loci 顺序按 item.order（缺失时按原数组顺序）
 */
export function knowledgePackToLoci(pack: KnowledgePack): PalaceLocus[] {
  return pack.items
    .map((item, index) => ({item, key: item.order ?? index + 1}))
    .sort((a, b) => a.key - b.key)
    .map((entry, index) => ({
      order: index + 1,
      name: entry.item.question,
      description: entry.item.answer,
    }));
}

/**
 * 解析桩挂载的展示内容
 * 引用文章不存在或切块越界时返回 deleted=true（不抛错，不级联删除）
 */
export function resolvePegContent(peg: PegItem, articles: TextArticle[]): ResolvedPegContent {
  if (peg.contentRef?.type === 'text-article') {
    const article = articles.find(a => a._id === peg.contentRef!.articleId);
    if (!article) {
      return {text: '', deleted: true};
    }
    const chunks = chunkArticleContent(article.content, peg.contentRef.mode ?? 'sentence');
    const chunk = chunks[peg.contentRef.chunkIndex];
    if (chunk === undefined) {
      return {text: '', deleted: true, articleTitle: article.title};
    }
    return {text: chunk, deleted: false, articleTitle: article.title};
  }
  return {text: peg.freeText ?? '', deleted: false};
}

/**
 * 计算文章切块到宫殿桩的分配方案
 * 逐块挂到尚无挂载的空桩（按桩顺序），桩不足时截断
 * @param chunks 切块后的内容
 * @param loci 宫殿桩列表
 * @param occupiedOrders 已有挂载的桩顺序号集合
 * @returns [chunkIndex, locusOrder] 分配对
 */
export function assignChunksToLoci(
  chunks: string[],
  loci: PalaceLocus[],
  occupiedOrders: ReadonlySet<number>,
): Array<{chunkIndex: number; locusOrder: number}> {
  const freeLoci = [...loci]
    .sort((a, b) => a.order - b.order)
    .filter(l => !occupiedOrders.has(l.order));

  const result: Array<{chunkIndex: number; locusOrder: number}> = [];
  const count = Math.min(chunks.length, freeLoci.length);
  for (let i = 0; i < count; i++) {
    result.push({chunkIndex: i, locusOrder: freeLoci[i].order});
  }
  return result;
}

/**
 * 生成桩挂载 ID（同一宫殿同一桩唯一）
 */
export function buildPegId(palaceId: string, locusOrder: number): string {
  return `peg_${palaceId}_${locusOrder}`;
}
