// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import WordBookList from './list.vue'

const api = vi.hoisted(() => ({
  seed: vi.fn(),
  addSample: vi.fn(),
  createBook: vi.fn(),
}))

const data = vi.hoisted(() => ({
  books: [] as any[],
  samples: [{ name: '词根册' }, { name: '固定句式' }],
}))

vi.mock('@dcloudio/uni-app', () => ({
  onShow: (callback: () => void) => callback(),
}))
vi.mock('@/stores/useWordBook', () => ({
  useWordBook: () => ({
    books: data.books,
    chapters: [],
    pages: [],
    loaded: true,
    dueCount: 0,
    duePages: [],
    sortedBooks: data.books,
    load: vi.fn(),
    chaptersOf: () => [],
    createBook: api.createBook,
  }),
}))
vi.mock('@/utils/wordbook-seed', () => ({
  seedWordBookSamples: api.seed,
  addWordBookSample: api.addSample,
}))
vi.mock('@/utils/wordbook-samples', () => ({
  WORDBOOK_SAMPLES: data.samples,
}))

function stubUni() {
  const uni = {
    showToast: vi.fn(),
    navigateTo: vi.fn(),
    showModal: vi.fn((options: any) => options.success({ confirm: true, content: '新词集' })),
    showActionSheet: vi.fn((options: any) => options.success({ tapIndex: 0 })),
  }
  vi.stubGlobal('uni', uni)
  return uni
}

function mountPage() {
  return mount(WordBookList, {
    global: { mixins: [{ computed: { themeClass: () => '' } }] },
  })
}

describe('移动端词集列表', () => {
  let uni: ReturnType<typeof stubUni>

  beforeEach(() => {
    vi.clearAllMocks()
    data.books = [{ _id: 'sample_roots', name: '词根册', isSample: true, order: 0, ctime: 1, utime: 1 }]
    api.addSample.mockImplementation((sample: any) => ({ _id: 'book_new', name: sample.name }))
    uni = stubUni()
  })

  it('默认展示已播种示例，并只列出尚未导入的示例供选择', async () => {
    const wrapper = mountPage()
    expect(wrapper.text()).toContain('词集')
    expect(api.seed).toHaveBeenCalledTimes(1)

    await wrapper.find('.header-link').trigger('click')
    await nextTick()
    expect(uni.showActionSheet).toHaveBeenCalledWith(expect.objectContaining({ itemList: ['固定句式'] }))
    expect(api.addSample).toHaveBeenCalledWith(expect.objectContaining({ name: '固定句式' }))
    expect(uni.navigateTo).toHaveBeenCalledWith({
      url: '/subPackages/pages-memory/word-book/chapter?bookId=book_new',
    })
  })

  it('创建词集失败时提示错误且不跳转', async () => {
    api.createBook.mockReturnValue(null)
    const wrapper = mountPage()
    const createButton = wrapper.findAll('button').find(button => button.text() === '新建词集')!
    await createButton.trigger('click')
    await nextTick()

    expect(uni.showToast).toHaveBeenCalledWith({ title: '创建词集失败', icon: 'none' })
    expect(uni.navigateTo).not.toHaveBeenCalled()
  })
})
