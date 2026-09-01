// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/vue'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import '@testing-library/jest-dom'
import { flushPromises } from '@vue/test-utils'
import MemoryPalaceEdit from './MemoryPalaceEdit.vue'

const hoisted = vi.hoisted(() => {
  const palace = {
    _id: 'palace-1',
    name: '我的家',
    loci: [
      { order: 1, name: '大门', description: '' },
      { order: 2, name: '客厅', description: '' },
    ],
    ctime: 1,
    utime: 1,
  }

  const store = {
    palaces: [palace],
    loadPalaces: vi.fn(() => Promise.resolve()),
    updatePalace: vi.fn(() => Promise.resolve({ ok: true })),
    createPalace: vi.fn(() =>
      Promise.resolve({
        result: { ok: true },
        palace: { _id: 'palace-new', name: '', loci: [], ctime: 1, utime: 1 },
      }),
    ),
  }

  return { palace, store }
})

vi.mock('@/stores/memoryPalace', () => ({
  useMemoryPalaceStore: vi.fn(() => hoisted.store),
}))

vi.mock('@/utils/image-compress', () => ({
  compressImage: vi.fn(() => Promise.resolve('data:image/png;base64,IMG')),
  compressImageFromDataURL: vi.fn(() => Promise.resolve('data:image/png;base64,SMALL')),
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
  }
})

vi.mock('@element-plus/icons-vue', () => ({
  Bottom: { template: '<span>bottom</span>' },
  Delete: { template: '<span>delete</span>' },
  Plus: { template: '<span>plus</span>' },
  Top: { template: '<span>top</span>' },
}))

// el-input 未注册 ElementPlus，用真实 <input> stub 让 v-model / display value 查询生效
const ElInputStub = {
  props: ['modelValue', 'placeholder'],
  emits: ['update:modelValue'],
  template:
    '<input :value="modelValue" :placeholder="placeholder" @input="$emit(\'update:modelValue\', $event.target.value)" />',
}

async function setup(routeId = 'palace-1') {
  const pinia = createPinia()
  setActivePinia(pinia)

  hoisted.store.palaces = [{ ...hoisted.palace, loci: hoisted.palace.loci.map((l: any) => ({ ...l })) }]
  vi.clearAllMocks()

  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div />' } },
      { path: '/memory-palace/edit/:id?', component: MemoryPalaceEdit },
    ],
  })
  await router.push(`/memory-palace/edit/${routeId}`)
  await router.isReady()

  const result = render(MemoryPalaceEdit, {
    global: {
      plugins: [pinia, router],
      stubs: {
        'el-input': ElInputStub,
      },
    },
  })
  await flushPromises()
  return result
}

describe('MemoryPalaceEdit', () => {
  it('加载现有宫殿名称与桩列表', async () => {
    await setup()
    expect(screen.getByDisplayValue('我的家')).toBeInTheDocument()
    expect(screen.getByDisplayValue('大门')).toBeInTheDocument()
    expect(screen.getByDisplayValue('客厅')).toBeInTheDocument()
    expect(screen.getByText('地点桩（2 个，按巡视顺序排列）')).toBeInTheDocument()
  })

  it('添加新桩', async () => {
    await setup()
    await fireEvent.click(screen.getByText('添加桩'))
    expect(screen.getByText('地点桩（3 个，按巡视顺序排列）')).toBeInTheDocument()
    expect(screen.getAllByPlaceholderText('桩名称（如：大门）')).toHaveLength(3)
  })

  it('删除桩', async () => {
    await setup()
    const deleteIcons = screen.getAllByText('delete')
    expect(deleteIcons).toHaveLength(2)
    await fireEvent.click(deleteIcons[0])
    expect(screen.getByText('地点桩（1 个，按巡视顺序排列）')).toBeInTheDocument()
  })

  it('下移调整桩顺序', async () => {
    await setup()
    const bottomIcons = screen.getAllByText('bottom')
    // 第一个桩可以下移
    await fireEvent.click(bottomIcons[0])

    const inputs = screen.getAllByPlaceholderText('桩名称（如：大门）') as HTMLInputElement[]
    expect(inputs[0].value).toBe('客厅')
    expect(inputs[1].value).toBe('大门')
  })

  it('保存编辑调用 store.updatePalace', async () => {
    await setup()
    await fireEvent.click(screen.getByText('保存'))
    await waitFor(() => {
      expect(hoisted.store.updatePalace).toHaveBeenCalled()
    })
  })
})
