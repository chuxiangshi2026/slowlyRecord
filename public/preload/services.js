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




// 通过 window 对象向渲染进程注入 nodejs 能力
window.services = {


  capture() {
    return new Promise((resolve, reject) => {
        try {
            fs.unlinkSync(tmpFile)
        } catch {
        }

        if (process.platform === 'win32') {
            captureWin().then(resolve).catch(reject);
        } else if (process.platform === 'darwin') {
            captureMac().then(resolve).catch(reject);
        } else if (process.platform === 'linux') {
            captureLinux().then(resolve).catch(reject);
        } else {
            reject(new Error('不支持的平台'));
        }
    })
  }


}


/* ---------- Windows：热键方案（1903+）---------- */
function captureWin() {
    return new Promise((resolve, reject) => {
        utools.hideMainWindow()
        // console.log('快捷键发送')
        // 1. 发系统热键
        utools.simulateKeyboardTap('s', 'shift', 'super') // Win+Shift+S

        // 2. 等用户框选+复制
        setTimeout(() => {
            const ps = spawn('powershell', [
                '-NoProfile',
                '-ExecutionPolicy', 'Bypass',
                '-Command',
                `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8;` +
                `Add-Type -AssemblyName System.Windows.Forms;` +
                `$b = [System.Windows.Forms.Clipboard]::GetImage();` +
                `if (-not $b) { Write-Error '剪贴板无图像'; exit 1 };` +
                `$b.Save('${tmpFile.replace(/\\/g, '\\\\')}', [System.Drawing.Imaging.ImageFormat]::Png);` +
                `Write-Output '保存成功'`
            ]);

            ps.stdout.on('data', d => console.log('PS out:', d.toString()));
            ps.stderr.on('data', d => console.error('PS err:', d.toString()));

            ps.on('close', code => {
                if (code !== 0) return reject(new Error('剪贴板无图像或保存失败'));
                resolve(tmpFile);
                console.log('已写入文件:', tmpFile);
                console.log('文件大小:', require('fs').statSync(tmpFile).size, 'bytes');
            });

            ps.on('error', err => reject(err));
        }, 5000);
    })
}

/* ---------- macOS：系统命令 ---------- */
function captureMac() {
    return new Promise((resolve, reject) => {
        const cp = spawn('screencapture', ['-i', '-r', tmpFile], {shell: false})
        cp.on('close', code => {
            if (code !== 0) return reject(new Error('用户取消或权限不足'))
            if (!fs.existsSync(tmpFile)) return reject(new Error('文件未生成'))
            resolve(tmpFile)
        })
        cp.on('error', err => reject(err))
    })
}

/* ---------- Linux：gnome-screenshot ---------- */
function captureLinux() {
    return new Promise((resolve, reject) => {
        const cp = spawn('gnome-screenshot', ['-a', '-f', tmpFile], {shell: false})
        cp.on('close', code => {
            if (code !== 0) return reject(new Error('用户取消'))
            if (!fs.existsSync(tmpFile)) return reject(new Error('文件未生成'))
            resolve(tmpFile)
        })
        cp.on('error', err => reject(err))
    })
}


/* ------------ 以下函数自己按需要实现 ------------ */

/** 符合官方要求的“截断”逻辑 */
function truncate(q) {
    const len = q.length
    return len <= 20 ? q : q.slice(0, 10) + len + q.slice(-10)
}
/** 生成签名（v3 版 SHA256） */
function sign(appKey, imgBase64, salt, curtime, secret) {
    const input = truncate(imgBase64)
    const str = appKey + input + salt + curtime + secret
    return CryptoJS.SHA256(str).toString(CryptoJS.enc.Hex)
}




