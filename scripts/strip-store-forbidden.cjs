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
 * 4. 剔除无用与他端资源：未引用的 tesseract-core-simd-lstm.js / 独立 .wasm（实际只加载
 *    内嵌 wasm 的 .wasm.js），以及 Web/PWA 端资产（pwa-*.png、apple-touch-icon.png）
 * 5. 闸门：全量扫描 dist/，发现内置密钥明文、Bing 网页版接口特征、译文残留、保护期文本
 *    或指向已剔除 tesseract 文件的引用即报错退出，
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
    // 源数据可能已在上游收敛为公有领域作品（此时 0 条被删），只校验结构
    if (xd.poems.length !== XD_KEEP.size) {
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

    // 中英对照：小王子（bil_007）、老人与海（bil_008）、马丁·路德·金 1963 演说（bil_003）仍在保护期，整条删除；
    // 其余条目（原文均公有领域）删除无译者署名的中文译文
    const engDir = path.join(distDir, 'datafile', 'english')
    const biFile = path.join(engDir, 'bilingual.json')
    const bi = JSON.parse(fs.readFileSync(biFile, 'utf8'))
    const biBefore = bi.items.length
    let translations = 0
    bi.items = bi.items
        .filter(it => !['bil_003', 'bil_007', 'bil_008'].includes(it.id))
        .map(it => {
            if ('translation' in it) { delete it.translation; translations++ }
            return it
        })
    if (bi.items.some(it => ['bil_003', 'bil_007', 'bil_008'].includes(it.id)) || bi.items.some(it => 'translation' in it)) {
        console.error('[strip] bilingual.json 仍含保护期条目或无署名译文，疑似数据源已变更'); process.exit(1)
    }
    bi.metadata.count = bi.items.length
    bi.metadata.name = '英文原版'
    bi.metadata.description = '世界名篇英文原文（仅收录公有领域作品），供背诵与阅读'
    bi.metadata.lastUpdated = '2026-11-20'
    fs.writeFileSync(biFile, JSON.stringify(bi, null, 2) + '\n')
    console.log(`[strip] bilingual.json 已校验：无保护期条目、无无署名译文（本轮处理 ${translations} 段）`)

    // 法文名篇：fr_002 小王子与 bilingual 被点名的是同一部作品（法国战殁作家延长保护），整节删除
    const frFile = path.join(engDir, 'french.json')
    const fr = JSON.parse(fs.readFileSync(frFile, 'utf8'))
    const frBefore = fr.items.length
    fr.items = fr.items.filter(it => it.id !== 'fr_002')
    if (fr.items.some(it => it.id === 'fr_002')) {
        console.error('[strip] french.json 仍含 fr_002，疑似数据源已变更'); process.exit(1)
    }
    fr.metadata.count = fr.items.length
    fr.metadata.lastUpdated = '2026-11-18'
    fs.writeFileSync(frFile, JSON.stringify(fr, null, 2) + '\n')
    console.log('[strip] french.json 已移除 fr_002（小王子，仍在保护期）')
}

/**
 * 英文语料收窄（仅商店包）：审核点名仍在版权保护期、且未标注授权来源的整段正文全部删除。
 * 保留篇目均为公有领域原文（作者逝世满 70 年 / 美国 1929 年前发表）。
 */
