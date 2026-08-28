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
  showRightSection?: boolean
  keyLabels?: Record<string, string>
  compact?: boolean
}) {
  return render(KeyboardVisual, {
    props: {
      pressedKeys: props.pressedKeys ?? new Set<string>(),
      targetKeys: props.targetKeys,
      mode: props.mode ?? 'default',
      showRightSection: props.showRightSection,
      keyLabels: props.keyLabels,
      compact: props.compact,
    },
  })
}

/** 找到文本为 keyText 的键元素（可能多个，返回第一个） */
function findKey(container: HTMLElement, keyText: string): HTMLElement | null {
  const keys = Array.from(container.querySelectorAll<HTMLElement>('.key'))
  return keys.find(k => {
    const main = k.querySelector<HTMLElement>('.key-main')
    if (main) return main.textContent?.trim() === keyText
    return k.textContent?.trim() === keyText
  }) ?? null
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

  describe('键位辅助标签（keyLabels）', () => {
    it('字母键显示韵母子标签', () => {
      const { container } = renderKeyboard({ keyLabels: { Q: 'iu', W: 'ei' } })
      const q = findKey(container, 'Q')
      expect(q).not.toBeNull()
      expect(q!.querySelector('.key-sub')?.textContent).toBe('iu')
      const w = findKey(container, 'W')
      expect(w!.querySelector('.key-sub')?.textContent).toBe('ei')
    })

    it('未配置辅助标签的键不渲染子标签', () => {
      const { container } = renderKeyboard({ keyLabels: { Q: 'iu' } })
      const a = findKey(container, 'A')
      expect(a).not.toBeNull()
      expect(a!.querySelector('.key-sub')).toBeNull()
    })
  })

  describe('右侧编辑/方向键显隐（showRightSection）', () => {
    it('默认显示右侧区域', () => {
      const { container } = renderKeyboard({})
      expect(container.querySelector('.right-section')).not.toBeNull()
      expect(findKey(container, 'Ins')).not.toBeNull()
    })

    it('showRightSection=false 隐藏右侧区域', () => {
      const { container } = renderKeyboard({ showRightSection: false })
      expect(container.querySelector('.right-section')).toBeNull()
      expect(findKey(container, 'Ins')).toBeNull()
    })
  })

  describe('紧凑模式（compact）', () => {
    it('compact=true 隐藏最上面两排', () => {
      const { container } = renderKeyboard({ compact: true })
      expect(findKey(container, 'Esc')).toBeNull()
      expect(findKey(container, 'F1')).toBeNull()
      expect(findKey(container, '1')).toBeNull()
      expect(findKey(container, 'A')).not.toBeNull()
    })

    it('compact=true 只显示26个字母', () => {
      const { container } = renderKeyboard({ compact: true })
      expect(findKey(container, 'Tab')).toBeNull()
      expect(findKey(container, 'Caps')).toBeNull()
      expect(findKey(container, 'Enter')).toBeNull()
      expect(findKey(container, 'Shift')).toBeNull()
      expect(findKey(container, 'Ctrl')).toBeNull()
      expect(findKey(container, 'Win')).toBeNull()
      expect(findKey(container, 'Alt')).toBeNull()
      expect(findKey(container, 'Space')).toBeNull()
      expect(findKey(container, '[')).toBeNull()
      expect(findKey(container, ';')).toBeNull()
      expect(findKey(container, ',')).toBeNull()
      for (const ch of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
        expect(findKey(container, ch)).not.toBeNull()
      }
    })

    it('compact=true 放大键位', () => {
      const { container } = renderKeyboard({ compact: true })
      const a = findKey(container, 'A')
      expect(a).not.toBeNull()
      expect(container.querySelector('.keyboard-visual')?.classList.contains('compact')).toBe(true)
    })

    it('compact=true 且 keyLabels 时韵母更突出', () => {
      const { container } = renderKeyboard({ compact: true, keyLabels: { Q: 'iu' } })
      const q = findKey(container, 'Q')
      expect(q).not.toBeNull()
      const sub = q!.querySelector('.key-sub')
      expect(sub).not.toBeNull()
      expect(sub!.textContent).toBe('iu')
    })

    it('compact=true 时两个韵母直接换行，不显示斜杠', () => {
      const { container } = renderKeyboard({ compact: true, keyLabels: { S: 'ong\niong' } })
      const s = findKey(container, 'S')
      expect(s).not.toBeNull()
      const sub = s!.querySelector('.key-sub')
      expect(sub).not.toBeNull()
      expect(sub!.textContent).toBe('ong\niong')
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
