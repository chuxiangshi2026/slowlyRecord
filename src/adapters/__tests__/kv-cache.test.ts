/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest'
import { getKvCache } from '../kv-cache'
import 'fake-indexeddb/auto'

describe('kv-cache adapter', () => {
  it('put/get 往返（对象值）', async () => {
    const cache = getKvCache('TestKV1', 'store')
    await cache.put('k1', { a: 1, b: '文本' })
    await expect(cache.get('k1')).resolves.toEqual({ a: 1, b: '文本' })
  })

  it('put/get 往返（ArrayBuffer 二进制）', async () => {
    const cache = getKvCache('TestKV2', 'store')
    const buf = new Uint8Array([1, 2, 3, 255]).buffer
    await cache.put('bin', buf)
    const got = await cache.get<ArrayBuffer>('bin')
    expect(got).not.toBeNull()
    expect(Array.from(new Uint8Array(got!))).toEqual([1, 2, 3, 255])
  })

  it('未写入的 key 返回 null', async () => {
    const cache = getKvCache('TestKV3', 'store')
    await expect(cache.get('missing')).resolves.toBeNull()
  })

  it('相同 db/store 复用连接，跨实例可见同一数据', async () => {
    const a = getKvCache('TestKV4', 'store')
    const b = getKvCache('TestKV4', 'store')
    await a.put('shared', 'v')
    await expect(b.get('shared')).resolves.toBe('v')
  })

  it('覆盖写生效', async () => {
    const cache = getKvCache('TestKV5', 'store')
    await cache.put('k', 'old')
    await cache.put('k', 'new')
    await expect(cache.get('k')).resolves.toBe('new')
  })
})
