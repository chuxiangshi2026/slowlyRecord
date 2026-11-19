const path = require('node:path')
const fs = require('node:fs')

/* STORE-STRIP-START:bing-web （商店构建剥离，scripts/strip-store-forbidden.cjs 删除本段） */
// ===== 微软网页版翻译（Bing 翻译页 token 流程） =====

const https = require('node:https')
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
/* STORE-STRIP-END:bing-web */

// ===== 受限文件读取（不向页面暴露 fs 本体） =====

/** target 是否位于 base 目录内（含 base 本身） */
function isPathInside(target, base) {
    const t = path.resolve(target)
    const b = path.resolve(base)
    return t === b || t.startsWith(b + path.sep)
}

/**
 * 读取插件自带资源（如本地 OCR 的 tessdata 训练数据）。
 * 仅允许插件目录内的路径，拒绝目录穿越与任意路径。
 */
function readPluginFile(absolutePath) {
    const pluginRoot = path.resolve(__dirname, '..')
    if (!isPathInside(absolutePath, pluginRoot)) {
        throw new Error('路径不在插件目录内')
    }
    return fs.readFileSync(absolutePath)
}

/**
 * 读取截图等临时图片并转 base64（uTools img 指令的 payload 是临时文件路径）。
 * 仅允许 uTools 临时目录内、且扩展名为图片的文件，避免把无关临时文件读进渲染层。
 */
function readTempImageAsBase64(absolutePath) {
    if (typeof absolutePath !== 'string' || !/\.(png|jpe?g|webp|bmp|gif)$/i.test(absolutePath)) {
        throw new Error('仅允许读取临时目录中的图片文件')
    }
    let base = ''
    try {
        if (window.utools && window.utools.getPath) base = window.utools.getPath('temp')
    } catch (e) { /* 下面按拒绝处理 */ }
    if (!base || !isPathInside(absolutePath, base)) {
        throw new Error('路径不在 uTools 临时目录内')
    }
    return fs.readFileSync(absolutePath).toString('base64')
}

// ===== 受限缓存文件读写（仅 userData/slowlyrecord-cache 固定目录） =====
// OCR 语言包、翻译缓存等可再生大体积缓存不写入随账号同步的 dbStorage，
// 统一落在这里限定的本地目录；文件名仅允许字母数字与 . _ -，杜绝目录穿越。
const CACHE_DIR_NAME = 'slowlyrecord-cache'

function getCacheDir() {
    const dir = path.join(window.utools.getPath('userData'), CACHE_DIR_NAME)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    return dir
}

function resolveCacheFile(name) {
    if (typeof name !== 'string' || !/^[A-Za-z0-9._-]{1,128}$/.test(name) || name.includes('..')) {
        throw new Error('非法缓存文件名')
    }
    return path.join(getCacheDir(), name)
}

/** 读取缓存文件内容（utf8），不存在返回 null */
function readCacheFile(name) {
    try {
        return fs.readFileSync(resolveCacheFile(name), 'utf8')
    } catch (e) {
        return null
    }
}

/** 覆盖写入缓存文件（utf8） */
function writeCacheFile(name, data) {
    fs.writeFileSync(resolveCacheFile(name), String(data), 'utf8')
}

/** 删除缓存文件，不存在时静默 */
function removeCacheFile(name) {
    try { fs.unlinkSync(resolveCacheFile(name)) } catch (e) { /* 不存在则忽略 */ }
}

// ===== 受限日志追加（固定文件名 + 大小上限轮转，页面不再直接引用 fs/path） =====
const LOG_MAX_BYTES = 512 * 1024

/** 向临时目录的固定调试日志追加一行；超过 512KB 轮转为 .old（仅保留一份旧档） */
function appendLog(message) {
    try {
        const logPath = path.join(window.utools.getPath('temp'), 'slowlyrecord-ocr.log')
        try {
            if (fs.statSync(logPath).size > LOG_MAX_BYTES) {
                fs.renameSync(logPath, logPath + '.old')
            }
        } catch (e) { /* 文件不存在 */ }
        fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${String(message).slice(0, 2000)}\n`)
    } catch (e) { /* 日志失败不影响业务 */ }
}

// 暴露给渲染进程（最小接口，不暴露 fs/path 本体）
window.services = {
    bingTranslate, /* STORE-STRIP-LINE:bing-web */
    readPluginFile,
    readTempImageAsBase64,
    readCacheFile,
    writeCacheFile,
    removeCacheFile,
    appendLog
}
