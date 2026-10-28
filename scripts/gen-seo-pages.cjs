/**
 * 生成 Web 端静态内容页（P1 试点）。
 *
 * 用法：
 *   node scripts/gen-seo-pages.cjs
 *   SITE_ORIGIN=https://example.com node scripts/gen-seo-pages.cjs
 *
 * 产物写入 dist-web/：/library.html、/wordbank/<id>.html、/poem/<id>.html、
 * /sitemap.xml、/robots.txt。没有 SITE_ORIGIN 时 canonical 用相对路径、sitemap
 * 不写绝对地址；正式部署前应设置 SITE_ORIGIN。
 *
 * 试点范围刻意收窄：只发布 8 个考试词库和 22 首公版诗词；不生成 7 万单词页，
 * 不渲染 64 首第三方英译，也不发布电影台词/名言等权属未确认内容。
 */
const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const DIST = path.join(ROOT, 'dist-web')
const ORIGIN = (process.env.SITE_ORIGIN || '').replace(/\/+$/, '')
const PREVIEW_WORDS = 100

const BANKS = [
  { id: 'zhongkao', name: '中考词汇', desc: '初中课标核心词汇（中考）' },
  { id: 'gaokao', name: '高考词汇', desc: '高中课标 3500 词汇（高考）' },
  { id: 'cet4', name: '四级词汇', desc: '大学英语四级核心词汇' },
  { id: 'cet6', name: '六级词汇', desc: '大学英语六级核心词汇' },
  { id: 'bec', name: '商务英语', desc: '商务英语考试核心词汇' },
  { id: 'level4', name: '专业四级', desc: '英语专业四级核心词汇' },
  { id: 'level8', name: '专业八级', desc: '英语专业八级核心词汇' },
  { id: 'sat', name: 'SAT 词汇', desc: 'SAT 考试核心词汇' },
  { id: 'kaoyan', name: '考研词汇', desc: '研究生入学考试核心词汇' },
  { id: 'ielts', name: '雅思词汇', desc: '雅思考试核心词汇' },
  { id: 'toefl', name: '托福词汇', desc: '托福考试核心词汇' },
  { id: 'gre', name: 'GRE 词汇', desc: 'GRE 考试核心词汇' },
]

const POEM_IDS = [
  'tang_001', 'tang_003', 'tang_005', 'tang_006', 'tang_009', 'tang_010',
  'tang_035', 'tang_042', 'tang_048', 'tang_054',
  'song_001', 'song_002', 'song_007', 'song_038', 'song_040', 'song_063',
  'xianqin_001', 'xianqin_002', 'han_002', 'han_003', 'yuan_001', 'weijin_001',
]

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[ch]))

const urlFor = (p) => (ORIGIN ? `${ORIGIN}${p}` : p)

const readJson = (rel) => JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'))

const fileDate = (rel) => new Date(fs.statSync(path.join(ROOT, rel)).mtimeMs).toISOString().slice(0, 10)

function loadPoems() {
  const poems = []
  const files = fs.readdirSync(path.join(ROOT, 'public/datafile/poetry')).filter(f => f.endsWith('.json'))
  for (const file of files) {
    const data = readJson(`public/datafile/poetry/${file}`)
    if (!data || !Array.isArray(data.poems)) continue
    for (const poem of data.poems) poems.push({ ...poem, _file: `public/datafile/poetry/${file}` })
  }
  return poems
}

const CSS = `
:root{color-scheme:light dark;--bg:#eaf1ea;--card:#fff;--text:#2f3e39;--muted:#60716a;--line:#dbe6df;--primary:#52796f}
@media(prefers-color-scheme:dark){:root{--bg:#18211e;--card:#202b27;--text:#e3ece7;--muted:#a3b4ac;--line:#324039;--primary:#83c5a8}}
*{box-sizing:border-box}body{margin:0;padding:28px 16px 56px;background:var(--bg);color:var(--text);font:15px/1.75 -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif}
main{max-width:860px;margin:0 auto;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:30px 26px}
a{color:var(--primary)}h1{font-size:26px;line-height:1.3;margin:0 0 6px}h2{font-size:17px;margin:28px 0 10px;color:var(--primary)}
.meta,.muted{color:var(--muted);font-size:13px}.crumbs{font-size:13px;margin-bottom:18px}.crumbs a{text-decoration:none}
.cta{display:inline-block;margin:16px 0 4px;padding:9px 16px;border-radius:8px;background:var(--primary);color:#fff;text-decoration:none;font-size:14px}
.tags{margin:12px 0}.tag{display:inline-block;margin:0 6px 6px 0;padding:2px 8px;border:1px solid var(--line);border-radius:999px;font-size:12px;color:var(--muted)}
table{width:100%;border-collapse:collapse;font-size:14px}th,td{text-align:left;padding:7px 8px;border-bottom:1px solid var(--line);vertical-align:top}
th{color:var(--muted);font-weight:500}.word{font-weight:600;white-space:nowrap}.phonetic{color:var(--muted);font-size:13px;white-space:nowrap}
.verse{margin:16px 0 6px}.line{padding:4px 0}.py{display:block;color:var(--muted);font-size:12px;letter-spacing:.02em}.txt{display:block;font-size:18px;line-height:1.9}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px}.card{display:block;padding:12px;border:1px solid var(--line);border-radius:10px;text-decoration:none;color:var(--text)}
.card strong{display:block;font-size:14px}.card span{display:block;color:var(--muted);font-size:12px;margin-top:2px}
footer{margin-top:30px;padding-top:14px;border-top:1px solid var(--line);color:var(--muted);font-size:12px}
footer a{color:var(--muted)}
`

