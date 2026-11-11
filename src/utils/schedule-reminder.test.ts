/**
 * schedule-reminder 单元测试
 * window.utools 与各 store 全部 mock，验证降级、对账、授权不重复弹框与每日提醒内容
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  wordsStore: {
    scheduleReminder: { daily: true, dailyTimes: ['09:00', '21:00'] } as Record<string, any>,
    setScheduleReminder: vi.fn(),
    listWords: vi.fn(),
    forgetCount: 0,
    words: [] as any[],
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
  localStorageStore: {} as Record<string, string>,
}))

vi.mock('@/stores/words', () => ({ useWordsStore: () => mocks.wordsStore }))
vi.mock('@/stores/signin', () => ({ useSigninStore: () => mocks.signinStore }))
vi.mock('@/stores/sync', () => ({ useSyncStore: () => mocks.syncStore }))
vi.mock('@/utils/sync-dirty', () => ({ hasUnsyncedChanges: () => mocks.hasUnsyncedChanges.value }))
vi.mock('@/adapters/db', () => ({ getDbAdapterAsync: vi.fn().mockResolvedValue({}) }))
vi.mock('@/adapters/platform', () => ({ isUtools: () => mocks.isUtoolsFlag.value }))
vi.mock('@/utils/logger', () => ({ log: { e: vi.fn(), i: vi.fn(), d: vi.fn(), w: vi.fn() } }))
vi.mock('@/utils/stats', () => ({ trackEvent: vi.fn() }))

import {
  isScheduleSupported,
  handleScheduleTrigger,
  applyScheduleSetting,
  applyScheduleTimes,
  reconcileSchedules,
  migrateReminderPref,
  pickReminderWord,
  SCHEDULE_CODE_REVIEW,
  SCHEDULE_CODE_SYNC,
  MAX_REMINDER_TIMES,
  REMINDER_TIME_OPTIONS,
} from '@/utils/schedule-reminder'
import { trackEvent } from '@/utils/stats'

const word = (id: string, text: string, extra: Record<string, any> = {}) => ({
  _id: id,
  text,
  explains: extra.explains ?? `${text} 的释义`,
  phonetic: extra.phonetic ?? '',
  isReview: extra.isReview ?? true,
})

describe('schedule-reminder', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.isUtoolsFlag.value = true
    mocks.wordsStore.scheduleReminder = { daily: true, dailyTimes: ['09:00', '21:00'] }
    mocks.wordsStore.forgetCount = 0
    mocks.wordsStore.words = []
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
    mocks.utools.db.promises.replicateStateFromCloud = vi.fn().mockResolvedValue(0)
    mocks.localStorageStore = {}
    ;(globalThis as any).window = { utools: mocks.utools }
    ;(globalThis as any).localStorage = {
      getItem: (k: string) => mocks.localStorageStore[k] ?? null,
      setItem: (k: string, v: string) => { mocks.localStorageStore[k] = v },
      removeItem: (k: string) => { delete mocks.localStorageStore[k] },
    }
  })

  afterEach(() => {
    delete (globalThis as any).window
    delete (globalThis as any).localStorage
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

  describe('migrateReminderPref（旧两套提醒 → 每日提醒）', () => {
    it('新数据原样返回', () => {
      const pref = { daily: false, dailyTimes: ['08:00'] }
      expect(migrateReminderPref(pref)).toEqual(pref)
    })

    it('旧 review/signin 任一开启即合并为开启，并继承 reviewTimes', () => {
      const migrated = migrateReminderPref({ review: false, signin: true, reviewTimes: ['13:00', '21:00'] })
      expect(migrated.daily).toBe(true)
      expect(migrated.dailyTimes).toEqual(['13:00', '21:00'])
    })

    it('旧数据都关着时合并为关闭', () => {
      const migrated = migrateReminderPref({ review: false, signin: false })
      expect(migrated.daily).toBe(false)
    })

    it('旧 signinTime 单点兜底为时间点数组', () => {
      const migrated = migrateReminderPref({ review: false, signin: true, signinTime: '22:00' })
      expect(migrated.dailyTimes).toEqual(['22:00'])
    })

    it('旧请求标记视为已授权，升级后不再弹框', () => {
      expect(migrateReminderPref({ review: true, signin: false, reviewRequested: true }).dailyRequested).toBe(true)
      expect(migrateReminderPref({ review: true, signin: false }).dailyRequested).toBe(false)
    })
  })

  describe('pickReminderWord（每日一词）', () => {
    it('优先从待复习词里挑', () => {
      const picked = pickReminderWord([
        word('a', 'apple', { isReview: false }),
        word('b', 'banana', { isReview: true }),
      ])
      expect(picked?.text).toBe('banana')
    })

    it('没有待复习词时退化为全部有释义的词', () => {
      const picked = pickReminderWord([word('a', 'apple', { isReview: false })])
      expect(picked?.text).toBe('apple')
    })

    it('跳过没有释义的词', () => {
      expect(pickReminderWord([word('a', 'apple', { explains: '  ' })])).toBeUndefined()
    })

    it('避开最近推过的词，全部推过时允许重复', () => {
      const pool = [word('a', 'apple'), word('b', 'banana')]
      mocks.localStorageStore['sr_reminder_recent_words'] = JSON.stringify(['a'])
      expect(pickReminderWord(pool)?.text).toBe('banana')

      mocks.localStorageStore['sr_reminder_recent_words'] = JSON.stringify(['a', 'b'])
      expect(['apple', 'banana']).toContain(pickReminderWord(pool)?.text)
    })

    it('推送后记入最近列表', () => {
      pickReminderWord([word('a', 'apple')])
      expect(JSON.parse(mocks.localStorageStore['sr_reminder_recent_words'])).toEqual(['a'])
    })
  })

  describe('handleScheduleTrigger（每日提醒内容）', () => {
    it('有待复习词：通知数量并附带一个词', async () => {
      mocks.wordsStore.forgetCount = 3
      mocks.wordsStore.words = [word('a', 'abandon', { explains: 'v. 放弃；抛弃', phonetic: '/əˈbændən/' })]
      await handleScheduleTrigger(SCHEDULE_CODE_REVIEW)

      expect(mocks.wordsStore.listWords).toHaveBeenCalled()
      const body = mocks.utools.showNotification.mock.calls[0][0] as string
      expect(body).toContain('3 词待复习')
      expect(body).toContain('abandon')
      expect(body).toContain('/əˈbændən/')
      expect(body).toContain('v. 放弃') // 释义截断到第一个分号
      expect(mocks.utools.showNotification).toHaveBeenCalledWith(expect.any(String), 'review')
      expect(trackEvent).toHaveBeenCalledWith('reminder', 'push', 'due', 1)
    })

    it('无到期词但未打卡：提醒连续天数并附词', async () => {
      mocks.signinStore.hasSignedToday = false
      mocks.signinStore.streakDays = 5
      mocks.wordsStore.words = [word('a', 'apple', { isReview: false })]
      await handleScheduleTrigger(SCHEDULE_CODE_REVIEW)

      const body = mocks.utools.showNotification.mock.calls[0][0] as string
      expect(body).toContain('还没打卡')
      expect(body).toContain('连续 5 天')
      expect(body).toContain('apple')
      expect(trackEvent).toHaveBeenCalledWith('reminder', 'push', 'signin', 1)
    })

    it('已打卡且无到期词：完全静默', async () => {
      mocks.signinStore.hasSignedToday = true
      mocks.wordsStore.forgetCount = 0
      await handleScheduleTrigger(SCHEDULE_CODE_REVIEW)
      expect(mocks.utools.showNotification).not.toHaveBeenCalled()
      expect(trackEvent).not.toHaveBeenCalled()
    })

    it('没有可用词时只发提醒文本', async () => {
      mocks.wordsStore.forgetCount = 2
      mocks.wordsStore.words = []
      await handleScheduleTrigger(SCHEDULE_CODE_REVIEW)

      expect(mocks.utools.showNotification).toHaveBeenCalledWith('慢记：2 词待复习', 'review')
      expect(trackEvent).toHaveBeenCalledWith('reminder', 'push', 'due', 0)
    })

    it('旧防断签任务触发时走同一套逻辑（迁移期兼容）', async () => {
      mocks.wordsStore.forgetCount = 1
      mocks.wordsStore.words = [word('a', 'apple')]
      await handleScheduleTrigger('signin-reminder')
      expect(mocks.utools.showNotification).toHaveBeenCalledWith(expect.stringContaining('1 词待复习'), 'review')
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

    it('自动备份：上传失败不抛出（避免计入任务 failureCount）', async () => {
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

  describe('reconcileSchedules（启动对账与授权不重复弹框）', () => {
    it('旧配置首次对账：迁移成单条每日提醒并只请求一次', async () => {
      mocks.wordsStore.scheduleReminder = { review: true, signin: true, reviewTimes: ['13:00', '21:00'] }
      await reconcileSchedules()

      expect(mocks.utools.requestSchedule).toHaveBeenCalledTimes(1)
      expect(mocks.utools.requestSchedule).toHaveBeenCalledWith({
        code: SCHEDULE_CODE_REVIEW,
        label: '慢记每日提醒',
        trigger: { cron: '0 13,21 * * *' },
      })
      expect(mocks.wordsStore.scheduleReminder.daily).toBe(true)
      expect(mocks.wordsStore.scheduleReminder.dailyTimes).toEqual(['13:00', '21:00'])
      expect(mocks.wordsStore.scheduleReminder.dailyRequested).toBe(true)
    })

    it('已发起过请求：任务不在也不再弹框，开关落为关', async () => {
      mocks.wordsStore.scheduleReminder = { daily: true, dailyRequested: true }
      await reconcileSchedules()
      expect(mocks.utools.requestSchedule).not.toHaveBeenCalled()
      expect(mocks.wordsStore.scheduleReminder.daily).toBe(false)
    })

    it('任务已存在：不请求、不删除、不写库', async () => {
      mocks.utools.getSchedules.mockReturnValue([{ code: SCHEDULE_CODE_REVIEW, trigger: { cron: '0 9,21 * * *' } }])
      await reconcileSchedules()
      expect(mocks.utools.requestSchedule).not.toHaveBeenCalled()
      expect(mocks.utools.removeSchedule).not.toHaveBeenCalled()
      expect(mocks.wordsStore.setScheduleReminder).not.toHaveBeenCalled()
    })

    it('旧防断签任务存在时清掉（已合并）', async () => {
      mocks.wordsStore.scheduleReminder = { daily: true, dailyTimes: ['09:00'] }
      mocks.utools.getSchedules.mockReturnValue([
        { code: SCHEDULE_CODE_REVIEW, trigger: { cron: '0 9 * * *' } },
        { code: 'signin-reminder', trigger: { cron: '30 5 * * *' } },
      ])
      await reconcileSchedules()
      expect(mocks.utools.removeSchedule).toHaveBeenCalledWith('signin-reminder')
      expect(mocks.utools.removeSchedule).toHaveBeenCalledTimes(1)
    })

    it('意向关 + 任务存在 → 删除任务', async () => {
      mocks.wordsStore.scheduleReminder = { daily: false }
      mocks.utools.getSchedules.mockReturnValue([{ code: SCHEDULE_CODE_REVIEW, trigger: { cron: '0 9 * * *' } }])
      await reconcileSchedules()
      expect(mocks.utools.removeSchedule).toHaveBeenCalledWith(SCHEDULE_CODE_REVIEW)
      expect(mocks.utools.requestSchedule).not.toHaveBeenCalled()
    })

    it('自动备份意向开 + 任务不存在 + 未发起过 → 请求创建（每天 22:00）', async () => {
      mocks.wordsStore.scheduleReminder = { daily: false, sync: true }
      await reconcileSchedules()
      expect(mocks.utools.requestSchedule).toHaveBeenCalledTimes(1)
      expect(mocks.utools.requestSchedule).toHaveBeenCalledWith({
        code: SCHEDULE_CODE_SYNC,
        label: '慢记自动备份',
        trigger: { cron: '0 22 * * *' },
      })
      expect(mocks.wordsStore.scheduleReminder.syncRequested).toBe(true)
    })

    it('自动备份已发起过且任务不在 → 翻转关闭，不重复弹框', async () => {
      mocks.wordsStore.scheduleReminder = { daily: false, sync: true, syncRequested: true }
      await reconcileSchedules()
      expect(mocks.utools.requestSchedule).not.toHaveBeenCalled()
      expect(mocks.wordsStore.scheduleReminder.sync).toBe(false)
    })

    it('低版本不支持时完全跳过', async () => {
      ;(globalThis as any).window = { utools: {} }
      await reconcileSchedules()
      expect(mocks.utools.requestSchedule).not.toHaveBeenCalled()
    })

    it('用户拒绝授权（requestSchedule reject）：仍落「已发起」标记，再次对账不再弹框', async () => {
      mocks.wordsStore.scheduleReminder = { daily: true, dailyTimes: ['09:00'] }
      mocks.utools.requestSchedule.mockRejectedValueOnce(new Error('user denied'))

      await reconcileSchedules()

      expect(mocks.utools.requestSchedule).toHaveBeenCalledTimes(1)
      expect(mocks.wordsStore.scheduleReminder.dailyRequested).toBe(true)

      // 第二次进入插件：不得再次发起请求
      mocks.utools.requestSchedule.mockClear()
      mocks.utools.requestSchedule.mockRejectedValue(new Error('should not be called'))
      await reconcileSchedules()
      expect(mocks.utools.requestSchedule).not.toHaveBeenCalled()
    })
  })

  describe('applyScheduleSetting（设置页开关即时应用）', () => {
    it('打开：立即请求创建并标记已发起', async () => {
      await applyScheduleSetting('daily', true)
      expect(mocks.utools.requestSchedule).toHaveBeenCalledWith(expect.objectContaining({ code: SCHEDULE_CODE_REVIEW }))
      expect(mocks.wordsStore.scheduleReminder.dailyRequested).toBe(true)
    })

    it('任务已存在时打开：不重复请求（避免再弹授权框）', async () => {
      mocks.utools.getSchedules.mockReturnValue([{ code: SCHEDULE_CODE_REVIEW, trigger: { cron: '0 9,21 * * *' } }])
      await applyScheduleSetting('daily', true)
      expect(mocks.utools.requestSchedule).not.toHaveBeenCalled()
    })

    it('关闭：删除任务', async () => {
      await applyScheduleSetting('daily', false)
      expect(mocks.utools.removeSchedule).toHaveBeenCalledWith(SCHEDULE_CODE_REVIEW)
    })

    it('低版本不支持时不动作', async () => {
      mocks.isUtoolsFlag.value = false
      await applyScheduleSetting('daily', true)
      expect(mocks.utools.requestSchedule).not.toHaveBeenCalled()
    })

    it('授权被拒绝（reject）：不抛出，且仍标记已发起', async () => {
      mocks.utools.requestSchedule.mockRejectedValue(new Error('user denied'))

      await expect(applyScheduleSetting('daily', true)).resolves.toBeUndefined()

      expect(mocks.wordsStore.scheduleReminder.dailyRequested).toBe(true)
    })
  })

  describe('applyScheduleTimes（改时间点）', () => {
    it('cron 没变时不重建', async () => {
      mocks.wordsStore.scheduleReminder = { daily: true, dailyTimes: ['09:00', '21:00'] }
      mocks.utools.getSchedules.mockReturnValue([{ code: SCHEDULE_CODE_REVIEW, trigger: { cron: '0 9,21 * * *' } }])
      await applyScheduleTimes('daily')
      expect(mocks.utools.removeSchedule).not.toHaveBeenCalled()
      expect(mocks.utools.requestSchedule).not.toHaveBeenCalled()
    })

    it('cron 变了才删旧建新', async () => {
      mocks.wordsStore.scheduleReminder = { daily: true, dailyTimes: ['21:00'] }
      mocks.utools.getSchedules.mockReturnValue([{ code: SCHEDULE_CODE_REVIEW, trigger: { cron: '0 9,21 * * *' } }])
      await applyScheduleTimes('daily')
      expect(mocks.utools.removeSchedule).toHaveBeenCalledWith(SCHEDULE_CODE_REVIEW)
      expect(mocks.utools.requestSchedule).toHaveBeenCalledWith(expect.objectContaining({
        code: SCHEDULE_CODE_REVIEW,
        trigger: { cron: '0 21 * * *' },
      }))
    })

    it('提醒关着时改时间只存意向不动作', async () => {
      mocks.wordsStore.scheduleReminder = { daily: false, dailyTimes: ['21:00'] }
      await applyScheduleTimes('daily')
      expect(mocks.utools.removeSchedule).not.toHaveBeenCalled()
      expect(mocks.utools.requestSchedule).not.toHaveBeenCalled()
    })
  })

  describe('时间点选项', () => {
    it('提供常用 :00 选项，最多选 2 个', () => {
      expect(REMINDER_TIME_OPTIONS[0]).toBe('07:00')
      expect(REMINDER_TIME_OPTIONS[REMINDER_TIME_OPTIONS.length - 1]).toBe('22:00')
      expect(REMINDER_TIME_OPTIONS.every(t => t.endsWith(':00'))).toBe(true)
      expect(REMINDER_TIME_OPTIONS.length).toBeLessThanOrEqual(10)
      expect(MAX_REMINDER_TIMES).toBe(2)
    })

    it('旧数据超过 2 个时间点时只保留最早与最晚，保住早晚节奏', async () => {
      mocks.wordsStore.scheduleReminder = { daily: true, dailyTimes: ['21:00', '07:00', '13:00'] }
      await reconcileSchedules()
      expect(mocks.utools.requestSchedule).toHaveBeenCalledWith(expect.objectContaining({
        trigger: { cron: '0 7,21 * * *' },
      }))
    })
  })
})
