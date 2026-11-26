// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import WordsPage from './words.vue'
import { useMobileWords } from '@/stores/useMobileWords'

const storage = {} as Record<string, string>
let actionSheetSuccess: ((res: { tapIndex: number }) => void) | null = null
let modalSuccess: ((res: { confirm: boolean }) => void) | null = null
const showToast = vi.fn()

vi.stubGlobal('uni', {
  showToast,
  showActionSheet: vi.fn((opts: { success?: (res: { tapIndex: number }) => void }) => {
    actionSheetSuccess = opts.success || null
  }),
  showModal: vi.fn((opts: { success?: (res: { confirm: boolean }) => void }) => {
    modalSuccess = opts.success || null
  }),
  navigateTo: vi.fn(),
  switchTab: vi.fn(),
  getStorageSync: (key: string) => storage[key] ?? '',
  setStorageSync: (key: string, value: string) => { storage[key] = value },
  removeStorageSync: (key: string) => { delete storage[key] },
})

vi.mock('@dcloudio/uni-app', () => ({
  onReachBottom: vi.fn(),
  onHide: vi.fn(),
  onShow: vi.fn(),
}))

vi.mock('@/stores/useMobileWords', async () => {
  const { ref } = await import('vue')
  const state = {
    words: ref<any[]>([]),
    bankList: ref([
      { id: 'bank_default', name: '默认词库', language: 'en' },
      { id: 'bank_b', name: '词库B', language: 'en' },
    ]),
    currentBankId: ref('bank_default'),
    currentLanguage: ref('en'),
  }
  const store = {
    __state: state,
    get words() { return state.words.value },
    get bankList() { return state.bankList.value },
    get currentBankId() { return state.currentBankId.value },
    get currentLanguage() { return state.currentLanguage.value },
    getBankById: (id: string) => state.bankList.value.find(b => b.id === id),
    moveWordToBank: vi.fn(),
    deleteWord: vi.fn(),
    flushDirtyBanks: vi.fn(),
    setCustomReviewWords: vi.fn(),
  }
  return { useMobileWords: () => store }
})

vi.mock('@/stores/useWordBook', () => ({
  useWordBook: () => ({ setDraft: vi.fn() }),
}))

vi.mock('@/stores/usePhoneticMemory', () => ({
  usePhoneticMemory: () => ({ ensureLoaded: vi.fn() }),
}))

function wordItem(id: string, word: string, meaning: string) {
  return {
    id, word, meaning,
    level: 1, reviewCount: 0, addTime: 1,
    remembered: false, needsReview: true, bankId: 'bank_default',
  }
}

async function search(wrapper: ReturnType<typeof mountWords>, keyword: string) {
  await wrapper.find('.search-input').setValue(keyword)
  // 搜索防抖 300ms 后才写入 filterState.pattern
  await new Promise(r => setTimeout(r, 350))
  await nextTick()
}

function mountWords() {
  return mount(WordsPage, { global: { mixins: [{ computed: { themeClass: () => '' } }] } })
}

