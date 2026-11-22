/**
 * mapping-image-store（数字/字母映射图片本机存储，商店版）单元测试
 * dataURL 外联为 bulk: 引用、读取还原、非商店版透传
 */
import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import {
  _setStoreLocalOnlyForTest,
  initLocalBulkStore,
  localBulkGet,
} from '@/adapters/local-bulk-store'
import {
  externalizeMappingImages,
  hasInlineMappingImages,
  isBulkImageRef,
  removeMappingImageRef,
  resolveMappingImages,
} from './mapping-image-store'

const DATA_URL = 'data:image/webp;base64,AAAA'

async function enableStore() {
  _setStoreLocalOnlyForTest(true)
  await initLocalBulkStore()
}

afterEach(() => {
  _setStoreLocalOnlyForTest(null)
})

describe('mapping-image-store（商店版）', () => {
  it('外联：dataURL 落本机，imageUrl 改写为 bulk: 引用，可还原', async () => {
    await enableStore()
    const items = [{ number: '7', imageUrl: DATA_URL }]
    await externalizeMappingImages(items, 'number', (a) => a.number)

    expect(isBulkImageRef(items[0].imageUrl)).toBe(true)
    expect(localBulkGet(items[0].imageUrl!)).toBe(DATA_URL)

    resolveMappingImages(items)
    expect(items[0].imageUrl).toBe(DATA_URL)
  })

  it('外联：已是引用或非 dataURL 的值保持不变', async () => {
    await enableStore()
    const items = [
      { number: '1', imageUrl: 'preset://cat' },
      { number: '2', imageUrl: 'bulk:mapping-image:number:2' },
    ]
    await externalizeMappingImages(items, 'number', (a) => a.number)
    expect(items[0].imageUrl).toBe('preset://cat')
    expect(items[1].imageUrl).toBe('bulk:mapping-image:number:2')
  })

  it('还原：本机缺失的引用置空串', async () => {
    await enableStore()
    const items = [{ number: '9', imageUrl: 'bulk:mapping-image:number:9' }]
    resolveMappingImages(items)
    expect(items[0].imageUrl).toBe('')
  })

  it('hasInlineMappingImages 只认 dataURL', async () => {
    await enableStore()
    expect(hasInlineMappingImages([{ imageUrl: DATA_URL }])).toBe(true)
    expect(hasInlineMappingImages([{ imageUrl: 'bulk:mapping-image:number:1' }])).toBe(false)
    expect(hasInlineMappingImages([])).toBe(false)
  })

  it('removeMappingImageRef 清理本机图片', async () => {
    await enableStore()
    const items = [{ number: '3', imageUrl: DATA_URL }]
    await externalizeMappingImages(items, 'number', (a) => a.number)
    const ref = items[0].imageUrl!
    expect(localBulkGet(ref)).toBe(DATA_URL)
    await removeMappingImageRef('number', '3')
    expect(localBulkGet(ref)).toBeNull()
  })

  it('非商店版全部透传', async () => {
    _setStoreLocalOnlyForTest(false)
    const items = [{ number: '7', imageUrl: DATA_URL }]
    await externalizeMappingImages(items, 'number', (a) => a.number)
    expect(items[0].imageUrl).toBe(DATA_URL)
    resolveMappingImages(items)
    expect(items[0].imageUrl).toBe(DATA_URL)
    expect(hasInlineMappingImages([{ imageUrl: DATA_URL }])).toBe(false)
  })
})
