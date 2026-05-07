/**
 * Electron 文件系统适配器
 * 
 * 通过 IPC 调用主进程的 fs API，避免渲染进程直接使用 Node.js
 */
import type { FileAdapter } from '../file'

export class FileAdapterElectron implements FileAdapter {
  private getAPI() {
    const api = (window as any).electronAPI
    if (!api) throw new Error('electronAPI 不可用')
    return api
  }

  async readText(path: string): Promise<string> {
    return this.getAPI().readFile(path)
  }

  async writeText(path: string, content: string): Promise<void> {
    await this.getAPI().writeFile(path, content)
  }

  async readJSON<T = any>(path: string): Promise<T> {
    const text = await this.readText(path)
    return JSON.parse(text)
  }

  async pickFile(options?: { accept?: string; multiple?: boolean }): Promise<File | File[]> {
    const result = await this.getAPI().showOpenDialog({
      properties: [options?.multiple ? 'multiSelections' : 'openFile'],
      filters: options?.accept ? [{ name: 'Files', extensions: options.accept.split(',').map(e => e.replace('.', '')) }] : undefined,
    })
    if (result.canceled) return options?.multiple ? [] : null as any

    const files: File[] = []
    for (const filePath of result.filePaths) {
      const content = await this.readText(filePath)
      const name = filePath.split(/[\\/]/).pop() || 'file'
      files.push(new File([content], name))
    }
    return options?.multiple ? files : files[0] || null as any
  }

  async downloadFile(data: Blob | string, filename: string): Promise<void> {
    const result = await this.getAPI().showSaveDialog({
      defaultPath: filename,
    })
    if (result.canceled) return
    const content = typeof data === 'string' ? data : await data.text()
    await this.getAPI().writeFile(result.filePath, content)
  }
}
