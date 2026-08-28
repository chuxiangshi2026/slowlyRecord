import { contextBridge, ipcRenderer } from 'electron'

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

  // 窗口透明度
  getWindowOpacity: () => ipcRenderer.invoke('getWindowOpacity'),
  setWindowOpacity: (opacity) => ipcRenderer.invoke('setWindowOpacity', opacity),
  getCursorScreenPoint: () => ipcRenderer.invoke('getCursorScreenPoint'),

  // 全局快捷键监听
  onGlobalShortcut: (callback) => {
    ipcRenderer.on('global-shortcut', (_event, action) => callback(action))
  },

  // ===== 子窗口管理（专注模式 / 输入法键盘悬浮窗） =====
  createBrowserWindow: (url, options) => ipcRenderer.invoke('createBrowserWindow', { url, options }),
  focusWindowInvoke: (winId, method, args) => ipcRenderer.invoke('focusWindowInvoke', { winId, method, args }),
  focusWindowExecuteJS: (winId, js) => ipcRenderer.invoke('focusWindowExecuteJS', { winId, js }),
  onFocusChildAction: (callback) => {
    ipcRenderer.on('focus-child-action', (_e, data) => callback(data))
  },
  onFocusWindowEvent: (callback) => {
    ipcRenderer.on('focus-window-event', (_e, data) => callback(data))
  },
  onChildDbPut: (callback) => {
    ipcRenderer.on('child-db-put', (_e, doc) => callback(doc))
  },
})
