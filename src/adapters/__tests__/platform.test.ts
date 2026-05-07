/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  isUtools,
  isElectron,
  isWeb,
  isMiniProgram,
  isApp,
  isMobile,
  isDesktop,
  getPlatform,
  resetPlatformCache,
  setPlatform,
} from '../platform'

describe('platform detection', () => {
  beforeEach(() => {
    resetPlatformCache()
    // 清理全局状态
    delete (window as any).utools
    delete (window as any).electronAPI
    delete (window as any).wx
    delete (window as any).uni
  })

  describe('isUtools', () => {
    it('should return false when utools is not defined', () => {
      expect(isUtools()).toBe(false)
    })

    it('should return false when utools exists but getPath is missing', () => {
      ;(window as any).utools = {}
      expect(isUtools()).toBe(false)
    })

    it('should return true when utools with getPath is defined', () => {
      ;(window as any).utools = { getPath: vi.fn() }
      expect(isUtools()).toBe(true)
    })
  })

  describe('isElectron', () => {
    it('should return false when neither electronAPI nor electron userAgent', () => {
      // 默认 userAgent 不包含 electron
      expect(isElectron()).toBe(false)
    })

    it('should return true when electronAPI is defined', () => {
      ;(window as any).electronAPI = {}
      expect(isElectron()).toBe(true)
    })

    it('should return true when userAgent contains Electron', () => {
      const originalUA = navigator.userAgent
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Windows NT 10.0) Electron/25.0.0',
        configurable: true,
      })
      expect(isElectron()).toBe(true)
      Object.defineProperty(navigator, 'userAgent', {
        value: originalUA,
        configurable: true,
      })
    })
  })

  describe('isMiniProgram', () => {
    it('should return false when wx is not defined', () => {
      expect(isMiniProgram()).toBe(false)
    })

    it('should return false when wx exists but getSystemInfoSync is missing', () => {
      ;(window as any).wx = {}
      expect(isMiniProgram()).toBe(false)
    })

    it('should return true when wx with getSystemInfoSync is defined', () => {
      ;(window as any).wx = { getSystemInfoSync: vi.fn() }
      expect(isMiniProgram()).toBe(true)
    })
  })

  describe('isApp', () => {
    it('should return false when uni is not defined', () => {
      expect(isApp()).toBe(false)
    })

    it('should return false when uni exists but platform is not android/ios', () => {
      ;(window as any).uni = {
        getSystemInfoSync: () => ({ platform: 'devtools' }),
      }
      expect(isApp()).toBe(false)
    })

    it('should return true when uni platform is android', () => {
      ;(window as any).uni = {
        getSystemInfoSync: () => ({ platform: 'android' }),
      }
      expect(isApp()).toBe(true)
    })

    it('should return true when uni platform is ios', () => {
      ;(window as any).uni = {
        getSystemInfoSync: () => ({ platform: 'ios' }),
      }
      expect(isApp()).toBe(true)
    })
  })

  describe('isWeb', () => {
    it('should return true when no other platform is detected', () => {
      expect(isWeb()).toBe(true)
    })

    it('should return false when utools is detected', () => {
      ;(window as any).utools = { getPath: vi.fn() }
      expect(isWeb()).toBe(false)
    })

    it('should return false when electron is detected', () => {
      ;(window as any).electronAPI = {}
      expect(isWeb()).toBe(false)
    })
  })

  describe('isMobile / isDesktop', () => {
    it('isMobile should return true for miniprogram', () => {
      ;(window as any).wx = { getSystemInfoSync: vi.fn() }
      expect(isMobile()).toBe(true)
    })

    it('isMobile should return true for app', () => {
      ;(window as any).uni = {
        getSystemInfoSync: () => ({ platform: 'android' }),
      }
      expect(isMobile()).toBe(true)
    })

    it('isDesktop should return true for utools', () => {
      ;(window as any).utools = { getPath: vi.fn() }
      expect(isDesktop()).toBe(true)
    })

    it('isDesktop should return true for electron', () => {
      ;(window as any).electronAPI = {}
      expect(isDesktop()).toBe(true)
    })
  })

  describe('getPlatform', () => {
    it('should return utools when utools is available', () => {
      ;(window as any).utools = { getPath: vi.fn() }
      expect(getPlatform()).toBe('utools')
    })

    it('should return electron when electronAPI is available', () => {
      ;(window as any).electronAPI = {}
      expect(getPlatform()).toBe('electron')
    })

    it('should return mp-weixin when wx is available', () => {
      ;(window as any).wx = { getSystemInfoSync: vi.fn() }
      expect(getPlatform()).toBe('mp-weixin')
    })

    it('should return app-android when uni platform is android', () => {
      ;(window as any).uni = {
        getSystemInfoSync: () => ({ platform: 'android' }),
      }
      expect(getPlatform()).toBe('app-android')
    })

    it('should return app-ios when uni platform is ios', () => {
      ;(window as any).uni = {
        getSystemInfoSync: () => ({ platform: 'ios' }),
      }
      expect(getPlatform()).toBe('app-ios')
    })

    it('should return web when no platform is detected', () => {
      expect(getPlatform()).toBe('web')
    })

    it('should cache the result', () => {
      expect(getPlatform()).toBe('web')
      // 设置 utools 后，缓存仍然返回 web
      ;(window as any).utools = { getPath: vi.fn() }
      expect(getPlatform()).toBe('web')
      // 重置缓存后才会重新检测
      resetPlatformCache()
      expect(getPlatform()).toBe('utools')
    })

    it('should respect priority: utools > electron > miniprogram > app > web', () => {
      ;(window as any).utools = { getPath: vi.fn() }
      ;(window as any).electronAPI = {}
      ;(window as any).wx = { getSystemInfoSync: vi.fn() }
      expect(getPlatform()).toBe('utools')
    })
  })

  describe('setPlatform', () => {
    it('should override detected platform', () => {
      setPlatform('electron')
      expect(getPlatform()).toBe('electron')
    })

    it('should be reset by resetPlatformCache', () => {
      setPlatform('mp-weixin')
      expect(getPlatform()).toBe('mp-weixin')
      resetPlatformCache()
      expect(getPlatform()).toBe('web')
    })
  })
})
