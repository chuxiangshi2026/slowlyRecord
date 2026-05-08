import { app, BrowserWindow, ipcMain, dialog, clipboard, Tray, Menu, globalShortcut } from 'electron'
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
