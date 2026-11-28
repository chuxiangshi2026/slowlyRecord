/**
 * 微信小程序模拟器黑盒 E2E（微信开发者工具自动化 + miniprogram-automator）
 *
 * 前置（一次性，Windows 侧）：
 *   1. 微信开发者工具已安装并登录
 *   2. 设置 → 安全 → 服务端口开启
 *   3. 以自动化模式启动（本仓库产物已复制到 Windows 临时目录）：
 *      powershell.exe -NoProfile -Command '& "D:\Program Files (x86)\Tencent\微信web开发者工具\cli.bat" auto --project "C:\Users\skj\AppData\Local\Temp\slowlyrecord-mp-e2e" --auto-port 9420 --trust-project'
 *
 * 用法：
 *   node scripts/e2e/miniprogram.cjs [--ws ws://127.0.0.1:9420] [--out test-results/e2e-miniprogram]
 *
 * 覆盖：主包页面渲染/导航冒烟 + 分包（工具/记忆/数据/知识）按需 reLaunch + 截图存档。
 * 相机/相册/录音等真机授权场景不在模拟器覆盖范围（见 docs 巡检清单 MP06-08）。
 *
 * 退出码 = 失败检查数（0 表示全部通过）。
 */
const fs = require('fs')
const path = require('path')

const args = process.argv.slice(2)
function argVal(name, dflt) {
  const i = args.indexOf('--' + name)
  return i >= 0 ? args[i + 1] : dflt
}
const WS = argVal('ws', 'ws://127.0.0.1:9420')
const OUT_DIR = path.resolve(argVal('out', 'test-results/e2e-miniprogram'))

// 逐页断言：主包 4 页 + 分包各挑 1 个代表页（分包加载真实走通）
const PAGES = [
  { route: '/pages/index/index', expect: '首页' },
  { route: '/pages/words/words', expect: '单词列表' },
  { route: '/pages/review/review', expect: '复习' },
  { route: '/pages/profile/profile', expect: '我的' },
  { route: '/subPackages/pages-tools/dictation/dictation', expect: '听写工具' },
  { route: '/subPackages/pages-memory/text-memory/text-memory', expect: '文本记忆' },
  { route: '/subPackages/pages-data/signin/signin', expect: '打卡数据' },
  { route: '/subPackages/pages-knowledge/knowledge-list', expect: '知识库列表' },
]

async function main() {
  let automator
  try {
    automator = require('miniprogram-automator')
  } catch {
    console.error('[e2e-mp] 未安装 miniprogram-automator：npm i -D miniprogram-automator')
    process.exit(2)
  }
  fs.mkdirSync(OUT_DIR, { recursive: true })

  const results = []
  const check = (name, ok, detail) => {
    results.push({ name, ok, detail })
    console.log(`${ok ? '  ✓' : '  ✗'} ${name}${detail ? ' — ' + detail : ''}`)
  }

  console.log(`\n[e2e-mp] 连接：${WS}`)
  console.log(`[e2e-mp] 截图存档：${OUT_DIR}\n`)

  let mp
  try {
    mp = await automator.connect({ wsEndpoint: WS })
  } catch (e) {
    console.error(`[e2e-mp] 连接失败：${e.message}`)
    console.error('[e2e-mp] 请确认开发者工具已以自动化模式启动（见文件头部前置说明）')
    process.exit(2)
  }

  try {
    // 系统信息：连接即证明逻辑层存活
    const sys = await mp.systemInfo()
    check('MP: 连接成功且逻辑层存活', !!(sys.sdkVersion || sys.SDKVersion),
      `SDK=${sys.SDKVersion || sys.sdkVersion} 平台=${sys.platform}`)

    for (const { route, expect } of PAGES) {
      let page = null
      let err = ''
      try {
        page = await mp.reLaunch(route)
        await new Promise(r => setTimeout(r, 1800))
      } catch (e) {
        err = String(e).slice(0, 200)
      }
      const cur = await mp.currentPage().catch(() => null)
      const expected = route.replace(/^\//, '')
      // 模拟器全新 storage 首次进入首页会被 onboarding 引导页接管（正确产品行为）
      const pathOk = !!cur && (cur.path === expected ||
        (expected === 'pages/index/index' && cur.path === 'pages/onboarding/onboarding'))
      let elCount = 0
      if (cur) elCount = (await cur.$$('view')).length + (await cur.$$('text')).length
      check(`MP: ${route} 可加载且非空（${expect}）`, pathOk && elCount > 0,
        pathOk ? `元素数=${elCount}` : (err || `实际=${cur && cur.path}`))
      await mp.screenshot({ path: path.join(OUT_DIR, `mp${route.replace(/\//g, '_')}.png`) }).catch(() => {})
    }
  } catch (e) {
    check('MP: 执行', false, String(e).slice(0, 300))
  } finally {
    try { await mp.disconnect() } catch {}
  }

  const failed = results.filter(r => !r.ok)
  fs.writeFileSync(
    path.join(OUT_DIR, 'report.json'),
    JSON.stringify({ at: new Date().toISOString(), ws: WS, results }, null, 2)
  )
  console.log(`\n[e2e-mp] 通过 ${results.length - failed.length}/${results.length}，报告已写入 ${path.join(OUT_DIR, 'report.json')}`)
  process.exit(Math.min(failed.length, 99))
}

main().catch(e => {
  console.error('[e2e-mp] 执行异常：', e)
  process.exit(2)
})
