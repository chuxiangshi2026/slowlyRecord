/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createElectronWindowProxy, getCursorPointCandidates, applyChildWindowAlwaysOnTop, persistChildDbPut } from '../window'
import { setDbAdapter } from '../db'
import { resetPlatformCache, setPlatform } from '../platform'

describe('window adapter', () => {
  beforeEach(() => {
    resetPlatformCache()
  })
  afterEach(() => {
    delete (window as any).utools
    delete (window as any).electronAPI
    resetPlatformCache()
  })

  describe('createElectronWindowProxy', () => {
    it('转发 IPC 调用并维护本地状态', () => {
      const focusWindowInvoke = vi.fn()
      ;(window as any).electronAPI = { focusWindowInvoke, focusWindowExecuteJS: vi.fn() }
      const proxy = createElectronWindowProxy(7, true)

      expect(proxy._winId).toBe(7)
      expect(proxy.isDestroyed()).toBe(false)
      expect(proxy.isFocused()).toBe(false)
      expect(proxy.isAlwaysOnTop()).toBe(true)

      proxy.setAlwaysOnTop(false)
      expect(focusWindowInvoke).toHaveBeenCalledWith(7, 'setAlwaysOnTop', [false])
      expect(proxy.isAlwaysOnTop()).toBe(false)

      proxy.show()
      expect(focusWindowInvoke).toHaveBeenCalledWith(7, 'show', [])
      proxy.setBounds({ x: 1, y: 2, width: 3, height: 4 })
      expect(focusWindowInvoke).toHaveBeenCalledWith(7, 'setBounds', [{ x: 1, y: 2, width: 3, height: 4 }])

      proxy.webContents.executeJavaScript('console.log(1)')
      expect((window as any).electronAPI.focusWindowExecuteJS).toHaveBeenCalledWith(7, 'console.log(1)')
    })
  })

  describe('getCursorPointCandidates', () => {
    it('uTools 环境返回原始坐标 + DIP 换算候选', async () => {
      setPlatform('utools')
      ;(window as any).utools = {
        // isUtools() 以 getPath 存在性判定 uTools 环境
        getPath: vi.fn(),
        getCursorScreenPoint: vi.fn().mockReturnValue({ x: 100, y: 200 }),
        screenToDipPoint: vi.fn().mockReturnValue({ x: 50, y: 100 }),
      }
      const candidates = await getCursorPointCandidates()
      expect(candidates).toEqual([{ x: 100, y: 200 }, { x: 50, y: 100 }])
    })

    it('Electron 环境走 IPC 取坐标', async () => {
      setPlatform('electron')
      ;(window as any).electronAPI = { getCursorScreenPoint: vi.fn().mockResolvedValue({ x: 9, y: 9 }) }
      const candidates = await getCursorPointCandidates()
      expect(candidates).toEqual([{ x: 9, y: 9 }])
    })

    it('无可用 API 时返回空数组', async () => {
      setPlatform('web')
      await expect(getCursorPointCandidates()).resolves.toEqual([])
    })

    it('API 抛异常时返回空数组', async () => {
      setPlatform('utools')
      ;(window as any).utools = {
        getPath: vi.fn(),
        getCursorScreenPoint: vi.fn(() => { throw new Error('boom') }),
      }
      await expect(getCursorPointCandidates()).resolves.toEqual([])
    })
  })

  describe('applyChildWindowAlwaysOnTop', () => {
    it('正常应用并回读实际状态', () => {
      const win = {
        setAlwaysOnTop: vi.fn(),
        moveTop: vi.fn(),
        isAlwaysOnTop: vi.fn().mockReturnValue(true),
      }
      expect(applyChildWindowAlwaysOnTop(win, true, 'test')).toBe(true)
      expect(win.setAlwaysOnTop).toHaveBeenCalledWith(true)
      expect(win.moveTop).toHaveBeenCalled()
    })

    it('取消置顶时不调 moveTop', () => {
      const win = {
        setAlwaysOnTop: vi.fn(),
        moveTop: vi.fn(),
        isAlwaysOnTop: vi.fn().mockReturnValue(false),
      }
      expect(applyChildWindowAlwaysOnTop(win, false, 'test')).toBe(true)
      expect(win.moveTop).not.toHaveBeenCalled()
    })

    it('窗口为空或无 API 时返回 false', () => {
      expect(applyChildWindowAlwaysOnTop(null, true, 'test')).toBe(false)
      expect(applyChildWindowAlwaysOnTop({}, true, 'test')).toBe(false)
    })

    it('实际状态与期望不符时返回 false', () => {
      const win = {
        setAlwaysOnTop: vi.fn(),
        isAlwaysOnTop: vi.fn().mockReturnValue(false),
      }
      expect(applyChildWindowAlwaysOnTop(win, true, 'test')).toBe(false)
    })

    it('API 抛异常时返回 false', () => {
      const win = { setAlwaysOnTop: vi.fn(() => { throw new Error('boom') }) }
      expect(applyChildWindowAlwaysOnTop(win, true, 'test')).toBe(false)
    })
  })

  describe('persistChildDbPut', () => {
    it('put 成功直接返回', async () => {
      const put = vi.fn().mockResolvedValue({ ok: true })
      setDbAdapter({ put, get: vi.fn() } as any)
      await persistChildDbPut({ _id: 'a' }, 'test')
      expect(put).toHaveBeenCalledWith({ _id: 'a' })
    })

    it('put 冲突时读最新 _rev 重试一次', async () => {
      const doc: any = { _id: 'a', v: 1 }
      const put = vi.fn()
        .mockResolvedValueOnce({ ok: false })
        .mockResolvedValueOnce({ ok: true })
      const get = vi.fn().mockResolvedValue({ _id: 'a', _rev: 'r2' })
      setDbAdapter({ put, get } as any)
      await persistChildDbPut(doc, 'test')
      expect(put).toHaveBeenCalledTimes(2)
      expect(put).toHaveBeenLastCalledWith({ _id: 'a', v: 1, _rev: 'r2' })
    })

    it('适配器抛异常时吞掉（日志记录）', async () => {
      setDbAdapter({ put: vi.fn().mockRejectedValue(new Error('boom')) } as any)
      await expect(persistChildDbPut({ _id: 'a' }, 'test')).resolves.toBeUndefined()
    })
  })
})