function layout({ title, description, canonicalPath, body, jsonLd }) {
  const canonical = urlFor(canonicalPath)
  const ld = jsonLd
    ? `<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>`
    : ''
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${esc(title)} - 慢记</title>
<meta name="description" content="${esc(description)}">
<meta name="robots" content="index,follow">
<link rel="canonical" href="${esc(canonical)}">
<meta property="og:type" content="article">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(canonical)}">
<style>${CSS}</style>${ld}
</head>
<body><main>
<div class="crumbs"><a href="${esc(urlFor('/library.html'))}">内容索引</a> / 慢记</div>
${body}
<footer>慢记是本地优先的间隔重复记忆工具。内容问题请到
<a href="https://github.com/chuxiangshi2026/slowlyRecord/issues" target="_blank" rel="noopener">GitHub Issues</a> 反馈；
<a href="${esc(urlFor('/privacy.html'))}">隐私说明</a>。</footer>
</main></body></html>`
}

function appLink(page, hash) {
  return `${urlFor('/')}?from=seo&page=${encodeURIComponent(page)}${hash}`
}

function wordbankPage(bank, words) {
  const total = words.length
  const preview = words.slice(0, PREVIEW_WORDS)
  const pathName = `/wordbank/${bank.id}.html`
  const title = `${bank.name}表（${total} 词）`
  const description = `${bank.desc}，共 ${total} 词。本页预览前 ${Math.min(PREVIEW_WORDS, total)} 个词，可在慢记中导入完整词库并按遗忘曲线复习。`
  const rows = preview.map(w => `<tr><td class="word">${esc(w.word)}</td><td class="phonetic">${esc(w.phonetic || '')}</td><td>${esc(w.explains || '')}</td></tr>`).join('\n')
  const related = BANKS.filter(b => b.id !== bank.id).map(b =>
    `<a class="card" href="./${b.id}.html"><strong>${esc(b.name)}</strong><span>${esc(b.desc)}</span></a>`
  ).join('')
  const body = `
<h1>${esc(title)}</h1>
<p class="meta">${esc(bank.desc)} · 共 ${total} 词</p>
<p>${esc(bank.desc)}。完整词库包含 ${total} 条词条；下面预览前 ${Math.min(PREVIEW_WORDS, total)} 条，按字母或原始顺序排列。</p>
<a class="cta" href="${esc(appLink(`wordbank-${bank.id}`, `#/word?builtin=${encodeURIComponent(bank.id)}`))}">在慢记中导入 ${esc(bank.name)}</a>
<p class="muted">导入前会展示词库预览，由你确认后才写入本地。</p>
<h2>词表预览</h2>
<table><thead><tr><th>单词</th><th>音标</th><th>释义</th></tr></thead><tbody>${rows}</tbody></table>
<h2>其他考试词库</h2>
<div class="grid">${related}</div>`
  return {
    path: pathName,
    html: layout({
      title, description, canonicalPath: pathName, body,
      jsonLd: {
        '@context': 'https://schema.org', '@type': 'ItemList',
        name: title, numberOfItems: total,
        itemListElement: preview.slice(0, 20).map((w, i) => ({
          '@type': 'ListItem', position: i + 1, name: w.word,
        })),
      },
    }),
    lastmod: fileDate(`public/wordbanks/${bank.id}.json`),
  }
}

function poemPage(poem, allPoems) {
  const pathName = `/poem/${poem.id}.html`
  const contentLines = String(poem.content || '').split('\n')
  const pinyinLines = String(poem.pinyin || '').split('\n')
  const verse = contentLines.map((line, i) => {
    const py = pinyinLines[i] || ''
    return `<div class="line"><span class="py">${esc(py)}</span><span class="txt">${esc(line)}</span></div>`
  }).join('\n')
  const tags = (poem.tags || []).slice(0, 8).map(t => `<span class="tag">${esc(t)}</span>`).join('')
  const description = `${poem.dynasty || ''}${poem.author || ''}《${poem.title || ''}》原文与拼音：${String(poem.content || '').replace(/\s+/g, ' ').slice(0, 70)}`
  const sameDynasty = allPoems.filter(p => p.dynastyCode === poem.dynastyCode && p.id !== poem.id).slice(0, 8)
  const related = sameDynasty.map(p =>
    `<a class="card" href="./${p.id}.html"><strong>${esc(p.title)}</strong><span>${esc(p.author)} · ${esc(p.dynasty)}</span></a>`
  ).join('')
  const body = `
