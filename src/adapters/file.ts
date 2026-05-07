/**
 * 文件系统适配器
 */
import { getPlatform } from './platform'

export interface FileAdapter {
  /** 读取文本文件 */
  readText(path: string): Promise<string>
  /** 写入文本文件 */
  writeText(path: string, content: string): Promise<void>
  /** 读取 JSON 文件 */
  readJSON<T = any>(path: string): Promise<T>
  /** 选择文件（返回文件路径或文件对象） */
  pickFile(options?: { accept?: string; multiple?: boolean }): Promise<File | File[]>
  /** 下载文件（Web 端：触发浏览器下载；桌面端：保存到指定路径） */
  downloadFile(data: Blob | string, filename: string): Promise<void>
}

class UtoolsFileAdapter implements FileAdapter {
  async readText(path: string): Promise<string> {
    const fs = (window as any).require('fs')
    return fs.readFileSync(path, 'utf-8')
  }
  async writeText(path: string, content: string): Promise<void> {
    const fs = (window as any).require('fs')
    fs.writeFileSync(path, content, 'utf-8')
  }
  async readJSON<T = any>(path: string): Promise<T> {
    const text = await this.readText(path)
    return JSON.parse(text)
  }
  async pickFile(options?: { accept?: string; multiple?: boolean }): Promise<File | File[]> {
    // uTools 环境下使用 utools.showOpenDialog 或 input[type=file]
    return this._pickViaInput(options)
  }
  private _pickViaInput(options?: { accept?: string; multiple?: boolean }): Promise<File | File[]> {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input')
      input.type = 'file'
      if (options?.accept) input.accept = options.accept
      if (options?.multiple) input.multiple = true
      input.onchange = () => {
        const files = Array.from(input.files || [])
        if (options?.multiple) resolve(files)
        else resolve(files[0] || null as any)
      }
      input.click()
    })
  }
  async downloadFile(data: Blob | string, filename: string): Promise<void> {
    if (typeof data === 'string') {
      data = new Blob([data], { type: 'text/plain' })
    }
    const url = URL.createObjectURL(data)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }
}

class WebFileAdapter implements FileAdapter {
  async readText(path: string): Promise<string> {
    const resp = await fetch(path)
    return resp.text()
  }
  async writeText(_path: string, _content: string): Promise<void> {
    throw new Error('Web environment does not support writing files directly')
  }
  async readJSON<T = any>(path: string): Promise<T> {
    const resp = await fetch(path)
    return resp.json()
  }
  async pickFile(options?: { accept?: string; multiple?: boolean }): Promise<File | File[]> {
    return new Promise((resolve) => {
      const input = document.createElement('input')
      input.type = 'file'
      if (options?.accept) input.accept = options.accept
      if (options?.multiple) input.multiple = true
      input.onchange = () => {
        const files = Array.from(input.files || [])
        if (options?.multiple) resolve(files)
        else resolve(files[0] || null as any)
      }
      input.click()
    })
  }
  async downloadFile(data: Blob | string, filename: string): Promise<void> {
    if (typeof data === 'string') {
      data = new Blob([data], { type: 'text/plain' })
    }
    const url = URL.createObjectURL(data)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }
}

class WxFileAdapter implements FileAdapter {
  async readText(path: string): Promise<string> {
    const wx = (window as any).wx
    const fs = wx.getFileSystemManager()
    return fs.readFileSync(path, 'utf-8') as string
  }
  async writeText(path: string, content: string): Promise<void> {
    const wx = (window as any).wx
    const fs = wx.getFileSystemManager()
    fs.writeFileSync(path, content, 'utf-8')
  }
  async readJSON<T = any>(path: string): Promise<T> {
    const text = await this.readText(path)
    return JSON.parse(text)
  }
  async pickFile(_options?: { accept?: string; multiple?: boolean }): Promise<File | File[]> {
    const wx = (window as any).wx
    return new Promise((resolve, reject) => {
      wx.chooseMessageFile({
        count: _options?.multiple ? 10 : 1,
        success: (res: any) => {
          // 小程序返回的是临时文件路径，需要封装为 File-like 对象
          resolve(res.tempFiles)
        },
        fail: (err: any) => reject(err),
      })
    })
  }
  async downloadFile(data: Blob | string, filename: string): Promise<void> {
    const wx = (window as any).wx
    // 小程序用 wx.saveFile 或 wx.getFileSystemManager
    if (typeof data === 'string') {
      const fs = wx.getFileSystemManager()
      const filePath = `${wx.env.USER_DATA_PATH}/${filename}`
      fs.writeFileSync(filePath, data, 'utf-8')
    }
  }
}

let _fileAdapter: FileAdapter | null = null

export function getFileAdapter(): FileAdapter {
  if (_fileAdapter) return _fileAdapter

  const platform = getPlatform()
  switch (platform) {
    case 'utools':
      _fileAdapter = new UtoolsFileAdapter()
      break
    case 'electron': {
      // 动态导入 Electron 适配器，避免在非 Electron 环境加载
      try {
        const { FileAdapterElectron } = require('./impl/file-electron')
        _fileAdapter = new FileAdapterElectron()
      } catch {
        _fileAdapter = new WebFileAdapter()
      }
      break
    }
    case 'mp-weixin':
      _fileAdapter = new WxFileAdapter()
      break
    default:
      _fileAdapter = new WebFileAdapter()
  }
  return _fileAdapter
}

export function setFileAdapter(adapter: FileAdapter): void {
  _fileAdapter = adapter
}
