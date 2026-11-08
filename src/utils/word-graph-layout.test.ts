import { describe, expect, it } from 'vitest'
import { WORD_GRAPH_MAX_NODES, isWithinGraphBounds, layoutWordGraph } from './word-graph-layout'

describe('word-graph-layout（中心导图布局）', () => {
  it('空页只返回中心；单词节点按顺序围绕中心', () => {
    expect(layoutWordGraph(0).nodes).toHaveLength(0)
    const layout = layoutWordGraph(8)
    expect(layout.nodes).toHaveLength(8)
    expect(layout.nodes.every(isWithinGraphBounds)).toBe(true)
    expect(new Set(layout.nodes.map(point => `${point.x},${point.y}`)).size).toBe(8)
  })

  it('1 个节点放在正上方，容器比例影响椭圆半径', () => {
    const one = layoutWordGraph(1)
    expect(one.nodes[0].x).toBeCloseTo(0.5)
    expect(one.nodes[0].y).toBeLessThan(0.5)

    const square = layoutWordGraph(4, 600, 600)
    const wide = layoutWordGraph(4, 1200, 600)
    expect(square.radiusX).toBeLessThan(wide.radiusX)
    expect(square.radiusY).toBeGreaterThan(wide.radiusY)
  })

  it('建议上限保持 12，节点坐标始终不越界', () => {
    expect(WORD_GRAPH_MAX_NODES).toBe(12)
    const layout = layoutWordGraph(12, 480, 520)
    expect(layout.nodes).toHaveLength(12)
    expect(layout.nodes.every(isWithinGraphBounds)).toBe(true)
  })
})
