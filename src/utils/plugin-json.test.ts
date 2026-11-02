/**
 * plugin.json 守门测试
 *
 * uTools 的功能入口（关键词、超级面板 over 动作、截图/划词等）全部由 plugin.json 的
 * features 声明，代码里再完整，声明丢了入口就消失，而且没有任何运行时错误。
 * 这里把「必须存在的功能码」固化下来，避免再次出现「加入复习列表」被静默丢掉的问题。
 */
import {describe, expect, it} from 'vitest'
import {readFileSync} from 'node:fs'
import {resolve} from 'node:path'

const root = process.cwd()
const plugin = JSON.parse(readFileSync(resolve(root, 'public/plugin.json'), 'utf8'))
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))

/** 必须存在的功能码（新增功能时在这里登记） */
const REQUIRED_FEATURE_CODES = [
  'review',
  'over',
  'huaci',
  'huaciTranslate',
  'jietu',
  'jietuTranslate',
  'translate',
  'textMemory',
  'focusMode',
  'numMemory',
  'shortcutMemory',
  'palace',
  'knowledge',
]

describe('plugin.json', () => {
  it('保留全部功能入口', () => {
    const codes = plugin.features.map((f: any) => f.code)
    for (const code of REQUIRED_FEATURE_CODES) {
      expect(codes, `缺少功能入口 ${code}`).toContain(code)
    }
  })

  it('功能码不重复', () => {
    const codes = plugin.features.map((f: any) => f.code)
    expect(new Set(codes).size).toBe(codes.length)
  })

  it('「加入复习列表」必须有 type=over 的动作且 label 非空', () => {
    const over = plugin.features.find((f: any) => f.code === 'over')
    expect(over).toBeDefined()

    const cmd = over.cmds.find((c: any) => typeof c === 'object' && c.type === 'over')
    expect(cmd, '缺少 type=over 的 cmd，超级面板不会出现该动作').toBeDefined()
    expect(String(cmd.label || '').trim().length).toBeGreaterThan(0)
    expect(cmd.minLength).toBeGreaterThanOrEqual(1)
  })

  it('截图功能同时提供 img 动作与关键词入口', () => {
    const jietu = plugin.features.find((f: any) => f.code === 'jietu')
    expect(jietu).toBeDefined()
    expect(jietu.cmds.some((c: any) => typeof c === 'object' && c.type === 'img')).toBe(true)
    expect(jietu.cmds.some((c: any) => typeof c === 'string')).toBe(true)
  })

  it('版本号与 package.json 一致且 preload/main 指向存在的入口', () => {
    expect(plugin.version).toBe(pkg.version)
    expect(plugin.main).toBe('index.html')
    expect(plugin.preload).toBe('preload/services.js')
  })
})
