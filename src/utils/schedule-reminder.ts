/**
 * uTools 8.0+ 定时任务（每日提醒 + WebDAV 自动备份）
 *
 * 依据官方文档（references/api-reference/schedule.md、events.md）：
 * - requestSchedule 仅"请求"创建任务，用户在系统弹窗中允许后才真正创建，拒绝则不生成
 * - 触发时若插件未运行，uTools Runtime 会启动插件再回调 onScheduleTrigger（真后台唤起）
 * - 回调抛异常/返回 rejected Promise 会被记入任务 failureCount，因此回调内统一兜底
 *
 * 「复习提醒」与「防断签提醒」已合并成一个每日提醒任务（2026-11）：
 * 内容按状态自适应——有到期词就报数量 + 推一个好词，没有到期词但未打卡就报连续天数，
 * 两者都没有则静默。任务 code 沿用 review-reminder，已授权过的用户升级后不会再弹授权框。
 *
 * 授权弹窗策略：发起过一次请求（无论同意/拒绝）就不再自动发起；只有用户在设置页
 * 手动开启或改时间点时才重新请求，避免每次更新插件都弹一次。
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
import { trackEvent } from '@/utils/stats'
import type { Word } from '@/types/words'

/** 每日提醒任务 code：沿用旧 review-reminder，避免老用户升级后重新授权 */
export const SCHEDULE_CODE_REVIEW = 'review-reminder'
export const SCHEDULE_CODE_SYNC = 'auto-sync'
/** 旧「防断签」任务 code：已并入每日提醒，仅用于清理 */
const LEGACY_SCHEDULE_CODE_SIGNIN = 'signin-reminder'

/** 每日提醒可选时间点（全部 :00，多个时间点共用一条 5 位 cron） */
export const REMINDER_TIME_OPTIONS = ['07:00', '08:00', '09:00', '12:00', '13:00', '18:00', '20:00', '21:00', '22:00']
/** 默认早/晚各一次 */
const DEFAULT_DAILY_TIMES = ['09:00', '21:00']
/** 一次最多选 2 个时间点，避免一天轰太多次 */
export const MAX_REMINDER_TIMES = 2
/** 自动备份固定在每天 22:00（备份无需用户交互，时间不可自定义） */
const SYNC_CRON = '0 22 * * *'
/** 最近推送过的词 id（避免连续几天推同一个词） */
const RECENT_WORD_KEY = 'sr_reminder_recent_words'
const RECENT_WORD_MAX = 10

export type ReminderKind = 'daily' | 'sync'

