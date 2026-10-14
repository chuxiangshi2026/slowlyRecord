/**
 * 剪贴板适配器
 */
import { getPlatform, type Platform } from './platform'

export interface ClipboardAdapter {
  /** 复制文本到剪贴板，返回是否成功 */
  copyText(text: string): Promise<boolean>
  /** 读取剪贴板文本 */
  readText(): Promise<string>
  /** 隐藏主窗口并把文本粘贴回原应用，返回是否成功；仅 uTools 实现，其他平台为 undefined（调用方据此决定是否展示入口，失败时应回退 copyText） */
  pasteTextAndHide?(text: string): Promise<boolean>
}

/**
 * Web 复制：优先 Clipboard API；非安全上下文或调用失败时回退 execCommand
 */
async function webCopyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch { /* 继续走降级 */ }
  try {
    const textArea = document.createElement('textarea')
    textArea.value = text
    textArea.style.position = 'fixed'
    textArea.style.left = '-999999px'
    textArea.style.top = '-999999px'
    document.body.appendChild(textArea)
    textArea.focus()
    textArea.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(textArea)
    return ok
  } catch {
    return false
  }
}

class UtoolsClipboard implements ClipboardAdapter {
  async copyText(text: string): Promise<boolean> {
    const utools = (window as any).utools
    // utools.copyText 为同步 API 并返回是否成功；不可用时回退 Web 链路
    if (typeof utools?.copyText === 'function') return !!utools.copyText(text)
    return webCopyText(text)
  }
  async readText(): Promise<string> {
    return navigator.clipboard.readText()
  }
  async pasteTextAndHide(text: string): Promise<boolean> {
    const utools = (window as any).utools
    // 老版本 uTools 可能无此 API，空文本/执行异常一律视为失败，由调用方回退复制
    if (typeof utools?.hideMainWindowPasteText !== 'function' || !text) return false
    try {
      return utools.hideMainWindowPasteText(text) === true
    } catch {
      return false
    }
  }
}

class WxClipboard implements ClipboardAdapter {
  copyText(text: string): Promise<boolean> {
    return new Promise((resolve) => {
      const wx = (window as any).wx
      wx.setClipboardData({ data: text, success: () => resolve(true), fail: () => resolve(false) })
    })
  }
  async readText(): Promise<string> {
    return new Promise((resolve) => {
      const wx = (window as any).wx
      wx.getClipboardData({ success: (res: any) => resolve(res.data) })
    })
  }
}

class DouyinClipboard implements ClipboardAdapter {
  copyText(text: string): Promise<boolean> {
    return new Promise((resolve) => {
      const tt = (window as any).tt
      tt.setClipboardData({ data: text, success: () => resolve(true), fail: () => resolve(false) })
    })
  }
  async readText(): Promise<string> {
    return new Promise((resolve) => {
      const tt = (window as any).tt
      tt.getClipboardData({ success: (res: any) => resolve(res.data) })
    })
  }
}

class WebClipboard implements ClipboardAdapter {
  copyText(text: string): Promise<boolean> {
    return webCopyText(text)
  }
  async readText(): Promise<string> {
    return navigator.clipboard.readText()
  }
}

let _clipboard: ClipboardAdapter | null = null

export function getClipboardAdapter(): ClipboardAdapter {
  if (_clipboard) return _clipboard

  const platform = getPlatform()
  switch (platform) {
    case 'utools':
      _clipboard = new UtoolsClipboard()
      break
    case 'mp-weixin':
      _clipboard = new WxClipboard()
      break
    case 'mp-douyin':
      _clipboard = new DouyinClipboard()
      break
    default:
      _clipboard = new WebClipboard()
  }
  return _clipboard
}

export function setClipboardAdapter(adapter: ClipboardAdapter): void {
  _clipboard = adapter
}
