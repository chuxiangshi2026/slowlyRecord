// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PinyinLines from './PinyinLines.vue'

describe('PinyinLines', () => {
  it('both 模式同时渲染拼音和正文', () => {
    const wrapper = mount(PinyinLines, {
      props: { content: '床前明月光\n疑是地上霜', pinyin: 'chuáng qián míng yuè guāng\nyí shì dì shàng shuāng' },
    })
    expect(wrapper.findAll('.pinyin-line')).toHaveLength(2)
    expect(wrapper.findAll('.text-line')).toHaveLength(2)
    expect(wrapper.text()).toContain('床前明月光')
  })

  it('pinyin 模式只显示拼音，避免练习时露出原文', () => {
    const wrapper = mount(PinyinLines, {
      props: { content: '床前明月光', pinyin: 'chuáng qián míng yuè guāng', mode: 'pinyin' },
    })
    expect(wrapper.findAll('.pinyin-line')).toHaveLength(1)
    expect(wrapper.findAll('.text-line')).toHaveLength(0)
    expect(wrapper.text()).not.toContain('床前明月光')
  })
})
