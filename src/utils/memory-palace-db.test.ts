import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {resetDbAdapter, setDbAdapter, type DbAdapter} from '@/adapters/db';
import type {Palace, PegItem} from '@/types/memory-palace';

vi.mock('@/utils/logger', () => ({
  log: {i: vi.fn(), d: vi.fn(), e: vi.fn(), w: vi.fn()},
}));

const createMockDb = (): DbAdapter => {
  const storage = new Map<string, any>();

  return {
    get: vi.fn((id: string) => storage.get(id) || null),
    put: vi.fn((doc: any) => {
      storage.set(doc._id, {...doc, _rev: '1-rev'});
      return {ok: true, id: doc._id, rev: '1-rev'};
    }),
    remove: vi.fn((id: string | any) => {
      const idStr = typeof id === 'string' ? id : id._id;
      storage.delete(idStr);
      return {ok: true, id: idStr};
    }),
    allDocs: vi.fn((prefix?: string) => {
      const docs: any[] = [];
      storage.forEach((doc, id) => {
        if (!prefix || id.startsWith(prefix)) docs.push(doc);
      });
      return docs;
    }),
    bulkDocs: vi.fn((docs: any[]) => {
      return docs.map(doc => {
        storage.set(doc._id, {...doc, _rev: '1-rev'});
        return {ok: true, id: doc._id, rev: '1-rev'};
      });
    }),
    promises: {
      get: vi.fn(async (id: string) => storage.get(id) || null),
      put: vi.fn(async (doc: any) => {
        storage.set(doc._id, {...doc, _rev: '1-rev'});
        return {ok: true, id: doc._id, rev: '1-rev'};
      }),
      remove: vi.fn(async (id: string | any) => {
        const idStr = typeof id === 'string' ? id : id._id;
        storage.delete(idStr);
        return {ok: true, id: idStr};
      }),
      bulkDocs: vi.fn(async (docs: any[]) => {
        return docs.map(doc => {
          storage.set(doc._id, {...doc, _rev: '1-rev'});
          return {ok: true, id: doc._id, rev: '1-rev'};
        });
      }),
    },
  };
};

function makePalace(id: string): Palace {
  return {
    _id: id,
    name: '测试宫殿',
    loci: [
      {order: 1, name: '大门'},
      {order: 2, name: '客厅'},
    ],
    ctime: 1,
    utime: 1,
  };
}

function makePeg(palaceId: string, locusOrder: number): PegItem {
  return {
    _id: `peg_${palaceId}_${locusOrder}`,
    palaceId,
    locusOrder,
    freeText: `内容${locusOrder}`,
  };
}

describe('memory-palace-db', () => {
  let mockDb: DbAdapter;

  beforeEach(() => {
    mockDb = createMockDb();
    setDbAdapter(mockDb);
  });

  afterEach(() => {
    resetDbAdapter();
    vi.restoreAllMocks();
  });

  it('无文档时返回默认空宫殿列表', async () => {
    const {getPalacesDoc, getAllPalaces} = await import('./memory-palace-db');
    expect(getPalacesDoc().type).toBe('memory_palace_palaces');
    expect(getAllPalaces()).toEqual([]);
  });

  it('保存并读取宫殿', async () => {
    const {savePalace, getPalaceById, getAllPalaces} = await import('./memory-palace-db');
    const result = await savePalace(makePalace('p1'));
    expect(result.ok).toBe(true);
    expect(getPalaceById('p1')?.name).toBe('测试宫殿');
    expect(getAllPalaces()).toHaveLength(1);
  });

  it('重复保存同 id 宫殿为更新', async () => {
    const {savePalace, getAllPalaces, getPalaceById} = await import('./memory-palace-db');
    await savePalace(makePalace('p1'));
    await savePalace({...makePalace('p1'), name: '改名宫殿'});
    expect(getAllPalaces()).toHaveLength(1);
    expect(getPalaceById('p1')?.name).toBe('改名宫殿');
  });

  it('删除宫殿同时删除其桩挂载文档', async () => {
    const {savePalace, savePegItem, removePalace, getAllPalaces, getPegsByPalace} = await import('./memory-palace-db');
    await savePalace(makePalace('p1'));
    await savePegItem(makePeg('p1', 1));
    const result = await removePalace('p1');
    expect(result.ok).toBe(true);
    expect(getAllPalaces()).toHaveLength(0);
    expect(getPegsByPalace('p1')).toHaveLength(0);
  });

  it('保存并读取桩挂载（按桩顺序排序）', async () => {
    const {savePegItem, getPegsByPalace, getMountedCount} = await import('./memory-palace-db');
    await savePegItem(makePeg('p1', 2));
    await savePegItem(makePeg('p1', 1));
    const pegs = getPegsByPalace('p1');
    expect(pegs.map(p => p.locusOrder)).toEqual([1, 2]);
    expect(getMountedCount('p1')).toBe(2);
  });

  it('同桩重复挂载会覆盖（一桩一挂载）', async () => {
    const {savePegItem, getPegsByPalace} = await import('./memory-palace-db');
    await savePegItem(makePeg('p1', 1));
    await savePegItem({...makePeg('p1', 1), _id: 'peg_other', freeText: '新内容'});
    const pegs = getPegsByPalace('p1');
    expect(pegs).toHaveLength(1);
    expect(pegs[0].freeText).toBe('新内容');
  });

  it('批量保存桩挂载', async () => {
    const {savePegItems, getPegsByPalace} = await import('./memory-palace-db');
    const result = await savePegItems([makePeg('p1', 1), makePeg('p1', 2)]);
    expect(result.ok).toBe(true);
    expect(getPegsByPalace('p1')).toHaveLength(2);
  });

  it('删除单个桩挂载', async () => {
    const {savePegItem, removePegItem, getPegsByPalace} = await import('./memory-palace-db');
    await savePegItem(makePeg('p1', 1));
    await removePegItem('p1', 'peg_p1_1');
    expect(getPegsByPalace('p1')).toHaveLength(0);
  });
});
