/**
 * app-bg-db（主界面背景图存取）单元测试
 * db 适配器 mock 为内存 Map，验证固定 _id 读写、覆盖更新与删除
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mock = vi.hoisted(() => {
  const docs = new Map<string, any>()
  let revCounter = 0
  const db = {
    allDocs: (prefix?: string) => [...docs.values()].filter(d => !prefix || d._id.startsWith(prefix)),
    promises: {
      put: async (doc: any) => {
        const existing = docs.get(doc._id)
        if (existing && doc._rev !== existing._rev) {
          return { ok: false, error: true, message: 'conflict' }
        }
        doc._rev = `r${++revCounter}`
        docs.set(doc._id, doc)
        return { ok: true, id: doc._id, rev: doc._rev }
      }
    },
    remove: (id: string) => {
      if (!docs.has(id)) return { ok: false, error: true, message: 'not_found' }
      docs.delete(id)
      return { ok: true, id }
    }
  }
  return { docs, db }
})

vi.mock('@/adapters/db', () => ({ getDbAdapter: () => mock.db }))
vi.mock('@/utils/logger', () => ({ log: { i: vi.fn(), w: vi.fn(), d: vi.fn(), e: vi.fn() } }))

import { getAppBgImage, saveAppBgImage, removeAppBgImage, APP_BG_DOC_ID } from '@/utils/app-bg-db'

describe('app-bg-db（界面背景图存取）', () => {
  beforeEach(() => {
    mock.docs.clear()
  })

  it('无图时读取返回空串', () => {
    expect(getAppBgImage()).toBe('')
  })

  it('保存后可读取，使用固定 _id', async () => {
    expect(await saveAppBgImage('data:image/jpeg;base64,xxx')).toBe(true)
    expect(getAppBgImage()).toBe('data:image/jpeg;base64,xxx')
    expect(mock.docs.has(APP_BG_DOC_ID)).toBe(true)
  })

  it('重复保存覆盖更新（自动带上最新 _rev），不产生第二个文档', async () => {
    await saveAppBgImage('data:image/jpeg;base64,a')
    await saveAppBgImage('data:image/jpeg;base64,b')
    expect(getAppBgImage()).toBe('data:image/jpeg;base64,b')
    expect(mock.docs.size).toBe(1)
  })

  it('删除后读取为空；重复删除静默不抛错', async () => {
    await saveAppBgImage('data:image/jpeg;base64,a')
    removeAppBgImage()
    expect(getAppBgImage()).toBe('')
    expect(() => removeAppBgImage()).not.toThrow()
  })
})
