const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('path')

// 保持对窗口对象的全局引用，避免被垃圾回收
let mainWindow = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 680,
    minWidth: 700,
    minHeight: 500,
    frame: true,
    titleBarStyle: 'default',
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
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// 应用就绪时创建窗口
app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

// 所有窗口关闭时退出应用（macOS 除外）
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
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
  const fs = require('fs')
  return fs.readFileSync(filePath, 'utf-8')
})

// 写入文件
ipcMain.handle('writeFile', async (_event, filePath, content) => {
  const fs = require('fs')
  fs.writeFileSync(filePath, content, 'utf-8')
  return true
})

// 获取临时目录
ipcMain.handle('getPath', (_event, name) => {
  return app.getPath(name)
})

// 剪贴板：读取
ipcMain.handle('clipboardReadText', () => {
  const { clipboard } = require('electron')
  return clipboard.readText()
})

// 剪贴板：写入
ipcMain.handle('clipboardWriteText', (_event, text) => {
  const { clipboard } = require('electron')
  clipboard.writeText(text)
})
