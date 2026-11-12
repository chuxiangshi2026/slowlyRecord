// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getFileAdapter } from '../file'
import { resetPlatformCache, setPlatform } from '../platform'

describe('文件选择取消', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    resetPlatformCache()
    setPlatform('web')
    document.body.innerHTML = ''
  })

  it('cancel 事件返回 null 并清理临时 input', async () => {
    vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(function (this: HTMLInputElement) {
      this.dispatchEvent(new Event('cancel'))
    })
    await expect(getFileAdapter().pickFile()).resolves.toBeNull()
    expect(document.querySelector('input[type=file]')).toBeNull()
  })

  it('不支持 cancel 时在窗口重新聚焦后按取消处理', async () => {
    vi.useFakeTimers()
    vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {})
    const picked = getFileAdapter().pickFile()
    window.dispatchEvent(new Event('focus'))
    await vi.advanceTimersByTimeAsync(300)
    await expect(picked).resolves.toBeNull()
    expect(document.querySelector('input[type=file]')).toBeNull()
    vi.useRealTimers()
  })

  it('选择文件后只返回一次结果', async () => {
    const file = new File(['{}'], 'book.json')
    vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(function (this: HTMLInputElement) {
      Object.defineProperty(this, 'files', { value: [file] })
      this.dispatchEvent(new Event('change'))
      this.dispatchEvent(new Event('cancel'))
    })
    await expect(getFileAdapter().pickFile()).resolves.toBe(file)
  })
})
