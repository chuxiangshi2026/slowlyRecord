// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { waitFor } from '@testing-library/vue'
import ImportPage from './import.vue'

vi.setConfig({ testTimeout: 30000 })

const data = vi.hoisted(() => ({
  mapPoem: {
    id: 'map-poem', title: '静夜思', author: '李白', dynasty: '唐', dynastyCode: 'tang',
    content: '床前明月光', contentType: '诗', tags: [], location: '长安',
  },
  fullPoem: {
    id: 'full-poem', title: '蜀道难', author: '李白', dynasty: '唐', dynastyCode: 'tang',
    content: '蜀道之难', contentType: '诗', tags: [], location: '蜀道',
  },
  mapIdiom: {
    id: 'map-idiom', title: '亡羊补牢', meaning: '及时补救', category: '寓言故事', tags: [], location: '长安',
  },
  fullIdiom: {
    id: 'full-idiom', title: '守株待兔', meaning: '心存侥幸', category: '寓言故事', tags: [],
  },
}))

const api = vi.hoisted(() => ({
  loadPoetryByDynasty: vi.fn(),
  loadAllIdioms: vi.fn(),
}))

vi.mock('./library', () => ({
  DYNASTIES: [{ code: 'tang', name: '唐' }, { code: 'song', name: '宋' }],
  IDIOM_CATEGORIES: ['寓言故事'],
  loadPoetryByDynasty: api.loadPoetryByDynasty,
  loadAllIdioms: api.loadAllIdioms,
}))
vi.mock('@/stores/useTextMemory', () => ({
  useTextMemory: () => ({ load: vi.fn(), addArticles: vi.fn() }),
}))
vi.mock('./components/InkBackground.vue', () => ({ default: { template: '<div />' } }))

const PoetryMapTabStub = defineComponent({
  emits: ['tapMarker'],
  mounted() {
    this.$emit('tapMarker', {
      poems: [data.mapPoem],
      idioms: [data.mapIdiom],
      locationName: '长安',
    })
  },
  template: '<div />',
})
const MapBottomSheetStub = defineComponent({
  emits: ['togglePoetry', 'toggleIdiom'],
  mounted() {
    this.$emit('togglePoetry', data.mapPoem)
    this.$emit('toggleIdiom', data.mapIdiom)
  },
  template: '<div />',
})

describe('导入页地图与内置库加载', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.loadPoetryByDynasty.mockImplementation(async (code: string) => code === 'tang' ? [data.fullPoem] : [])
    api.loadAllIdioms.mockResolvedValue([data.fullIdiom])
    vi.stubGlobal('uni', { showToast: vi.fn(), navigateBack: vi.fn() })
  })

  it('地图先选中条目后，诗词库和成语库仍执行完整加载', async () => {
    const wrapper = mount(ImportPage, {
      global: {
        mixins: [{ computed: { themeClass: () => '' } }],
        stubs: {
          PoetryMapTab: PoetryMapTabStub,
          MapBottomSheet: MapBottomSheetStub,
          InkBackground: true,
          picker: { template: '<div><slot /></div>' },
          'scroll-view': { template: '<div><slot /></div>' },
        },
      },
    })

    const mapTab = wrapper.findAll('.tab').find(tab => tab.text() === '地图')!
    await mapTab.trigger('click')
    await waitFor(() => expect(wrapper.findComponent(MapBottomSheetStub).exists()).toBe(true))
    await nextTick()
    expect(api.loadPoetryByDynasty).not.toHaveBeenCalled()
    expect(api.loadAllIdioms).not.toHaveBeenCalled()

    const poetryTab = wrapper.findAll('.tab').find(tab => tab.text() === '诗词库')!
    await poetryTab.trigger('click')
    await waitFor(() => expect(wrapper.text()).toContain('蜀道难'))
    expect(api.loadPoetryByDynasty).toHaveBeenCalledTimes(2)

    const idiomTab = wrapper.findAll('.tab').find(tab => tab.text() === '成语库')!
    await idiomTab.trigger('click')
    await waitFor(() => expect(wrapper.text()).toContain('守株待兔'))
    expect(api.loadAllIdioms).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })
})
