/**
 * Electron 黑盒 E2E（真实打包主进程 + Playwright _electron 驱动）
 *
 * 用法：
 *   npm run test:e2e:electron        # xvfb 虚拟屏下驱动 dist-electron（不弹真窗口）
 *   node scripts/e2e/electron.cjs --main dist-electron/main.js --out test-results/e2e-electron
 *
 * 做什么：
 *   1. 用 Playwright _electron 以生产模式启动 dist-electron/main.js（loadFile 真实产物）
 *   2. 断言主窗口出现、页面渲染非空白、无 pageerror
 *   3. hash 路由导航冒烟（dictation / selftest 诊断页 JSON 断言）
 *   4. 截图存档并优雅退出
 *
 * 退出码 = 失败检查数（0 表示全部通过）。
 */
const path = require('path')
const fs = require('fs')

const args = process.argv.slice(2)
function argVal(name, dflt) {
  const i = args.indexOf('--' + name)
  return i >= 0 ? args[i + 1] : dflt
}
const MAIN = path.resolve(argVal('main', 'dist-electron/main.js'))
const OUT_DIR = path.resolve(argVal('out', 'test-results/e2e-electron'))

// 逐路由断言要点（与 blackbox.cjs 的 ROUTE_MATRIX 口径一致）
const ROUTES = [
  { route: 'word', expect: '单词复习主界面' },
  { route: 'dictation', expect: '听写练习' },
  { route: 'selftest', expect: '诊断页自检 JSON' },
]

async function main() {
  if (!fs.existsSync(MAIN)) {
    console.error(`[e2e-electron] 主进程不存在：${MAIN}，请先 npm run build:electron`)
    process.exit(2)
  }
  fs.mkdirSync(OUT_DIR, { recursive: true })

  let playwrightCore
  try {
    playwrightCore = require('playwright-core')
  } catch {
    console.error('[e2e-electron] 未安装 playwright-core：npm i -D playwright-core')
    process.exit(2)
  }
  const { _electron: electron } = playwrightCore

  // 直接用项目依赖里的 Electron 二进制，避免 playwright 再次下载
  const electronBin = path.join(__dirname, '../../node_modules/electron/dist/electron')

  const results = []
  const check = (name, ok, detail) => {
    results.push({ name, ok, detail })
    console.log(`${ok ? '  ✓' : '  ✗'} ${name}${detail ? ' — ' + detail : ''}`)
  }

  console.log(`\n[e2e-electron] 主进程：${MAIN}`)
  console.log(`[e2e-electron] 截图存档：${OUT_DIR}\n`)

  const app = await electron.launch({
    executablePath: fs.existsSync(electronBin) ? electronBin : undefined,
    args: [MAIN, '--no-sandbox', '--disable-gpu'],
    timeout: 60000,
  })

  const pageErrors = []
  let win
  try {
    win = await app.firstWindow()
    win.on('pageerror', err => pageErrors.push(String(err).slice(0, 300)))
    await win.waitForLoadState('domcontentloaded', { timeout: 30000 })
    await new Promise(r => setTimeout(r, 2500))

    const probe = await win.evaluate(() => ({
      url: location.href,
      bodyTextLen: (document.body.innerText || '').trim().length,
      appChildren: document.querySelector('#app')?.children.length ?? 0,
    }))
    check('Electron: 主窗口出现且页面非空白', probe.bodyTextLen > 0 && probe.appChildren > 0, JSON.stringify(probe))
    await win.screenshot({ path: path.join(OUT_DIR, 'electron-first-window.png') })

    for (const { route, expect } of ROUTES) {
      pageErrors.length = 0
      await win.evaluate(h => { location.hash = `#/${h}` }, route)
      await new Promise(r => setTimeout(r, 2000))
      const p = await win.evaluate(() => ({
        hash: location.hash,
        bodyTextLen: (document.body.innerText || '').trim().length,
      }))
      let ok = p.bodyTextLen > 0 && p.hash === `#/${route}`
      let detail = JSON.stringify(p)
      if (route === 'selftest') {
        const st = await win.evaluate(() => {
          const el = document.querySelector('.selftest')
          let platform = null
          try { platform = JSON.parse(el?.textContent || 'null')?.platform ?? null } catch {}
          return platform
        })
        ok = ok && !!st
        detail = `platform=${st}`
      }
      check(`Electron: ${route} 导航非空白${expect ? `（${expect}）` : ''}`, ok, detail)
      await win.screenshot({ path: path.join(OUT_DIR, `electron-${route.replace(/\//g, '_')}.png`) })
      check(`Electron: ${route} 无渲染崩溃`, pageErrors.length === 0, pageErrors[0] || '')
    }
  } catch (e) {
    check('Electron: 启动/执行', false, String(e).slice(0, 300))
  } finally {
    await win?.screenshot({ path: path.join(OUT_DIR, 'electron-final.png') }).catch(() => {})
    await app.close().catch(() => {})
  }

  const failed = results.filter(r => !r.ok)
  fs.writeFileSync(
    path.join(OUT_DIR, 'report.json'),
    JSON.stringify({ at: new Date().toISOString(), main: MAIN, results }, null, 2)
  )
  console.log(`\n[e2e-electron] 通过 ${results.length - failed.length}/${results.length}，报告已写入 ${path.join(OUT_DIR, 'report.json')}`)
  process.exit(Math.min(failed.length, 99))
}

main().catch(e => {
  console.error('[e2e-electron] 执行异常：', e)
  process.exit(2)
})
