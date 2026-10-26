/**
 * @vitest-environment jsdom
 */
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {createPinia, setActivePinia} from 'pinia'
import {MiniProgramDbAdapter, resetDbAdapter, setDbAdapter} from '@/adapters/index'
import {useWordBook} from './useWordBook'
import type {WordBookWord} from '../types/word-book'

const mockStorage = new Map<string, any>()
;(global as any).uni = {
  setStorageSync: vi.fn((key: string, data: any) => { mockStorage.set(key, data) }),
  getStorageSync: vi.fn((key: string) => mockStorage.get(key) ?? null),
  removeStorageSync: vi.fn((key: string) => { mockStorage.delete(key) }),
  getStorageInfoSync: vi.fn(() => ({keys: Array.from(mockStorage.keys()), currentSize: 0, limitSize: 10240})),
}

function words(count: number): WordBookWord[] {
  return Array.from({length: count}, (_, index) => ({sourceId: `w-${index}`, text: `word${index}`, explains: `释义${index}`}))
}

describe('useWordBook', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockStorage.clear()
    setDbAdapter(new MiniProgramDbAdapter())
  })

  afterEach(() => resetDbAdapter())

  it('创建、逐页解锁、整章解锁和删除均可读回', () => {
    const store = useWordBook()
    const first = store.createChapter('第一章', '词根 spect', words(13))
    const second = store.createChapter('第二章', '词根 port', words(1))
    const firstId = first.chapter._id
    const secondId = second.chapter._id
    expect(store.chapterUnlocked(secondId)).toBe(false)
    expect(store.completePage(firstId, first.chapter.pages[0].id, 1).ok).toBe(true)
    expect(store.pageUnlocked(firstId, first.chapter.pages[1].id)).toBe(true)
    expect(store.completePage(firstId, first.chapter.pages[1].id, 0).ok).toBe(true)
    expect(store.chapterUnlocked(secondId)).toBe(true)

    setActivePinia(createPinia())
    const restored = useWordBook()
    restored.load()
    expect(restored.getChapter(firstId)?.pages.every(page => !!page.completedAt)).toBe(true)
    expect(restored.getChapter(secondId)?.name).toBe('第二章')
    expect(restored.deleteChapter(secondId).ok).toBe(true)

    setActivePinia(createPinia())
    const afterDelete = useWordBook()
    afterDelete.load()
    expect(afterDelete.chapters.map(chapter => chapter._id)).toEqual([firstId])
  })
})