<h1>${esc(poem.title)}</h1>
<p class="meta">${esc(poem.author)} · ${esc(poem.dynasty)}${poem.year ? ` · 约 ${esc(poem.year)} 年` : ''}${poem.source ? ` · 出处：${esc(poem.source)}` : ''}</p>
<div class="tags">${tags}</div>
<div class="verse">${verse}</div>
<a class="cta" href="${esc(appLink(`poem-${poem.id}`, '#/text-memory'))}">在慢记中背诵这首诗词</a>
<p class="muted">拼音由慢记生成；本站暂不发布第三方英译。</p>
${related ? `<h2>同朝代诗词</h2><div class="grid">${related}</div>` : ''}`
  return {
    path: pathName,
    html: layout({
      title: `${poem.title} - ${poem.author}`,
      description, canonicalPath: pathName, body,
      jsonLd: {
        '@context': 'https://schema.org', '@type': 'CreativeWork',
        name: poem.title, author: { '@type': 'Person', name: poem.author },
        inLanguage: 'zh-CN', text: String(poem.content || '').slice(0, 500),
      },
    }),
    lastmod: fileDate(poem._file),
  }
}

function libraryPage(bankPages, poemPages) {
  const banks = bankPages.map(p =>
    `<a class="card" href="./wordbank/${p.bank.id}.html"><strong>${esc(p.bank.name)}</strong><span>${p.count} 词 · ${esc(p.bank.desc)}</span></a>`
  ).join('')
  const byDynasty = new Map()
  for (const p of poemPages) {
    const key = p.poem.dynasty || '其他'
    if (!byDynasty.has(key)) byDynasty.set(key, [])
    byDynasty.get(key).push(p)
  }
  const poems = [...byDynasty.entries()].map(([dynasty, list]) => `
<h2>${esc(dynasty)}</h2>
<div class="grid">${list.map(p =>
    `<a class="card" href="./poem/${p.poem.id}.html"><strong>${esc(p.poem.title)}</strong><span>${esc(p.poem.author)}</span></a>`
  ).join('')}</div>`).join('')
  const body = `
<h1>词库与诗词索引</h1>
<p class="meta">考试词库与公版诗词的静态索引，方便不安装应用时直接查看。</p>
<a class="cta" href="${esc(appLink('library', '#/word'))}">打开慢记</a>
<h2>考试词库</h2><div class="grid">${banks}</div>
${poems}`
  return layout({
    title: '词库与诗词索引', description: '慢记内置考试词库与公版诗词索引，包含四六级、考研、雅思、托福、GRE 和唐诗宋词等。',
    canonicalPath: '/library.html', body,
  })
}

function write(rel, content) {
  const target = path.join(DIST, rel)
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.writeFileSync(target, content)
}

function main() {
  if (!fs.existsSync(DIST)) {
    console.error('dist-web 不存在，请先执行 npm run build:web 的 vite build 步骤')
    process.exit(1)
  }

  const entries = []
  const bankPages = []
  for (const bank of BANKS) {
    const rel = `public/wordbanks/${bank.id}.json`
    if (!fs.existsSync(path.join(ROOT, rel))) {
      console.warn(`跳过缺失词库: ${bank.id}`)
      continue
    }
    const words = readJson(rel)
    const page = wordbankPage(bank, words)
    write(`wordbank/${bank.id}.html`, page.html)
    entries.push({ loc: page.path, lastmod: page.lastmod })
    bankPages.push({ bank, count: words.length })
  }

  const allPoems = loadPoems()
  const byId = new Map(allPoems.map(p => [p.id, p]))
  const selectedPoems = POEM_IDS.map(id => byId.get(id)).filter(Boolean)
  const poemPages = []
  for (const poem of selectedPoems) {
    const page = poemPage(poem, selectedPoems)
    write(`poem/${poem.id}.html`, page.html)
    entries.push({ loc: page.path, lastmod: page.lastmod })
    poemPages.push({ poem, count: 1 })
  }

  const library = libraryPage(bankPages, poemPages)
  write('library.html', library)
  entries.unshift({ loc: '/library.html', lastmod: new Date().toISOString().slice(0, 10) })

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.map(e =>
    `  <url><loc>${esc(urlFor(e.loc))}</loc><lastmod>${e.lastmod}</lastmod></url>`
  ).join('\n')}\n</urlset>\n`
  write('sitemap.xml', sitemap)
  write('robots.txt', `User-agent: *\nAllow: /\n${ORIGIN ? `Sitemap: ${ORIGIN}/sitemap.xml\n` : ''}`)

  console.log(`静态页生成完成：${bankPages.length} 个词库页、${poemPages.length} 个诗词页、1 个索引页`)
  console.log(`canonical/sitemap 域名：${ORIGIN || '未设置 SITE_ORIGIN（使用相对路径，正式部署前请设置）'}`)
}

main()
