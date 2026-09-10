/**
 * 随机鼓励语工具测试
 */
import { describe, it, expect } from 'vitest'
import { getEncourageText, getEncouragePool } from './encourage'

describe('getEncourageText', () => {
  it('返回值始终来自文案池', () => {
    const pool = getEncouragePool()
    for (let i = 0; i < 50; i++) {
      expect(pool).toContain(getEncourageText())
    }
  })

  it('random 可注入，结果确定', () => {
    expect(getEncourageText(() => 0)).toBe(getEncouragePool()[0])
    expect(getEncourageText(() => 0.99999)).toBe(getEncouragePool()[getEncouragePool().length - 1])
    expect(getEncourageText(() => 0.5)).toBe(getEncouragePool()[Math.floor(0.5 * getEncouragePool().length)])
  })

  it('random 越界时钳制在最后一个文案', () => {
    expect(getEncourageText(() => 1)).toBe(getEncouragePool()[getEncouragePool().length - 1])
  })
})

describe('文案池质量', () => {
  it('池子有 8 条以上非空、不重复的文案', () => {
    const pool = getEncouragePool()
    expect(pool.length).toBeGreaterThanOrEqual(8)
    const trimmed = pool.map(t => t.trim())
    expect(new Set(trimmed).size).toBe(trimmed.length)
    for (const text of trimmed) {
      expect(text.length).toBeGreaterThan(0)
    }
  })
})