describe('移动端单词页搜索（D3：普通搜索匹配单词+释义，仅 * 走通配符正则）', () => {
  const store = useMobileWords() as any

  beforeEach(() => {
    vi.clearAllMocks()
    actionSheetSuccess = null
    modalSuccess = null
    // 筛选状态持久化在 storage，清掉避免上个用例的搜索词/模式污染下个挂载
    for (const key of Object.keys(storage)) delete storage[key]
    store.__state.words.value = [
      wordItem('w1', 'apple', '苹果'),
      wordItem('w2', 'banana', '香蕉'),
      wordItem('w3', 'apply', ''),
    ]
  })

  it('普通搜索按释义命中（中文关键词走 meaning.includes，不再被恒真正则分支吞掉）', async () => {
    const wrapper = mountWords()
    expect(wrapper.findAll('.word-item')).toHaveLength(3)

    await search(wrapper, '苹果')
    const texts = wrapper.findAll('.word-item .word-text').map(el => el.text())
    expect(texts).toEqual(['apple'])
  })

  it('普通搜索同时匹配单词本身，大小写不敏感', async () => {
    const wrapper = mountWords()

    await search(wrapper, 'BAN')
    expect(wrapper.findAll('.word-item .word-text').map(el => el.text())).toEqual(['banana'])
  })

  it('普通搜索遇缺释义词条不崩溃，空 meaning 仅按单词匹配', async () => {
    const wrapper = mountWords()

    // apply 的 meaning 为空串：搜释义关键词不应抛 TypeError，也不命中
    await search(wrapper, '苹果')
    expect(wrapper.findAll('.word-item .word-text').map(el => el.text())).toEqual(['apple'])

    await search(wrapper, 'app')
    expect(wrapper.findAll('.word-item .word-text').map(el => el.text())).toEqual(['apple', 'apply'])
  })

  it('含 * 的输入走通配符正则：仅按单词全文匹配，不匹配释义', async () => {
    const wrapper = mountWords()

    await search(wrapper, 'appl*')
    expect(wrapper.findAll('.word-item .word-text').map(el => el.text())).toEqual(['apple', 'apply'])

    // 通配符只匹配单词：释义里的「苹」不命中任何词
    await search(wrapper, '苹*')
    expect(wrapper.findAll('.word-item')).toHaveLength(0)
  })
})

describe('移动端单词页批量操作（D32：中途失败有可见反馈，不静默中断）', () => {
  const store = useMobileWords() as any

  beforeEach(() => {
    vi.clearAllMocks()
    actionSheetSuccess = null
    modalSuccess = null
    // 筛选状态持久化在 storage，清掉避免上个用例的搜索词/模式污染下个挂载
    for (const key of Object.keys(storage)) delete storage[key]
    store.__state.words.value = [
      wordItem('w1', 'apple', '苹果'),
      wordItem('w2', 'banana', '香蕉'),
    ]
  })

  async function enterBatchAndSelectAll(wrapper: ReturnType<typeof mountWords>) {
    await wrapper.findAll('.filter-toggle')[1].trigger('click')
    for (const item of wrapper.findAll('.word-item')) {
      await item.trigger('click')
    }
  }

  it('批量移动成功时提示实际数量并清空选择', async () => {
    store.moveWordToBank.mockResolvedValue(undefined)
    const wrapper = mountWords()
    await enterBatchAndSelectAll(wrapper)

    const moveBtn = wrapper.findAll('.batch-action').find(el => el.text() === '移动')!
    await moveBtn.trigger('click')
    await actionSheetSuccess!({ tapIndex: 0 })
    await nextTick()

    expect(store.moveWordToBank).toHaveBeenCalledTimes(2)
    expect(showToast).toHaveBeenCalledWith({ title: '已移动 2 个单词', icon: 'none' })
    expect(wrapper.find('.batch-bar').exists()).toBe(false)
  })

  it('批量移动中途失败时提示已移动数量，不出现“成功”toast', async () => {
    store.moveWordToBank
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('写入失败'))
    const wrapper = mountWords()
    await enterBatchAndSelectAll(wrapper)

    const moveBtn = wrapper.findAll('.batch-action').find(el => el.text() === '移动')!
    await moveBtn.trigger('click')
    await actionSheetSuccess!({ tapIndex: 0 })
    await nextTick()

    expect(showToast).toHaveBeenCalledWith({ title: '移动中断：已移动 1 个，请重试剩余单词', icon: 'none' })
    expect(showToast).not.toHaveBeenCalledWith({ title: '已移动 2 个单词', icon: 'none' })
  })

  it('批量删除中途失败时提示已删除数量', async () => {
    store.deleteWord
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('写入失败'))
    const wrapper = mountWords()
    await enterBatchAndSelectAll(wrapper)

    const deleteBtn = wrapper.findAll('.batch-action').find(el => el.text() === '删除')!
    await deleteBtn.trigger('click')
    await modalSuccess!({ confirm: true })
    await nextTick()

    expect(showToast).toHaveBeenCalledWith({ title: '删除中断：已删除 1 个，请重试剩余单词', icon: 'none' })
    expect(showToast).not.toHaveBeenCalledWith({ title: '已删除 2 个单词', icon: 'none' })
  })
})
