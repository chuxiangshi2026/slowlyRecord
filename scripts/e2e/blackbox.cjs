/**
 * 慢记黑盒 E2E 冒烟测试（真实构建产物 + 真实 Chromium）
 *
 * 用法：
 *   npm run test:e2e                 # 默认测 dist/（uTools/Electron 同款构建）
 *   node scripts/e2e/blackbox.cjs --dist dist-web --route word,text-memory
 *
 * 做什么：
 *   1. 静态伺服构建产物，Puppeteer 无头 Chromium 逐路由真实加载（不是单元测试的 jsdom）
 *   2. 每路由收集 console error / pageerror（渲染崩溃零容忍）
 *   3. 每路由全页截图存档到 test-results/e2e/，供人工复查/比对
 *   4. 交互断言：双抽屉互斥、抽屉随路由关闭、Escape 关抽屉后页面不空白（B2 回归）
 *
 * 退出码 = 失败检查数（0 表示全部通过）。CI 可直接使用。
 */
const http = require('http')
const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const args = process.argv.slice(2)
function argVal(name, dflt) {
  const i = args.indexOf('--' + name)
  return i >= 0 ? args[i + 1] : dflt
}
const DIST = path.resolve(argVal('dist', 'dist'))
const OUT_DIR = path.resolve(argVal('out', 'test-results/e2e'))
const ROUTES = argVal('route', '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean)

// 冒烟矩阵：主路由 + 关键子路由。新增页面时在 ROUTE_MATRIX 登记并给出断言要点。
const ROUTE_MATRIX = [
  { route: 'word', expect: '单词复习主界面，页头与卡片列表可见' },
  { route: 'text-memory', expect: '文本记忆列表或空态，页头可见' },
  { route: 'number-memory', expect: '数字记忆训练入口' },
  { route: 'memory', expect: '记忆力测试' },
  { route: 'dictation', expect: '听写练习' },
  { route: 'translate', expect: '快速翻译输入区' },
  { route: 'sentences', expect: '句子库' },
  { route: 'letter-memory', expect: '字母映射' },
  { route: 'phonetic-memory', expect: '音标学习' },
  { route: 'knowledge-memory', expect: '知识库（含内置知识包）' },
  { route: 'memory-palace', expect: '记忆宫殿' },
  { route: 'word-book', expect: '词集首页、继续学习或示例词集可见' },
  { route: 'shortcut-memory', expect: '快捷键记忆' },
  { route: 'sign', expect: '打卡页' },
]

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.mp3': 'audio/mpeg',
}

function serve(root) {
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent((req.url || '/').split('?')[0])
    if (p === '/' || !path.extname(p)) p = '/index.html'
    const file = path.join(root, p)
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404)
      return res.end('not found')
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' })
    fs.createReadStream(file).pipe(res)
  })
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server)))
}

function visible(el) {
  if (!el) return false
  const r = el.getBoundingClientRect()
  const s = getComputedStyle(el)
  return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'
}

