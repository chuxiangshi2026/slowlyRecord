// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import '@testing-library/jest-dom'
import NumberMemoryMapping from './NumberMemoryMapping.vue'
import { getAllAssociations } from '@/utils/number-memory-db'
import { exportMappingAsImage } from '@/utils/mapping-image-export'
import { ElMessage } from 'element-plus'

// Mock element-plus 消息相关
vi.mock('element-plus', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    ElMessageBox: {
      confirm: vi.fn(() => Promise.resolve()),
    },
    ElMessage: {
      success: vi.fn(),
      error: vi.fn(),
      warning: vi.fn(),
      info: vi.fn(),
    },
  }
})

// Mock logger
vi.mock('@/utils/logger', () => ({
  log: { i: vi.fn(), e: vi.fn(), w: vi.fn(), d: vi.fn() },
}))

// Mock number-memory-db
vi.mock('@/utils/number-memory-db', () => ({
  getAllAssociations: vi.fn(() => []),
  getAssociationByNumber: vi.fn(() => null),
  saveAssociation: vi.fn(() => Promise.resolve({ ok: true, id: 'test-id' })),
  removeAssociation: vi.fn(() => Promise.resolve({ ok: true, id: 'test-id' })),
  saveTrainingResult: vi.fn(() => Promise.resolve({ ok: true, id: 'test-id' })),
  getAllTrainingResults: vi.fn(() => []),
  getTrainingProgress: vi.fn(() => null),
  clearTrainingProgress: vi.fn(),
  clearAllTrainingResults: vi.fn(),
}))

// Mock number-memory-preset
vi.mock('@/utils/number-memory-preset', () => ({
  getRecommendedImages: vi.fn((num: number) => {
    if (num < 0 || num > 99) return []
    return [{ name: '测试图片', url: '🎯', description: '测试描述' }]
  }),
  getNumberKeyword: vi.fn((num: number) => {
    if (num < 0 || num > 99) return ''
    return '测试关键词'
  }),
  getRandomNumbers: vi.fn(() => []),
  shuffleArray: vi.fn(<T>(arr: T[]) => [...arr]),
}))

// Mock number-memory-entries-db
vi.mock('@/utils/number-memory-entries-db', () => ({
  getAllEntries: vi.fn(() => []),
  createEntry: vi.fn(() => Promise.resolve({ ok: true })),
  updateEntry: vi.fn(() => Promise.resolve({ ok: true })),
  deleteEntry: vi.fn(() => Promise.resolve({ ok: true })),
  getNotesByEntryId: vi.fn(() => []),
  createNote: vi.fn(() => Promise.resolve({ ok: true })),
  updateNote: vi.fn(() => Promise.resolve({ ok: true })),
  deleteNote: vi.fn(() => Promise.resolve({ ok: true })),
  getPromptsByEntryId: vi.fn(() => []),
  createPrompt: vi.fn(() => Promise.resolve({ ok: true })),
  updatePrompt: vi.fn(() => Promise.resolve({ ok: true })),
  deletePrompt: vi.fn(() => Promise.resolve({ ok: true })),
  reorderPrompts: vi.fn(() => Promise.resolve(true)),
}))

// Mock 映射表图片导出（Canvas 在 jsdom 中不可用）
vi.mock('@/utils/mapping-image-export', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils/mapping-image-export')>()
  return {
    ...actual,
    exportMappingAsImage: vi.fn(() => Promise.resolve({})),
  }
})

// Mock @element-plus/icons-vue
vi.mock('@element-plus/icons-vue', () => ({
  Check: { template: '<span>✓</span>' },
  Delete: { template: '<span>✗</span>' },
  Upload: { template: '<span>↑</span>' },
}))

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(() => null),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(),
}
Object.defineProperty(global, 'localStorage', { value: localStorageMock })

