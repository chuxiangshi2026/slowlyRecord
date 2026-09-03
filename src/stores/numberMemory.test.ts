import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useNumberMemoryStore } from './numberMemory'
import type { NumberImageAssociation, NumberMemoryEntry, NumberMemoryNote, NumberMemoryPrompt } from '@/types/number-memory'

vi.mock('@/stores/words', () => ({
  useWordsStore: vi.fn(() => ({ memoryFirmness: '正常' }))
}))

// Mock number-memory-db
vi.mock('@/utils/number-memory-db', () => ({
  getAllAssociations: vi.fn(() => []),
  getAssociationByNumber: vi.fn(() => null),
  saveAssociation: vi.fn(() => Promise.resolve({ ok: true, id: 'test-id' })),
  removeAssociation: vi.fn(() => Promise.resolve({ ok: true, id: 'test-id' })),
  saveTrainingResult: vi.fn(() => Promise.resolve({ ok: true, id: 'test-id' })),
  getAllTrainingResults: vi.fn(() => []),
}))

// Mock number-memory-preset
vi.mock('@/utils/number-memory-preset', () => ({
  getRecommendedImages: vi.fn((num: number) => {
    if (num < 0 || num > 99) return []
    return [{ name: 'test', url: 'emoji', description: 'test' }]
  }),
  getNumberKeyword: vi.fn((num: number) => {
    if (num < 0 || num > 99) return ''
    return 'test-keyword'
  }),
  getRandomNumbers: vi.fn((count: number) => {
    return Array.from({ length: Math.min(count, 100) }, (_, i) => i)
  }),
  shuffleArray: vi.fn(<T>(array: T[]): T[] => {
    // 返回原数组的浅拷贝，但稍微打乱顺序以便测试
    return [...array]
  }),
}))

// Mock number-memory-entries-db
vi.mock('@/utils/number-memory-entries-db', () => ({
  getAllEntries: vi.fn(() => []),
  createEntry: vi.fn((title: string, numbers: string, tags: string[] = [], description?: string, kind?: string, mnemonic?: string) => Promise.resolve({ ok: true, id: 'entry_new', doc: { _id: 'entry_new', type: 'number_memory_entry' as const, title, numbers, kind, tags, description, mnemonic, createdAt: 3000, updatedAt: 3000, reviewCount: 0, level: 1 } })),
  updateEntry: vi.fn(() => Promise.resolve({ ok: true, id: 'entry_1' })),
  deleteEntry: vi.fn(() => Promise.resolve({ ok: true, id: 'entry_1' })),
  getNotesByEntryId: vi.fn(() => []),
  createNote: vi.fn(() => Promise.resolve({ ok: true, id: 'note_new', doc: { _id: 'note_new', type: 'number_memory_note' as const, entryId: 'entry_1', content: '新笔记', createdAt: 3000 } })),
  updateNote: vi.fn(() => Promise.resolve({ ok: true, id: 'note_1' })),
  deleteNote: vi.fn(() => Promise.resolve({ ok: true, id: 'note_1' })),
  getPromptsByEntryId: vi.fn(() => []),
  createPrompt: vi.fn(() => Promise.resolve({ ok: true, id: 'prompt_new', doc: { _id: 'prompt_new', type: 'number_memory_prompt' as const, entryId: 'entry_1', title: '新提示', content: '新内容', order: 2, enabled: true, createdAt: 3000 } })),
  updatePrompt: vi.fn(() => Promise.resolve({ ok: true, id: 'prompt_1' })),
  deletePrompt: vi.fn(() => Promise.resolve({ ok: true, id: 'prompt_1' })),
  reorderPrompts: vi.fn(() => Promise.resolve(true)),
}))

// Mock logger
vi.mock('@/utils/logger', () => ({
  log: { i: vi.fn(), w: vi.fn(), e: vi.fn() }
}))

import { getAllAssociations, saveAssociation, removeAssociation, saveTrainingResult, getAllTrainingResults } from '@/utils/number-memory-db'
import { getRecommendedImages, getNumberKeyword, getRandomNumbers, shuffleArray } from '@/utils/number-memory-preset'
import {
  getAllEntries,
  createEntry,
  updateEntry,
  deleteEntry,
  getNotesByEntryId,
  createNote,
  updateNote,
  deleteNote,
  getPromptsByEntryId,
  createPrompt,
  updatePrompt,
  deletePrompt,
  reorderPrompts
} from '@/utils/number-memory-entries-db'

