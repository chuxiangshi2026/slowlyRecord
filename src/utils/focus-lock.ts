export interface Point {
  x: number
  y: number
}

export interface Bounds {
  x: number
  y: number
  width: number
  height: number
}

export const FOCUS_LOCK_TOP_INTERACTIVE_HEIGHT = 24

export function isPointInBounds(point: Point, bounds: Bounds): boolean {
  const localX = point.x - bounds.x
  const localY = point.y - bounds.y
  return localX >= 0 && localX <= bounds.width && localY >= 0 && localY <= bounds.height
}

export function shouldIgnoreMouseInLockedFocusWindow(
  bounds: Bounds | undefined | null,
  cursorCandidates: Point[],
  topInteractiveHeight = FOCUS_LOCK_TOP_INTERACTIVE_HEIGHT,
): boolean {
  if (!bounds || cursorCandidates.length === 0) {
    return true
  }

  const matchedCursor = cursorCandidates.find((cursor) => isPointInBounds(cursor, bounds))
  if (!matchedCursor) {
    return true
  }

  return matchedCursor.y - bounds.y > topInteractiveHeight
}

export function mergeFocusModeSettings<T extends Record<string, any>>(
  storeFocusMode: T | undefined | null,
  dbFocusMode: T | undefined | null,
): T {
  return {
    ...(storeFocusMode || {}),
    ...(dbFocusMode || {}),
  } as T
}

// 专注窗口并发上限：多个窗口共享一个渲染进程，开太多会卡；限制最多同时 2 个。
// 计数按来源（word / text）分别持有：各打开入口只能感知自己模块的窗口存活，
// 若共用单一计数，一方 resync 会覆盖另一方的计数，导致上限失效。
const MAX_FOCUS_WINDOWS = 2

export type FocusWindowSource = 'word' | 'text'

const openCounts: Record<FocusWindowSource, number> = { word: 0, text: 0 }

function totalOpenCount(): number {
  return openCounts.word + openCounts.text
}

export function canOpenFocusWindow(): boolean {
  return totalOpenCount() < MAX_FOCUS_WINDOWS
}

export function focusWindowOpened(source: FocusWindowSource): void {
  openCounts[source]++
}

export function focusWindowClosed(source: FocusWindowSource): void {
  openCounts[source] = Math.max(0, openCounts[source] - 1)
}

export function getOpenFocusWindowCount(): number {
  return totalOpenCount()
}

/**
 * 重新登记某来源的存活窗口数（打开入口兜底调用）：
 * uTools 的子窗口可能不触发 closed 事件，计数只加不减会误报超限；
 * 由调用方传入该来源当前仍存活的窗口数（isDestroyed 判定），只重置该来源计数，
 * 不影响另一来源。
 */
export function resyncFocusWindowCount(source: FocusWindowSource, aliveCount: number): void {
  openCounts[source] = Math.max(0, aliveCount)
}
