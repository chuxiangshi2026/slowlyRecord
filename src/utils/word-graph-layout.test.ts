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

  it('左右最外侧节点留出边距，不被卡片边缘裁切', () => {
    // 节点宽约容器 18%（一半 9%），4 个节点时正左右排布是最贴边的情况
    const { nodes } = layoutWordGraph(4)
    const halfNode = 0.09
    expect(Math.min(...nodes.map(p => p.x))).toBeGreaterThanOrEqual(halfNode)
    expect(Math.max(...nodes.map(p => p.x))).toBeLessThanOrEqual(1 - halfNode)
  })

  it('建议上限保持 12，节点坐标始终不越界', () => {
    expect(WORD_GRAPH_MAX_NODES).toBe(12)
    const layout = layoutWordGraph(12, 480, 520)
    expect(layout.nodes).toHaveLength(12)
    expect(layout.nodes.every(isWithinGraphBounds)).toBe(true)
  })
})
