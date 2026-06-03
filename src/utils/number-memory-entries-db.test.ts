// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setDbAdapter, resetDbAdapter, type DbAdapter } from '@/adapters/db'
import 'fake-indexeddb/auto'

// Mock logger
vi.mock('@/utils/logger', () => ({
  log: { i: vi.fn(), d: vi.fn(), e: vi.fn(), w: vi.fn() },
}))

// Mock constants
vi.mock('@/constants', () => ({
  DB_KEY_NUMBER_MEMORY: 'number_memory_',
}))

async function loadModule() {
  return await import('./number-memory-entries-db')
}

const createMockDb = (): DbAdapter => {
  const storage = new Map<string, any>()

  return {
    get: vi.fn((id: string) => storage.get(id) || null),
    put: vi.fn((doc: any) => {
      storage.set(doc._id, { ...doc, _rev: '1-rev' })
      return { ok: true, id: doc._id, rev: '1-rev' }
    }),
    remove: vi.fn((id: string) => {
      const idStr = typeof id === 'string' ? id : (id as any)._id
      storage.delete(idStr)
      return { ok: true, id: idStr }
    }),
    allDocs: vi.fn((prefix?: string) => {
      const docs: any[] = []
      storage.forEach((doc, id) => {
        if (!prefix || id.startsWith(prefix)) {
          docs.push(doc)
        }
      })
      return docs
    }),
    bulkDocs: vi.fn((docs: any[]) => {
      return docs.map(doc => {
        storage.set(doc._id, { ...doc, _rev: '1-rev' })
        return { ok: true, id: doc._id, rev: '1-rev' }
      })
    }),
    promises: {
      get: vi.fn(async (id: string) => storage.get(id) || null),
      put: vi.fn(async (doc: any) => {
        storage.set(doc._id, { ...doc, _rev: '1-rev' })
        return { ok: true, id: doc._id, rev: '1-rev' }
      }),
      remove: vi.fn(async (id: string) => {
        const idStr = typeof id === 'string' ? id : (id as any)._id
        storage.delete(idStr)
        return { ok: true, id: idStr }
      }),
      bulkDocs: vi.fn(async (docs: any[]) => {
        return docs.map(doc => {
          storage.set(doc._id, { ...doc, _rev: '1-rev' })
          return { ok: true, id: doc._id, rev: '1-rev' }
        })
      }),
    },
  }
}

