// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import MyListItem from './MyListItem.vue'
import type { Word } from '@/types/words'

const mocks = vi.hoisted(() => ({ trackEvent: vi.fn() }))
vi.mock('@/utils/stats', () => ({ trackEvent: mocks.trackEvent }))

function makeWord(text: string): Word {
  return {
    _id: `word-${text}`,
    text,
    explains: '照顾',
    explainedHidden: false,
    pronunciation: '',
    isReview: true,
    ctime: new Date(),
    learnDate: new Date(),
    level: 1,
    image: '',
    phonetic: '',
    remember: false,
    itemType: text.includes(' ') ? 'phrase' : 'word',
  } as Word
}

describe('MyListItem', () => {
  it('词组显示时应保留中间空格', () => {
    const word = makeWord('take care')
    const wrapper = mount(MyListItem, {
      props: {
        word,
        modelValue: word,
      },
      global: {
        plugins: [createTestingPinia()],
        stubs: {
          'el-tooltip': { template: '<span><slot /></span>' },
        },
      },
    })

    const wordText = wrapper.find('.word-components').text()
    expect(wordText).toBe('take care')
    expect(wordText).not.toBe('takecare')
  })

  it('点击认识时记录一次复习作答', async () => {
    const word = makeWord('hello')
    mocks.trackEvent.mockClear()
    const wrapper = mount(MyListItem, {
      props: {
        word,
        modelValue: word,
      },
      global: {
        plugins: [createTestingPinia({
          initialState: {
            words: {words: [word], memoryFirmness: '正常'},
          },
        })],
        stubs: {
          'el-tooltip': { template: '<span><slot /></span>' },
        },
      },
    })

    await wrapper.find('.icon-check').trigger('click')

    expect(mocks.trackEvent).toHaveBeenCalledWith('review', 'answer', 'remember')
    wrapper.unmount()
  })
})
