import { describe, expect, it, vi } from 'vitest'
import { vibrateOnJudge, vibrateTypeForResult } from './practice-feedback'

describe('vibrateTypeForResult: 判定与震动强度映射', () => {
  it('答对轻震 light', () => {
    expect(vibrateTypeForResult('correct')).toBe('light')
  })

  it('答错重震 medium', () => {
    expect(vibrateTypeForResult('wrong')).toBe('medium')
  })
})

describe('vibrateOnJudge: 判定震动降级链', () => {
  it('答对传 { type: light }，答错传 { type: medium }', () => {
    const fn = vi.fn()
    vibrateOnJudge('correct', fn)
    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledWith({ type: 'light' })

    fn.mockClear()
    vibrateOnJudge('wrong', fn)
    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledWith({ type: 'medium' })
  })

  it('type 不支持抛错时退化为无参震动', () => {
    const fn = vi.fn()
    fn.mockImplementationOnce((opts?: { type?: string }) => {
      if (opts && 'type' in opts) throw new Error('not supported')
    })
    vibrateOnJudge('correct', fn)
    expect(fn).toHaveBeenCalledTimes(2)
    expect(fn).toHaveBeenNthCalledWith(1, { type: 'light' })
    // 无参调用以空参数列表记录
    expect(fn.mock.calls[1]).toEqual([])
  })

  it('无参震动也失败时静默，不再抛出', () => {
    const fn = vi.fn(() => {
      throw new Error('no vibrate')
    })
    expect(() => vibrateOnJudge('wrong', fn)).not.toThrow()
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('不注入实现且无全局 uni 时静默忽略', () => {
    expect(() => vibrateOnJudge('correct')).not.toThrow()
  })
})
