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

  it('点击导入内置桩库入口时向父级抛出 openPegImport 事件', async () => {
    const { emitted } = await setup()

    // 桩库导入统一由宿主页面的「添加/导入」对话框承担，组件只负责通知
    await fireEvent.click(screen.getByText('download'))

    expect(emitted().openPegImport).toBeTruthy()
    expect(emitted().openPegImport).toHaveLength(1)
  })
})
