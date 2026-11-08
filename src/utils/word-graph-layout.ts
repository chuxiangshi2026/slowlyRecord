/**
 * 词集中心导图布局（纯函数）。
 * 坐标使用 0～1 的百分比，页面负责映射到实际容器；节点顺序由内容顺序决定。
 */

export interface WordGraphPoint {
  x: number
  y: number
}

export interface WordGraphLayout {
  center: WordGraphPoint
  nodes: WordGraphPoint[]
  radiusX: number
  radiusY: number
}

/** 导图建议上限；超过时 UI 应提示拆分而不是继续塞节点 */
export const WORD_GRAPH_MAX_NODES = 12

export function layoutWordGraph(
  count: number,
  containerWidth = 800,
  containerHeight = 600,
): WordGraphLayout {
  const safeCount = Math.max(0, Math.floor(count))
  const aspect = containerWidth > 0 && containerHeight > 0 ? containerWidth / containerHeight : 1.33
  const narrow = aspect < 1.2
  const radiusX = narrow ? 0.39 : 0.41
  const radiusY = narrow ? 0.39 : 0.36
  const center = { x: 0.5, y: 0.5 }

  if (!safeCount) {
    return { center, nodes: [], radiusX, radiusY }
  }
  if (safeCount === 1) {
    return { center, nodes: [{ x: center.x, y: center.y - radiusY }], radiusX, radiusY }
  }

  const nodes = Array.from({ length: safeCount }, (_, index) => {
    const angle = (Math.PI * 2 * index) / safeCount - Math.PI / 2
    return {
      x: center.x + Math.cos(angle) * radiusX,
      y: center.y + Math.sin(angle) * radiusY,
    }
  })
  return { center, nodes, radiusX, radiusY }
}

export function isWithinGraphBounds(point: WordGraphPoint): boolean {
  return point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1
}
