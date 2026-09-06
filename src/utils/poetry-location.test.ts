/**
 * 古诗词地点坐标解析单元测试（桌面版）
 *
 * 桌面版与 mobile 版 API 略有差异：
 * 桌面版提供批量接口 enrichGeoLocation（数组进、数组出），无 enrichArticleGeo 单篇接口。
 */
import { describe, it, expect } from 'vitest'
import { parseLocation, enrichGeoLocation, getAllLocations } from './poetry-location'

describe('poetry-location: parseLocation', () => {
  it('直接命中标准地名', () => {
    const r = parseLocation('扬州')
    expect(r).not.toBeNull()
    expect(r!.lng).toBeCloseTo(119.4, 1)
    expect(r!.lat).toBeCloseTo(32.4, 1)
    expect(r!.name).toBe('扬州')
  })

  it('通过别名匹配（姑苏 → 苏州、金陵 → 南京）', () => {
    expect(parseLocation('姑苏')!.name).toBe('苏州')
    expect(parseLocation('金陵')!.name).toBe('南京')
  })

  it('别名"凉州"映射到武威，"康桥"映射到剑桥', () => {
    expect(parseLocation('凉州')!.name).toBe('武威')
    expect(parseLocation('康桥')!.name).toBe('剑桥')
  })

  it('支持多分隔符，取第一个能解析的部分', () => {
    expect(parseLocation('扬州/瓜洲')!.name).toBe('扬州')
    expect(parseLocation('未知地点，长安')!.name).toBe('长安')
    expect(parseLocation('A、洛阳')!.name).toBe('洛阳')
    expect(parseLocation('X；杭州')!.name).toBe('杭州')
    expect(parseLocation('Y|成都')!.name).toBe('成都')
  })

  it('模糊包含匹配（赤壁矶 → 赤壁）', () => {
    expect(parseLocation('赤壁矶')!.name).toBe('赤壁')
  })

  it('无法解析时返回 null', () => {
    expect(parseLocation('火星')).toBeNull()
    expect(parseLocation('')).toBeNull()
    expect(parseLocation(undefined)).toBeNull()
  })

  it('返回拷贝，外部修改不影响内部数据', () => {
    const r1 = parseLocation('扬州')!
    r1.lng = 999
    expect(parseLocation('扬州')!.lng).toBeCloseTo(119.4, 1)
  })
})

describe('poetry-location: enrichGeoLocation', () => {
  it('按 location 解析 geo 并保留原字段', () => {
    const out = enrichGeoLocation([{ title: '静夜思', location: '扬州' }])
    expect(out[0].geo).toBeDefined()
    expect(out[0].geo!.name).toBe('扬州')
    expect(out[0].title).toBe('静夜思')
  })

  it('location 解析失败时回退到 title', () => {
    const out = enrichGeoLocation([{ title: '长安古意', location: '未知' }])
    expect(out[0].geo!.name).toBe('长安')
  })

  it('location 与 title 都解析失败时 geo 为 null', () => {
    const out = enrichGeoLocation([{ title: 'XYZ', location: '火星' }])
    expect(out[0].geo).toBeNull()
  })

  it('批量处理多篇文章', () => {
    const out = enrichGeoLocation([
      { title: 'a', location: '杭州' },
      { title: 'b', location: '成都' },
      { title: 'c' },
    ])
    expect(out.map(a => a.geo?.name)).toEqual(['杭州', '成都', undefined])
  })
})

describe('poetry-location: getAllLocations', () => {
  it('返回全部地点且坐标为数字', () => {
    const list = getAllLocations()
    expect(list.length).toBeGreaterThan(80)
    expect(list.every(l => typeof l.lng === 'number' && typeof l.lat === 'number')).toBe(true)
    expect(list.some(l => l.name === '扬州')).toBe(true)
  })

  it('返回拷贝，外部修改不影响内部数据', () => {
    const list = getAllLocations()
    const yangzhou = list.find(l => l.name === '扬州')!
    yangzhou.lng = 999
    expect(getAllLocations().find(l => l.name === '扬州')!.lng).toBeCloseTo(119.4, 1)
  })
})
