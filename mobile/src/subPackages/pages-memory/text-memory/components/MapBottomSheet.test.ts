/**
 * @vitest-environment jsdom
 *
 * 地图底部 sheet 回归：地点有诗词时，标题计数与列表项必须同时渲染，
 * 防止「显示 63 首但下方没有内容」这类数据/布局脱节问题。
 */
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MapBottomSheet from './MapBottomSheet.vue'

const payload = {
  locationName: '长安',
  poems: [
    { id: 'p1', title: '静夜思', dynasty: '唐', author: '李白', content: '床前明月光，疑是地上霜。' },
    { id: 'p2', title: '春晓', dynasty: '唐', author: '孟浩然', content: '春眠不觉晓，处处闻啼鸟。' },
  ],
  idioms: [],
} as any

describe('MapBottomSheet', () => {
  it('地点有诗词时同时显示计数与完整列表，并隐藏滚动条', () => {
    const wrapper = mount(MapBottomSheet, {
      props: {
        visible: true,
        payload,
        selectedPoetryIds: new Set<string>(),
        selectedIdiomIds: new Set<string>(),
      },
    })

    expect(wrapper.find('.location-name').text()).toContain('长安')
    expect(wrapper.find('.count-badge').text()).toContain('2 首')
    expect(wrapper.findAll('.sheet-item')).toHaveLength(2)
    expect(wrapper.text()).toContain('静夜思')
    expect(wrapper.text()).toContain('李白')
    expect(wrapper.text()).toContain('春晓')
    expect(wrapper.find('.sheet-list').attributes('show-scrollbar')).toBe('false')
  })
})
