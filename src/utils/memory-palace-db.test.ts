import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {resetDbAdapter, setDbAdapter, type DbAdapter} from '@/adapters/db';
import type {Palace, PalaceImagesDoc, PegItem} from '@/types/memory-palace';

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

  it('保存宫殿时桩图片单独存为分文档，主文档不再含 dataURL', async () => {
    const {savePalace, getPalaceById, getImagesKey} = await import('./memory-palace-db');
    const palace = makePalace('p1');
    palace.loci[0].imageUrl = 'data:image/png;base64,img1';
    palace.loci[1].imageUrl = 'data:image/png;base64,img2';
    const result = await savePalace(palace);
    expect(result.ok).toBe(true);

    const storedPalace = mockDb.get<PalaceListDoc>('memory_palace_palaces')?.palaces[0];
    expect(storedPalace?.loci[0].imageUrl).toBeUndefined();
    expect(storedPalace?.loci[1].imageUrl).toBeUndefined();

    const imagesDoc = mockDb.get<PalaceImagesDoc>(getImagesKey('p1'));
    expect(imagesDoc?.images['1']).toBe('data:image/png;base64,img1');
    expect(imagesDoc?.images['2']).toBe('data:image/png;base64,img2');

    const readPalace = getPalaceById('p1');
    expect(readPalace?.loci[0].imageUrl).toBe('data:image/png;base64,img1');
    expect(readPalace?.loci[1].imageUrl).toBe('data:image/png;base64,img2');
  });

  it('读取旧宫殿时惰性迁移桩图片到分文档', async () => {
    const {savePalace, getPalaceById, getImagesKey} = await import('./memory-palace-db');
    const palace = makePalace('p1');
    palace.loci[0].imageUrl = 'data:image/png;base64,oldimage';
    await savePalace(palace);

    // 模拟旧数据：直接把 dataURL 写回宫殿主文档，并清空图片文档
    const palacesDoc = mockDb.get<PalaceListDoc>('memory_palace_palaces');
    palacesDoc!.palaces[0].loci[0].imageUrl = 'data:image/png;base64,oldimage';
    mockDb.put!(palacesDoc);
    const imagesDoc = mockDb.get<PalaceImagesDoc>(getImagesKey('p1'));
    mockDb.put!({...imagesDoc!, images: {}});

    // 读取应触发迁移
    const readPalace = getPalaceById('p1');
    expect(readPalace?.loci[0].imageUrl).toBe('data:image/png;base64,oldimage');

    const migratedImagesDoc = mockDb.get<PalaceImagesDoc>(getImagesKey('p1'));
    expect(migratedImagesDoc?.images['1']).toBe('data:image/png;base64,oldimage');

    const migratedPalace = mockDb.get<PalaceListDoc>('memory_palace_palaces')?.palaces[0];
    expect(migratedPalace?.loci[0].imageUrl).toBeUndefined();
  });

  it('图片文档超过体积阈值时拒绝保存并返回提示', async () => {
    const {savePalace} = await import('./memory-palace-db');
    const palace = makePalace('p1');
    // 构造约 900KB 的 dataURL，使图片文档超过 800KB 阈值
    const bigDataUrl = 'data:image/png;base64,' + 'a'.repeat(900 * 1024);
    palace.loci[0].imageUrl = bigDataUrl;
    palace.loci[1].imageUrl = bigDataUrl;
    const result = await savePalace(palace);
    expect(result.ok).toBe(false);
    expect(result.message).toContain('图片过多');
  });

  it('删除宫殿级联删除图片文档', async () => {
    const {savePalace, removePalace, getImagesKey} = await import('./memory-palace-db');
    const palace = makePalace('p1');
    palace.loci[0].imageUrl = 'data:image/png;base64,img1';
    await savePalace(palace);
    expect(mockDb.get(getImagesKey('p1'))).not.toBeNull();

    const result = await removePalace('p1');
    expect(result.ok).toBe(true);
    expect(mockDb.get(getImagesKey('p1'))).toBeNull();
  });

  it('保存宫殿时总图剥离到图片文档，读取时回填', async () => {
    const {savePalace, getPalaceById, getImagesKey, OVERVIEW_IMAGE_KEY} = await import('./memory-palace-db');
    const palace = makePalace('p1');
    palace.overviewImage = 'data:image/png;base64,overview';
    const result = await savePalace(palace);
    expect(result.ok).toBe(true);

    // 主文档不再含总图 dataURL
    const storedPalace = mockDb.get<PalaceListDoc>('memory_palace_palaces')?.palaces[0];
    expect(storedPalace?.overviewImage).toBeUndefined();

    // 总图存到图片文档的保留键上
    const imagesDoc = mockDb.get<PalaceImagesDoc>(getImagesKey('p1'));
    expect(imagesDoc?.images[OVERVIEW_IMAGE_KEY]).toBe('data:image/png;base64,overview');

    // 读取时回填
    const readPalace = getPalaceById('p1');
    expect(readPalace?.overviewImage).toBe('data:image/png;base64,overview');
  });

  it('读取旧宫殿时惰性迁移内嵌总图到图片文档', async () => {
    const {savePalace, getPalaceById, getImagesKey, OVERVIEW_IMAGE_KEY} = await import('./memory-palace-db');
    await savePalace(makePalace('p1'));

    // 模拟旧数据：总图 dataURL 直接内嵌在宫殿主文档，图片文档中没有
    const palacesDoc = mockDb.get<PalaceListDoc>('memory_palace_palaces');
    palacesDoc!.palaces[0].overviewImage = 'data:image/png;base64,oldoverview';
    mockDb.put!(palacesDoc);

    // 读取应触发迁移并回填
    const readPalace = getPalaceById('p1');
    expect(readPalace?.overviewImage).toBe('data:image/png;base64,oldoverview');

    const migratedImagesDoc = mockDb.get<PalaceImagesDoc>(getImagesKey('p1'));
    expect(migratedImagesDoc?.images[OVERVIEW_IMAGE_KEY]).toBe('data:image/png;base64,oldoverview');

    // 主文档中的内嵌 dataURL 已被移除
    const migratedPalace = mockDb.get<PalaceListDoc>('memory_palace_palaces')?.palaces[0];
    expect(migratedPalace?.overviewImage).toBeUndefined();
  });
});

