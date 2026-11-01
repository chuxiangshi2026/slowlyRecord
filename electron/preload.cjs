import { contextBridge, ipcRenderer } from 'electron'
import https from 'node:https'

const BING_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'

function bingRequest(url, options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      let text = ''
      res.setEncoding('utf8')
      res.on('data', (chunk) => { text += chunk })
      res.on('end', () => resolve({ status: res.statusCode || 0, body: text }))
    })
    req.setTimeout(12000, () => req.destroy(new Error('timeout')))
    req.on('error', reject)
    req.end(body)
  })
}

let bingPageCache = null

async function getBingPageToken() {
  if (bingPageCache && Date.now() < bingPageCache.expiresAt) return bingPageCache
  const res = await bingRequest('https://cn.bing.com/translator', {
    method: 'GET',
    headers: { 'User-Agent': BING_UA, 'Accept-Language': 'zh-CN,zh;q=0.9' },
  })
  if (res.status < 200 || res.status >= 300) throw new Error(`Bing 翻译页请求失败: ${res.status}`)
  const params = /params_AbusePreventionHelper\s*=\s*\[(\d+),"([^"]+)",(\d+)\]/.exec(res.body)
  const ig = /IG:"([^"]+)"/.exec(res.body)
  if (!params || !ig) throw new Error('Bing 翻译页未返回授权参数')
  const ttl = Math.max(60000, Number(params[3]) || 3600000)
  bingPageCache = {
    key: params[1],
    token: params[2],
    ig: ig[1],
    expiresAt: Date.now() + ttl - 5 * 60 * 1000,
  }
  return bingPageCache
}

async function bingTranslate(text, from = 'auto-detect', to = 'zh-Hans') {
  const cached = await getBingPageToken()
  const body = new URLSearchParams({ fromLang: from, text, to, token: cached.token, key: cached.key }).toString()
  const url = `https://cn.bing.com/ttranslatev3?isVertical=1&IG=${encodeURIComponent(cached.ig)}&IID=translator.5028.1`
  const res = await bingRequest(url, {
    method: 'POST',
    headers: {
      'User-Agent': BING_UA,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Referer': 'https://cn.bing.com/translator',
    },
  }, body)
  if (res.status === 401 || res.status === 403) {
    bingPageCache = null
    return bingTranslate(text, from, to)
  }
  return res
}

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

  // 微软网页版翻译（Node 层请求，绕过渲染进程跨域）
  bingTranslate,

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
    ipcRenderer.on('global-shortcut', (_event, action, text) => callback(action, text))
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
