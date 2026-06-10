import { describe, expect, it } from 'vitest'
import {
  FOCUS_LOCK_TOP_INTERACTIVE_HEIGHT,
  isPointInBounds,
  mergeFocusModeSettings,
  shouldIgnoreMouseInLockedFocusWindow,
} from './focus-lock'

describe('focus-lock', () => {
  const bounds = { x: 100, y: 200, width: 320, height: 100 }

  describe('isPointInBounds', () => {
    it('应该识别窗口范围内的点', () => {
      expect(isPointInBounds({ x: 120, y: 230 }, bounds)).toBe(true)
    })

    it('应该识别窗口范围外的点', () => {
      expect(isPointInBounds({ x: 99, y: 230 }, bounds)).toBe(false)
      expect(isPointInBounds({ x: 120, y: 301 }, bounds)).toBe(false)
    })
  })

  describe('shouldIgnoreMouseInLockedFocusWindow', () => {
    it('锁定后内容区应该穿透', () => {
      const shouldIgnore = shouldIgnoreMouseInLockedFocusWindow(bounds, [
        { x: 160, y: 200 + FOCUS_LOCK_TOP_INTERACTIVE_HEIGHT + 1 },
      ])

      expect(shouldIgnore).toBe(true)
    })

    it('顶部标题/按钮区不应该穿透，便于解锁', () => {
      const shouldIgnore = shouldIgnoreMouseInLockedFocusWindow(bounds, [
        { x: 160, y: 210 },
      ])

      expect(shouldIgnore).toBe(false)
    })

    it('没有窗口坐标或鼠标坐标时默认穿透', () => {
      expect(shouldIgnoreMouseInLockedFocusWindow(null, [{ x: 160, y: 210 }])).toBe(true)
      expect(shouldIgnoreMouseInLockedFocusWindow(bounds, [])).toBe(true)
    })

    it('坐标候选都不在窗口内时默认穿透，避免误关穿透', () => {
      const shouldIgnore = shouldIgnoreMouseInLockedFocusWindow(bounds, [
        { x: 10, y: 10 },
        { x: 500, y: 500 },
      ])

      expect(shouldIgnore).toBe(true)
    })

    it('优先使用第一个落在窗口内的坐标候选', () => {
      const shouldIgnore = shouldIgnoreMouseInLockedFocusWindow(bounds, [
        { x: 160, y: 260 },
        { x: 160, y: 210 },
      ])

      expect(shouldIgnore).toBe(true)
    })
  })

  describe('mergeFocusModeSettings', () => {
    it('DB 中的专注模式设置应该覆盖 store 中的旧状态', () => {
      const merged = mergeFocusModeSettings(
        { locked: false, edgeStickEnabled: true, opacity: 0.8 },
        { locked: true, opacity: 0.5 },
      )

      expect(merged).toEqual({
        locked: true,
        edgeStickEnabled: true,
        opacity: 0.5,
      })
    })
  })
})
