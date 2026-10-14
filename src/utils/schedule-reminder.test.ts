/**
 * schedule-reminder 单元测试
 * window.utools 与各 store 全部 mock，验证降级、对账与触发处理逻辑
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  wordsStore: {
    scheduleReminder: { review: true, signin: true } as Record<string, any>,
    setScheduleReminder: vi.fn(),
    listWords: vi.fn(),
    forgetCount: 0,
  },
  signinStore: {
    loadRecords: vi.fn(),
    hasSignedToday: false,
    streakDays: 0,
  },
  syncStore: {
    webdavReady: Promise.resolve(),
    webdavConfigured: false,
    webdavUpload: vi.fn(),
  },
  hasUnsyncedChanges: { value: true },
  utools: {
    requestSchedule: vi.fn(),
    getSchedules: vi.fn(),
    removeSchedule: vi.fn(),
    onScheduleTrigger: vi.fn(),
    showNotification: vi.fn(),
    db: { promises: { replicateStateFromCloud: vi.fn() } },
  },
  isUtoolsFlag: { value: true },
}))

vi.mock('@/stores/words', () => ({ useWordsStore: () => mocks.wordsStore }))
vi.mock('@/stores/signin', () => ({ useSigninStore: () => mocks.signinStore }))
vi.mock('@/stores/sync', () => ({ useSyncStore: () => mocks.syncStore }))
vi.mock('@/utils/sync-dirty', () => ({ hasUnsyncedChanges: () => mocks.hasUnsyncedChanges.value }))
vi.mock('@/adapters/db', () => ({ getDbAdapterAsync: vi.fn().mockResolvedValue({}) }))
vi.mock('@/adapters/platform', () => ({ isUtools: () => mocks.isUtoolsFlag.value }))
vi.mock('@/utils/logger', () => ({ log: { e: vi.fn(), i: vi.fn(), d: vi.fn(), w: vi.fn() } }))

import {
  isScheduleSupported,
  handleScheduleTrigger,
  applyScheduleSetting,
  applyScheduleTimes,
  reconcileSchedules,
  SCHEDULE_CODE_REVIEW,
  SCHEDULE_CODE_SIGNIN,
  SCHEDULE_CODE_SYNC,
} from '@/utils/schedule-reminder'

describe('schedule-reminder', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.isUtoolsFlag.value = true
    mocks.wordsStore.scheduleReminder = { review: true, signin: true }
    mocks.wordsStore.forgetCount = 0
    mocks.wordsStore.listWords.mockResolvedValue([])
    mocks.wordsStore.setScheduleReminder.mockImplementation((patch: Record<string, any>) => {
      mocks.wordsStore.scheduleReminder = { ...mocks.wordsStore.scheduleReminder, ...patch }
    })
    mocks.signinStore.hasSignedToday = false
    mocks.signinStore.streakDays = 0
    mocks.syncStore.webdavConfigured = false
    mocks.hasUnsyncedChanges.value = true
    mocks.syncStore.webdavUpload.mockResolvedValue({ success: true })
    mocks.utools.requestSchedule.mockResolvedValue(undefined)
    mocks.utools.getSchedules.mockReturnValue([])
    // 用例内可能置为 undefined，这里整体重建 mock
    mocks.utools.db.promises.replicateStateFromCloud = vi.fn().mockResolvedValue(0)
    ;(globalThis as any).window = { utools: mocks.utools }
  })

  afterEach(() => {
    delete (globalThis as any).window
  })

  describe('isScheduleSupported（能力探测与降级）', () => {
    it('API 齐全且为 uTools 环境时支持', () => {
      expect(isScheduleSupported()).toBe(true)
    })

    it('非 uTools 环境不支持', () => {
      mocks.isUtoolsFlag.value = false
      expect(isScheduleSupported()).toBe(false)
    })

    it('低版本缺少 requestSchedule 时不支持', () => {
      ;(globalThis as any).window = { utools: { ...mocks.utools, requestSchedule: undefined } }
      expect(isScheduleSupported()).toBe(false)
    })

    it('无 window（非前端环境）时不支持', () => {
      delete (globalThis as any).window
      expect(isScheduleSupported()).toBe(false)
    })
  })

  describe('handleScheduleTrigger（触发处理）', () => {
    it('复习提醒：有待复习单词时通知并直达 review 功能', async () => {
      mocks.wordsStore.forgetCount = 3
      await handleScheduleTrigger(SCHEDULE_CODE_REVIEW)
      expect(mocks.wordsStore.listWords).toHaveBeenCalled()
      expect(mocks.utools.showNotification).toHaveBeenCalledWith('慢记：有 3 个单词到点待复习', 'review')
    })

    it('复习提醒：无待复习时不打扰', async () => {
      mocks.wordsStore.forgetCount = 0
      await handleScheduleTrigger(SCHEDULE_CODE_REVIEW)
      expect(mocks.utools.showNotification).not.toHaveBeenCalled()
    })

    it('防断签：今日未打卡且有连续记录时提示天数', async () => {
      mocks.signinStore.hasSignedToday = false
      mocks.signinStore.streakDays = 5
      await handleScheduleTrigger(SCHEDULE_CODE_SIGNIN)
      expect(mocks.utools.showNotification).toHaveBeenCalledWith('慢记：今天还没复习，连续打卡 5 天要断了', 'review')
    })

    it('防断签：今日已打卡时不打扰', async () => {
      mocks.signinStore.hasSignedToday = true
      await handleScheduleTrigger(SCHEDULE_CODE_SIGNIN)
      expect(mocks.utools.showNotification).not.toHaveBeenCalled()
    })

    it('未知 code 不产生任何通知', async () => {
      await handleScheduleTrigger('unknown-code')
      expect(mocks.utools.showNotification).not.toHaveBeenCalled()
    })

    it('自动备份：已配置 WebDAV 且有变更时执行上传，不发通知', async () => {
      mocks.syncStore.webdavConfigured = true
      await handleScheduleTrigger(SCHEDULE_CODE_SYNC)
      expect(mocks.syncStore.webdavUpload).toHaveBeenCalled()
      expect(mocks.utools.showNotification).not.toHaveBeenCalled()
    })

    it('自动备份：未配置 WebDAV 时静默跳过', async () => {
      mocks.syncStore.webdavConfigured = false
      await handleScheduleTrigger(SCHEDULE_CODE_SYNC)
      expect(mocks.syncStore.webdavUpload).not.toHaveBeenCalled()
    })

    it('自动备份：数据无变更时静默跳过', async () => {
      mocks.syncStore.webdavConfigured = true
      mocks.hasUnsyncedChanges.value = false
      await handleScheduleTrigger(SCHEDULE_CODE_SYNC)
      expect(mocks.syncStore.webdavUpload).not.toHaveBeenCalled()
    })

    it('自动备份：上传失败不抛出（避免计入任务 failureCount），只记日志', async () => {
      mocks.syncStore.webdavConfigured = true
      mocks.syncStore.webdavUpload.mockResolvedValue({ success: false, error: '网络错误' })
      await expect(handleScheduleTrigger(SCHEDULE_CODE_SYNC)).resolves.toBeUndefined()
      expect(mocks.utools.showNotification).not.toHaveBeenCalled()
    })

    it('自动备份：uTools 云同步拉取中（state=1）跳过本次快照', async () => {
      mocks.syncStore.webdavConfigured = true
      mocks.utools.db.promises.replicateStateFromCloud.mockResolvedValue(1)
      await handleScheduleTrigger(SCHEDULE_CODE_SYNC)
      expect(mocks.syncStore.webdavUpload).not.toHaveBeenCalled()
    })

    it('自动备份：旧版本无 replicateStateFromCloud 时不阻断备份', async () => {
      mocks.syncStore.webdavConfigured = true
      mocks.utools.db.promises.replicateStateFromCloud = undefined
      await handleScheduleTrigger(SCHEDULE_CODE_SYNC)
      expect(mocks.syncStore.webdavUpload).toHaveBeenCalled()
    })
  })

  describe('reconcileSchedules（启动对账）', () => {
    it('意向开 + 任务不存在 + 未发起过 → 发起创建请求并标记已发起', async () => {
      await reconcileSchedules()
      expect(mocks.utools.requestSchedule).toHaveBeenCalledTimes(2)
      expect(mocks.utools.requestSchedule).toHaveBeenCalledWith({
        code: SCHEDULE_CODE_REVIEW,
        label: '慢记复习提醒',
        trigger: { cron: '0 9,21 * * *' },
      })
      expect(mocks.utools.requestSchedule).toHaveBeenCalledWith({
        code: SCHEDULE_CODE_SIGNIN,
        label: '慢记防断签提醒',
        trigger: { cron: '30 5,6,8,9,22 * * *' },
      })
      expect(mocks.wordsStore.scheduleReminder.reviewRequested).toBe(true)
      expect(mocks.wordsStore.scheduleReminder.signinRequested).toBe(true)
    })

    it('意向开 + 任务不存在 + 已发起过 → 意向翻转为关，不再重复请求', async () => {
      mocks.wordsStore.scheduleReminder = { review: true, signin: true, reviewRequested: true, signinRequested: true }
      await reconcileSchedules()
      expect(mocks.utools.requestSchedule).not.toHaveBeenCalled()
      expect(mocks.wordsStore.scheduleReminder.review).toBe(false)
      expect(mocks.wordsStore.scheduleReminder.signin).toBe(false)
    })

    it('意向开 + 任务已存在 → 不动', async () => {
      mocks.utools.getSchedules.mockReturnValue([{ code: SCHEDULE_CODE_REVIEW }, { code: SCHEDULE_CODE_SIGNIN }])
      await reconcileSchedules()
      expect(mocks.utools.requestSchedule).not.toHaveBeenCalled()
      expect(mocks.utools.removeSchedule).not.toHaveBeenCalled()
      expect(mocks.wordsStore.setScheduleReminder).not.toHaveBeenCalled()
    })

    it('意向关 + 任务存在 → 删除任务', async () => {
      mocks.wordsStore.scheduleReminder = { review: false, signin: false }
      mocks.utools.getSchedules.mockReturnValue([{ code: SCHEDULE_CODE_REVIEW }, { code: SCHEDULE_CODE_SIGNIN }])
      await reconcileSchedules()
      expect(mocks.utools.removeSchedule).toHaveBeenCalledWith(SCHEDULE_CODE_REVIEW)
      expect(mocks.utools.removeSchedule).toHaveBeenCalledWith(SCHEDULE_CODE_SIGNIN)
    })

    it('自动备份意向开 + 任务不存在 + 未发起过 → 发起创建请求（每天 22:00）', async () => {
      mocks.wordsStore.scheduleReminder = { review: false, signin: false, sync: true }
      await reconcileSchedules()
      expect(mocks.utools.requestSchedule).toHaveBeenCalledTimes(1)
      expect(mocks.utools.requestSchedule).toHaveBeenCalledWith({
        code: SCHEDULE_CODE_SYNC,
        label: '慢记自动备份',
        trigger: { cron: '0 22 * * *' },
      })
      expect(mocks.wordsStore.scheduleReminder.syncRequested).toBe(true)
    })

    it('自动备份意向开 + 任务不存在 + 已发起过 → 意向翻转为关', async () => {
      mocks.wordsStore.scheduleReminder = { review: false, signin: false, sync: true, syncRequested: true }
      await reconcileSchedules()
      expect(mocks.utools.requestSchedule).not.toHaveBeenCalled()
      expect(mocks.wordsStore.scheduleReminder.sync).toBe(false)
    })

    it('自动备份意向关 + 任务存在 → 删除任务', async () => {
      mocks.wordsStore.scheduleReminder = { review: false, signin: false, sync: false }
      mocks.utools.getSchedules.mockReturnValue([{ code: SCHEDULE_CODE_SYNC }])
      await reconcileSchedules()
      expect(mocks.utools.removeSchedule).toHaveBeenCalledWith(SCHEDULE_CODE_SYNC)
    })

    it('低版本不支持时完全跳过', async () => {
      ;(globalThis as any).window = { utools: {} }
      await reconcileSchedules()
      expect(mocks.utools.requestSchedule).not.toHaveBeenCalled()
    })

    it('删除不存在的任务抛异常时不影响整体流程', async () => {
      mocks.wordsStore.scheduleReminder = { review: false, signin: true }
      mocks.utools.getSchedules.mockReturnValue([{ code: SCHEDULE_CODE_REVIEW }])
      mocks.utools.removeSchedule.mockImplementation(() => { throw new Error('任务不存在') })
      await reconcileSchedules()
      // removeSchedule 异常被吞掉后，signin 分支仍正常发起请求
      expect(mocks.utools.requestSchedule).toHaveBeenCalledWith(expect.objectContaining({ code: SCHEDULE_CODE_SIGNIN }))
    })
  })

  describe('applyScheduleSetting（设置页开关即时应用）', () => {
    it('打开：重置已发起标记并立即请求创建', async () => {
      await applyScheduleSetting('review', true)
      expect(mocks.utools.requestSchedule).toHaveBeenCalledWith(expect.objectContaining({ code: SCHEDULE_CODE_REVIEW }))
      expect(mocks.wordsStore.scheduleReminder.reviewRequested).toBe(true)
    })

    it('关闭：删除任务', async () => {
      await applyScheduleSetting('signin', false)
      expect(mocks.utools.removeSchedule).toHaveBeenCalledWith(SCHEDULE_CODE_SIGNIN)
    })

    it('打开自动备份：立即请求创建并标记已发起', async () => {
      await applyScheduleSetting('sync', true)
      expect(mocks.utools.requestSchedule).toHaveBeenCalledWith(expect.objectContaining({ code: SCHEDULE_CODE_SYNC }))
      expect(mocks.wordsStore.scheduleReminder.syncRequested).toBe(true)
    })

    it('低版本不支持时不动作', async () => {
      mocks.isUtoolsFlag.value = false
      await applyScheduleSetting('review', true)
      expect(mocks.utools.requestSchedule).not.toHaveBeenCalled()
    })
  })

  describe('自定义提醒时间', () => {
    it('复习提醒自定义单时间点 → cron 跟随设置', async () => {
      mocks.wordsStore.scheduleReminder = { review: true, signin: false, reviewTimes: ['13:00'] }
      await reconcileSchedules()
      expect(mocks.utools.requestSchedule).toHaveBeenCalledWith({
        code: SCHEDULE_CODE_REVIEW,
        label: '慢记复习提醒',
        trigger: { cron: '0 13 * * *' },
      })
    })

    it('复习提醒多时间点乱序 → 小时去重排序', async () => {
      mocks.wordsStore.scheduleReminder = { review: true, signin: false, reviewTimes: ['21:00', '09:00', '13:00', '09:00'] }
      await reconcileSchedules()
      expect(mocks.utools.requestSchedule).toHaveBeenCalledWith(expect.objectContaining({
        trigger: { cron: '0 9,13,21 * * *' },
      }))
    })

    it('防断签旧数据单时间点 signinTime → 兜底兼容', async () => {
      mocks.wordsStore.scheduleReminder = { review: false, signin: true, signinTime: '22:00' }
      await reconcileSchedules()
      expect(mocks.utools.requestSchedule).toHaveBeenCalledWith({
        code: SCHEDULE_CODE_SIGNIN,
        label: '慢记防断签提醒',
        trigger: { cron: '0 22 * * *' },
      })
    })

    it('防断签多时间点乱序含重复 → 小时去重排序', async () => {
      mocks.wordsStore.scheduleReminder = { review: false, signin: true, signinTimes: ['22:30', '05:30', '22:30'] }
      await reconcileSchedules()
      expect(mocks.utools.requestSchedule).toHaveBeenCalledWith(expect.objectContaining({
        code: SCHEDULE_CODE_SIGNIN,
        trigger: { cron: '30 5,22 * * *' },
      }))
    })

    it('防断签 signinTimes 优先于旧字段 signinTime', async () => {
      mocks.wordsStore.scheduleReminder = { review: false, signin: true, signinTimes: ['08:30'], signinTime: '22:00' }
      await reconcileSchedules()
      expect(mocks.utools.requestSchedule).toHaveBeenCalledWith(expect.objectContaining({
        code: SCHEDULE_CODE_SIGNIN,
        trigger: { cron: '30 8 * * *' },
      }))
    })

    it('任务开着时改时间 → 删旧建新', async () => {
      mocks.wordsStore.scheduleReminder = { review: true, signin: false, reviewTimes: ['21:00'] }
      await applyScheduleTimes('review')
      expect(mocks.utools.removeSchedule).toHaveBeenCalledWith(SCHEDULE_CODE_REVIEW)
      expect(mocks.utools.requestSchedule).toHaveBeenCalledWith(expect.objectContaining({
        code: SCHEDULE_CODE_REVIEW,
        trigger: { cron: '0 21 * * *' },
      }))
    })

    it('任务关着时改时间 → 只存意向不动作', async () => {
      mocks.wordsStore.scheduleReminder = { review: false, signin: false, reviewTimes: ['21:00'] }
      await applyScheduleTimes('review')
      expect(mocks.utools.removeSchedule).not.toHaveBeenCalled()
      expect(mocks.utools.requestSchedule).not.toHaveBeenCalled()
    })
  })
})
