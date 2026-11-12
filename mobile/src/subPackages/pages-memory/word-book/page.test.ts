// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import WordBookPage from './page.vue'

const api = vi.hoisted(() => ({ completePage: vi.fn() }))
const storage = vi.hoisted(() => ({} as Record<string, string>))
const page = vi.hoisted(() => ({
  _id: 'p1', type: 'wb_page', bookId: 'b1', chapterId: 'c1', name: '测试页', order: 1,
  key: { type: 'root', value: 'act' }, words: [
    { sourceId: 'w1', text: 'act', explains: '行动' },
    { sourceId: 'w2', text: 'actor', explains: '演员' },
  ],
  source: {}, level: 0, nextReviewAt: 0, ctime: 1, utime: 1,
}))

vi.mock('@dcloudio/uni-app', () => ({
  onLoad: (callback: (options: any) => void) => callback({ pageId: 'p1' }),
  onShow: (callback: () => void) => callback(),
}))
vi.mock('@/stores/useWordBook', () => ({
  useWordBook: () => ({
    getPage: () => page,
    chaptersOf: () => [],
    pages: [],
    load: vi.fn(),
    completePage: api.completePage,
  }),
}))

function mountPage() {
  return mount(WordBookPage, { global: { mixins: [{ computed: { themeClass: () => '' } }] } })
}

describe('移动端词集复习页', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.completePage.mockReturnValue({ ok: true })
    for (const key of Object.keys(storage)) delete storage[key]
    vi.stubGlobal('uni', {
      showToast: vi.fn(),
      navigateBack: vi.fn(),
      navigateTo: vi.fn(),
      getStorageSync: (key: string) => storage[key] || '',
      setStorageSync: (key: string, value: string) => { storage[key] = value },
      removeStorageSync: (key: string) => { delete storage[key] },
    })
  })

  function cardByText(wrapper: ReturnType<typeof mountPage>, text: string) {
    return wrapper.findAll('.node-card').find(card => card.find('.node-word').text() === text)!
  }

  it('揭示与判定分开，错词移到队尾，首轮错词改对后仍按错词结算', async () => {
    const wrapper = mountPage()
    await wrapper.find('switch').trigger('change', { detail: { value: true } })
    const actCard = cardByText(wrapper, 'act')
    await actCard.trigger('click')
    expect(actCard.text()).toContain('行动')
    expect(api.completePage).not.toHaveBeenCalled()

    await actCard.find('.action.no').trigger('click')
    expect(wrapper.findAll('.node-card').at(-1)!.text()).toContain('行动')
    await cardByText(wrapper, 'actor').find('.action.ok').trigger('click')
    expect(api.completePage).not.toHaveBeenCalled()

    await cardByText(wrapper, 'act').find('.action.ok').trigger('click')
    expect(api.completePage).toHaveBeenCalledWith('p1', 1)
    expect(wrapper.text()).toContain('本轮完成')
    expect(storage.sr_mobile_wordbook_round_p1).toBeUndefined()
  })

  it('已记住可再次点击撤销，不计入结算', async () => {
    const wrapper = mountPage()
    const ok = cardByText(wrapper, 'act').find('.action.ok')
    await ok.trigger('click')
    expect(cardByText(wrapper, 'act').classes()).toContain('marked')
    await ok.trigger('click')
    expect(cardByText(wrapper, 'act').classes()).not.toContain('marked')
    expect(api.completePage).not.toHaveBeenCalled()
  })

  it('保存失败时显示重试入口，重试成功后关闭本轮', async () => {
    api.completePage
      .mockReturnValueOnce({ ok: false, message: '存储已满' })
      .mockReturnValueOnce({ ok: true })
    const wrapper = mountPage()
    const cards = wrapper.findAll('.node-card')
    await cards[0].find('.action.ok').trigger('click')
    await cards[1].find('.action.ok').trigger('click')
    expect(wrapper.text()).not.toContain('本轮完成')
    expect(wrapper.text()).toContain('存储已满')

    await wrapper.find('.save-retry').trigger('click')
    expect(wrapper.text()).toContain('本轮完成')
    expect(api.completePage).toHaveBeenCalledTimes(2)
  })

  it('中途离开后恢复乱序、错词与揭示状态', async () => {
    const first = mountPage()
    const actCard = cardByText(first, 'act')
    await actCard.trigger('click')
    await actCard.find('.action.no').trigger('click')
    expect(storage.sr_mobile_wordbook_round_p1).toBeTruthy()
    first.unmount()

    const second = mountPage()
    const restoredAct = cardByText(second, 'act')
    expect(restoredAct.classes()).toContain('wrong')
    expect(second.findAll('.node-card').at(-1)!.text()).toContain('行动')
    await restoredAct.find('.action.ok').trigger('click')
    await cardByText(second, 'actor').find('.action.ok').trigger('click')
    expect(api.completePage).toHaveBeenCalledWith('p1', 1)
  })
})
