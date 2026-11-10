/**
 * Web 构建后处理：剔除桌面端专属浮窗页。
 *
 * focus.html / input-method-helper.html 是 uTools/Electron 桌面浮窗，随 public/ 原样
 * 拷入 dist-web 会被公网直接访问：二者与主应用同源，focus.html 能读到主应用
 * localStorage（words-store，含用户配置的 API 密钥明文），还会通过
 * slowly-record-focus-mode-action 通道向其它标签页广播动作。
 * Web 产物不应包含它们。
 *
 * 用法：
 *   node scripts/strip-web-desktop-assets.cjs [distDir]   # 默认 ../dist-web（相对本脚本）
 */
const fs = require('fs')
const path = require('path')

/** 仅这些文件允许从 Web 产物删除；目录、其它文件一律不动 */
const DESKTOP_ONLY_PAGES = ['focus.html', 'input-method-helper.html']

function stripDesktopAssets(distDir) {
  const removed = []
  for (const name of DESKTOP_ONLY_PAGES) {
    const target = path.join(distDir, name)
    // 只删精确文件，绝不碰目录或前缀相似的其它资源
    if (!fs.existsSync(target)) continue
    const stat = fs.statSync(target)
    if (!stat.isFile()) continue
    fs.rmSync(target)
    removed.push(name)
  }
  return removed
}

function main() {
  const distDir = path.resolve(__dirname, '..', process.argv[2] || 'dist-web')
  const removed = stripDesktopAssets(distDir)
  if (removed.length) {
    console.log(`[strip-web-desktop-assets] 已剔除桌面专属页面: ${removed.join(', ')}`)
  } else {
    console.log('[strip-web-desktop-assets] 无需剔除（文件不存在）')
  }
}

if (require.main === module) {
  main()
}

module.exports = { stripDesktopAssets, DESKTOP_ONLY_PAGES }
