/**
 * 剪贴板适配器
 */
import { getPlatform, Platform } from './platform'

export interface ClipboardAdapter {
  /** 复制文本到剪贴板 */
  copyText(text: string): void
  /** 读取剪贴板文本 */
  readText(): Promise<string>
}

class UtoolsClipboard implements ClipboardAdapter {
  copyText(text: string): void {
    utools.copyText(text)
  }
  async readText(): Promise<string> {
    return navigator.clipboard.readText()
  }
}

class WxClipboard implements ClipboardAdapter {
  copyText(text: string): void {
    const wx = (window as any).wx
    wx.setClipboardData({ data: text })
  }
  async readText(): Promise<string> {
    return new Promise((resolve) => {
      const wx = (window as any).wx
      wx.getClipboardData({ success: (res: any) => resolve(res.data) })
    })
  }
}

class WebClipboard implements ClipboardAdapter {
  copyText(text: string): void {
    navigator.clipboard.writeText(text)
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
    default:
      _clipboard = new WebClipboard()
  }
  return _clipboard
}

export function setClipboardAdapter(adapter: ClipboardAdapter): void {
  _clipboard = adapter
}
