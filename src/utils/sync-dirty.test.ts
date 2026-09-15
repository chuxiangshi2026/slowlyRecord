/**
 * 同步脏标记（sync-dirty.ts）单元测试
 *
 * 用 setDbStorage 注入内存键值存储，聚焦验证：
 * 未同步过不亮红点、同步后又有本地改动亮红点、markSynced 后熄灭、
 * 存储读写异常时静默降级不抛错。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setDbStorage, type DbStorageAdapter } from '@/adapters/db'
import {
  syncDirty,
  refreshSyncDirty,
  markLocalChange,
  markSynced,
  daysSinceLastSync,
} from './sync-dirty'

function createStorage() {
  const map = new Map<string, any>()
  const storage: DbStorageAdapter = {
    getItem: vi.fn((key: string) => (map.has(key) ? map.get(key) : null)),
    setItem: vi.fn((key: string, value: any) => { map.set(key, value) }),
    removeItem: vi.fn((key: string) => { map.delete(key) }),
  }
  return { map, storage }
}

let env: ReturnType<typeof createStorage>

beforeEach(() => {
  env = createStorage()
  setDbStorage(env.storage)
  syncDirty.value = false
})

afterEach(() => {
  vi.useRealTimers()
})

describe('refreshSyncDirty', () => {
  it('从未同步过（无 lastSync）时不亮红点', () => {
    refreshSyncDirty()
    expect(syncDirty.value).toBe(false)
  })

  it('从未同步过即使发生本地改动也不亮（避免噪音）', () => {
    markLocalChange(2000)
    expect(syncDirty.value).toBe(false)
  })

  it('同步后又有本地改动（lastChange > lastSync）时亮红点', () => {
    markSynced(1000)
    expect(syncDirty.value).toBe(false)
    markLocalChange(2000)
    expect(syncDirty.value).toBe(true)
  })

  it('改动时间等于同步时间时不亮（需严格晚于）', () => {
    markSynced(1000)
    markLocalChange(1000)
    expect(syncDirty.value).toBe(false)
  })

  it('直接注入存储数据也能正确刷新', () => {
    env.map.set('slowlyrecord_sync_last_sync', 1000)
    env.map.set('slowlyrecord_sync_last_change', 1500)
    refreshSyncDirty()
    expect(syncDirty.value).toBe(true)
  })
})

describe('markSynced', () => {
  it('写入 lastSync 并熄灭红点', () => {
    markSynced(1000)
    markLocalChange(2000)
    expect(syncDirty.value).toBe(true)

    markSynced(2000)
    expect(env.map.get('slowlyrecord_sync_last_sync')).toBe(2000)
    expect(syncDirty.value).toBe(false)
  })
})

describe('存储异常静默降级', () => {
  it('读取抛错时不抛异常且不亮红点', () => {
    env.storage.getItem = () => { throw new Error('storage broken') }
    expect(() => refreshSyncDirty()).not.toThrow()
    expect(syncDirty.value).toBe(false)
  })

  it('写入抛错时 markLocalChange / markSynced 不抛异常', () => {
    env.storage.setItem = () => { throw new Error('storage broken') }
    expect(() => markLocalChange(2000)).not.toThrow()
    expect(() => markSynced(3000)).not.toThrow()
    expect(syncDirty.value).toBe(false)
  })

  it('存储值为非数字时按 0 处理', () => {
    env.map.set('slowlyrecord_sync_last_sync', 'not-a-number')
    env.map.set('slowlyrecord_sync_last_change', 2000)
    refreshSyncDirty()
    expect(syncDirty.value).toBe(false)
    expect(daysSinceLastSync()).toBe(-1)
  })
})

describe('daysSinceLastSync', () => {
  it('从未同步过返回 -1', () => {
    expect(daysSinceLastSync()).toBe(-1)
  })

  it('按天向下取整返回距上次同步的天数', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-16T12:00:00+08:00'))
    const now = Date.now()

    markSynced(now - 3 * 86400000)
    expect(daysSinceLastSync()).toBe(3)

    markSynced(now - 86399999)
    expect(daysSinceLastSync()).toBe(0)

    markSynced(now - 86400000)
    expect(daysSinceLastSync()).toBe(1)
  })
})
