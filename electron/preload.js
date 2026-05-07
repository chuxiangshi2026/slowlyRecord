const { contextBridge, ipcRenderer } = require('electron')

// 通过 contextBridge 安全地暴露 API 给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  // 文件对话框
  showOpenDialog: (options) => ipcRenderer.invoke('showOpenDialog', options),
  showSaveDialog: (options) => ipcRenderer.invoke('showSaveDialog', options),

  // 文件读写
  readFile: (filePath) => ipcRenderer.invoke('readFile', filePath),
  writeFile: (filePath, content) => ipcRenderer.invoke('writeFile', filePath, content),

  // 路径
  getPath: (name) => ipcRenderer.invoke('getPath', name),

  // 剪贴板
  clipboardReadText: () => ipcRenderer.invoke('clipboardReadText'),
  clipboardWriteText: (text) => ipcRenderer.invoke('clipboardWriteText', text),

  // 平台信息
  platform: process.platform,
})
