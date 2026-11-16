#!/usr/bin/env node
/**
 * 商店构建后处理（build:store 调用）：
 * 1. 剥离 dist/preload/services.js 中 STORE-STRIP 标记的段落与行（当前为 Bing 网页版翻译，审核合规要求）
 * 2. 剥离 dist/datafile/poetry/*.json 的 translation/translationSource 字段并改写 dist/NOTICE
 *    （chinese-poems.com 译文授权不明，审核要求；主分支与其他端保留完整译文，仅商店包不含）
 * 3. 闸门：全量扫描 dist/，发现内置密钥明文、Bing 网页版接口特征串或译文残留即报错退出，
 *    防止 config.ts 改动或 DCE 失效导致违规内容重新混入商店包
 */
const fs = require('node:fs')
const path = require('node:path')

const distDir = path.resolve(__dirname, '..', 'dist')
const preloadFile = path.join(distDir, 'preload', 'services.js')

// ---- 1. 标记剥离 ----
function stripMarkedSections(file) {
    if (!fs.existsSync(file)) {
        console.error(`[strip] 未找到 ${file}`)
        process.exit(1)
    }
    const lines = fs.readFileSync(file, 'utf8').split('\n')
    const out = []
    let stripping = false
    for (const line of lines) {
        if (line.includes('STORE-STRIP-START')) { stripping = true; continue }
        if (line.includes('STORE-STRIP-END')) {
            if (!stripping) { console.error('[strip] STORE-STRIP-END 没有匹配的 START'); process.exit(1) }
            stripping = false
            continue
        }
        if (line.includes('STORE-STRIP-LINE')) continue
        if (!stripping) out.push(line)
    }
    if (stripping) { console.error('[strip] STORE-STRIP-START 没有匹配的 END'); process.exit(1) }
    fs.writeFileSync(file, out.join('\n'))
    console.log(`[strip] 已剥离标记段落: ${path.relative(distDir, file)}`)
}

// ---- 2. 内置诗词英译剥离（仅商店包；主分支源码与其他端保留） ----
function stripPoetryTranslations() {
    const dir = path.join(distDir, 'datafile', 'poetry')
    if (!fs.existsSync(dir)) {
        console.error(`[strip] 未找到 ${dir}`)
        process.exit(1)
    }
    let removed = 0
    for (const f of fs.readdirSync(dir)) {
        if (!f.endsWith('.json')) continue
        const p = path.join(dir, f)
        const data = JSON.parse(fs.readFileSync(p, 'utf8'))
        for (const poem of data.poems || []) {
            if ('translation' in poem) { delete poem.translation; removed++ }
            delete poem.translationSource
        }
        fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n')
    }
    if (removed === 0) { console.error('[strip] 诗词英译字段数为 0，疑似数据源已变更'); process.exit(1) }
    console.log(`[strip] 已剥离内置诗词英译 ${removed} 条`)
}

/** 改写 dist/NOTICE：删除含 chinese-poems.com 的译文来源节，其余节重新编号 */
function rewriteNotice() {
    const file = path.join(distDir, 'NOTICE')
    if (!fs.existsSync(file)) return
    const lines = fs.readFileSync(file, 'utf8').split('\n')
    const isSep = (l) => /^-{5,}\s*$/.test(l)
    const titleIdx = lines.findIndex(l => /Chinese poem English translations/.test(l))
    if (titleIdx === -1) { console.error('[strip] NOTICE 未找到译文来源节，结构可能已变更'); process.exit(1) }
    let start = titleIdx
    while (start > 0 && !isSep(lines[start - 1])) start--
    start = Math.max(0, start - 1) // 含节前的分隔线
    let end = titleIdx + 1
    while (end < lines.length && !isSep(lines[end])) end++
    end++ // 标题下的分隔线
    while (end < lines.length && !isSep(lines[end])) end++
    lines.splice(start, end - start)
    let n = 0
    const renumbered = lines.map(l => (/^\d+\.\s+\S/.test(l) ? `${++n}. ${l.replace(/^\d+\.\s+/, '')}` : l))
    fs.writeFileSync(file, renumbered.join('\n'))
    console.log('[strip] NOTICE 已移除 chinese-poems 译文节')
}

// ---- 2. 产物闸门 ----
// 内置密钥不在本文件硬编码（否则仓库自身成为泄露源，且会触发 GitHub push protection），
// 构建时从 src/config.ts 动态提取；只挑「像密钥」的值（较长且不含 URL/模型名特征字符）
function builtinSecrets() {
    const cfg = fs.readFileSync(path.join(__dirname, '..', 'src', 'config.ts'), 'utf8')
    const found = new Set()
    for (const m of cfg.matchAll(/(?:appkey|key)\s*:\s*(?:__STORE_BUILD__\s*\?\s*''\s*:\s*)?['"]([^'"]+)['"]/g)) {
        const v = m[1]
        if (v.length >= 16 && /^[A-Za-z0-9._]+$/.test(v)) found.add(v)
    }
    return [...found]
}

const FORBIDDEN = [
    // 内置密钥明文（来自 src/config.ts，商店构建必须被 __STORE_BUILD__ 置空并被 DCE 消除）
    ...builtinSecrets(),
    // Bing 网页版翻译特征（审核第 1 条：未授权抓取网页内部接口）
    'ttranslatev3',
    'params_AbusePreventionHelper',
    'cn.bing.com/translator',
    // 内置诗词英译（授权不明，商店包必须剥净）
    'chinese-poems.com',
    '"translationSource"',
]

function* walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name)
        if (entry.isDirectory()) yield* walk(full)
        else yield full
    }
}

stripMarkedSections(preloadFile)
stripPoetryTranslations()
rewriteNotice()

const hits = []
for (const file of walk(distDir)) {
    const content = fs.readFileSync(file) // Buffer.includes 对二进制同样安全
    for (const needle of FORBIDDEN) {
        if (content.includes(needle)) {
            hits.push(`${path.relative(distDir, file)} -> ${needle}`)
        }
    }
}

if (hits.length) {
    console.error('[strip] 闸门未通过，产物中仍存在违规内容：')
    for (const h of hits) console.error(`  ${h}`)
    process.exit(1)
}
console.log('[strip] 闸门通过：产物不含内置密钥、Bing 网页版特征与内置诗词英译')
