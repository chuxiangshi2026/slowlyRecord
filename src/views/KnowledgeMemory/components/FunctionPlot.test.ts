// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/vue'
import '@testing-library/jest-dom'
import { flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import FunctionPlot from './FunctionPlot.vue'

function createCtxStub() {
  return {
    setTransform: vi.fn(),
    fillRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    arc: vi.fn(),
    fillText: vi.fn(),
    setLineDash: vi.fn(),
  }
}

describe('FunctionPlot', () => {
  let getContextSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    global.ResizeObserver = function () {
      return {
        observe: vi.fn(),
        disconnect: vi.fn(),
        unobserve: vi.fn(),
      }
    } as any
    global.requestAnimationFrame = vi.fn((cb: FrameRequestCallback) => {
      cb(0)
      return 0
    }) as any
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, value: 300 })
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, value: 150 })
    getContextSpy = vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue(createCtxStub() as any)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    delete (HTMLElement.prototype as any).clientWidth
    delete (HTMLElement.prototype as any).clientHeight
  })

  it('挂载后渲染标题与 canvas', async () => {
    render(FunctionPlot, {
      props: {
        fn: (x: number) => x,
        title: 'y = x',
      },
    })
    await flushPromises()
    await nextTick()

    expect(screen.getByText('y = x')).toBeInTheDocument()
    expect(document.querySelector('canvas')).toBeInTheDocument()
    expect(getContextSpy).toHaveBeenCalledWith('2d')
  })

  it('滚轮缩放触发重绘', async () => {
    const { container } = render(FunctionPlot, {
      props: {
        fn: (x: number) => x,
        title: 'y = x',
      },
    })
    await flushPromises()
    await nextTick()
    getContextSpy.mockClear()

    // 在绘图区向上滚动 → range 变化 → 重绘
    const wrap = container.querySelector('.plot-wrap') as HTMLElement
    await fireEvent.wheel(wrap, {deltaY: -120, offsetX: 150, offsetY: 75})

    expect(getContextSpy).toHaveBeenCalledWith('2d')
  })
})
