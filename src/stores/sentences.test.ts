import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useSentencesStore } from './sentences'
import { setDbAdapter, resetDbAdapter } from '@/adapters/db'

describe('useSentencesStore', () => {
  let mockDb: any

  beforeEach(() => {
    setActivePinia(createPinia())

    mockDb = {
      promises: {
        get: vi.fn() as Mock,
        put: vi.fn() as Mock,
        remove: vi.fn() as Mock,
        allDocs: vi.fn() as Mock,
      }
    }
    // 默认：库里无文档；保存成功
    mockDb.promises.get.mockResolvedValue(null)
    mockDb.promises.put.mockResolvedValue({ ok: true })
    setDbAdapter(mockDb)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
    resetDbAdapter()
  })

  describe('初始状态', () => {
    it('应该有正确的初始值', () => {
      const store = useSentencesStore()
      expect(store.sentences).toEqual([])
      expect(store.loading).toBe(false)
      expect(store.loaded).toBe(false)
    })
  })

  describe('add', () => {
    it('应该成功添加中文句子并识别语言', async () => {
      const store = useSentencesStore()
      const res = await store.add('愿所有美好如期而至。')
      expect(res.success).toBe(true)
      expect(store.sentences).toHaveLength(1)
      expect(store.sentences[0].lang).toBe('zh')
      expect(store.sentences[0].favorite).toBe(false)
      expect(store.sentences[0].tags).toEqual([])
      expect(mockDb.promises.put).toHaveBeenCalled()
    })

    it('应该识别英文句子', async () => {
      const store = useSentencesStore()
      const res = await store.add('The best is yet to come.')
      expect(res.success).toBe(true)
      expect(store.sentences[0].lang).toBe('en')
    })

    it('应该拒绝空句子', async () => {
      const store = useSentencesStore()
      const res = await store.add('   ')
      expect(res.success).toBe(false)
      expect(store.sentences).toHaveLength(0)
    })

    it('相同文本应该去重', async () => {
      const store = useSentencesStore()
      await store.add('愿所有美好如期而至。')
      const res = await store.add('愿所有美好如期而至。')
      expect(res.success).toBe(false)
      expect(res.message).toBe('句子已存在')
      expect(store.sentences).toHaveLength(1)
    })

    it('应该规范化文本（折叠空白）', async () => {
      const store = useSentencesStore()
      await store.add('  hello   world.  ')
      expect(store.sentences[0].text).toBe('hello world.')
    })

    it('保存失败时应该回滚并返回失败', async () => {
      mockDb.promises.put.mockResolvedValue({ error: true, message: '写入失败' })
      const store = useSentencesStore()
      const res = await store.add('愿所有美好如期而至。')
      expect(res.success).toBe(false)
      expect(store.sentences).toHaveLength(0)
    })
  })

  describe('remove', () => {
    it('应该删除指定句子', async () => {
      const store = useSentencesStore()
      const { sentence } = await store.add('愿所有美好如期而至。')
      const res = await store.remove(sentence!.id)
      expect(res.success).toBe(true)
      expect(store.sentences).toHaveLength(0)
    })

    it('删除不存在的句子应该返回失败', async () => {
      const store = useSentencesStore()
      const res = await store.remove('sentence_not_exist')
      expect(res.success).toBe(false)
    })
  })

  describe('update', () => {
    it('应该更新标签/备注/收藏', async () => {
      const store = useSentencesStore()
      const { sentence } = await store.add('愿所有美好如期而至。')
      const res = await store.update(sentence!.id, { tags: ['唯美'], note: '很喜欢', favorite: true })
      expect(res.success).toBe(true)
      expect(store.sentences[0].tags).toEqual(['唯美'])
      expect(store.sentences[0].note).toBe('很喜欢')
      expect(store.sentences[0].favorite).toBe(true)
    })

    it('更新不存在的句子应该返回失败', async () => {
      const store = useSentencesStore()
      const res = await store.update('sentence_not_exist', { favorite: true })
      expect(res.success).toBe(false)
    })
  })

  describe('getters', () => {
    it('sortedSentences 应该收藏优先、其余按时间倒序', async () => {
      const store = useSentencesStore()
      await store.add('第一句，普通。')
      await store.add('第二句，收藏。')
      await store.update(store.sentences[0].id, { favorite: true })
      const sorted = store.sortedSentences
      expect(sorted[0].favorite).toBe(true)
      expect(sorted[0].text).toBe('第一句，普通。')
    })

    it('allTags 应该返回去重标签', async () => {
      const store = useSentencesStore()
      await store.add('第一句。', { tags: ['唯美', '励志'] })
      await store.add('第二句。', { tags: ['唯美'] })
      expect(store.allTags.sort()).toEqual(['励志', '唯美'])
    })

    it('search 应该匹配原句/译文/备注/来源', async () => {
      const store = useSentencesStore()
      await store.add('The best is yet to come.', { translation: '最好的尚未到来。', source: '网络' })
      await store.add('愿所有美好如期而至。', { note: '生日寄语' })
      expect(store.search('best')).toHaveLength(1)
      expect(store.search('尚未')).toHaveLength(1)
      expect(store.search('寄语')).toHaveLength(1)
      expect(store.search('网络')).toHaveLength(1)
      expect(store.search('')).toHaveLength(2)
    })
  })

  describe('load', () => {
    it('应该从 DB 加载已有句子', async () => {
      mockDb.promises.get.mockResolvedValue({
        _id: 'slowlyrecord-sentences-data',
        sentences: [{ id: 's1', text: '已有句子。', lang: 'zh', tags: [], favorite: false, createdAt: 1 }]
      })
      const store = useSentencesStore()
      await store.load()
      expect(store.sentences).toHaveLength(1)
      expect(store.loaded).toBe(true)
    })
  })
})
