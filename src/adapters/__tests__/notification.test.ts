/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getNotificationAdapter, setNotificationAdapter, type NotificationAdapter } from '../notification'
import { resetPlatformCache, setPlatform } from '../platform'

describe('notification adapter', () => {
  beforeEach(() => {
    setNotificationAdapter(null as any)
    resetPlatformCache()
  })

  describe('setNotificationAdapter / getNotificationAdapter', () => {
    it('应该允许手动设置适配器', () => {
      const mockAdapter: NotificationAdapter = {
        show: vi.fn(),
        success: vi.fn(),
        warning: vi.fn(),
        error: vi.fn(),
      }
      setNotificationAdapter(mockAdapter)
      expect(getNotificationAdapter()).toBe(mockAdapter)
    })

    it('手动设置后返回相同实例', () => {
      const mockAdapter: NotificationAdapter = {
        show: vi.fn(),
        success: vi.fn(),
        warning: vi.fn(),
        error: vi.fn(),
      }
      setNotificationAdapter(mockAdapter)
      const a1 = getNotificationAdapter()
      const a2 = getNotificationAdapter()
      expect(a1).toBe(a2)
      expect(a1).toBe(mockAdapter)
    })
  })

  describe('WebNotification (默认平台)', () => {
    beforeEach(() => {
      setPlatform('web')
      setNotificationAdapter(null as any)
    })

    it('在 web 平台下返回 WebNotification 实例', () => {
      const adapter = getNotificationAdapter()
      expect(adapter).toBeDefined()
      expect(typeof adapter.show).toBe('function')
      expect(typeof adapter.success).toBe('function')
      expect(typeof adapter.warning).toBe('function')
      expect(typeof adapter.error).toBe('function')
    })

    it('success 应该输出 console.log', () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      const adapter = getNotificationAdapter()
      adapter.success('操作成功')
      expect(logSpy).toHaveBeenCalledWith('[Success]', '操作成功')
      logSpy.mockRestore()
    })

    it('warning 应该输出 console.warn', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const adapter = getNotificationAdapter()
      adapter.warning('请注意')
      expect(warnSpy).toHaveBeenCalledWith('[Warning]', '请注意')
      warnSpy.mockRestore()
    })

    it('error 应该输出 console.error', () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const adapter = getNotificationAdapter()
      adapter.error('出错了')
      expect(errorSpy).toHaveBeenCalledWith('[Error]', '出错了')
      errorSpy.mockRestore()
    })
  })

  describe('UtoolsNotification', () => {
    const mockShowNotification = vi.fn()

    beforeEach(() => {
      setPlatform('utools')
      setNotificationAdapter(null as any)
      ;(window as any).utools = { showNotification: mockShowNotification }
    })

    afterEach(() => {
      delete (window as any).utools
      mockShowNotification.mockClear()
    })

    it('在 utools 平台下返回 UtoolsNotification 实例', () => {
      const adapter = getNotificationAdapter()
      expect(adapter).toBeDefined()
    })

    it('show 应该调用 utools.showNotification', () => {
      const adapter = getNotificationAdapter()
      adapter.show('标题', '内容')
      expect(mockShowNotification).toHaveBeenCalledWith('内容')
    })

    it('show 传 featureCode 时透传给 utools.showNotification（点击直达功能）', () => {
      const adapter = getNotificationAdapter()
      adapter.show('标题', '内容', () => {}, 'review')
      expect(mockShowNotification).toHaveBeenCalledWith('内容', 'review')
    })

    it('show 无 body 时使用 title', () => {
      const adapter = getNotificationAdapter()
      adapter.show('仅标题')
      expect(mockShowNotification).toHaveBeenCalledWith('仅标题')
    })

    it('success 应该调用 utools.showNotification', () => {
      const adapter = getNotificationAdapter()
      adapter.success('成功')
      expect(mockShowNotification).toHaveBeenCalledWith('成功')
    })

    it('warning 应该调用 utools.showNotification', () => {
      const adapter = getNotificationAdapter()
      adapter.warning('警告')
      expect(mockShowNotification).toHaveBeenCalledWith('警告')
    })

    it('error 应该调用 utools.showNotification', () => {
      const adapter = getNotificationAdapter()
      adapter.error('错误')
      expect(mockShowNotification).toHaveBeenCalledWith('错误')
    })
  })

  describe('WxNotification', () => {
    const mockShowToast = vi.fn()

    beforeEach(() => {
      setPlatform('mp-weixin')
      setNotificationAdapter(null as any)
      ;(window as any).wx = { showToast: mockShowToast }
    })

    afterEach(() => {
      delete (window as any).wx
      mockShowToast.mockClear()
    })

    it('在 mp-weixin 平台下返回 WxNotification 实例', () => {
      const adapter = getNotificationAdapter()
      expect(adapter).toBeDefined()
    })

    it('show 应该调用 wx.showToast with icon none', () => {
      const adapter = getNotificationAdapter()
      adapter.show('标题', '内容')
      expect(mockShowToast).toHaveBeenCalledWith({ title: '内容', icon: 'none' })
    })

    it('success 应该调用 wx.showToast with icon success', () => {
      const adapter = getNotificationAdapter()
      adapter.success('成功')
      expect(mockShowToast).toHaveBeenCalledWith({ title: '成功', icon: 'success' })
    })

    it('warning 应该调用 wx.showToast with icon none', () => {
      const adapter = getNotificationAdapter()
      adapter.warning('警告')
      expect(mockShowToast).toHaveBeenCalledWith({ title: '警告', icon: 'none' })
    })

    it('error 应该调用 wx.showToast with icon error', () => {
      const adapter = getNotificationAdapter()
      adapter.error('错误')
      expect(mockShowToast).toHaveBeenCalledWith({ title: '错误', icon: 'error' })
    })
  })

  describe('DouyinNotification', () => {
    const mockShowToast = vi.fn()

    beforeEach(() => {
      setPlatform('mp-douyin')
      setNotificationAdapter(null as any)
      ;(window as any).tt = {
        showToast: mockShowToast,
      }
    })

    afterEach(() => {
      delete (window as any).tt
      mockShowToast.mockClear()
    })

    it('在 mp-douyin 平台下返回 DouyinNotification 实例', () => {
      const adapter = getNotificationAdapter()
      expect(adapter).toBeDefined()
    })

    it('show 应该调用 tt.showToast with icon none', () => {
      const adapter = getNotificationAdapter()
      adapter.show('标题', '内容')
      expect(mockShowToast).toHaveBeenCalledWith({ title: '内容', icon: 'none' })
    })

    it('success 应该调用 tt.showToast with icon success', () => {
      const adapter = getNotificationAdapter()
      adapter.success('成功')
      expect(mockShowToast).toHaveBeenCalledWith({ title: '成功', icon: 'success' })
    })

    it('warning 应该调用 tt.showToast with icon none', () => {
      const adapter = getNotificationAdapter()
      adapter.warning('警告')
      expect(mockShowToast).toHaveBeenCalledWith({ title: '警告', icon: 'none' })
    })

    it('error 应该调用 tt.showToast with icon error', () => {
      const adapter = getNotificationAdapter()
      adapter.error('错误')
      expect(mockShowToast).toHaveBeenCalledWith({ title: '错误', icon: 'error' })
    })
  })

  describe('工厂方法缓存', () => {
    it('多次调用返回相同实例', () => {
      setPlatform('web')
      setNotificationAdapter(null as any)
      const a1 = getNotificationAdapter()
      const a2 = getNotificationAdapter()
      expect(a1).toBe(a2)
    })
  })
})
