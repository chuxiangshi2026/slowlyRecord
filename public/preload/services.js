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


// 统计上报专用：uTools 的页面 UA 含 "uTools"，会被 umami 的爬虫过滤判定为 bot，
// 事件整条丢弃但仍回 200（正文 {"beep":"boop"}）；浏览器 fetch 不能改 User-Agent，
// 故走 Node https 显式带普通 Chrome UA。渲染进程经 window.services.httpPostJson 调用。
const https = require('node:https')
const TRACK_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
function httpPostJson(url, headers, body) {
    return new Promise((resolve, reject) => {
        const req = https.request(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'User-Agent': TRACK_UA, ...headers },
        }, (res) => {
            let text = ''
            res.setEncoding('utf8')
            res.on('data', (c) => { text += c })
            res.on('end', () => resolve({ status: res.statusCode || 0, body: text }))
        })
        req.setTimeout(8000, () => req.destroy(new Error('timeout')))
        req.on('error', reject)
        req.end(body)
    })
}

// ===== 微软网页版翻译（Bing 翻译页 token 流程） =====

const BING_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'

function bingRequest(url, options, body) {
    return new Promise((resolve, reject) => {
        const req = https.request(url, options, (res) => {
            let text = ''
            res.setEncoding('utf8')
            res.on('data', (c) => { text += c })
            res.on('end', () => resolve({ status: res.statusCode || 0, body: text }))
        })
        req.setTimeout(12000, () => req.destroy(new Error('timeout')))
        req.on('error', reject)
        req.end(body)
    })
}

let bingPageCache = null

/** 从 Bing 翻译页取 params_AbusePreventionHelper 与 IG，缓存到过期前 */
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

/**
 * 微软网页版翻译：Node 层请求，避免渲染进程跨域。
 * @returns {Promise<{status:number, body:string}>}
 */
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

// 暴露给渲染进程
window.services = {
    fs: require('node:fs'),
    path: require('node:path'),
    httpPostJson,
    bingTranslate
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
