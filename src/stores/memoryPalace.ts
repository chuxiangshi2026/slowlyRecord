/**
 * 记忆宫殿 Pinia store
 *
 * 只做文本记忆文章的读取与引用，不改动 textMemory 的现有行为。
 */
import {defineStore} from 'pinia';
import {computed, ref} from 'vue';
import type {ChunkMode, Palace, PalaceLocus, PegItem} from '@/types/memory-palace';
import type {TextArticle} from '@/types/text-memory';
import {getDbAdapterAsync} from '@/adapters/db';
import {log} from '@/utils/logger';
import {fetchKnowledgePack, listKnowledgePacks} from '@/utils/knowledge-pack-service';
import type {KnowledgePackInfo} from '@/types/knowledge-memory';
import {
  getAllPalaces,
  getMountedCount,
  getPalaceById,
  getPegsByPalace,
  removePalace,
  removePegItem,
  savePalace,
  savePegItem,
  savePegItems,
} from '@/utils/memory-palace-db';
import {assignChunksToLoci, buildPegId, chunkArticleContent, knowledgePackToLoci} from '@/utils/memory-palace-util';
import {markForgotten, markRemembered} from '@/utils/memory-palace-srs';
import {useWordsStore} from '@/stores/words';

// 生成唯一 ID
function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

