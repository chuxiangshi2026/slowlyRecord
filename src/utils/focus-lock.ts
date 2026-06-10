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
