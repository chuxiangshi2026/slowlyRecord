// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { waitFor } from '@testing-library/vue'
import PoetryMapTab from './PoetryMapTab.vue'
import MapBottomSheet from './MapBottomSheet.vue'

const data = vi.hoisted(() => ({
  poems: [
    {
      id: 'p1', title: '静夜思', author: '李白', dynasty: '唐', dynastyCode: 'tang',
      content: '床前明月光', contentType: '诗', tags: [], location: '长安',
    },
    {
      id: 'p2', title: '登鹳雀楼', author: '王之涣', dynasty: '唐', dynastyCode: 'tang',
      content: '白日依山尽', contentType: '诗', tags: [], location: '长安',
    },
  ],
}))
const defaultPoems = data.poems

vi.mock('../library', () => ({
  DYNASTIES: [{ code: 'tang', name: '唐' }, { code: 'song', name: '宋' }],
  loadAllPoetry: vi.fn(async () => data.poems),
  loadAllIdioms: vi.fn(async () => []),
}))
vi.mock('@/utils/poetry-location', () => ({
  parseLocation: vi.fn(() => ({ name: '长安', lat: 34.3, lng: 108.9 })),
}))

function stubUni() {
  vi.stubGlobal('uni', {
    showToast: vi.fn(),
    createSelectorQuery: vi.fn(() => {
      const query: any = {}
      query.in = vi.fn(() => query)
      query.select = vi.fn(() => query)
      query.boundingClientRect = vi.fn((callback: (rect: any) => void) => {
        query.callback = callback
        return query
      })
      query.exec = vi.fn(() => query.callback({ width: 320, height: 480 }))
      return query
    }),
  })
}

describe('诗词地图 marker', () => {
  beforeEach(() => {
    data.poems = defaultPoems
    vi.clearAllMocks()
    stubUni()
  })

  it('聚合点展示诗名，字符串或顶层 marker ID 均返回该地点的完整诗词列表', async () => {
    const wrapper = mount(PoetryMapTab, {
      props: { selectedPoetryIds: new Set<string>(), selectedIdiomIds: new Set<string>() },
      global: {
        stubs: { picker: { template: '<div><slot /></div>' } },
      },
    })

    await waitFor(() => expect(wrapper.find('map').exists()).toBe(true))
    const map = wrapper.find('map')
    const markers = (wrapper.vm as any).markers
    expect(markers).toHaveLength(1)
    expect(markers[0].title).toBe('静夜思、登鹳雀楼')
    expect(markers[0].callout.content).toBe('静夜思、登鹳雀楼')
    expect(markers[0].callout.display).toBe('BYCLICK')

    await map.trigger('markertap', { detail: { markerId: '0' } })
    const events = wrapper.emitted('tapMarker')
    expect(events).toHaveLength(1)
    expect(events![0][0]).toEqual(expect.objectContaining({
      locationName: '长安',
      poems: data.poems,
      idioms: [],
    }))

    await map.trigger('markertap', { markerId: 0 })
    await nextTick()
    expect(wrapper.emitted('tapMarker')).toHaveLength(2)
    wrapper.unmount()
  })

  it('底部 sheet 列出该地点的全部诗词名称', () => {
    const wrapper = mount(MapBottomSheet, {
      props: {
        visible: true,
        payload: { locationName: '长安', poems: data.poems, idioms: [] },
        selectedPoetryIds: new Set<string>(),
        selectedIdiomIds: new Set<string>(),
      },
      global: {
        stubs: { 'scroll-view': { template: '<div><slot /></div>' } },
      },
    })
    expect(wrapper.findAll('.sheet-item')).toHaveLength(2)
    expect(wrapper.text()).toContain('静夜思')
    expect(wrapper.text()).toContain('登鹳雀楼')
  })

  it('朝代变化后作者名称不存在时重置为全部，不沿用旧下标错选', async () => {
    data.poems = [
      { ...defaultPoems[0], dynastyCode: 'tang' },
      { ...defaultPoems[1], id: 'p-song', dynasty: '宋', dynastyCode: 'song' },
    ]
    const wrapper = mount(PoetryMapTab, {
      props: { selectedPoetryIds: new Set<string>(), selectedIdiomIds: new Set<string>() },
    })
    await waitFor(() => expect(wrapper.find('map').exists()).toBe(true))
    const pickers = wrapper.findAll('picker')
    expect(pickers).toHaveLength(3)

    await pickers[2].trigger('change', { detail: { value: '1' } })
    expect((wrapper.vm as any).selectedAuthor).toBe('李白')

    await pickers[1].trigger('change', { detail: { value: '2' } })
    await nextTick()
    expect((wrapper.vm as any).selectedAuthor).toBe('')
    expect((wrapper.vm as any).authorIndex).toBe(0)
    wrapper.unmount()
  })
})
