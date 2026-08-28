import { app, BrowserWindow, ipcMain, dialog, clipboard, Tray, Menu, globalShortcut, screen } from 'electron'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

// ESM 兼容的 __dirname
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 保持对窗口对象的全局引用，避免被垃圾回收
let mainWindow = null
let tray = null

// 窗口状态文件路径
const windowStatePath = path.join(app.getPath('userData'), 'window-state.json')

function loadWindowState() {
  try {
    if (fs.existsSync(windowStatePath)) {
      return JSON.parse(fs.readFileSync(windowStatePath, 'utf-8'))
    }
  } catch (e) {
    console.error('加载窗口状态失败:', e)
  }
  return { width: 900, height: 680, x: undefined, y: undefined }
}

function saveWindowState() {
  if (!mainWindow) return
  const bounds = mainWindow.getBounds()
  try {
    fs.writeFileSync(windowStatePath, JSON.stringify(bounds), 'utf-8')
  } catch (e) {
    console.error('保存窗口状态失败:', e)
  }
}

function createWindow() {
  const state = loadWindowState()

  mainWindow = new BrowserWindow({
    width: state.width,
    height: state.height,
    x: state.x,
    y: state.y,
    minWidth: 700,
    minHeight: 500,
    frame: true,
    titleBarStyle: 'default',
    show: false, // 先不显示，等 ready-to-show 再显示
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  })

  // 开发环境加载 dev server，生产环境加载打包后的 index.html
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, 'index.html'))
  }

  // 临时：打开 DevTools 便于调试白屏问题，调试完毕后删除此行
  // mainWindow.webContents.openDevTools()

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  // 关闭时保存状态并最小化到托盘
  mainWindow.on('close', (event) => {
    if (!app.isQuiting) {
      event.preventDefault()
      saveWindowState()
      mainWindow?.hide()
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

function createTray() {
  // 使用简单图标（emoji 或内置）
  const iconPath = path.join(__dirname, process.platform === 'win32' ? '../images/logo.ico' : '../images/logo.png')
  const trayIcon = fs.existsSync(iconPath) ? iconPath : undefined

  tray = new Tray(trayIcon || path.join(__dirname, 'icon.png'))
  tray.setToolTip('慢记')

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示窗口',
      click: () => {
        if (mainWindow) {
          mainWindow.show()
          mainWindow.focus()
        } else {
          createWindow()
        }
      }
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        app.isQuiting = true
        saveWindowState()
        app.quit()
      }
    }
  ])

  tray.setContextMenu(contextMenu)
  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide()
      } else {
        mainWindow.show()
        mainWindow.focus()
      }
    } else {
      createWindow()
    }
  })
}

// 应用就绪时创建窗口
app.whenReady().then(() => {
  createWindow()
  createTray()

  // 注册全局快捷键
  registerGlobalShortcuts()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    } else {
      mainWindow?.show()
    }
  })
})

function registerGlobalShortcuts() {
  // Ctrl/Cmd + Shift + W: 显示/隐藏窗口
  globalShortcut.register('CommandOrControl+Shift+W', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide()
      } else {
        mainWindow.show()
        mainWindow.focus()
      }
    }
  })

  // Ctrl/Cmd + Shift + S: 触发截图翻译
  globalShortcut.register('CommandOrControl+Shift+S', () => {
    mainWindow?.webContents.send('global-shortcut', 'screen-capture')
    mainWindow?.show()
    mainWindow?.focus()
  })

  // Ctrl/Cmd + Shift + T: 打开快速翻译
  globalShortcut.register('CommandOrControl+Shift+T', () => {
    mainWindow?.webContents.send('global-shortcut', 'quick-translate')
    mainWindow?.show()
    mainWindow?.focus()
  })

  console.log('[Electron] 全局快捷键已注册')
}

// 所有窗口关闭时不退出（由托盘控制）
app.on('window-all-closed', () => {
  // 不退出，保持托盘运行
})

// 退出前清理
app.on('before-quit', () => {
  app.isQuiting = true
  saveWindowState()
})

// 注销全局快捷键
app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})

// ==================== IPC 处理 ====================

// 文件选择对话框
ipcMain.handle('showOpenDialog', async (_event, options) => {
  const result = await dialog.showOpenDialog(mainWindow, options)
  return result
})

// 文件保存对话框
ipcMain.handle('showSaveDialog', async (_event, options) => {
  const result = await dialog.showSaveDialog(mainWindow, options)
  return result
})

// 读取文件
ipcMain.handle('readFile', async (_event, filePath) => {
  return fs.readFileSync(filePath, 'utf-8')
})

// 写入文件
ipcMain.handle('writeFile', async (_event, filePath, content) => {
  fs.writeFileSync(filePath, content, 'utf-8')
  return true
})

// 获取临时目录
ipcMain.handle('getPath', (_event, name) => {
  return app.getPath(name)
})