describe('memory-palace-db 同步（memoryPalace scope）', () => {
  let mockDb: DbAdapter;

  beforeEach(() => {
    mockDb = createMockDb();
    setDbAdapter(mockDb);
  });

  afterEach(() => {
    resetDbAdapter();
    vi.restoreAllMocks();
  });

  it('collectMemoryPalaceSync 无宫殿时返回 null', async () => {
    const {collectMemoryPalaceSync} = await import('./memory-palace-db');
    expect(collectMemoryPalaceSync()).toBeNull();
  });

  it('collectMemoryPalaceSync 收集宫殿与桩挂载，并剔除超大图片', async () => {
    const {savePalace, savePegItems, collectMemoryPalaceSync, MAX_SYNC_IMAGE_CHARS} = await import('./memory-palace-db');
    const palace: Palace = {
      ...makePalace('p1'),
      loci: [
        {order: 1, name: '大门', imageUrl: 'data:image/svg+xml,small'},
        {order: 2, name: '客厅', imageUrl: `data:image/png;base64,${'x'.repeat(MAX_SYNC_IMAGE_CHARS + 1)}`},
      ],
      overviewImage: 'data:image/svg+xml,overview-small',
    };
    await savePalace(palace);
    await savePegItems([makePeg('p1', 1)]);

    const data = collectMemoryPalaceSync();
    expect(data).not.toBeNull();
    expect(data!.palaces).toHaveLength(1);
    // 小图保留、超大图剔除
    expect(data!.palaces[0].loci[0].imageUrl).toBe('data:image/svg+xml,small');
    expect(data!.palaces[0].loci[1].imageUrl).toBeUndefined();
    expect(data!.palaces[0].overviewImage).toBe('data:image/svg+xml,overview-small');
    expect(data!.pegs['p1']).toHaveLength(1);
  });

  it('mergePalace 按 utime 较新者覆盖，缺失图片回退本地', async () => {
    const {mergePalace} = await import('./memory-palace-db');
    const local: Palace = {
      ...makePalace('p1'),
      utime: 100,
      loci: [{order: 1, name: '旧名', imageUrl: 'data:local-img'}],
    };
    const remote: Palace = {
      ...makePalace('p1'),
      name: '新名',
      utime: 200,
      loci: [{order: 1, name: '新名'}],
    };
    const merged = mergePalace(local, remote);
    expect(merged.name).toBe('新名');
    // 远端该桩无图，保留本地图片
    expect(merged.loci[0].imageUrl).toBe('data:local-img');

    // 本地较新时保留本地
    const merged2 = mergePalace({...local, utime: 300}, remote);
    expect(merged2.loci[0].name).toBe('旧名');
  });

  it('mergePegItemList 按 locusOrder 合并，learnDate 较新者保留', async () => {
    const {mergePegItemList} = await import('./memory-palace-db');
    const local = [{...makePeg('p1', 1), level: 5, learnDate: 100}];
    const remote = [{...makePeg('p1', 1), level: 8, learnDate: 200}, {...makePeg('p1', 2), level: 1, learnDate: 50}];
    const merged = mergePegItemList(local, remote);
    expect(merged).toHaveLength(2);
    expect(merged.find(p => p.locusOrder === 1)?.level).toBe(8);
    expect(merged.find(p => p.locusOrder === 2)?.level).toBe(1);
    // 远端较旧时保留本地
    const merged2 = mergePegItemList(local, [{...makePeg('p1', 1), level: 2, learnDate: 50}]);
    expect(merged2[0].level).toBe(5);
  });

  it('restoreMemoryPalaceSync 合并写入 DB（新宫殿新增、已有宫殿按 utime 合并）', async () => {
    const {savePalace, restoreMemoryPalaceSync, getPalaceById, getPegsByPalace} = await import('./memory-palace-db');
    await savePalace({...makePalace('p1'), utime: 100});

    const count = await restoreMemoryPalaceSync({
      palaces: [
        {...makePalace('p1'), name: '远端新名', utime: 200},
        {...makePalace('p2'), name: '远端宫殿', utime: 1},
      ],
      pegs: {
        p1: [{...makePeg('p1', 1), level: 3, learnDate: 100}],
        p2: [makePeg('p2', 1)],
      },
    });

    expect(count).toBe(2);
    expect(getPalaceById('p1')?.name).toBe('远端新名');
    expect(getPalaceById('p2')?.name).toBe('远端宫殿');
    expect(getPegsByPalace('p1')[0].level).toBe(3);
    expect(getPegsByPalace('p2')).toHaveLength(1);
  });
});
