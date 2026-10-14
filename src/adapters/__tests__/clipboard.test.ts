/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { getClipboardAdapter, setClipboardAdapter, type ClipboardAdapter } from '../clipboard'
import { resetPlatformCache, setPlatform } from '../platform'

describe('clipboard adapter', () => {
  beforeEach(() => {
    // 清除适配器缓存 - 通过设置 null 来重置
    setClipboardAdapter(null as any)
    resetPlatformCache()
    // Mock navigator.clipboard for jsdom
    if (!navigator.clipboard) {
      Object.defineProperty(navigator, 'clipboard', {
        value: {
          writeText: vi.fn().mockResolvedValue(undefined),
          readText: vi.fn().mockResolvedValue(''),
        },
        writable: true,
        configurable: true,
      })
    }
  })

  describe('setClipboardAdapter / getClipboardAdapter', () => {
    it('应该允许手动设置适配器', () => {
      const mockAdapter: ClipboardAdapter = {
        copyText: async () => true,
        readText: async () => 'mocked text',
      }
      setClipboardAdapter(mockAdapter)
      const adapter = getClipboardAdapter()
      expect(adapter).toBe(mockAdapter)
    })

    it('手动设置后 getClipboardAdapter 返回相同实例', () => {
      const mockAdapter: ClipboardAdapter = {
        copyText: async () => true,
        readText: async () => '',
      }
      setClipboardAdapter(mockAdapter)
      const adapter1 = getClipboardAdapter()
      const adapter2 = getClipboardAdapter()
      expect(adapter1).toBe(adapter2)
      expect(adapter1).toBe(mockAdapter)
    })
  })

  describe('WebClipboard (默认平台)', () => {
    beforeEach(() => {
      setPlatform('web')
      setClipboardAdapter(null as any)
    })

    it('在 web 平台下返回 WebClipboard 实例', () => {
      const adapter = getClipboardAdapter()
      expect(adapter).toBeDefined()
      expect(typeof adapter.copyText).toBe('function')
      expect(typeof adapter.readText).toBe('function')
    })

    it('copyText 应该调用 navigator.clipboard.writeText', async () => {
      const writeTextSpy = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue()
      const adapter = getClipboardAdapter()
      await expect(adapter.copyText('hello')).resolves.toBe(true)
      expect(writeTextSpy).toHaveBeenCalledWith('hello')
      writeTextSpy.mockRestore()
    })

    it('copyText 在 Clipboard API 失败时回退 execCommand', async () => {
      const writeTextSpy = vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('denied'))
      ;(document as any).execCommand = vi.fn().mockReturnValue(true)
      const adapter = getClipboardAdapter()
      await expect(adapter.copyText('hello')).resolves.toBe(true)
      expect((document as any).execCommand).toHaveBeenCalledWith('copy')
      writeTextSpy.mockRestore()
      delete (document as any).execCommand
    })

    it('copyText 两条链路都失败时返回 false', async () => {
      const writeTextSpy = vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('denied'))
      ;(document as any).execCommand = vi.fn().mockReturnValue(false)
      const adapter = getClipboardAdapter()
      await expect(adapter.copyText('hello')).resolves.toBe(false)
      writeTextSpy.mockRestore()
      delete (document as any).execCommand
    })

    it('readText 应该调用 navigator.clipboard.readText', async () => {
      const readTextSpy = vi.spyOn(navigator.clipboard, 'readText').mockResolvedValue('world')
      const adapter = getClipboardAdapter()
      const result = await adapter.readText()
      expect(result).toBe('world')
      expect(readTextSpy).toHaveBeenCalled()
      readTextSpy.mockRestore()
    })

    it('web 平台不提供 pasteTextAndHide 能力', () => {
      const adapter = getClipboardAdapter()
      expect(adapter.pasteTextAndHide).toBeUndefined()
    })
  })

  describe('UtoolsClipboard', () => {
    beforeEach(() => {
      setPlatform('utools')
      setClipboardAdapter(null as any)
      ;(window as any).utools = { copyText: vi.fn() }
    })

    afterEach(() => {
      delete (window as any).utools
    })

    it('在 utools 平台下返回 UtoolsClipboard 实例', () => {
      const adapter = getClipboardAdapter()
      expect(adapter).toBeDefined()
      expect(typeof adapter.copyText).toBe('function')
      expect(typeof adapter.readText).toBe('function')
    })

    it('copyText 应该调用 utools.copyText', async () => {
      const adapter = getClipboardAdapter()
      ;((window as any).utools.copyText as any).mockReturnValue(true)
      await expect(adapter.copyText('test text')).resolves.toBe(true)
      expect((window as any).utools.copyText).toHaveBeenCalledWith('test text')
    })

    it('pasteTextAndHide 应该调用 utools.hideMainWindowPasteText', async () => {
      const adapter = getClipboardAdapter()
      ;(window as any).utools.hideMainWindowPasteText = vi.fn().mockReturnValue(true)
      await expect(adapter.pasteTextAndHide?.('粘贴文本')).resolves.toBe(true)
      expect((window as any).utools.hideMainWindowPasteText).toHaveBeenCalledWith('粘贴文本')
    })

    it('pasteTextAndHide 在 API 不存在、返回 false 或抛异常时返回 false', async () => {
      const adapter = getClipboardAdapter()
      // API 不存在
      await expect(adapter.pasteTextAndHide?.('x')).resolves.toBe(false)
      // 执行失败返回 false
      ;(window as any).utools.hideMainWindowPasteText = vi.fn().mockReturnValue(false)
      await expect(adapter.pasteTextAndHide?.('x')).resolves.toBe(false)
      // 抛异常
      ;(window as any).utools.hideMainWindowPasteText = vi.fn(() => { throw new Error('boom') })
      await expect(adapter.pasteTextAndHide?.('x')).resolves.toBe(false)
    })

    it('pasteTextAndHide 空文本返回 false', async () => {
      const adapter = getClipboardAdapter()
      ;(window as any).utools.hideMainWindowPasteText = vi.fn().mockReturnValue(true)
      await expect(adapter.pasteTextAndHide?.('')).resolves.toBe(false)
      expect((window as any).utools.hideMainWindowPasteText).not.toHaveBeenCalled()
    })
  })

  describe('WxClipboard', () => {
    beforeEach(() => {
      setPlatform('mp-weixin')
      setClipboardAdapter(null as any)
      ;(window as any).wx = {
        setClipboardData: vi.fn(),
        getClipboardData: vi.fn(({ success }: any) => success({ data: 'wx-text' })),
      }
    })

    afterEach(() => {
      delete (window as any).wx
    })

    it('在 mp-weixin 平台下返回 WxClipboard 实例', () => {
      const adapter = getClipboardAdapter()
      expect(adapter).toBeDefined()
      expect(typeof adapter.copyText).toBe('function')
      expect(typeof adapter.readText).toBe('function')
    })

    it('copyText 应该调用 wx.setClipboardData', () => {
      const adapter = getClipboardAdapter()
      adapter.copyText('wx text')
      expect((window as any).wx.setClipboardData).toHaveBeenCalledWith(expect.objectContaining({ data: 'wx text' }))
    })

    it('readText 应该调用 wx.getClipboardData 并返回数据', async () => {
      const adapter = getClipboardAdapter()
      const result = await adapter.readText()
      expect(result).toBe('wx-text')
    })
  })

  describe('DouyinClipboard', () => {
    beforeEach(() => {
      setPlatform('mp-douyin')
      setClipboardAdapter(null as any)
      ;(window as any).tt = {
        setClipboardData: vi.fn(),
        getClipboardData: vi.fn(({ success }: any) => success({ data: 'tt-text' })),
      }
    })

    afterEach(() => {
      delete (window as any).tt
    })

    it('在 mp-douyin 平台下返回 DouyinClipboard 实例', () => {
      const adapter = getClipboardAdapter()
      expect(adapter).toBeDefined()
      expect(typeof adapter.copyText).toBe('function')
      expect(typeof adapter.readText).toBe('function')
    })

    it('copyText 应该调用 tt.setClipboardData', () => {
      const adapter = getClipboardAdapter()
      adapter.copyText('tt text')
      expect((window as any).tt.setClipboardData).toHaveBeenCalledWith(expect.objectContaining({ data: 'tt text' }))
    })

    it('readText 应该调用 tt.getClipboardData 并返回数据', async () => {
      const adapter = getClipboardAdapter()
      const result = await adapter.readText()
      expect(result).toBe('tt-text')
    })
  })

  describe('工厂方法缓存', () => {
    it('多次调用返回相同实例', () => {
      setPlatform('web')
      setClipboardAdapter(null as any)
      const a1 = getClipboardAdapter()
      const a2 = getClipboardAdapter()
      expect(a1).toBe(a2)
    })

    it('手动设置后会覆盖自动创建的实例', () => {
      setPlatform('web')
      setClipboardAdapter(null as any)
      const autoAdapter = getClipboardAdapter()

      const mockAdapter: ClipboardAdapter = {
        copyText: async () => true,
        readText: async () => '',
      }
      setClipboardAdapter(mockAdapter)
      expect(getClipboardAdapter()).toBe(mockAdapter)
      expect(getClipboardAdapter()).not.toBe(autoAdapter)
    })
  })
})
