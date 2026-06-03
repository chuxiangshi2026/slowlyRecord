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
  DB_KEY_SHORTCUT_MEMORY: 'shortcut_memory_',
}))

async function loadModule() {
  return await import('./shortcut-memory-db')
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

describe('shortcut-memory-db', () => {
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

  describe('getAllTrainingRecords', () => {
    it('无记录时应返回空数组', async () => {
      const { getAllTrainingRecords } = await loadModule()
      expect(getAllTrainingRecords()).toEqual([])
    })

    it('应返回按时间倒序的训练记录', async () => {
      const { saveTrainingRecord, getAllTrainingRecords } = await loadModule()
      await saveTrainingRecord({
        type: 'shortcut_training_record',
        category: 'VS Code',
        mode: 'keyPress',
        totalQuestions: 10,
        correctAnswers: 8,
        duration: 120,
        details: [{ itemId: '1', correct: true, responseTime: 1000 }],
        createdAt: 1000,
      })
      await saveTrainingRecord({
        type: 'shortcut_training_record',
        category: 'Chrome',
        mode: 'functionSelect',
        totalQuestions: 5,
        correctAnswers: 3,
        duration: 60,
        details: [{ itemId: '2', correct: false, responseTime: 2000 }],
        createdAt: 2000,
      })

      const records = getAllTrainingRecords()
      expect(records).toHaveLength(2)
      expect(records[0].createdAt).toBeGreaterThan(records[1].createdAt!)
    })

    it('应只返回 shortcut_training_record 类型的文档', async () => {
      const { saveTrainingRecord, getAllTrainingRecords } = await loadModule()
      // 插入非记录类型的文档
      mockDb.put({ _id: 'shortcut_memory_record_other', type: 'other_type', createdAt: 100 })
      await saveTrainingRecord({
        type: 'shortcut_training_record',
        category: 'VS Code',
        mode: 'keyPress',
        totalQuestions: 10,
        correctAnswers: 8,
        duration: 120,
        details: [],
        createdAt: 200,
      })

      const records = getAllTrainingRecords()
      expect(records).toHaveLength(1)
    })
  })

  describe('saveTrainingRecord', () => {
    it('应成功保存训练记录', async () => {
      const { saveTrainingRecord, getAllTrainingRecords } = await loadModule()
      const result = await saveTrainingRecord({
        type: 'shortcut_training_record',
        category: 'VS Code',
        mode: 'keyPress',
        totalQuestions: 20,
        correctAnswers: 15,
        duration: 180,
        details: [],
        createdAt: Date.now(),
      })

      expect(result.ok).toBe(true)
      expect(getAllTrainingRecords()).toHaveLength(1)
    })
  })

  describe('getLearningProgress', () => {
    it('无进度时应返回 null', async () => {
      const { getLearningProgress } = await loadModule()
      expect(getLearningProgress('VS Code')).toBeNull()
    })

    it('应返回指定分类的学习进度', async () => {
      const { saveLearningProgress, getLearningProgress } = await loadModule()
      await saveLearningProgress('VS Code', ['id1', 'id2'])

      const progress = getLearningProgress('VS Code')
      expect(progress).not.toBeNull()
      expect(progress!.category).toBe('VS Code')
      expect(progress!.masteredItemIds).toContain('id1')
      expect(progress!.masteredItemIds).toContain('id2')
    })
  })

  describe('saveLearningProgress', () => {
    it('应创建新的学习进度', async () => {
      const { saveLearningProgress, getLearningProgress } = await loadModule()
      const result = await saveLearningProgress('Chrome', ['ctrl+t', 'ctrl+w'])

      expect(result.ok).toBe(true)
      const progress = getLearningProgress('Chrome')
      expect(progress!.masteredItemIds).toHaveLength(2)
    })

    it('应合并已有进度', async () => {
      const { saveLearningProgress, getLearningProgress } = await loadModule()
      await saveLearningProgress('Chrome', ['ctrl+t'])
      await saveLearningProgress('Chrome', ['ctrl+w', 'ctrl+shift+t'])

      const progress = getLearningProgress('Chrome')
      // 去重后应有 3 个
      expect(progress!.masteredItemIds).toHaveLength(3)
    })
  })

  describe('clearLearningProgress', () => {
    it('应清除指定分类的进度', async () => {
      const { saveLearningProgress, clearLearningProgress, getLearningProgress } = await loadModule()
      await saveLearningProgress('VS Code', ['id1'])

      const result = await clearLearningProgress('VS Code')
      expect(result.ok).toBe(true)
      expect(getLearningProgress('VS Code')).toBeNull()
    })

    it('清除不存在的分类应返回成功', async () => {
      const { clearLearningProgress } = await loadModule()
      const result = await clearLearningProgress('nonexistent')
      expect(result.ok).toBe(true)
    })
  })

  describe('getAllCustomShortcuts', () => {
    it('无自定义快捷键时应返回空数组', async () => {
      const { getAllCustomShortcuts } = await loadModule()
      expect(getAllCustomShortcuts()).toEqual([])
    })

    it('应返回所有自定义快捷键', async () => {
      const { saveCustomShortcut, getAllCustomShortcuts } = await loadModule()
      await saveCustomShortcut({
        id: 'custom_1',
        category: '自定义',
        functionName: '截图',
        description: '区域截图',
        keys: ['Ctrl', 'Shift', 'S'],
        platform: 'common',
      })

      const shortcuts = getAllCustomShortcuts()
      expect(shortcuts).toHaveLength(1)
      expect(shortcuts[0].functionName).toBe('截图')
    })
  })

  describe('saveCustomShortcut', () => {
    it('应成功保存自定义快捷键', async () => {
      const { saveCustomShortcut } = await loadModule()
      const result = await saveCustomShortcut({
        id: 'my_shortcut',
        category: '自定义',
        functionName: '调试',
        description: '打开调试',
        keys: ['F12'],
        platform: 'win',
      })

      expect(result.ok).toBe(true)
    })
  })

  describe('removeCustomShortcut', () => {
    it('应删除自定义快捷键', async () => {
      const { saveCustomShortcut, removeCustomShortcut, getAllCustomShortcuts } = await loadModule()
      await saveCustomShortcut({
        id: 'to_delete',
        category: '临时',
        functionName: '测试',
        description: '',
        keys: ['F1'],
        platform: 'common',
      })

      const result = removeCustomShortcut('to_delete')
      expect(result.ok).toBe(true)
      expect(getAllCustomShortcuts()).toHaveLength(0)
    })
  })

  describe('getAllCustomCategories', () => {
    it('无分类时应返回空数组', async () => {
      const { getAllCustomCategories } = await loadModule()
      expect(getAllCustomCategories()).toEqual([])
    })

    it('应返回所有自定义分类', async () => {
      const { saveCustomCategory, getAllCustomCategories } = await loadModule()
      await saveCustomCategory({
        name: '设计工具',
        description: '设计软件快捷键',
        icon: '🎨',
      })

      const categories = getAllCustomCategories()
      expect(categories).toHaveLength(1)
      expect(categories[0].name).toBe('设计工具')
    })
  })

  describe('saveCustomCategory', () => {
    it('名称为空应返回错误', async () => {
      const { saveCustomCategory } = await loadModule()
      const result = await saveCustomCategory({
        name: '',
        description: '',
        icon: '',
      })
      expect(result.ok).toBe(false)
      expect(result.message).toContain('不能为空')
    })

    it('名称只有空格应返回错误', async () => {
      const { saveCustomCategory } = await loadModule()
      const result = await saveCustomCategory({
        name: '   ',
        description: '',
        icon: '',
      })
      expect(result.ok).toBe(false)
    })

    it('名称超过 50 字符应返回错误', async () => {
      const { saveCustomCategory } = await loadModule()
      const result = await saveCustomCategory({
        name: 'a'.repeat(51),
        description: '',
        icon: '',
      })
      expect(result.ok).toBe(false)
      expect(result.message).toContain('50')
    })

    it('应成功保存符合要求的分类', async () => {
      const { saveCustomCategory } = await loadModule()
      const result = await saveCustomCategory({
        name: '开发工具',
        description: 'IDE快捷键',
        icon: '💻',
      })
      expect(result.ok).toBe(true)
    })
  })

  describe('removeCustomCategory', () => {
    it('应删除分类及其快捷键', async () => {
      const { saveCustomCategory, removeCustomCategory, getAllCustomCategories, getAllCustomShortcuts } = await loadModule()
      await saveCustomCategory({
        name: '临时分类',
        description: '',
        icon: '',
      })

      const result = removeCustomCategory('临时分类')
      expect(result.ok).toBe(true)
      expect(getAllCustomCategories()).toHaveLength(0)
    })

    it('删除不存在的分类应返回成功', async () => {
      const { removeCustomCategory } = await loadModule()
      const result = removeCustomCategory('不存在的分类')
      expect(result.ok).toBe(true)
    })
  })

  describe('updateCustomShortcut', () => {
    it('应更新快捷键', async () => {
      const { saveCustomShortcut, updateCustomShortcut, getAllCustomShortcuts } = await loadModule()
      await saveCustomShortcut({
        id: 'to_update',
        category: '测试',
        functionName: '旧名称',
        description: '',
        keys: ['F1'],
        platform: 'common',
      })

      await updateCustomShortcut({
        id: 'to_update',
        category: '测试',
        functionName: '新名称',
        description: '更新后的描述',
        keys: ['F1', 'Ctrl'],
        platform: 'common',
      })

      const shortcuts = getAllCustomShortcuts()
      expect(shortcuts[0].functionName).toBe('新名称')
    })
  })

  describe('clearAllShortcutMemoryData', () => {
    it('应清空所有数据', async () => {
      const { saveTrainingRecord, saveCustomCategory, clearAllShortcutMemoryData, getAllTrainingRecords, getAllCustomCategories } = await loadModule()
      await saveTrainingRecord({
        type: 'shortcut_training_record',
        category: 'VS Code',
        mode: 'keyPress',
        totalQuestions: 10,
        correctAnswers: 8,
        duration: 60,
        details: [],
        createdAt: Date.now(),
      })
      await saveCustomCategory({ name: '分类', description: '', icon: '' })

      clearAllShortcutMemoryData()
      expect(getAllTrainingRecords()).toHaveLength(0)
      expect(getAllCustomCategories()).toHaveLength(0)
    })
  })

  describe('getHiddenCategories / hideCategory / unhideCategory', () => {
    it('初始应无隐藏分类', async () => {
      const { getHiddenCategories } = await loadModule()
      expect(getHiddenCategories()).toEqual([])
    })

    it('应能隐藏并恢复分类', async () => {
      const { hideCategory, unhideCategory, getHiddenCategories } = await loadModule()

      hideCategory('VS Code')
      expect(getHiddenCategories()).toContain('VS Code')

      unhideCategory('VS Code')
      expect(getHiddenCategories()).not.toContain('VS Code')
    })

    it('重复隐藏同一分类不应重复添加', async () => {
      const { hideCategory, getHiddenCategories } = await loadModule()
      hideCategory('Chrome')
      hideCategory('Chrome')
      // 不应重复
      expect(getHiddenCategories().filter(c => c === 'Chrome')).toHaveLength(1)
    })
  })
})