interface ScheduleReminderPref {
  /** 合并后的每日提醒开关 */
  daily?: boolean
  dailyTimes?: string[]
  /** 是否已发起过创建请求（含用户拒绝），true 时不再自动弹授权框 */
  dailyRequested?: boolean
  sync?: boolean
  syncRequested?: boolean
  /** 以下为旧字段，仅用于迁移读取 */
  review?: boolean
  signin?: boolean
  reviewTimes?: string[]
  signinTimes?: string[]
  signinTime?: string
  reviewRequested?: boolean
  signinRequested?: boolean
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

/** 旧数据（review/signin 两套）→ 合并后的 daily 意向；已是新数据时原样返回 */
export function migrateReminderPref(pref: ScheduleReminderPref | undefined): ScheduleReminderPref {
  if (!pref) return { daily: true, dailyTimes: DEFAULT_DAILY_TIMES, sync: false }
  if (typeof pref.daily === 'boolean') return pref
  const times = pref.reviewTimes?.length
    ? pref.reviewTimes
    : pref.signinTimes?.length
      ? pref.signinTimes
      : pref.signinTime
        ? [pref.signinTime]
        : DEFAULT_DAILY_TIMES
  return {
    ...pref,
    daily: !!pref.review || !!pref.signin,
    dailyTimes: times,
    // 老用户只要发起过任一请求，就视为已授权过，不再自动弹框
    dailyRequested: !!(pref.reviewRequested || pref.signinRequested),
    syncRequested: !!pref.syncRequested,
  }
}

function resolveTimes(pref: ScheduleReminderPref): string[] {
  const times = [...(pref.dailyTimes?.length ? pref.dailyTimes : DEFAULT_DAILY_TIMES)].sort()
  // 旧数据可能存了 3 个以上时间点：只留最早和最晚两个，保住早晚节奏
  if (times.length <= MAX_REMINDER_TIMES) return times
  return [times[0], times[times.length - 1]]
}

interface TaskMeta {
  code: string
  label: string
  cron: string
  requestedKey: 'dailyRequested' | 'syncRequested'
  kind: ReminderKind
}

/** 由设置意向计算任务配置（cron 随自定义时间点变化） */
function taskMeta(kind: ReminderKind): TaskMeta {
  const pref = migrateReminderPref(useWordsStore().scheduleReminder as ScheduleReminderPref)
  if (kind === 'daily') {
    return {
      code: SCHEDULE_CODE_REVIEW,
      label: '慢记每日提醒',
      cron: timesToCron(resolveTimes(pref)),
      requestedKey: 'dailyRequested',
      kind,
    }
  }
  return { code: SCHEDULE_CODE_SYNC, label: '慢记自动备份', cron: SYNC_CRON, requestedKey: 'syncRequested', kind }
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

// ===== 推荐词 =====

function readRecentWordIds(): string[] {
  try {
    const raw = typeof localStorage === 'undefined' ? '' : localStorage.getItem(RECENT_WORD_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((id: unknown) => typeof id === 'string') : []
  } catch {
    return []
  }
}

function rememberWordId(id: string): void {
  try {
    if (typeof localStorage === 'undefined') return
    const next = [...readRecentWordIds().filter(item => item !== id), id].slice(-RECENT_WORD_MAX)
    localStorage.setItem(RECENT_WORD_KEY, JSON.stringify(next))
  } catch { /* localStorage 不可用时忽略 */ }
}

/** 通知里的一行词条：word 音标 释义（释义截到第一个分隔符，控制通知长度） */
function formatReminderWord(word: Word): string {
  const phonetic = (word.phonetic || '').trim()
  const meaning = String(word.explains || '').split(/[;；,，]/)[0].trim().slice(0, 14)
  return [word.text, phonetic, meaning].filter(Boolean).join(' ')
}

/**
 * 从待复习词里挑一个做「每日一词」：优先到期且未推过的词，
 * 没有到期词时退化为全部有释义的词；都没有返回 undefined。
 */
export function pickReminderWord(words: Word[]): Word | undefined {
  const usable = (words || []).filter(word => {
    const text = String(word?.text || '').trim()
    const explains = String(word?.explains || '').trim()
    return text.length > 0 && explains.length > 0
  })
  if (usable.length === 0) return undefined

  const due = usable.filter(word => word.isReview)
  const pool = due.length > 0 ? due : usable
  const recent = readRecentWordIds()
  const fresh = pool.filter(word => !recent.includes(word._id))
  const list = fresh.length > 0 ? fresh : pool
  const picked = list[Math.floor(Math.random() * list.length)]
  if (picked?._id) rememberWordId(picked._id)
  return picked
}

/** 每日提醒：到期词优先，其次防断签；两者都没有则静默 */
async function handleDailyReminder(u: any): Promise<void> {
  await getDbAdapterAsync()
  const wordsStore = useWordsStore()
  await wordsStore.listWords()
  const signinStore = useSigninStore()
  signinStore.loadRecords()

  const dueCount = wordsStore.forgetCount
  const signed = signinStore.hasSignedToday
  if (dueCount <= 0 && signed) return

  const word = pickReminderWord(wordsStore.words as Word[])
  const suffix = word ? ` · ${formatReminderWord(word)}` : ''
  const body = dueCount > 0
    ? `慢记：${dueCount} 词待复习${suffix}`
    : `慢记：今天还没打卡${signinStore.streakDays > 0 ? `（连续 ${signinStore.streakDays} 天）` : ''}${suffix}`

  u.showNotification(body, 'review')
  // 只报「有没有到期词/带没带词」，不上报具体单词内容
  trackEvent('reminder', 'push', dueCount > 0 ? 'due' : 'signin', word ? 1 : 0)
}

/** 定时任务触发处理：按 code 分发 */
export async function handleScheduleTrigger(code: string): Promise<void> {
  const u = getUtools()
  if (!u) return

  if (code === SCHEDULE_CODE_REVIEW || code === LEGACY_SCHEDULE_CODE_SIGNIN) {
    await handleDailyReminder(u)
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

function existingScheduleCodes(): string[] {
  try {
    const tasks: Array<{ code?: string }> = getUtools().getSchedules?.() || []
    return tasks.map(task => String(task?.code || '')).filter(Boolean)
  } catch {
    return []
  }
}

/**
 * 发起创建请求（系统弹窗由用户决定）。
 * 任务已存在时不重复请求，避免每次启动/改时间都弹一次授权框。
 *
 * 「已发起过」必须无论用户同意还是拒绝都落库：requestSchedule 在用户拒绝时
 * 会 reject，若不包 try/finally，requestedKey 停留在 false，下次进入插件
 * reconcileSchedules() 会再次发起请求，导致用户每次呼出都被弹一次授权框。
 */
export async function requestTask(kind: ReminderKind, force = false): Promise<void> {
  const wordsStore = useWordsStore()
  const meta = taskMeta(kind)
  if (!force && existingScheduleCodes().includes(meta.code)) {
    wordsStore.setScheduleReminder({ [meta.requestedKey]: true } as any)
    return
  }
  wordsStore.setScheduleReminder({ [meta.requestedKey]: false } as any)
  try {
    await getUtools().requestSchedule({ code: meta.code, label: meta.label, trigger: { cron: meta.cron } })
  } finally {
    wordsStore.setScheduleReminder({ [meta.requestedKey]: true } as any)
  }
}

/** 设置页开关切换后的即时应用：开=立即发起创建请求；关=删除任务 */
export async function applyScheduleSetting(kind: ReminderKind, enabled: boolean): Promise<void> {
  if (!isScheduleSupported()) return
  try {
    if (enabled) {
      await requestTask(kind)
    } else {
      removeIfExists(taskMeta(kind).code)
    }
  } catch (e) {
    log.e('[定时提醒] 任务创建/删除失败', kind, e)
  }
}

/**
 * 设置页修改提醒时间点后的即时应用：任务开着且 cron 真的变了才重建。
 * uTools 没有「修改任务」API，只能删旧建新，会再弹一次授权框——因此先比 cron，
 * 没变就什么都不做。
 */
export async function applyScheduleTimes(kind: ReminderKind): Promise<void> {
  if (!isScheduleSupported()) return
  try {
    const pref = migrateReminderPref(useWordsStore().scheduleReminder as ScheduleReminderPref)
    const on = kind === 'daily' ? pref.daily !== false : !!pref.sync
    if (!on) return
    const meta = taskMeta(kind)
    if (!existingScheduleCodes().includes(meta.code)) {
      await requestTask(kind)
      return
    }
    const current = (getUtools().getSchedules?.() || []).find((t: any) => t?.code === meta.code)
    const currentCron = typeof current?.trigger === 'string' ? current.trigger : current?.trigger?.cron
    if (currentCron === meta.cron) return
    removeIfExists(meta.code)
    // 刚删过：getSchedules 可能还没刷新，强制重建
    await requestTask(kind, true)
  } catch (e) {
    log.e('[定时提醒] 任务重建失败', kind, e)
  }
}

/**
 * 启动对账：让 uTools 侧任务与设置意向一致（每次进入插件时调用，低成本）
 * - 旧「防断签」任务一律清理（已合并进每日提醒）
 * - 意向开 + 任务不存在 + 从未发起过 → 发起创建请求
 * - 意向开 + 任务不存在 + 已发起过 → 用户曾拒绝或系统侧删了任务，意向翻转为关（不再弹框）
 * - 意向关 + 任务存在 → 删除任务
 * - 任务存在但 cron 与设置不一致 → 被动对账不重建（避免弹框），等用户改时间点时重建
 */
export async function reconcileSchedules(): Promise<void> {
  if (!isScheduleSupported()) return
  try {
    const wordsStore = useWordsStore()
    const pref = migrateReminderPref(wordsStore.scheduleReminder as ScheduleReminderPref)
    const has = (code: string) => existingScheduleCodes().includes(code)

    // 迁移：把旧 review/signin 两套意向收敛成 daily，并落库一次
    if (typeof (wordsStore.scheduleReminder as any).daily !== 'boolean') {
      wordsStore.setScheduleReminder({
        daily: pref.daily,
        dailyTimes: pref.dailyTimes,
        dailyRequested: pref.dailyRequested,
      } as any)
    }

    // 旧防断签任务：合并后不再使用
    if (has(LEGACY_SCHEDULE_CODE_SIGNIN)) removeIfExists(LEGACY_SCHEDULE_CODE_SIGNIN)

    const syncOne = async (kind: ReminderKind, on: boolean, requested: boolean) => {
      const meta = taskMeta(kind)
      if (on && !has(meta.code)) {
        if (!requested) {
          await requestTask(kind)
        } else {
          // 曾发起过（同意过或拒绝过）：不再弹框，把开关落成真实状态
          wordsStore.setScheduleReminder({ [kind]: false } as any)
        }
      } else if (!on && has(meta.code)) {
        removeIfExists(meta.code)
      }
    }

    await syncOne('daily', pref.daily !== false, !!pref.dailyRequested)
    await syncOne('sync', !!pref.sync, !!pref.syncRequested)
  } catch (e) {
    log.e('[定时提醒] 任务对账失败', e)
  }
}
