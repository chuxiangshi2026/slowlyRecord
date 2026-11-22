/**
 * jsDelivr 镜像变体测试
 */
import { describe, it, expect } from 'vitest'
import { cdnUrlVariants } from './cdn-mirror'

describe('cdnUrlVariants', () => {
  it('jsDelivr URL 生成镜像链（原 URL 在首位）', () => {
    const url = 'https://cdn.jsdelivr.net/gh/user/repo@master/public/poetry-audio/abc.mp3'
    expect(cdnUrlVariants(url)).toEqual([
      url,
      'https://jsd.onmicrosoft.cn/gh/user/repo@master/public/poetry-audio/abc.mp3',
      'https://fastly.jsdelivr.net/gh/user/repo@master/public/poetry-audio/abc.mp3',
    ])
  })

  it('非 jsDelivr URL 原样返回单元素', () => {
    const url = 'https://dict.youdao.com/dictvoice?audio=hello&type=2'
    expect(cdnUrlVariants(url)).toEqual([url])
  })

  it('域名前缀相似但非 jsDelivr 的 URL 不替换', () => {
    expect(cdnUrlVariants('https://cdn.jsdelivr.net.example.com/x')).toEqual([
      'https://cdn.jsdelivr.net.example.com/x',
    ])
  })
})
