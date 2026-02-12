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


}