function setup() {
  const pinia = createPinia()
  setActivePinia(pinia)
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div />' } },
      { path: '/number-memory', component: { template: '<div />' } },
      { path: '/number-memory/mapping', component: { template: '<div />' } },
    ],
  })

  const result = render(NumberMemoryMapping, {
    global: {
      plugins: [pinia, router],
      stubs: {
        'el-card': {
          template: '<div class="el-card-stub"><slot name="header" /><slot /></div>',
        },
        'el-tag': {
          props: ['type', 'size'],
          template: '<span class="el-tag-stub" :class="type"><slot /></span>',
        },
        'el-button': {
          props: ['type', 'size', 'disabled', 'plain', 'circle'],
          template: '<button class="el-button-stub" :disabled="disabled" :data-type="type"><slot /></button>',
        },
        'el-alert': {
          props: ['title', 'type', 'closable', 'showIcon', 'center'],
          template: '<div class="el-alert-stub" :class="type" role="alert"><slot />{{ title }}</div>',
        },
        'el-radio-group': {
          props: ['modelValue', 'size'],
          template: '<div class="el-radio-group-stub" role="radiogroup"><slot /></div>',
        },
        'el-radio-button': {
          props: ['label'],
          template: '<label class="el-radio-button-stub" :data-label="label"><slot /></label>',
        },
        'el-row': {
          props: ['gutter'],
          template: '<div class="el-row-stub"><slot /></div>',
        },
        'el-col': {
          props: ['span'],
          template: '<div class="el-col-stub"><slot /></div>',
        },
        'el-empty': {
          props: ['description', 'imageSize'],
          template: '<div class="el-empty-stub">{{ description }}</div>',
        },
        'el-divider': {
          template: '<hr class="el-divider-stub" />',
        },
        'el-upload': {
          props: ['action', 'autoUpload', 'showFileList', 'accept'],
          template: '<div class="el-upload-stub"><slot /></div>',
        },
        'el-icon': {
          template: '<span class="el-icon-stub"><slot /></span>',
        },
        'el-table': {
          props: ['data'],
          template: '<div class="el-table-stub"><slot /></div>',
        },
        'el-table-column': {
          props: ['prop', 'label', 'width', 'align'],
          template: '<div class="el-table-column-stub"><slot name="default" :row="{}" /></div>',
        },
      },
    },
  })

  return { ...result, user: userEvent.setup(), router }
}

describe('NumberMemoryMapping 映射设置页', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(getAllAssociations).mockReturnValue([])
    localStorageMock.getItem.mockReturnValue('shown')
  })

  describe('页面渲染', () => {
    it('应显示页面标题', () => {
      setup()
      expect(screen.getByText('🖼️ 数字-图片映射设置')).toBeInTheDocument()
    })

    it('应显示导出与打印按钮', () => {
      setup()
      expect(screen.getByRole('button', { name: /导出映射表图片/ })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /打印映射表/ })).toBeInTheDocument()
    })

    it('应显示范围选择器与一键导入预设按钮', () => {
      setup()
      expect(screen.getByText('个位数 (0-9)')).toBeInTheDocument()
      expect(screen.getByText('全部 (0-99)')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /一键导入预设/ })).toBeInTheDocument()
    })

    it('未选择数字时应显示提示', () => {
      setup()
      expect(screen.getByText('请先选择一个数字')).toBeInTheDocument()
    })

    it('打印容器应渲染当前范围的数字网格', () => {
      const { container } = setup()
      // 默认范围为个位数 0-9，共 10 个格子
      const cells = container.querySelectorAll('.mapping-print-area .print-cell')
      expect(cells.length).toBe(10)
      expect(screen.getByText('数字映射表')).toBeInTheDocument()
    })
  })

  describe('已保存关联列表', () => {
    it('有关联数据时应显示已保存的数字-图片关联', async () => {
      vi.mocked(getAllAssociations).mockReturnValue([
        { number: '0', imageUrl: '🎯', source: 'preset', description: '零' },
        { number: '1', imageUrl: '🍄', source: 'upload', description: '一' },
      ])

      setup()

      await waitFor(() => {
        expect(screen.getByText('📋 已保存的数字-图片关联')).toBeInTheDocument()
        expect(screen.getByText(/已保存 2 个数字/)).toBeInTheDocument()
      })
    })

    it('没有关联数据时不应显示关联列表', async () => {
      setup()
      await waitFor(() => {
        expect(screen.queryByText('📋 已保存的数字-图片关联')).not.toBeInTheDocument()
      })
    })
  })

  describe('导出与打印', () => {
    it('点击导出按钮应调用导出并提示成功', async () => {
      const { user } = setup()
      await user.click(screen.getByRole('button', { name: /导出映射表图片/ }))

      await waitFor(() => {
        expect(exportMappingAsImage).toHaveBeenCalledWith(
          ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'],
          [],
          expect.objectContaining({ title: expect.stringContaining('数字映射表') }),
        )
        expect(ElMessage.success).toHaveBeenCalledWith('图片已保存')
      })
    })

    it('导出失败时应提示导出失败', async () => {
      vi.mocked(exportMappingAsImage).mockRejectedValueOnce(new Error('导出失败'))

      const { user } = setup()
      await user.click(screen.getByRole('button', { name: /导出映射表图片/ }))

      await waitFor(() => {
        expect(ElMessage.error).toHaveBeenCalledWith('导出失败')
      })
    })

    it('点击打印按钮应调用系统打印', async () => {
      const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {})

      const { user } = setup()
      await user.click(screen.getByRole('button', { name: /打印映射表/ }))

      await waitFor(() => {
        expect(printSpy).toHaveBeenCalled()
      })
      printSpy.mockRestore()
    })
  })

  describe('导航', () => {
    it('点击返回应导航到数字记忆首页', async () => {
      const { user, router } = setup()
      const pushSpy = vi.spyOn(router, 'push')

      await user.click(screen.getByRole('button', { name: '返回' }))

      expect(pushSpy).toHaveBeenCalledWith('/number-memory')
    })
  })
})
