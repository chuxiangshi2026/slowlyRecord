const path = require('node:path')

// const CryptoJS = require('crypto-js');
const fs = require('node:fs')
const os = require('os')
const {spawn} = require("node:child_process");
const tmpFile = path.join(os.tmpdir(), 'utools_snap.png')


// 创建自定义日志文件（放在插件目录，确保可写）
// const logPath = path.join(__dirname, 'debug.log')
// function log(...args) {
//     const msg = args.map(arg =>
//         typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
//     ).join(' ') + '\n'
//
//     fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${msg}`)
// }
//
// // 捕获所有错误
// process.on('uncaughtException', (err) => {
//     log('【未捕获异常】', err.message, err.stack)
// })
//
// process.on('unhandledRejection', (reason) => {
//     log('【未处理Promise】', reason)
// })
//
// // 记录启动信息
// log('======== 插件启动 ========')
// log('__dirname:', __dirname)
// log('当前文件:', __filename)


// 暴露给渲染进程
window.services = {
    fs: require('node:fs'),
    path: require('node:path')
}

// 提前注册 onPluginEnter（preload 阶段，早于渲染进程任何代码），
// 避免 Vite 冷启动慢导致 enter 事件在 App.vue 注册前发出而丢失。
// 渲染进程就绪后把处理器挂到 __pluginEnterHandlers，事件即转发；
// 就绪前到达的事件缓存在 __pluginEnterQueue，由渲染进程启动时消费。
window.__pluginEnterQueue = []
window.__pluginEnterHandlers = []
try {
    if (window.utools && window.utools.onPluginEnter) {
        window.utools.onPluginEnter((action) => {
            if (window.__pluginEnterHandlers.length > 0) {
                window.__pluginEnterHandlers.forEach(fn => fn(action))
            } else {
                window.__pluginEnterQueue.push(action)
            }
        })
    }
} catch (e) {
    // 非 uTools 环境忽略
}