async function main() {
  if (!fs.existsSync(path.join(DIST, 'index.html'))) {
    console.error(`[e2e] 构建产物不存在：${DIST}，请先 npm run build`)
    process.exit(2)
  }
  fs.mkdirSync(OUT_DIR, { recursive: true })

  let puppeteer
  try {
    puppeteer = require('puppeteer')
  } catch {
    console.error('[e2e] 未安装 puppeteer')
    process.exit(2)
  }

  const server = await serve(DIST)
  const port = server.address().port
  const base = `http://127.0.0.1:${port}/index.html`

  // 浏览器选择：--chrome 参数 > PUPPETEER_EXECUTABLE_PATH 环境变量 > puppeteer 自带 Chromium
  // WSL 下若自带 Chromium 未安装，可指向 Windows 浏览器，例如：
  //   node scripts/e2e/blackbox.cjs --chrome /mnt/c/Program\ Files\ \(x86\)/Microsoft/Edge/Application/msedge.exe
  const executablePath = argVal('chrome', process.env.PUPPETEER_EXECUTABLE_PATH || undefined)
  let browser
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      executablePath,
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    })
  } catch (e) {
    console.error('[e2e] Chromium 启动失败：' + e.message)
    console.error('[e2e] 可先执行：npx puppeteer browsers install chrome')
    console.error('[e2e] 或用 --chrome /环境变量 PUPPETEER_EXECUTABLE_PATH 指定系统浏览器')
    server.close()
    process.exit(2)
  }

  const page = await browser.newPage()
  await page.setViewport({ width: 1280, height: 800 })

  const consoleErrors = []
  const pageErrors = []
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text().slice(0, 300))
  })
  page.on('pageerror', err => pageErrors.push(String(err).slice(0, 300)))

  const results = []
  const check = (name, ok, detail) => {
    results.push({ name, ok, detail })
    console.log(`${ok ? '  ✓' : '  ✗'} ${name}${detail ? ' — ' + detail : ''}`)
  }

  const routes = ROUTES.length ? ROUTES : ROUTE_MATRIX.map(r => r.route)
  const routeExpect = Object.fromEntries(ROUTE_MATRIX.map(r => [r.route, r.expect]))

  console.log(`\n[e2e] 构建产物：${DIST}`)
  console.log(`[e2e] 截图存档：${OUT_DIR}\n`)

  // ── 第一部分：逐路由冒烟（加载 / 非空白 / 截图 / 渲染错误）────────────
  for (const route of routes) {
    consoleErrors.length = 0
    pageErrors.length = 0
    await page.goto(`${base}#/${route}`, { waitUntil: 'networkidle2', timeout: 30000 }).catch(e => {
      pageErrors.push('goto: ' + e.message)
    })
    await new Promise(r => setTimeout(r, 1200))

    const probe = await page.evaluate(() => {
      const header = document.querySelector('.el-header')
      return {
        bodyTextLen: (document.body.innerText || '').trim().length,
        headerVisible: !!header && header.getBoundingClientRect().height > 0,
        appChildren: document.querySelector('#app')?.children.length ?? 0,
      }
    })

    const shot = path.join(OUT_DIR, `${route.replace(/\//g, '_')}.png`)
    await page.screenshot({ path: shot, fullPage: false })

    check(`${route}: 页面非空白`, probe.bodyTextLen > 0, `正文字数=${probe.bodyTextLen}`)
    check(`${route}: 页头存在`, probe.headerVisible, routeExpect[route] || '')
    check(`${route}: 无渲染崩溃`, pageErrors.length === 0, pageErrors[0] || '')
    if (consoleErrors.length) {
      // console.error 记为警告不判死：第三方组件（TTS/剪贴板）在 headless 下可能告警
      results.push({ name: `${route}: console.error`, ok: true, detail: consoleErrors[0] || '' })
      console.log(`  ⚠ ${route}: console.error ×${consoleErrors.length}（警告）首条：${consoleErrors[0]}`)
    }
  }

  // ── 第二部分：交互断言（回归已修缺陷 + 守卫未修缺陷）────────────────
  console.log('\n[e2e] 交互断言')

  // F1 回归：双抽屉互斥 —— 打开设置抽屉后再开「更多」抽屉，可见抽屉数必须 ≤ 1
  await page.goto(`${base}#/word`, { waitUntil: 'networkidle2' })
  await new Promise(r => setTimeout(r, 1000))
  await page.evaluate(() => {
    const h = [...document.querySelectorAll('.el-header span, .el-header div, .el-header button')]
    h.find(el => (el.textContent || '').trim() === '⋯')?.click()
  })
  await new Promise(r => setTimeout(r, 700))
  await page.evaluate(() => {
    const h = [...document.querySelectorAll('.el-header span, .el-header div, .el-header button')]
    h.find(el => (el.textContent || '').trim() === '☰')?.click()
  })
  await new Promise(r => setTimeout(r, 700))
  const drawerCount = await page.evaluate(() => {
    const drawers = [...document.querySelectorAll('.el-drawer')]
    return drawers.filter(d => {
      const r = d.getBoundingClientRect()
      const s = getComputedStyle(d)
      return r.width > 50 && s.display !== 'none' && s.visibility !== 'hidden'
    }).length
  })
  check('F1: 双抽屉互斥（同时只可见一个）', drawerCount <= 1, `可见抽屉数=${drawerCount}`)
  await page.screenshot({ path: path.join(OUT_DIR, 'interaction-drawer-mutex.png') })

  // F2 回归：抽屉不跨路由保持 —— 开着抽屉切路由，抽屉必须关闭
  await page.evaluate(() => {
    const h = [...document.querySelectorAll('.el-header span, .el-header div, .el-header button')]
    h.find(el => (el.textContent || '').trim() === '☰')?.click()
  })
  await new Promise(r => setTimeout(r, 700))
  await page.evaluate(() => { location.hash = '#/text-memory' })
  await new Promise(r => setTimeout(r, 1500))
  const drawerAfterRoute = await page.evaluate(() => {
    const drawers = [...document.querySelectorAll('.el-drawer')]
    return drawers.filter(d => {
      const r = d.getBoundingClientRect()
      const s = getComputedStyle(d)
      return r.width > 50 && s.display !== 'none' && s.visibility !== 'hidden'
    }).length
  })
  check('F2: 抽屉随路由关闭', drawerAfterRoute === 0, `路由切换后可见抽屉数=${drawerAfterRoute}`)
  await page.screenshot({ path: path.join(OUT_DIR, 'interaction-drawer-route.png') })

  // B2 回归守卫：抽屉打开 → Escape → 页头仍在、页面不空白
  await page.evaluate(() => { location.hash = '#/word' })
  await new Promise(r => setTimeout(r, 1500))
  await page.evaluate(() => {
    const h = [...document.querySelectorAll('.el-header span, .el-header div, .el-header button')]
    h.find(el => (el.textContent || '').trim() === '☰')?.click()
  })
  await new Promise(r => setTimeout(r, 700))
  await page.keyboard.press('Escape')
  await new Promise(r => setTimeout(r, 900))
  const afterEsc = await page.evaluate(() => ({
    bodyTextLen: (document.body.innerText || '').trim().length,
    headerVisible: !!document.querySelector('.el-header') && document.querySelector('.el-header').getBoundingClientRect().height > 0,
  }))
  check('B2 守卫: Escape 关抽屉后页面不空白', afterEsc.bodyTextLen > 0 && afterEsc.headerVisible, JSON.stringify(afterEsc))
  await page.screenshot({ path: path.join(OUT_DIR, 'interaction-escape.png') })

  // ── 汇总 ──────────────────────────────────────────────────────────
  const failed = results.filter(r => !r.ok)
  fs.writeFileSync(
    path.join(OUT_DIR, 'report.json'),
    JSON.stringify({ at: new Date().toISOString(), dist: DIST, results }, null, 2)
  )
  console.log(`\n[e2e] 通过 ${results.length - failed.length}/${results.length}，报告已写入 ${path.join(OUT_DIR, 'report.json')}`)

  await browser.close()
  server.close()
  process.exit(Math.min(failed.length, 99))
}

main().catch(e => {
  console.error('[e2e] 执行异常：', e)
  process.exit(2)
})