export const useMemoryPalaceStore = defineStore('memoryPalace', () => {
  // 所有宫殿
  const palaces = ref<Palace[]>([]);
  // 当前宫殿的桩挂载
  const pegs = ref<PegItem[]>([]);
  // 当前宫殿 id
  const currentPalaceId = ref<string>('');
  const loading = ref(false);

  // 当前宫殿对象
  const currentPalace = computed<Palace | null>(() => {
    return palaces.value.find(p => p._id === currentPalaceId.value) || null;
  });

  /** 确保 DB 适配器已初始化（非 uTools 环境必须先 await） */
  async function ensureDb() {
    await getDbAdapterAsync();
  }

  /** 加载所有宫殿 */
  async function loadPalaces() {
    loading.value = true;
    try {
      await ensureDb();
      palaces.value = getAllPalaces();
      log.i('加载记忆宫殿', palaces.value.length);
    } finally {
      loading.value = false;
    }
  }

  /** 宫殿已挂载数量 */
  function mountedCount(palaceId: string): number {
    return getMountedCount(palaceId);
  }

  /**
   * 新建宫殿
   */
  async function createPalace(name: string, loci: PalaceLocus[], sourcePackId?: string, overviewImage?: string) {
    await ensureDb();
    const now = Date.now();
    const palace: Palace = {
      _id: `palace_${generateId()}`,
      name: name.trim(),
      loci: normalizeLoci(loci),
      overviewImage: overviewImage || undefined,
      sourcePackId,
      ctime: now,
      utime: now,
    };
    const result = await savePalace(palace);
    if (result.ok) {
      palaces.value.push(palace);
    }
    return {result, palace};
  }

  /**
   * 更新宫殿（名称/桩列表）
   */
  async function updatePalace(palace: Palace) {
    await ensureDb();
    const updated: Palace = {
      ...palace,
      loci: normalizeLoci(palace.loci),
      utime: Date.now(),
    };
    const result = await savePalace(updated);
    if (result.ok) {
      const index = palaces.value.findIndex(p => p._id === updated._id);
      if (index >= 0) {
        palaces.value[index] = updated;
      }
      // 桩被删除时清理对应挂载
      const validOrders = new Set(updated.loci.map(l => l.order));
      const stale = pegs.value.filter(p => p.palaceId === updated._id && !validOrders.has(p.locusOrder));
      for (const peg of stale) {
        await removePegItem(updated._id, peg._id);
        pegs.value = pegs.value.filter(p => p._id !== peg._id);
      }
    }
    return result;
  }

  /**
   * 删除宫殿（不级联删文本记忆文章）
   */
  async function deletePalace(palaceId: string) {
    await ensureDb();
    const result = await removePalace(palaceId);
    if (result.ok) {
      palaces.value = palaces.value.filter(p => p._id !== palaceId);
      if (currentPalaceId.value === palaceId) {
        currentPalaceId.value = '';
        pegs.value = [];
      }
    }
    return result;
  }

  /**
   * 列出可作为桩库导入的内置知识包
   */
  function listPegPacks(): KnowledgePackInfo[] {
    return listKnowledgePacks().filter(p => p.usableAsPeg);
  }

  /**
   * 从内置知识包一键导入为宫殿（loci = 包的 items 按 order）
   */
  async function importPackAsPalace(packId: string) {
    await ensureDb();
    const pack = await fetchKnowledgePack(packId);
    const loci = knowledgePackToLoci(pack);
    return createPalace(pack.name, loci, pack.id);
  }

  /** 加载宫殿的桩挂载 */
  async function loadPegs(palaceId: string) {
    await ensureDb();
    currentPalaceId.value = palaceId;
    // 宫殿列表未加载时兜底加载（如刷新详情页）
    if (!getPalaceById(palaceId)) {
      palaces.value = getAllPalaces();
    }
    pegs.value = getPegsByPalace(palaceId);
  }

  /** 按桩顺序查找挂载 */
  function getPegByLocus(locusOrder: number): PegItem | undefined {
    return pegs.value.find(p => p.locusOrder === locusOrder);
  }

  /**
   * 挂载自由文本到指定桩
   */
  async function mountFreeText(palaceId: string, locusOrder: number, freeText: string, mnemonic?: string) {
    await ensureDb();
    const peg: PegItem = {
      _id: buildPegId(palaceId, locusOrder),
      palaceId,
      locusOrder,
      freeText: freeText.trim(),
      mnemonic: mnemonic?.trim() || undefined,
    };
    const result = await savePegItem(peg);
    if (result.ok) {
      upsertLocalPeg(peg);
    }
    return result;
  }

  /**
   * 挂载文本记忆文章：切块后逐块挂到空桩（引用，不复制内容）
   */
  async function mountArticle(palace: Palace, article: TextArticle, mode: ChunkMode) {
    await ensureDb();
    const chunks = chunkArticleContent(article.content, mode);
    if (chunks.length === 0) {
      return {result: {ok: false, id: '', error: true, message: '文章内容为空'}, mounted: 0};
    }

    // 切块索引与切块方式一起存入引用，解析时用同一方式还原
    const occupied = new Set(getPegsByPalace(palace._id).map(p => p.locusOrder));
    const assignments = assignChunksToLoci(chunks, palace.loci, occupied);

    const items: PegItem[] = assignments.map(({chunkIndex, locusOrder}) => ({
      _id: buildPegId(palace._id, locusOrder),
      palaceId: palace._id,
      locusOrder,
      contentRef: {
        type: 'text-article',
        articleId: article._id,
        chunkIndex,
        mode,
      },
    }));

    const result = await savePegItems(items);
    if (result.ok) {
      await loadPegs(palace._id);
    }
    return {result, mounted: items.length, totalChunks: chunks.length};
  }

  /**
   * 解除单个桩的挂载
   */
  async function unmountPeg(peg: PegItem) {
    await ensureDb();
    const result = await removePegItem(peg.palaceId, peg._id);
    if (result.ok) {
      pegs.value = pegs.value.filter(p => p._id !== peg._id);
    }
    return result;
  }

  /**
   * 巡视自评（记住/忘记），按统一 SRS 标准更新
   */
  async function assessPeg(peg: PegItem, remembered: boolean) {
    await ensureDb();
    const wordsStore = useWordsStore();
    const firmness = wordsStore.memoryFirmness ?? '正常';
    const updated = remembered ? markRemembered(peg, Date.now(), firmness) : markForgotten(peg);
    const result = await savePegItem(updated);
    if (result.ok) {
      upsertLocalPeg(updated);
    }
    return result;
  }

  // 规范化桩列表：重排 order、去掉空名称桩
  function normalizeLoci(loci: PalaceLocus[]): PalaceLocus[] {
    return loci
      .filter(l => l.name && l.name.trim())
      .map((l, index) => ({
        order: index + 1,
        name: l.name.trim(),
        imageUrl: l.imageUrl,
        description: l.description?.trim() || undefined,
        alternates: l.alternates?.length ? [...l.alternates] : undefined,
      }));
  }

  // 更新本地挂载列表（同桩覆盖）
  function upsertLocalPeg(peg: PegItem) {
    const index = pegs.value.findIndex(p => p._id === peg._id || p.locusOrder === peg.locusOrder);
    if (index >= 0) {
      pegs.value[index] = peg;
    } else {
      pegs.value.push(peg);
    }
    pegs.value = [...pegs.value].sort((a, b) => a.locusOrder - b.locusOrder);
  }

  return {
    palaces,
    pegs,
    currentPalaceId,
    currentPalace,
    loading,
    loadPalaces,
    mountedCount,
    createPalace,
    updatePalace,
    deletePalace,
    listPegPacks,
    importPackAsPalace,
    loadPegs,
    getPegByLocus,
    mountFreeText,
    mountArticle,
    unmountPeg,
    assessPeg,
  };
});
