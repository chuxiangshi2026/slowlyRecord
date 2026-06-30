import { describe, expect, it } from 'vitest'
import { parseLocation, enrichArticleGeo, getAllLocations } from './poetry-location'

describe('poetry-location: parseLocation', () => {
  it('应解析标准地名', () => {
    const r = parseLocation('扬州')
    expect(r).not.toBeNull()
    expect(r!.lng).toBeCloseTo(119.4, 1)
    expect(r!.lat).toBeCloseTo(32.4, 1)
    expect(r!.name).toBe('扬州')
  })

  it('应通过别名匹配（姑苏 → 苏州）', () => {
    const r = parseLocation('姑苏')
    expect(r).not.toBeNull()
    expect(r!.name).toBe('苏州')
  })

  it('应通过别名匹配（金陵 → 南京）', () => {
    const r = parseLocation('金陵')
    expect(r).not.toBeNull()
    expect(r!.name).toBe('南京')
  })

  it('应通过别名匹配（凉州 → 武威）', () => {
    expect(parseLocation('凉州')!.name).toBe('武威')
  })

  it('应通过别名匹配（白帝城）', () => {
    // 白帝城本身就是标准名，应直接命中
    const r = parseLocation('白帝城')
    expect(r).not.toBeNull()
    expect(r!.name).toBe('白帝城')
  })

  it('应支持多分隔符："/" 取第一个能解析的部分', () => {
    const r = parseLocation('扬州/瓜洲')
    expect(r).not.toBeNull()
    expect(r!.name).toBe('扬州')
  })

  it('应支持多分隔符："，" 全角逗号', () => {
    const r = parseLocation('未知地点，长安')
    expect(r).not.toBeNull()
    expect(r!.name).toBe('长安')
  })

  it('应支持多分隔符："、"、"；" 等', () => {
    expect(parseLocation('A、洛阳')!.name).toBe('洛阳')
    expect(parseLocation('X；杭州')!.name).toBe('杭州')
    expect(parseLocation('Y|成都')!.name).toBe('成都')
  })

  it('应支持模糊包含匹配（赤壁矶 → 赤壁）', () => {
    const r = parseLocation('赤壁矶')
    expect(r).not.toBeNull()
    // 赤壁矶 本身在别名里，应解析到「赤壁」
    expect(r!.name).toBe('赤壁')
  })

  it('应在无法解析时返回 null', () => {
    expect(parseLocation('火星')).toBeNull()
    expect(parseLocation('')).toBeNull()
    expect(parseLocation(undefined)).toBeNull()
    expect(parseLocation(null)).toBeNull()
  })

  it('应保护返回值不被外部修改（拷贝语义）', () => {
    const r1 = parseLocation('扬州')!
    r1.lng = 999
    const r2 = parseLocation('扬州')!
    expect(r2.lng).toBeCloseTo(119.4, 1)
  })

  it('海外地名也应支持（剑桥/康桥）', () => {
    expect(parseLocation('剑桥')!.name).toBe('剑桥')
    expect(parseLocation('康桥')!.name).toBe('剑桥')
  })
})

describe('poetry-location: enrichArticleGeo', () => {
  it('应补全缺失 geo 的文章', () => {
    const art = { title: '静夜思', location: '扬州' }
    const out = enrichArticleGeo(art)
    expect(out.geo).toBeDefined()
    expect(out.geo!.name).toBe('扬州')
  })

  it('已有 geo 字段则保持原样', () => {
    const existing = { lng: 1, lat: 2, name: 'mock' }
    const art = { title: '某诗', location: '扬州', geo: existing }
    const out = enrichArticleGeo(art)
    expect(out.geo).toBe(existing)
  })

  it('location 解析失败时尝试 title', () => {
    const art = { title: '长安古意', location: '未知' }
    const out = enrichArticleGeo(art)
    expect(out.geo).toBeDefined()
    expect(out.geo!.name).toBe('长安')
  })

  it('location 和 title 都解析不出来时保持无 geo', () => {
    const art = { title: 'XYZ', location: '火星' }
    const out = enrichArticleGeo(art)
    expect(out.geo).toBeUndefined()
  })
})

describe('poetry-location: getAllLocations', () => {
  it('应返回所有地点（数量合理）', () => {
    const list = getAllLocations()
    expect(list.length).toBeGreaterThan(80)
    expect(list.every((l) => typeof l.lng === 'number' && typeof l.lat === 'number')).toBe(true)
  })
})
