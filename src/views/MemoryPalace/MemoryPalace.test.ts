// @vitest-environment jsdom
import {describe, it, expect, beforeEach, vi} from 'vitest'
import {render, screen, fireEvent, waitFor, within} from '@testing-library/vue'
import {createPinia, setActivePinia} from 'pinia'
import {createRouter, createMemoryHistory} from 'vue-router'
import {reactive} from 'vue'
import '@testing-library/jest-dom'
import MemoryPalace from './MemoryPalace.vue'

const hoisted = vi.hoisted(() => {
  const palace1 = {
    _id: 'palace-1',
    name: '我的家',
    loci: [
      {order: 1, name: '大门'},
      {order: 2, name: '客厅'},
    ],
    ctime: 1,
    utime: 1,
  }
  const palace2 = {
    _id: 'palace-2',
    name: '上班路线',
    loci: [{order: 1, name: '地铁站'}],
    sourcePackId: 'pack-1',
    ctime: 2,
    utime: 2,
  }

  const pegPacks = [
    {id: 'pack-1', name: '二十四节气', itemCount: 24},
    {id: 'pack-2', name: '十二生肖', itemCount: 12},
  ]

  return {palace1, palace2, pegPacks, store: undefined as any}
})

vi.mock('@/stores/memoryPalace', () => ({
  useMemoryPalaceStore: vi.fn(() => hoisted.store),
}))

vi.mock('element-plus', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...(actual as any),
    ElMessage: {
      success: vi.fn(),
      error: vi.fn(),
      warning: vi.fn(),
      info: vi.fn(),
    },
    ElMessageBox: {
      confirm: vi.fn(() => Promise.resolve()),
    },
  }
})

vi.mock('@element-plus/icons-vue', () => ({
  Search: {template: '<span>search</span>'},
  CircleClose: {template: '<span>circle-close</span>'},
  Delete: {template: '<span>delete</span>'},
  Download: {template: '<span>download</span>'},
  Edit: {template: '<span>edit</span>'},
  Plus: {template: '<span>plus</span>'},
  View: {template: '<span>view</span>'},
}))

// el-dropdown 在未注册 ElementPlus 时不会渲染 #dropdown 插槽。
// 用 stub 模拟「点击触发展开 + 点击带 command 的项上抛 command 事件」的语义。
const ElDropdownStub = {
  emits: ['command'],
  data: () => ({open: false}),
  methods: {
    onTriggerClick() {
      this.open = !this.open
    },
    onMenuClick(e: Event) {
      const target = e.target as HTMLElement
      const el = target.closest?.('[command]')
      if (el) this.$emit('command', el.getAttribute('command'))
    },
  },
  template: `
    <div class="el-dropdown-stub">
      <span class="dd-trigger" @click="onTriggerClick"><slot /></span>
      <div v-if="open" class="dd-menu" @click="onMenuClick"><slot name="dropdown" /></div>
    </div>`,
}

async function setup() {
  const pinia = createPinia()
  setActivePinia(pinia)

  hoisted.store = reactive({
    palaces: [
      {
        _id: 'palace-1',
        name: '我的家',
        loci: [
          {order: 1, name: '大门'},
          {order: 2, name: '客厅'},
        ],
        ctime: 1,
        utime: 1,
      },
      {
        _id: 'palace-2',
        name: '上班路线',
        loci: [{order: 1, name: '地铁站'}],
        sourcePackId: 'pack-1',
        ctime: 2,
        utime: 2,
      },
    ],
    loading: false,
    loadPalaces: vi.fn(() => Promise.resolve()),
    mountedCount: vi.fn(() => 0),
    listPegPacks: vi.fn(() => hoisted.pegPacks),
    importPackAsPalace: vi.fn(() =>
      Promise.resolve({
        result: {ok: true},
        palace: {_id: 'palace-import', name: '二十四节气', loci: [], ctime: 3, utime: 3},
      }),
    ),
    deletePalace: vi.fn(async (id: string) => {
      const idx = hoisted.store.palaces.findIndex((p: any) => p._id === id)
      if (idx >= 0) hoisted.store.palaces.splice(idx, 1)
      return {ok: true}
    }),
  })
  vi.clearAllMocks()

  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      {path: '/', component: {template: '<div />'}},
      {path: '/memory-palace', component: MemoryPalace},
    ],
  })
  await router.push('/memory-palace')
  await router.isReady()

  return render(MemoryPalace, {
    global: {
      plugins: [pinia, router],
      stubs: {
        'el-dropdown': ElDropdownStub,
      },
    },
  })
}

describe('MemoryPalace', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('渲染宫殿列表、桩数与内置桩库标签', async () => {
    await setup()

    expect(screen.getByText('我的家')).toBeInTheDocument()
    expect(screen.getByText('上班路线')).toBeInTheDocument()
    expect(screen.getAllByText(/2 桩/)).toHaveLength(1)
    expect(screen.getAllByText(/1 桩/)).toHaveLength(1)
    expect(screen.getByText('内置桩库')).toBeInTheDocument()
  })

  it('删除宫殿时确认后调用 store.deletePalace 并从列表移除', async () => {
    const {ElMessageBox} = await import('element-plus')
    await setup()

    // 在「我的家」卡片内点删除，避免依赖列表顺序
    const card = screen.getByText('我的家').closest('.palace-card') as HTMLElement
    const delIcon = within(card).getByText('delete')
    await fireEvent.click(delIcon)

    await waitFor(() => {
      expect(screen.queryByText('我的家')).not.toBeInTheDocument()
    })
    expect(hoisted.store.deletePalace).toHaveBeenCalledWith('palace-1')
    expect((ElMessageBox as any).confirm).toHaveBeenCalled()
    // 另一座宫殿仍在
    expect(screen.getByText('上班路线')).toBeInTheDocument()
  })

  it('内置桩库导入入口展示可导入包并触发导入', async () => {
    await setup()

    // 点击下载图标展开内置桩库下拉
    await fireEvent.click(screen.getByText('download'))

    const packItem = screen.getByText('二十四节气（24 桩）')
    expect(packItem).toBeInTheDocument()
    expect(screen.getByText('十二生肖（12 桩）')).toBeInTheDocument()

    await fireEvent.click(packItem)
    await waitFor(() => {
      expect(hoisted.store.importPackAsPalace).toHaveBeenCalledWith('pack-1')
    })
  })
})