function curateEnglishCorpus() {
    const engDir = path.join(distDir, 'datafile', 'english')

    // 演讲：MLK 1963《I Have a Dream》、肯尼迪 1961 就职演说、乔布斯 2005 斯坦福演讲、
    // 丘吉尔 1940/1941 两篇、奥巴马 2008 胜选演说、卓别林《大独裁者》1940 影片台词，整条删除；
    // 保留林肯《葛底斯堡演说》、伊丽莎白一世 1588 演讲、罗斯福 1933 就职演说（均为公有领域）
    const speechesFile = path.join(engDir, 'speeches.json')
    const sp = JSON.parse(fs.readFileSync(speechesFile, 'utf8'))
    const SP_KEEP = new Set(['eng_speech_001', 'eng_speech_007', 'eng_speech_009'])
    const spBefore = sp.items.length
    sp.items = sp.items.filter(it => SP_KEEP.has(it.id))
    // 源数据可能已在上游收敛为公有领域作品（此时 0 条被删），只校验终态
    if (sp.items.some(it => !SP_KEEP.has(it.id))) {
        console.error('[strip] speeches.json 仍含保护期篇目，疑似数据源已变更'); process.exit(1)
    }
    sp.metadata.count = sp.items.length
    sp.metadata.description = '英文演讲名篇节选；仅收录已进入公有领域的篇目'
    sp.metadata.lastUpdated = '2026-11-20'
    fs.writeFileSync(speechesFile, JSON.stringify(sp, null, 2) + '\n')

    // 散文：罗素 1967《What I Have Lived For》、E. B. White 1941《Once More to the Lake》删除；
    // 保留培根、梭罗、厄尔曼、爱默生、狄更斯（均为公有领域）
    const essaysFile = path.join(engDir, 'essays.json')
    const es = JSON.parse(fs.readFileSync(essaysFile, 'utf8'))
    const ES_REMOVE = new Set(['eng_essay_002', 'eng_essay_007'])
    const esBefore = es.items.length
    es.items = es.items.filter(it => !ES_REMOVE.has(it.id))
    if (es.items.some(it => ES_REMOVE.has(it.id))) {
        console.error('[strip] essays.json 仍含保护期篇目，疑似数据源已变更'); process.exit(1)
    }
    es.metadata.count = es.items.length
    es.metadata.description = '英美散文名篇节选；仅收录已进入公有领域的篇目'
    es.metadata.lastUpdated = '2026-11-20'
    fs.writeFileSync(essaysFile, JSON.stringify(es, null, 2) + '\n')

    // 诗歌：迪伦·托马斯 1951《Do Not Go Gentle into That Good Night》删除；
    // 其余（莎士比亚、弗罗斯特、华兹华斯、泰戈尔、爱伦·坡、拜伦、雪莱、济慈、狄金森）均为公有领域
    const poemsFile = path.join(engDir, 'poems.json')
    const po = JSON.parse(fs.readFileSync(poemsFile, 'utf8'))
    const PO_REMOVE = new Set(['eng_poem_006'])
    const poBefore = po.items.length
    po.items = po.items.filter(it => !PO_REMOVE.has(it.id))
    if (po.items.some(it => PO_REMOVE.has(it.id))) {
        console.error('[strip] poems.json 仍含保护期篇目，疑似数据源已变更'); process.exit(1)
    }
    po.metadata.count = po.items.length
    po.metadata.description = '英美诗歌名篇；仅收录已进入公有领域的篇目'
    po.metadata.lastUpdated = '2026-11-20'
    fs.writeFileSync(poemsFile, JSON.stringify(po, null, 2) + '\n')

    // 电影片段：台词与中译版权未明，商店包整文件删除（源码与其他端保留）
    const movieFile = path.join(engDir, 'movie-scripts.json')
    if (fs.existsSync(movieFile)) fs.unlinkSync(movieFile)

    console.log(
        `[strip] 英文语料已收窄：演讲 ${spBefore}→${sp.items.length}、` +
        `散文 ${esBefore}→${es.items.length}、诗歌 ${poBefore}→${po.items.length}，电影台词已删除`
    )
}

/** 商店版词库白名单：只保留考试词汇、多语言分级与核心短语；影视/口语/程序等扩展库与预生成音频不进包 */
const STORE_BANK_IDS = new Set([
    'zhongkao', 'gaokao', 'cet4', 'cet6', 'bec', 'gmat', 'gre', 'ielts', 'kaogong',
    'kaoyan', 'level4', 'level8', 'sat', 'toefl', 'ielts-topics', 'toefl-academic', 'zsb',
    'roots', 'phrasal-verbs', 'collocations', 'idioms', 'common-phrases', 'sentence-patterns',
    'jlpt-n5', 'jlpt-n4', 'jlpt-n3',
    'ru-a1', 'ru-a2', 'es-a1', 'es-a2', 'fr-a1', 'fr-a2',
])

