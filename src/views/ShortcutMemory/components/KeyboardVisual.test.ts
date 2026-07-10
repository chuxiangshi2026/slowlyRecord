// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/vue'
import '@testing-library/jest-dom'
import KeyboardVisual from './KeyboardVisual.vue'

// Mock element-plus 图标（组件未直接使用，但保持与项目其它测试一致）
vi.mock('@element-plus/icons-vue', () => ({
  Check: { template: '<span>✓</span>' },
}))

// Mock logger
vi.mock('@/utils/logger', () => ({
  log: { i: vi.fn(), e: vi.fn(), w: vi.fn(), d: vi.fn() },
}))

function renderKeyboard(props: {
  pressedKeys?: Set<string>
  targetKeys?: string[]
  mode?: 'default' | 'numpad'
}) {
  return render(KeyboardVisual, {
    props: {
      pressedKeys: props.pressedKeys ?? new Set<string>(),
      targetKeys: props.targetKeys,
      mode: props.mode ?? 'default',
    },
  })
}

/** 找到文本为 keyText 的键元素（可能多个，返回第一个） */
function findKey(container: HTMLElement, keyText: string): HTMLElement | null {
  const keys = Array.from(container.querySelectorAll<HTMLElement>('.key'))
  return keys.find(k => k.textContent?.trim() === keyText) ?? null
}

describe('KeyboardVisual 键盘可视化组件', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('默认（主键位）模式', () => {
    it('应渲染主键位区的典型按键', () => {
      const { container } = renderKeyboard({})
      expect(findKey(container, 'A')).not.toBeNull()
      expect(findKey(container, 'Ctrl')).not.toBeNull()
      expect(findKey(container, 'Space')).not.toBeNull()
      expect(findKey(container, 'Esc')).not.toBeNull()
      expect(findKey(container, 'F1')).not.toBeNull()
    })

    it('默认模式不应渲染数字小键盘', () => {
      const { container, queryByText } = renderKeyboard({})
      // 小键盘专属标识 "Num" 不应出现
      expect(queryByText('Num')).toBeNull()
      expect(container.querySelector('.numpad-wrapper')).toBeNull()
    })
  })

  describe('按键高亮（active）', () => {
    it('pressedKeys 中的按键应带 active 类', () => {
      const { container } = renderKeyboard({ pressedKeys: new Set(['ctrl']) })
      const ctrl = findKey(container, 'Ctrl')
      expect(ctrl).not.toBeNull()
      expect(ctrl!.classList.contains('active')).toBe(true)
    })

    it('大小写不敏感：传入大写也应高亮', () => {
      const { container } = renderKeyboard({ pressedKeys: new Set(['A']) })
      const a = findKey(container, 'A')
      expect(a).not.toBeNull()
      expect(a!.classList.contains('active')).toBe(true)
    })

    it('未按下的按键不应带 active 类', () => {
      const { container } = renderKeyboard({ pressedKeys: new Set(['ctrl']) })
      const space = findKey(container, 'Space')
      expect(space).not.toBeNull()
      expect(space!.classList.contains('active')).toBe(false)
    })
  })

  describe('目标键高亮（target）', () => {
    it('targetKeys 中的按键应带 target 类', () => {
      const { container } = renderKeyboard({ targetKeys: ['ctrl'] })
      const ctrl = findKey(container, 'Ctrl')
      expect(ctrl).not.toBeNull()
      expect(ctrl!.classList.contains('target')).toBe(true)
    })

    it('target 与 active 可叠加', () => {
      const { container } = renderKeyboard({
        pressedKeys: new Set(['ctrl']),
        targetKeys: ['ctrl'],
      })
      const ctrl = findKey(container, 'Ctrl')
      expect(ctrl).not.toBeNull()
      expect(ctrl!.classList.contains('target')).toBe(true)
      expect(ctrl!.classList.contains('active')).toBe(true)
    })

    it('非目标键不应带 target 类', () => {
      const { container } = renderKeyboard({ targetKeys: ['ctrl'] })
      const space = findKey(container, 'Space')
      expect(space).not.toBeNull()
      expect(space!.classList.contains('target')).toBe(false)
    })
  })

  describe('数字小键盘模式', () => {
    it('numpad 模式应渲染小键盘且隐藏主键位', () => {
      const { container, getByText } = renderKeyboard({ mode: 'numpad' })
      expect(container.querySelector('.numpad-wrapper')).not.toBeNull()
      // 小键盘数字键
      expect(getByText('7')).toBeInTheDocument()
      // 主键位的字母键不应渲染
      expect(findKey(container, 'A')).toBeNull()
    })

    it('numpad 模式高亮数字键', () => {
      const { container } = renderKeyboard({
        mode: 'numpad',
        pressedKeys: new Set(['numpad5']),
      })
      const five = findKey(container, '5')
      expect(five).not.toBeNull()
      expect(five!.classList.contains('active')).toBe(true)
    })
  })
})
