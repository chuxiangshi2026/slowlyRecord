/**
 * 数字谐音/助记示例库单元测试
 */
import { describe, it, expect } from 'vitest'
import {
  getMnemonicExample,
  MNEMONIC_EXAMPLES,
  PI_MNEMONIC_10,
  PI_MNEMONIC_20,
} from './number-mnemonic-data'

describe('getMnemonicExample', () => {
  it('π 精确匹配 20 位', () => {
    expect(getMnemonicExample('pi', '3.14159265358979323846')).toBe(PI_MNEMONIC_20)
  })

  it('π 缺省 3. 前缀时自动补全再匹配（10 位）', () => {
    expect(getMnemonicExample('pi', '1415926535')).toBe(PI_MNEMONIC_10)
    expect(getMnemonicExample('pi', '3.1415926535')).toBe(PI_MNEMONIC_10)
  })

  it('π 按前缀长度取最长可匹配示例：12 位命中 10 位示例', () => {
    expect(getMnemonicExample('pi', '3.141592653589')).toBe(PI_MNEMONIC_10)
  })

  it('π 无匹配时回退到前 10 位示例', () => {
    expect(getMnemonicExample('pi', '3.99999')).toBe(PI_MNEMONIC_10)
  })

  it('π 不传 numbers 时返回第一条 π 示例', () => {
    expect(getMnemonicExample('pi')).toBe(PI_MNEMONIC_20)
    expect(getMnemonicExample('pi', '')).toBe(PI_MNEMONIC_20)
  })

  it('非 π 类型返回该类型第一条示例', () => {
    expect(getMnemonicExample('phone')).toBe('一动吧，铃铃动，一动吧，铃铃动，动一动')
    expect(getMnemonicExample('date')).toBe('二零二六零九零二，秋意渐浓')
    expect(getMnemonicExample('qq', '123456789')).toBe('一二三，四五六，七八九，节节高')
  })

  it('无示例的类型返回 undefined', () => {
    expect(getMnemonicExample('custom')).toBeUndefined()
    expect(getMnemonicExample('bankcard')).toBeUndefined()
    expect(getMnemonicExample('plate')).toBeUndefined()
  })
})

describe('MNEMONIC_EXAMPLES 数据完整性', () => {
  it('π 的两条示例数字串互为前缀且 20 位包含 10 位', () => {
    const pi20 = MNEMONIC_EXAMPLES.find(e => e.numbers === '3.14159265358979323846')!
    const pi10 = MNEMONIC_EXAMPLES.find(e => e.numbers === '3.1415926535')!
    expect(pi20.mnemonic).toBe(PI_MNEMONIC_20)
    expect(pi10.mnemonic).toBe(PI_MNEMONIC_10)
    expect(pi20.numbers.startsWith(pi10.numbers)).toBe(true)
  })

  it('每条示例的 kind 都在合法类型内', () => {
    const kinds = new Set(MNEMONIC_EXAMPLES.map(e => e.kind))
    for (const k of kinds) {
      expect(['pi', 'phone', 'date', 'qq']).toContain(k)
    }
  })
})