function pruneStoreWordbanksAndAudio() {
    const dir = path.join(distDir, 'wordbanks')
    if (!fs.existsSync(dir)) {
        console.error(`[strip] 未找到 ${dir}`)
        process.exit(1)
    }
    let removed = 0
    for (const f of fs.readdirSync(dir)) {
        if (!f.endsWith('.json')) continue
        const id = f.replace(/\.json$/, '')
        if (!STORE_BANK_IDS.has(id)) {
            fs.unlinkSync(path.join(dir, f))
            removed++
        }
    }
    if (removed === 0) {
        console.error('[strip] 词库白名单未剔除任何文件，疑似目录结构已变更'); process.exit(1)
    }

    // 预生成口语音频由 edge-tts 调用微软 Edge 在线 TTS 生成，服务条款未确认允许再分发，商店包不下发
    const audioDir = path.join(distDir, 'speech-audio')
    if (fs.existsSync(audioDir)) fs.rmSync(audioDir, { recursive: true, force: true })

    // 诗词朗读音频（约 62MB）：同为 edge-tts 生成，且只有移动端引用（mobile/src/utils/poetry-audio.ts），
    // 桌面/uTools 代码无任何引用；商店包受 20MB 体积限制，不下发
    const poetryAudioDir = path.join(distDir, 'poetry-audio')
    if (fs.existsSync(poetryAudioDir)) fs.rmSync(poetryAudioDir, { recursive: true, force: true })

    console.log(`[strip] 词库已裁剪：移除 ${removed} 个扩展词库，speech-audio/ 与 poetry-audio/ 已删除`)
}


/** 无用/他端资源剔除（仅商店包）：减小发行包体积（审核建议整改） */
function stripUnusedAndWebAssets() {
    // 防线：OCR 实际加载的 tesseract-core-simd-lstm.wasm.js（内嵌 wasm）必须存在
    if (!fs.existsSync(path.join(distDir, 'tesseract-core-simd-lstm.wasm.js'))) {
        console.error('[strip] 未找到 tesseract-core-simd-lstm.wasm.js，OCR 加载链路可能已变更'); process.exit(1)
    }
    const targets = [
        // 无任何页面/脚本引用的独立 JS 封装，及其配套的独立 wasm（.wasm.js 已内嵌同一份 wasm）
        'tesseract-core-simd-lstm.js',
        'tesseract-core-simd-lstm.wasm',
        // Web/PWA 端资产，uTools 端不使用（web 构建清单见 vite.config.web.ts）
        'pwa-192.png',
        'pwa-512.png',
        'pwa-maskable-512.png',
        'apple-touch-icon.png',
    ]
    const removed = []
    for (const name of targets) {
        const p = path.join(distDir, name)
        if (fs.existsSync(p)) {
            fs.unlinkSync(p)
            removed.push(name)
        }
    }
    if (removed.length === 0) {
        console.error('[strip] 无用/他端资源一个都没剔到，疑似目录结构已变更'); process.exit(1)
    }
    console.log(`[strip] 已剔除无用/他端资源: ${removed.join(', ')}`)
}

/** 删除 NOTICE 中某个节（从节前分隔线到下一节分隔线之前） */
function removeNoticeSection(lines, titleIdx, label) {
    const isSep = (l) => /^-{5,}\s*$/.test(l)
    if (titleIdx === -1) {
        console.error(`[strip] NOTICE 未找到「${label}」，结构可能已变更`)
        process.exit(1)
    }
    let start = titleIdx
    while (start > 0 && !isSep(lines[start - 1])) start--
    start = Math.max(0, start - 1) // 含节前分隔线
    let end = titleIdx + 1
    while (end < lines.length && !isSep(lines[end])) end++
    end++ // 标题下的分隔线
    while (end < lines.length && !isSep(lines[end])) end++
    lines.splice(start, end - start)
}

/**
 * 改写 dist/NOTICE：删除 chinese-poems 译文节、重写英文语料节（与实际收录范围一致）、
 * 移除预生成音频节，并重新编号。
 */
