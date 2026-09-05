// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import NumberMemoryEntries from './NumberMemoryEntries.vue'
import type { NumberMemoryEntry } from '@/types/number-memory'
import { getAllEntries } from '@/utils/number-memory-entries-db'

// vue-router mock（useRoute.query 可按用例改写）
const mocks = vi.hoisted(() => ({
  route: { query: {} as Record<string, string> },
  push: vi.fn(),
}))
vi.mock('vue-router', () => ({
  useRouter: vi.fn(() => ({ push: mocks.push })),
  useRoute: vi.fn(() => mocks.route),
}))

// Mock element-plus 消息相关
vi.mock('element-plus', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...(actual as object),
    ElMessageBox: {
      confirm: vi.fn(() => Promise.resolve()),
    },
    ElMessage: {
      success: vi.fn(),
      error: vi.fn(),
      warning: vi.fn(),
      info: vi.fn(),
    },
  }
})

// Mock logger
vi.mock('@/utils/logger', () => ({
  log: { i: vi.fn(), e: vi.fn(), w: vi.fn(), d: vi.fn() },
}))

// Mock number-memory-db（store 初始化会读关联数据）
vi.mock('@/utils/number-memory-db', () => ({
  getAllAssociations: vi.fn(() => []),
  getAssociationByNumber: vi.fn(() => null),
  saveAssociation: vi.fn(() => Promise.resolve({ ok: true, id: 'test-id' })),
  removeAssociation: vi.fn(() => Promise.resolve({ ok: true, id: 'test-id' })),
  saveTrainingResult: vi.fn(() => Promise.resolve({ ok: true, id: 'test-id' })),
  getAllTrainingResults: vi.fn(() => []),
  getTrainingProgress: vi.fn(() => null),
  clearTrainingProgress: vi.fn(),
  clearAllTrainingResults: vi.fn(),
}))

// Mock number-memory-preset
vi.mock('@/utils/number-memory-preset', () => ({
  getRecommendedImages: vi.fn(() => []),
  getNumberKeyword: vi.fn(() => ''),
  getRandomNumbers: vi.fn(() => []),
  shuffleArray: vi.fn(<T>(arr: T[]) => [...arr]),
}))

// Mock number-memory-entries-db
vi.mock('@/utils/number-memory-entries-db', () => ({
  getAllEntries: vi.fn(() => []),
  createEntry: vi.fn(() => Promise.resolve({ ok: true })),
  updateEntry: vi.fn(() => Promise.resolve({ ok: true })),
  deleteEntry: vi.fn(() => Promise.resolve({ ok: true })),
  getNotesByEntryId: vi.fn(() => []),
  createNote: vi.fn(() => Promise.resolve({ ok: true })),
  updateNote: vi.fn(() => Promise.resolve({ ok: true })),
  deleteNote: vi.fn(() => Promise.resolve({ ok: true })),
  getPromptsByEntryId: vi.fn(() => []),
  createPrompt: vi.fn(() => Promise.resolve({ ok: true })),
  updatePrompt: vi.fn(() => Promise.resolve({ ok: true })),
  deletePrompt: vi.fn(() => Promise.resolve({ ok: true })),
  reorderPrompts: vi.fn(() => Promise.resolve(true)),
}))

// 到期/未到期夹具：逾期（level 1 超过 5 分钟间隔）、从未学习、刚复习、已记住但未到期
const now = Date.now()
const entries: NumberMemoryEntry[] = [
  { _id: 'due_overdue', type: 'number_memory_entry', title: '逾期手机号', numbers: '138', level: 1, learnDate: now - 10 * 60 * 1000, tags: [], createdAt: 1, updatedAt: 1, reviewCount: 0 },
  { _id: 'due_fresh', type: 'number_memory_entry', title: '从未学习', numbers: '456', level: 1, tags: [], createdAt: 2, updatedAt: 2, reviewCount: 0 },
  { _id: 'notdue_recent', type: 'number_memory_entry', title: '刚复习过', numbers: '789', level: 1, learnDate: now, tags: [], createdAt: 3, updatedAt: 3, reviewCount: 1 },
  { _id: 'notdue_mastered', type: 'number_memory_entry', title: '已记住条目', numbers: '021', level: 12, learnDate: now - 10 * 60 * 1000, tags: [], createdAt: 4, updatedAt: 4, reviewCount: 9 },
]

describe('NumberMemoryEntries 仅看到期过滤', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mocks.route.query = {}
  })

  async function mountPage() {
    const wrapper = mount(NumberMemoryEntries, {
      global: {
        directives: { loading: { mounted() {}, updated() {} } },
      },
    })
    await flushPromises()
    return wrapper
  }

  it('默认展示全部条目，点击「仅看到期」后只显示到期条目', async () => {
    vi.mocked(getAllEntries).mockReturnValue(entries)
    const wrapper = await mountPage()

    expect(wrapper.findAll('.number-entry-item')).toHaveLength(4)

    const dueChip = wrapper.findAll('span.ftag').filter(w => w.text() === '仅看到期')[0]
    expect(dueChip).toBeDefined()
    await dueChip.trigger('click')
    await flushPromises()

    expect(wrapper.findAll('.number-entry-item')).toHaveLength(2)
    const text = wrapper.find('.entries-list-wrapper').text()
    expect(text).toContain('逾期手机号')
    expect(text).toContain('从未学习')
    expect(text).not.toContain('刚复习过')
    expect(text).not.toContain('已记住条目')
  })

  it('路由带 due=1 时自动开启「仅看到期」（首页角标跳转入口）', async () => {
    vi.mocked(getAllEntries).mockReturnValue(entries)
    mocks.route.query = { due: '1' }

    const wrapper = await mountPage()

    expect(wrapper.findAll('.number-entry-item')).toHaveLength(2)
    const text = wrapper.find('.entries-list-wrapper').text()
    expect(text).toContain('逾期手机号')
    expect(text).not.toContain('刚复习过')
  })
})
