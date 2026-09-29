import { contextBridge, ipcRenderer } from 'electron'

// file:// 打包环境下 fetch 无法访问本地打包资源（Chromium 禁止 fetch file: URL），
// 拦截对打包资源目录的相对请求改走主进程 IPC 读取；开发/网络请求不受影响
if (window.location.protocol === 'file:') {
  const rawFetch = window.fetch.bind(window)
  window.fetch = function (input, init) {
    try {
      const raw = typeof input === 'string' ? input : (input && input.url) || ''
      if (raw && !/^https?:/i.test(raw) && !raw.includes('..')) {
        const i = raw.search(/(wordbanks|knowledgebanks|datafile|tessdata)\//)
        if (i >= 0) {
          return ipcRenderer.invoke('readResource', raw.slice(i)).then((res) => {
            if (!res) return new Response('not found', { status: 404 })
            return new Response(res.data, { headers: { 'Content-Type': res.mime } })
          })
        }
      }
    } catch { /* 解析失败走原生 fetch */ }
    return rawFetch(input, init)
  }
}

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

  // 凭据静态加密（OS 级 safeStorage；加密不可用时 encrypt 返回 null）
  safeStorageEncrypt: (plain) => ipcRenderer.invoke('safeStorageEncrypt', plain),
  safeStorageDecrypt: (b64) => ipcRenderer.invoke('safeStorageDecrypt', b64),

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
