/**
 * 「导入桩库」数据源（peg-packs.ts）单元测试
 *
 * 校验元数据清单与生成数据的一致性：清单（KNOWLEDGE_PACK_LIST 按 usableAsPeg 过滤）
 * 与实际注册进 PEG_PACK_DATA 的生成文件一一对应，防止新增桩库时漏注册/漏转换。
 */
import { describe, it, expect } from 'vitest'
import { getPegPack, listPegPacks } from './peg-packs'
import { KNOWLEDGE_PACK_LIST } from '../../pages-knowledge/utils/knowledge-pack-loader'

describe('listPegPacks', () => {
  it('清单 = KNOWLEDGE_PACK_LIST 中全部 usableAsPeg 包', () => {
    const expected = KNOWLEDGE_PACK_LIST.filter(p => p.usableAsPeg).map(p => p.id)
    expect(listPegPacks().map(p => p.id)).toEqual(expected)
    // 当前内置桩库应覆盖主流场景（家居/房间/身体/数字/扑克/字母等）
    expect(expected.length).toBeGreaterThanOrEqual(10)
  })
})

describe('getPegPack', () => {
  it('清单中每个桩库都能取到条目数据，且与元数据条目数一致', () => {
    for (const info of listPegPacks()) {
      const pack = getPegPack(info.id)
      expect(pack.usableAsPeg).toBe(true)
      expect(pack.items.length).toBe(info.itemCount)
      // 每个条目都有非空桩名（question）
      expect(pack.items.every(it => it.question.trim().length > 0)).toBe(true)
    }
  })

  it('家居路线桩内容符合预期（顺序、名称、emoji 配图）', () => {
    const pack = getPegPack('home-route-12')
    expect(pack.items[0].question).toBe('大门')
    expect(pack.items[0].order).toBe(1)
    expect(typeof pack.items[0].imageUrl).toBe('string')
  })

  it('未知 id 抛错', () => {
    expect(() => getPegPack('not-exist')).toThrow('not-exist')
  })
})
