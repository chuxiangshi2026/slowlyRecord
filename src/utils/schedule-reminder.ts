/**
 * uTools 8.0+ 定时任务（复习提醒 + 防断签提醒 + WebDAV 自动备份）
 *
 * 依据官方文档（references/api-reference/schedule.md、events.md）：
 * - requestSchedule 仅"请求"创建任务，用户在系统弹窗中允许后才真正创建，拒绝则不生成
 * - 触发时若插件未运行，uTools Runtime 会启动插件再回调 onScheduleTrigger（真后台唤起）
 * - 回调抛异常/返回 rejected Promise 会被记入任务 failureCount，因此回调内统一兜底
 *
 * 降级策略：低版本 uTools（无定时任务 API）与其他平台全部静默跳过，
 * 原有「打开插件时的复习提醒」（App.vue）不受影响。
 */
import { useWordsStore } from '@/stores/words'
import { useSigninStore } from '@/stores/signin'
import { useSyncStore } from '@/stores/sync'
import { hasUnsyncedChanges } from '@/utils/sync-dirty'
import { getDbAdapterAsync } from '@/adapters/db'
import { isUtools } from '@/adapters/platform'
import { log } from '@/utils/logger'

/** 定时任务 code（onScheduleTrigger 凭此区分任务，需保持稳定） */
export const SCHEDULE_CODE_REVIEW = 'review-reminder'
export const SCHEDULE_CODE_SIGNIN = 'signin-reminder'
export const SCHEDULE_CODE_SYNC = 'auto-sync'

/** 可选提醒时间点（分钟数必须一致，否则单个 5 位 cron 无法表达） */
export const REVIEW_TIME_OPTIONS = ['09:00', '13:00', '21:00']
export const SIGNIN_TIME_OPTIONS = ['05:30', '06:30', '08:30', '09:30', '22:30']
const DEFAULT_REVIEW_TIMES = ['09:00', '21:00']
/** 防断签默认全部时间点都提醒（仅当天未打卡才触发通知，打过卡自动静默） */
const DEFAULT_SIGNIN_TIMES = SIGNIN_TIME_OPTIONS
/** 自动备份固定在每天 22:00（备份无需用户交互，时间不可自定义） */
const SYNC_CRON = '0 22 * * *'

export type ReminderKind = 'review' | 'signin' | 'sync'

interface ScheduleReminderPref {
  review: boolean
  signin: boolean
  sync?: boolean
  reviewTimes?: string[]
  signinTimes?: string[]
  /** 旧版单时间点字段，已被 signinTimes 取代（读取时兜底兼容） */
  signinTime?: string
  reviewRequested?: boolean
  signinRequested?: boolean
  syncRequested?: boolean
}

function getUtools(): any {
  return typeof window === 'undefined' ? undefined : (window as any).utools
}

/** 当前环境是否支持定时任务（uTools 8.0+） */
export function isScheduleSupported(): boolean {
  if (!isUtools()) return false
  const u = getUtools()
  return typeof u?.requestSchedule === 'function'
    && typeof u?.onScheduleTrigger === 'function'
    && typeof u?.getSchedules === 'function'
    && typeof u?.removeSchedule === 'function'
}

/** 多个时间点 → 单条 cron（分钟取第一个时间点的，选项分钟数一致是约定前提） */
function timesToCron(times: string[]): string {
  const sorted = [...times].sort()
  const minute = Number(sorted[0].split(':')[1])
  const hours = [...new Set(sorted.map(t => Number(t.split(':')[0])))].join(',')
  return `${minute} ${hours} * * *`
}

interface TaskMeta {
  code: string
  label: string
  cron: string
  requestedKey: 'reviewRequested' | 'signinRequested' | 'syncRequested'
}

/** 防断签时间点：优先新字段 signinTimes，旧数据单时间点 signinTime 兜底 */
function resolveSigninTimes(pref: ScheduleReminderPref): string[] {
  if (pref.signinTimes?.length) return pref.signinTimes
  if (pref.signinTime) return [pref.signinTime]
  return DEFAULT_SIGNIN_TIMES
}

/** 由设置意向计算任务配置（cron 随自定义时间点变化） */
function taskMeta(kind: ReminderKind, pref: ScheduleReminderPref): TaskMeta {
  if (kind === 'review') {
    const times = pref.reviewTimes?.length ? pref.reviewTimes : DEFAULT_REVIEW_TIMES
    return { code: SCHEDULE_CODE_REVIEW, label: '慢记复习提醒', cron: timesToCron(times), requestedKey: 'reviewRequested' }
  }
  if (kind === 'signin') {
    return { code: SCHEDULE_CODE_SIGNIN, label: '慢记防断签提醒', cron: timesToCron(resolveSigninTimes(pref)), requestedKey: 'signinRequested' }
  }
  return { code: SCHEDULE_CODE_SYNC, label: '慢记自动备份', cron: SYNC_CRON, requestedKey: 'syncRequested' }
}

let triggerRegistered = false

/** 注册定时任务触发回调（main.ts 顶层调用；重复调用幂等） */
export function registerScheduleTriggerHandler(): void {
  if (triggerRegistered || !isScheduleSupported()) return
  triggerRegistered = true
  getUtools().onScheduleTrigger(({ code }: { code: string }) => {
    // 回调失败会被 uTools 记入任务 failureCount：兜底吞掉异常，只记日志
    return handleScheduleTrigger(code).catch(e => log.e('[定时提醒] 触发处理失败', code, e))
  })
}

