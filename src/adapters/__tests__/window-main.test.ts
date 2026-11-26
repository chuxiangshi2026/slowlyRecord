// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as windowAdapter from '../window'

vi.mock('../platform', () => ({ isUtools: () => true }))

describe('uTools 主窗口适配器', () => {
  beforeEach(() => {
    ;(window as any).utools = {
      hideMainWindow: vi.fn(() => true),
      showMainWindow: vi.fn(),
    }
  })

  it('任务成功时返回结果并恢复主窗口', async () => {
    const task = vi.fn(async () => 'ok')
    await expect((windowAdapter as any).withMainWindowRestore(task)).resolves.toBe('ok')
    expect((window as any).utools.showMainWindow).toHaveBeenCalledTimes(1)
  })

  it('任务失败时仍恢复主窗口并保留原异常', async () => {
    const task = vi.fn(async () => { throw new Error('截图取消') })
    await expect((windowAdapter as any).withMainWindowRestore(task)).rejects.toThrow('截图取消')
    expect((window as any).utools.showMainWindow).toHaveBeenCalledTimes(1)
  })
})