// 剪贴板：读取
ipcMain.handle('clipboardReadText', () => {
  return clipboard.readText()
})

// 剪贴板：写入
ipcMain.handle('clipboardWriteText', (_event, text) => {
  clipboard.writeText(text)
})

// 窗口透明度：获取
ipcMain.handle('getWindowOpacity', () => {
  const opacity = mainWindow ? mainWindow.getOpacity() : 1.0
  console.log('[Electron] getWindowOpacity:', opacity)
  return opacity
})

// 获取鼠标屏幕坐标
ipcMain.handle('getCursorScreenPoint', () => {
  try {
    const pt = screen.getCursorScreenPoint()
    return { x: pt.x, y: pt.y }
  } catch (e) {
    console.error('[Electron] 获取鼠标坐标失败:', e)
    return null
  }
})

// 窗口透明度：设置
ipcMain.handle('setWindowOpacity', (_event, opacity) => {
  console.log('[Electron] setWindowOpacity 收到请求:', opacity)
  if (mainWindow) {
    const validOpacity = Math.max(0.3, Math.min(1.0, Number(opacity) || 1.0))
    mainWindow.setOpacity(validOpacity)
    console.log('[Electron] 窗口透明度已应用:', validOpacity)
    return validOpacity
  }
  console.warn('[Electron] setWindowOpacity: mainWindow 不存在')
  return 1.0
})

// ==================== 子窗口管理（专注模式 / 输入法键盘悬浮窗） ====================
// 对齐 uTools 的 createBrowserWindow：父渲染进程通过 IPC 创建子 BrowserWindow 并操作，
// 子窗口通过 preload-child 注入 utools shim，业务 HTML（focus.html / input-method-helper.html）无需改动。
const childWindows = new Map() // winId -> BrowserWindow
let childWinSeq = 0

function resolveChildUrl(url) {
  if (process.env.VITE_DEV_SERVER_URL) {
    const base = process.env.VITE_DEV_SERVER_URL.replace(/\/$/, '')
    return `${base}/${url}`
  }
  return path.join(__dirname, url)
}

ipcMain.handle('createBrowserWindow', async (_event, { url, options }) => {
  const winId = ++childWinSeq
  const win = new BrowserWindow({
    ...options,
    webPreferences: {
      preload: path.join(__dirname, 'preload-child.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  })
  const forwardEvent = (event) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('focus-window-event', { winId, event })
    }
  }
  win.on('closed', () => { childWindows.delete(winId); forwardEvent('closed') })
  win.on('blur', () => forwardEvent('blur'))
  win.on('focus', () => forwardEvent('focus'))
  childWindows.set(winId, win)
  win.loadURL(resolveChildUrl(url)).catch(e => console.error('[Electron] 加载子窗口失败:', url, e))
  return winId
})

ipcMain.handle('focusWindowInvoke', async (_event, { winId, method, args }) => {
  const win = childWindows.get(winId)
  if (!win || win.isDestroyed()) {
    if (method === 'isDestroyed') return true
    return undefined
  }
  try {
    switch (method) {
      case 'setIgnoreMouseEvents': win.setIgnoreMouseEvents(args[0], args[1] || {}); return true
      case 'setAlwaysOnTop': win.setAlwaysOnTop(args[0]); return true
      case 'setResizable': win.setResizable(args[0]); return true
      case 'setBounds': win.setBounds(args[0]); return true
      case 'moveTop': win.moveTop(); return true
      case 'focus': win.focus(); return true
      case 'show': win.show(); return true
      case 'close': win.close(); return true
      case 'getBounds': return win.getBounds()
      case 'isAlwaysOnTop': return win.isAlwaysOnTop()
      case 'isDestroyed': return win.isDestroyed()
    }
  } catch (e) {
    console.error(`[Electron] focusWindowInvoke ${method} 失败:`, e)
  }
  return undefined
})

ipcMain.handle('focusWindowExecuteJS', async (_event, { winId, js }) => {
  const win = childWindows.get(winId)
  if (!win || win.isDestroyed()) return undefined
  try {
    return await win.webContents.executeJavaScript(js)
  } catch (e) {
    console.error('[Electron] focusWindowExecuteJS 失败:', e)
    return undefined
  }
})

// 子窗口 -> 父窗口：sendToParent 动作转发
ipcMain.on('focusChildAction', (_event, { channel, payload }) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('focus-child-action', { channel, payload })
  }
})

// 子窗口 -> 父窗口：db 写转发（utools shim 的 db.put 经此转发给父渲染进程持久化）
ipcMain.on('childDbPut', (_event, doc) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('child-db-put', doc)
  }
})

// 子窗口 -> 主进程：显示主窗口
ipcMain.on('showMainWindow', () => {
  if (mainWindow) { mainWindow.show(); mainWindow.focus() }
})