function rewriteNotice() {
    const file = path.join(distDir, 'NOTICE')
    if (!fs.existsSync(file)) return
    const lines = fs.readFileSync(file, 'utf8').split('\n')
    const isSep = (l) => /^-{5,}\s*$/.test(l)
    const findTitle = (re) => lines.findIndex(l => re.test(l))

    // 1) chinese-poems 译文节（授权不明）
    removeNoticeSection(lines, findTitle(/Chinese poem English translations/), 'chinese-poems 译文节')

    // 2) 英文语料节：明确「仅收录公有领域原文」，与收窄后的实际收录一致
    const engIdx = findTitle(/Built-in foreign-language classics/)
    if (engIdx === -1) { console.error('[strip] NOTICE 未找到英文语料节，结构可能已变更'); process.exit(1) }
    let bodyStart = engIdx + 1
    while (bodyStart < lines.length && !isSep(lines[bodyStart])) bodyStart++
    bodyStart++ // 标题下分隔线
    let bodyEnd = bodyStart
    while (bodyEnd < lines.length && !isSep(lines[bodyEnd])) bodyEnd++
    const newBody = [
        'Used in: datafile/english/*.json (speeches, poems, essays, bilingual,',
        '         japanese, french, russian)',
        '',
        'Only public-domain English originals are included (e.g. Lincoln,',
        'Shakespeare, Shelley, Bacon, Elizabeth I, F. D. Roosevelt). Works',
        'still under copyright — modern speeches, essays and poems, and the',
        'film-quote category — are not included in this build. The bilingual',
        'category ships public-domain English originals only; no translated',
        'text is bundled without a named translator. The Japanese, French and',
        'Russian selections follow the same public-domain rule.',
        '',
        '',
    ]
    lines.splice(bodyStart, bodyEnd - bodyStart, ...newBody)

    // 3) 预生成音频节：商店包不下发 speech-audio（Edge TTS 合成，再分发条款未确认）
    removeNoticeSection(lines, findTitle(/Pre-generated speech audio/), '预生成音频节')

    // 4) 重新编号
    let n = 0
    const renumbered = lines.map(l => (/^\d+\.\s+\S/.test(l) ? `${++n}. ${l.replace(/^\d+\.\s+/, '')}` : l))
    fs.writeFileSync(file, renumbered.join('\n'))
    console.log('[strip] NOTICE 已重写（译文节删除、英文语料节更新、音频节移除）')
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
    // 教育/培训属性表述（按工具类目送审，产物中不得回潮）
    '课标',
    '人教版',
    '小学必背',
    '初中必背',
    '高中必背',
    '初中生物',
    '初中化学',
    '初中物理',
    '初中地理',
    '高中物理',
    '刷题',
    '权威词库',
    '背单词',
    'Anki 式',
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
    // 英文语料保护期篇目（审核点名，商店包必须剥净）
    'I Have a Dream',
    'Do Not Go Gentle',
    'Once More to the Lake',
    'What I Have Lived For',
    'Stay Hungry, Stay Foolish',
    'We Shall Fight on the Beaches',
    // 影视台词（词库/语料/分类引用均不应出现在商店包）
    '人生就像一盒巧克力',
    'movie-scripts.json',
    // 远程词库兜底地址（商店包只允许本地词库，不得出现任何 CDN 词库下载能力）
    'chuxiangshi2026/slowlyRecord@211ee3f',
]

// 统计端点迁移自检：STATS_ENDPOINT 一旦不再是旧统计函数域名，旧裸地址就不许残留在商店包里。
// 只匹配统计函数那台主机名（同步用的是另一台 tencentscf 函数，不能一并拦）。
// 迁移前（域名尚未接通，端点仍指向旧函数）不启用该断言，避免把外部阻塞误判成构建失败。
const OLD_STATS_HOST = '1258475269-324jnlw5kv.ap-guangzhou.tencentscf.com'
const statsConfig = fs.readFileSync(path.join(__dirname, '..', 'src', 'config.ts'), 'utf8')
if (!statsConfig.includes(`STATS_ENDPOINT = 'https://${OLD_STATS_HOST}'`)) {
    FORBIDDEN.push(OLD_STATS_HOST)
}

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
curateEnglishCorpus()
pruneStoreWordbanksAndAudio()
stripUnusedAndWebAssets()
rewriteNotice()

const hits = []
// 已剔除 tesseract 文件的残留引用（.wasm 需排除 .wasm.js 这个合法引用）
const TESSERACT_REMOVED_RE = /tesseract-core-simd-lstm\.js|tesseract-core-simd-lstm\.wasm(?!\.js)/
for (const file of walk(distDir)) {
    const content = fs.readFileSync(file) // Buffer.includes 对二进制同样安全
    if (TESSERACT_REMOVED_RE.test(content.toString('latin1'))) {
        hits.push(`${path.relative(distDir, file)} -> 已剔除的 tesseract 文件引用`)
    }
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
