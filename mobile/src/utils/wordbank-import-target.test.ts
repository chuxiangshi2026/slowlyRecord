/**
 * wordbank-import-target.ts 导入目标词库询问测试
 * 重点：① 当前词库 ② 新建词库（重名校验） ③ 其他已有词库；取消路径返回 null
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { setDbAdapter, resetDbAdapter } from '@/adapters/index'
import type { DbAdapter } from '@/adapters/index'
import { useMobileWords } from '@/stores/useMobileWords'
import { askImportTargetBank } from './wordbank-import-target'

// 内存 Map 兜底 uni storage；ActionSheet / Modal 行为由用例注入
const storage = new Map<string, any>()
let actionSheetHandler: ((opts: any) => void) | null = null
let modalHandler: ((opts: any) => void) | null = null
;(global as any).uni = {
  setStorageSync: (k: string, v: any) => { storage.set(k, v) },
  getStorageSync: (k: string) => storage.get(k) ?? '',
  removeStorageSync: (k: string) => { storage.delete(k) },
  getStorageInfoSync: () => ({ keys: [...storage.keys()] }),
  showToast: vi.fn(),
  showActionSheet: (opts: any) => {
    actionSheetHandler ? actionSheetHandler(opts) : opts.fail?.({ errMsg: 'cancel' })
  },
  showModal: (opts: any) => {
    modalHandler ? modalHandler(opts) : opts.fail?.({ errMsg: 'cancel' })
  },
}

function createMockDbAdapter(): DbAdapter {
  const docs = new Map<string, any>()
  let revCounter = 0
  return {
    get: (id: string) => docs.get(id) || null,
    put: (doc: any) => {
      const rev = `rev-${++revCounter}`
      docs.set(doc._id, { ...doc, _rev: rev })
      return { id: doc._id, ok: true, rev }
    },
    remove: (doc: any) => {
      docs.delete(typeof doc === 'string' ? doc : doc._id)
      return { id: typeof doc === 'string' ? doc : doc._id, ok: true }
    },
    allDocs: (prefix?: string) => {
      const list = Array.from(docs.values())
      return prefix ? list.filter((d: any) => d._id.startsWith(prefix)) : list
    },
    bulkDocs: (docsToPut: any[]) => docsToPut.map(d => ({ id: d._id, ok: true, rev: `rev-${++revCounter}` })),
    promises: {
      get: vi.fn(async (id: string) => docs.get(id) || null),
      put: vi.fn(async (doc: any) => ({ id: doc._id, ok: true, rev: `rev-${++revCounter}` })),
      remove: vi.fn(async (doc: any) => ({ id: typeof doc === 'string' ? doc : doc._id, ok: true })),
      bulkDocs: vi.fn(async (docsToPut: any[]) => docsToPut.map(d => ({ id: d._id, ok: true, rev: `rev-${++revCounter}` }))),
      asyncPut: vi.fn(async (doc: any) => ({ id: doc._id, ok: true, rev: `rev-${++revCounter}` })),
      asyncBulkDocs: vi.fn(async (docsToPut: any[]) => docsToPut.map(d => ({ id: d._id, ok: true, rev: `rev-${++revCounter}` }))),
    },
  }
}

describe('askImportTargetBank', () => {
  beforeEach(async () => {
    storage.clear()
    actionSheetHandler = null
    modalHandler = null
    setActivePinia(createPinia())
    resetDbAdapter()
    setDbAdapter(createMockDbAdapter())
    // 初始化出默认词库（bankList 为空时 getBankById 拿不到当前库）
    const store = useMobileWords()
    await store.loadWords()
  })

  it('选择「导入当前词库」返回 currentBankId', async () => {
    const store = useMobileWords()
    actionSheetHandler = (opts) => opts.success({ tapIndex: 0 })
    await expect(askImportTargetBank('四级词汇')).resolves.toBe(store.currentBankId)
  })

  it('选择「新建词库并导入」：确认输入后创建新词库并返回其 id（不切换当前词库）', async () => {
    const store = useMobileWords()
    const currentBefore = store.currentBankId
    modalHandler = (opts) => opts.success({ confirm: true, content: ' 考研词汇 ' })
    actionSheetHandler = (opts) => opts.success({ tapIndex: 1 })
    const targetId = await askImportTargetBank('考研词汇')
    const created = store.bankList.find(b => b.id === targetId)
    expect(created?.name).toBe('考研词汇')
    expect(store.currentBankId).toBe(currentBefore)
  })

  it('无其他词库时 ActionSheet 只有两项（不出现「选择其他已有词库」）', async () => {
    let itemList: string[] = []
    actionSheetHandler = (opts) => { itemList = opts.itemList; opts.fail({ errMsg: 'cancel' }) }
    await askImportTargetBank('四级词汇')
    expect(itemList.length).toBe(2)
  })

  it('选择「其他已有词库」：二次选择后返回所选库 id', async () => {
    const store = useMobileWords()
    const other = store.createBank('商务英语')
    let sheetCalls = 0
    actionSheetHandler = (opts) => {
      sheetCalls++
      if (sheetCalls === 1) {
        opts.success({ tapIndex: 2 })
      } else {
        // 第二次 ActionSheet 列出其余词库，选第一个
        opts.success({ tapIndex: 0 })
      }
    }
    await expect(askImportTargetBank('四级词汇')).resolves.toBe(other.id)
  })

  it('ActionSheet 取消返回 null', async () => {
    actionSheetHandler = (opts) => opts.fail({ errMsg: 'cancel' })
    await expect(askImportTargetBank('四级词汇')).resolves.toBeNull()
  })

  it('新建词库弹窗取消返回 null（不创建词库）', async () => {
    const store = useMobileWords()
    const countBefore = store.bankList.length
    modalHandler = (opts) => opts.success({ confirm: false })
    actionSheetHandler = (opts) => opts.success({ tapIndex: 1 })
    await expect(askImportTargetBank('四级词汇')).resolves.toBeNull()
    expect(store.bankList.length).toBe(countBefore)
  })

  it('新建词库名与已有库重名返回 null（不创建词库）', async () => {
    const store = useMobileWords()
    const defaultName = store.getBankById(store.currentBankId)?.name || ''
    const countBefore = store.bankList.length
    modalHandler = (opts) => opts.success({ confirm: true, content: defaultName })
    actionSheetHandler = (opts) => opts.success({ tapIndex: 1 })
    await expect(askImportTargetBank('四级词汇')).resolves.toBeNull()
    expect(store.bankList.length).toBe(countBefore)
  })
})
