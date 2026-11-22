/**
 * 商店版（uTools + __STORE_BUILD__）记忆宫殿图片存储行为：
 * 桩图/总图 dataURL 落本机存储，同步库图片文档只保留引用（不含 dataURL）；
 * 旧版含 dataURL 的同步库文档读取时自动迁移；同步负载不携带任何图片。
 */
import 'fake-indexeddb/auto'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {resetDbAdapter, setDbAdapter, type DbAdapter} from '@/adapters/db'
import type {Palace, PalaceImagesDoc} from '@/types/memory-palace'
import {
  _setStoreLocalOnlyForTest,
  initLocalBulkStore,
  localBulkGet,
  localBulkRemove,
} from '@/adapters/local-bulk-store'

vi.mock('@/utils/logger', () => ({
  log: {i: vi.fn(), d: vi.fn(), e: vi.fn(), w: vi.fn()},
}))

import {
  attachImagesToPalace,
  collectMemoryPalaceSync,
  getPalaceById,
  getPalacesDoc,
  removePalace,
  savePalace,
  stripOversizedImages,
} from './memory-palace-db'

const createMockDb = (): DbAdapter => {
  const storage = new Map<string, any>()
  return {
    get: vi.fn((id: string) => storage.get(id) || null),
    put: vi.fn((doc: any) => {
      storage.set(doc._id, {...doc, _rev: '1-rev'})
      return {ok: true, id: doc._id, rev: '1-rev'}
    }),
    remove: vi.fn((id: string | any) => {
      const idStr = typeof id === 'string' ? id : id._id
      storage.delete(idStr)
      return {ok: true, id: idStr}
    }),
    allDocs: vi.fn((prefix?: string) => {
      const docs: any[] = []
      storage.forEach((doc, id) => {
        if (!prefix || id.startsWith(prefix)) docs.push(doc)
      })
      return docs
    }),
    bulkDocs: vi.fn(),
    promises: {
      get: vi.fn(async (id: string) => storage.get(id) || null),
      put: vi.fn(async (doc: any) => {
        storage.set(doc._id, {...doc, _rev: '1-rev'})
        return {ok: true, id: doc._id, rev: '1-rev'}
      }),
      remove: vi.fn(async (id: string | any) => {
        const idStr = typeof id === 'string' ? id : id._id
        storage.delete(idStr)
        return {ok: true, id: idStr}
      }),
      bulkDocs: vi.fn(async (docs: any[]) => docs.map(doc => {
        storage.set(doc._id, {...doc, _rev: '1-rev'})
        return {ok: true, id: doc._id, rev: '1-rev'}
      })),
    },
  }
}

const PNG_DATA_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

function makePalace(id: string): Palace {
  return {
    _id: id,
    name: '测试宫殿',
    loci: [
      {order: 1, name: '大门', imageUrl: PNG_DATA_URL},
      {order: 2, name: '客厅'},
    ],
    overviewImage: PNG_DATA_URL,
    ctime: 1,
    utime: 1,
  }
}

describe('memory-palace-db（商店版图片本机存储）', () => {
  let mockDb: DbAdapter

  beforeEach(async () => {
    mockDb = createMockDb()
    setDbAdapter(mockDb)
    _setStoreLocalOnlyForTest(true)
    await initLocalBulkStore()
    await localBulkRemove('memory_palace_images_p1')
    await localBulkRemove('memory_palace_images_p2')
  })

  afterEach(async () => {
    _setStoreLocalOnlyForTest(null)
    resetDbAdapter()
    await localBulkRemove('memory_palace_images_p1')
    await localBulkRemove('memory_palace_images_p2')
  })

  function getSyncedImagesDoc(palaceId: string): PalaceImagesDoc | null {
    return mockDb.get(`memory_palace_images_${palaceId}`) as PalaceImagesDoc | null
  }

  it('保存宫殿：图片落本机存储，同步库图片文档只存引用，主文档不含 dataURL', async () => {
    const result = await savePalace(makePalace('p1'))
    expect(result.ok).toBe(true)

    // 主文档不含任何 dataURL
    const palacesDoc = getPalacesDoc()
    const saved = palacesDoc.palaces.find(p => p._id === 'p1')!
    expect(saved.loci[0].imageUrl).toBeUndefined()
    expect(saved.overviewImage).toBeUndefined()

    // 同步库图片文档：images 为空、只留引用（字节数）
    const syncedImages = getSyncedImagesDoc('p1')!
    expect(syncedImages).toBeTruthy()
    expect(syncedImages.images).toEqual({})
    expect(syncedImages.refs).toEqual({'1': PNG_DATA_URL.length, '__overview__': PNG_DATA_URL.length})
    expect(JSON.stringify(syncedImages)).not.toContain('data:image')

    // 本机存储含图片本体
    const local = localBulkGet<PalaceImagesDoc>('memory_palace_images_p1')!
    expect(local.images['1']).toBe(PNG_DATA_URL)
    expect(local.images['__overview__']).toBe(PNG_DATA_URL)
  })

  it('读取宫殿：从本机存储装配图片', async () => {
    await savePalace(makePalace('p1'))
    const loaded = getPalaceById('p1')!
    expect(loaded.loci[0].imageUrl).toBe(PNG_DATA_URL)
    expect(loaded.overviewImage).toBe(PNG_DATA_URL)
  })

  it('旧版同步库图片文档（含 dataURL）读取时迁移：本机可见，同步库收窄为引用', async () => {
    // 造一座无图宫殿 + 旧版含 dataURL 的图片文档
    const palace = makePalace('p2')
    delete palace.overviewImage
    palace.loci[0] = {order: 1, name: '大门'}
    await savePalace(palace)
    mockDb.put({
      _id: 'memory_palace_images_p2',
      type: 'memory_palace_images',
      palaceId: 'p2',
      images: {'1': PNG_DATA_URL},
      updatedAt: Date.now(),
    })

    const assembled = attachImagesToPalace(getSyncedImagesDocAsPalace('p2'))
    expect(assembled.loci[0].imageUrl).toBe(PNG_DATA_URL)

    // 迁移为异步：本机存储拿到图片，同步库文档被改写为纯引用
    await vi.waitFor(() => {
      expect(localBulkGet<PalaceImagesDoc>('memory_palace_images_p2')?.images['1']).toBe(PNG_DATA_URL)
    })
    await vi.waitFor(() => {
      const synced = getSyncedImagesDoc('p2')!
      expect(synced.images).toEqual({})
      expect(synced.refs).toEqual({'1': PNG_DATA_URL.length})
    })

    function getSyncedImagesDocAsPalace(palaceId: string): Palace {
      const doc = (mockDb.get('memory_palace_palaces') as any).palaces.find((p: Palace) => p._id === palaceId)
      return doc
    }
  })

  it('同步负载不携带任何图片 dataURL（小图也剔除）', async () => {
    await savePalace(makePalace('p1'))

    const stripped = stripOversizedImages(makePalace('px'))
    expect(stripped.loci[0].imageUrl).toBeUndefined()
    expect(stripped.overviewImage).toBeUndefined()

    const syncData = collectMemoryPalaceSync()!
    expect(JSON.stringify(syncData)).not.toContain('data:image')
  })

  it('删除宫殿时同时清理本机图片', async () => {
    await savePalace(makePalace('p1'))
    expect(localBulkGet('memory_palace_images_p1')).not.toBeNull()
    await removePalace('p1')
    expect(localBulkGet('memory_palace_images_p1')).toBeNull()
    expect(getSyncedImagesDoc('p1')).toBeNull()
  })
})
