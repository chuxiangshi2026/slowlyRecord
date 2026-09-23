import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock uni 本地存储（与 useSignin.test.ts 同一惯例）
const mockStorage = new Map<string, any>()
;(global as any).uni = {
  setStorageSync: vi.fn((key: string, data: any) => { mockStorage.set(key, data) }),
  getStorageSync: vi.fn((key: string) => mockStorage.get(key) ?? null),
  removeStorageSync: vi.fn((key: string) => { mockStorage.delete(key) }),
}

import {
  SUBSCRIBE_STORAGE_KEY,
  SUBSCRIBE_TEMPLATE_ID_KEY,
  getSubscribeRecord,
  recordSubscribeOutcome,
  clearSubscribeRecord,
  getSubscribeTemplateId,
  setSubscribeTemplateId,
  parseSubscribeResult,
} from './subscribe-remind'

describe('subscribe-remind 授权记录存取', () => {
  beforeEach(() => {
    mockStorage.clear()
  })

  it('无记录时返回空记录', () => {
    expect(getSubscribeRecord()).toEqual({ times: 0, lastTime: 0, lastStatus: '', rejectTimes: 0 })
  })

  it('记录一次接受授权：次数 +1 且写入最近状态与时间', () => {
    const record = recordSubscribeOutcome('accept', 1725800000000)
    expect(record).toEqual({ times: 1, lastTime: 1725800000000, lastStatus: 'accept', rejectTimes: 0 })
    // 持久化内容一致
    expect(JSON.parse(mockStorage.get(SUBSCRIBE_STORAGE_KEY))).toEqual(record)
  })

  it('多次授权累计次数并更新最近时间', () => {
    recordSubscribeOutcome('accept', 1000)
    const record = recordSubscribeOutcome('accept', 2000)
    expect(record.times).toBe(2)
    expect(record.lastTime).toBe(2000)
    expect(record.lastStatus).toBe('accept')
  })

  it('拒绝授权不增加可推送额度，只累计拒绝次数', () => {
    recordSubscribeOutcome('accept', 1000)
    const record = recordSubscribeOutcome('reject', 2000)
    expect(record.times).toBe(1)
    expect(record.rejectTimes).toBe(1)
    expect(record.lastStatus).toBe('reject')
  })

  it('封禁/过期/未知结果不影响额度与拒绝次数', () => {
    const ban = recordSubscribeOutcome('ban', 1000)
    expect(ban).toEqual({ times: 0, lastTime: 1000, lastStatus: 'ban', rejectTimes: 0 })
    const expired = recordSubscribeOutcome('expired', 2000)
    expect(expired.times).toBe(0)
    expect(expired.lastStatus).toBe('expired')
  })

  it('读取已持久化的记录', () => {
    recordSubscribeOutcome('accept', 3000)
    expect(getSubscribeRecord()).toEqual({ times: 1, lastTime: 3000, lastStatus: 'accept', rejectTimes: 0 })
  })

  it('存储数据损坏时返回空记录而不抛错', () => {
    mockStorage.set(SUBSCRIBE_STORAGE_KEY, '{broken')
    expect(getSubscribeRecord()).toEqual({ times: 0, lastTime: 0, lastStatus: '', rejectTimes: 0 })
    mockStorage.set(SUBSCRIBE_STORAGE_KEY, JSON.stringify({ foo: 1 }))
    expect(getSubscribeRecord()).toEqual({ times: 0, lastTime: 0, lastStatus: '', rejectTimes: 0 })
  })

  it('清除记录后回到空记录', () => {
    recordSubscribeOutcome('accept', 1000)
    clearSubscribeRecord()
    expect(getSubscribeRecord()).toEqual({ times: 0, lastTime: 0, lastStatus: '', rejectTimes: 0 })
    expect(mockStorage.has(SUBSCRIBE_STORAGE_KEY)).toBe(false)
  })
})

describe('subscribe-remind 模板 ID 本地配置', () => {
  beforeEach(() => {
    mockStorage.clear()
  })

  it('未配置时返回空串', () => {
    expect(getSubscribeTemplateId()).toBe('')
  })

  it('保存后读取一致，自动去除首尾空白', () => {
    setSubscribeTemplateId('  tmpl-abc-123  ')
    expect(getSubscribeTemplateId()).toBe('tmpl-abc-123')
    expect(mockStorage.get(SUBSCRIBE_TEMPLATE_ID_KEY)).toBe('tmpl-abc-123')
  })

  it('保存空串表示清除配置', () => {
    setSubscribeTemplateId('tmpl-x')
    setSubscribeTemplateId('   ')
    expect(getSubscribeTemplateId()).toBe('')
  })
})

describe('subscribe-remind 授权结果解析', () => {
  it('按模板 ID 取值：接受/拒绝/封禁/过期', () => {
    expect(parseSubscribeResult({ tmpl1: 'accept' }, 'tmpl1')).toBe('accept')
    expect(parseSubscribeResult({ tmpl1: 'reject' }, 'tmpl1')).toBe('reject')
    expect(parseSubscribeResult({ tmpl1: 'ban' }, 'tmpl1')).toBe('ban')
    expect(parseSubscribeResult({ tmpl1: 'expired' }, 'tmpl1')).toBe('expired')
  })

  it('缺键或非法值返回 unknown', () => {
    expect(parseSubscribeResult({}, 'tmpl1')).toBe('unknown')
    expect(parseSubscribeResult({ tmpl2: 'accept' }, 'tmpl1')).toBe('unknown')
    expect(parseSubscribeResult({ tmpl1: 'ok' }, 'tmpl1')).toBe('unknown')
  })
})