describe('number-memory-entries-db', () => {
  let mockDb: DbAdapter

  beforeEach(() => {
    mockDb = createMockDb()
    setDbAdapter(mockDb)
    vi.clearAllMocks()
  })

  afterEach(() => {
    resetDbAdapter()
    vi.restoreAllMocks()
  })

  describe('getAllEntries', () => {
    it('无条目时应返回空数组', async () => {
      const { getAllEntries } = await loadModule()
      expect(getAllEntries()).toEqual([])
    })

    it('应返回按时间倒序排列的条目', async () => {
      const { createEntry, getAllEntries } = await loadModule()
      await createEntry('条目1', '1234', ['重要'])
      await new Promise(r => setTimeout(r, 10)) // 确保时间戳不同
      await createEntry('条目2', '5678', ['工作'])

      const entries = getAllEntries()
      expect(entries).toHaveLength(2)
      expect(entries[0].createdAt).toBeGreaterThanOrEqual(entries[1].createdAt)
    })
  })

  describe('getEntryById', () => {
    it('应返回指定 ID 的条目', async () => {
      const { createEntry, getEntryById } = await loadModule()
      const result = await createEntry('测试条目', '123456')
      const entry = getEntryById(result.doc!._id)
      expect(entry).not.toBeNull()
      expect(entry!.title).toBe('测试条目')
    })

    it('不存在的 ID 应返回 null', async () => {
      const { getEntryById } = await loadModule()
      expect(getEntryById('nonexistent_id')).toBeNull()
    })
  })

  describe('createEntry', () => {
    it('应创建新条目', async () => {
      const { createEntry, getAllEntries } = await loadModule()
      const result = await createEntry('银行卡号', '6222021234567890', ['财务', '银行'], '工商银行卡')

      expect(result.ok).toBe(true)
      expect(result.doc).toBeDefined()
      expect(result.doc!.title).toBe('银行卡号')
      expect(result.doc!.tags).toEqual(['财务', '银行'])
      expect(result.doc!.reviewCount).toBe(0)

      const entries = getAllEntries()
      expect(entries).toHaveLength(1)
    })

    it('标题和数字应去除首尾空格', async () => {
      const { createEntry } = await loadModule()
      const result = await createEntry('  身份证号  ', '  123456  ')
      expect(result.doc!.title).toBe('身份证号')
      expect(result.doc!.numbers).toBe('123456')
    })

    it('description 为 undefined 时应正常工作', async () => {
      const { createEntry } = await loadModule()
      const result = await createEntry('无描述', '123')
      expect(result.ok).toBe(true)
      expect(result.doc!.description).toBeUndefined()
    })
  })

  describe('updateEntry', () => {
    it('应更新条目', async () => {
      const { createEntry, updateEntry, getEntryById } = await loadModule()
      const { doc } = await createEntry('原标题', '123')

      const updated = { ...doc!, title: '新标题', numbers: '456' }
      const result = await updateEntry(updated)

      expect(result.ok).toBe(true)
      const entry = getEntryById(doc!._id)
      expect(entry!.title).toBe('新标题')
      expect(entry!.numbers).toBe('456')
    })
  })

  describe('deleteEntry', () => {
    it('应删除条目及其关联的笔记和提示词', async () => {
      const { createEntry, createNote, createPrompt, deleteEntry, getEntryById, getNotesByEntryId, getPromptsByEntryId } = await loadModule()
      const { doc } = await createEntry('待删除', '123')
      const entryId = doc!._id

      await createNote(entryId, '这是一条笔记')
      await createPrompt(entryId, '提示词', '记忆内容', 0)

      const result = await deleteEntry(entryId)
      expect(result.ok).toBe(true)
      expect(getEntryById(entryId)).toBeNull()
      expect(getNotesByEntryId(entryId)).toHaveLength(0)
      expect(getPromptsByEntryId(entryId)).toHaveLength(0)
    })
  })

  describe('getNotesByEntryId', () => {
    it('应返回指定条目的笔记', async () => {
      const { createEntry, createNote, getNotesByEntryId } = await loadModule()
      const { doc } = await createEntry('条目A', '123')
      await createNote(doc!._id, '第一条笔记')
      await createNote(doc!._id, '第二条笔记')

      const notes = getNotesByEntryId(doc!._id)
      expect(notes).toHaveLength(2)
      expect(notes[0].createdAt).toBeGreaterThanOrEqual(notes[1].createdAt)
    })

    it('无笔记时应返回空数组', async () => {
      const { getNotesByEntryId } = await loadModule()
      expect(getNotesByEntryId('fake_id')).toEqual([])
    })
  })

  describe('createNote', () => {
    it('应创建笔记', async () => {
      const { createNote } = await loadModule()
      const result = await createNote('entry_id_1', '  笔记内容  ')
      expect(result.ok).toBe(true)
      expect(result.doc!.content).toBe('笔记内容')
    })
  })

  describe('updateNote', () => {
    it('应更新笔记内容', async () => {
      const { createEntry, createNote, updateNote, getNotesByEntryId } = await loadModule()
      const { doc } = await createEntry('条目', '123')
      const { doc: note } = await createNote(doc!._id, '原内容')

      const updated = { ...note!, content: '新内容', updatedAt: Date.now() }
      const result = await updateNote(updated)

      expect(result.ok).toBe(true)
      const notes = getNotesByEntryId(doc!._id)
      expect(notes[0].content).toBe('新内容')
    })
  })

  describe('deleteNote', () => {
    it('应删除笔记', async () => {
      const { createEntry, createNote, deleteNote, getNotesByEntryId } = await loadModule()
      const { doc: entry } = await createEntry('条目', '123')
      const { doc: note } = await createNote(entry!._id, '待删除')

      await deleteNote(note!._id)
      expect(getNotesByEntryId(entry!._id)).toHaveLength(0)
    })

    it('删除不存在的笔记应返回成功', async () => {
      const { deleteNote } = await loadModule()
      const result = await deleteNote('nonexistent')
      expect(result.ok).toBe(true)
    })
  })

  describe('getPromptsByEntryId', () => {
    it('应返回按顺序排列的提示词', async () => {
      const { createEntry, createPrompt, getPromptsByEntryId } = await loadModule()
      const { doc } = await createEntry('条目', '123')
      await createPrompt(doc!._id, '第二', '内容2', 2)
      await createPrompt(doc!._id, '第一', '内容1', 1)

      const prompts = getPromptsByEntryId(doc!._id)
      expect(prompts).toHaveLength(2)
      expect(prompts[0].order).toBeLessThanOrEqual(prompts[1].order)
    })
  })

  describe('createPrompt', () => {
    it('应创建提示词', async () => {
      const { createPrompt } = await loadModule()
      const result = await createPrompt('entry_1', '记忆法', '联想记忆', 0)

      expect(result.ok).toBe(true)
      expect(result.doc!.title).toBe('记忆法')
      expect(result.doc!.enabled).toBe(true)
    })

    it('enabled 为 false 时应创建禁用的提示词', async () => {
      const { createPrompt } = await loadModule()
      const result = await createPrompt('entry_1', '禁用提示', '内容', 0, false)
      expect(result.doc!.enabled).toBe(false)
    })
  })

  describe('updatePrompt', () => {
    it('应更新提示词', async () => {
      const { createPrompt, updatePrompt, getPromptsByEntryId } = await loadModule()
      const { doc } = await createPrompt('entry_1', '原标题', '原内容', 0)
      const updated = { ...doc!, title: '新标题', content: '新内容' }

      const result = await updatePrompt(updated)
      expect(result.ok).toBe(true)
    })
  })

  describe('deletePrompt', () => {
    it('应删除提示词', async () => {
      const { createEntry, createPrompt, deletePrompt, getPromptsByEntryId } = await loadModule()
      const { doc: entry } = await createEntry('条目', '123')
      const { doc: prompt } = await createPrompt(entry!._id, '提示', '内容', 0)

      await deletePrompt(prompt!._id)
      expect(getPromptsByEntryId(entry!._id)).toHaveLength(0)
    })

    it('删除不存在的提示词应返回成功', async () => {
      const { deletePrompt } = await loadModule()
      const result = await deletePrompt('nonexistent')
      expect(result.ok).toBe(true)
    })
  })

  describe('reorderPrompts', () => {
    it('应重新排序提示词且顺序递增', async () => {
      const { createEntry, createPrompt, reorderPrompts, getPromptsByEntryId } = await loadModule()
      const { doc: entry } = await createEntry('条目', '123')
      const { doc: p1 } = await createPrompt(entry!._id, '一', 'A', 0)
      const { doc: p2 } = await createPrompt(entry!._id, '二', 'B', 1)
      const { doc: p3 } = await createPrompt(entry!._id, '三', 'C', 2)

      // 反向排序
      await reorderPrompts([p3!, p2!, p1!])

      const prompts = getPromptsByEntryId(entry!._id)
      // 排序后应按 order 升序
      for (let i = 0; i < prompts.length - 1; i++) {
        expect(prompts[i].order).toBeLessThanOrEqual(prompts[i + 1].order)
      }
    })

    it('保存失败时应返回 false', async () => {
      const { createEntry, createPrompt, reorderPrompts } = await loadModule()
      const { doc: entry } = await createEntry('条目', '123')
      const { doc: p1 } = await createPrompt(entry!._id, '一', 'A', 0)

      // Mock 保存失败
      ;(mockDb.promises.put as any).mockRejectedValueOnce(new Error('Save failed'))

      const result = await reorderPrompts([p1!])
      expect(result).toBe(false)
    })
  })
})
