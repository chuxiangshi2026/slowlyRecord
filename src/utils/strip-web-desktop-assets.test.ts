/**
 * W5 回归：Web 产物必须剔除桌面专属浮窗页（focus.html / input-method-helper.html），
 * 防止公网直接访问同源浮窗页读取主应用 localStorage（含 API 密钥明文）。
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
// @ts-ignore 构建脚本为 CJS，无类型声明
import { stripDesktopAssets, DESKTOP_ONLY_PAGES } from '../../scripts/strip-web-desktop-assets.cjs'

describe('stripDesktopAssets', () => {
  let distDir: string

  beforeEach(() => {
    distDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sr-strip-'))
  })

  afterEach(() => {
    fs.rmSync(distDir, { recursive: true, force: true })
  })

  it('删除桌面专属浮窗页，保留其它产物', () => {
    for (const name of DESKTOP_ONLY_PAGES) fs.writeFileSync(path.join(distDir, name), '<html></html>')
    fs.writeFileSync(path.join(distDir, 'index.html'), '<html>app</html>')
    fs.mkdirSync(path.join(distDir, 'assets'))
    fs.writeFileSync(path.join(distDir, 'assets', 'app-abc.js'), '/* js */')

    const removed = stripDesktopAssets(distDir)

    expect(removed.sort()).toEqual([...DESKTOP_ONLY_PAGES].sort())
    for (const name of DESKTOP_ONLY_PAGES) {
      expect(fs.existsSync(path.join(distDir, name))).toBe(false)
    }
    expect(fs.existsSync(path.join(distDir, 'index.html'))).toBe(true)
    expect(fs.existsSync(path.join(distDir, 'assets', 'app-abc.js'))).toBe(true)
  })

  it('文件不存在时幂等返回空数组', () => {
    expect(stripDesktopAssets(distDir)).toEqual([])
  })

  it('同名目录不会被误删', () => {
    fs.mkdirSync(path.join(distDir, 'focus.html'))

    const removed = stripDesktopAssets(distDir)

    expect(removed).toEqual([])
    expect(fs.statSync(path.join(distDir, 'focus.html')).isDirectory()).toBe(true)
  })
})
