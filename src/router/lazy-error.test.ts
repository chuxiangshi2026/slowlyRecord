import { describe, expect, it } from 'vitest'
import { clearLazyRouteRetry, consumeLazyRouteRetry, isLazyRouteLoadError, lazyRouteRetryKey } from './lazy-error'

function storage(): Storage {
  const data = new Map<string, string>()
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => { data.set(key, value) },
    removeItem: (key) => { data.delete(key) },
    length: 0,
    clear: () => data.clear(),
    key: () => null,
  }
}

describe('lazy-error', () => {
  it('识别动态模块和 Chunk 加载错误', () => {
    expect(isLazyRouteLoadError(new Error("Failed to fetch dynamically imported module: https://slowrecap.cn/assets/Word-a.js"))).toBe(true)
    expect(isLazyRouteLoadError(new Error('Loading chunk 123 failed'))).toBe(true)
    expect(isLazyRouteLoadError(new Error('普通业务错误'))).toBe(false)
  })

  it('同一路由每会话只自动重试一次', () => {
    const store = storage()
    expect(consumeLazyRouteRetry('/word', store)).toBe(true)
    expect(consumeLazyRouteRetry('/word', store)).toBe(false)
    expect(consumeLazyRouteRetry('/dictation', store)).toBe(true)
  })

  it('成功导航后清理重试标记', () => {
    const store = storage()
    consumeLazyRouteRetry('/word', store)
    clearLazyRouteRetry('/word', store)
    expect(store.getItem(lazyRouteRetryKey('/word'))).toBeNull()
    expect(consumeLazyRouteRetry('/word', store)).toBe(true)
  })
})
