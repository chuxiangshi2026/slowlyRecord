/**
 * stats-notice：首启统计告知弹窗
 * 校验「默认关闭也告知一次」「已提示不重弹」「开发环境不打扰」，以及确认开启后真正 opt-in
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/config', () => ({
  STATS_ENDPOINT: 'https://stats.example.com/collect',
  APP_VERSION: '9.9.9',
}))

const confirmMock = vi.hoisted(() => vi.fn())
vi.mock('element-plus', () => ({ ElMessageBox: { confirm: confirmMock } }))

const dbMock = vi.hoisted(() => ({ getSetDb: vi.fn(() => null), upsertSetDbFields: vi.fn(async () => true) }))
vi.mock('@/utils/user-set-db-util', () => dbMock)

import { STATS_NOTICE_KEY } from '@/utils/stats'
import { maybeShowStatsNotice } from '@/utils/stats-notice'

let store: Record<string, string>

function setUpWindow(isDev = false) {
  store = {}
  ;(globalThis as any).window = {
    location: { hostname: '', pathname: '/', hash: '#/Word', search: '' },
    localStorage: {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = v },
      removeItem: (k: string) => { delete store[k] },
    },
    utools: { isDev: () => isDev, getNativeId: () => 'native-device-id-for-test' },
  }
}

const flush = () => new Promise(r => setTimeout(r, 0))

describe('maybeShowStatsNotice', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    confirmMock.mockResolvedValue(undefined)
    setUpWindow()
  })

  afterEach(() => {
    delete (globalThis as any).window
  })

  it('默认关闭也告知一次，确认后写入 opt-in 并持久化已提示标记', async () => {
    maybeShowStatsNotice()
    expect(confirmMock).toHaveBeenCalledTimes(1)
    expect(store[STATS_NOTICE_KEY]).toBe('1')
    await flush()
    expect(dbMock.upsertSetDbFields).toHaveBeenCalledWith({ statsNoticeShown: true })
    // 点「开启统计」后才写正向同意标记
    expect(store['sr_stats_optin']).toBe('1')
  })

  it('已提示过不再重弹', () => {
    store[STATS_NOTICE_KEY] = '1'
    maybeShowStatsNotice()
    expect(confirmMock).not.toHaveBeenCalled()
  })

  it('开发环境（utools.isDev）不弹窗也不写标记', () => {
    setUpWindow(true)
    maybeShowStatsNotice()
    expect(confirmMock).not.toHaveBeenCalled()
    expect(store[STATS_NOTICE_KEY]).toBeUndefined()
  })
})
