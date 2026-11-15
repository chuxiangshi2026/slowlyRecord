import { describe, it, expect, beforeEach } from 'vitest'
import {
  saveDictationProgress,
  loadDictationProgress,
  clearDictationProgress,
} from './dictation-progress'

// 内存版 StorageLike，隔离用例互不污染
function createMemoryStorage() {
  const map = new Map<string, string>()
  return {
    getItem: (key: string) => (map.has(key) ? (map.get(key) as string) : null),
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
    _map: map,
  }
}

describe('dictation-progress（听写进度记忆）', () => {
  let storage: ReturnType<typeof createMemoryStorage>

  beforeEach(() => {
    storage = createMemoryStorage()
  })

  it('保存后可读回，顺序与下标保持不变', () => {
    saveDictationProgress('bank1', 0, ['a', 'b', 'c'], 2, storage)

    const progress = loadDictationProgress('bank1', 0, ['a', 'b', 'c'], storage)

    expect(progress).not.toBeNull()
    expect(progress!.ids).toEqual(['a', 'b', 'c'])
    expect(progress!.index).toBe(2)
  })

  it('currentIds 顺序不同但集合一致也能恢复（听写重排由调用方处理）', () => {
    saveDictationProgress('bank1', 0, ['a', 'b', 'c'], 1, storage)

    const progress = loadDictationProgress('bank1', 0, ['c', 'a', 'b'], storage)

    expect(progress).not.toBeNull()
    expect(progress!.ids).toEqual(['a', 'b', 'c'])
  })

  it('词库内容变化（增词）时返回 null，从头开始', () => {
    saveDictationProgress('bank1', 0, ['a', 'b', 'c'], 1, storage)

    expect(loadDictationProgress('bank1', 0, ['a', 'b', 'c', 'd'], storage)).toBeNull()
  })

  it('词库内容变化（删词）时返回 null', () => {
    saveDictationProgress('bank1', 0, ['a', 'b', 'c'], 1, storage)

    expect(loadDictationProgress('bank1', 0, ['a', 'b'], storage)).toBeNull()
  })

  it('不同词库/模式的进度互相隔离', () => {
    saveDictationProgress('bank1', 0, ['a'], 0, storage)
    saveDictationProgress('bank2', 0, ['x', 'y'], 1, storage)
    saveDictationProgress('bank1', 3, ['p', 'q'], 1, storage)

    expect(loadDictationProgress('bank1', 0, ['a'], storage)!.index).toBe(0)
    expect(loadDictationProgress('bank2', 0, ['y', 'x'], storage)!.ids).toEqual(['x', 'y'])
    expect(loadDictationProgress('bank1', 3, ['q', 'p'], storage)!.ids).toEqual(['p', 'q'])
  })

  it('清除后读回 null，且不影响其它键', () => {
    saveDictationProgress('bank1', 0, ['a'], 0, storage)
    saveDictationProgress('bank1', 3, ['p'], 0, storage)

    clearDictationProgress('bank1', 0, storage)

    expect(loadDictationProgress('bank1', 0, ['a'], storage)).toBeNull()
    expect(loadDictationProgress('bank1', 3, ['p'], storage)).not.toBeNull()
  })

  it('空列表不保存；无存储环境静默降级不抛异常', () => {
    saveDictationProgress('bank1', 0, [], 0, storage)
    expect(loadDictationProgress('bank1', 0, [], storage)).toBeNull()

    expect(() => saveDictationProgress('bank1', 0, ['a'], 0, null)).not.toThrow()
    expect(() => loadDictationProgress('bank1', 0, ['a'], null)).not.toThrow()
    expect(loadDictationProgress('bank1', 0, ['a'], null)).toBeNull()
    expect(() => clearDictationProgress('bank1', 0, null)).not.toThrow()
  })
})