const mockAssociations: NumberImageAssociation[] = [
  { number: '0', imageUrl: 'img0', source: 'preset', description: '零' },
  { number: '1', imageUrl: 'img1', source: 'preset', description: '一' },
  { number: '2', imageUrl: 'img2', source: 'upload', description: '二' },
  { number: '3', imageUrl: 'img3', source: 'preset', description: '三' },
  { number: '4', imageUrl: 'img4', source: 'upload', description: '四' },
]

describe('useNumberMemoryStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.resetAllMocks()
    vi.mocked(getAllAssociations).mockReturnValue([])
  })

  describe('初始状态', () => {
    it('应该有空的关联列表', () => {
      const store = useNumberMemoryStore()
      expect(store.associations).toEqual([])
    })

    it('isLoading 应为 false', () => {
      const store = useNumberMemoryStore()
      // loadAssociations 执行后应回到 false
      expect(store.isLoading).toBe(false)
    })

    it('associationCount 应为 0', () => {
      const store = useNumberMemoryStore()
      expect(store.associationCount).toBe(0)
    })

    it('hasAssociations 应为 false', () => {
      const store = useNumberMemoryStore()
      expect(store.hasAssociations).toBe(false)
    })
  })

  describe('loadAssociations', () => {
    it('应该从数据库加载关联数据', () => {
      vi.mocked(getAllAssociations).mockReturnValue(mockAssociations)
      const store = useNumberMemoryStore()
      store.loadAssociations()
      expect(store.associations).toEqual(mockAssociations)
      expect(store.associationCount).toBe(5)
      expect(store.hasAssociations).toBe(true)
    })

    it('加载空数据时应保持空列表', () => {
      vi.mocked(getAllAssociations).mockReturnValue([])
      const store = useNumberMemoryStore()
      store.loadAssociations()
      expect(store.associations).toEqual([])
    })
  })

  describe('getters', () => {
    it('getAssociation 应返回匹配的关联', () => {
      vi.mocked(getAllAssociations).mockReturnValue(mockAssociations)
      const store = useNumberMemoryStore()
      store.loadAssociations()
      expect(store.getAssociation('0')).toEqual(mockAssociations[0])
    })

    it('getAssociation 不存在的数字应返回 undefined', () => {
      vi.mocked(getAllAssociations).mockReturnValue(mockAssociations)
      const store = useNumberMemoryStore()
      store.loadAssociations()
      expect(store.getAssociation('99')).toBeUndefined()
    })

    it('hasAssociation 应正确判断是否存在关联', () => {
      vi.mocked(getAllAssociations).mockReturnValue(mockAssociations)
      const store = useNumberMemoryStore()
      store.loadAssociations()
      expect(store.hasAssociation('0')).toBe(true)
      expect(store.hasAssociation('99')).toBe(false)
    })
  })

  describe('addAssociation', () => {
    it('应该调用 saveAssociation 并重新加载', async () => {
      const store = useNumberMemoryStore()
      const result = await store.addAssociation('5', 'img5', 'preset', '五')
      expect(saveAssociation).toHaveBeenCalled()
      expect(result.ok).toBe(true)
    })

    it('保存失败时不应重新加载', async () => {
      vi.mocked(saveAssociation).mockResolvedValueOnce({ ok: false } as any)
      const store = useNumberMemoryStore()
      const result = await store.addAssociation('5', 'img5', 'preset')
      expect(result.ok).toBe(false)
    })
  })

  describe('deleteAssociation', () => {
    it('应该调用 removeAssociation 并重新加载', async () => {
      const store = useNumberMemoryStore()
      const result = await store.deleteAssociation('0')
      expect(removeAssociation).toHaveBeenCalledWith('0')
      expect(result.ok).toBe(true)
    })

    it('删除失败时不应重新加载', async () => {
      vi.mocked(removeAssociation).mockResolvedValueOnce({ ok: false } as any)
      const store = useNumberMemoryStore()
      const result = await store.deleteAssociation('0')
      expect(result.ok).toBe(false)
    })
  })

  describe('getRecommendations', () => {
    it('应该调用 getRecommendedImages 并传递数字', () => {
      const store = useNumberMemoryStore()
      store.getRecommendations('5')
      expect(getRecommendedImages).toHaveBeenCalledWith(5)
    })

    it('非数字字符串应传递 NaN', () => {
      const store = useNumberMemoryStore()
      store.getRecommendations('abc')
      expect(getRecommendedImages).toHaveBeenCalledWith(NaN)
    })
  })

  describe('getKeyword', () => {
    it('应该调用 getNumberKeyword 并传递数字', () => {
      const store = useNumberMemoryStore()
      store.getKeyword('7')
      expect(getNumberKeyword).toHaveBeenCalledWith(7)
    })
  })

  describe('generateNumberToImageQuiz', () => {
    it('没有关联数据时应返回空数组', () => {
      vi.mocked(getAllAssociations).mockReturnValue([])
      const store = useNumberMemoryStore()
      expect(store.generateNumberToImageQuiz()).toEqual([])
    })

    it('应该生成正确数量的题目', () => {
      vi.mocked(getAllAssociations).mockReturnValue(mockAssociations)
      // shuffleArray mock 返回原顺序
      const store = useNumberMemoryStore()
      store.loadAssociations()
      const quiz = store.generateNumberToImageQuiz(3)
      expect(quiz).toHaveLength(3)
    })

    it('请求数量超过关联数时应返回全部关联数量的题目', () => {
      vi.mocked(getAllAssociations).mockReturnValue(mockAssociations)
      const store = useNumberMemoryStore()
      store.loadAssociations()
      const quiz = store.generateNumberToImageQuiz(10)
      expect(quiz).toHaveLength(5) // 只有 5 个关联
    })

    it('每道题应包含 4 个选项', () => {
      vi.mocked(getAllAssociations).mockReturnValue(mockAssociations)
      const store = useNumberMemoryStore()
      store.loadAssociations()
      const quiz = store.generateNumberToImageQuiz(3)
      quiz.forEach(question => {
        expect(question.options).toHaveLength(4)
      })
    })

    it('正确答案应在选项中', () => {
      vi.mocked(getAllAssociations).mockReturnValue(mockAssociations)
      const store = useNumberMemoryStore()
      store.loadAssociations()
      const quiz = store.generateNumberToImageQuiz(3)
      quiz.forEach(question => {
        expect(question.options).toContain(question.correctAnswer)
      })
    })

    it('题目应包含 question 和 correctAnswer 字段', () => {
      vi.mocked(getAllAssociations).mockReturnValue(mockAssociations)
      const store = useNumberMemoryStore()
      store.loadAssociations()
      const quiz = store.generateNumberToImageQuiz(1)
      expect(quiz[0].question).toBeDefined()
      expect(quiz[0].correctAnswer).toBeDefined()
    })
  })

  describe('generateImageToNumberQuiz', () => {
    it('没有关联数据时应返回空数组', () => {
      vi.mocked(getAllAssociations).mockReturnValue([])
      const store = useNumberMemoryStore()
      expect(store.generateImageToNumberQuiz()).toEqual([])
    })

    it('应该生成正确数量的题目', () => {
      vi.mocked(getAllAssociations).mockReturnValue(mockAssociations)
      const store = useNumberMemoryStore()
      store.loadAssociations()
      const quiz = store.generateImageToNumberQuiz(3)
      expect(quiz).toHaveLength(3)
    })

    it('每道题应包含 4 个选项', () => {
      vi.mocked(getAllAssociations).mockReturnValue(mockAssociations)
      const store = useNumberMemoryStore()
      store.loadAssociations()
      const quiz = store.generateImageToNumberQuiz(3)
      quiz.forEach(question => {
        expect(question.options).toHaveLength(4)
      })
    })

    it('正确答案应在选项中', () => {
      vi.mocked(getAllAssociations).mockReturnValue(mockAssociations)
      const store = useNumberMemoryStore()
      store.loadAssociations()
      const quiz = store.generateImageToNumberQuiz(3)
      quiz.forEach(question => {
        expect(question.options).toContain(question.correctAnswer)
      })
    })
  })

  describe('saveResult', () => {
    it('应该调用 saveTrainingResult', async () => {
      const store = useNumberMemoryStore()
      await store.saveResult('numberToImage', 10, 8, 120, [])
      expect(saveTrainingResult).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'number_memory_result',
          mode: 'numberToImage',
          totalQuestions: 10,
          correctAnswers: 8,
          duration: 120,
          details: []
        })
      )
    })
  })

  describe('getTrainingHistory', () => {
    it('应该调用 getAllTrainingResults', () => {
      const store = useNumberMemoryStore()
      store.getTrainingHistory()
      expect(getAllTrainingResults).toHaveBeenCalled()
    })
  })

  describe('getRandomPresetNumbers', () => {
    it('应该调用 getRandomNumbers', () => {
      const store = useNumberMemoryStore()
      store.getRandomPresetNumbers(5, 'single')
      expect(getRandomNumbers).toHaveBeenCalledWith(5, 'single')
    })

    it('默认 range 应为 all', () => {
      const store = useNumberMemoryStore()
      store.getRandomPresetNumbers(5)
      expect(getRandomNumbers).toHaveBeenCalledWith(5, 'all')
    })
  })

  // ========== 数字记忆条目相关测试 ==========
  describe('数字记忆条目', () => {
    const mockEntries: NumberMemoryEntry[] = [
      { _id: 'entry_1', type: 'number_memory_entry', title: '手机号1', numbers: '13800138000', tags: ['手机'], createdAt: 1000, updatedAt: 1000, reviewCount: 0 },
      { _id: 'entry_2', type: 'number_memory_entry', title: '身份证号', numbers: '110101199001011234', tags: ['证件'], createdAt: 2000, updatedAt: 2000, reviewCount: 2 },
      { _id: 'entry_3', type: 'number_memory_entry', title: '银行卡', numbers: '6222021234567890123', tags: ['银行', '金融'], createdAt: 1500, updatedAt: 1500, reviewCount: 1 },
    ]

    describe('loadEntries', () => {
      it('应该从数据库加载条目', () => {
        vi.mocked(getAllEntries).mockReturnValue(mockEntries)
        const store = useNumberMemoryStore()
        store.loadEntries()
        expect(store.entries).toEqual(mockEntries)
        expect(getAllEntries).toHaveBeenCalled()
      })
    })

    describe('sortedEntries', () => {
      it('应该按创建时间倒序排列', () => {
        vi.mocked(getAllEntries).mockReturnValue(mockEntries)
        const store = useNumberMemoryStore()
        store.loadEntries()
        const sorted = store.sortedEntries
        expect(sorted[0]._id).toBe('entry_2')
        expect(sorted[1]._id).toBe('entry_3')
        expect(sorted[2]._id).toBe('entry_1')
      })
    })

    describe('allTags', () => {
      it('应该返回所有唯一的标签', () => {
        vi.mocked(getAllEntries).mockReturnValue(mockEntries)
        const store = useNumberMemoryStore()
        store.loadEntries()
        expect(store.allTags).toContain('手机')
        expect(store.allTags).toContain('证件')
        expect(store.allTags).toContain('银行')
        expect(store.allTags).toContain('金融')
        expect(store.allTags).toHaveLength(4)
      })
    })

    describe('addEntry', () => {
      it('应该调用 createEntry 并添加到列表', async () => {
        const newEntry: NumberMemoryEntry = { _id: 'entry_new', type: 'number_memory_entry', title: '新条目', numbers: '123', tags: [], createdAt: 3000, updatedAt: 3000, reviewCount: 0 }
        vi.mocked(createEntry).mockResolvedValueOnce({ ok: true, id: 'entry_new', doc: newEntry })
        
        const store = useNumberMemoryStore()
        const result = await store.addEntry('新条目', '123', [], '描述')
        
        expect(createEntry).toHaveBeenCalledWith('新条目', '123', [], '描述', undefined, undefined)
        expect(result.ok).toBe(true)
        expect(store.entries).toContainEqual(newEntry)
      })

      it('创建失败时不应添加到列表', async () => {
        vi.mocked(createEntry).mockResolvedValueOnce({ ok: false, id: '', error: true })
        
        const store = useNumberMemoryStore()
        const result = await store.addEntry('新条目', '123')
        
        expect(result.ok).toBe(false)
        expect(store.entries).toHaveLength(0)
      })
    })

    describe('updateEntryItem', () => {
      it('应该更新列表中的条目', async () => {
        vi.mocked(getAllEntries).mockReturnValue(mockEntries)
        vi.mocked(updateEntry).mockResolvedValueOnce({ ok: true, id: 'entry_1' })
        
        const store = useNumberMemoryStore()
        store.loadEntries()
        
        const updatedEntry = { ...mockEntries[0], title: '已更新' }
        const result = await store.updateEntryItem(updatedEntry)
        
        expect(updateEntry).toHaveBeenCalledWith(updatedEntry)
        expect(result.ok).toBe(true)
        expect(store.entries[0].title).toBe('已更新')
      })
    })

    describe('deleteEntryItem', () => {
      it('应该从列表中删除条目', async () => {
        vi.mocked(getAllEntries).mockReturnValue(mockEntries)
        vi.mocked(deleteEntry).mockResolvedValueOnce({ ok: true, id: 'entry_1' })
        
        const store = useNumberMemoryStore()
        store.loadEntries()
        
        const result = await store.deleteEntryItem('entry_1')
        
        expect(deleteEntry).toHaveBeenCalledWith('entry_1')
        expect(result.ok).toBe(true)
        expect(store.entries.some(e => e._id === 'entry_1')).toBe(false)
      })

      it('删除当前条目时应清空 currentEntry', async () => {
        vi.mocked(getAllEntries).mockReturnValue(mockEntries)
        vi.mocked(deleteEntry).mockResolvedValueOnce({ ok: true, id: 'entry_1' })
        
        const store = useNumberMemoryStore()
        store.loadEntries()
        store.setCurrentEntry(mockEntries[0])
        
        await store.deleteEntryItem('entry_1')
        
        expect(store.currentEntry).toBeNull()
      })
    })

    describe('setCurrentEntry', () => {
      it('应该设置当前条目', () => {
        const store = useNumberMemoryStore()
        const entry = mockEntries[0]
        store.setCurrentEntry(entry)
        expect(store.currentEntry).toEqual(entry)
      })

      it('应该可以清空当前条目', () => {
        const store = useNumberMemoryStore()
        store.setCurrentEntry(mockEntries[0])
        store.setCurrentEntry(null)
        expect(store.currentEntry).toBeNull()
      })
    })

    describe('updateReviewCount', () => {
      it('应该增加复习次数', async () => {
        vi.mocked(getAllEntries).mockReturnValue([{ ...mockEntries[0] }])
        vi.mocked(updateEntry).mockResolvedValueOnce({ ok: true, id: 'entry_1' })
        
        const store = useNumberMemoryStore()
        store.loadEntries()
        
        const result = await store.updateReviewCount('entry_1')
        
        expect(result.ok).toBe(true)
        expect(store.entries[0].reviewCount).toBe(1)
      })

      it('条目不存在时应返回失败', async () => {
        const store = useNumberMemoryStore()
        const result = await store.updateReviewCount('nonexistent')
        expect(result.ok).toBe(false)
      })
    })

    describe('SRS 相关', () => {
      it('addEntry 应透传 kind 和 mnemonic', async () => {
        const store = useNumberMemoryStore()
        await store.addEntry('π', '3.14159', ['数学'], '', 'pi', '山巅一寺一壶酒')

        expect(createEntry).toHaveBeenCalledWith('π', '3.14159', ['数学'], '', 'pi', '山巅一寺一壶酒')
        expect(store.entries[0].kind).toBe('pi')
        expect(store.entries[0].mnemonic).toBe('山巅一寺一壶酒')
      })

      it('dueEntries 应返回到期条目', () => {
        const entries: NumberMemoryEntry[] = [
          { _id: 'due', type: 'number_memory_entry', title: '到期', numbers: '123', level: 1, tags: [], createdAt: 1, updatedAt: 1, reviewCount: 0 },
          { _id: 'not_due', type: 'number_memory_entry', title: '未到期', numbers: '123', level: 1, learnDate: Date.now(), tags: [], createdAt: 2, updatedAt: 2, reviewCount: 0 },
        ]
        vi.mocked(getAllEntries).mockReturnValue(entries)
        const store = useNumberMemoryStore()
        store.loadEntries()

        expect(store.dueEntries).toHaveLength(1)
        expect(store.dueEntries[0]._id).toBe('due')
      })

      it('rememberedCount 统计已记住条目', () => {
        const entries: NumberMemoryEntry[] = [
          { _id: 'm1', type: 'number_memory_entry', title: '已记住', numbers: '123', level: 12, tags: [], createdAt: 1, updatedAt: 1, reviewCount: 0 },
          { _id: 'm2', type: 'number_memory_entry', title: '未记住', numbers: '123', level: 1, tags: [], createdAt: 2, updatedAt: 2, reviewCount: 0 },
        ]
        vi.mocked(getAllEntries).mockReturnValue(entries)
        const store = useNumberMemoryStore()
        store.loadEntries()

        expect(store.rememberedCount).toBe(1)
      })

      it('markEntryCorrect 到期条目升级', async () => {
        const entry: NumberMemoryEntry = { _id: 'entry_1', type: 'number_memory_entry', title: 't', numbers: '123', level: 1, tags: [], createdAt: 1, updatedAt: 1, reviewCount: 0 }
        vi.mocked(getAllEntries).mockReturnValue([entry])
        vi.mocked(updateEntry).mockResolvedValueOnce({ ok: true, id: 'entry_1' })

        const store = useNumberMemoryStore()
        store.loadEntries()
        const result = await store.markEntryCorrect('entry_1')

        expect(result.ok).toBe(true)
        expect(store.entries[0].level).toBe(2)
        expect(store.entries[0].learnDate).toBeGreaterThan(0)
      })

      it('markEntryWrong 条目降级', async () => {
        const entry: NumberMemoryEntry = { _id: 'entry_1', type: 'number_memory_entry', title: 't', numbers: '123', level: 5, tags: [], createdAt: 1, updatedAt: 1, reviewCount: 0 }
        vi.mocked(getAllEntries).mockReturnValue([entry])
        vi.mocked(updateEntry).mockResolvedValueOnce({ ok: true, id: 'entry_1' })

        const store = useNumberMemoryStore()
        store.loadEntries()
        const result = await store.markEntryWrong('entry_1')

        expect(result.ok).toBe(true)
        expect(store.entries[0].level).toBe(4)
      })

      it('getEntryLevelById 返回条目等级', () => {
        const entry: NumberMemoryEntry = { _id: 'entry_1', type: 'number_memory_entry', title: 't', numbers: '123', level: 7, tags: [], createdAt: 1, updatedAt: 1, reviewCount: 0 }
        vi.mocked(getAllEntries).mockReturnValue([entry])
        const store = useNumberMemoryStore()
        store.loadEntries()

        expect(store.getEntryLevelById('entry_1')).toBe(7)
        expect(store.getEntryLevelById('none')).toBe(1)
      })
    })
  })

  // ========== 笔记相关测试 ==========
  describe('笔记功能', () => {
    const mockNotes: NumberMemoryNote[] = [
      { _id: 'note_1', type: 'number_memory_note', entryId: 'entry_1', content: '第一条笔记', createdAt: 1000 },
      { _id: 'note_2', type: 'number_memory_note', entryId: 'entry_1', content: '第二条笔记', createdAt: 2000 },
    ]

    describe('loadNotes', () => {
      it('应该加载条目的笔记', async () => {
        vi.mocked(getNotesByEntryId).mockReturnValue(mockNotes)
        
        const store = useNumberMemoryStore()
        await store.loadNotes('entry_1')
        
        expect(getNotesByEntryId).toHaveBeenCalledWith('entry_1')
        expect(store.currentNotes).toEqual(mockNotes)
      })
    })

    describe('addNote', () => {
      it('应该添加笔记到列表', async () => {
        const newNote = { _id: 'note_new', type: 'number_memory_note' as const, entryId: 'entry_1', content: '新笔记', createdAt: 3000 }
        vi.mocked(createNote).mockResolvedValueOnce({ ok: true, id: 'note_new', doc: newNote })
        
        const store = useNumberMemoryStore()
        const result = await store.addNote({ entryId: 'entry_1', content: '新笔记' })
        
        expect(createNote).toHaveBeenCalledWith('entry_1', '新笔记')
        expect(result.ok).toBe(true)
        expect(store.currentNotes).toContainEqual(newNote)
      })
    })

    describe('updateNoteItem', () => {
      it('应该更新笔记', async () => {
        vi.mocked(getNotesByEntryId).mockReturnValue([...mockNotes])
        vi.mocked(updateNote).mockResolvedValueOnce({ ok: true, id: 'note_1' })
        
        const store = useNumberMemoryStore()
        await store.loadNotes('entry_1')
        
        const updatedNote = { ...mockNotes[0], content: '已更新' }
        const result = await store.updateNoteItem(updatedNote)
        
        expect(updateNote).toHaveBeenCalledWith(updatedNote)
        expect(result.ok).toBe(true)
        expect(store.currentNotes[0].content).toBe('已更新')
      })
    })

    describe('deleteNoteItem', () => {
      it('应该删除笔记', async () => {
        vi.mocked(getNotesByEntryId).mockReturnValue([...mockNotes])
        vi.mocked(deleteNote).mockResolvedValueOnce({ ok: true, id: 'note_1' })
        
        const store = useNumberMemoryStore()
        await store.loadNotes('entry_1')
        
        const result = await store.deleteNoteItem('note_1')
        
        expect(deleteNote).toHaveBeenCalledWith('note_1')
        expect(result.ok).toBe(true)
        expect(store.currentNotes.some(n => n._id === 'note_1')).toBe(false)
      })
    })
  })

  // ========== 提示词相关测试 ==========
  describe('提示词功能', () => {
    const mockPrompts: NumberMemoryPrompt[] = [
      { _id: 'prompt_1', type: 'number_memory_prompt', entryId: 'entry_1', title: '提示1', content: '内容1', order: 0, enabled: true, createdAt: 1000 },
      { _id: 'prompt_2', type: 'number_memory_prompt', entryId: 'entry_1', title: '提示2', content: '内容2', order: 1, enabled: false, createdAt: 2000 },
    ]

    describe('loadPrompts', () => {
      it('应该加载条目的提示词', async () => {
        vi.mocked(getPromptsByEntryId).mockReturnValue(mockPrompts)
        
        const store = useNumberMemoryStore()
        await store.loadPrompts('entry_1')
        
        expect(getPromptsByEntryId).toHaveBeenCalledWith('entry_1')
        expect(store.currentPrompts).toEqual(mockPrompts)
      })
    })

    describe('addPrompt', () => {
      it('应该添加提示词到列表', async () => {
        const newPrompt = { _id: 'prompt_new', type: 'number_memory_prompt' as const, entryId: 'entry_1', title: '新提示', content: '新内容', order: 2, enabled: true, createdAt: 3000 }
        vi.mocked(createPrompt).mockResolvedValueOnce({ ok: true, id: 'prompt_new', doc: newPrompt })
        
        const store = useNumberMemoryStore()
        const result = await store.addPrompt({ entryId: 'entry_1', title: '新提示', content: '新内容', order: 2, enabled: true })
        
        expect(createPrompt).toHaveBeenCalledWith('entry_1', '新提示', '新内容', 2, true)
        expect(result.ok).toBe(true)
        expect(store.currentPrompts).toContainEqual(newPrompt)
      })
    })

    describe('updatePromptItem', () => {
      it('应该更新提示词', async () => {
        vi.mocked(getPromptsByEntryId).mockReturnValue([...mockPrompts])
        vi.mocked(updatePrompt).mockResolvedValueOnce({ ok: true, id: 'prompt_1' })
        
        const store = useNumberMemoryStore()
        await store.loadPrompts('entry_1')
        
        const updatedPrompt = { ...mockPrompts[0], title: '已更新' }
        const result = await store.updatePromptItem(updatedPrompt)
        
        expect(updatePrompt).toHaveBeenCalledWith(updatedPrompt)
        expect(result.ok).toBe(true)
        expect(store.currentPrompts[0].title).toBe('已更新')
      })
    })

    describe('deletePromptItem', () => {
      it('应该删除提示词', async () => {
        vi.mocked(getPromptsByEntryId).mockReturnValue([...mockPrompts])
        vi.mocked(deletePrompt).mockResolvedValueOnce({ ok: true, id: 'prompt_1' })
        
        const store = useNumberMemoryStore()
        await store.loadPrompts('entry_1')
        
        const result = await store.deletePromptItem('prompt_1')
        
        expect(deletePrompt).toHaveBeenCalledWith('prompt_1')
        expect(result.ok).toBe(true)
        expect(store.currentPrompts.some(p => p._id === 'prompt_1')).toBe(false)
      })
    })

    describe('reorderPromptsList', () => {
      it('应该重新排序提示词', async () => {
        vi.mocked(getPromptsByEntryId).mockReturnValue([...mockPrompts])
        vi.mocked(reorderPrompts).mockResolvedValueOnce(true)
        
        const store = useNumberMemoryStore()
        await store.loadPrompts('entry_1')
        
        const reordered = [mockPrompts[1], mockPrompts[0]]
        const result = await store.reorderPromptsList(reordered)
        
        expect(reorderPrompts).toHaveBeenCalledWith(reordered)
        expect(result).toBe(true)
        expect(store.currentPrompts[0]._id).toBe('prompt_2')
      })
    })
  })
})
