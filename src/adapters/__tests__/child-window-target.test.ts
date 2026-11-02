import { describe, expect, it } from 'vitest'
import { resolveChildWindowTarget } from '../../../electron/child-window-target.mjs'

describe('resolveChildWindowTarget', () => {
  it('无查询串时只返回文件路径', () => {
    expect(resolveChildWindowTarget('input-method-helper.html')).toEqual({
      filePath: 'input-method-helper.html',
      search: '',
    })
  })

  it('拆出文本专注窗口的查询串', () => {
    expect(resolveChildWindowTarget('focus.html?mode=text')).toEqual({
      filePath: 'focus.html',
      search: 'mode=text',
    })
  })

  it('保留编码后的中文、空格、多次出现的键和 &', () => {
    const search = `theme=dark&pattern=${encodeURIComponent('a b&c')}&tag=x&tag=y`
    expect(resolveChildWindowTarget(`focus.html?${search}`)).toEqual({
      filePath: 'focus.html',
      search,
    })
  })

  it('问号出现在值中时只按第一个问号拆分', () => {
    expect(resolveChildWindowTarget('focus.html?pattern=a%3Fb%3Fc')).toEqual({
      filePath: 'focus.html',
      search: 'pattern=a%3Fb%3Fc',
    })
  })
})