/** 定时任务触发处理：按 code 分发 */
export async function handleScheduleTrigger(code: string): Promise<void> {
  const u = getUtools()
  if (!u) return

  if (code === SCHEDULE_CODE_REVIEW) {
    await getDbAdapterAsync()
    const wordsStore = useWordsStore()
    await wordsStore.listWords()
    const count = wordsStore.forgetCount
    if (count > 0) {
      // 第二参为 plugin.json 的 feature.code，点击通知直达复习功能
      u.showNotification(`慢记：有 ${count} 个单词到点待复习`, 'review')
    }
    return
  }

  if (code === SCHEDULE_CODE_SIGNIN) {
    const signinStore = useSigninStore()
    signinStore.loadRecords()
    if (!signinStore.hasSignedToday) {
      const streak = signinStore.streakDays
      u.showNotification(
        streak > 0 ? `慢记：今天还没复习，连续打卡 ${streak} 天要断了` : '慢记：今天还没复习，来打个卡吧',
        'review'
      )
    }
    return
  }

  if (code === SCHEDULE_CODE_SYNC) {
    // 静默备份到 WebDAV：全程不发通知（未配置/无变更/失败都只记日志，不打扰用户）
    // uTools 云同步拉取中途不打快照（replicateStateFromCloud: null=未开同步 0=拉取完成 1=拉取中），避免备份包含中间态
    const replState = await u.db?.promises?.replicateStateFromCloud?.()
    if (replState === 1) {
      log.i('[定时备份] uTools 云同步拉取中，跳过本次')
      return
    }
    const syncStore = useSyncStore()
    await syncStore.webdavReady
    if (!syncStore.webdavConfigured) {
      log.i('[定时备份] 未配置 WebDAV，跳过')
      return
    }
    if (!hasUnsyncedChanges()) {
      log.i('[定时备份] 数据无变更，跳过')
      return
    }
    const result = await syncStore.webdavUpload()
    if (!result.success) log.e('[定时备份] 备份失败', result.error)
  }
}

function removeIfExists(code: string): void {
  try {
    getUtools().removeSchedule(code)
  } catch { /* 任务不存在时 removeSchedule 抛异常，忽略 */ }
}

/** 发起创建请求（系统弹窗由用户决定）；请求后无论结果都标记已发起，避免重复弹窗 */
async function requestTask(kind: ReminderKind): Promise<void> {
  const wordsStore = useWordsStore()
  const meta = taskMeta(kind, wordsStore.scheduleReminder)
  wordsStore.setScheduleReminder({ [meta.requestedKey]: false })
  await getUtools().requestSchedule({ code: meta.code, label: meta.label, trigger: { cron: meta.cron } })
  wordsStore.setScheduleReminder({ [meta.requestedKey]: true })
}

/**
 * 设置页开关切换后的即时应用：开=立即发起创建请求；关=删除任务。
 */
export async function applyScheduleSetting(kind: ReminderKind, enabled: boolean): Promise<void> {
  if (!isScheduleSupported()) return
  try {
    if (enabled) {
      await requestTask(kind)
    } else {
      removeIfExists(taskMeta(kind, useWordsStore().scheduleReminder).code)
    }
  } catch (e) {
    log.e('[定时提醒] 任务创建/删除失败', kind, e)
  }
}

/**
 * 设置页修改提醒时间点后的即时应用：任务开着才需要重建（删旧建新，会再弹一次授权框）；
 * 关着只保存意向，下次打开开关时生效
 */
export async function applyScheduleTimes(kind: ReminderKind): Promise<void> {
  if (!isScheduleSupported()) return
  try {
    const pref = useWordsStore().scheduleReminder
    const on = kind === 'review' ? pref.review : kind === 'signin' ? pref.signin : !!pref.sync
    if (!on) return
    removeIfExists(taskMeta(kind, pref).code)
    await requestTask(kind)
  } catch (e) {
    log.e('[定时提醒] 任务重建失败', kind, e)
  }
}

/**
 * 启动对账：让 uTools 侧任务与设置意向一致（每次进入插件时调用，低成本）
 * - 意向开 + 任务不存在 + 未发起过 → 发起创建请求（仅此一次，用户拒绝后不再骚扰）
 * - 意向开 + 任务不存在 + 已发起过 → 用户曾拒绝或在 uTools 侧删了任务，意向翻转为关（设置页显示真实状态）
 * - 意向关 + 任务存在 → 删除任务
 * - 任务存在但 cron 与当前时间点设置不一致 → 被动对账不主动重建（避免反复弹授权框），等用户在设置页改时间点时重建
 */
export async function reconcileSchedules(): Promise<void> {
  if (!isScheduleSupported()) return
  try {
    const wordsStore = useWordsStore()
    const pref: ScheduleReminderPref = wordsStore.scheduleReminder
    const tasks: Array<{ code: string }> = getUtools().getSchedules() || []
    const has = (code: string) => tasks.some(t => t.code === code)

    const syncOne = async (kind: ReminderKind, on: boolean, requested: boolean) => {
      const meta = taskMeta(kind, pref)
      if (on && !has(meta.code)) {
        if (!requested) {
          await requestTask(kind)
        } else {
          wordsStore.setScheduleReminder({ [kind]: false })
        }
      } else if (!on && has(meta.code)) {
        removeIfExists(meta.code)
      }
    }

    await syncOne('review', pref.review, !!pref.reviewRequested)
    await syncOne('signin', pref.signin, !!pref.signinRequested)
    await syncOne('sync', !!pref.sync, !!pref.syncRequested)
  } catch (e) {
    log.e('[定时提醒] 任务对账失败', e)
  }
}
