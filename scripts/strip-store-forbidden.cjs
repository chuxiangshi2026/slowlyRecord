#!/usr/bin/env node
/**
 * 商店构建后处理（build:store 调用）：
 * 1. 剥离 dist/preload/services.js 中 STORE-STRIP 标记的段落与行（当前为 Bing 网页版翻译，审核合规要求）
 * 2. 剥离 dist/datafile/poetry/*.json 的 translation/translationSource 字段并改写 dist/NOTICE
 *    （chinese-poems.com 译文授权不明，审核要求；主分支与其他端保留完整译文，仅商店包不含）
 * 3. 版权内容收窄（仅商店包；主分支与其他端保留完整内容）：
 *    - poetry/xiandai.json 只保留已进入公有领域（作者逝世满 50 年）的作品，并同步 index.json 计数
 *    - english/bilingual.json 删除原文仍在保护期的条目，其余条目删除无译者署名的中文译文
 *    - english/french.json 删除小王子条目（审核已点名仍在保护期）
 * 4. 闸门：全量扫描 dist/，发现内置密钥明文、Bing 网页版接口特征、译文残留或保护期文本即报错退出，
 *    防止 config.ts/数据改动或 DCE 失效导致违规内容重新混入商店包
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

// ---- 3. 版权内容收窄（仅商店包；主分支与其他端保留完整内容） ----
function curateStoreDatafiles() {
    // 近现代诗词：仅保留公有领域作品（徐志摩 1931 / 戴望舒 1950 / 闻一多 1946，均已逝世满 50 年），
    // 海子、余光中、顾城、北岛、舒婷、食指、席慕蓉、汪国真、郭沫若、艾青、臧克家及毛泽东条目仍在保护期，整篇删除
    const poetryDir = path.join(distDir, 'datafile', 'poetry')
    const xdFile = path.join(poetryDir, 'xiandai.json')
    const xd = JSON.parse(fs.readFileSync(xdFile, 'utf8'))
    const XD_KEEP = new Set(['xiandai_001', 'xiandai_002', 'xiandai_013'])
    const xdBefore = xd.poems.length
    xd.poems = xd.poems.filter(p => XD_KEEP.has(p.id))
    if (xd.poems.length !== XD_KEEP.size || xdBefore === xd.poems.length) {
        console.error('[strip] xiandai.json 结构与预期不符，疑似数据源已变更'); process.exit(1)
    }
    xd.metadata.count = xd.poems.length
    xd.metadata.description = '现代诗歌、新诗；仅收录已进入公有领域（作者逝世满 50 年）的作品'
    xd.metadata.lastUpdated = '2026-11-18'
    fs.writeFileSync(xdFile, JSON.stringify(xd, null, 2) + '\n')

    const idxFile = path.join(poetryDir, 'index.json')
    const idx = JSON.parse(fs.readFileSync(idxFile, 'utf8'))
    const xdEntry = idx.dynasties.find(d => d.code === 'xiandai')
    idx.totalCount -= (xdEntry.count - xd.poems.length)
    xdEntry.count = xd.poems.length
    xdEntry.description = '现代诗歌、新诗（公有领域作品）'
    idx.lastUpdated = '2026-11-18'
    fs.writeFileSync(idxFile, JSON.stringify(idx, null, 2) + '\n')
    console.log(`[strip] xiandai.json 保护期作品已移除 ${xdBefore - xd.poems.length} 条（保留公有领域 ${xd.poems.length} 条）`)

    // 中英对照：小王子（bil_007）、老人与海（bil_008）原文仍在保护期，整条删除；
    // 其余条目（原文均公有领域）删除无译者署名的中文译文
    const engDir = path.join(distDir, 'datafile', 'english')
    const biFile = path.join(engDir, 'bilingual.json')
    const bi = JSON.parse(fs.readFileSync(biFile, 'utf8'))
    const biBefore = bi.items.length
    let translations = 0
    bi.items = bi.items
        .filter(it => !['bil_007', 'bil_008'].includes(it.id))
        .map(it => {
            if ('translation' in it) { delete it.translation; translations++ }
            return it
        })
    if (bi.items.length !== biBefore - 2 || translations === 0) {
        console.error('[strip] bilingual.json 结构与预期不符，疑似数据源已变更'); process.exit(1)
    }
    bi.metadata.count = bi.items.length
    bi.metadata.name = '英文原版'
    bi.metadata.description = '世界名篇英文原文（均为公有领域作品），供背诵与阅读'
    bi.metadata.lastUpdated = '2026-11-18'
    fs.writeFileSync(biFile, JSON.stringify(bi, null, 2) + '\n')
    console.log(`[strip] bilingual.json 已移除保护期条目 2 条、无署名译文 ${translations} 段`)

    // 法文名篇：fr_002 小王子与 bilingual 被点名的是同一部作品（法国战殁作家延长保护），整节删除
    const frFile = path.join(engDir, 'french.json')
    const fr = JSON.parse(fs.readFileSync(frFile, 'utf8'))
    const frBefore = fr.items.length
    fr.items = fr.items.filter(it => it.id !== 'fr_002')
    if (fr.items.length !== frBefore - 1) {
        console.error('[strip] french.json 结构与预期不符，疑似数据源已变更'); process.exit(1)
    }
    fr.metadata.count = fr.items.length
    fr.metadata.lastUpdated = '2026-11-18'
    fs.writeFileSync(frFile, JSON.stringify(fr, null, 2) + '\n')
    console.log('[strip] french.json 已移除 fr_002（小王子，仍在保护期）')
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
    // 仍在著作权保护期的文本特征（商店包必须剥净；海子《面朝大海，春暖花开》、小王子中英/法文条目）
    '面朝大海',
    'invisible to the eye',
    'Le Petit Prince',
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
curateStoreDatafiles()
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
